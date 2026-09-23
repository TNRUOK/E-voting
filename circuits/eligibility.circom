pragma circom 2.0.0;

/*
 * eligibility.circom — Anonymous Voter Eligibility Proof
 *
 * Proves that an anonymous registrant is an enrolled eligible voter whose commitment
 * exists in EligibilityRegistry.sol without revealing which voter or leaf they are.
 *
 * Public inputs:
 *   eligibilityRoot       — current Merkle root from EligibilityRegistry.sol
 *   registrationNullifier — Poseidon(enrollmentSecret, electionId, 1); contract stores used nullifiers
 *   electionId            — binds this eligibility claim to one specific election
 *
 * Private inputs:
 *   enrollmentSecret      — voter's private enrollment secret generated during enrollment
 *   pathElements[10]      — Merkle siblings
 *   pathIndices[10]       — Merkle path directions (0 for left, 1 for right)
 *
 * SINGLE-INPUT LEAF EXPLANATION:
 *   In membership.circom, the leaf is two-input: Poseidon(secret, credential), because
 *   voting separates the voter secret from the credential value to enable real vs. decoy
 *   coercion defense. For eligibility, there is no real/decoy distinction: an individual is
 *   simply eligible or not. Thus, the leaf is a single-input commitment: Poseidon(enrollmentSecret).
 *
 * DOMAIN SEPARATION EXPLANATION:
 *   The registration nullifier is computed as Poseidon(enrollmentSecret, electionId, 1),
 *   using the literal constant 1 as a domain separator. This guarantees that an eligibility
 *   nullifier can never collide with a voting nullifier Poseidon(secret, electionId).
 */

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

/*
 * MerklePathVerifier: verifies a Merkle path of depth D leads to `root` using Poseidon(2).
 */
template MerklePathVerifier(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input root;

    component hashers[depth];
    component mux[depth];

    signal levelHashes[depth + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== levelHashes[i];

        mux[i].s <== pathIndices[i];

        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    root === levelHashes[depth];
}

template Eligibility() {
    // ── Public inputs ───────────────────────────────────────────────────────
    signal input eligibilityRoot;
    signal input registrationNullifier;
    signal input electionId;

    // ── Private inputs ──────────────────────────────────────────────────────
    signal input enrollmentSecret;
    signal input pathElements[10];
    signal input pathIndices[10];

    // ── Step 1: Compute leaf = Poseidon(enrollmentSecret) ───────────────────
    // Single-input commitment: enrollmentSecret alone defines the eligible identity.
    component leafHasher = Poseidon(1);
    leafHasher.inputs[0] <== enrollmentSecret;
    signal leaf <== leafHasher.out;

    // ── Step 2: Verify Merkle path in EligibilityRegistry ───────────────────
    component merkle = MerklePathVerifier(10);
    merkle.leaf <== leaf;
    merkle.root <== eligibilityRoot;
    for (var i = 0; i < 10; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }

    // ── Step 3: Compute and enforce domain-separated registration nullifier ──
    // registrationNullifier === Poseidon(enrollmentSecret, electionId, 1)
    component nullHasher = Poseidon(3);
    nullHasher.inputs[0] <== enrollmentSecret;
    nullHasher.inputs[1] <== electionId;
    nullHasher.inputs[2] <== 1; // Domain separator

    registrationNullifier === nullHasher.out;
}

component main {public [eligibilityRoot, registrationNullifier, electionId]} = Eligibility();
