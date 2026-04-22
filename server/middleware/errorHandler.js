export function apiNotFound(_req, _res, next) {
  const err = new Error("API route not found");
  err.status = 404;
  next(err);
}

export function createApiErrorHandler(trainingMode) {
  return function apiErrorHandler(err, _req, res, _next) {
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
  };
}
