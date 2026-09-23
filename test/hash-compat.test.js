"use strict";

const { expect } = require("chai");
const hre = require("hardhat");
const { hashToInt } = require("../registrar-service/crypto/rsa-blind");

describe("Step 8 Verification: Hash Compatibility between JS hashToInt and Solidity/Ethers sha256", function () {
  it("should produce byte-identical SHA-256 integer digest for raw bytes32 commitments", async () => {
    // Generate sample 32-byte hex commitment
    const sampleCommitment = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("voter_secret_12345"));
    expect(sampleCommitment).to.match(/^0x[0-9a-fA-F]{64}$/);

    // 1. Off-chain JS hashToInt computation
    const jsInt = hashToInt(sampleCommitment);
    const jsHex = "0x" + jsInt.toString(16).padStart(64, "0");

    // 2. Ethers built-in sha256 over raw 32-byte commitment (equivalent to Solidity sha256(abi.encodePacked(bytes32)))
    const ethersHash = hre.ethers.sha256(sampleCommitment);
    const ethersInt = BigInt(ethersHash);

    expect(jsInt).to.equal(ethersInt);
    expect(jsHex.toLowerCase()).to.equal(ethersHash.toLowerCase());

    console.log("✓ sampleCommitment:      ", sampleCommitment);
    console.log("✓ JS hashToInt(hex):     ", jsHex);
    console.log("✓ Ethers/Solidity sha256:", ethersHash);
    console.log("✓ Exact byte-level match confirmed!");
  });
});
