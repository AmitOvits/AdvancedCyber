import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Product } from "@/data/products";

export interface CartItem {
  product: Product;
  size: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, size: number) => void;
  removeItem: (productId: string, size: number) => void;
  updateQuantity: (productId: string, size: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "shoe-shop-cart";
const SHOP_SESSION_COOKIE = "shop_session";

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));

  return cookie ? cookie.slice(prefix.length) : null;
}

function readInitialItems() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(CART_KEY);

    if (saved) {
      return JSON.parse(saved) as CartItem[];
    }
  } catch {
    // Ignore malformed local storage and fall back to the mirrored cookie.
  }

  try {
    const cookieValue = readCookieValue(SHOP_SESSION_COOKIE);

    if (!cookieValue) {
      return [];
    }

    const decoded = decodeBase64Utf8(decodeURIComponent(cookieValue));
    const session = JSON.parse(decoded) as { items?: CartItem[] };
    return Array.isArray(session.items) ? session.items : [];
  } catch {
    return [];
  }
}

function writeShopSessionCookie(items: CartItem[], totalPrice: number) {
  if (typeof document === "undefined") {
    return;
  }

  const payload = {
    items,
    totalPrice,
    isPremium: false,
  };

  const encodedValue = encodeURIComponent(encodeBase64Utf8(JSON.stringify(payload)));
  const secureFlag =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${SHOP_SESSION_COOKIE}=${encodedValue}; Path=/; SameSite=Lax${secureFlag}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readInitialItems());
  const [isCartOpen, setIsCartOpen] = useState(false);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    }

    writeShopSessionCookie(items, totalPrice);
  }, [items, totalPrice]);

  const addItem = useCallback((product: Product, size: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && i.size === size);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.size === size
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, size, quantity: 1 }];
    });
    setIsCartOpen(true);
  }, []);

  const removeItem = useCallback((productId: string, size: number) => {
    setItems((prev) => prev.filter((i) => !(i.product.id === productId && i.size === size)));
  }, []);

  const updateQuantity = useCallback((productId: string, size: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, size);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId && i.size === size ? { ...i, quantity } : i
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => setItems([]), []);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isCartOpen, setIsCartOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
