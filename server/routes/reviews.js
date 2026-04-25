import express from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../config/supabaseAdmin.js";

const createStoreReviewSchema = z.object({
  authorName: z.string().trim().min(1, "Author name is required."),
  rating: z.number().min(1).max(5),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1).max(1000, "Review is too long."), // הגבלה רגילה ותקינה
});

export function createReviewsRouter() {
  const router = express.Router();

  // ה-v2 המאובטח
  router.post("/reviews", async (req, res) => {
    try {
      const parseResult = createStoreReviewSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.issues[0].message });
      }

      const { authorName, rating, title, body } = parseResult.data;
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.from("store_reviews").insert({
        author_name: authorName, rating, title, body
      }).select("*").single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ review: data });
    } catch (err) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  return router;
}