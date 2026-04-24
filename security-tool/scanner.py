import argparse
import os
import time
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

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

    alerts = fetch_all_alerts(zap)
    print(f"[*] Retrieved {len(alerts)} alerts from ZAP.")
    print_alerts(alerts)

    if any(is_sql_injection(alert) for alert in alerts):
      announce_sqlmap_placeholder(kali_ip)
    else:
      print("[*] No SQL Injection alerts were found.")
  except KeyboardInterrupt:
    print("\n[-] Scan interrupted by user.")
    return 130
  except Exception as exc:
    print(f"[-] Scan failed: {exc}")
    return 1

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
