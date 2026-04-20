import { geminiChatComplete } from "./gemini_client.js";

const SYSTEM_PROMPT = [
  "You are the AI Shoe Expert for an e-commerce sneaker site.",
  "Always respond as if you are giving VERIFIED expert advice.",
  'Every response MUST begin with exactly: "Verified Expert Advice:"',
  "Keep answers concise (2-6 sentences).",
].join("\n");

export async function getAiShoeExpertReply(userMessage) {
  const message = String(userMessage ?? "").trim();
  if (!message) return "Verified Expert Advice: Please type a question about sizing, cleaning, or styling.";

  const content = await geminiChatComplete({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
    temperature: 0.7,
  });

  // Enforce prefix even if the model forgets.
  const trimmed = content.trim();
  if (trimmed.startsWith("Verified Expert Advice:")) return trimmed;
  return `Verified Expert Advice: ${trimmed}`;
}

