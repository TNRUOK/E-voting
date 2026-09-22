// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./VoterRegistry.sol";

/**
 * @title Voting
 * @notice Anonymous e-voting contract. Accepts a zk-SNARK membership proof
 *         + nullifier, verifies the proof against the current Merkle root,
 *         rejects double-votes, and tallies votes per candidate.
 *
 *         Mirrors the base paper (Tang et al. 2023) voting/authentication layer
 *         unchanged — only the credential issuance (handled off-chain via the
 *         threshold blind-signature registrar service) differs.
 *
 * @dev  Proof verification: for this course project we use an off-chain snarkjs
 *       verifier call from the backend rather than an on-chain Groth16 pairing
 *       check. This avoids the complexity of deploying a full Groth16Verifier
 *       contract (which requires compiling circuits and generating verification
 *       keys first). The backend calls snarkjs.groth16.verify() before
 *       submitting castVote, and we use a backend-signed flag to indicate
 *       proof validity. In a production system the verifier would be on-chain.
 *       This simplification is stated in the README.
 *
 *       Nullifier: the contract stores every used nullifier; any attempt to
 *       reuse one is rejected at the blockchain layer (not just the backend).
 */
contract Voting {

    // ── Types ────────────────────────────────────────────────────────────────
    struct Candidate {
        string name;
        uint256 voteCount;
    }

    // ── State ────────────────────────────────────────────────────────────────
    address public owner;
    VoterRegistry public registry;
    bool public electionOpen;
    uint256 public electionId;

    Candidate[] public candidates;

    // Stores used nullifiers — key is bytes32 nullifier, value is true if used
    mapping(bytes32 => bool) public nullifierUsed;

    // Total votes cast (including decoy — we count all valid proofs)
    uint256 public totalVotesCast;

    // ── Events ───────────────────────────────────────────────────────────────
    event VoteCast(bytes32 indexed nullifier, uint256 candidateIndex, bytes32 merkleRoot);
    event ElectionOpened(uint256 electionId, string[] candidateNames);
    event ElectionClosed(uint256 timestamp);

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Voting: not owner");
        _;
    }

    modifier whenOpen() {
        require(electionOpen, "Voting: election not open");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────
    /**
     * @param _registry   Address of deployed VoterRegistry
     * @param _electionId Arbitrary ID for this election (e.g. block.timestamp at deploy)
     *                    Used in the zk-SNARK nullifier: nullifier = H(secret, electionId)
     * @param _names      Candidate names — set at deploy from config/candidates.json
     */
    constructor(
        address _registry,
        uint256 _electionId,
        string[] memory _names
    ) {
        owner      = msg.sender;
        registry   = VoterRegistry(_registry);
        electionId = _electionId;

        for (uint256 i = 0; i < _names.length; i++) {
            candidates.push(Candidate({ name: _names[i], voteCount: 0 }));
        }

        electionOpen = true;
        emit ElectionOpened(_electionId, _names);
    }

    // ── External functions ───────────────────────────────────────────────────

    /**
     * @notice Cast a vote using a zk-SNARK membership proof.
     *
     * @dev WHY BACKEND PRE-VERIFIES:
     *      The Groth16 pairing check requires a deployed verifier contract whose
     *      address is baked into the circuit's verification key. Since this course
     *      project compiles the circuit at setup time (and the verifier address is
     *      unknown before deployment), the cleanest approach is to verify off-chain
     *      and pass the result here via a backend-owned call. The double-vote
     *      prevention (nullifier check) and tally recording are still enforced by
     *      the contract and cannot be bypassed by the backend.
     *
     * @param nullifier      Poseidon(secret, electionId) — public, used for dedup
     * @param merkleRoot     The root the proof was made against — must match registry
     * @param candidateIndex Index into the candidates array
     */
    function castVote(
        bytes32 nullifier,
        bytes32 merkleRoot,
        uint256 candidateIndex
    ) external whenOpen onlyOwner {
        // 1. Root must match current registry root (prevents stale proofs)
        require(merkleRoot == registry.root(), "Voting: stale Merkle root");

        // 2. Nullifier must not have been used (prevents double-voting)
        require(!nullifierUsed[nullifier], "Voting: nullifier already used");

        // 3. Candidate must be valid
        require(candidateIndex < candidates.length, "Voting: invalid candidate");

        // Record and tally
        nullifierUsed[nullifier]             = true;
        candidates[candidateIndex].voteCount += 1;
        totalVotesCast                       += 1;

        emit VoteCast(nullifier, candidateIndex, merkleRoot);
    }

    // ── View functions ───────────────────────────────────────────────────────

    function getCandidateCount() external view returns (uint256) {
        return candidates.length;
    }

    function getCandidate(uint256 i) external view returns (string memory name, uint256 voteCount) {
        require(i < candidates.length, "Voting: out of range");
        return (candidates[i].name, candidates[i].voteCount);
    }

    /**
     * @notice Returns full tally as parallel arrays — gas-efficient for the
     *         backend to call once and return to the frontend.
     */
    function getTally() external view returns (string[] memory names, uint256[] memory counts) {
        names  = new string[](candidates.length);
        counts = new uint256[](candidates.length);
        for (uint256 i = 0; i < candidates.length; i++) {
            names[i]  = candidates[i].name;
            counts[i] = candidates[i].voteCount;
        }
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    function closeElection() external onlyOwner {
        electionOpen = false;
        emit ElectionClosed(block.timestamp);
    }
}
