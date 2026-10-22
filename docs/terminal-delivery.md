# KiaraFun terminal reconstruction

## Starting point and implementation

Actual starting commit: `bf407d1459952a6eb32ec997d32cfe11f5b8a246`.
The user's audited reference, `696e038f5da33d1c165c9b67ab5d7332f46f6921`,
exists in history; the application was not reset. The implementation commit is
recorded automatically in the downloadable report after the code is committed.

The previous horizontal navigation, featured-card carousels, full-width
onboarding banner and centered dashboard foundations are no longer the primary
interface. This is a reconstruction of the rendered workspaces, not a recolor.
The exact original Kiara asset is retained.

## New architecture

- Dark-first fixed 56px icon rail; compact 50px toolbar; genuine 32px market
  ticker. Geist, Space Grotesk and IBM Plex Mono are loaded as real fonts.
- Full-height border-separated panels with independent scrolling.
- Explore: Trending, indexed Live Activity and Token Leaderboard, with genuine
  supported categories and rankings. No invented posts, traders or profit.
- Create: compact grouped launch form and persistent live review, with
  Configuration/Live review switching on phones.
- Wallets: directory, selected-wallet inspector and grouped actions.
- Monitor: separate strategy, candidate stream and positions/risk/activity zones.
- My Tokens: searchable/filterable deployment directory and selected-record
  inspector, keeping pending configurations distinct from live deployments.
- Token Dashboard: chart/metrics, order entry and six operational tabs. Its
  unreachable old Card composition was removed.
- Docs: topic navigation, structured content and contextual outline.
- Phone navigation includes every destination, including Docs. Search, wallet
  access, optional light mode and bounded network details remain reachable.

## Feature preservation

| Existing capability | New reachable location | Verification level |
|---|---|---|
| Public feed, newest, activity, trending, movers, categories/rankings | Explore panels/ticker | Implemented; actual live data and browser checks |
| Mint search, chart, token selection and quick buy | Global search and token inspector | Browser tested; real public API; no buy executed |
| Buy/sell, wallet selection and eligibility | Token order entry, token inspector and Monitor positions | Implemented; paused-state checks; no real transaction verified |
| Token identity, artwork, socials, platform/mode, funding, initial buy and submission | Launch workstation/review | Field/upload/preview browser checks; validated existing payload; no launch submitted |
| Saved deployments, status/platform/search/filter/deep links | My Tokens directory/inspector | Empty/disconnected states and route checked; no real deployment altered |
| Wallet create/import/refresh/selection, transfer/receive, archive/delete/cleanup, reveal/export, funding/consolidation, SPL burn and devnet tools | Wallet directory/inspector/actions and preserved dialogs | Original eleven mutations retained; create/import dialogs browser tested; no export or financial operation executed |
| Selected-wallet transactions and tracked positions | Wallet inspector | Existing authenticated transaction/holding APIs connected; loading/error/empty states implemented; populated values not browser-verified |
| Start/stop, wallet and amount, cap/social/volume filters, redirect, auto-sell/TP/SL, holdings and exit | Dedicated Monitor zones | Existing settings/contracts retained; actual paused state checked; no automation enabled |
| Analytics/history, safety, holdings, allocations, claim/distribution/auto-claim, liquidity/LP burn, activity and deletion | Token Dashboard six tabs and order entry | Contracts retained; all six tabs browser tested with labelled pending-record fixture; no live financial execution |
| Fee distribution | Fees tab with explicit confirmation | Existing endpoint now reachable directly; statically checked, not executed |
| Authentication/session/logout, themes, deep links and network details | Shared terminal shell | Real ephemeral signed-message API checks; replay/isolation/logout checks; native-browser navigation/theme checks |

The complete protected inventory is in `docs/terminal-preservation.md`. All
56 baseline route declarations remain. All 24 original page mutation identifiers
remain across the reconstructed client. The schema and thirteen protected
authentication/network/trading/backend modules compare byte-for-byte with the
actual starting commit. Static preservation checks supplement rather than
replace browser checks.

## Actual verification

- `npm run check`: passed.
- `npm run build`: passed.
- Existing network-safety suite: nine tests passed.
- Safe API checks: signed nonce/session, fresh-account isolation, nonce replay
  rejection, logout, protected private routes and financial-entry blocking passed.
- Native Chromium tests cover terminal geometry, independent panel scrolling,
  token selection, public mint lookup, wallet dialogs, live launch preview,
  mobile network-detail bounds, all operational tabs, themes and navigation.
- Seven routes were captured at each requested size: 1440×900, 1280×800,
  768×1024, 390×844 and 375×812. Tested pages had no horizontal overflow.
- Measured desktop geometry: rail 56px, toolbar 50px, ticker 32px, Explore panels
  approximately 467/458/458px wide and 782px tall at 1440×900.
- The browser journey recorded zero financial requests and zero unhandled
  application exceptions.

The downloadable report includes the actual browser result summary and fresh
before/after, desktop and mobile screenshots. Screenshot evidence and JSON
receipts are under `generated-artifacts/terminal/`, ignored by Git/deployment.

## Network safety and limits

**Financial execution remains paused.** Wallet fallback is Devnet; trading
fallback is Mainnet. No RPC, network configuration, approval flag, encryption
secret, program address, route contract, database schema or saved user setting
was changed. Existing server-side fail-closed middleware remains operational.
The compact status control reports the actual mismatch; it does not conceal it.

No real deployment, trade, transfer, claim, distribution, SPL/LP burn, wallet
export or automation activation was performed. No real wallet keys were used.
Ephemeral authentication fixtures were removed after testing.

Token Dashboard layout evidence uses a visibly labelled isolated browser-only
pending Bonk.fun record. It is never persisted or substituted into public market
data. Its blank chart correctly explains that a confirmed mint is required.
This is not a screenshot of a verified live deployment.

Actual Phantom/Solflare extension approval, funded-wallet operations, confirmed
on-chain execution and populated real deployment management remain unverified.
External chart/feed/price availability remains provider-dependent.

Existing capability boundaries remain: Pump.fun has the live deployment path;
Bonk.fun and Meteora save pending configurations. Creator claiming requires
Pump.fun; auto-claim is availability monitoring, not an automated executor.
Fee distribution does not imply unsupported automatic DEX integrations.

Existing non-blocking build warnings remain for bundle size, browser data age
and development-only Vite `import.meta` references in the CommonJS server bundle.

## Replaced source compositions

- `client/src/App.tsx`, shared `navbar.tsx`, theme/terminal styling and font setup.
- `client/src/pages/explore.tsx` (new discovery workspace).
- `client/src/pages/{monitor,deploy,my-tokens,wallets,token-dashboard,docs}.tsx`.
- `client/src/components/terminal/{terminal-panel,token-dashboard-workspace}.tsx`.
- `client/src/components/terminal/wallet-records.tsx` reads existing authenticated
  wallet-specific activity and tracked positions, without claiming a complete
  on-chain balance scan.
- `client/src/components/wallet-connect-button.tsx` gains compact mobile display
  without changing authentication behavior.
- `client/src/index.css`, `tailwind.config.ts`, `design_guidelines.md`, `replit.md`.
- Verification: `script/verify-terminal-ui.mjs` and
  `script/verify-terminal-preservation.mjs`; the original browser-check command
  now runs the reconstructed terminal suite.
