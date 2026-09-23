/**
 * eligibility-merkle.js — Off-Chain Incremental Merkle Tree for EligibilityRegistry
 *
 * Mirrors the on-chain tree in EligibilityRegistry.sol:
 *   - Depth 10, same zero values, same keccak256 hashing
 *   - Frontier-based incremental insertion
 *
 * Used to compute Merkle paths (witnesses) for eligibility-prove.js.
 */

"use strict";

const { ethers } = require("ethers");

const DEPTH = 10;

// Precomputed zero subtree hashes (match EligibilityRegistry._zeros())
function computeZeros() {
  const z = new Array(DEPTH + 1);
  z[0] = ethers.ZeroHash; // bytes32(0)
  for (let i = 1; i <= DEPTH; i++) {
    z[i] = ethers.keccak256(ethers.concat([z[i - 1], z[i - 1]]));
  }
  return z;
}

const ZEROS = computeZeros();

class EligibilityMerkleTree {
  constructor() {
    this.leaves   = [];               // committed leaves (bytes32 hex strings)
    this.frontier = new Array(DEPTH).fill(ethers.ZeroHash);
    this.root     = ZEROS[DEPTH];
    this.count    = 0;
  }

  /**
   * Insert an eligibility leaf (bytes32 hex string) into the tree.
   * Returns the new root.
   */
  insert(leaf) {
    if (this.count >= (1 << DEPTH)) throw new Error("Tree is full");

    this.leaves.push(leaf);
    let index   = this.count;
    let current = leaf;

    for (let i = 0; i < DEPTH; i++) {
      if (index & 1) {
        current = ethers.keccak256(ethers.concat([this.frontier[i], current]));
      } else {
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
   * Compute the Merkle proof for the leaf at `leafIndex`.
   */
  getMerklePath(leafIndex) {
    if (leafIndex < 0 || leafIndex >= this.count) {
      throw new Error(`Leaf index ${leafIndex} out of bounds (count: ${this.count})`);
    }

    const pathElements = [];
    const pathIndices  = [];

    const totalLeaves = 1 << DEPTH;
    let currentLevel = new Array(totalLeaves);
    for (let i = 0; i < totalLeaves; i++) {
      currentLevel[i] = i < this.leaves.length ? this.leaves[i] : ZEROS[0];
    }

    let idx = leafIndex;
    for (let level = 0; level < DEPTH; level++) {
      const isRight = idx & 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;

      pathElements.push(currentLevel[siblingIdx]);
      pathIndices.push(isRight ? 1 : 0);

      const nextLevelLen = currentLevel.length >> 1;
      const nextLevel = new Array(nextLevelLen);
      for (let j = 0; j < nextLevelLen; j++) {
        const left  = currentLevel[2 * j];
        const right = currentLevel[2 * j + 1];
        nextLevel[j] = ethers.keccak256(ethers.concat([left, right]));
      }
      currentLevel = nextLevel;
      idx >>= 1;
    }

    return {
      pathElements,
      pathIndices,
      root: this.root,
      leaf: this.leaves[leafIndex],
    };
  }

  static fromLeaves(leaves) {
    const tree = new EligibilityMerkleTree();
    for (const leaf of leaves) {
      tree.insert(leaf);
    }
    return tree;
  }
}

module.exports = { EligibilityMerkleTree, ZEROS, DEPTH };
