"use strict";

const { expect } = require("chai");
const { ethers } = require("ethers");
const { MerkleTree } = require("../voter-client/merkle");
const { generateCredentialPair, computeNullifier } = require("../voter-client/credential");
const { generateProof, verifyProof } = require("../voter-client/zkprove");

describe("Circuit, Merkle Tree & Zero-Knowledge Proof Suite", function () {
  this.timeout(20000);

  let tree;
  const leaves = [];
  const voters = [];

  before(() => {
    tree = new MerkleTree();
    // Generate 3 sample voters
    for (let i = 0; i < 3; i++) {
      const v = generateCredentialPair();
      voters.push(v);
      leaves.push(v.real.commitment);
      tree.insert(v.real.commitment);
    }
  });

  describe("1. Merkle Tree Membership", () => {
    it("should compute a valid root for depth 10", () => {
      const root = tree.root;
      expect(root).to.be.a("string");
      expect(root).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(tree.count).to.equal(3);
    });

    it("should generate a valid Merkle path for leaf 0", () => {
      const pathObj = tree.getMerklePath(0);
      expect(pathObj.pathElements).to.have.lengthOf(10);
      expect(pathObj.pathIndices).to.have.lengthOf(10);
      expect(pathObj.root).to.equal(tree.root);

      // Verify path manually
      let current = leaves[0];
      for (let i = 0; i < 10; i++) {
        const sibling = pathObj.pathElements[i];
        if (pathObj.pathIndices[i]) {
          current = ethers.keccak256(ethers.concat([sibling, current]));
        } else {
          current = ethers.keccak256(ethers.concat([current, sibling]));
        }
      }
      expect(current).to.equal(tree.root);
    });

    it("tampered leaf should not match tree root", () => {
      const pathObj = tree.getMerklePath(0);
      let current = "0x" + "11".repeat(32);
      for (let i = 0; i < 10; i++) {
        const sibling = pathObj.pathElements[i];
        if (pathObj.pathIndices[i]) {
          current = ethers.keccak256(ethers.concat([sibling, current]));
        } else {
          current = ethers.keccak256(ethers.concat([current, sibling]));
        }
      }
      expect(current).to.not.equal(tree.root);
    });
  });

  describe("2. Nullifier Generation", () => {
    const electionId = 123456789;

    it("should compute deterministic nullifier for the same secret & electionId", () => {
      const secret = voters[0].secret;
      const n1 = computeNullifier(secret, electionId);
      const n2 = computeNullifier(secret, electionId);
      expect(n1).to.equal(n2);
      expect(n1).to.match(/^0x[0-9a-fA-F]{64}$/);
    });

    it("should produce different nullifiers for different secrets", () => {
      const n1 = computeNullifier(voters[0].secret, electionId);
      const n2 = computeNullifier(voters[1].secret, electionId);
      expect(n1).to.not.equal(n2);
    });

    it("should produce different nullifiers for different elections", () => {
      const secret = voters[0].secret;
      const n1 = computeNullifier(secret, electionId);
      const n2 = computeNullifier(secret, electionId + 1);
      expect(n1).to.not.equal(n2);
    });
  });

  describe("3. zk-SNARK Proof Generation & Verification Pipeline", () => {
    it("should generate and verify proof object for voter 0", async () => {
      const voter = voters[0];
      const pathObj = tree.getMerklePath(0);
      const witness = {
        secret: voter.secret,
        credValue: voter.real.value,
        pathElements: pathObj.pathElements,
        pathIndices: pathObj.pathIndices,
        root: tree.root,
        electionId: 99999
      };

      const result = await generateProof(witness);
      expect(result).to.have.property("proof");
      expect(result).to.have.property("publicSignals");
      expect(result).to.have.property("nullifier");

      const verified = await verifyProof(result.proof, result.publicSignals);
      expect(verified).to.be.true;
    });
  });
});
