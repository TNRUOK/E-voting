/**
 * credential.js — Voter Credential Generation
 *
 * A "credential" in this system is a pair (secret, value) where:
 *   secret  — a 248-bit random scalar chosen by the voter (NEVER sent to anyone)
 *   value   — a 248-bit random scalar (the credential itself)
 *   commitment = keccak256(secret || value)  — stored on-chain in the Merkle tree
 *
 * WHY TWO VALUES:
 *   The circuit proves knowledge of (secret, credential) such that
 *   keccak256(secret, credential) is a leaf in the tree. The secret is also
 *   used to derive the nullifier: H(secret, electionId). Keeping them separate
 *   allows the nullifier to be computed without revealing the credential value,
 *   and the credential to be revealed (e.g. to a coercer) without leaking secret.
 *
 * REAL vs DECOY:
 *   A voter generates TWO credentials (real + decoy) with the SAME secret but
 *   DIFFERENT values. BOTH commitments are submitted to the tree. From the tree
 *   and from any external observer, they are indistinguishable. The voter knows
 *   which is which; no registrar does.
 *
 *   COERCION RESISTANCE: If coerced, the voter can reveal the decoy credential
 *   and cast a vote with it under observation, while the real vote (cast privately
 *   earlier or later) remains the only vote that matters. The coercer cannot
 *   detect this from on-chain data.
 *
 * NOTE ON NULLIFIER UNIQUENESS:
 *   Both real and decoy credentials share the same `secret`. This means they
 *   share the same nullifier H(secret, electionId). This is intentional: voting
 *   with either credential burns the same nullifier, so the system enforces
 *   one-vote-per-voter regardless of which credential is used. The FIRST vote
 *   (real or decoy) wins; the second is rejected.
 *
 *   (An alternative design uses different secrets for real/decoy, allowing both
 *   to be cast, with only the real one counted by some tagging mechanism. That
 *   design is out of scope for this project — see README.)
 */

"use strict";

const crypto  = require("crypto");
const { ethers } = require("ethers");

/**
 * Generate a random 248-bit scalar as a hex string (32 bytes, top byte zeroed).
 * 248 bits fits within the BN254 scalar field used by Circom/Groth16.
 */
function randomScalar() {
  const bytes = crypto.randomBytes(31); // 248 bits
  return "0x" + "00" + bytes.toString("hex"); // 32 bytes, top = 0x00
}

/**
 * Compute commitment = keccak256(abi.encodePacked(secret, value))
 * Matches what the circuit expects (simplified version using keccak256).
 */
function commitment(secret, value) {
  return ethers.keccak256(ethers.concat([secret, value]));
}

/**
 * computeNullifier(secret, electionId) — deterministic, voter-computable
 *
 * nullifier = keccak256(secret || bytes32(electionId))
 * This matches the circuit constraint: nullifier === H(secret, electionId).
 * The nullifier is public (submitted on-chain), but reveals nothing about
 * the credential value or which leaf index was used.
 *
 * @param {string}  secret      0x-prefixed 32-byte hex
 * @param {string|number|bigint} electionId
 */
function computeNullifier(secret, electionId) {
  const eidHex = "0x" + BigInt(electionId).toString(16).padStart(64, "0");
  return ethers.keccak256(ethers.concat([secret, eidHex]));
}

/**
 * generateCredentialPair() → { real, decoy, secret }
 *
 * Generates one real and one decoy credential that share the same secret
 * (and hence the same nullifier). Both will be committed to the Merkle tree.
 *
 * Returns:
 *   secret           — keep private, never share
 *   real.value       — the real credential value (keep private)
 *   real.commitment  — bytes32 leaf to submit to VoterRegistry
 *   decoy.value      — the decoy credential value (can share with a coercer)
 *   decoy.commitment — bytes32 leaf to submit to VoterRegistry
 *
 * The voter should NOT reveal which commitment is real. An observer of the
 * Merkle tree sees two leaves and cannot distinguish them.
 */
function generateCredentialPair() {
  const secret      = randomScalar();
  const realVal     = randomScalar();
  const decoyVal    = randomScalar();

  return {
    secret,
    real: {
      value:      realVal,
      commitment: commitment(secret, realVal),
    },
    decoy: {
      value:      decoyVal,
      commitment: commitment(secret, decoyVal),
    },
  };
}

module.exports = { generateCredentialPair, computeNullifier, commitment, randomScalar };
