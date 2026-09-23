"use strict";
const router = require("express").Router();
const { getDeployed, getSigner, getRegistry, getVoting, commitmentMeta, auditVotes } = require("../shared");
const { generateProof, verifyProof } = require("../../../voter-client/zkprove");
const { MerkleTree } = require("../../../voter-client/merkle");
const { ethers } = require("ethers");

/**
 * POST /api/votes/cast
 * Body: {
 *   secret:         hex string
 *   credValue:      hex string  (real or decoy value)
 *   commitment:     hex string  (the leaf commitment matching credValue)
 *   candidateIndex: number
 * }
 *
 * Flow:
 *   1. Fetch all leaves from VoterRegistry to rebuild local Merkle tree
 *   2. Find the leaf index for the given commitment
 *   3. Compute Merkle path
 *   4. Generate zk-SNARK proof
 *   5. Verify proof off-chain
 *   6. Submit nullifier + root to Voting.castVote
 */
router.post("/cast", async (req, res) => {
  const { secret, credValue, commitment, candidateIndex } = req.body;

  if (secret === undefined || credValue === undefined || commitment === undefined || candidateIndex === undefined) {
    return res.status(400).json({ success: false, error: "Missing required fields: secret, credValue, commitment, candidateIndex" });
  }

  try {
    const dep      = getDeployed();
    const signer   = await getSigner();
    const registry = getRegistry(signer);
    const voting   = getVoting(signer);

    // Rebuild Merkle tree from on-chain leaves
    const leaves   = await registry.getLeaves();
    const tree     = MerkleTree.fromLeaves([...leaves]);

    // Find leaf index
    const leafIndex = leaves.findIndex(l => l.toLowerCase() === commitment.toLowerCase());
    if (leafIndex === -1) {
      return res.status(400).json({
        success: false,
        error: "Commitment not found in Merkle tree — are you registered for this election? (Current tree has " + leaves.length + " registered leaves)."
      });
    }

    const { pathElements, pathIndices, root } = tree.getMerklePath(leafIndex);
    const currentRoot = await registry.root();

    if (root.toLowerCase() !== currentRoot.toLowerCase()) {
      return res.status(400).json({ success: false, error: "Merkle root mismatch — tree may have been updated" });
    }

    // Generate zk proof
    const { proof, publicSignals, nullifier, isRealProof } = await generateProof({
      secret,
      credValue,
      pathElements,
      pathIndices,
      root,
      electionId: dep.electionId,
    });

    // Verify proof
    const valid = await verifyProof(proof, publicSignals);
    if (!valid) {
      return res.status(400).json({ success: false, error: "Proof verification failed" });
    }

    // Submit to contract
    const tx = await voting.castVote(nullifier, root, candidateIndex);
    const receipt = await tx.wait();

    // Determine if this vote used a real or decoy credential
    const meta = commitmentMeta[commitment.toLowerCase()];
    const candidates = dep.candidates || [];
    const candidateName = candidates[candidateIndex]?.name || `Candidate #${candidateIndex + 1}`;

    const voteType = meta?.type || (req.body.isReal === false ? "decoy" : "real");
    const voterLabel = meta?.voterName || "Anonymous Voter";

    auditVotes.unshift({
      id: auditVotes.length + 1,
      type: voteType, // 'real' | 'decoy'
      voterName: voterLabel,
      candidate: candidateName,
      candidateIndex,
      nullifier,
      commitment,
      txHash: tx.hash,
      timestamp: new Date().toISOString(),
      blockNumber: receipt.blockNumber,
    });

    res.json({
      success:     true,
      accepted:    true,
      txHash:      tx.hash,
      nullifier,
      voteType,
      candidate:   candidateName,
      isRealProof,
      blockNumber: receipt.blockNumber,
    });
  } catch (err) {
    const msg = err.reason || err.message || String(err);
    // Distinguish double-vote rejection from other errors
    const isDoubleVote = msg.toLowerCase().includes("nullifier");
    res.status(isDoubleVote ? 409 : 500).json({
      success:     false,
      accepted:    false,
      error:       msg,
      isDoubleVote,
    });
  }
});

module.exports = router;
