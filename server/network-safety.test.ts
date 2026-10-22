import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateNetwork, isFinancialRequest, networkFromUrl, networkSafetyMiddleware } from "./network-safety";
import type { Request, Response, NextFunction } from "express";

const mainnet = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const devnet = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

test("the imported mismatched defaults fail closed without resetting settings", () => {
  const status = evaluateNetwork(undefined, true);
  assert.equal(status.walletNetwork, "devnet");
  assert.equal(status.tradingNetwork, "mainnet-beta");
  assert.equal(status.consistent, false);
  assert.equal(status.transactionsEnabled, false);
});

test("an RPC label alone never authorizes transactions", () => {
  assert.equal(evaluateNetwork("https://api.mainnet-beta.solana.com", true).transactionsEnabled, false);
  assert.equal(evaluateNetwork("https://api.mainnet-beta.solana.com", true, devnet).transactionsEnabled, false);
});

test("Mainnet RPC verification also requires explicit approval", () => {
  const status = evaluateNetwork("https://provider.example/rpc", false, mainnet);
  assert.equal(status.walletNetwork, "mainnet-beta");
  assert.equal(status.rpcVerified, true);
  assert.equal(status.transactionsEnabled, false);
  assert.equal(evaluateNetwork("https://provider.example/rpc", true, mainnet).transactionsEnabled, true);
});

test("Devnet airdrops remain available outside production only", () => {
  assert.equal(evaluateNetwork(undefined, false, undefined, false).airdropEnabled, true);
  assert.equal(evaluateNetwork(undefined, false, undefined, true).airdropEnabled, false);
  assert.equal(evaluateNetwork("https://rpc.example", true, mainnet).airdropEnabled, false);
});

test("unknown, invalid or unrecognized RPCs cannot enable transfers", () => {
  for (const url of ["not-a-url", "https://provider.example/mainnet", "https://provider.example"]) {
    assert.equal(evaluateNetwork(url, true, "unrecognized-chain").transactionsEnabled, false);
  }
  assert.equal(networkFromUrl("not a URL"), "unknown");
  assert.equal(networkFromUrl("https://api.testnet.solana.com"), "testnet");
});

test("all financial entry routes are covered, including trailing slash and case variants", () => {
  const routes = [
    "/wallets/transfer", "/wallets/fund", "/wallets/consolidate", "/wallets/burn",
    "/tokens/deploy", "/trade/buy", "/trade/sell", "/monitoring/start", "/autosell/start",
    "/holdings/id/sell", "/tokens/id/fees/claim", "/tokens/id/fees/distribute",
    "/tokens/mint/mint-address/burn-lp",
  ];
  for (const path of routes) {
    assert.equal(isFinancialRequest("POST", path), true, path);
    assert.equal(isFinancialRequest("POST", `${path.toUpperCase()}/`), true, path);
  }
});

test("automation cannot bypass safety through settings or auto-claim", () => {
  for (const method of ["POST", "PUT", "PATCH"]) {
    assert.equal(isFinancialRequest(method, "/trade/settings", { isMonitoring: true }), true);
    assert.equal(isFinancialRequest(method, "/trade/settings", { autoSellEnabled: true }), true);
  }
  assert.equal(isFinancialRequest("POST", "/tokens/id/autoclaim/toggle", { enabled: true }), true);
  assert.equal(isFinancialRequest("POST", "/tokens/id/autoclaim/toggle", { enabled: false }), false);
});

test("viewing, setting up, importing, and stopping remain accessible", () => {
  for (const path of ["/wallets", "/wallets/import", "/monitoring/stop", "/autosell/stop", "/wallets/refresh"]) {
    assert.equal(isFinancialRequest("POST", path), false, path);
  }
  assert.equal(isFinancialRequest("PUT", "/trade/settings", { solAmount: 0.1 }), false);
  assert.equal(isFinancialRequest("GET", "/trade/buy"), false);
  assert.equal(isFinancialRequest("DELETE", "/tokens/id"), false);
});

test("unauthenticated requests reach the existing authentication checks", async () => {
  let nextCalled = false;
  await networkSafetyMiddleware(
    { method: "POST", path: "/trade/buy", session: {} } as Request,
    {} as Response, (() => { nextCalled = true; }) as NextFunction,
  );
  assert.equal(nextCalled, true);
});
