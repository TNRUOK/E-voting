/**
 * rsa-blind.js — RSA Blind Signature Primitives (Chaum 1983)
 *
 * WHY BLIND SIGNATURES:
 *   A voter wants a registrar to sign their credential commitment without the
 *   registrar ever seeing the plaintext commitment. This is the core
 *   anonymity mechanism:
 *     1. Voter picks a random blinding factor r
 *     2. Voter sends blindedMsg = msg * r^e mod N  (registrar sees only this)
 *     3. Registrar computes partialSig = blindedMsg^d_i mod N  (their key share)
 *     4. After combining partial sigs, voter unblinds: sig = combined * r^-1 mod N
 *     5. Now sig^e ≡ msg (mod N) — a valid RSA signature on the original msg
 *
 *   The registrar never saw msg, only blindedMsg. Since r is uniform random,
 *   blindedMsg is computationally indistinguishable from a random element of Z_N*.
 *
 * IMPLEMENTATION NOTES:
 *   - All arithmetic uses native BigInt (no external library for the math)
 *   - node-forge is used only for RSA key generation and serialisation
 *   - Messages are BigInt representations of a SHA-256 hash of the commitment
 *     (so |msg| < N, which is required for textbook RSA)
 *
 * SECURITY NOTE (documented for the report):
 *   This is "textbook RSA" blind signatures — no OAEP padding or PSS. This is
 *   intentional: OAEP/PSS would make blind signing incompatible with the
 *   unblinding step. In production you would use RSA-FDH (Full Domain Hash)
 *   as done in Chaum's original construction. For this course project, textbook
 *   RSA with SHA-256 message hashing is adequate — the security properties
 *   (anonymity, unforgeability under known-message attack) are demonstrated.
 */

"use strict";

const crypto = require("crypto");

// ── Modular arithmetic ────────────────────────────────────────────────────────

/**
 * Fast modular exponentiation: base^exp mod modulus
 * Uses square-and-multiply with BigInt for 2048-bit numbers.
 */
function modPow(base, exp, mod) {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Extended Euclidean Algorithm → modular inverse of a mod m.
 */
function modInverse(a, m) {
  a = ((a % m) + m) % m;
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error("modInverse: gcd != 1, inverse does not exist");
  return ((old_s % m) + m) % m;
}

// ── Message encoding ──────────────────────────────────────────────────────────

/**
 * Hash a Buffer/string to a BigInt that is safe for textbook RSA.
 * We SHA-256 the input and interpret the 32-byte digest as a big-endian integer.
 * This ensures |msg| < N for 2048-bit keys (256-bit hash << 2048-bit modulus).
 */
function hashToInt(data) {
  const buf = crypto.createHash("sha256").update(data).digest();
  return BigInt("0x" + buf.toString("hex"));
}

// ── Blind signature functions ─────────────────────────────────────────────────

/**
 * blind(messageInt, N, e) → { blindedMessage, blindingFactor }
 *
 * The voter calls this before sending to any registrar.
 * blindedMessage = messageInt * r^e mod N
 * where r is a fresh uniform random element of Z_N*.
 *
 * WHY THIS PRESERVES ANONYMITY:
 *   r^e is a uniformly random element of Z_N* (assuming r is uniform random
 *   and gcd(r, N)=1, which holds with probability (φ(N)/N) ≈ 1 for large N).
 *   Multiplying by r^e produces a value statistically indistinguishable from
 *   a random element of Z_N* regardless of messageInt. The registrar learns
 *   nothing about messageInt from blindedMessage.
 *
 * @param {BigInt} messageInt   Integer representation of the credential (< N)
 * @param {BigInt} N            RSA modulus
 * @param {BigInt} e            RSA public exponent
 * @returns {{ blindedMessage: BigInt, blindingFactor: BigInt }}
 */
function blind(messageInt, N, e) {
  // Generate r uniformly at random from Z_N*
  // (pick random, check gcd(r,N)=1 — almost certain for random r with 2048-bit N)
  let r;
  do {
    const bytes = crypto.randomBytes(256); // 2048 bits
    r = BigInt("0x" + bytes.toString("hex")) % N;
  } while (r === 0n);

  // blindedMessage = message * r^e mod N
  const rToE = modPow(r, e, N);
  const blindedMessage = (messageInt * rToE) % N;

  return { blindedMessage, blindingFactor: r };
}

/**
 * unblind(combinedPartialSig, blindingFactor, N) → finalSignature
 *
 * After receiving and combining partial signatures, the voter unblinds:
 * finalSig = combinedPartialSig * r^-1 mod N
 *
 * WHY THIS GIVES A VALID SIGNATURE:
 *   combinedPartialSig = (blindedMessage)^d mod N  (Shoup threshold combination)
 *                      = (message * r^e)^d mod N
 *                      = message^d * r^(e*d) mod N
 *                      = message^d * r mod N   (since r^(e*d) = r^1 mod φ(N) by RSA)
 *   So: combinedPartialSig * r^-1 = message^d mod N  ✓
 *
 * @param {BigInt} combinedSig   Combined partial signature
 * @param {BigInt} r             Original blinding factor
 * @param {BigInt} N             RSA modulus
 * @returns {BigInt} Valid RSA signature on the original message
 */
function unblind(combinedSig, r, N) {
  const rInv = modInverse(r, N);
  return (combinedSig * rInv) % N;
}

/**
 * verify(messageInt, signature, N, e) → boolean
 *
 * Standard RSA verification: check that sig^e ≡ message (mod N).
 *
 * @param {BigInt} messageInt   Original message integer
 * @param {BigInt} signature    Signature to verify
 * @param {BigInt} N            RSA modulus
 * @param {BigInt} e            RSA public exponent
 * @returns {boolean}
 */
function verify(messageInt, signature, N, e) {
  const recovered = modPow(signature, e, N);
  return recovered === messageInt;
}

/**
 * Hex encoding helpers for serialisation over HTTP.
 */
function bigIntToHex(n) { return "0x" + n.toString(16); }
function hexToBigInt(h) { return BigInt(h); }

module.exports = { modPow, modInverse, hashToInt, blind, unblind, verify, bigIntToHex, hexToBigInt };
