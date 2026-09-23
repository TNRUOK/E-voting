"use strict";

const { expect } = require("chai");
const hre = require("hardhat");

// ── Helpers ──────────────────────────────────────────────────────────────────
// Minimal 256-byte "modulus" filled with 0x02 bytes (non-zero, but not a real RSA key).
// The VoterRegistry constructor only stores these — it does not validate them at deploy time.
const DUMMY_N = "0x" + "02".repeat(256);
// e = 65537 = 0x010001 (3 bytes)
const DUMMY_E = "0x010001";

describe("Smart Contract Suite: EligibilityRegistry, VoterRegistry & Voting", function () {
  this.timeout(60000);

  let eligibilityRegistry;
  let registry;
  let voting;
  let owner;
  let voter;
  const electionId = 1700000000;
  const candidates = ["Alice", "Bob", "Carol"];

  beforeEach(async () => {
    [owner, voter] = await hre.ethers.getSigners();

    // Deploy EligibilityRegistry
    const EligibilityFactory = await hre.ethers.getContractFactory("EligibilityRegistry");
    eligibilityRegistry = await EligibilityFactory.deploy();
    await eligibilityRegistry.waitForDeployment();

    // Deploy VoterRegistry with dummy RSA public key (N, e)
    const RegistryFactory = await hre.ethers.getContractFactory("VoterRegistry");
    registry = await RegistryFactory.deploy(DUMMY_N, DUMMY_E);
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

  // ── EligibilityRegistry tests ─────────────────────────────────────────────
  describe("1. EligibilityRegistry.sol", () => {
    it("should initialize with zero root and leaf count 0", async () => {
      const root = await eligibilityRegistry.root();
      expect(root).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(await eligibilityRegistry.leafCount()).to.equal(0n);
    });

    it("should allow owner to addLeaf and update root", async () => {
      const commitment = "0x" + "ab".repeat(32);
      const tx = await eligibilityRegistry.addLeaf(commitment);
      await tx.wait();

      expect(await eligibilityRegistry.leafCount()).to.equal(1n);
      const newRoot = await eligibilityRegistry.root();
      expect(newRoot).to.not.equal(hre.ethers.ZeroHash);
    });

    it("should REJECT addLeaf from non-owner", async () => {
      const commitment = "0x" + "cd".repeat(32);
      await expect(
        eligibilityRegistry.connect(voter).addLeaf(commitment)
      ).to.be.revertedWith("EligibilityRegistry: not owner");
    });

    it("should allow claimEligibility with a fresh nullifier", async () => {
      const nullifier = "0x" + "de".repeat(32);
      const tx = await eligibilityRegistry.claimEligibility(nullifier);
      await tx.wait();

      expect(await eligibilityRegistry.registrationNullifierUsed(nullifier)).to.be.true;
      expect(await eligibilityRegistry.totalClaims()).to.equal(1n);
    });

    it("should REJECT claimEligibility with a repeated nullifier", async () => {
      const nullifier = "0x" + "ff".repeat(32);
      await (await eligibilityRegistry.claimEligibility(nullifier)).wait();

      await expect(
        eligibilityRegistry.claimEligibility(nullifier)
      ).to.be.revertedWith("EligibilityRegistry: nullifier already used");
    });
  });

  // ── VoterRegistry tests ───────────────────────────────────────────────────
  describe("2. VoterRegistry.sol", () => {
    it("should initialize with initial zero root", async () => {
      const root = await registry.root();
      expect(root).to.match(/^0x[0-9a-fA-F]{64}$/);
      expect(await registry.leafCount()).to.equal(0n);
    });

    it("should store RSA public key components at deploy", async () => {
      const storedN = await registry.rsaModulus();
      const storedE = await registry.rsaExponent();
      // Stored bytes should match what we passed
      expect(storedN.toLowerCase()).to.equal(DUMMY_N.toLowerCase());
      expect(storedE.toLowerCase()).to.equal(DUMMY_E.toLowerCase());
    });

    it("should REJECT addLeaf with invalid RSA signature (dummy key, bad sig)", async () => {
      const commitment = "0x" + "aa".repeat(32);
      const fakeSig    = "0x" + "01".repeat(256); // invalid signature
      await expect(
        registry.addLeaf(commitment, fakeSig)
      ).to.be.revertedWith("VoterRegistry: invalid threshold signature");
    });
  });

  // ── Voting.sol tests ──────────────────────────────────────────────────────
  // NOTE: Voting tests use a separate registry instance with onlyOwner addLeaf
  // for simplicity. In the real flow the VoterRegistry must receive a valid RSA sig.
  describe("3. Voting.sol", () => {
    let voteRegistry;
    let voteContract;
    let currentRoot;
    const nullifier1 = "0x" + "11".repeat(32);
    const nullifier2 = "0x" + "22".repeat(32);

    beforeEach(async () => {
      // For Voting tests, we deploy a fresh VoterRegistry but bypass addLeaf
      // by directly calling the on-chain leaf insertion via a helper registry
      // that accepts our dummy RSA key — we use EligibilityRegistry instead
      // as a merkle-root source because its addLeaf is onlyOwner (no RSA check).
      const EligFactory = await hre.ethers.getContractFactory("EligibilityRegistry");
      voteRegistry = await EligFactory.deploy();
      await voteRegistry.waitForDeployment();

      const VotingFactory = await hre.ethers.getContractFactory("Voting");
      voteContract = await VotingFactory.deploy(
        await voteRegistry.getAddress(),
        electionId,
        candidates
      );
      await voteContract.waitForDeployment();

      // Add a leaf to get a valid root
      const commitment = "0x" + "ff".repeat(32);
      await (await voteRegistry.addLeaf(commitment)).wait();
      currentRoot = await voteRegistry.root();
    });

    it("should accept valid vote for candidate 0 (Alice)", async () => {
      const tx = await voteContract.castVote(nullifier1, currentRoot, 0);
      await tx.wait();

      const alice = await voteContract.candidates(0);
      expect(alice.voteCount).to.equal(1n);
      expect(await voteContract.totalVotesCast()).to.equal(1n);
      expect(await voteContract.nullifierUsed(nullifier1)).to.be.true;
    });

    it("should REJECT double voting with same nullifier", async () => {
      await (await voteContract.castVote(nullifier1, currentRoot, 0)).wait();

      await expect(
        voteContract.castVote(nullifier1, currentRoot, 1)
      ).to.be.revertedWith("Voting: nullifier already used");
    });

    it("should REJECT vote with stale or incorrect Merkle root", async () => {
      const fakeRoot = "0x" + "99".repeat(32);
      await expect(
        voteContract.castVote(nullifier2, fakeRoot, 0)
      ).to.be.revertedWith("Voting: stale Merkle root");
    });

    it("should REJECT vote with invalid candidate index", async () => {
      await expect(
        voteContract.castVote(nullifier2, currentRoot, 99)
      ).to.be.revertedWith("Voting: invalid candidate");
    });
  });
});
