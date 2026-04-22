import express from "express";
import { getDb } from "../demoDb.js";

export function createDemoCatalogRouter({ requireJwt, publicAccess = false }) {
  const router = express.Router();
  const db = getDb();

  const sendProducts = (_req, res) => res.json({ products: db.products });
  const sendOrders = (req, res) => {
    if (publicAccess) {
      return res.json({ orders: db.orders });
    }

    const email = req.user?.sub;
    const orders = db.orders.filter((order) => order.userEmail === email);
    return res.json({ orders });
  };

  if (publicAccess) {
    router.get("/products", sendProducts);
    router.get("/orders", sendOrders);
  } else {
    router.get("/products", requireJwt, sendProducts);
    router.get("/orders", requireJwt, sendOrders);
  }

  return router;
}
