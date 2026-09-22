"use strict";
const router = require("express").Router();
const { DEPLOYED, PUBLIC_KEY, getSigner, getRegistry, getVoting, registrarCounters, commitmentMeta, auditVotes } = require("../shared");

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
    const signer = await getSigner();
    const registry = getRegistry(signer);
    const voting = getVoting(signer);

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
      color: DEPLOYED.candidates?.[i]?.color || "#7C3AED",
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
        N: PUBLIC_KEY.N,
        e: PUBLIC_KEY.e,
        scheme: "2-of-3 Shamir Threshold RSA",
      },
      electionId: DEPLOYED.electionId,
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

module.exports = router;
