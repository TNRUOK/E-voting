# Sequence Diagram: (2,3)-Threshold Blind-Signature E-Voting System
*(Based on Tang et al. 2023 Extension)*

---

## 1. Complete System Sequence Diagram (Mermaid UML)

```mermaid
sequenceDiagram
    autonumber
    actor Voter as Voter (Client/Browser)
    participant Backend as Web Backend API (:3000)
    participant R1 as Registrar 1 (:3001, d1)
    participant R2 as Registrar 2 (:3002, d2)
    participant Registry as VoterRegistry Contract
    participant Voting as Voting Contract

    Note over Voter: PHASE 1: CREDENTIAL CREATION & BLINDING
    Voter->>Voter: Generate secret (s) & credentials (c_real, c_decoy)
    Voter->>Voter: C_real = Poseidon(s, c_real)<br/>C_decoy = Poseidon(s, c_decoy)
    Voter->>Voter: Pick random blinding factor (r)
    Voter->>Voter: Blind: m' = C * r^e mod N

    Note over Voter,Backend: PHASE 2: (2,3)-THRESHOLD BLIND SIGNING
    Voter->>Backend: POST /api/voters/register { voterName }
    Note right of Backend: Select 2 of 3 Registrars (Round-Robin)<br/>e.g., Contact R1 & R2, Skip R3
    
    par Request Partial Signature 1
        Backend->>R1: POST /sign { blindedMessage: m' }
        R1->>R1: s1 = (m')^d1 mod N
        R1-->>Backend: Return partial signature (s1, shareValue d1)
    and Request Partial Signature 2
        Backend->>R2: POST /sign { blindedMessage: m' }
        R2->>R2: s2 = (m')^d2 mod N
        R2-->>Backend: Return partial signature (s2, shareValue d2)
    end

    Note over Backend: PHASE 3: COMBINE, UNBLIND & ON-CHAIN INSERTION
    Backend->>Backend: Lagrange Interpolation: Combine s1 & s2 -> s'
    Backend->>Backend: Unblind: s = s' * r^-1 mod N (Valid RSA sig over C)
    
    Backend->>Registry: insertLeaf(C_real), insertLeaf(C_decoy)
    Registry->>Registry: Update Incremental Merkle Tree (Depth 10)
    Registry-->>Backend: Emit LeafAdded (new Merkle Root)
    Backend-->>Voter: Return { real, decoy, secret, nullifier }

    Note over Voter,Voting: PHASE 4: ANONYMOUS BALLOT CASTING VIA zk-SNARK
    Voter->>Voter: Select Candidate & Choose Credential (Real / Decoy)
    Voter->>Voter: Fetch Merkle Path for selected commitment
    Voter->>Voter: Derive Nullifier = Poseidon(s, electionId)
    Voter->>Voter: Generate Groth16 zk-Proof (proof π, publicSignals)
    
    Voter->>Backend: POST /api/votes/cast { candidateId, proof, nullifier }
    Backend->>Voting: castVote(candidateIndex, nullifier, proof, currentRoot)
    
    alt Nullifier not used
        Voting->>Registry: Verify Merkle Root is fresh
        Voting->>Voting: Verify zk-SNARK proof π
        Voting->>Voting: nullifierUsed[nullifier] = true
        Voting->>Voting: candidateVotes[candidateIndex] += 1
        Voting-->>Backend: Emit VoteCast(nullifier, candidateIndex)
        Backend-->>Voter: 200 OK: Ballot Cast Successfully!
    else Nullifier already used (Double-Vote / Replay Attack)
        Voting-->>Backend: Revert: "Voting: nullifier already used"
        Backend-->>Voter: 400 Bad Request: Double-Vote Rejected
    end
```

---

## 2. PlantUML Source Code (For StarUML Import / PlantText)

