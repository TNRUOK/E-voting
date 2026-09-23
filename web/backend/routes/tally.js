"use strict";
const router   = require("express").Router();
const { getVoting, getDeployed } = require("../shared");

/**
 * GET /api/tally
 * Returns current vote counts per candidate, live from Voting.sol.
 */
router.get("/", async (req, res) => {
  try {
    const dep = getDeployed();
    const voting = getVoting();
    const [names, counts] = await voting.getTally();
    const candidates = dep.candidates || [];

    const tally = names.map((name, i) => ({
      name,
      votes: Number(counts[i]),
      color: candidates[i]?.color || "#7C3AED",
    }));

    res.json({ success: true, tally, totalVotes: tally.reduce((s, c) => s + c.votes, 0) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
