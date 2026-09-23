# Threshold Blind-Signature Credential Issuance for Anonymous E-Voting

> **Extension of Tang, Yang, Tian & Yuan (2023)** — *"Distributed Anonymous e-Voting Method Based on Smart Contract Authentication"* (Electronics/MDPI).

---

## 1. Executive Summary & Research Gap

In the base paper by **Tang et al. (2023)**, voters obtain anonymous voting credentials that are committed into an on-chain Merkle tree. Anonymity during the voting phase is preserved via **Groth16 zk-SNARKs** (proving knowledge of a valid credential and secret in the Merkle tree without revealing which leaf belongs to the voter) alongside a **nullifier scheme** to prevent double-voting. To resist voter coercion, each voter receives both a **Real** credential and a **Decoy (Fake)** credential.

### The Critical Vulnerability in the Base Paper
In Tang et al., all credentials (both real and decoy) are generated and issued by a **single trusted registrar**. 
This introduces a catastrophic single point of trust:
1. **Deanonymization:** A compromised or coerced registrar knows exactly which credential is real and which is decoy for every registered voter.
2. **Coercion Failure:** If an adversary bribes or legally compels the single registrar to disclose voter records, the voter cannot safely provide a decoy credential to deceive the coercer.

### The Novel Contribution
This project replaces the single centralized registrar with a **(2,3)-Threshold RSA Blind-Signature Scheme** based on Shoup's construction.
- **Blind Signatures:** The voter computes their credential commitment $C = \text{Poseidon}(s, c)$, blinds it with a secret blinding factor $r$ ($m' = C \cdot r^e \pmod N$), and transmits only the blinded message to registrars.
- **Threshold Key Shares:** The RSA private key $d$ is split into 3 shares ($d_1, d_2, d_3$) across 3 independent registrar services using **Shamir's Secret Sharing (SSS)** with threshold $t=2$.
- **Distributed Signing without Key Reconstruction:** Any 2 of the 3 registrars provide partial signatures on the blinded commitment. The voter combines these partial signatures using **Lagrange interpolation** and unblinds the result to obtain a valid RSA signature under the master election public key.
- **No Single Point of Compromise:** No registrar ever learns the voter's credential, secret, or commitment plaintext, nor can any single compromised registrar distinguish between real and decoy credentials.

---

## 2. System Architecture

```
                                  [ Voter Client ]
                                         │
               ┌─────────────────────────┴─────────────────────────┐
               ▼                                                   ▼
     1. Blind Commitment                                 5. Generate zk-SNARK
     m' = Poseidon(s, c) · r^e mod N                     Prove leaf ∈ Merkle Tree
               │                                         Nullifier = Poseidon(s, electionId)
         ┌─────┴─────┐                                             │
         │ (Any 2/3) │                                             │
         ▼           ▼                                             ▼
  [Registrar 1]  [Registrar 2]  [Registrar 3]              [ Smart Contracts ]
    (Share d1)     (Share d2)     (Share d3)            ┌───────────────────────┐
         │           │                                  │  VoterRegistry.sol    │
         └─────┬─────┘                                  │  - Depth 10 Merkle    │
               ▼                                        │  - Commitment Leaves  │
     2. Partial Signatures                              └──────────┬────────────┘
     3. Lagrange Combine                                           │
     4. Unblind: s = s' · r^-1 mod N                               ▼
               │                                        ┌───────────────────────┐
               └─────── Add Commitment Leaf ───────────►│  Voting.sol           │
                                                        │  - Nullifier Check    │
                                                        │  - Double-Vote Revert │
                                                        │  - Live Candidate Tally
                                                        └───────────────────────┘
```

---

## 3. Project Structure

```
├── config/
│   └── candidates.json          # Election candidates configuration
├── contracts/
│   ├── VoterRegistry.sol        # On-chain incremental Poseidon Merkle Tree (depth 10)
│   └── Voting.sol               # Ballot casting, nullifier deduplication, live tally
├── circuits/
│   └── membership.circom        # Circom zk-SNARK membership circuit
├── registrar-service/
│   ├── crypto/
│   │   ├── shamir.js            # Hand-rolled Shamir SSS over GF(p)
│   │   ├── rsa-blind.js         # RSA blind signature primitives (BigInt)
│   │   └── threshold-combine.js # Shoup (2,3) threshold combination & Lagrange interpolation
│   ├── keygen.js                # Splits 2048-bit RSA key into 3 registrar shares
│   └── registrar.js             # Express microservice exposing POST /sign and GET /status
├── voter-client/
│   ├── credential.js            # Dual credential generation & Poseidon nullifiers
│   ├── merkle.js                # Incremental Merkle tree & proof generator
│   ├── zkprove.js               # Zero-knowledge proof orchestration
│   └── register.js              # 2-of-3 blind signature registration orchestrator
├── simulation/
│   └── simulate.js              # 5-voter end-to-end automated test runner
├── web/
│   ├── backend/
│   │   ├── server.js            # Express API gateway
│   │   └── routes/              # voters, votes, tally, registrars, merkle, candidates, simulation
│   └── frontend/
│       ├── index.html           # HTML entry point with Inter font
│       ├── vite.config.js       # Vite build configuration (proxies /api to :3000)
│       └── src/
│           ├── index.css        # Premium dark glassmorphism design system
│           ├── App.jsx          # Main routing & application shell
│           ├── components/      # Navbar, health indicators
│           └── pages/
│               ├── Landing.jsx  # Candidate slate, add candidate, protocol breakdown
│               ├── Register.jsx # Interactive 2-of-3 blind signature registration
│               ├── Vote.jsx     # Ballot casting with real/decoy selection & zk proofs
│               ├── Dashboard.jsx# Live vote tally chart, Merkle state, registrar nodes
│               └── Simulation.jsx # Live SSE terminal log stream for 5-voter test
├── test/
│   ├── threshold.test.js        # Unit tests for Shamir SSS, blind RSA, threshold combine
│   ├── circuit.test.js          # Tests for Poseidon nullifiers, Merkle membership proofs
│   └── contracts.test.js        # Hardhat tests for smart contracts & double-vote prevention
├── hardhat.config.js            # Hardhat local network config
└── package.json                 # Root workspace orchestrator
```

---

## 4. Customizing Election Candidates

You can easily configure candidates yourself:
1. **Via UI:** Navigate to the **Candidates & Overview** page and click **"Add Candidate"** to add a new candidate with custom tagline and color in real time.
2. **Via Config File:** Edit `config/candidates.json`:
   ```json
   [
     { "id": 1, "name": "Alice",  "tagline": "Transparency for a Better Future",  "color": "#7C3AED" },
     { "id": 2, "name": "Bob",    "tagline": "Security, Stability, Progress",      "color": "#06B6D4" },
     { "id": 3, "name": "Carol",  "tagline": "Innovation and Inclusion",          "color": "#10B981" }
   ]
   ```
   Re-running `npm run deploy` will deploy a new election with your candidate slate.

---

## 5. Port Assignments

| Component | Port | Description |
|---|---|---|
| Hardhat Node | `8545` | Local Ethereum blockchain node |
| Registrar 1 | `3001` | Microservice holding share $d_1$ |
| Registrar 2 | `3002` | Microservice holding share $d_2$ |
| Registrar 3 | `3003` | Microservice holding share $d_3$ |
| Web Backend API | `3000` | Express API orchestrator & contract signer |
| Web Frontend | `5173` | React + Vite UI |

---

## 6. Quickstart Guide

### Prerequisites
- Node.js (v20+ recommended)
- npm

### Step 1: Install Dependencies
From the repository root:
```bash
npm install
```

### Step 2: Initialize Keys & Smart Contracts
```bash
# 1. Generate 2048-bit RSA threshold keys and split into 3 registrar shares:
npm run keygen

# 2. Compile Solidity contracts:
npm run compile
```

### Step 3: Launch Local Blockchain Node & Deploy
In Terminal 1:
```bash
npm run node:start
```

In Terminal 2:
```bash
npm run deploy
```
*(This writes deployed contract addresses into `deployed.json`)*

### Step 4: Start the 3 Registrar Services
In separate terminals (or background jobs):
```bash
npm run reg1   # Runs Registrar 1 on port 3001 with share 1
npm run reg2   # Runs Registrar 2 on port 3002 with share 2
npm run reg3   # Runs Registrar 3 on port 3003 with share 3
```

### Step 5: Start Web Backend & Frontend
In Terminal 6:
```bash
npm run backend
```

In Terminal 7:
```bash
npm run frontend
```
Visit **`http://localhost:5173`** in your browser!

---

## 7. Running the Automated Simulation

The project includes a 5-voter end-to-end verification script (`simulation/simulate.js`):
```bash
npm run simulate
```
This tests:
- **Voters 1-3:** Normal registration rotating registrar pairs (R1+R2, R2+R3, R1+R3) and successful real voting.
- **Voter 4 (Coercion Scenario):** Casts decoy vote to satisfy coercer, followed by their true vote with the real credential.
- **Voter 5 (Double-Vote Attack):** Attempts to submit the same credential a second time; rejected on-chain with revert `"Voting: nullifier already used"`.

You can also run this simulation live with real-time SSE streaming terminal output directly inside the Web UI at **`http://localhost:5173/simulation`**.

---

## 8. Running the Test Suite

Run the full automated test suite:
```bash
# Run all tests
npm test

# Run individual suites
npm run test:threshold  # Shamir SSS, blind RSA, partial signing
npm run test:circuit    # Merkle tree proofs, Poseidon nullifiers
npm run test:contracts  # VoterRegistry and Voting smart contract tests
```

---

## 9. Academic Scope & Documented Simplifications

As an academic course project demonstrating threshold cryptography and zero-knowledge voting, the following design simplifications are explicitly documented:
1. **Standard 2048-bit RSA:** Shoup's theoretical security proof relies on safe primes ($p = 2p'+1$, $q = 2q'+1$). Standard RSA primes are used here to avoid long keygen delays during local live demonstrations.
2. **Local Multi-Process Architecture:** In a production municipal election, the 3 registrars would run on physically distinct servers operated by independent non-colluding institutions. Here they are simulated as independent node processes on separate ports.
3. **Off-Chain Groth16 Pre-Verification:** The backend pre-verifies the zk-SNARK proof before relaying to `Voting.sol`. The smart contract strictly enforces nullifier deduplication and Merkle root freshness on-chain, preventing double-voting and replay attacks at the consensus layer.

---

## 10. Security Enhancements (Beyond Base Paper)

The following three security properties were implemented as structured improvements to close identified attack vectors:

### (a) Anonymous Eligibility Gate — GAP 1
**Problem:** Anyone could call `POST /api/voters/register` unlimited times to mint unlimited voting credentials.  
**Fix:** A new `EligibilityRegistry.sol` (depth-10 incremental Merkle tree) stores one-time enrollment commitments issued by an administrator after identity verification. Before the threshold blind-signing flow begins, the voter client must call `POST /api/eligibility/claim` with a zero-knowledge proof (`eligibility.circom`) that they know an enrollment secret committed in the tree.  
A **domain-separated nullifier** `Poseidon(enrollmentSecret, electionId, 1)` is recorded on-chain by `EligibilityRegistry.claimEligibility()` to prevent the same eligible voter from claiming eligibility more than once.  
*Simplification:* For demonstration purposes the enrollment secret is generated server-side and returned once to the client; in production it would be generated and blinded client-side alongside a KYC credential.

### (b) On-Chain RSA Signature Verification — GAP 2
**Problem:** `VoterRegistry.addLeaf()` used `onlyOwner` — anyone holding the backend deploy key could insert arbitrary commitments, bypassing registrars entirely.  
**Fix:** The `onlyOwner` guard was replaced with **EVM MODEXP precompile verification** (address `0x05`, EIP-198). `addLeaf(bytes32 commitment, bytes calldata signature)` now verifies on-chain that `signature^e mod N == sha256(abi.encodePacked(commitment))`, proving the commitment passed through the 2-of-3 threshold blind-signing flow. The RSA public key `(N, e)` is stored immutably in the contract at deploy time.  
A companion hash compatibility test (`test/hash-compat.test.js`) asserts byte-level equivalence between the JS `hashToInt()` and Solidity's `sha256(abi.encodePacked(...))`.

### (c) Registrar API Key Gate — GAP 3
**Problem:** The registrar `POST /sign` endpoints were entirely unauthenticated — any process could obtain partial RSA signatures by hitting the registrar ports directly.  
**Fix:** Each registrar now validates a shared secret header `x-registrar-key` against `process.env.REGISTRAR_API_KEY` (default: `dev_registrar_secret_key_123`). Requests missing the header or supplying the wrong key receive `HTTP 401`. The voter client (`voter-client/register.js`) and backend (`web/backend/routes/voters.js`) pass this key on every signing request.  
*Simplification:* A shared symmetric secret is a lightweight stand-in for mutual TLS client certificates which would be used in a production deployment.
