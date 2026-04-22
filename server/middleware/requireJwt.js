import jwt from "jsonwebtoken";

export function createRequireJwt(jwtSecret) {
  return function requireJwt(req, res, next) {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

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
