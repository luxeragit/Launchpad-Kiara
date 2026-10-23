import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMarketPairs, rankMarketTokens, PumpMarketFeed, MARKET_REFRESH_MS } from "./market-feed";

const A = "A".repeat(32), B = "B".repeat(32), C = "C".repeat(32);
const candidates = new Set([A, B, C]);
const pair = (mint = A, extra = {}) => ({
  chainId: "solana", dexId: "pumpswap", baseToken: { address: mint, name: mint.slice(0, 4), symbol: mint[0] },
  volume: { m5: 10 }, txns: { m5: { buys: 2, sells: 1 } }, priceChange: { m5: 5 },
  ...extra,
});
test("only verified Solana Pump.fun/PumpSwap base-mint pairs are admitted", () => {
  const tokens = normalizeMarketPairs([pair(), pair(B, { dexId: "pumpfun" }),
    pair(C, { dexId: "raydium" }), pair(C, { chainId: "ethereum" }), pair("D".repeat(32))], candidates, 100);
  assert.deepEqual(tokens.map(t => t.mint), [A, B]);
});
test("multiple pools select actual most-active pool without duplicate tokens", () => {
  const tokens = normalizeMarketPairs([pair(), pair(A, { volume: { m5: 100 } }),
    pair(A, { volume: {}, liquidity: { usd: 999999 } })], candidates, 100);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].volume, 100);
  assert.equal(tokens[0].volumeUnit, "USD");
  assert.equal(tokens[0].marketCapSol, undefined, "Never divide USD market cap by a guessed SOL rate");
  assert.equal(tokens[0].timestamp, 0, "Unknown pool age must not be invented");
});
test("five-minute metrics do not substitute twenty-four-hour data or invent zeros", () => {
  const [token] = normalizeMarketPairs([pair(A, { txns: { h24: { buys: 900, sells: 500 } }, volume: { h24: 9999 }, priceChange: { h24: 1000 } })], candidates, 100);
  assert.equal(token.volume, undefined);
  assert.equal(token.tradeCount, undefined);
  assert.equal(token.priceChange, undefined);
  assert.deepEqual(rankMarketTokens([token], "trending"), []);
  assert.deepEqual(rankMarketTokens([token], "activity"), []);
  assert.deepEqual(rankMarketTokens([token], "movers"), []);
});
test("Trending, Most Active and Top Movers have distinct mathematically correct rankings", () => {
  const tokens = normalizeMarketPairs([
    pair(A, { volume: { m5: 1000 } }),
    pair(B, { txns: { m5: { buys: 100, sells: 40 } } }),
    pair(C, { priceChange: { m5: -90 } }),
  ], candidates, 100);
  assert.equal(rankMarketTokens(tokens, "trending")[0].mint, A);
  assert.equal(rankMarketTokens(tokens, "activity")[0].mint, B);
  assert.equal(rankMarketTokens(tokens, "movers")[0].mint, C);
});
test("negative, missing and nonfinite metrics cannot rank as valid numbers", () => {
  const [token] = normalizeMarketPairs([pair(A, { volume: { m5: -2 }, priceChange: { m5: NaN }, txns: { m5: { buys: Infinity, sells: 1 } } })], candidates, 100);
  assert.equal(token.volume, undefined);
  assert.equal(token.tradeCount, undefined);
  assert.equal(token.priceChange, undefined);
});
test("single-flight refresh and 15-second TTL prevent duplicate upstream requests", async () => {
  let now = 100_000, calls = 0;
  const fetcher = async (url: string | URL | Request) => {
    calls++;
    return Response.json(String(url).includes("token-profiles") ? [{ chainId: "solana", tokenAddress: A }] : [pair()]);
  };
  const feed = new PumpMarketFeed(() => [], fetcher as typeof fetch, () => now);
  await Promise.all([feed.refresh(), feed.refresh(), feed.refresh()]);
  assert.equal(calls, 2);
  assert.equal(feed.metadata().status, "fresh");
  await feed.refresh();
  assert.equal(calls, 2);
  now += MARKET_REFRESH_MS;
  await feed.refresh();
  assert.equal(calls, 4);
});
test("provider failures retain explicitly stale data, then expire it", async () => {
  let now = 100_000, fail = false;
  const feed = new PumpMarketFeed(() => [A], (async (url: string) => {
    if (fail) return new Response("", { status: 503 });
    return Response.json(url.includes("token-profiles") ? [] : [pair()]);
  }) as typeof fetch, () => now);
  await feed.refresh();
  const updated = feed.metadata().updatedAt;
  fail = true; now += MARKET_REFRESH_MS;
  await feed.refresh();
  assert.equal(feed.metadata().status, "stale");
  assert.equal(feed.metadata().updatedAt, updated);
  assert.equal(feed.ranked("trending").length, 1);
  now += 121_000;
  assert.equal(feed.metadata().status, "unavailable");
  assert.deepEqual(feed.ranked("trending"), []);
});
test("empty valid provider response clears old rankings instead of recycling them", async () => {
  let now = 100_000, empty = false;
  const feed = new PumpMarketFeed(() => [A], (async (url: string) =>
    Response.json(url.includes("token-profiles") || empty ? [] : [pair()])) as typeof fetch, () => now);
  await feed.refresh();
  assert.equal(feed.ranked("trending").length, 1);
  empty = true; now += MARKET_REFRESH_MS;
  await feed.refresh();
  assert.equal(feed.metadata().status, "fresh");
  assert.deepEqual(feed.ranked("trending"), []);
});
test("initial provider failure is unavailable and retry is rate limited", async () => {
  let calls = 0;
  const feed = new PumpMarketFeed(() => [], (async () => {
    calls++; return new Response("", { status: 429 });
  }) as typeof fetch, () => 100_000);
  await feed.refresh(); await feed.refresh();
  assert.equal(calls, 1);
  assert.equal(feed.metadata().status, "unavailable");
  assert.equal(feed.metadata().updatedAt, null);
  assert.deepEqual(feed.ranked("activity"), []);
});
test("partial batch failure preserves the last good snapshot without publishing partial results", async () => {
  let now = 100_000, many = false;
  const mints = [..."123456789ABCDEFGHJKLMNPQRSTUVWXYZ"].map((char) => char.repeat(32));
  const feed = new PumpMarketFeed(() => many ? mints : [A], (async (url: string) => {
    if (url.includes("token-profiles")) return Response.json([]);
    const addresses = url.split("/").at(-1)!.split(",");
    assert.ok(addresses.length <= 30);
    if (many && addresses.length < 30) return new Response("", { status: 503 });
    return Response.json([pair(A)]);
  }) as typeof fetch, () => now);
  await feed.refresh();
  const updatedAt = feed.metadata().updatedAt;
  many = true; now += MARKET_REFRESH_MS;
  await feed.refresh();
  assert.equal(feed.metadata().status, "stale");
  assert.equal(feed.metadata().updatedAt, updatedAt);
  assert.equal(feed.ranked("trending")[0].mint, A);
});
