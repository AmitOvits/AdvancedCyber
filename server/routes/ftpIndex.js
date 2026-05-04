import { JUICE_SHOP_FTP_FILES } from "../ftpManifest.js";
import { PATH_TRAVERSAL_LAB_PATH } from "../labHints.js";

/**
 * ?format=json on /ftp/ — machine-readable index (directory HTML is from serve-index).
 */
export function createFtpJsonIndexMiddleware() {
  return (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }
    const hasName = req.query.name != null && String(req.query.name).trim() !== "";
    if (hasName) {
      return next();
    }
    if (String(req.query.format ?? "").toLowerCase() !== "json") {
      return next();
    }
    if (req.path !== "/" && req.path !== "") {
      return next();
    }
    return res.json({
      message:
        "Lab file drop (no authentication). HTML directory listing: GET /ftp/ (see also /lab/ftp in the SPA).",
      files: JUICE_SHOP_FTP_FILES.map((name) => ({
        name,
        url: `${PATH_TRAVERSAL_LAB_PATH}/${encodeURIComponent(name)}`,
        nameQueryUrl: `${PATH_TRAVERSAL_LAB_PATH}?name=${encodeURIComponent(name)}`,
      })),
    });
  };
}

/** Normalize exactly `GET /ftp` → `/ftp/` so directory listing middleware runs reliably. */
export function createFtpSlashRedirect() {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (Object.keys(req.query).length > 0) {
      return next();
    }
    const base = req.originalUrl.split("?")[0];
    if (base !== PATH_TRAVERSAL_LAB_PATH) {
      return next();
    }
    return res.redirect(301, `${PATH_TRAVERSAL_LAB_PATH}/`);
  };
}
