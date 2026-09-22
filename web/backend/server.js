/**
 * server.js — Backend API
 *
 * Single Express server exposing all /api/* endpoints.
 * This is the ONLY process with blockchain + registrar network access.
 * The frontend (React/Vite) never talks to Hardhat or registrars directly.
 *
 * Architecture:
 *   Browser → Backend API (here) → Hardhat node / Registrar services
 *
 * Ports:
 *   Backend: 3000   (this server)
 *   Reg 1:   3001
 *   Reg 2:   3002
 *   Reg 3:   3003
 *   Hardhat: 8545
 *   Frontend:5173
 */

"use strict";

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Load routes ───────────────────────────────────────────────────────────────
app.use("/api/voters",     require("./routes/voters"));
app.use("/api/votes",      require("./routes/votes"));
app.use("/api/tally",      require("./routes/tally"));
app.use("/api/registrars", require("./routes/registrars"));
app.use("/api/merkle",     require("./routes/merkle"));
app.use("/api/candidates", require("./routes/candidates"));
app.use("/api/simulation", require("./routes/simulation"));
app.use("/api/admin",      require("./routes/admin"));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[backend error]", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════════╗`);
  console.log(`║  E-Voting Backend API — listening on :${PORT}     ║`);
  console.log(`╚════════════════════════════════════════════════╝\n`);
  console.log(`  GET  /api/health`);
  console.log(`  POST /api/voters/register`);
  console.log(`  POST /api/votes/cast`);
  console.log(`  GET  /api/tally`);
  console.log(`  GET  /api/registrars/status`);
  console.log(`  GET  /api/merkle/tree`);
  console.log(`  GET  /api/candidates`);
  console.log(`  GET  /api/simulation/run  (SSE)\n`);
});

module.exports = app;
