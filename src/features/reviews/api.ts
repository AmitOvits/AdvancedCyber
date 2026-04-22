import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
