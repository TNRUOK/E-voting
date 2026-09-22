// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VoterRegistry
 * @notice Stores an incremental Merkle tree of voter credential commitments.
 *         Mirrors the base paper (Tang et al. 2023) — the Merkle root is the
 *         public anchor that the zk-SNARK proof in Voting.sol verifies against.
 *
 * @dev Incremental Merkle tree: we store only the "frontier" (rightmost path),
 *      not all 2^depth nodes. This gives O(depth) storage and O(depth) insert,
 *      which is standard for on-chain Merkle trees (same design as Tornado Cash).
 *
 *      Hash function: Poseidon2 — we replicate the Poseidon round constants
 *      used in the Circom circuit (circomlib Poseidon(2)) so that off-chain
 *      proof witnesses and on-chain verification use the same root.
 *
 *      NOTE: Full Poseidon on-chain is gas-intensive. For this course project we
 *      use a simplified keccak256-based stub that produces the same root AS LONG
 *      AS the off-chain merkle tree (voter-client/merkle.js) uses the same hash.
 *      A production system would embed a full Poseidon precompile or use a
 *      Groth16 proof for tree membership verification only. This simplification
 *      is stated in the README.
 */
contract VoterRegistry {

    // ── Constants ────────────────────────────────────────────────────────────
    uint256 public constant DEPTH = 10;
    uint256 public constant MAX_LEAVES = 1 << DEPTH; // 1024

    // ── State ────────────────────────────────────────────────────────────────
    address public owner;

    // frontier[i] = the hash of the subtree of height i that is currently
    // "complete" (all leaves filled) on the rightmost side.
    bytes32[DEPTH] public frontier;

    // Number of leaves inserted so far
    uint256 public leafCount;

    // Current Merkle root
    bytes32 public root;

    // All inserted leaf commitments (for off-chain tree reconstruction)
    bytes32[] public leaves;

    // ── Events ───────────────────────────────────────────────────────────────
    event LeafAdded(uint256 indexed index, bytes32 commitment, bytes32 newRoot);

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "VoterRegistry: not owner");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        // Initialise root to the hash of an all-zero tree of depth DEPTH
        root = _zeros(DEPTH);
    }

    // ── External functions ───────────────────────────────────────────────────

    /**
     * @notice Add a new voter credential commitment as a leaf.
     * @dev Called by the backend after threshold blind-signature verification
     *      completes and the credential has been validated.
     * @param commitment  Poseidon(secret, credential) computed off-chain by voter.
     */
    function addLeaf(bytes32 commitment) external onlyOwner returns (bytes32 newRoot) {
        require(leafCount < MAX_LEAVES, "VoterRegistry: tree full");

        // Insert using the incremental Merkle tree algorithm
        uint256 index = leafCount;
        bytes32 current = commitment;

        for (uint256 i = 0; i < DEPTH; i++) {
            if (index & 1 == 0) {
                // Current node is a LEFT child — store it in frontier and
                // hash with the zero subtree on the right
                frontier[i] = current;
                current = _hashPair(current, _zeros(i));
            } else {
                // Current node is a RIGHT child — hash with the stored frontier
                current = _hashPair(frontier[i], current);
            }
            index >>= 1;
        }

        leafCount++;
        root = current;
        leaves.push(commitment);

        emit LeafAdded(leafCount - 1, commitment, root);
        return root;
    }

    /**
     * @notice Return all leaves for off-chain Merkle path computation.
     */
    function getLeaves() external view returns (bytes32[] memory) {
        return leaves;
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    /**
     * @dev Hash two child nodes. We use keccak256 here to match the off-chain
     *      JavaScript merkle tree in voter-client/merkle.js.
     *      See README §Simplifications for why we don't use Poseidon on-chain.
     */
    function _hashPair(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }

    /**
     * @dev Returns the canonical "zero" hash for an empty subtree of height h.
     *      zeros[0] = keccak256(0x00...0)  (zero leaf)
     *      zeros[i] = keccak256(zeros[i-1] || zeros[i-1])
     *      Precomputed to avoid on-chain recursion. Only DEPTH+1 values needed.
     */
    function _zeros(uint256 h) internal pure returns (bytes32) {
        bytes32[11] memory z;
        z[0]  = bytes32(0x0000000000000000000000000000000000000000000000000000000000000000);
        z[1]  = keccak256(abi.encodePacked(z[0],  z[0]));
        z[2]  = keccak256(abi.encodePacked(z[1],  z[1]));
        z[3]  = keccak256(abi.encodePacked(z[2],  z[2]));
        z[4]  = keccak256(abi.encodePacked(z[3],  z[3]));
        z[5]  = keccak256(abi.encodePacked(z[4],  z[4]));
        z[6]  = keccak256(abi.encodePacked(z[5],  z[5]));
        z[7]  = keccak256(abi.encodePacked(z[6],  z[6]));
        z[8]  = keccak256(abi.encodePacked(z[7],  z[7]));
        z[9]  = keccak256(abi.encodePacked(z[8],  z[8]));
        z[10] = keccak256(abi.encodePacked(z[9],  z[9]));
        return z[h];
    }
}
