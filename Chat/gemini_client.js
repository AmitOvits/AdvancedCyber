import crypto from "crypto";

// This module talks to a local/remote Llama via Ollama.
// It supports two transports:
//   1) Ollama native API:    POST {base}/api/chat
//   2) OpenAI-compatible:    POST {base}/v1/chat/completions
//
// The transport is auto-detected from the configured base URL.
// If the base URL already ends with /v1 (or /v1/), we use the OpenAI-compatible
// path; otherwise we use Ollama's native /api/chat (which is what your .env
// `OLLAMA_BASE_URL=http://127.0.0.1:11434/` is set up for).

const DEFAULT_LLAMA_BASE_URL = "http://127.0.0.1:11434/";
const DEFAULT_LLAMA_CHAT_MODEL = "llama3.2";

function trimTrailingSlash(s) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

export function getLlamaSettings() {
  const apiKey = process.env.LLAMA_API_KEY || "";

  const baseUrl =
    process.env.LLAMA_OPENAI_BASE_URL ||
    process.env.OLLAMA_BASE_URL ||
    DEFAULT_LLAMA_BASE_URL;

  const model =
    process.env.LLAMA_CHAT_MODEL ||
    process.env.OLLAMA_MODEL ||
    DEFAULT_LLAMA_CHAT_MODEL;

  if (!baseUrl) {
    throw new Error("Missing OLLAMA_BASE_URL (or LLAMA_OPENAI_BASE_URL) environment variable");
  }

  const timeoutMs = Number.parseInt(process.env.OLLAMA_TIMEOUT_MS || "", 10) || 120_000;
  const keepAlive = process.env.OLLAMA_KEEP_ALIVE || undefined;
  const numPredict = Number.parseInt(process.env.OLLAMA_NUM_PREDICT || "", 10) || undefined;
  const numCtx = Number.parseInt(process.env.OLLAMA_NUM_CTX || "", 10) || undefined;

  return { apiKey, baseUrl, model, timeoutMs, keepAlive, numPredict, numCtx };
}

function buildEndpoint(baseUrl) {
  const trimmed = trimTrailingSlash(baseUrl);
  if (/\/v1$/i.test(trimmed)) {
    return { url: `${trimmed}/chat/completions`, mode: "openai" };
  }
  return { url: `${trimmed}/api/chat`, mode: "ollama" };
}

async function postJson(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function llamaChatComplete({ messages, temperature = 0.4 }) {
  const { apiKey, baseUrl, model, timeoutMs, keepAlive, numPredict, numCtx } = getLlamaSettings();
  const { url, mode } = buildEndpoint(baseUrl);

  /** @type {Record<string, string>} */
  const headers = {
    "content-type": "application/json",
    "x-request-id": crypto.randomUUID?.() ?? crypto.randomBytes(16).toString("hex"),
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  let body;
  if (mode === "ollama") {
    body = {
      model,
      messages,
      stream: false,
      options: {
        temperature,
        ...(numPredict ? { num_predict: numPredict } : {}),
        ...(numCtx ? { num_ctx: numCtx } : {}),
      },
      ...(keepAlive ? { keep_alive: keepAlive } : {}),
    };
  } else {
    body = { model, messages, temperature };
  }

  const res = await postJson(url, headers, body, timeoutMs);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Llama chat failed (${mode}): ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
    );
  }

  const json = await res.json();

  const content =
    mode === "ollama"
      ? json?.message?.content
      : json?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Llama response missing message content");
  }

  return content;
}

// Backwards-compatible exports so existing imports keep working.
export function getGeminiSettings() {
  return getLlamaSettings();
}

export async function geminiChatComplete(args) {
  return llamaChatComplete(args);
}
