"use strict";
const router = require("express").Router();
const fs     = require("fs");
const path   = require("path");
const { getDeployed, getPublicKey, getSigner, getRegistry, REGISTRAR_URLS, REGISTRAR_API_KEY, commitmentMeta } = require("../shared");
const { register } = require("../../../voter-client/register");
const { hexToBigInt } = require("../../../registrar-service/crypto/rsa-blind");
const { MerkleTree } = require("../../../voter-client/merkle");
const { requireAuth } = require("../middleware/auth");

const USERS_FILE = path.join(__dirname, "../data/users.json");
function readUsers()       { try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8") || "{}"); } catch { return {}; } }
function writeUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8"); }

// In-memory voter counter for rotating registrar pairs
let voterIndex = 0;

/**
 * POST /api/voters/register
 * Body: { voterName?: string }
 * Headers: Authorization: Bearer <jwt>
 *
 * Rules:
 *   1. Must be logged in (requireAuth)
 *   2. Admin accounts cannot register as voters
 *   3. Account MUST be enrolled by election admin in EligibilityRegistry.sol
 *   4. Exactly 1 credential issuance per account — further calls are blocked
 */
router.post("/register", requireAuth, async (req, res) => {
  const username = req.user.username.toLowerCase();
  const users    = readUsers();
  const user     = users[username];

  if (!user) {
    return res.status(404).json({ success: false, error: "User account not found." });
  }

  // Admin accounts cannot register for voting credentials
  if (user.role === "admin") {
    return res.status(403).json({
      success: false,
      error: "Administrator accounts cannot register for voter credentials. Please sign in with a voter account."
    });
  }

  const dep = getDeployed();
  const pub = getPublicKey();

  // 1. Must be verified and enrolled by administrator for current election
  const isEnrolled = !!user.enrolled && (!user.enrolledElectionId || user.enrolledElectionId === dep.electionId);
  if (!isEnrolled) {
    return res.status(403).json({
      success: false,
      error: "Account not enrolled for this election. An administrator must verify your identity in the Admin portal before you can obtain voting credentials."
    });
  }

  // 2. Strict 1-credential-per-account limit for current election
  const isAlreadyRegistered = !!user.hasRegistered && user.registeredElectionId === dep.electionId;
  if (isAlreadyRegistered) {
    return res.status(403).json({
      success: false,
      error: "You have already generated a voter credential for this election. Multiple voter IDs per account are strictly prohibited."
    });
  }

  const { voterName = user.username } = req.body;

  const stepLog = [];
  const logFn = msg => stepLog.push(String(msg));

  try {
    const signer = await getSigner();
    const N = hexToBigInt(pub.N);
    const e = hexToBigInt(pub.e);

    const currentVoterIndex = voterIndex++;

    const result = await register({
      registrarUrls:   REGISTRAR_URLS,
      publicKey:       { N, e },
      provider:        signer.provider,
      signer,
      registryAddr:    dep.VoterRegistry,
      electionId:      dep.electionId,
      voterIndex:      currentVoterIndex,
      registrarApiKey: REGISTRAR_API_KEY,
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

    // Lock account against any future credential generation for this election
    user.hasRegistered        = true;
    user.registeredElectionId = dep.electionId;
    user.registeredAt         = new Date().toISOString();
    user.credential           = {
      real:             { commitment: result.real.commitment, value: result.real.value },
      decoy:            { commitment: result.decoy.commitment, value: result.decoy.value },
      secret:           result.secret,
      nullifier:        result.nullifier,
      registrarsUsed:   result.registrarsUsed,
      registrarSkipped: result.registrarSkipped,
      txHashes:         result.txHashes,
      electionId:       dep.electionId,
      registeredAt:     user.registeredAt,
    };
    writeUsers(users);

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
