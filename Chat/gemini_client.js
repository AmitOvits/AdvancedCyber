import crypto from "crypto";

const DEFAULT_GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash-lite";

export function getGeminiSettings() {
  const apiKey = process.env.ORCHESTRATION_KEY_BIG_DATA || "";
  if (!apiKey) {
    throw new Error("Missing ORCHESTRATION_KEY_BIG_DATA environment variable");
  }

  const baseUrl = process.env.GEMINI_OPENAI_BASE_URL || DEFAULT_GEMINI_OPENAI_BASE_URL;
  const model = process.env.GEMINI_CHAT_MODEL || DEFAULT_GEMINI_CHAT_MODEL;

  return { apiKey, baseUrl, model };
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export async function geminiChatComplete({ messages, temperature = 0.4 }) {
  const { apiKey, baseUrl, model } = getGeminiSettings();

  const url = `${normalizeBaseUrl(baseUrl)}chat/completions`;

  const body = {
    model,
    messages,
    temperature,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-request-id": crypto.randomUUID?.() ?? crypto.randomBytes(16).toString("hex"),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini chat/completions failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Gemini response missing message content");
  }

  return content;
}

