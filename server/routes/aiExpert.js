import express from "express";
import { getAiShoeExpertReply } from "../../Chat/ai_expert.js";
import { attachPerfGridHintHeaders } from "../labHints.js";
import { getRequestUserId, isUserAdmin } from "../lib/verifyAdminRequest.js";

export function createAiExpertRouter() {
  const router = express.Router();

  router.post("/ai-expert", async (req, res, next) => {
    try {
      const { message } = req.body ?? {};
      const userId = await getRequestUserId(req);
      const isAdmin = userId ? await isUserAdmin(userId) : false;
      const reply = await getAiShoeExpertReply(message, { isAdmin });
      attachPerfGridHintHeaders(res);
      return res.json({ reply });
    } catch (error) {
      const routeError = error instanceof Error ? error : new Error("AI expert request failed");
      routeError.status = 502;
      return next(routeError);
    }
  });

  return router;
}
