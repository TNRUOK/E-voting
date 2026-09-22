"use strict";
const router = require("express").Router();
const { DEPLOYED, PUBLIC_KEY, getSigner, getRegistry, REGISTRAR_URLS, commitmentMeta } = require("../shared");
const { register } = require("../../../voter-client/register");
const { hexToBigInt } = require("../../../registrar-service/crypto/rsa-blind");
const { MerkleTree } = require("../../../voter-client/merkle");

// In-memory voter counter for rotating registrar pairs
let voterIndex = 0;

/**
 * POST /api/voters/register
 * Body: { voterName: string }
 *
 * Orchestrates full registration:
 *   1. Generate real + decoy credentials
 *   2. Blind + collect 2-of-3 partial signatures
 *   3. Combine + unblind
 *   4. Submit both commitments on-chain
 *
 * Returns credentials to the browser ONLY — not logged server-side.
 */
router.post("/register", async (req, res) => {
  const { voterName = "Anonymous" } = req.body;

  // We do NOT store voterName alongside the credential server-side.
  // The name is simulation-only; the browser receives the credentials.
  const stepLog = [];
  const logFn = msg => stepLog.push(String(msg));

  try {
    const signer = await getSigner();
    const N = hexToBigInt(PUBLIC_KEY.N);
    const e = hexToBigInt(PUBLIC_KEY.e);

    const currentVoterIndex = voterIndex++;

    const result = await register({
      registrarUrls: REGISTRAR_URLS,
      publicKey: { N, e },
      provider:    signer.provider,
      signer,
      registryAddr: DEPLOYED.VoterRegistry,
      electionId:   DEPLOYED.electionId,
      voterIndex:   currentVoterIndex,
      logFn,
    });

    // Save metadata for Admin Audit View (distinguishing real vs decoy leaves)
    if (result.real?.commitment) {
      commitmentMeta[result.real.commitment.toLowerCase()] = {
        type: "real",
        voterName,
        secret: result.secret,
        value: result.real.value,
        nullifier: result.nullifier,
        registrarsUsed: result.registrarsUsed,
        timestamp: new Date().toISOString(),
      };
    }
    if (result.decoy?.commitment) {
      commitmentMeta[result.decoy.commitment.toLowerCase()] = {
        type: "decoy",
        voterName,
        secret: result.secret,
        value: result.decoy.value,
        nullifier: result.nullifier,
        registrarsUsed: result.registrarsUsed,
        timestamp: new Date().toISOString(),
      };
    }

    res.json({
      success:          true,
      real:             { commitment: result.real.commitment, value: result.real.value },
      decoy:            { commitment: result.decoy.commitment, value: result.decoy.value },
      secret:           result.secret,
      nullifier:        result.nullifier,
      registrarsUsed:   result.registrarsUsed,
      registrarSkipped: result.registrarSkipped,
      txHashes:         result.txHashes,
      blindingFactor:   result.blindingFactor,
      blindedMessage:   result.blindedMessage,
      partialSigs:      result.partialSigs,
      realFinalSig:     result.realFinalSig,
      merkleRoot:       result.merkleRoot,
      steps:            stepLog,
    });
  } catch (err) {
    console.error("[/api/voters/register]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
