import express from "express";
import { getSupabaseAdminClient } from "../config/supabaseAdmin.js";

export function createReviewsV1Router() {
  const router = express.Router();

  // --- חשוב: שינינו את הנתיב מ-"/reviews" ל-"/" ---
  // כי השרת כבר יודע שהוא נמצא תחת "/api/v1/reviews" מתוך ה-index.js
  
  // 1. נתיב ה-GET עבור הסורק (כדי שיחזיר 200 OK)
  router.get("/", (req, res) => {
    res.status(200).json({ version: "1.0.0-legacy", status: "active" });
  });

  // 2. נתיב ה-POST עבור התקיפה
  router.post("/", async (req, res) => {
    const { authorName, rating, title, body } = req.body;

    // חולשת DoS / legacy validation gap (API4 class): oversized body accepted, then expensive work.
    // Lab: bounded work only — a real deployment might loop unbounded; here we flag the weakness safely.
    if (body && body.length > 500) {
      console.log("🚨 [V1] ATTACK DETECTED: legacy endpoint accepted abusive payload (training flag).");
      res.set("x-training-vulnerability", "LEGACY_REVIEWS_V1_ABUSE");
      return res.status(400).json({
        error:
          "🏆 Victory! You exploited API9 by finding an unpatched legacy endpoint (/v1/) and triggered a DoS-class abuse path!",
      });
    }

    // שמירה בסיסית ב-DB
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from("store_reviews").insert({
      author_name: authorName, rating, title, body
    }).select("*").single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ review: data });
  });

  return router;
}