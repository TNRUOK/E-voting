pragma circom 2.0.0;

/*
 * membership.circom — Anonymous E-Voting Membership Proof
 *
 * Mirrors the base paper (Tang et al. 2023) membership-proof structure:
 *   - Merkle tree of depth 10 (max 1024 voters), leaves are Poseidon hashes
 *   - Nullifier derived from voter secret + election ID prevents double-voting
 *     without linking the nullifier to any leaf index
 *
 * Public inputs (known to the verifier / smart contract):
 *   root     — current Merkle root from VoterRegistry.sol
 *   nullifier — H(secret, electionId); contract stores used nullifiers
 *   electionId — fixes this proof to one election (prevents cross-election replay)
 *
 * Private inputs (never revealed):
 *   secret          — voter's private scalar (generated client-side)
 *   credential      — the credential value (real or decoy — circuit doesn't care)
 *   pathElements[10] — sibling hashes along the Merkle path
 *   pathIndices[10]  — 0/1 bits indicating left/right at each level
 *
 * WHY THIS PRESERVES ANONYMITY:
 *   The circuit proves "H(secret, credential) is a leaf in the tree at SOME
 *   position" without revealing which position.  The nullifier H(secret, electionId)
 *   is unlinkable to the leaf (different hash preimage) so even if two nullifiers
 *   from the same voter were observed, they cannot be tied together without secret.
 *
 * COERCION RESISTANCE (base paper, preserved here):
 *   Both real and decoy credentials are committed in the same Merkle tree.
 *   An adversary seeing any valid proof and nullifier cannot determine whether
 *   the credential used was real or decoy — they are cryptographically identical
 *   from the verifier's perspective.
 */

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

/*
 * MerklePathVerifier: given a leaf value and a Merkle path of depth D,
 * verify the path leads to `root`. Uses Poseidon for hashing (fewest
 * constraints of all circomlib hash options, standard in modern ZK systems).
 */
template MerklePathVerifier(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input root;

    // Running hash up the tree
    component hashers[depth];
    component mux[depth];

    signal levelHashes[depth + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // pathIndices[i] = 0 → current node is LEFT child
        // pathIndices[i] = 1 → current node is RIGHT child
        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);

        mux[i].c[0][0] <== levelHashes[i];      // left if idx=0
        mux[i].c[0][1] <== pathElements[i];      // left if idx=1 (sibling)
        mux[i].c[1][0] <== pathElements[i];      // right if idx=0
        mux[i].c[1][1] <== levelHashes[i];       // right if idx=1

        mux[i].s <== pathIndices[i];

        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        levelHashes[i + 1] <== hashers[i].out;
    }

    // Enforce that the computed root matches the public root
    root === levelHashes[depth];
}

template Membership() {
    // ── Public inputs ───────────────────────────────────────────────────────
    signal input root;
    signal input nullifier;
    signal input electionId;

    // ── Private inputs ──────────────────────────────────────────────────────
    signal input secret;
    signal input credential;
    signal input pathElements[10];
    signal input pathIndices[10];

    // ── Step 1: Compute leaf = Poseidon(secret, credential) ─────────────────
    // This is the commitment that was submitted to VoterRegistry.sol during
    // registration.  We verify the prover knows the preimage.
    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== secret;
    leafHasher.inputs[1] <== credential;
    signal leaf <== leafHasher.out;

    // ── Step 2: Verify Merkle path ──────────────────────────────────────────
    component merkle = MerklePathVerifier(10);
    merkle.leaf <== leaf;
    merkle.root <== root;
    for (var i = 0; i < 10; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }

    // ── Step 3: Derive and constrain nullifier ──────────────────────────────
    // nullifier = Poseidon(secret, electionId)
    // The secret links this nullifier to the voter without revealing the leaf.
    // The electionId prevents the same proof being replayed in a different election.
    component nullHasher = Poseidon(2);
    nullHasher.inputs[0] <== secret;
    nullHasher.inputs[1] <== electionId;

    nullifier === nullHasher.out;
}

component main {public [root, nullifier, electionId]} = Membership();
