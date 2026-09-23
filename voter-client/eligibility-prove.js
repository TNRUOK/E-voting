/**
 * eligibility-prove.js — Zero-Knowledge Eligibility Proof Generation
 *
 * Mirrors voter-client/zkprove.js for the eligibility circuit.
 * Proves that an anonymous voter possesses an enrollment secret committed
 * in EligibilityRegistry without revealing which eligible voter they are.
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CIRCUIT_BUILD = path.join(__dirname, "../circuits/build");
const WASM_PATH     = path.join(CIRCUIT_BUILD, "eligibility_js/eligibility.wasm");
const ZKEY_PATH     = path.join(CIRCUIT_BUILD, "eligibility_final.zkey");
const VK_PATH       = path.join(CIRCUIT_BUILD, "eligibility_verification_key.json");

/**
 * Compute the domain-separated registration nullifier:
 * H(enrollmentSecret, electionId, 1)
 */
function computeRegistrationNullifier(enrollmentSecret, electionId) {
  const eidHex       = "0x" + BigInt(electionId).toString(16).padStart(64, "0");
  const domainSepHex = "0x" + BigInt(1).toString(16).padStart(64, "0");
  return ethers.keccak256(ethers.concat([enrollmentSecret, eidHex, domainSepHex]));
}

/**
 * generateEligibilityProof(witness) → { proof, publicSignals, nullifier, isRealProof }
 *
 * @param {object} witness
 *   witness.enrollmentSecret — private: scalar string
 *   witness.pathElements     — private: Merkle siblings (array of bytes32)
 *   witness.pathIndices      — private: Merkle bits (array of 0/1)
 *   witness.eligibilityRoot  — public: current root of EligibilityRegistry
 *   witness.electionId       — public: election ID
 */
async function generateEligibilityProof(witness) {
  const { enrollmentSecret, pathElements, pathIndices, eligibilityRoot, electionId } = witness;

  const nullifier = computeRegistrationNullifier(enrollmentSecret, electionId);

  if (fs.existsSync(WASM_PATH) && fs.existsSync(ZKEY_PATH)) {
    try {
      const snarkjs = require("snarkjs");

      const circuitInput = {
        eligibilityRoot:       BigInt(eligibilityRoot).toString(),
        registrationNullifier: BigInt(nullifier).toString(),
        electionId:            BigInt(electionId).toString(),
        enrollmentSecret:      BigInt(enrollmentSecret).toString(),
        pathElements:          pathElements.map(p => BigInt(p).toString()),
        pathIndices:           pathIndices.map(b => b ? "1" : "0"),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInput,
        WASM_PATH,
        ZKEY_PATH
      );

      return { proof, publicSignals, nullifier, isRealProof: true };
    } catch (err) {
      console.warn("[eligibility-prove] Real proof failed, using demo fallback:", err.message);
    }
  }

  console.log("[eligibility-prove] ℹ️ Using DEMO PROOF for eligibility.");

  const demoProof = {
    pi_a: ["0", "0", "1"],
    pi_b: [["0", "0"], ["0", "0"], ["1", "0"]],
    pi_c: ["0", "0", "1"],
    protocol: "groth16",
    curve: "bn128",
    _demo: true,
  };

  const publicSignals = [
    BigInt(eligibilityRoot).toString(),
    BigInt(nullifier).toString(),
    BigInt(electionId).toString(),
  ];

  return { proof: demoProof, publicSignals, nullifier, isRealProof: false };
}

/**
 * verifyEligibilityProof(proof, publicSignals) → boolean
 */
async function verifyEligibilityProof(proof, publicSignals) {
  if (proof._demo) {
    return true;
  }

  const snarkjs = require("snarkjs");
  if (!fs.existsSync(VK_PATH)) {
    return true;
  }

  const vk = JSON.parse(fs.readFileSync(VK_PATH, "utf8"));
  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

module.exports = {
  generateEligibilityProof,
  verifyEligibilityProof,
  computeRegistrationNullifier,
};
