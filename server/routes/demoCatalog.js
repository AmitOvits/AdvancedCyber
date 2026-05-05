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

/*
 * Public /ftp?name=... — path traversal lab (no JWT). Listing is served separately
 * via express.static + serve-index from server/static/ftp (Juice Shop–style files).
 */
async function sendFtpLabFileByName(req, res) {
  attachPerfGridHintHeaders(res);

  const rawName = req.query.name;
  const requestedName = String(rawName);
  // Training UX shortcut: allow the common payload `../.env` to hit the intended root `.env`.
  // This preserves traversal semantics while avoiding path-depth guessing.
  const name = requestedName === "../.env" ? "../../.env" : requestedName;

  // FLAW: Unsanitized user input concatenated into filesystem path (CWE-22).
  const filePath = path.join(LAB_VAULT_DIR, name);

  let buf;
  try {
    buf = await fs.readFile(filePath);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return res.status(404).json({ error: "not_found", hint: PATH_TRAVERSAL_LAB_PATH });
    }
    throw err;
  }

  const relToVault = path.relative(LAB_VAULT_DIR, filePath);
  const isInsideVault =
    relToVault === "" || (!relToVault.startsWith("..") && !path.isAbsolute(relToVault));

  if (!isInsideVault) {
    const message =
      "Success: path escaped server/labVault (real vulnerability would return full file bytes). This lab withholds contents for safety.";
    const payload = {
      lab: "path-traversal",
      status: "PATH_TRAVERSAL_CONFIRMED",
      message,
      resolvedFileName: path.basename(filePath),
      bytesRead: buf.length,
    };

    res.set("x-training-vulnerability", "PATH_TRAVERSAL_CONFIRMED");
    res.set("Access-Control-Expose-Headers", "x-training-vulnerability");

    pathTraversalAlertSeq += 1;
    latestPathTraversalAlert = {
      id: pathTraversalAlertSeq,
      vulnerability: "PATH_TRAVERSAL_CONFIRMED",
      path: PATH_TRAVERSAL_LAB_PATH,
      requestedName,
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

  const ext = path.extname(filePath).toLowerCase();
  const isPackageBackup = path.basename(filePath).toLowerCase() === "package.json.bak";
  const usedTraversalInInput = /(^|[\\/])\.\.([\\/]|$)/.test(requestedName);

  if (isPackageBackup && usedTraversalInInput) {
    const message =
      "FTP lab success: package.json.bak was reached through traversal input (../ style).";
    const payload = {
      lab: "ftp-exposed-file",
      status: "PATH_TRAVERSAL_CONFIRMED",
      message,
      resolvedFileName: path.basename(filePath),
      bytesRead: buf.length,
    };

    res.set("x-training-vulnerability", "PATH_TRAVERSAL_CONFIRMED");
    res.set("Access-Control-Expose-Headers", "x-training-vulnerability");

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
  <head><meta charset="utf-8"><title>FTP Training Alert</title></head>
  <body style="font-family:system-ui,sans-serif;padding:16px;max-width:720px">
    <div style="background:#fee;border:1px solid #c00;padding:12px;margin-bottom:12px;border-radius:8px">
      <strong>FTP exposed backup confirmed.</strong>
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
          window.alert("🏆 SUCCESS: FTP file exposure confirmed!\\n\\n" + text);
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

    return res.status(200).type("text/plain; charset=utf-8").send(buf.toString("utf8"));
  }

  if (ext === ".kdbx") {
    return res.status(200).type("application/octet-stream").send(buf);
  }

  return res.status(200).type("text/plain; charset=utf-8").send(buf.toString("utf8"));
}

/** Passes through when `name` is absent so directory listing (serve-index) can run. */
export function createFtpNameQueryHandler() {
  return async (req, res, next) => {
    const rawName = req.query.name;
    const hasQueryName = rawName !== undefined && rawName !== null && String(rawName).trim() !== "";
    const pathName = decodeURIComponent(String(req.path ?? "").replace(/^\/+/, ""));
    const hasTraversalSegmentsInPath = /(^|[\\/])\.\.([\\/]|$)/.test(pathName);
    const shouldTreatAsNameFromPath =
      pathName.toLowerCase() === "package.json.bak" || hasTraversalSegmentsInPath;
    const hasName = hasQueryName || shouldTreatAsNameFromPath;

    if (!hasName) {
      return next();
    }

    if (!hasQueryName && shouldTreatAsNameFromPath) {
      req.query.name = pathName;
      req.query.popup = req.query.popup ?? "1";
    }

    try {
      await sendFtpLabFileByName(req, res);
    } catch (err) {
      next(err);
    }
  };
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

export function getLatestPathTraversalAlert() {
  return latestPathTraversalAlert;
}
