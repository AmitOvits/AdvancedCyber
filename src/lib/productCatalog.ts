import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Product } from "@/data/products";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export interface ProductFilterOptions {
  brands: string[];
  categories: string[];
  sizes: number[];
  maxPrice: number;
}

function mapProductRow(row: ProductRow): Product {
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

export async function fetchProductsFromDb() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map(mapProductRow);
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
