import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderStatus = OrderRow["status"];

export interface CreateOrderItemInput {
  productId: string;
  productName: string;
  size: number;
  quantity: number;
  price: number;
}

export interface CreateOrderInput {
  userId: string | null;
  total: number;
  shippingAddress: Database["public"]["Tables"]["orders"]["Insert"]["shipping_address"];
  items: CreateOrderItemInput[];
}

export async function fetchOrders() {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as OrderRow[];
}

export async function updateOrderStatus(orderId: string, status: string) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);

  if (error) {
    throw error;
  }
}

export async function createOrderWithItems(input: CreateOrderInput) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: input.userId,
      total: input.total,
      status: "pending",
      shipping_address: input.shippingAddress,
    })
    .select()
    .single();

  if (orderError) {
    throw orderError;
  }

  const orderItems = input.items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: item.productName,
    size: item.size,
    quantity: item.quantity,
    price: item.price,
  }));

  const { error: orderItemsError } = await supabase.from("order_items").insert(orderItems);

  if (orderItemsError) {
    throw orderItemsError;
  }

  return order;
}
