import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Product } from "@/data/products";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

export interface ProductFilterOptions {
  brands: string[];
  categories: string[];
  sizes: number[];
  maxPrice: number;
}

export function mapProductRowToProduct(row: ProductRow): Product {
  const sizes = Array.isArray(row.sizes) ? row.sizes.map((size) => Number(size)) : [];

  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    price: Number(row.price),
    originalPrice: row.original_price == null ? undefined : Number(row.original_price),
    image: row.image,
    sizes,
    category: row.category,
    description: row.description ?? "",
    rating: Number(row.rating ?? 0),
    reviews: Number(row.reviews ?? 0),
    isNew: row.is_new,
  };
}

export async function fetchProductRows() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductRow[];
}

export async function fetchCatalogProducts() {
  const rows = await fetchProductRows();
  return rows.map(mapProductRowToProduct);
}

export async function createProduct(product: ProductInsert) {
  const { error } = await supabase.from("products").insert(product);

  if (error) {
    throw error;
  }
}

export async function deleteProduct(productId: string) {
  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    throw error;
  }
}

export function getProductFilterOptions(products: Product[]): ProductFilterOptions {
  const brands = [...new Set(products.map((product) => product.brand))].sort((a, b) => a.localeCompare(b));
  const categories = [...new Set(products.map((product) => product.category))].sort((a, b) =>
    a.localeCompare(b),
  );
  const sizes = [...new Set(products.flatMap((product) => product.sizes))].sort((a, b) => a - b);
  const maxPrice = Math.max(...products.map((product) => product.price), 300);

  return {
    brands,
    categories,
    sizes,
    maxPrice,
  };
}
