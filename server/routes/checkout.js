import express from "express";
import { getSupabaseAdminClient } from "../config/supabaseAdmin.js";

const SHOP_SESSION_COOKIE = "shop_session";

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function readBearerToken(req) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw createHttpError(401, "Invalid authorization header.");
  }

  return token;
}

function decodeShopSession(rawCookieValue) {
  if (!rawCookieValue) {
    throw createHttpError(400, "Your cart session is missing. Please refresh and try again.");
  }

  try {
    const decodedJson = Buffer.from(rawCookieValue, "base64").toString("utf8");
    const session = JSON.parse(decodedJson);

    if (!session || typeof session !== "object" || !Array.isArray(session.items)) {
      throw new Error("Invalid cart session payload");
    }

    return session;
  } catch {
    throw createHttpError(400, "Your cart session is invalid. Please refresh and try again.");
  }
}

function normalizeCheckoutPayload(body) {
  const shipping = body?.shipping;
  const payment = body?.payment;

  if (!shipping || typeof shipping !== "object") {
    throw createHttpError(400, "Shipping details are required.");
  }

  if (!payment || typeof payment !== "object") {
    throw createHttpError(400, "Payment details are required.");
  }

  const normalizedShipping = {
    fullName: String(shipping.fullName ?? "").trim(),
    address: String(shipping.address ?? "").trim(),
    city: String(shipping.city ?? "").trim(),
    state: String(shipping.state ?? "").trim(),
    zip: String(shipping.zip ?? "").trim(),
    country: String(shipping.country ?? "").trim(),
  };

  if (!normalizedShipping.fullName || !normalizedShipping.address || !normalizedShipping.city || !normalizedShipping.zip) {
    throw createHttpError(400, "Please fill in all required shipping fields.");
  }

  const normalizedPayment = {
    cardNumber: String(payment.cardNumber ?? "").trim(),
    expiry: String(payment.expiry ?? "").trim(),
    cvv: String(payment.cvv ?? "").trim(),
    nameOnCard: String(payment.nameOnCard ?? "").trim(),
  };

  if (!normalizedPayment.cardNumber || !normalizedPayment.expiry || !normalizedPayment.cvv) {
    throw createHttpError(400, "Please fill in all required payment fields.");
  }

  return { shipping: normalizedShipping };
}

function normalizeCartItems(items) {
  return items.map((item, index) => {
    const productId = typeof item?.product?.id === "string" ? item.product.id.trim() : "";
    const size = Number(item?.size);
    const quantity = Number(item?.quantity);

    if (!productId) {
      throw createHttpError(400, `Cart item ${index + 1} is missing a product id.`);
    }

    if (!Number.isFinite(size)) {
      throw createHttpError(400, `Cart item ${index + 1} has an invalid size.`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw createHttpError(400, `Cart item ${index + 1} has an invalid quantity.`);
    }

    return {
      productId,
      size,
      quantity,
    };
  });
}

async function resolveAuthenticatedUserId(req, supabase) {
  const accessToken = readBearerToken(req);

  if (!accessToken) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw createHttpError(401, "Your session is invalid. Please sign in again.");
  }

  return user?.id ?? null;
}

export function createCheckoutRouter() {
  const router = express.Router();

  router.post("/checkout", async (req, res, next) => {
    try {
      const { shipping } = normalizeCheckoutPayload(req.body ?? {});
      const session = decodeShopSession(req.cookies?.[SHOP_SESSION_COOKIE]);
      const cartItems = normalizeCartItems(session.items);

      if (cartItems.length === 0) {
        throw createHttpError(400, "Your cart is empty.");
      }

      const cookieTotal = Number(session.totalPrice);
      if (!Number.isFinite(cookieTotal) || cookieTotal < 0) {
        throw createHttpError(400, "Your cart total is invalid.");
      }

      const supabase = getSupabaseAdminClient();
      const userId = await resolveAuthenticatedUserId(req, supabase);
      const productIds = [...new Set(cartItems.map((item) => item.productId))];
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price")
        .in("id", productIds);

      if (productsError) {
        throw productsError;
      }

      const productsById = new Map((products ?? []).map((product) => [product.id, product]));
      const orderItems = cartItems.map((item) => {
        const product = productsById.get(item.productId);

        if (!product) {
          throw createHttpError(400, `Product ${item.productId} is no longer available.`);
        }

        const price = Number(product.price);
        if (!Number.isFinite(price) || price < 0) {
          throw createHttpError(500, `Product ${item.productId} has an invalid price.`);
        }

        return {
          product_id: product.id,
          product_name: product.name,
          size: item.size,
          quantity: item.quantity,
          price,
        };
      });

      let serverTotal = roundCurrency(
        orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      );

      let isHacked = false;
      // --- INSECURE DESERIALIZATION & HIDDEN BACKDOOR (HARD MODE) ---
      // שימו לב: שינוי של isPremium ל-true לא יעשה כלום (מלכודת!)
      // כדי לפרוץ, התוקף חייב להזריק אובייקט שלם לתוך ה-JSON המפוענח:
      // "__internal_config": { "admin_override": "true" }

      if (
        session.__internal_config && 
        typeof session.__internal_config === "object" && 
        session.__internal_config.admin_override === "true"
      ) {
        serverTotal = 0; // העגלה חינמית!
        isHacked = true;
      }
      // -------------------------------------------------------------- //

      if (!isHacked && roundCurrency(cookieTotal) !== serverTotal) {
        throw createHttpError(400, "Cart pricing changed. Please refresh and try again.");
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          total: serverTotal,
          status: "pending",
          shipping_address: shipping,
        })
        .select("id")
        .single();

      if (orderError) {
        throw orderError;
      }

      const { error: orderItemsError } = await supabase.from("order_items").insert(
        orderItems.map((item) => ({
          order_id: order.id,
          ...item,
        })),
      );

      if (orderItemsError) {
        throw orderItemsError;
      }

      return res.status(201).json({
        success: true,
        orderId: order.id,
        total: serverTotal,
        isHacked: isHacked // מחזירים ל-React את ההוכחה שהפריצה הצליחה
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
