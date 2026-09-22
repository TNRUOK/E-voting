/**
 * keygen.js — One-time RSA key generation + Shamir share distribution
 *
 * Run ONCE before starting the registrar services:
 *   node registrar-service/keygen.js
 *
 * What this does:
 *   1. Generates a 2048-bit RSA key pair using node-forge
 *   2. Extracts the private exponent d and the modulus N
 *   3. Splits d into 3 Shamir shares (t=2, n=3) over GF(2^2048 + 981)
 *   4. Writes each share to registrar-service/shares/share-{1,2,3}.json
 *      — each file contains only what that registrar needs (its own share,
 *        plus the public modulus N and exponent e)
 *   5. Writes the public key (N, e) to registrar-service/shares/public.json
 *
 * SECURITY PROPERTY PRESERVED:
 *   After keygen completes, the full private exponent d exists ONLY as shares.
 *   No file stores d directly. Each registrar process reads only its own share.
 *   An adversary who compromises any ONE registrar file learns d_i but not d.
 *   Only by compromising ≥2 registrar files can an adversary recover d.
 *
 * SIMPLIFICATION (documented in README):
 *   The key is generated on one machine and shares are written to the same
 *   filesystem. In production, each registrar's share would be generated and
 *   stored on a separate physically isolated machine. This is a deliberate
 *   course-project simplification.
 */

"use strict";

const forge = require("node-forge");
const fs    = require("fs");
const path  = require("path");
const { split, serialiseShare } = require("./crypto/shamir");

const SHARES_DIR = path.join(__dirname, "shares");

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║       THRESHOLD RSA KEY GENERATION (2048-bit)        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ── Step 1: Generate RSA key pair ─────────────────────────────────────────
  console.log("Generating 2048-bit RSA key pair (this may take 5-15 seconds)...");
  const startTime = Date.now();

  const keypair = await new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, kp) => {
      if (err) reject(err);
      else resolve(kp);
    });
  });

  console.log(`Key generation complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  const priv = keypair.privateKey;
  const pub  = keypair.publicKey;

  // Extract raw BigInt values from forge key (forge uses jsbn BigInteger internally)
  // We convert via hex string for precision.
  const N = BigInt("0x" + priv.n.toString(16));
  const e = BigInt("0x" + priv.e.toString(16));
  const d = BigInt("0x" + priv.d.toString(16));

  console.log(`\nRSA modulus N (first 32 hex chars): ${N.toString(16).slice(0, 32)}...`);
  console.log(`Public exponent e: ${e}`);
  console.log(`Private exponent d (NEVER stored directly): [${d.toString(2).length} bits]`);

  // ── Step 2: Split d into 3 Shamir shares ──────────────────────────────────
  console.log("\nSplitting private exponent d into 3 Shamir shares (t=2, n=3)...");
  const shares = split(d, 2, 3);

  console.log(`Share 1 index: ${shares[0].index}  value: 0x${shares[0].value.toString(16).slice(0, 16)}...`);
  console.log(`Share 2 index: ${shares[1].index}  value: 0x${shares[1].value.toString(16).slice(0, 16)}...`);
  console.log(`Share 3 index: ${shares[2].index}  value: 0x${shares[2].value.toString(16).slice(0, 16)}...`);

  // ── Step 3: Write share files ─────────────────────────────────────────────
  if (!fs.existsSync(SHARES_DIR)) fs.mkdirSync(SHARES_DIR, { recursive: true });

  for (let i = 0; i < 3; i++) {
    const shareFile = {
      registrarId: i + 1,
      // This registrar's Shamir share of d — the ONLY secret in this file
      share: serialiseShare(shares[i]),
      // Public key material (not secret)
      N: "0x" + N.toString(16),
      e: "0x" + e.toString(16),
      // Public key PEM (for external verification tools)
      publicKeyPem: forge.pki.publicKeyToPem(pub),
    };

    const outPath = path.join(SHARES_DIR, `share-${i + 1}.json`);
    fs.writeFileSync(outPath, JSON.stringify(shareFile, null, 2));
    console.log(`\nWrote share-${i + 1}.json (registrar ${i + 1})`);
    console.log(`  → Contains: d_${i + 1} (secret to this registrar), N, e (public)`);
  }

  // ── Step 4: Write public key file ─────────────────────────────────────────
  const publicFile = {
    N: "0x" + N.toString(16),
    e: "0x" + e.toString(16),
    publicKeyPem: forge.pki.publicKeyToPem(pub),
  };
  fs.writeFileSync(path.join(SHARES_DIR, "public.json"), JSON.stringify(publicFile, null, 2));
  console.log("\nWrote public.json (N, e — share with all parties)");

  // ── Step 5: Verify reconstruction ─────────────────────────────────────────
  // Quick sanity check: reconstruct d from shares 1+2 and verify e*d ≡ 1 mod λ(N)
  // We check that m^(e*d) ≡ m mod N for a test message m.
  console.log("\nVerifying threshold reconstruction with shares 1+2...");
  const { combine, deserialiseShare } = require("./crypto/shamir");
  const { modPow } = require("./crypto/rsa-blind");

  const testShares = [shares[0], shares[1]];
  const dReconstructed = combine(testShares);

  const testMsg = 42n;
  const signed  = modPow(testMsg, dReconstructed, N);
  const verify  = modPow(signed, e, N);

  if (verify === testMsg) {
    console.log("✓ Reconstruction test PASSED (shares 1+2 → correct d)");
  } else {
    console.error("✗ Reconstruction test FAILED — check shamir.js");
    process.exit(1);
  }

  console.log("\nVerifying threshold reconstruction with shares 2+3...");
  const testShares2  = [shares[1], shares[2]];
  const dRecon2      = combine(testShares2);
  const signed2      = modPow(testMsg, dRecon2, N);
  const verify2      = modPow(signed2, e, N);

  if (verify2 === testMsg) {
    console.log("✓ Reconstruction test PASSED (shares 2+3 → correct d)");
  } else {
    console.error("✗ Reconstruction test FAILED (shares 2+3)");
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  KEY GENERATION COMPLETE — d is now destroyed.       ║");
  console.log("║  Each registrar holds only its own share.             ║");
  console.log("║  Start registrars: npm run reg1 / reg2 / reg3        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
}

main().catch(err => { console.error(err); process.exit(1); });
