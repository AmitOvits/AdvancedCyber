import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderStatus = OrderRow["status"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

export interface InsecureOrderWithNumber {
  orderNumber: number;
  order: OrderRow;
}

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

export async function fetchOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as OrderItemRow[];
}

// INTENTIONAL VULNERABILITY (BOLA/IDOR):
// Loads all orders first, then filters client-side by user_id.
export async function fetchMyOrdersInsecure(userId: string) {
  const allOrders = await fetchOrders();

  return allOrders
    .map((order, index) => ({ orderNumber: index + 1, order }))
    .filter(({ order }) => order.user_id === userId) as InsecureOrderWithNumber[];
}

// INTENTIONAL VULNERABILITY (BOLA/IDOR):
// Returns order by URL-controlled numeric position without ownership checks.
export async function fetchOrderByNumberInsecure(orderNumber: number) {
  if (!Number.isInteger(orderNumber) || orderNumber < 1) {
    throw new Error("Invalid order number");
  }

  const allOrders = await fetchOrders();
  const order = allOrders[orderNumber - 1];

  if (!order) {
    throw new Error("Order not found");
  }

  return order;
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
