import { useEffect, useRef } from "react";
import { toast } from "sonner";
type UrcAlert = {
  id: number;
  vulnerability: string;
  path: string;
  size: number;
  rounds: number;
  workFactor: number;
  message: string;
};

export function GlobalUrcAlertWatcher() {
  const lastSeenIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/lab/alerts/latest");
        if (!res.ok) {
          return;
        }

        const payload = (await res.json()) as { alert: UrcAlert | null };
        const alertData = payload.alert;
        if (!alertData || stopped) {
          return;
        }

        if (lastSeenIdRef.current === alertData.id) {
          return;
        }

        lastSeenIdRef.current = alertData.id;
        alert(
          `🚨 Unrestricted Resource Consumption vulnerability found!\n\n` +
            `${alertData.message}\n` +
            `path: ${alertData.path}\n` +
            `size=${alertData.size}, rounds=${alertData.rounds}, workFactor=${alertData.workFactor}`,
        );
        toast.error("URC vulnerability detected globally", { duration: 9000 });
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

