/**
 * Non-transactional development smoke test.
 * Creates only an ephemeral authentication identity, never a managed wallet.
 * Does not read real keys, move funds, deploy, burn, claim, or enable automation.
 */
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { pool } from "../server/db";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("This verification script must not run against production.");
}
if (!process.env.REPLIT_DEV_DOMAIN) {
  throw new Error("Run this check in the Replit development workspace.");
}
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const keypair = nacl.sign.keyPair();
const address = bs58.encode(keypair.publicKey);
let createdUserId: string | undefined;
let cookie = "";

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  return { status: response.status, body: await response.json() };
}

try {
  const unauthenticated = await request("/api/wallets");
  assert.equal(unauthenticated.status, 401);
  console.log("PASS: managed wallets require authentication");

  const network = await request("/api/network/status");
  assert.equal(network.status, 200);
  assert.equal(typeof network.body.transactionsEnabled, "boolean");
  assert.equal("rpcUrl" in network.body, false);
  console.log("PASS: public network status excludes RPC credentials");

  const nonce = await request(`/api/auth/nonce/${address}`);
  assert.equal(nonce.status, 200);
  assert.match(nonce.body.message, /^KiaraFun Authentication - Nonce: /);
  assert.ok(nonce.body.nonce);
  const message = new TextEncoder().encode(nonce.body.message);
  const signature = nacl.sign.detached(message, keypair.secretKey);
  const signedRequest = {
    walletAddress: address,
    messageHex: Buffer.from(message).toString("hex"),
    signatureHex: Buffer.from(signature).toString("hex"),
  };
  const verification = await request("/api/auth/verify", "POST", signedRequest);
  assert.equal(verification.status, 200);
  assert.equal(verification.body.success, true);
  createdUserId = verification.body.user.id;
  const session = await request("/api/auth/session");
  assert.equal(session.body.authenticated, true);
  assert.equal(session.body.user.walletAddress, address);
  console.log("PASS: KiaraFun message signing and session persistence");

  for (const path of ["/api/wallets", "/api/tokens", "/api/holdings", "/api/transactions"]) {
    const result = await request(path);
    assert.equal(result.status, 200, path);
    assert.ok(Array.isArray(result.body), path);
    assert.equal(result.body.length, 0, "Fresh identity must not see another account's records");
  }
  console.log("PASS: fresh identity cannot see other accounts' records");

  const replay = await request("/api/auth/verify", "POST", signedRequest);
  assert.equal(replay.status, 401);
  console.log("PASS: already-used nonce cannot be replayed");

  // Do not even send a financial request when execution is enabled.
  if (!network.body.transactionsEnabled) {
    for (const path of [
      "/api/trade/buy", "/api/trade/sell", "/api/wallets/transfer",
      "/api/wallets/fund", "/api/wallets/consolidate", "/api/wallets/burn",
      "/api/tokens/deploy", "/api/holdings/verification-only/sell",
      "/api/tokens/verification-only/fees/claim",
      "/api/tokens/verification-only/fees/distribute",
      "/api/tokens/mint/verification-only/burn-lp",
      "/api/monitoring/start", "/api/autosell/start",
    ]) {
      const result = await request(path, "POST", {});
      assert.equal(result.status, 409, path);
      assert.equal(result.body.code, "NETWORK_NOT_READY", path);
    }
    const claim = await request("/api/tokens/verification-only/autoclaim/toggle", "POST", { enabled: true });
    assert.equal(claim.status, 409);
    const settings = await request("/api/trade/settings", "PUT", { isMonitoring: true });
    assert.equal(settings.status, 409);
    console.log("PASS: financial and automation entry points fail closed without execution");
  } else {
    console.log("SKIP: financial requests were not tested because execution is enabled");
  }

  const logout = await request("/api/auth/logout", "POST", {});
  assert.equal(logout.status, 200);
  const signedOut = await request("/api/auth/session");
  assert.equal(signedOut.body.authenticated, false);
  console.log("PASS: logout clears authentication");
} finally {
  // Remove only the generated, keyless authentication fixture; never wallet,
  // token, settings, transaction, or existing account data.
  await pool.query("DELETE FROM users WHERE wallet_address = $1 AND ($2::text IS NULL OR id::text = $2)", [
    address, createdUserId ?? null,
  ]);
  keypair.secretKey.fill(0);
  await pool.end();
}
