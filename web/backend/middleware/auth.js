"use strict";
/**
 * middleware/auth.js
 *
 * Express middleware for JWT-based authentication and role-based access control.
 * - requireAuth  : any valid JWT
 * - requireAdmin : valid JWT where role === 'admin'
 */

const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "evoting_super_secret_change_me_in_prod";

/**
 * Parses and verifies the Bearer token from the Authorization header.
 * Attaches decoded payload to req.user on success.
 * Returns 401 JSON on failure.
 */
function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    const msg = err.name === "TokenExpiredError"
      ? "Session expired. Please log in again."
      : "Invalid token. Please log in.";
    return res.status(401).json({ error: msg });
  }
}

/**
 * Must be used AFTER requireAuth.
 * Rejects anyone whose role is not 'admin'.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
