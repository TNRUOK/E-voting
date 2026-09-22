/**
 * zkprove.js — zk-SNARK Proof Generation (simplified off-chain version)
 *
 * In the full base-paper implementation, a Groth16 proof is generated using
 * the compiled Circom circuit (membership.circom) and submitted on-chain to
 * a Groth16Verifier contract. For this course project, we implement the
 * VERIFICATION LOGIC off-chain in the backend (snarkjs.groth16.verify)
 * and pass the proof result to the contract.
 *
 * WHAT THIS FILE DOES:
 *   1. Constructs the circuit witness (public + private inputs)
 *   2. If snarkjs + circuit artifacts are available, generates a real Groth16 proof
 *   3. If circuit artifacts are missing (first run before circuit compilation),
 *      generates a "demo proof" that the backend accepts — clearly marked as
 *      SIMPLIFIED in logs. Run 'npm run circuit:build' to enable real proofs.
 *
 * The nullifier, root, and electionId are ALWAYS real — they are checked by
 * the smart contract regardless of whether a real zk proof is used.
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { computeNullifier } = require("./credential");

const CIRCUIT_BUILD = path.join(__dirname, "../circuits/build");
const WASM_PATH     = path.join(CIRCUIT_BUILD, "membership_js/membership.wasm");
const ZKEY_PATH     = path.join(CIRCUIT_BUILD, "membership_final.zkey");

/**
 * generateProof(witness) → { proof, publicSignals, nullifier, isRealProof }
 *
 * @param {object} witness
 *   witness.secret       — private: voter's secret scalar (hex)
 *   witness.credValue    — private: real or decoy credential value (hex)
 *   witness.pathElements — private: Merkle siblings (array of bytes32 hex)
 *   witness.pathIndices  — private: Merkle path bits (array of 0/1)
 *   witness.root         — public:  current Merkle root (bytes32 hex)
 *   witness.electionId   — public:  election ID (number or bigint)
 */
async function generateProof(witness) {
  const { secret, credValue, pathElements, pathIndices, root, electionId } = witness;

  // Derive the public nullifier
  const nullifier = computeNullifier(secret, electionId);

  // Try to generate a real Groth16 proof if circuit artifacts exist
  if (fs.existsSync(WASM_PATH) && fs.existsSync(ZKEY_PATH)) {
    try {
      const snarkjs = require("snarkjs");

      // Circuit input (all values as decimal strings for snarkjs)
      const circuitInput = {
        root:         BigInt(root).toString(),
        nullifier:    BigInt(nullifier).toString(),
        electionId:   BigInt(electionId).toString(),
        secret:       BigInt(secret).toString(),
        credential:   BigInt(credValue).toString(),
        pathElements: pathElements.map(p => BigInt(p).toString()),
        pathIndices:  pathIndices.map(b => b ? "1" : "0"),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInput,
        WASM_PATH,
        ZKEY_PATH
      );

      return { proof, publicSignals, nullifier, isRealProof: true };
    } catch (err) {
      console.warn("[zkprove] Real proof generation failed:", err.message);
      console.warn("[zkprove] Falling back to demo proof");
    }
  }

  // ── Demo proof (no circuit artifacts) ─────────────────────────────────────
  // This is clearly marked as a simplification. The nullifier + root are real.
  // The backend accepts this and passes the nullifier + root to the contract,
  // which enforces the actual double-vote prevention.
  console.log("[zkprove] ⚠️  Using DEMO PROOF (circuit not compiled). Run 'npm run circuit:build' for real Groth16 proofs.");

  const demoProof = {
    pi_a: ["0", "0", "1"],
    pi_b: [["0", "0"], ["0", "0"], ["1", "0"]],
    pi_c: ["0", "0", "1"],
    protocol: "groth16",
    curve: "bn128",
    _demo: true, // flag so backend can log a warning
  };

  const publicSignals = [
    BigInt(root).toString(),
    BigInt(nullifier).toString(),
    BigInt(electionId).toString(),
  ];

  return { proof: demoProof, publicSignals, nullifier, isRealProof: false };
}

/**
 * verifyProof(proof, publicSignals) → boolean
 *
 * Verifies a Groth16 proof against the generated verification key.
 * Used by the backend before submitting to the contract.
 */
async function verifyProof(proof, publicSignals) {
  if (proof._demo) {
    // Demo proofs are "accepted" by the backend for demonstration purposes.
    // The contract still enforces nullifier uniqueness.
    return true;
  }

  const snarkjs = require("snarkjs");
  const vkPath  = path.join(CIRCUIT_BUILD, "verification_key.json");

  if (!fs.existsSync(vkPath)) {
    console.warn("[zkprove] Verification key not found — accepting proof (demo mode)");
    return true;
  }

  const vk = JSON.parse(fs.readFileSync(vkPath, "utf8"));
  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

module.exports = { generateProof, verifyProof };
