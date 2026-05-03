import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export type StoreReviewRow = Database["public"]["Tables"]["store_reviews"]["Row"];

export interface StoreReview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  isFeatured: boolean;
  createdAt: string;
}

export const createReviewSchema = z.object({
  authorName: z.string().trim().min(1, "Author name is required."),
  rating: z.coerce.number().min(1, "Rating must be at least 1.").max(5, "Rating cannot exceed 5."),
  title: z.string().trim().min(1, "Title is required."),
  body: z.string().trim().min(1, "Review body is required."),
  isFeatured: z.boolean().default(false),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export function mapStoreReviewRow(row: StoreReviewRow): StoreReview {
  return {
    id: row.id,
    authorName: row.author_name,
    rating: Number(row.rating),
    title: row.title,
    body: row.body,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
  };
}

export async function fetchStoreReviews() {
  const { data, error } = await supabase
    .from("store_reviews")
    .select("*")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapStoreReviewRow);
}

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export async function createStoreReview(input: CreateReviewInput) {
  const payload = createReviewSchema.parse(input);
  const response = await fetch("/api/v2/reviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const body = (await response.json()) as { review: StoreReviewRow };
  return mapStoreReviewRow(body.review);
}
