/**
 * shared.js — Shared backend utilities: provider, signer, contract instances.
 * Loaded once and reused across all route files.
 */
"use strict";

const { ethers } = require("ethers");
const path = require("path");
const fs   = require("fs");

function getDeployed() {
  const p = path.join(__dirname, "../../deployed.json");
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
      console.warn("Warning reading deployed.json:", e.message);
    }
  }
  return { candidates: [], electionId: "0" };
}

function getPublicKey() {
  const p = path.join(__dirname, "../../registrar-service/shares/public.json");
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
      console.warn("Warning reading public.json:", e.message);
    }
  }
  return { N: "0", e: "65537" };
}

const DEPLOYED = getDeployed();
const PUBLIC_KEY = getPublicKey();

const provider = new ethers.JsonRpcProvider("http://localhost:8545");

let _signer = null;
async function getSigner() {
  if (!_signer) _signer = await provider.getSigner(0);
  return _signer;
}

function loadAbi(name) {
  const p = path.join(__dirname, `../../artifacts/contracts/${name}.sol/${name}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Contract artifact for ${name} not found. Run npx hardhat compile first.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8")).abi;
}

function getRegistry(signer) {
  const dep = getDeployed();
  if (!dep.VoterRegistry) {
    throw new Error("VoterRegistry address not found in deployed.json. Run deploy first.");
  }
  return new ethers.Contract(dep.VoterRegistry, loadAbi("VoterRegistry"), signer || provider);
}

function getVoting(signer) {
  const dep = getDeployed();
  if (!dep.Voting) {
    throw new Error("Voting address not found in deployed.json. Run deploy first.");
  }
  return new ethers.Contract(dep.Voting, loadAbi("Voting"), signer || provider);
}

// In-memory registrar request counters (reset on server restart — by design)
const registrarCounters = { 1: 0, 2: 0, 3: 0 };
function incrementCounter(id) { registrarCounters[id] = (registrarCounters[id] || 0) + 1; }

// In-memory audit storage for Admin View & Decoy Visibility
const commitmentMeta = {}; // commitment.toLowerCase() -> { type: 'real'|'decoy', voterName, timestamp, secret, nullifier }
const auditVotes = [];     // Array of { id, type: 'real'|'decoy', voterName, candidate, candidateIndex, nullifier, commitment, txHash, timestamp, blockNumber }

module.exports = {
  get DEPLOYED() { return getDeployed(); },
  get PUBLIC_KEY() { return getPublicKey(); },
  provider,
  getSigner,
  getRegistry,
  getVoting,
  registrarCounters,
  incrementCounter,
  commitmentMeta,
  auditVotes,
  REGISTRAR_URLS: ["http://localhost:3001", "http://localhost:3002", "http://localhost:3003"],
};
