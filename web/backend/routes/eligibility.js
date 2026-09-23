"use strict";

/**
 * routes/eligibility.js — Anonymous Voter Eligibility Gateway
 *
 * Gating registration with a one-time enrollment process:
 *   1. POST /api/eligibility/enroll — Authenticated user receives one-time enrollment secret.
 *   2. POST /api/eligibility/claim  — Anonymously verifies zk proof & marks nullifier on-chain.
 */

const router = require("express").Router();
const fs     = require("fs");
const path   = require("path");
const { ethers } = require("ethers");

const { requireAuth } = require("../middleware/auth");
const { getSigner, getEligibilityRegistry } = require("../shared");
const { randomScalar } = require("../../../voter-client/credential");
const { verifyEligibilityProof } = require("../../../voter-client/eligibility-prove");

const USERS_FILE = path.join(__dirname, "../data/users.json");

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8") || "{}");
  } catch {
    return {};
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

/**
 * POST /api/eligibility/enroll
 *
 * Enrolls an authenticated user into the eligibility registry.
 *
 * DOCUMENTED SIMPLIFICATION:
 *   For demonstration in this course project, the enrollmentSecret is generated
 *   server-side and returned once to the client, after which the server discards it.
 *   In a production deployment, the client would generate enrollmentSecret locally,
 *   blind or compute the commitment client-side, and only submit the commitment
 *   accompanied by a KYC/national identity credential proof.
 */
router.post("/enroll", requireAuth, async (req, res) => {
  try {
    const username = req.user.username.toLowerCase();
    const users    = readUsers();
    const user     = users[username];

    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    if (user.enrolled) {
      return res.status(400).json({ error: "Account has already enrolled for this election." });
    }

    // 1. Generate enrollment secret and its commitment
    const enrollmentSecret = randomScalar();
    const commitment       = ethers.keccak256(enrollmentSecret);

    // 2. Add commitment leaf to on-chain EligibilityRegistry
    const signer   = await getSigner();
    const registry = getEligibilityRegistry(signer);

    const tx = await registry.addLeaf(commitment);
    const receipt = await tx.wait();

    const leafIndex = Number(await registry.leafCount()) - 1;

    // 3. Mark user as enrolled in users store (do NOT store enrollmentSecret)
    user.enrolled   = true;
    user.enrolledAt = new Date().toISOString();
    writeUsers(users);

    return res.json({
      success: true,
      enrollmentSecret,
      commitment,
      leafIndex,
      txHash: receipt.hash,
    });
  } catch (err) {
    console.error("[/api/eligibility/enroll]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/eligibility/claim
 *
 * Anonymous claim of eligibility prior to threshold blind-signing.
 * Verifies the zk-SNARK proof and calls EligibilityRegistry.claimEligibility(nullifier).
 */
router.post("/claim", async (req, res) => {
  try {
    const { proof, publicSignals, nullifier } = req.body;

    if (!proof || !publicSignals || !nullifier) {
      return res.status(400).json({ error: "Missing proof, publicSignals, or nullifier." });
    }

    // 1. Verify eligibility proof off-chain
    const isValid = await verifyEligibilityProof(proof, publicSignals);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid eligibility zero-knowledge proof." });
    }

    // 2. Claim eligibility on-chain (contract reverts if nullifier already used)
    const signer   = await getSigner();
    const registry = getEligibilityRegistry(signer);

    const tx = await registry.claimEligibility(nullifier);
    await tx.wait();

    return res.json({ eligible: true, txHash: tx.hash });
  } catch (err) {
    console.error("[/api/eligibility/claim]", err.message);
    const msg = err.message.includes("nullifier already used")
      ? "Eligibility already claimed for this credential."
      : err.message;
    return res.status(400).json({ error: msg });
  }
});

module.exports = router;
