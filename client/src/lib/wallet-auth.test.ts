import { test } from "node:test";
import assert from "node:assert/strict";
import { bytesToHex, signatureBytes, walletError } from "./wallet-auth";

test("normalizes Solana adapter signature bytes without changing them", () => {
  const signature = new Uint8Array(64).fill(0xab);
  assert.equal(signatureBytes(signature), signature);
  assert.equal(signatureBytes({ signature }), signature);
  assert.equal(bytesToHex(signature), "ab".repeat(64));
  assert.equal(bytesToHex(new Uint8Array([0, 1, 15, 255])), "00010fff");
});

test("refuses missing, malformed and incorrectly sized signatures", () => {
  for (const value of [null, undefined, {}, "1234", { signature: [] }, new Uint8Array(63), new Uint8Array(65)]) {
    assert.throws(() => signatureBytes(value), /invalid signature/);
  }
});

test("wallet cancellation is recoverable and provider failures stay explicit", () => {
  for (const message of ["User rejected request", "User denied", "Modal closed", "4001"]) {
    assert.match(walletError(new Error(message)), /cancelled/);
  }
  assert.equal(walletError(new Error("Relay unavailable")), "Relay unavailable");
  assert.match(walletError(undefined), /Unable to connect/);
});
