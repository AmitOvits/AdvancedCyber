import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatMessage = { role: "user" | "ai"; text: string };

export function AiShoeExpertWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", text: "Verified Expert Advice: Ask me about sizing, cleaning, or styling your shoes." },
  ]);

  const canSend = useMemo(() => draft.trim().length > 0 && !busy, [draft, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;

    setDraft("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }]);

    try {
      const res = await fetch("/api/ai-expert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = res.ok
        ? typeof data?.reply === "string"
          ? data.reply
          : "Verified Expert Advice: (no response)"
        : typeof data?.error === "string"
          ? `Verified Expert Advice: ${data.error}`
          : "Verified Expert Advice: (request failed)";
      setMessages((m) => [...m, { role: "ai", text: reply }]);
    } catch {
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

