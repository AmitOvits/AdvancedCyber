#!/usr/bin/env node
/**
 * Creates Juice Shop–style dummy files under server/static/ftp and mirrors them
 * into server/labVault so GET /ftp/<file> and GET /ftp?name=<file> stay consistent.
 *
 * Run from repo root: node scripts/create-ftp-lab-files.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const staticFtp = path.join(root, "server", "static", "ftp");
const labVault = path.join(root, "server", "labVault");

const files = {
  "acquisitions.md": `# Acquisitions (training dummy)

This document describes placeholder M&A activity for the Advanced Cyber lab only.
No real companies or transactions are represented.
`,
  "incident-support.kdbx": Buffer.from(
    "DUMMY-KEEPASS-BINARY-PLACEHOLDER-FOR-LAB-NOT-A-REAL-DATABASE",
    "utf8",
  ),
  "package.json.bak": `{
  "name": "juice-shop",
  "version": "9.0.0",
  "description": "Educational vulnerable app — backup artifact for CTF lab only.",
  "dependencies": {
    "express": "^4.21.0"
  }
}
`,
  "coupons_2013.md.bak": `# Archived coupons (2013) — lab dummy

- SHOE10 — expired training coupon code (do not use)
- INTERNAL-QA — placeholder only

This file mimics OWASP Juice Shop–style backup exposure for coursework.
`,
  "legal.md": `# Legal notices (lab placeholder)

This FTP mirror contains synthetic content for cybersecurity coursework only.
`,
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  await ensureDir(staticFtp);
  await ensureDir(labVault);

  for (const [name, content] of Object.entries(files)) {
    const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    await fs.writeFile(path.join(staticFtp, name), buf);
    await fs.writeFile(path.join(labVault, name), buf);
    console.log(`wrote ${name}`);
  }

  console.log(`\nDone. Static listing: ${staticFtp}`);
  console.log(`Lab vault mirror (path traversal): ${labVault}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
