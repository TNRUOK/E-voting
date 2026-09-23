/**
 * registrar.js — Independent Registrar Process
 *
 * Launch with REGISTRAR_ID=1|2|3 environment variable.
 * Each process reads ONLY its own key share from shares/share-{id}.json.
 *
 * WHY INDEPENDENT PROCESSES:
 *   Each registrar is a separate Node.js process with its own memory space.
 *   There is no shared variable, no function-calling-another-function shortcut.
 *   This visibly demonstrates that registrar 1, 2, 3 are separate parties:
 *   their communication goes through HTTP (simulating a real network boundary).
 *
 * WHAT EACH REGISTRAR KNOWS:
 *   - Its own Shamir share d_i (SECRET, loaded from disk once at startup)
 *   - The RSA public key (N, e) — public
 *   - The blinded messages it receives via POST /sign
 *   - A request counter (how many signing requests handled)
 *
 * WHAT EACH REGISTRAR DOES NOT KNOW:
 *   - The plaintext credential (only sees the blinded hash)
 *   - Which credential is "real" vs "decoy" (these look identical when blinded)
 *   - The other registrars' shares
 *   - The voter's identity (no identity info is sent to registrars)
 *
 * ENDPOINTS:
 *   GET  /status  → health check + request counter
 *   POST /sign    → body: { blindedMessage: hex }
 *                   response: { partialSig: hex, signerIndex: number }
 */

"use strict";

const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");

const { partialSign }        = require("./crypto/threshold-combine");
const { hexToBigInt, bigIntToHex } = require("./crypto/rsa-blind");
const { deserialiseShare }   = require("./crypto/shamir");

// ── Load registrar identity ───────────────────────────────────────────────────
const REGISTRAR_ID = parseInt(process.env.REGISTRAR_ID, 10);
if (![1, 2, 3].includes(REGISTRAR_ID)) {
  console.error("ERROR: REGISTRAR_ID must be 1, 2, or 3");
  console.error("Usage: REGISTRAR_ID=1 node registrar.js");
  process.exit(1);
}

const PORT      = 3000 + REGISTRAR_ID; // Reg1 → 3001, Reg2 → 3002, Reg3 → 3003
const SHARE_FILE = path.join(__dirname, "shares", `share-${REGISTRAR_ID}.json`);

if (!fs.existsSync(SHARE_FILE)) {
  console.error(`ERROR: ${SHARE_FILE} not found.`);
  console.error("Run 'npm run keygen' first to generate key shares.");
  process.exit(1);
}

const shareData = JSON.parse(fs.readFileSync(SHARE_FILE, "utf8"));

// Deserialise key material — these are the only secrets this process holds
const myShare = deserialiseShare(shareData.share); // { index: number, value: BigInt }
const N       = hexToBigInt(shareData.N);
const e       = hexToBigInt(shareData.e);

// Sanity check
if (myShare.index !== REGISTRAR_ID) {
  console.error("Share index mismatch — wrong share file for this registrar ID");
  process.exit(1);
}

// ── In-memory state ───────────────────────────────────────────────────────────
let requestsHandled = 0;

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cors());

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /status
 * Returns registrar health + request counter.
 * The counter proves load is distributed without revealing any credential info.
 */
app.get("/status", (req, res) => {
  res.json({
    id:              REGISTRAR_ID,
    online:          true,
    requestsHandled,
    port:            PORT,
    publicN:         shareData.N.slice(0, 18) + "...",  // abbreviated for display
    publicE:         shareData.e,
  });
});

/**
 * POST /sign
 * The core signing endpoint. Receives a blinded credential hash and returns
 * a partial signature using this registrar's Shamir share d_i.
 *
 * Input:  { blindedMessage: "0x..." }
 * Output: { partialSig: "0x...", signerIndex: number }
 *
 * WHAT WE LOG (deliberately minimal to prevent leakage):
 *   - Request received (timestamp, not the message content)
 *   - Signing complete
 * We do NOT log the blindedMessage or partialSig in plaintext, because even
 * though these are blinded, logging creates an audit trail that could be
 * correlated by a compromised registrar operator.
 */
const REGISTRAR_API_KEY = process.env.REGISTRAR_API_KEY || "dev_registrar_secret_key_123";

app.post("/sign", (req, res) => {
  const clientKey = req.headers["x-registrar-key"];
  if (clientKey !== REGISTRAR_API_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing x-registrar-key header" });
  }

  const { blindedMessage } = req.body;

  if (!blindedMessage) {
    return res.status(400).json({ error: "Missing blindedMessage" });
  }

  let blindedInt;
  try {
    blindedInt = hexToBigInt(blindedMessage);
  } catch {
    return res.status(400).json({ error: "Invalid hex in blindedMessage" });
  }

  // Validate: blinded message must be in Z_N* (non-zero, less than N)
  if (blindedInt <= 0n || blindedInt >= N) {
    return res.status(400).json({ error: "blindedMessage out of range [1, N-1]" });
  }

  // Compute partial signature: s_i = blindedMsg^(d_i) mod N
  // The share value d_i is also returned so the combiner can reconstruct d
  // via Shamir Lagrange interpolation (see threshold-combine.js).
  const partialSig = partialSign(blindedInt, myShare.value, myShare.index, N);

  requestsHandled++;

  // Minimal log — timestamp + counter only, NOT the message or signature value
  const now = new Date().toISOString();
  console.log(`[${now}] Registrar ${REGISTRAR_ID}: signed request #${requestsHandled}`);

  res.json({
    partialSig:  bigIntToHex(partialSig),
    shareValue:  bigIntToHex(myShare.value),   // d_i — for Shamir combination
    signerIndex: REGISTRAR_ID,
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Registrar ${REGISTRAR_ID} — Online on port ${PORT}           ║`);
  console.log(`║  Holding share index: ${REGISTRAR_ID}                       ║`);
  console.log(`║  (Does NOT hold the full private key d)          ║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);
});
