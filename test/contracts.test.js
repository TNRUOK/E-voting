"use strict";

const { expect } = require("chai");
const hre = require("hardhat");

describe("Smart Contract Suite: VoterRegistry & Voting", function () {
  this.timeout(30000);

  let registry;
  let voting;
  let owner;
  let voter;
  const electionId = 1700000000;
  const candidates = ["Alice", "Bob", "Carol"];

  beforeEach(async () => {
    [owner, voter] = await hre.ethers.getSigners();

    // Deploy VoterRegistry
    const RegistryFactory = await hre.ethers.getContractFactory("VoterRegistry");
    registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();

    // Deploy Voting
    const VotingFactory = await hre.ethers.getContractFactory("Voting");
    voting = await VotingFactory.deploy(
      await registry.getAddress(),
      electionId,
      candidates
    );
    await voting.waitForDeployment();
  });

  describe("1. VoterRegistry.sol", () => {
    it("should initialize with initial zero root", async () => {
      const root = await registry.root();
      expect(root).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(await registry.leafCount()).to.equal(0n);
    });

    it("should add leaf and update root", async () => {
      const commitment = "0x" + "aa".repeat(32);
      const tx = await registry.addLeaf(commitment);
      await tx.wait();

      expect(await registry.leafCount()).to.equal(1n);
      const newRoot = await registry.root();
      expect(newRoot).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    });
  });

  describe("2. Voting.sol", () => {
    let currentRoot;
    const nullifier1 = "0x" + "11".repeat(32);
    const nullifier2 = "0x" + "22".repeat(32);

    beforeEach(async () => {
      // Add a leaf to get an updated root
      const commitment = "0x" + "ff".repeat(32);
      await (await registry.addLeaf(commitment)).wait();
      currentRoot = await registry.root();
    });

    it("should accept valid vote for candidate 0 (Alice)", async () => {
      const tx = await voting.castVote(nullifier1, currentRoot, 0);
      await tx.wait();

      const alice = await voting.candidates(0);
      expect(alice.voteCount).to.equal(1n);
      expect(await voting.totalVotesCast()).to.equal(1n);
      expect(await voting.nullifierUsed(nullifier1)).to.be.true;
    });

    it("should REJECT double voting with same nullifier", async () => {
      // Cast first vote
      await (await voting.castVote(nullifier1, currentRoot, 0)).wait();

      // Attempt second vote with same nullifier
      await expect(
        voting.castVote(nullifier1, currentRoot, 1)
      ).to.be.revertedWith("Voting: nullifier already used");
    });

    it("should REJECT vote with stale or incorrect Merkle root", async () => {
      const fakeRoot = "0x" + "99".repeat(32);
      await expect(
        voting.castVote(nullifier2, fakeRoot, 0)
      ).to.be.revertedWith("Voting: stale Merkle root");
    });

    it("should REJECT vote with invalid candidate index", async () => {
      await expect(
        voting.castVote(nullifier2, currentRoot, 99)
      ).to.be.revertedWith("Voting: invalid candidate");
    });
  });
});
