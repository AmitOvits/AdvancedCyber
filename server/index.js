import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { assertTrainingModeSafeToRun, isTrainingModeEnabled } from "./trainingMode.js";
import { getDb } from "./demoDb.js";
import { getAiShoeExpertReply } from "../Chat/ai_expert.js";

assertTrainingModeSafeToRun();

const app = express();
app.disable("x-powered-by");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const trainingMode = isTrainingModeEnabled();
const port = Number.parseInt(process.env.PORT ?? "8081", 10);

const JWT_SECRET = process.env.JWT_SECRET ?? crypto.randomUUID();

function requireJwt(req, res, next) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function v2Router() {
  const router = express.Router();
  const db = getDb();

  router.post("/auth/login", (req, res) => {
    const { email, password } = req.body ?? {};
    const okEmail = email === (process.env.DEMO_LOGIN_EMAIL ?? "student@example.edu");
    const okPass = password === (process.env.DEMO_LOGIN_PASSWORD ?? "password123");
    if (!okEmail || !okPass) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sub: email, role: "student" }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ token });
  });

  router.get("/products", requireJwt, (_req, res) => res.json({ products: db.products }));
  router.get("/orders", requireJwt, (req, res) => {
    const email = req.user?.sub;
    const orders = db.orders.filter((o) => o.userEmail === email);
    return res.json({ orders });
  });

  return router;
}

function v1RouterBypassingAuth() {
  const router = express.Router();
  const db = getDb();

  router.get("/products", (_req, res) => res.json({ products: db.products }));
  router.get("/orders", (_req, res) => res.json({ orders: db.orders }));

  return router;
}

app.post("/api/ai-expert", async (req, res, next) => {
  if (!trainingMode) return res.status(404).json({ error: "Not found" });

  try {
    const { message } = req.body ?? {};
    const reply = await getAiShoeExpertReply(message);
    return res.json({ reply });
  } catch (err) {
    err.status = 502;
    return next(err);
  }
});

app.use("/api/v2", v2Router());

if (trainingMode) {
  app.use("/api/v1", v1RouterBypassingAuth());
}

app.use("/api", (_req, _res, next) => {
  const err = new Error("API route not found");
  err.status = 404;
  next(err);
});

// Global error handler
// Training mode intentionally leaks details for educational demonstration ONLY.
app.use((err, _req, res, _next) => {
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;

  if (trainingMode) {
    return res.status(status).json({
      error: err?.message ?? "Unknown error",
      stack: err?.stack,
      nodeVersion: process.version,
      internalHint: "See stack trace for internal file paths",
    });
  }

  return res.status(status).json({ error: status === 404 ? "Not found" : "Internal server error" });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port} (trainingMode=${trainingMode})`);
});
