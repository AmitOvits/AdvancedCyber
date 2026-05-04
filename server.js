/**
 * Production-style static host for the Vite SPA + intentionally exposed FTP-style
 * directory listing (educational / CTF lab only — do not deploy publicly).
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

const app = express();
app.disable("x-powered-by");

// --- Intentional misconfiguration: directory listing on a physical folder ---
app.use("/ftp", express.static(FTP_ROOT, { index: false }));
app.use("/ftp", serveIndex(FTP_ROOT, { icons: true }));

// --- Compiled React app (Vite `dist`) ---
app.use(express.static(DIST_ROOT));

// --- SPA fallback: any remaining GET returns index.html ---
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST_ROOT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`[ctf-static] http://localhost:${PORT}`);
  console.log(`[ctf-static] SPA: /   | Vulnerable dir listing: /ftp/`);
});
