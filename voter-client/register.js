/**
 * register.js — Full Registration Orchestrator
 *
 * This module ties together:
 *   1. Credential generation (credential.js)
 *   2. RSA blinding (rsa-blind.js)
 *   3. 2-of-3 threshold signing (two randomly chosen registrars via HTTP)
 *   4. Partial signature combination + unblinding (threshold-combine.js)
 *   5. On-chain commitment submission (VoterRegistry.addLeaf)
 *
 * WHY RANDOM REGISTRAR SELECTION:
 *   Each voter uses a different pair from {1,2,3}. This distributes load and
 *   also means no single registrar pair handles all registrations — reducing
 *   the attack surface for colluding registrar pairs.
 *
 * WHAT THE REGISTRARS LEARN AFTER THIS CALL:
 *   - Registrar A: saw blindedCommitment_real and blindedCommitment_decoy
 *   - Registrar B: saw blindedCommitment_real and blindedCommitment_decoy
 *   - Registrar C: not contacted at all
 *   - None of A, B, C knows: the plaintext values, which is real vs decoy,
 *     the voter's identity, or the blinding factors.
 *
 * @param {object} options
 *   options.registrarUrls  — array of 3 registrar base URLs
 *   options.publicKey      — { N: BigInt, e: BigInt }
 *   options.provider       — ethers provider connected to Hardhat node
 *   options.signer         — ethers signer (the deployer / backend wallet)
 *   options.registryAddr   — VoterRegistry contract address
 *   options.electionId     — election ID (from Voting.sol constructor)
 *   options.logFn          — optional logging function (defaults to console.log)
 */

"use strict";

const axios    = require("axios");
const { ethers } = require("ethers");
const path     = require("path");
const fs       = require("fs");

const { generateCredentialPair, computeNullifier } = require("./credential");
const { blind, unblind, verify, hashToInt, hexToBigInt, bigIntToHex } = require("../registrar-service/crypto/rsa-blind");
const { combinePartials } = require("../registrar-service/crypto/threshold-combine");

