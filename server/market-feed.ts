import type { PumpfunToken } from "./pumpfun";

export type MarketRanking = "trending" | "activity" | "movers";
export const MARKET_REFRESH_MS = 15_000;
const MAX_STALE_MS = 120_000;
const TIMEOUT_MS = 7_000;
type Pair = {
  chainId?: string; dexId?: string; pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { imageUrl?: string; websites?: { url?: string }[]; socials?: { type?: string; url?: string }[] };
  pairCreatedAt?: number; priceNative?: string;
  txns?: { m5?: { buys?: number; sells?: number } };
  volume?: { m5?: number }; priceChange?: { m5?: number };
  liquidity?: { usd?: number };
};
export interface MarketSnapshotToken extends PumpfunToken {
  volumeUnit: "USD"; metricWindow: "5m"; dex: string; observedAt: number;
}

/** Only named Pump.fun/PumpSwap pools, not arbitrary Solana profiles or suffixes. */
export function normalizeMarketPairs(pairs: Pair[], candidates: Set<string>, now: number): MarketSnapshotToken[] {
  const selected = new Map<string, Pair>();
  for (const pair of pairs) {
    const mint = pair.baseToken?.address;
    if (!mint || !candidates.has(mint) || pair.chainId !== "solana" ||
      !["pumpfun", "pumpswap"].includes(pair.dexId ?? "")) continue;
    const previous = selected.get(mint);
    const volume = (p: Pair) => Math.max(0, p.volume?.m5 ?? 0);
    if (!previous || volume(pair) > volume(previous) ||
      (volume(pair) === volume(previous) && (pair.liquidity?.usd ?? 0) > (previous.liquidity?.usd ?? 0))) selected.set(mint, pair);
  }
  const nonnegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  const link = (value?: string) => {
    try { const url = new URL(value ?? ""); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; }
    catch { return undefined; }
  };
  return [...selected.entries()].map(([mint, pair]) => {
    const buys = nonnegative(pair.txns?.m5?.buys), sells = nonnegative(pair.txns?.m5?.sells);
    const change = pair.priceChange?.m5;
    return {
      mint, name: pair.baseToken?.name || mint.slice(0, 6),
      symbol: pair.baseToken?.symbol || mint.slice(0, 6), uri: "", creator: "",
      image: pair.info?.imageUrl ?? null, timestamp: pair.pairCreatedAt ?? 0,
      tradeCount: buys !== undefined && sells !== undefined ? buys + sells : undefined,
      volume: nonnegative(pair.volume?.m5),
      priceChange: typeof change === "number" && Number.isFinite(change) ? change : undefined,
      volumeUnit: "USD", metricWindow: "5m", dex: pair.dexId!, observedAt: now,
      twitter: link(pair.info?.socials?.find((social) => social.type === "twitter")?.url),
      telegram: link(pair.info?.socials?.find((social) => social.type === "telegram")?.url),
      website: link(pair.info?.websites?.[0]?.url),
    };
  });
}

export function rankMarketTokens(tokens: MarketSnapshotToken[], ranking: MarketRanking): MarketSnapshotToken[] {
  return tokens.filter((token) => ranking === "trending" ? token.volume !== undefined && token.volume > 0 :
    ranking === "activity" ? token.tradeCount !== undefined && token.tradeCount > 0 :
      token.priceChange !== undefined && (token.tradeCount ?? 0) > 0)
    .sort((a, b) => {
      const value = (token: MarketSnapshotToken) => ranking === "trending" ? token.volume! :
        ranking === "activity" ? token.tradeCount! : Math.abs(token.priceChange!);
      return value(b) - value(a) || a.mint.localeCompare(b.mint);
    }).slice(0, 20);
}

export class PumpMarketFeed {
  private tokens: MarketSnapshotToken[] = [];
  private updatedAt: number | null = null;
  private lastAttemptAt: number | null = null;
  private error: string | null = null;
  private pending: Promise<void> | null = null;

  constructor(private recentMints: () => string[], private fetcher: typeof fetch = fetch,
    private now: () => number = Date.now) {}

  metadata() {
    const age = this.updatedAt === null ? Infinity : this.now() - this.updatedAt;
    return {
      source: "DexScreener", scope: "Pump.fun / PumpSwap", window: "5m",
      updatedAt: this.updatedAt, lastAttemptAt: this.lastAttemptAt,
      refreshIntervalMs: MARKET_REFRESH_MS, refreshing: this.pending !== null,
      status: this.updatedAt === null || age > MAX_STALE_MS ? "unavailable" :
        this.error || age > MARKET_REFRESH_MS * 2 ? "stale" : "fresh",
      error: this.error,
      coverage: "Sampled discovered pools, not the official Pump.fun leaderboard",
    };
  }

  ranked(ranking: MarketRanking) {
    if (this.metadata().status === "unavailable") return [];
    return rankMarketTokens(this.tokens, ranking);
  }

  async refresh(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.lastAttemptAt !== null && this.now() - this.lastAttemptAt < MARKET_REFRESH_MS) return;
    this.lastAttemptAt = this.now();
    this.pending = this.fetchSnapshot().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async json(url: string) {
    const response = await this.fetcher(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Market provider HTTP ${response.status}`);
    return response.json();
  }

  private async fetchSnapshot() {
    try {
      // Discovery profiles are only candidates; every displayed token must pass
      // pool/chain/base-mint checks below. A suffix is never proof of origin.
      let profiles: { chainId?: string; tokenAddress?: string }[] = [];
      let discoveryFailed = false;
      try {
        const response = await this.json("https://api.dexscreener.com/token-profiles/latest/v1");
        if (!Array.isArray(response)) throw new Error("Invalid discovery response");
        profiles = response;
      } catch { discoveryFailed = true; }
      const validMint = (mint: unknown): mint is string => typeof mint === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint);
      const mints = [...new Set([
        ...new Set((["trending", "activity", "movers"] as MarketRanking[]).flatMap((ranking) =>
          rankMarketTokens(this.tokens, ranking).map((token) => token.mint)).slice(0, 40)),
        ...profiles.filter((profile) => profile.chainId === "solana").slice(0, 30).map((profile) => profile.tokenAddress),
        ...this.recentMints(),
      ].filter(validMint))].slice(0, 100);
      if (!mints.length) throw new Error(discoveryFailed ? "Market discovery unavailable" : "No market candidates available");
      const batches: string[][] = [];
      for (let index = 0; index < mints.length; index += 30) batches.push(mints.slice(index, index + 30));
      const responses = await Promise.all(batches.map(async (batch) => {
        const pairs = await this.json(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(",")}`);
        if (!Array.isArray(pairs)) throw new Error("Invalid market provider response");
        return pairs as Pair[];
      }));
      // A partial failure never replaces a good snapshot with an incomplete one.
      const now = this.now();
      this.tokens = normalizeMarketPairs(responses.flat(), new Set(mints), now);
      this.updatedAt = now;
      this.error = discoveryFailed ? "Discovery delayed; refreshing previously discovered pools" : null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Market provider unavailable";
    }
  }
}
