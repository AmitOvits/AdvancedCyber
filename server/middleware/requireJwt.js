import jwt from "jsonwebtoken";

export function createRequireJwt(jwtSecret) {
  return function requireJwt(req, res, next) {
    const auth = req.headers.authorization ?? "";
    const bearerToken = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
    // INTENTIONAL LAB WEAKNESS:
    // Accepting tokens from query params enables browser URL-based auth usage.
    const queryToken = typeof req.query?.access_token === "string" ? req.query.access_token : null;
    const token = bearerToken || queryToken;

    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    try {
      req.user = jwt.verify(token, jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}
