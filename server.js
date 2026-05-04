/**
 * Production-style static host for the Vite SPA + intentionally exposed FTP-style
 * directory listing and vulnerable file read (educational / CTF lab only).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import serveIndex from "serve-index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const FTP_ROOT = path.join(__dirname, "public", "ftp");
const DIST_ROOT = path.join(__dirname, "dist");

if (!fs.existsSync(path.join(DIST_ROOT, "index.html"))) {
  console.error("[ctf-static] No dist/index.html — run `npm run build` first.");
  process.exit(1);
}

/**
 * Simulated poison null byte: truncate at first literal `%00` or `%2500` (case-sensitive).
 * Deliberately does not strip `../` — path traversal is intentional for the lab.
 */
function truncateAtPoisonNullByte(encodedPathSegment) {
  let s = encodedPathSegment;
  const cutPoints = [];
  const i00 = s.indexOf("%00");
  const i2500 = s.indexOf("%2500");
  if (i00 !== -1) cutPoints.push(i00);
  if (i2500 !== -1) cutPoints.push(i2500);
  if (cutPoints.length === 0) return s;
  return s.slice(0, Math.min(...cutPoints));
}

function readFtpFileWithTraversal(encodedRelativePath, res) {
  const truncated = truncateAtPoisonNullByte(encodedRelativePath);
  let decoded;
  try {
    decoded = decodeURIComponent(truncated);
  } catch {
    return res.status(400).type("text/plain").send("Bad percent-encoding");
  }

  const firstNull = decoded.indexOf("\0");
  if (firstNull !== -1) {
    decoded = decoded.slice(0, firstNull);
  }

  const absolutePath = path.join(FTP_ROOT, decoded);

  try {
    const buf = fs.readFileSync(absolutePath);
    res.send(buf);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return res.status(404).type("text/plain").send("Not found");
    }
    throw err;
  }
}

const app = express();
app.disable("x-powered-by");

// --- /ftp/* — intentional path traversal + poison-null handling (no sanitization of ../) ---
// Express 4: use regex route because `app.get('/ftp/*')` is not reliably supported.
app.get(/^\/ftp\/(.+)$/, (req, res) => {
  const encodedRelative = req.params[0];
  readFtpFileWithTraversal(encodedRelative, res);
});

// --- Directory listing only (no express.static on /ftp — files served by handler above) ---
app.use("/ftp", serveIndex(FTP_ROOT, { icons: true }));

// --- Compiled React app (Vite `dist`) ---
app.use(express.static(DIST_ROOT));

// --- SPA fallback: any remaining GET returns index.html ---
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST_ROOT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`[ctf-static] http://localhost:${PORT}`);
  console.log(`[ctf-static] SPA: /   | Directory listing: /ftp/ | Vulnerable LFI: /ftp/<path>`);
});
