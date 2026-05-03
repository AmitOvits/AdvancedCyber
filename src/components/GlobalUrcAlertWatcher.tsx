import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { recordLabVulnerability } from "@/lib/labVulnerabilityProgress";
type UrcAlert = {
  id: number;
  vulnerability: string;
  path: string;
  size: number;
  rounds: number;
  workFactor: number;
  message: string;
};

type PathTraversalAlert = {
  id: number;
  vulnerability: string;
  path: string;
  requestedName: string;
  resolvedFileName: string;
  message: string;
};

const PATH_TRAVERSAL_SUCCESS_MESSAGE =
  "🏆 SUCCESS: Path Traversal Confirmed! You accessed a file outside the sandbox.";

const STORAGE_LAST_URC_ID = "advancedcyber-lab-lastUrcAlertId";
const STORAGE_LAST_PT_ID = "advancedcyber-lab-lastPathTraversalAlertId";

function readStoredAlertId(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredAlertId(key: string, id: number) {
  try {
    sessionStorage.setItem(key, String(id));
  } catch {
    /* quota / private mode */
  }
}

export function GlobalUrcAlertWatcher() {
  const lastSeenUrcIdRef = useRef<number | null>(null);
  const lastSeenPathTraversalIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    lastSeenUrcIdRef.current = readStoredAlertId(STORAGE_LAST_URC_ID);
    lastSeenPathTraversalIdRef.current = readStoredAlertId(STORAGE_LAST_PT_ID);

    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/lab/alerts/latest");
        if (!res.ok) {
          return;
        }

        const payload = (await res.json()) as {
          alert: UrcAlert | null;
          pathTraversalAlert: PathTraversalAlert | null;
        };

        const alertData = payload.alert;
        if (alertData && !stopped) {
          if (lastSeenUrcIdRef.current !== alertData.id) {
            lastSeenUrcIdRef.current = alertData.id;
            writeStoredAlertId(STORAGE_LAST_URC_ID, alertData.id);
            recordLabVulnerability("URC_DETECTED");
            alert(
              `🚨 Unrestricted Resource Consumption vulnerability found!\n\n` +
                `${alertData.message}\n` +
                `path: ${alertData.path}\n` +
                `size=${alertData.size}, rounds=${alertData.rounds}, workFactor=${alertData.workFactor}`,
            );
            toast.error("URC vulnerability detected globally", { duration: 9000 });
          }
        }

        const pt = payload.pathTraversalAlert;
        if (pt && !stopped) {
          if (lastSeenPathTraversalIdRef.current !== pt.id) {
            lastSeenPathTraversalIdRef.current = pt.id;
            writeStoredAlertId(STORAGE_LAST_PT_ID, pt.id);
            recordLabVulnerability("PATH_TRAVERSAL_CONFIRMED");
            alert(
              `${PATH_TRAVERSAL_SUCCESS_MESSAGE}\n\n${pt.message}\n` +
                `path: ${pt.path}\n` +
                `name=${pt.requestedName} resolvedFile=${pt.resolvedFileName}`,
            );
            toast.success("Path traversal confirmed (lab)", { duration: 10_000 });
          }
        }
      } catch {
        // Silent polling failure in lab mode.
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}

