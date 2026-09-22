"use strict";
const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const { DEPLOYED } = require("../shared");

const CANDIDATES_FILE = path.join(__dirname, "../../../config/candidates.json");

/** GET /api/candidates — returns candidate list */
router.get("/", (req, res) => {
  let candidates = DEPLOYED?.candidates;
  if ((!candidates || candidates.length === 0) && fs.existsSync(CANDIDATES_FILE)) {
    try {
      candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8"));
    } catch (e) {
      candidates = [];
    }
  }
  res.json({ success: true, candidates: candidates || [], electionId: DEPLOYED?.electionId });
});

/** POST /api/candidates — add a new candidate to config/candidates.json */
router.post("/", (req, res) => {
  try {
    const { name, tagline, color } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Candidate name is required" });
    }

    let candidates = [];
    if (fs.existsSync(CANDIDATES_FILE)) {
      candidates = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8"));
    }
    const nextId = candidates.length > 0 ? Math.max(...candidates.map(c => Number(c.id) || 0)) + 1 : 1;
    const colors = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"];
    const chosenColor = color || colors[(nextId - 1) % colors.length];

    const newCandidate = {
      id: nextId,
      name: name.trim(),
      tagline: tagline ? tagline.trim() : "Dedicated to progress and community integrity",
      color: chosenColor
    };

    candidates.push(newCandidate);
    fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(candidates, null, 2));
    if (DEPLOYED) {
      DEPLOYED.candidates = candidates;
    }

    res.json({ success: true, candidate: newCandidate, candidates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
