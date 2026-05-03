import express from "express";
import { getAiShoeExpertReply } from "../../Chat/ai_expert.js";
import { attachPerfGridHintHeaders } from "../labHints.js";
import { isTrainingModeEnabled } from "../config/trainingMode.js";

/**
 * OWASP LLM Top 10 style lab flags: user text is forwarded to the model with no hardening.
 * Students trigger these with obvious probe phrases or oversized messages.
 */
function detectLlmTrainingFindings(rawMessage) {
  if (!isTrainingModeEnabled()) {
    return [];
  }

  const text = String(rawMessage ?? "");
  const found = new Set();

  if (
    /(ignore|disregard)\s+(all\s+)?(previous|above|prior)\s+(instructions|rules|prompt)/i.test(text) ||
    /\byou\s+are\s+now\b/i.test(text)
  ) {
    found.add("LLM_PROMPT_OVERRIDE_ATTEMPT");
  }

  if (text.length > 3000) {
    found.add("LLM_LARGE_CONTEXT_REQUEST");
  }

  if (
    /(show|reveal|print|repeat|give\s+me|output)\b[\s\S]{0,48}\b(system\s+prompt|your\s+instructions|developer\s+message|hidden\s+rules)/i.test(
      text,
    )
  ) {
    found.add("LLM_SYSTEM_PROMPT_EXFILTRATION");
  }

  return [...found];
}

export function createAiExpertRouter() {
  const router = express.Router();

  router.post("/ai-expert", async (req, res, next) => {
    try {
      const { message } = req.body ?? {};
      const labVulnerabilities = detectLlmTrainingFindings(message);
      const reply = await getAiShoeExpertReply(message);
      attachPerfGridHintHeaders(res);
      if (labVulnerabilities.length > 0) {
        res.set("x-training-vulnerability", labVulnerabilities.join(", "));
      }
      return res.json({ reply, labVulnerabilities });
    } catch (error) {
      const routeError = error instanceof Error ? error : new Error("AI expert request failed");
      routeError.status = 502;
      return next(routeError);
    }
  });

  return router;
}