You can copy and paste this code directly into **StarUML** (with the PlantUML plugin installed) or into [PlantText.com](https://www.planttext.com) / [PlantUML Editor](https://www.plantuml.com/plantuml/uml):

```plantuml
@startuml
skinparam handwritten false
skinparam monochrome false
skinparam shadowing true
skinparam BoxPadding 10
skinparam ParticipantPadding 10

title Sequence Diagram: Distributed (2,3)-Threshold Blind-Signature E-Voting System

actor "Voter (Browser/Client)" as Voter #LightSkyBlue
boundary "Web Backend API\n(Port 3000)" as Backend #Plum
control "Registrar 1\n(Port 3001, d1)" as R1 #LightGreen
control "Registrar 2\n(Port 3002, d2)" as R2 #LightGreen
database "VoterRegistry.sol\n(Smart Contract)" as Registry #Gold
database "Voting.sol\n(Smart Contract)" as Voting #Gold

== Phase 1: Credential Generation & Blinding ==
Voter -> Voter: 1. Generate master secret (s)
Voter -> Voter: 2. Generate c_real and c_decoy
Voter -> Voter: 3. Compute Commitments:\nC_real = Poseidon(s, c_real)\nC_decoy = Poseidon(s, c_decoy)
Voter -> Voter: 4. Select random blinding factor (r)
Voter -> Voter: 5. Blind Commitment:\nm' = C * r^e (mod N)

== Phase 2: Distributed (2,3)-Threshold Blind RSA Signing ==
Voter -> Backend: 6. POST /api/voters/register { voterName }
note over Backend: Selects 2 of 3 Registrars via rotation\n(e.g., R1 + R2, R3 skipped)

par Request Partial Signatures
    Backend -> R1: 7a. POST /sign { blindedMessage: m' }
    activate R1
    R1 -> R1: Compute partial signature:\ns1 = (m')^d1 (mod N)
    R1 --> Backend: 8a. Return { partialSig: s1, shareValue: d1 }
    deactivate R1
else
    Backend -> R2: 7b. POST /sign { blindedMessage: m' }
    activate R2
    R2 -> R2: Compute partial signature:\ns2 = (m')^d2 (mod N)
    R2 --> Backend: 8b. Return { partialSig: s2, shareValue: d2 }
    deactivate R2
end

== Phase 3: Lagrange Combination, Unblinding & On-Chain Registration ==
Backend -> Backend: 9. Combine partials using Lagrange Interpolation:\ns' = combine(s1, s2)
Backend -> Backend: 10. Unblind Signature:\ns = s' * r^-1 (mod N)\n(Verifiable RSA signature over C)
Backend -> Registry: 11. insertLeaf(C_real), insertLeaf(C_decoy)
activate Registry
Registry -> Registry: 12. Insert leaves into Depth-10 Merkle Tree
Registry -> Registry: 13. Update on-chain Merkle Root
Registry --> Backend: 14. Event: LeafAdded(index, commitment, newRoot)
deactivate Registry
Backend --> Voter: 15. Return { real, decoy, secret, nullifier }

== Phase 4: Anonymous Ballot Casting via zk-SNARK ==
Voter -> Voter: 16. Select Candidate (e.g., Candidate #1)
Voter -> Voter: 17. Choose Credential (Real or Decoy)
Voter -> Voter: 18. Compute Nullifier = Poseidon(s, electionId)
Voter -> Voter: 19. Retrieve Merkle proof path for commitment leaf
Voter -> Voter: 20. Generate Groth16 zk-SNARK proof (π)\n[Proves leaf in Merkle Tree without revealing which leaf]
Voter -> Backend: 21. POST /api/votes/cast { candidateId, proof, nullifier }

Backend -> Voting: 22. castVote(candidateIndex, nullifier, proof, root)
activate Voting

alt Valid Vote (Nullifier has NOT been used)
    Voting -> Registry: 23. Query Merkle Root validity
    Registry --> Voting: 24. Return valid root
    Voting -> Voting: 25. Check zk-SNARK proof validity
    Voting -> Voting: 26. Store nullifierUsed[nullifier] = true
    Voting -> Voting: 27. Increment candidate vote count
    Voting --> Backend: 28. Event: VoteCast(nullifier, candidateIndex)
    Backend --> Voter: 29. 200 OK: Vote Confirmed & Receipt
else Double-Vote Attempt (Nullifier ALREADY used)
    Voting --> Backend: 30. Revert: "Voting: nullifier already used"
    deactivate Voting
    Backend --> Voter: 31. 400 Bad Request: Duplicate Vote Rejected
end

@enduml
```

---

## 3. How to Draw / Present This in StarUML (Step-by-Step for Presentation)

If you are using **StarUML** on your computer to present to your teacher:

### Step 1: Create a Sequence Diagram in StarUML
1. Open StarUML.
2. In the Model Explorer (top right), right-click `Model` -> **Add Diagram** -> **Sequence Diagram**.
3. Name it: `Distributed (2,3)-Threshold E-Voting Sequence`.

### Step 2: Add the 6 Lifelines (Left to Right)
From the left toolbox, drag the following elements onto the canvas:

| # | Element Type in StarUML | Name / Label | Stereotype / Role |
|---|---|---|---|
| 1 | **Actor** | `Voter` | Voter Client / Browser |
| 2 | **Lifeline** | `WebBackend` | Express API Gateway (`:3000`) |
| 3 | **Lifeline** | `Registrar_1` | Key Share $d_1$ (`:3001`) |
| 4 | **Lifeline** | `Registrar_2` | Key Share $d_2$ (`:3002`) |
| 5 | **Lifeline** | `VoterRegistry` | Smart Contract (`VoterRegistry.sol`) |
| 6 | **Lifeline** | `Voting` | Smart Contract (`Voting.sol`) |

### Step 3: Add the Combined Fragments (Boxes)
In StarUML, use **Combined Fragment** from the palette:
1. **Parallel Box (`par`)**:
   - Wrap the partial signature requests to `Registrar_1` and `Registrar_2` to show they happen concurrently.
2. **Alternative Box (`alt`)**:
   - Wrap the ballot verification section at the bottom.
   - Top operand: `[Nullifier Not Used]` -> Normal successful vote casting.
   - Bottom operand: `[Nullifier Already Used]` -> Revert / Rejection of double voting.

---

## 4. Key Talking Points for Your Professor

When explaining this diagram to your teacher, emphasize these 4 points:

1. **Why Blind Signatures? (Messages 1–5):**
   "The voter generates their credential locally and blinds it ($m' = C \cdot r^e \pmod N$). When sending it to the registrars, the registrars only see random numbers. They **cannot** see the voter's identity or credential."

2. **Why 2-of-3 Threshold? (Messages 6–10):**
   "Instead of trusting one central server like in the Tang et al. paper, the private key $d$ is split among 3 registrars using Shamir's Secret Sharing. Any 2 registrars compute partial signatures ($s_i = (m')^{d_i} \pmod N$). The client combines them via Lagrange interpolation. No single registrar ever has the master key."

3. **Why Dual Credentials? (Real vs. Decoy):**
   "Both a Real commitment and a Decoy commitment are inserted as leaves into the on-chain Merkle tree in `VoterRegistry.sol`. To an observer or coercer, both look identical."

4. **Why zk-SNARK + Nullifier? (Messages 16–31):**
   "When voting, the voter proves in zero-knowledge that their commitment is inside the Merkle tree without revealing which leaf is theirs. The deterministic nullifier $\text{Poseidon}(s, \text{electionId})$ ensures each voter can only cast **one ballot**; if they attempt to vote again, the blockchain rejects it with an on-chain revert."
