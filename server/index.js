import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import serveIndex from "serve-index";
import { getJwtSecret } from "./config/auth.js";
import { assertTrainingModeSafeToRun, isTrainingModeEnabled } from "./config/trainingMode.js";
import { createApiErrorHandler, apiNotFound } from "./middleware/errorHandler.js";
import { createRequireJwt } from "./middleware/requireJwt.js";
import { createAiExpertRouter } from "./routes/aiExpert.js";
import { createCheckoutRouter } from "./routes/checkout.js";
import { createDemoAuthRouter } from "./routes/demoAuth.js";
import {
  createDemoCatalogRouter,
  createFtpNameQueryHandler,
  getLatestPathTraversalAlert,
  getLatestUrcAlert,
} from "./routes/demoCatalog.js";
import { createFtpJsonIndexMiddleware, createFtpSlashRedirect } from "./routes/ftpIndex.js";
import { attachPerfGridHintHeaders } from "./labHints.js";
import { createReviewsRouter } from "./routes/reviews.js"; // המאובטח
import { createReviewsV1Router } from "./routes/reviews_v1.js"; // הפרוץ

assertTrainingModeSafeToRun();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FTP_STATIC_ROOT = path.join(__dirname, "static", "ftp");

const app = express();
app.disable("x-powered-by");

app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ["x-training-vulnerability"],
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" })); //vulnareable to dos attack

const trainingMode = isTrainingModeEnabled();
const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const jwtSecret = getJwtSecret();
const requireJwt = createRequireJwt(jwtSecret);

// /ftp — Juice Shop–style directory listing (serve-index) + path traversal ?name= on labVault
app.use("/ftp", createFtpJsonIndexMiddleware());
app.use("/ftp", createFtpSlashRedirect());
app.use("/ftp", createFtpNameQueryHandler());
app.get("/ftp/.env", (_req, res) => {
  res.set("x-training-vulnerability", "PATH_TRAVERSAL_CONFIRMED");
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Traversal Success</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Inter, Arial, sans-serif;
        background: #09090b;
        color: #fafafa;
      }
      html {
        background: #09090b;
        color-scheme: dark;
      }
      .card {
        width: min(640px, calc(100vw - 2rem));
        border: 1px solid #3f3f46;
        border-radius: 16px;
        background: #18181b;
        padding: 1.25rem 1.25rem 1rem;
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
      }
      p {
        margin: 0.5rem 0;
        color: #d4d4d8;
        line-height: 1.5;
      }
      .btn {
        margin-top: 1rem;
        display: inline-block;
        padding: 0.7rem 1rem;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 600;
        background: #2563eb;
        color: #ffffff;
      }
      code {
        background: #27272a;
        padding: 0.1rem 0.35rem;
        border-radius: 0.35rem;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Path Traversal Success</h1>
      <p>You reached <code>/ftp/.env</code> and exposed hidden sensitive configuration data.</p>
      <p>The lab finding has been recorded in your progress list.</p>
      <a class="btn" href="http://localhost:8080/">Return to shop</a>
    </main>
    <script>
      (function () {
        try {
          var STORAGE_KEY = "advancedcyber-lab-found-vulnerabilities";
          var FINDING_ID = "PATH_TRAVERSAL_CONFIRMED";
          var raw = window.localStorage.getItem(STORAGE_KEY);
          var parsed = raw ? JSON.parse(raw) : [];
          var ids = Array.isArray(parsed) ? parsed.filter(function (x) { return typeof x === "string"; }) : [];
          if (ids.indexOf(FINDING_ID) === -1) {
            ids.push(FINDING_ID);
            ids.sort();
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
            window.dispatchEvent(new CustomEvent("advancedcyber-lab-vulnerability-found", { detail: { id: FINDING_ID } }));
          }
        } catch (e) {
          // ignore storage failures
        }
        window.addEventListener("load", function () {
          window.alert("Victory! Path traversal confirmed and added to Lab Progress.");
        });
      })();
    </script>
  </body>
</html>`);
});
app.use("/ftp", express.static(FTP_STATIC_ROOT, { index: false }));
app.use("/ftp", serveIndex(FTP_STATIC_ROOT, { icons: true }));

app.use("/api", createAiExpertRouter());
app.use("/api", createCheckoutRouter());
// 1. הגרסה המודרנית (v2) - הגנה רשתית קשיחה
// server/index.js

// במקום /api/v1, אנחנו מצמידים את זה ישירות לכתובת המלאה שהסורק מחפש
app.use("/api/v1/reviews", express.json({ limit: "10mb" }), createReviewsV1Router());
app.use("/api/v2/reviews", express.json({ limit: "1kb" }), createReviewsRouter());
app.use("/api/v2", createDemoAuthRouter(jwtSecret));
app.use("/api/v2", createDemoCatalogRouter({ requireJwt }));
app.get("/api/lab/alerts/latest", (_req, res) => {
  attachPerfGridHintHeaders(res);
  return res.json({
    alert: getLatestUrcAlert(),
    pathTraversalAlert: getLatestPathTraversalAlert(),
  });
});

if (trainingMode) {
  app.use("/api/v1", createDemoCatalogRouter({ requireJwt, publicAccess: true }));
}

app.use("/api", apiNotFound);
app.use(createApiErrorHandler(trainingMode));

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (trainingMode=${trainingMode})`);
});
