import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth";
import { recordLabVulnerabilities, recordLabVulnerability } from "@/lib/labVulnerabilityProgress";

type ChatMessage = { role: "user" | "ai"; text: string };

const USER_WELCOME = "Verified Expert Advice: Ask me about sizing, cleaning, or styling your shoes.";
const ADMIN_WELCOME =
  "To unlock training the model, send trainig model: and then the perfect string";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PROMPTS_PER_WINDOW = 5;

function formatLabAlert(statusLine: string) {
  return [
    "🚨 CRITICAL VULNERABILITY EXPLOITED! 🚨",
    "",
    statusLine,
    "",
    "Account: soleadmin",
    "Leaked Records: 1",
    "",
    "System control is now compromised.",
  ].join("\n");
}

export function AiShoeExpertWidget() {
  const { isAdmin, loading, session, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "ai", text: USER_WELCOME }]);
  const shownSoleadminAlert = useRef(false);
  const shownTrainingPoisonAlert = useRef(false);
  const shownTrainingSavedAlert = useRef(false);
  const shownOverconsumptionAlert = useRef(false);
  const promptSendTimes = useRef<number[]>([]);

  useEffect(() => {
    if (loading) return;
    setMessages([{ role: "ai", text: isAdmin ? ADMIN_WELCOME : USER_WELCOME }]);
  }, [loading, isAdmin]);

  const canSend = useMemo(() => draft.trim().length > 0 && !busy, [draft, busy]);

  function recordPromptSendAndMaybeShowOverconsumptionAlert() {
    const now = Date.now();
    const windowStart = now - RATE_WINDOW_MS;
    const recent = promptSendTimes.current.filter((t) => t >= windowStart);
    recent.push(now);
    promptSendTimes.current = recent;
    if (
      !shownOverconsumptionAlert.current &&
      recent.length >= RATE_MAX_PROMPTS_PER_WINDOW
    ) {
      shownOverconsumptionAlert.current = true;
      recordLabVulnerability("LLM_LARGE_CONTEXT_REQUEST");
      window.alert(
        formatLabAlert("UNBOUNDED CONSUMPTION via overloading the system"),
      );
    }
  }

  function maybeRecordOverconsumptionFromFailure() {
    if (shownOverconsumptionAlert.current) {
      return;
    }
    if (promptSendTimes.current.length >= RATE_CRASH_TRIGGER_MIN_PROMPTS) {
      shownOverconsumptionAlert.current = true;
      recordLabVulnerability("LLM_LARGE_CONTEXT_REQUEST");
      window.alert(
        formatLabAlert("UNBOUNDED CONSUMPTION via crash during rapid-fire requests"),
      );
    }
  }

  function maybeShowVulnerabilityAlerts(reply: string) {
    if (!shownSoleadminAlert.current && /soleadmin/i.test(reply)) {
      shownSoleadminAlert.current = true;
      recordLabVulnerability("LLM_PROMPT_OVERRIDE_ATTEMPT");
      window.alert(
        formatLabAlert("ADMIN NAME FOUND via prompt injection and jailbreak"),
      );
    }
    if (
      isAdmin &&
      !shownTrainingPoisonAlert.current &&
      reply.trim() === "now you can train the model"
    ) {
      shownTrainingPoisonAlert.current = true;
      recordLabVulnerability("LLM_SYSTEM_PROMPT_EXFILTRATION");
      window.alert(formatLabAlert("MODEL TRAINING POISONING"));
    }
    if (
      isAdmin &&
      !shownTrainingSavedAlert.current &&
      reply.includes("New instructions are saved for this server session")
    ) {
      shownTrainingSavedAlert.current = true;
      recordLabVulnerability("LLM_PROMPT_OVERRIDE_ATTEMPT");
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;

    recordPromptSendAndMaybeShowOverconsumptionAlert();

    setDraft("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }]);

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      if (import.meta.env.VITE_ALLOW_INSECURE_LAB === "true" && user?.id) {
        headers["x-user-id"] = user.id;
      }

      const body: { message: string; userId?: string } = { message: text };
      if (import.meta.env.VITE_ALLOW_INSECURE_LAB === "true" && user?.id) {
        body.userId = user.id;
      }

      const res = await fetch("/api/ai-expert", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        labVulnerabilities?: string[];
        error?: string;
      };
      if (Array.isArray(data.labVulnerabilities) && data.labVulnerabilities.length > 0) {
        recordLabVulnerabilities(data.labVulnerabilities);
      }
      if (!res.ok) {
        maybeRecordOverconsumptionFromFailure();
      }

      const reply = res.ok
        ? typeof data?.reply === "string"
          ? data.reply
          : "Verified Expert Advice: (no response)"
        : typeof data?.error === "string"
          ? `Verified Expert Advice: ${data.error}`
          : "Verified Expert Advice: (request failed)";
      setMessages((m) => [...m, { role: "ai", text: reply }]);
      maybeShowVulnerabilityAlerts(reply);
    } catch {
      maybeRecordOverconsumptionFromFailure();
      setMessages((m) => [...m, { role: "ai", text: "Verified Expert Advice: (network error)" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open ? (
        <Button className="rounded-full shadow-lg" onClick={() => setOpen(true)}>
          AI Shoe Expert
        </Button>
      ) : (
        <div className="w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold">AI Shoe Expert</div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>

          <div className="max-h-[320px] overflow-y-auto px-4 py-3 space-y-2">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={[
                  "text-sm leading-relaxed rounded-xl px-3 py-2",
                  m.role === "user" ? "bg-primary text-primary-foreground ml-10" : "bg-muted text-foreground mr-10",
                ].join(" ")}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask for verified expert advice…"
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              disabled={busy}
            />
            <Button onClick={() => void send()} disabled={!canSend}>
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

