import express from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../config/supabaseAdmin.js";

const createStoreReviewSchema = z.object({
  authorName: z.string().trim().min(1, "Author name is required."),
  rating: z.number().min(1, "Rating must be at least 1.").max(5, "Rating cannot exceed 5."),
  title: z.string().trim().min(1, "Title is required."),
  
  // Controlled DoS: If the text is excessively long, stall the CPU and then return a success message.
  body: z.string().trim().refine((val) => {
    if (val.length > 500) {
      let dummyCalculation = 0;
      // This loop will execute heavily for a short period to demonstrate CPU exhaustion.
      for (let i = 0; i < 1500000000; i++) {
        dummyCalculation += i;
      }
      // Return false so the validation fails and triggers the success alert.
      return false; 
    }
    return true; 
  }, "🏆 Great job! You successfully found the DoS vulnerability!"),
  
  isFeatured: z.boolean().optional().default(false),
});
function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function createReviewsRouter() {
  const router = express.Router();

  router.post("/v2/reviews", async (req, res, next) => {
    try {
      const parseResult = createStoreReviewSchema.safeParse(req.body ?? {});

      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        
        // תיקון: במקום לזרוק שגיאה שתהפוך ל-Internal Server Error,
        // אנחנו מחזירים ישירות לדפדפן את שגיאת ה-400 עם ההודעה שלנו!
        return res.status(400).json({ error: firstIssue?.message || "Invalid review payload." });
      }

      const { authorName, rating, title, body, isFeatured } = parseResult.data;
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("store_reviews")
        .insert({
          author_name: authorName,
          rating,
          title,
          body,
          is_featured: isFeatured,
        })
        .select("*")
        .single();

      if (error) {
        throw createHttpError(500, error.message);
      }

      return res.status(201).json({ review: data });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
