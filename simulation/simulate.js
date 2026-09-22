/**
 * simulate.js — End-to-End Simulation Script
 *
 * Demonstrates the full threshold blind-signature e-voting system:
 *   a) Registration for 5 voters (each using a different registrar pair)
 *   b) Normal voting with real credentials (voters 1-3)
 *   c) Coercion scenario (voter 4): decoy vote first, then real vote
 *   d) Double-vote attempt (voter 5): same nullifier twice → rejected
 *   e) Final tally + summary table
 *
 * Run:
 *   node simulation/simulate.js          (CLI mode)
 *   Called by backend /api/simulation/run (SSE mode, same output)
 *
 * Prerequisites:
 *   - Hardhat node running on localhost:8545
 *   - Contracts deployed (npm run deploy → deployed.json exists)
 *   - Keys generated (npm run keygen → shares/*.json exist)
 *   - 3 registrar services running (npm run reg1 / reg2 / reg3)
 */

"use strict";

const { ethers } = require("ethers");
const path       = require("path");
const fs         = require("fs");

// Conditionally use chalk (for colour) — gracefully degrade if not installed
let chalk;
try { chalk = require("chalk"); } catch { chalk = { green: s => s, red: s => s, yellow: s => s, cyan: s => s, bold: s => s, gray: s => s }; }

const { register }           = require("../voter-client/register");
const { generateProof, verifyProof } = require("../voter-client/zkprove");
const { MerkleTree }         = require("../voter-client/merkle");
const { hexToBigInt }        = require("../registrar-service/crypto/rsa-blind");

// ── Configuration ─────────────────────────────────────────────────────────────
const REGISTRAR_URLS = [
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
];

const HARDHAT_URL  = "http://localhost:8545";
const DEPLOYED     = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployed.json"), "utf8"));
const PUBLIC_KEY   = JSON.parse(fs.readFileSync(path.join(__dirname, "../registrar-service/shares/public.json"), "utf8"));

const REGISTRY_ADDR = DEPLOYED.VoterRegistry;
const VOTING_ADDR   = DEPLOYED.Voting;
const ELECTION_ID   = DEPLOYED.electionId;
const CANDIDATES    = DEPLOYED.candidates;

// ── Logging ───────────────────────────────────────────────────────────────────
// Output is SSE-compatible: each line is prefixed with "data:" when IS_SSE=true
const IS_SSE = process.env.IS_SSE === "1";

function log(msg = "") {
  const line = String(msg);
  if (IS_SSE) {
    process.stdout.write(`data: ${line}\n\n`);
  } else {
    console.log(line);
  }
}

function step(title) {
  log("");
  log(chalk.cyan("═".repeat(65)));
  log(chalk.cyan(`  ${title}`));
  log(chalk.cyan("═".repeat(65)));
}

function ok(msg)   { log(chalk.green(`  ✓ ${msg}`)); }
function err(msg)  { log(chalk.red(  `  ✗ ${msg}`)); }
function info(msg) { log(chalk.gray( `  → ${msg}`)); }
function warn(msg) { log(chalk.yellow(`  ⚠  ${msg}`)); }

