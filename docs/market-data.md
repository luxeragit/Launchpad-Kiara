# Market data: sources and guarantees

The discovery interface is not a mirror of Pump.fun's official ranking.
Direct Pump.fun frontend requests returned HTTP 403 in this environment.
PumpPortal's documented token-trade subscription is metered and requires a funded
account; this project does not enable it or request a paid account automatically.

## Available feeds

- **New:** genuine token-creation events from the existing, free PumpPortal
  websocket. The browser polls the application's snapshot every three seconds.
  Connection state and last token event are distinct from ranking freshness.
- **Trending:** sampled Pump.fun/PumpSwap pools, descending five-minute USD volume.
- **Most Active:** those pools, descending five-minute buy + sell transaction count.
- **Top Movers:** those pools, descending absolute five-minute price change.
  Both positive and negative movements qualify; the sign remains visible.

Metrics come from DexScreener's public API. Latest Solana profiles, actual observed
new-token events and previously ranked pools provide bounded discovery candidates.
Profiles and mint suffixes are **not** accepted as proof of a qualifying market.
Every displayed metric token must match a requested base mint, Solana chain and
the provider's `pumpfun` or `pumpswap` DEX identifier. PumpSwap is permissionless,
so a PumpSwap pool alone does not prove that its mint originally launched through
Pump.fun. The scope is explicitly labelled **Pump.fun / PumpSwap**, not an official
or exhaustive Pump.fun launch ranking.

When several qualifying pools exist for one mint, the actual greatest five-minute
volume selects the pool, with liquidity only as a tie-breaker. There are no
duplicated mint rows. Pool age is not represented as token launch age.

## Refresh and failure behavior

The provider snapshot has a 15-second refresh interval, shared in-flight refresh
and bounded requests of at most 30 addresses per batch (100 candidates total).
No per-token sequential request loop or upstream request per browser is used.
Actual provider observations can update less often than this polling interval.

Every response reports its actual snapshot time, source, metric window and
fresh/stale/unavailable status. Failed or partial refreshes retain the last
successful snapshot with a delayed marker, without changing its timestamp.
After two minutes, expired rankings are hidden as unavailable. An empty valid
snapshot clears previous results rather than replaying old tokens forever.
Failure retry is rate-limited even when there is no successful snapshot.

Missing five-minute values remain unknown and are excluded from the relevant
ranking. Twenty-four-hour metrics, arbitrary Solana tokens, creation events and
fabricated zero values are not substituted. USD volume is not labelled SOL.
The old hardcoded USD-market-cap / 200 conversion has been removed.

The shared ticker, leaderboard and token inspector use the same five-minute
metrics/window labels. A separate mint lookup explicitly retains its 24-hour
provider window.

No RPC, wallet storage, keys, financial route behavior, transaction builder or
automation setting is changed by this correction. The original endpoints remain;
`GET /api/pumpfun/trending?sort=activity` adds a read-only ranking variant.

References:
- https://pumpportal.fun/data-api/real-time/
- https://docs.dexscreener.com/api/reference

Verification commands:

```sh
npm run check
node --import tsx --test server/market-feed.test.ts server/network-safety.test.ts
node script/verify-terminal-preservation.mjs
node script/verify-terminal-ui.mjs '' 'market categories|market ticker'
npm run build
```
