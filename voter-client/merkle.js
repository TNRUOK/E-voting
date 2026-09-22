/**
 * merkle.js — Off-Chain Incremental Merkle Tree
 *
 * Mirrors the on-chain tree in VoterRegistry.sol exactly:
 *   - Same depth (10), same zero values, same hash function (keccak256)
 *   - Frontier-based incremental insertion
 *
 * Used to compute Merkle paths (witnesses) for the zk-SNARK prover.
 * The on-chain root and the off-chain root must always match; if they diverge,
 * proof generation will produce a root mismatch and the proof will be rejected.
 *
 * NOTE: We use keccak256 (not Poseidon) here for hashing to match the Solidity
 * contract. The Circom circuit also uses keccak256-compatible hashing in its
 * simplified version. See README §Simplifications.
 */

"use strict";

const { ethers } = require("ethers");

const DEPTH = 10;

// Precomputed zero subtree hashes (match VoterRegistry._zeros())
function computeZeros() {
  const z = new Array(DEPTH + 1);
  z[0] = ethers.ZeroHash; // bytes32(0)
  for (let i = 1; i <= DEPTH; i++) {
    z[i] = ethers.keccak256(ethers.concat([z[i - 1], z[i - 1]]));
  }
  return z;
}

const ZEROS = computeZeros();

class MerkleTree {
  constructor() {
    this.leaves   = [];               // committed leaves (bytes32 hex strings)
    this.frontier = new Array(DEPTH).fill(ethers.ZeroHash);
    this.root     = ZEROS[DEPTH];
    this.count    = 0;
  }

  /**
   * Insert a leaf (bytes32 hex string) into the tree.
   * Returns the new root.
   */
  insert(leaf) {
    if (this.count >= (1 << DEPTH)) throw new Error("Tree is full");

    this.leaves.push(leaf);
    let index   = this.count;
    let current = leaf;

    for (let i = 0; i < DEPTH; i++) {
      if (index & 1) {
        // Right child — hash frontier with current
        current = ethers.keccak256(ethers.concat([this.frontier[i], current]));
      } else {
        // Left child — store in frontier, hash with zero
        this.frontier[i] = current;
        current = ethers.keccak256(ethers.concat([current, ZEROS[i]]));
      }
      index >>= 1;
    }

    this.count++;
    this.root = current;
    return this.root;
  }

  /**
   * Compute the Merkle path (witness) for the leaf at `leafIndex`.
   * Returns { pathElements, pathIndices } suitable for the circuit.
   */
  getMerklePath(leafIndex) {
    if (leafIndex >= this.count) throw new Error("Leaf index out of range");

    // Rebuild the full level-by-level tree to get siblings
    const levels = [];
    let level = [...this.leaves];

    // Pad to power of 2
    while (level.length < (1 << DEPTH)) {
      level.push(ZEROS[0]);
    }
    levels.push(level);

    for (let d = 0; d < DEPTH; d++) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        next.push(ethers.keccak256(ethers.concat([level[i], level[i + 1]])));
      }
      level = next;
      levels.push(level);
    }

    // Extract path
    const pathElements = [];
    const pathIndices  = [];
    let idx = leafIndex;

    for (let d = 0; d < DEPTH; d++) {
      const isRight = idx & 1;
      const sibling = isRight ? levels[d][idx - 1] : levels[d][idx + 1];
      pathElements.push(sibling);
      pathIndices.push(isRight);
      idx >>= 1;
    }

    return { pathElements, pathIndices, root: this.root };
  }

  /**
   * Load a set of leaves from the blockchain (via getLeaves()) and rebuild tree.
   */
  static fromLeaves(leaves) {
    const tree = new MerkleTree();
    for (const leaf of leaves) tree.insert(leaf);
    return tree;
  }
}

module.exports = { MerkleTree, ZEROS, DEPTH };
