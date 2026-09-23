/**
 * enroll.js — Script to populate EligibilityRegistry for test users
 *
 * Usage:
 *   node scripts/enroll.js
 */

"use strict";

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const DEPLOYED_PATH = path.join(__dirname, "../deployed.json");
const ENROLLMENTS_PATH = path.join(__dirname, "../test-enrollments.json");

function loadArtifact(name) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function randomScalar() {
  const bytes = ethers.randomBytes(31);
  return ethers.hexlify(bytes);
}

async function main() {
  if (!fs.existsSync(DEPLOYED_PATH)) {
    console.error("deployed.json not found. Run 'npm run deploy' first.");
    process.exit(1);
  }

  const deployed = JSON.parse(fs.readFileSync(DEPLOYED_PATH, "utf8"));
  if (!deployed.EligibilityRegistry) {
    console.error("EligibilityRegistry address missing in deployed.json.");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const signer = await provider.getSigner(0);

  const eligArtifact = loadArtifact("EligibilityRegistry");
  const registry = new ethers.Contract(deployed.EligibilityRegistry, eligArtifact.abi, signer);

  console.log(`Connected to EligibilityRegistry at ${deployed.EligibilityRegistry}`);

  const voters = ["Alice", "Bob", "Carol", "Dave", "Eve"];
  const enrollments = [];

  for (const name of voters) {
    const secret = randomScalar();
    const commitment = ethers.keccak256(secret);

    console.log(`Enrolling ${name}...`);
    const tx = await registry.addLeaf(commitment);
    await tx.wait();

    const count = await registry.leafCount();
    console.log(`  ✓ Enrolled ${name} (Leaf index: ${Number(count) - 1}, Commitment: ${commitment.slice(0, 18)}...)`);

    enrollments.push({
      name,
      enrollmentSecret: secret,
      commitment,
      leafIndex: Number(count) - 1,
    });
  }

  fs.writeFileSync(ENROLLMENTS_PATH, JSON.stringify(enrollments, null, 2), "utf8");
  console.log(`\nSuccessfully enrolled ${voters.length} test voters.`);
  console.log(`Saved enrollment secrets to ${ENROLLMENTS_PATH}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
