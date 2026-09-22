"use strict";

const { expect } = require("chai");
const crypto = require("crypto");
const { split, combine, P } = require("../registrar-service/crypto/shamir");
const { blind, unblind, verify, modPow, modInverse } = require("../registrar-service/crypto/rsa-blind");
const { partialSign, combinePartials } = require("../registrar-service/crypto/threshold-combine");

describe("Threshold Cryptography & RSA Blind Signature Suite", function () {
  this.timeout(15000);

  // Read the generated public key and shares from keygen
  const fs = require("fs");
  const path = require("path");
  const pubPath = path.join(__dirname, "../registrar-service/shares/public.json");
  let N, e;

  before(() => {
    if (fs.existsSync(pubPath)) {
      const pub = JSON.parse(fs.readFileSync(pubPath, "utf8"));
      N = BigInt(pub.N);
      e = BigInt(pub.e);
    } else {
      // Fallback toy parameters
      const p = 61n;
      const q = 53n;
      N = p * q;
      e = 17n;
    }
  });

  describe("1. Shamir Secret Sharing (GF(p))", () => {
    it("should split a 2048-bit secret into 3 shares with threshold 2", () => {
      const secret = BigInt("0x" + crypto.randomBytes(250).toString("hex"));
      const shares = split(secret, 2, 3);
      expect(shares).to.have.lengthOf(3);
      expect(shares[0].index).to.equal(1);
      expect(shares[1].index).to.equal(2);
      expect(shares[2].index).to.equal(3);
    });

    it("should reconstruct secret from ANY 2 of 3 shares", () => {
      const secret = BigInt("0x" + crypto.randomBytes(200).toString("hex"));
      const shares = split(secret, 2, 3);

      // Pair 1 & 2
      const rec12 = combine([shares[0], shares[1]]);
      expect(rec12).to.equal(secret);

      // Pair 1 & 3
      const rec13 = combine([shares[0], shares[2]]);
      expect(rec13).to.equal(secret);

      // Pair 2 & 3
      const rec23 = combine([shares[1], shares[2]]);
      expect(rec23).to.equal(secret);
    });

    it("should reject reconstruction from a single share", () => {
      const secret = 12345678901234567890n;
      const shares = split(secret, 2, 3);
      expect(() => combine([shares[0]])).to.throw("need at least 2 shares");
    });
  });

  describe("2. RSA Blind Signatures", () => {
    it("should blind a message, sign blinded message, unblind, and verify", () => {
      // Read share 1 and 2 to reconstruct d for this verification test
      const share1 = JSON.parse(fs.readFileSync(path.join(__dirname, "../registrar-service/shares/share-1.json"), "utf8"));
      const share2 = JSON.parse(fs.readFileSync(path.join(__dirname, "../registrar-service/shares/share-2.json"), "utf8"));
      const d = combine([
        { index: share1.share.index, value: BigInt(share1.share.value) },
        { index: share2.share.index, value: BigInt(share2.share.value) }
      ]);

      const message = 123456789n;

      // Blind
      const { blindedMessage, blindingFactor } = blind(message, N, e);

      // Sign blinded message
      const blindedSig = modPow(blindedMessage, d, N);

      // Unblind
      const unblindedSig = unblind(blindedSig, blindingFactor, N);

      // Verify
      const isValid = verify(message, unblindedSig, N, e);
      expect(isValid).to.be.true;
    });

    it("should reject an invalid signature", () => {
      const message = 123456789n;
      const fakeSig = 999n;
      const isValid = verify(message, fakeSig, N, e);
      expect(isValid).to.be.false;
    });
  });

  describe("3. Threshold Partial Signing & Combining", () => {
    it("should compute partial signatures from individual shares", () => {
      const blindedMsg = 42n;
      const shareVal = 500n;
      const partialVal = partialSign(blindedMsg, shareVal, 1, N);

      expect(typeof partialVal).to.equal("bigint");
      expect(partialVal > 0n).to.be.true;
    });

    it("single registrar partial signature cannot verify alone as full signature", () => {
      const message = 100n;
      const { blindedMessage, blindingFactor } = blind(message, N, e);
      const partialVal = partialSign(blindedMessage, 500n, 1, N);

      // Attempting to unblind single partial
      const fakeFullSig = unblind(partialVal, blindingFactor, N);
      const isValid = verify(message, fakeFullSig, N, e);
      expect(isValid).to.be.false;
    });

    it("combining fewer than 2 partial signatures should throw", () => {
      expect(() => combinePartials([{ index: 1, value: 123n }], N, e)).to.throw("need at least 2 partial signatures");
    });
  });
});
