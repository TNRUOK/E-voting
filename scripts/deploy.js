/**
 * deploy.js — deploys EligibilityRegistry, VoterRegistry, and Voting to the local Hardhat node.
 *
 * Reads config/candidates.json so adding/removing candidates requires no code
 * changes — just edit the JSON and re-run this script.
 *
 * Writes deployed contract addresses to deployed.json so every other service
 * (backend, voter-client, simulation) can read the addresses without needing
 * the Hardhat artifacts directory.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 */

const hre    = require("hardhat");
const fs     = require("fs");
const path   = require("path");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a 0x-prefixed hex string to a Buffer / byte array suitable for
 * passing as `bytes memory` to Solidity.  Handles odd-length hex (e.g. "0x10001").
 */
function hexToBytes(hexStr) {
  let h = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
  if (h.length % 2 !== 0) h = "0" + h;   // pad odd-length (e.g. 65537 = "10001" → "010001")
  return "0x" + h;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\nDeploying with account: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH\n`);

  // ── 1. Read candidate config ──────────────────────────────────────────────
  const candidatePath = path.join(__dirname, "../config/candidates.json");
  const candidateData = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const candidateNames = candidateData.map(c => c.name);
  console.log(`Candidates: ${candidateNames.join(", ")}`);

  // ── 2. Read RSA public key from keygen output ─────────────────────────────
  const publicKeyPath = path.join(__dirname, "../registrar-service/shares/public.json");
  if (!fs.existsSync(publicKeyPath)) {
    console.error("ERROR: registrar-service/shares/public.json not found.");
    console.error("Run 'npm run keygen' first to generate key shares.");
    process.exit(1);
  }

  const publicKey = JSON.parse(fs.readFileSync(publicKeyPath, "utf8"));
  const rsaN = hexToBytes(publicKey.N);   // 256 bytes big-endian
  const rsaE = hexToBytes(publicKey.e);   // e.g. "0x010001" (3 bytes)
  console.log(`RSA modulus loaded: ${publicKey.N.slice(0, 18)}...`);
  console.log(`RSA exponent:       ${publicKey.e}`);

  // ── 3. Deploy EligibilityRegistry ────────────────────────────────────────
  const EligibilityRegistry = await hre.ethers.getContractFactory("EligibilityRegistry");
  const eligibilityRegistry = await EligibilityRegistry.deploy();
  await eligibilityRegistry.waitForDeployment();
  const eligibilityRegistryAddr = await eligibilityRegistry.getAddress();
  console.log(`EligibilityRegistry deployed: ${eligibilityRegistryAddr}`);

  // ── 4. Deploy VoterRegistry (with RSA keys) ───────────────────────────────
  const Registry = await hre.ethers.getContractFactory("VoterRegistry");
  const registry = await Registry.deploy(rsaN, rsaE);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`VoterRegistry deployed:       ${registryAddr}`);

  // ── 5. Deploy Voting ──────────────────────────────────────────────────────
  // electionId = current block timestamp (unique per election, used in nullifier)
  const block = await hre.ethers.provider.getBlock("latest");
  const electionId = block.timestamp;

  const VotingContract = await hre.ethers.getContractFactory("Voting");
  const voting = await VotingContract.deploy(registryAddr, electionId, candidateNames);
  await voting.waitForDeployment();
  const votingAddr = await voting.getAddress();
  console.log(`Voting deployed:              ${votingAddr}`);
  console.log(`Election ID:                  ${electionId}`);

  // ── 6. Write deployed.json ────────────────────────────────────────────────
  const deployed = {
    network:              "localhost",
    chainId:              31337,
    deployedAt:           new Date().toISOString(),
    electionId:           electionId.toString(),
    EligibilityRegistry:  eligibilityRegistryAddr,
    VoterRegistry:        registryAddr,
    Voting:               votingAddr,
    candidates:           candidateData,
  };

  const outPath = path.join(__dirname, "../deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log(`\nDeployment info written to: deployed.json`);
  console.log(`\nNext steps:`);
  console.log(`  1. npm run keygen               — split RSA key into 3 registrar shares`);
  console.log(`  2. npm run reg1 / reg2 / reg3   — start 3 registrar processes`);
  console.log(`  3. npm run backend              — start API server`);
  console.log(`  4. npm run frontend             — start React dev server`);
  console.log(`  5. npm run simulate             — run full 5-voter simulation\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
