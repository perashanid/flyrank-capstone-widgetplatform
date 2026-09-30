const { verifyToken } = require("../utils/jwt");

// Requires a valid `Authorization: Bearer <token>` header.
// On success, attaches req.tenantId so every downstream query can scope by it —
// this is the single choke point that makes tenant isolation enforceable.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  try {
    const payload = verifyToken(token);
    req.tenantId = payload.tenantId;
    req.tenantEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
