import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getJwtSecret } from "./config/auth.js";
import { assertTrainingModeSafeToRun, isTrainingModeEnabled } from "./config/trainingMode.js";
import { createApiErrorHandler, apiNotFound } from "./middleware/errorHandler.js";
import { createRequireJwt } from "./middleware/requireJwt.js";
import { createAiExpertRouter } from "./routes/aiExpert.js";
import { createCheckoutRouter } from "./routes/checkout.js";
import { createDemoAuthRouter } from "./routes/demoAuth.js";
import { createDemoCatalogRouter, getLatestUrcAlert } from "./routes/demoCatalog.js";
import { attachPerfGridHintHeaders } from "./labHints.js";
import { createReviewsRouter } from "./routes/reviews.js"; // המאובטח
import { createReviewsV1Router } from "./routes/reviews_v1.js"; // הפרוץ

assertTrainingModeSafeToRun();

const app = express();
app.disable("x-powered-by");

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" })); //vulnareable to dos attack

const trainingMode = isTrainingModeEnabled();
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const jwtSecret = getJwtSecret();
const requireJwt = createRequireJwt(jwtSecret);

app.use("/api", createAiExpertRouter());
app.use("/api", createCheckoutRouter());
// 1. הגרסה המודרנית (v2) - הגנה רשתית קשיחה
// server/index.js

// במקום /api/v1, אנחנו מצמידים את זה ישירות לכתובת המלאה שהסורק מחפש
app.use("/api/v1/reviews", express.json({ limit: "10mb" }), createReviewsV1Router());
app.use("/api/v2/reviews", express.json({ limit: "1kb" }), createReviewsRouter());
app.use("/api/v2", createDemoCatalogRouter({ requireJwt }));
app.get("/api/lab/alerts/latest", (_req, res) => {
  attachPerfGridHintHeaders(res);
  return res.json({ alert: getLatestUrcAlert() });
});

if (trainingMode) {
  app.use("/api/v1", createDemoCatalogRouter({ requireJwt, publicAccess: true }));
}

app.use("/api", apiNotFound);
app.use(createApiErrorHandler(trainingMode));

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (trainingMode=${trainingMode})`);
});
