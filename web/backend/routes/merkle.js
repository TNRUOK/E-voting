"use strict";
const router = require("express").Router();
const { getRegistry } = require("../shared");

/** GET /api/merkle/tree — current Merkle tree size and root */
router.get("/tree", async (req, res) => {
  try {
    const registry = getRegistry();
    const [root, leafCount] = await Promise.all([registry.root(), registry.leafCount()]);
    res.json({ success: true, root, leafCount: Number(leafCount), depth: 10, maxLeaves: 1024 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
