"use strict";
const router = require("express").Router();
const fs   = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getDeployed, getPublicKey, getSigner, getRegistry, getVoting, getEligibilityRegistry, registrarCounters, commitmentMeta, auditVotes } = require("../shared");
const { randomScalar } = require("../../../voter-client/credential");

const USERS_FILE = path.join(__dirname, "../data/users.json");
function readUsers()       { try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8") || "{}"); } catch { return {}; } }
function writeUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8"); }

// Protect all admin routes
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/audit
 * Returns comprehensive audit data:
 * - Real vs Decoy votes cast
 * - All Merkle tree leaves with classification tags
 * - Registrar health & counters
 * - Candidate breakdown
 */
router.get("/audit", async (req, res) => {
  try {
    const dep      = getDeployed();
    const pub      = getPublicKey();
    const signer   = await getSigner();
    const registry = getRegistry(signer);
    const voting   = getVoting(signer);

    // Fetch on-chain leaves
    let leaves = [];
    try {
      leaves = await registry.getLeaves();
    } catch (e) {
      leaves = [];
    }

    const currentRoot = await registry.root().catch(() => "0x0");
    const [candidateNames, counts] = await voting.getTally().catch(() => [[], []]);

    // Tag each leaf with its known metadata (Real vs Decoy vs External)
    const taggedLeaves = leaves.map((leaf, index) => {
      const meta = commitmentMeta[leaf.toLowerCase()];
      return {
        index,
        commitment: leaf,
        type: meta?.type || "untracked",
        voterName: meta?.voterName || `Leaf #${index}`,
        nullifier: meta?.nullifier || null,
        timestamp: meta?.timestamp || null,
        registrarsUsed: meta?.registrarsUsed || [],
      };
    });

    const realVotes = auditVotes.filter(v => v.type === "real");
    const decoyVotes = auditVotes.filter(v => v.type === "decoy");

    const officialTally = candidateNames.map((name, i) => ({
      name,
      votes: Number(counts[i]),
      color: dep.candidates?.[i]?.color || "#7C3AED",
    }));

    res.json({
      success: true,
      stats: {
        totalRegistrations: Object.keys(commitmentMeta).length / 2,
        totalMerkleLeaves: leaves.length,
        totalRealLeaves: taggedLeaves.filter(l => l.type === "real").length,
        totalDecoyLeaves: taggedLeaves.filter(l => l.type === "decoy").length,
        totalVotesCast: auditVotes.length,
        totalRealVotes: realVotes.length,
        totalDecoyVotes: decoyVotes.length,
        merkleRoot: currentRoot,
      },
      auditVotes,
      taggedLeaves,
      officialTally,
      registrarCounters,
      publicKey: {
        N: pub.N,
        e: pub.e,
        scheme: "2-of-3 Shamir Threshold RSA",
      },
      electionId: dep.electionId,
    });
  } catch (err) {
    console.error("[/api/admin/audit]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/clear-audit
 */
router.post("/clear-audit", (req, res) => {
  auditVotes.length = 0;
  res.json({ success: true, message: "Audit logs cleared" });
});

/**
 * GET /api/admin/voters
 * Returns all registered user accounts with their enrollment status.
 * Admin use only — for the Voter Enrollment management panel.
 */
router.get("/voters", (req, res) => {
  const dep   = getDeployed();
  const users = readUsers();
  const list = Object.values(users).map(u => ({
    username:      u.username,
    role:          u.role,
    enrolled:      !!(u.enrolled && (!u.enrolledElectionId || u.enrolledElectionId === dep.electionId)),
    enrolledAt:    u.enrolledAt || null,
    hasRegistered: !!(u.hasRegistered && u.registeredElectionId === dep.electionId),
    registeredAt:  u.registeredAt || null,
    createdAt:     u.createdAt  || null,
  }));
  res.json({ success: true, voters: list });
});

/**
 * POST /api/admin/enroll/:username
 * Admin manually enrolls a voter account by generating an enrollment secret,
 * adding its commitment to EligibilityRegistry.sol, and returning the secret
 * to be passed to the voter (or shown in-UI for demo purposes).
 */
router.post("/enroll/:username", async (req, res) => {
  try {
    const dep      = getDeployed();
    const username = req.params.username.toLowerCase();
    const users    = readUsers();
    const user     = users[username];

    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found.` });
    }
    if (user.enrolled && (!user.enrolledElectionId || user.enrolledElectionId === dep.electionId)) {
      return res.status(400).json({ error: `"${username}" is already enrolled for this election.` });
    }

    // 1. Generate enrollment secret and commitment
    const enrollmentSecret = randomScalar();
    const commitment       = ethers.keccak256(enrollmentSecret);

    // 2. Add commitment leaf to EligibilityRegistry on-chain
    const signer   = await getSigner();
    const registry = getEligibilityRegistry(signer);
    const tx       = await registry.addLeaf(commitment);
    const receipt  = await tx.wait();
    const leafIndex = Number(await registry.leafCount()) - 1;

    // 3. Mark user enrolled for current election (clear any stale old credentials)
    user.enrolled           = true;
    user.enrolledElectionId = dep.electionId;
    user.enrolledAt         = new Date().toISOString();
    if (user.registeredElectionId !== dep.electionId) {
      user.hasRegistered = false;
      user.credential    = null;
    }
    writeUsers(users);

    return res.json({
      success: true,
      username,
      enrollmentSecret,   // returned ONCE to the admin to relay to the voter
      commitment,
      leafIndex,
      txHash: receipt.hash,
    });
  } catch (err) {
    console.error("[/api/admin/enroll]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
