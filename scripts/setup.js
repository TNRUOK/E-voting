/**
 * setup.js — Automated project setup and environment bootstrap
 *
 * Runs:
 * 1. Checks node & npm environment
 * 2. Compiles Solidity contracts via Hardhat
 * 3. Generates 2048-bit threshold RSA keys and 3 registrar shares
 */

"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("\n========================================================");
console.log("  Threshold Blind-Signature E-Voting Setup");
console.log("========================================================\n");

try {
  // 1. Compile contracts
  console.log("[1/2] Compiling Solidity smart contracts...");
  execSync("npx hardhat compile", { stdio: "inherit", cwd: path.join(__dirname, "..") });

  // 2. Generate threshold RSA keys if not already present
  const sharesDir = path.join(__dirname, "../registrar-service/shares");
  if (!fs.existsSync(path.join(sharesDir, "public.json"))) {
    console.log("\n[2/2] Generating (2,3) threshold RSA keys & registrar shares...");
    execSync("node registrar-service/keygen.js", { stdio: "inherit", cwd: path.join(__dirname, "..") });
  } else {
    console.log("\n[2/2] Registrar shares already exist in registrar-service/shares/.");
  }

  console.log("\n✓ Setup completed successfully!\n");
} catch (err) {
  console.error("\n❌ Setup error:", err.message);
  process.exit(1);
}
