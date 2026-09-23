"use strict";
/**
 * routes/auth.js
 *
 * POST /api/auth/signup  — register a new voter account
 * POST /api/auth/login   — authenticate and receive a JWT
 * GET  /api/auth/me      — return current user info (requires auth)
 */

const router   = require("express").Router();
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const fs       = require("fs");
const path     = require("path");
const rateLimit = require("express-rate-limit");

const { requireAuth } = require("../middleware/auth");

const SECRET     = process.env.JWT_SECRET || "evoting_super_secret_change_me_in_prod";
const USERS_FILE = path.join(__dirname, "../data/users.json");
const SALT_ROUNDS = 10;
const TOKEN_TTL  = "12h";

// ── Rate limiter: max 10 login attempts per 15 minutes per IP ──────────────────
const loginLimiter = rateLimit({
  windowMs : 15 * 60 * 1000, // 15 minutes
  max      : 10,
  message  : { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders  : false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function makeToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL });
}

// ── Bootstrap admin account on first load ─────────────────────────────────────
(function bootstrapAdmin() {
  const adminUser = process.env.BOOTSTRAP_ADMIN_USERNAME || "admin";
  const adminPass = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123";
  const users = readUsers();

  if (!users[adminUser.toLowerCase()]) {
    const passwordHash = bcrypt.hashSync(adminPass, SALT_ROUNDS);
    users[adminUser.toLowerCase()] = {
      username    : adminUser,
      passwordHash,
      role        : "admin",
      createdAt   : new Date().toISOString(),
    };
    writeUsers(users);
    console.log(`[auth] Bootstrapped admin account: "${adminUser}"`);
  }
})();

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== "string" || username.trim().length < 3)
      return res.status(400).json({ error: "Username must be at least 3 characters." });
    if (!password || typeof password !== "string" || password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const key   = username.trim().toLowerCase();
    const users = readUsers();

    if (users[key])
      return res.status(409).json({ error: "Username already taken. Try logging in." });

    // Only the bootstrap admin account can be admin; new signups are always 'voter'
    const role = "voter";

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    users[key] = {
      username : username.trim(),
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    writeUsers(users);

    const token = makeToken({ username: users[key].username, role });
    return res.status(201).json({ token, username: users[key].username, role });
  } catch (err) {
    console.error("[auth/signup]", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Username and password are required." });

    const key   = username.trim().toLowerCase();
    const users = readUsers();
    const user  = users[key];

    if (!user)
      return res.status(401).json({ error: "No account found. Please sign up first." });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(401).json({ error: "Incorrect password. Please try again." });

    const token = makeToken({ username: user.username, role: user.role });
    return res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error("[auth/login]", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

const { getDeployed } = require("../shared");

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  const users = readUsers();
  const user  = users[req.user.username.toLowerCase()];
  if (!user) return res.status(404).json({ error: "User not found." });

  const dep = getDeployed();
  const isEnrolledForElection = !!user.enrolled && (!user.enrolledElectionId || user.enrolledElectionId === dep.electionId);
  const isRegisteredForElection = !!user.hasRegistered && user.registeredElectionId === dep.electionId;

  res.json({
    username:      user.username,
    role:          user.role,
    enrolled:      isEnrolledForElection,
    enrolledAt:    user.enrolledAt || null,
    hasRegistered: isRegisteredForElection,
    registeredAt:  user.registeredAt || null,
    credential:    isRegisteredForElection ? (user.credential || null) : null,
  });
});

module.exports = router;