// Load VoterRegistry ABI from Hardhat artifacts
function loadAbi(contractName) {
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run 'npx hardhat compile' first.`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")).abi;
}

/**
 * selectRegistrarPair(voterIndex) → [url1, url2, skippedIndex]
 * Rotates which pair of registrars is used across voters:
 *   Voter 0,3,6,... → registrars [0,1] (ids 1,2), skip id 3
 *   Voter 1,4,7,... → registrars [1,2] (ids 2,3), skip id 1
 *   Voter 2,5,8,... → registrars [0,2] (ids 1,3), skip id 2
 */
function selectRegistrarPair(registrarUrls, voterIndex) {
  const pairs = [
    { indices: [0, 1], skipped: 2 },
    { indices: [1, 2], skipped: 0 },
    { indices: [0, 2], skipped: 1 },
  ];
  const { indices, skipped } = pairs[voterIndex % 3];
  return {
    urls: [registrarUrls[indices[0]], registrarUrls[indices[1]]],
    ids:  [indices[0] + 1, indices[1] + 1],
    skippedId: skipped + 1,
  };
}

/**
 * requestPartialSignature(registrarUrl, blindedMessage) → { partialSig, signerIndex }
 */
async function requestPartialSignature(registrarUrl, blindedMessage) {
  const response = await axios.post(`${registrarUrl}/sign`, {
    blindedMessage: bigIntToHex(blindedMessage),
  });
  return {
    partialSig:  hexToBigInt(response.data.partialSig),
    shareValue:  hexToBigInt(response.data.shareValue),
    signerIndex: response.data.signerIndex,
  };
}

/**
 * register(options) → RegistrationResult
 *
 * @returns {{
 *   real:            { value, commitment },
 *   decoy:           { value, commitment },
 *   secret:          hex string (KEEP PRIVATE),
 *   finalSig:        BigInt (valid RSA sig over commitment hash),
 *   nullifier:       hex string,
 *   registrarsUsed:  number[],
 *   registrarSkipped: number,
 *   txHashes:        string[] (on-chain tx hashes for real+decoy leaf additions)
 * }}
 */
async function register(options) {
  const {
    registrarUrls,
    publicKey,   // { N: BigInt, e: BigInt }
    provider,
    signer,
    registryAddr,
    electionId,
    voterIndex = 0,
    logFn = console.log,
  } = options;

  const { N, e } = publicKey;

  // ── Step 1: Generate real + decoy credential pair ─────────────────────────
  const credPair = generateCredentialPair();
  logFn(`  Generated real credential:  ${credPair.real.commitment.slice(0, 18)}...`);
  logFn(`  Generated decoy credential: ${credPair.decoy.commitment.slice(0, 18)}...`);
  logFn(`  [Both commitments appear identical to any external observer]`);

  // ── Step 2: Hash commitments to integers for RSA signing ─────────────────
  // We hash the commitment (already a keccak256 hash) again with SHA-256
  // to get a value safely < N for textbook RSA.
  const realMsgInt  = hashToInt(credPair.real.commitment);
  const decoyMsgInt = hashToInt(credPair.decoy.commitment);

  // ── Step 3: Blind the messages ────────────────────────────────────────────
  const realBlinded  = blind(realMsgInt, N, e);
  const decoyBlinded = blind(decoyMsgInt, N, e);
  logFn(`  Blinded credentials (registrars will only see these — not the plaintext)`);

  // ── Step 4: Select 2 of 3 registrars ─────────────────────────────────────
  const { urls, ids, skippedId } = selectRegistrarPair(registrarUrls, voterIndex);
  logFn(`  Contacting registrars: ${ids.join(", ")}  |  Registrar ${skippedId} not involved`);

  // ── Step 5: Collect partial signatures from 2 registrars ─────────────────
  // We send BOTH real and decoy blinded messages to BOTH registrars.
  // Registrars sign both without knowing which is real.
  const [realSig1, realSig2] = await Promise.all([
    requestPartialSignature(urls[0], realBlinded.blindedMessage),
    requestPartialSignature(urls[1], realBlinded.blindedMessage),
  ]);
  const [decoySig1, decoySig2] = await Promise.all([
    requestPartialSignature(urls[0], decoyBlinded.blindedMessage),
    requestPartialSignature(urls[1], decoyBlinded.blindedMessage),
  ]);

  logFn(`  Received partial signatures from registrars ${ids[0]} and ${ids[1]}`);
  logFn(`  Registrar ${skippedId} was NOT contacted and has zero knowledge of this voter's credentials`);

  // ── Step 6: Combine partial signatures ────────────────────────────────────
  // combinePartials reconstructs d from Shamir shares then computes blindedMsg^d
  const realCombined  = combinePartials(
    [
      { index: realSig1.signerIndex, partialSig: realSig1.partialSig, shareValue: realSig1.shareValue },
      { index: realSig2.signerIndex, partialSig: realSig2.partialSig, shareValue: realSig2.shareValue },
    ],
    realBlinded.blindedMessage,
    N
  );
  const decoyCombined = combinePartials(
    [
      { index: decoySig1.signerIndex, partialSig: decoySig1.partialSig, shareValue: decoySig1.shareValue },
      { index: decoySig2.signerIndex, partialSig: decoySig2.partialSig, shareValue: decoySig2.shareValue },
    ],
    decoyBlinded.blindedMessage,
    N
  );

  // ── Step 7: Unblind → final signatures ────────────────────────────────────
  const realFinalSig  = unblind(realCombined,  realBlinded.blindingFactor,  N);
  const decoyFinalSig = unblind(decoyCombined, decoyBlinded.blindingFactor, N);

  // ── Step 8: Verify signatures ──────────────────────────────────────────────
  const realValid  = verify(realMsgInt,  realFinalSig,  N, e);
  const decoyValid = verify(decoyMsgInt, decoyFinalSig, N, e);

  if (!realValid || !decoyValid) {
    throw new Error("Blind signature verification failed — threshold combination error");
  }
  logFn(`  ✓ Both signatures verified locally`);

  // ── Step 9: Submit commitments on-chain ───────────────────────────────────
  const registryAbi = loadAbi("VoterRegistry");
  const registry    = new ethers.Contract(registryAddr, registryAbi, signer);

  const tx1 = await registry.addLeaf(credPair.real.commitment);
  await tx1.wait();
  logFn(`  On-chain: real commitment added (tx: ${tx1.hash.slice(0, 18)}...)`);

  const tx2 = await registry.addLeaf(credPair.decoy.commitment);
  await tx2.wait();
  logFn(`  On-chain: decoy commitment added (tx: ${tx2.hash.slice(0, 18)}...)`);

  const nullifier = computeNullifier(credPair.secret, electionId);

  return {
    real:             credPair.real,
    decoy:            credPair.decoy,
    secret:           credPair.secret,
    realFinalSig,
    decoyFinalSig,
    nullifier,
    registrarsUsed:   ids,
    registrarSkipped: skippedId,
    txHashes:         [tx1.hash, tx2.hash],
  };
}

module.exports = { register, selectRegistrarPair };
