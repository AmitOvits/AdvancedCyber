import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../demoDb.js";
import {
  attachPerfGridHintHeaders,
  PATH_TRAVERSAL_LAB_PATH,
  URC_PERF_GRID_PATH,
} from "../labHints.js";

/** Base directory for the path-traversal lab (vulnerable-by-design). Must match server/labVault on disk. */
const LAB_VAULT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "labVault");

let latestUrcAlert = null;
let urcAlertSeq = 0;

let latestPathTraversalAlert = null;
let pathTraversalAlertSeq = 0;

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

  /** Public lab map: names that exist under server/labVault (no JWT - helps students avoid guessing). */
  const sendLabFileList = (_req, res) => {
    attachPerfGridHintHeaders(res);
    return res.json(["catalog-note.txt", "internal/LAB_FLAG.txt"]);
  };

  router.get("/catalog/files", sendLabFileList);

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

    /*
     * --------------------------------------------------------------------------
     * INTENTIONAL VULNERABILITY (Vulnerable by Design - educational only)
     * OWASP Top 10 2021 A01:2021 Broken Access Control - Path Traversal
     *
     * The handler below reads files using path.join(LAB_VAULT_DIR, userSuppliedName).
     * There is NO sanitization, NO allowlist, and NO verification that the resulting
     * path remains inside LAB_VAULT_DIR before fs.readFile. Students can pass ".." path
     * segments (e.g. ../../../package.json) to read arbitrary files readable by the process.
     *
     * path.relative below is used ONLY after the read to set x-training-vulnerability.
     * It does NOT enforce access control or block traversal.
     * --------------------------------------------------------------------------
     */
    const sendInventoryExport = async (req, res) => {
      attachPerfGridHintHeaders(res);

      const name =
        req.query.name !== undefined && req.query.name !== null && String(req.query.name) !== ""
          ? String(req.query.name)
          : "catalog-note.txt";

      // FLAW: Unsanitized user input concatenated into filesystem path (CWE-22).
      const filePath = path.join(LAB_VAULT_DIR, name);

      let data;
      try {
        data = await fs.readFile(filePath, "utf8");
      } catch (err) {
        if (err && err.code === "ENOENT") {
          return res.status(404).json({ error: "not_found", hint: PATH_TRAVERSAL_LAB_PATH });
        }
        throw err;
      }

      // Lab feedback only (does not block reads): whether joined path escapes the vault tree.
      // Uses path.relative between absolute paths produced by path.join only - no resolve/normalize step here.
      const relToVault = path.relative(LAB_VAULT_DIR, filePath);
      const isInsideVault =
        relToVault === "" ||
        (!relToVault.startsWith("..") && !path.isAbsolute(relToVault));

      if (!isInsideVault) {
        // Lab safety: traversal was proven by readFile above, but do not echo secrets (.env, keys) in the body.
        const message =
          "Success: path escaped server/labVault (real vulnerability would return full file bytes). This lab withholds contents for safety.";
        const payload = {
          lab: "path-traversal",
          status: "PATH_TRAVERSAL_CONFIRMED",
          message,
          resolvedFileName: path.basename(filePath),
          bytesRead: Buffer.byteLength(data, "utf8"),
        };

        res.set("x-training-vulnerability", "PATH_TRAVERSAL_CONFIRMED");
        res.set("Access-Control-Expose-Headers", "x-training-vulnerability");

        pathTraversalAlertSeq += 1;
        latestPathTraversalAlert = {
          id: pathTraversalAlertSeq,
          vulnerability: "PATH_TRAVERSAL_CONFIRMED",
          path: PATH_TRAVERSAL_LAB_PATH,
          requestedName: name,
          resolvedFileName: path.basename(filePath),
          message,
        };

        if (String(req.query.format ?? "") === "json") {
          return res.status(200).json(payload);
        }

        if (req.accepts("html") || String(req.query.popup ?? "") === "1") {
          const safeJson = JSON.stringify(payload, null, 2).replace(/</g, "\\u003c");
          const msgJs = JSON.stringify(message);
          return res
            .status(200)
            .type("html")
            .send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Path Traversal Training Alert</title></head>
  <body style="font-family:system-ui,sans-serif;padding:16px;max-width:720px">
    <div style="background:#fee;border:1px solid #c00;padding:12px;margin-bottom:12px;border-radius:8px">
      <strong>Path traversal confirmed.</strong>
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
          window.alert("\uD83C\uDFC6 SUCCESS: Path Traversal Confirmed! You accessed a path outside the sandbox.\\n\\n" + text);
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

        return res.status(200).json(payload);
      }

      return res.status(200).type("text/plain; charset=utf-8").send(data);
    };

    router.get("/catalog/inventory-export", requireJwt, sendInventoryExport);
  }

  return router;
}

export function getLatestUrcAlert() {
  return latestUrcAlert;
}

export function getLatestPathTraversalAlert() {
  return latestPathTraversalAlert;
}