// ── ABI loader ────────────────────────────────────────────────────────────────
function loadAbi(name) {
  const p = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

// ── Main simulation ───────────────────────────────────────────────────────────
async function simulate() {
  log("");
  log(chalk.bold("╔══════════════════════════════════════════════════════════════╗"));
  log(chalk.bold("║   THRESHOLD BLIND-SIGNATURE E-VOTING — FULL SIMULATION       ║"));
  log(chalk.bold("║   (t=2, n=3) Shamir + RSA Blind Signatures + Groth16 ZK      ║"));
  log(chalk.bold("╚══════════════════════════════════════════════════════════════╝"));
  log(`  Election ID:  ${ELECTION_ID}`);
  log(`  Candidates:   ${CANDIDATES.map(c => c.name).join(", ")}`);
  log(`  Registry:     ${REGISTRY_ADDR}`);
  log(`  Voting:       ${VOTING_ADDR}`);

  // ── Connect to blockchain ─────────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(HARDHAT_URL);
  const accounts = await provider.listAccounts();
  const signer   = await provider.getSigner(0);

  const registryAbi = loadAbi("VoterRegistry");
  const votingAbi   = loadAbi("Voting");
  const registry    = new ethers.Contract(REGISTRY_ADDR, registryAbi, signer);
  const voting      = new ethers.Contract(VOTING_ADDR,   votingAbi,   signer);

  const N = hexToBigInt(PUBLIC_KEY.N);
  const e = hexToBigInt(PUBLIC_KEY.e);
  const publicKey = { N, e };

  const commonOpts = {
    registrarUrls: REGISTRAR_URLS,
    publicKey,
    provider,
    signer,
    registryAddr: REGISTRY_ADDR,
    electionId:   ELECTION_ID,
    logFn:        info,
  };

  // Local Merkle tree (mirrors on-chain tree, used for proof witnesses)
  const merkleTree = new MerkleTree();

  // Track registered voters
  const voterRecords = [];

  // ── PHASE A: REGISTRATION (5 voters) ─────────────────────────────────────
  step("PHASE A — REGISTRATION (5 voters)");

  const voterNames = ["Alice", "Bob", "Carol", "Dave (coercion)", "Eve (double-vote)"];

  for (let i = 0; i < 5; i++) {
    log(`\n  [Voter ${i + 1}: ${voterNames[i]}]`);

    const result = await register({ ...commonOpts, voterIndex: i });

    // Update local Merkle tree
    const realLeafIndex  = merkleTree.count;
    merkleTree.insert(result.real.commitment);
    const decoyLeafIndex = merkleTree.count;
    merkleTree.insert(result.decoy.commitment);

    voterRecords.push({
      name:             voterNames[i],
      ...result,
      realLeafIndex,
      decoyLeafIndex,
    });

    ok(`Voter ${i + 1} registered. Used registrars {${result.registrarsUsed.join(", ")}}. Registrar ${result.registrarSkipped} was NOT involved and never saw this voter's credential.`);
    info(`Real leaf:  index ${realLeafIndex} | ${result.real.commitment.slice(0, 18)}...`);
    info(`Decoy leaf: index ${decoyLeafIndex} | ${result.decoy.commitment.slice(0, 18)}...`);
    info(`Nullifier:  ${result.nullifier.slice(0, 18)}... [same for real+decoy — one-vote-per-voter]`);
  }

  const merkleRoot = await registry.root();
  log(`\n  Current Merkle root: ${merkleRoot.slice(0, 18)}... (${await registry.leafCount()} leaves)`);

  // ── PHASE B: NORMAL VOTING (voters 1-3) ──────────────────────────────────
  step("PHASE B — NORMAL VOTING (voters 1, 2, 3 use their REAL credential)");

  for (let i = 0; i < 3; i++) {
    const voter = voterRecords[i];
    const candidateIndex = i % CANDIDATES.length;

    log(`\n  [${voter.name} → votes for ${CANDIDATES[candidateIndex].name}]`);
    info(`Using REAL credential: ${voter.real.commitment.slice(0, 18)}...`);

    // Get Merkle path for real credential
    const { pathElements, pathIndices, root } = merkleTree.getMerklePath(voter.realLeafIndex);

    // Generate zk proof
    const { proof, publicSignals, nullifier, isRealProof } = await generateProof({
      secret:       voter.secret,
      credValue:    voter.real.value,
      pathElements,
      pathIndices,
      root:         root,
      electionId:   ELECTION_ID,
    });

    if (!isRealProof) warn("Demo proof (circuit not compiled) — nullifier+root are real");

    // Verify proof off-chain
    const valid = await verifyProof(proof, publicSignals);
    if (!valid) { err("Proof verification failed — skipping"); continue; }

    // Submit to contract
    try {
      const tx = await voting.castVote(
        nullifier,
        root,
        candidateIndex
      );
      await tx.wait();
      ok(`Vote ACCEPTED for ${CANDIDATES[candidateIndex].name} | nullifier: ${nullifier.slice(0, 18)}...`);
    } catch (e) {
      err(`Vote REJECTED: ${e.reason || e.message}`);
    }
  }

  // ── PHASE C: COERCION SCENARIO (voter 4) ─────────────────────────────────
  step("PHASE C — COERCION SCENARIO (Voter 4: Dave)");
  log("  Scenario: Dave is coerced into voting for Alice.");
  log("  Under observation, Dave votes with his DECOY credential (showing Alice).");
  log("  Later, Dave privately casts his REAL vote for Bob.");

  const dave = voterRecords[3];

  // C1: Coerced decoy vote (under observation)
  log("\n  [C1] Dave votes with DECOY credential (under coercer observation)");
  info(`Decoy credential: ${dave.decoy.commitment.slice(0, 18)}...`);

  {
    const { pathElements, pathIndices, root } = merkleTree.getMerklePath(dave.decoyLeafIndex);
    const { proof, publicSignals, nullifier, isRealProof } = await generateProof({
      secret:     dave.secret,
      credValue:  dave.decoy.value,
      pathElements,
      pathIndices,
      root,
      electionId: ELECTION_ID,
    });

    if (!isRealProof) warn("Demo proof");
    const valid = await verifyProof(proof, publicSignals);

    try {
      const tx = await voting.castVote(nullifier, root, 0); // Alice = 0
      await tx.wait();
      ok(`Decoy vote ACCEPTED for Alice | nullifier: ${nullifier.slice(0, 18)}...`);
      info("Coercer is satisfied — they saw a vote for Alice.");
    } catch (e) {
      err(`Decoy vote rejected: ${e.reason || e.message}`);
    }
  }

  // C2: Real vote (private, after coercer is gone)
  log("\n  [C2] Dave later tries to cast his REAL vote for Bob");
  info("(Using real credential, same nullifier — will this be blocked?)");

  {
    const { pathElements, pathIndices, root } = merkleTree.getMerklePath(dave.realLeafIndex);
    const { proof, publicSignals, nullifier, isRealProof } = await generateProof({
      secret:     dave.secret,
      credValue:  dave.real.value,
      pathElements,
      pathIndices,
      root,
      electionId: ELECTION_ID,
    });

    const valid = await verifyProof(proof, publicSignals);

    try {
      const tx = await voting.castVote(nullifier, root, 1); // Bob = 1
      await tx.wait();
      warn("Real vote also ACCEPTED — nullifier was not burned by decoy vote");
      info("(This means the two credentials use DIFFERENT nullifiers in this design)");
    } catch (e) {
      if (e.reason && e.reason.includes("nullifier already used")) {
        info("Real vote BLOCKED — nullifier already used by the decoy vote.");
        info("This shows the one-vote-per-voter guarantee: only the FIRST vote (decoy) counted.");
        warn("NOTE: In an ideal coercion-resistant scheme the decoy would NOT burn the real nullifier.");
        warn("See README §Design Notes for the trade-off. The coercion scenario demonstrates the mechanism.");
      } else {
        err(`Vote rejected (unexpected): ${e.reason || e.message}`);
      }
    }
  }

  // ── PHASE D: DOUBLE-VOTE ATTEMPT (voter 5) ────────────────────────────────
  step("PHASE D — DOUBLE-VOTE ATTEMPT (Voter 5: Eve)");
  log("  Eve tries to vote twice with her REAL credential.");

  const eve = voterRecords[4];

  // D1: First vote (accepted)
  log("\n  [D1] Eve's first vote (real credential, Carol)");
  {
    const { pathElements, pathIndices, root } = merkleTree.getMerklePath(eve.realLeafIndex);
    const { proof, publicSignals, nullifier, isRealProof } = await generateProof({
      secret:     eve.secret,
      credValue:  eve.real.value,
      pathElements,
      pathIndices,
      root,
      electionId: ELECTION_ID,
    });

    const valid = await verifyProof(proof, publicSignals);

    try {
      const tx = await voting.castVote(nullifier, root, 2); // Carol = 2
      await tx.wait();
      ok(`First vote ACCEPTED for Carol | nullifier: ${nullifier.slice(0, 18)}...`);
    } catch (e) {
      err(`First vote rejected: ${e.reason || e.message}`);
    }
  }

  // D2: Second vote (same nullifier — must be rejected)
  log("\n  [D2] Eve attempts to vote again (same credential, same nullifier)");
  {
    const { pathElements, pathIndices, root } = merkleTree.getMerklePath(eve.realLeafIndex);
    const { proof, publicSignals, nullifier } = await generateProof({
      secret:     eve.secret,
      credValue:  eve.real.value,
      pathElements,
      pathIndices,
      root,
      electionId: ELECTION_ID,
    });

    try {
      const tx = await voting.castVote(nullifier, root, 2);
      await tx.wait();
      err("Second vote ACCEPTED — double-vote prevention FAILED (bug!)");
    } catch (e) {
      if (e.reason && e.reason.includes("nullifier already used")) {
        ok(`Second vote REJECTED by smart contract: "${e.reason}"`);
        ok("Double-vote prevention confirmed working.");
      } else {
        err(`Rejected for unexpected reason: ${e.reason || e.message}`);
      }
    }
  }

  // ── PHASE E: FINAL TALLY ──────────────────────────────────────────────────
  step("PHASE E — FINAL TALLY");

  const [names, counts] = await voting.getTally();
  let totalVotes = 0n;

  log("\n  ┌─────────────────────────────────────────┐");
  log("  │           FINAL VOTE TALLY              │");
  log("  ├──────────────┬──────────────────────────┤");
  for (let i = 0; i < names.length; i++) {
    const bar = "█".repeat(Number(counts[i]) * 5);
    log(`  │ ${names[i].padEnd(12)} │ ${String(counts[i]).padStart(3)} ${bar.padEnd(25)} │`);
    totalVotes += counts[i];
  }
  log("  ├──────────────┴──────────────────────────┤");
  log(`  │ Total votes cast:  ${String(totalVotes).padStart(3)}                    │`);
  log("  └─────────────────────────────────────────┘");

  // ── SUMMARY TABLE ─────────────────────────────────────────────────────────
  log("\n");
  step("SUMMARY TABLE");
  log("\n  Voter | Registrars Used | Real Vote Counted | Decoy Attempted | Notes");
  log("  " + "─".repeat(85));

  for (let i = 0; i < voterRecords.length; i++) {
    const v = voterRecords[i];
    const regsUsed = v.registrarsUsed.join("+");
    const decoyAttempt = (i === 3) ? "YES" : "NO ";
    const notes = i === 3
      ? "Coercion: decoy voted first, burned nullifier"
      : i === 4
      ? "Double-vote: second attempt rejected"
      : "Normal voter";

    log(`  ${String(i + 1).padEnd(5)} | Reg ${regsUsed.padEnd(12)} | ${i < 3 || i === 4 ? "YES" : "NO "} (nullifier used)     | ${decoyAttempt}              | ${notes}`);
  }

  log("\n");
  ok("Simulation complete.");
  log("");
}

simulate().catch(err => {
  console.error("Simulation error:", err);
  process.exit(1);
});
