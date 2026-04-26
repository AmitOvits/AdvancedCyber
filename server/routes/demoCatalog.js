import express from "express";
import { getDb } from "../demoDb.js";
import { attachPerfGridHintHeaders, URC_PERF_GRID_PATH } from "../labHints.js";

let latestUrcAlert = null;
let urcAlertSeq = 0;

function parsePositiveIntUnbounded(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }

  const n = Number.parseInt(String(raw), 10);

  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }

  return n;
}

export function createDemoCatalogRouter({ requireJwt, publicAccess = false }) {
  const router = express.Router();
  const db = getDb();

  const sendProducts = (_req, res) => {
    attachPerfGridHintHeaders(res);
    return res.json({ products: db.products });
  };

  const sendOrders = (req, res) => {
    attachPerfGridHintHeaders(res);

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

    // INTENTIONAL VULNERABILITY — Unrestricted Resource Consumption (OWASP API4 / API Top 10 2023)
    // No rate limiting, no caps on query params, no timeout. Authenticated users only (harder to stumble on).
    // Abuse: raise `size` and `rounds` for CPU; add `include=matrix` for O(size²) memory + huge JSON payloads.
    const sendRecommendationGrid = (req, res) => {
      const size = parsePositiveIntUnbounded(req.query.size, 16);
      const rounds = parsePositiveIntUnbounded(req.query.rounds, 1);
      const products = db.products;
      const includeMatrix = String(req.query.include ?? "") === "matrix";
      const workFactor = size * size * rounds * products.length;
      const urcDetected = workFactor >= 250000 || (includeMatrix && size >= 250);

      let heat = 0;

      for (let r = 0; r < rounds; r += 1) {
        for (let i = 0; i < size; i += 1) {
          for (let j = 0; j < size; j += 1) {
            for (let k = 0; k < products.length; k += 1) {
              const a = products[k].price;
              const b = products[(k + i + j + r) % products.length].price;
              heat = (heat + (Math.imul(a | 0, b | 0) ^ (i + j + r + k))) | 0;
            }
          }
        }
      }

      const payload = {
        recommendationGridVersion: "0.9.2-internal",
        size,
        rounds,
        productCount: products.length,
        heat,
        vulnerability: urcDetected ? "URC_DETECTED" : null,
        workFactor,
        message: urcDetected
          ? "Unrestricted Resource Consumption vulnerability found: expensive unbounded parameters accepted."
          : "Probe completed.",
      };

      if (urcDetected) {
        res.set("x-training-vulnerability", "URC_DETECTED");
        urcAlertSeq += 1;
        latestUrcAlert = {
          id: urcAlertSeq,
          vulnerability: "URC_DETECTED",
          path: URC_PERF_GRID_PATH,
          size,
          rounds,
          workFactor,
          message: payload.message,
        };
      }

      if (urcDetected && (req.accepts("html") || String(req.query.popup ?? "") === "1")) {
        const safeJson = JSON.stringify(payload, null, 2).replace(/</g, "\\u003c");
        const msgJs = JSON.stringify(payload.message);
        return res
          .status(200)
          .type("html")
          .send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>URC Training Alert</title></head>
  <body style="font-family:system-ui,sans-serif;padding:16px;max-width:720px">
    <div style="background:#fee;border:1px solid #c00;padding:12px;margin-bottom:12px;border-radius:8px">
      <strong>Unrestricted Resource Consumption detected.</strong>
      If no popup appears, this viewer may block JavaScript (common in security tools). Use the button below or open this URL in a normal browser tab.
    </div>
    <p>
      <button type="button" id="labAlertBtn" style="padding:10px 16px;font-size:14px;cursor:pointer;border-radius:8px">
        Show lab alert
      </button>
    </p>
    <pre style="background:#f4f4f4;padding:12px;border-radius:8px;overflow:auto">${safeJson}</pre>
    <script>
      (function () {
        var text = ${msgJs};
        function fire() {
          window.alert("🚨 Unrestricted Resource Consumption vulnerability found!\\n\\n" + text);
        }
        document.getElementById("labAlertBtn").addEventListener("click", fire);
        window.addEventListener("load", function () {
          setTimeout(fire, 0);
        });
      })();
    </script>
  </body>
</html>`);
      }

      if (!includeMatrix) {
        return res.json(payload);
      }

      const matrix = [];

      for (let i = 0; i < size; i += 1) {
        const row = [];

        for (let j = 0; j < size; j += 1) {
          row.push(((heat + i * j) & 0x7fffffff) >>> 0);
        }

        matrix.push(row);
      }

      return res.json({ ...payload, matrix });
    };

    router.get("/catalog/recommendation-grid", requireJwt, sendRecommendationGrid);
    router.get("/diagnostics/perf-grid", requireJwt, sendRecommendationGrid);
  }

  return router;
}

export function getLatestUrcAlert() {
  return latestUrcAlert;
}
