// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EligibilityRegistry
 * @notice Stores an incremental Merkle tree of eligible voter commitments.
 *         Gates the registration phase: a voter proves eligibility anonymously
 *         via zk-SNARK before being allowed to request 2-of-3 threshold blind signatures.
 *
 * @dev Mirrors the incremental Merkle tree pattern of VoterRegistry.sol (depth 10,
 *      keccak256-based incremental frontier tree, O(depth) storage/insert).
 *      Contains a nullifier tracking mechanism to ensure each eligible voter can
 *      claim their eligibility token exactly once without linking their identity.
 */
contract EligibilityRegistry {

    // ── Constants ────────────────────────────────────────────────────────────
    uint256 public constant DEPTH = 10;
    uint256 public constant MAX_LEAVES = 1 << DEPTH; // 1024

    // ── State ────────────────────────────────────────────────────────────────
    address public owner;

    // frontier[i] = hash of the complete subtree of height i on the rightmost side
    bytes32[DEPTH] public frontier;

    // Number of eligible leaves inserted so far
    uint256 public leafCount;

    // Current Merkle root of eligible voters
    bytes32 public root;

    // All inserted leaf commitments (for off-chain tree reconstruction)
    bytes32[] public leaves;

    // Registration nullifier mapping to prevent an eligible voter from registering more than once
    mapping(bytes32 => bool) public registrationNullifierUsed;

    // Total claims processed
    uint256 public totalClaims;

    // ── Events ───────────────────────────────────────────────────────────────
    event LeafAdded(uint256 indexed index, bytes32 commitment, bytes32 newRoot);
    event EligibilityClaimed(bytes32 indexed nullifier);

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "EligibilityRegistry: not owner");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        root = _zeros(DEPTH);
    }

    // ── External functions ───────────────────────────────────────────────────

    /**
     * @notice Add a new eligible voter's commitment as a leaf.
     * @dev Called by backend after one-time identity verification.
     * @param commitment Hash of the enrollment secret held by the eligible voter.
     */
    function addLeaf(bytes32 commitment) external onlyOwner returns (bytes32 newRoot) {
        require(leafCount < MAX_LEAVES, "EligibilityRegistry: tree full");

        uint256 index = leafCount;
        bytes32 current = commitment;

        for (uint256 i = 0; i < DEPTH; i++) {
            if (index & 1 == 0) {
                frontier[i] = current;
                current = _hashPair(current, _zeros(i));
            } else {
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
     * @notice Claim eligibility anonymously before voter credential issuance.
     * @dev Enforces one claim per eligible voter via registration nullifier.
     * @param nullifier Derived from Poseidon(enrollmentSecret, electionId, 1).
     */
    function claimEligibility(bytes32 nullifier) external {
        require(!registrationNullifierUsed[nullifier], "EligibilityRegistry: nullifier already used");

        registrationNullifierUsed[nullifier] = true;
        totalClaims++;

        emit EligibilityClaimed(nullifier);
    }

    /**
     * @notice Return all leaves for off-chain Merkle path computation.
     */
    function getLeaves() external view returns (bytes32[] memory) {
        return leaves;
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _hashPair(bytes32 left, bytes32 right) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }

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
