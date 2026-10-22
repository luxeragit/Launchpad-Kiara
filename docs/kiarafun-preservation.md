# KiaraFun functionality-preservation checklist

## Protected starting point

- Starting branch: `main`.
- Starting commit: `cabb5db421cd0364b21400fde88cdd44a3359e99`.
- Safety reference: `safety/kiarafun-before-rebuild`.
- Baseline: `npm run check` and `npm run build` both pass. The existing build warns about bundle size, old browser data, and development-only Vite `import.meta` code bundled as CommonJS.
- Original illustration: the user-supplied blonde Kiara character, preserved without redrawing.

## Non-negotiable boundaries

No database migrations or data deletion for the redesign. No wallet replacement,
encryption changes, secret rotation, RPC switching, program-address changes, fee
changes, or transaction-signing changes. Do not perform trades, deployments,
transfers, claims, burns, or enable automation during verification.

The only transaction-related addition is a fail-closed network authorization gate.
It preserves saved settings and transaction implementations, but prevents their
execution until an explicitly configured Mainnet RPC is verified and transactions
are explicitly approved. Stopping automation remains possible.

## Route and capability inventory

| Existing route | Feature set to preserve | API/database dependencies |
|---|---|---|
| `/` | Real token discovery, newest/last-traded/top/trending/movers, mint search, token details, price chart, quick buy | `/api/pumpfun/*`, `/api/tokens/search/:mint`, `/api/trade/buy`, `/api/wallets`, external price service |
| `/` automation controls | Start/stop, selected wallets, amounts, market-cap/social/volume filters, take-profit/stop-loss, holdings and manual sell | `/api/trade/settings`, `/api/monitoring/*`, `/api/autosell/*`, `/api/holdings*`; trade settings, holdings, transactions |
| `/deploy` | Token identity/social/image inputs, three platforms, Normal/Mayhem, wallet and initial buy, review, real deployment status and existing deployments | `/api/tokens`, `/api/tokens/deploy`, `/api/wallets`; token deployments, wallets |
| `/deploy/:id` | Token details and history, analytics/safety, buy/sell, holdings, allocations, claim/distribute/auto-claim, liquidity and LP burning, deletion | `/api/tokens/:id*`, `/api/tokens/mint/:mint/*`, `/api/trade/*`, `/api/holdings/token/:mint`; deployments, fee activities, holdings |
| `/wallets` | Create/import, balances/refresh, labels/details, private-key reveal/export, transfers, archive/delete/cleanup, batch funding/consolidation, token balances/burn, devnet airdrop | `/api/wallets*`; encrypted wallets, transactions |
| `/docs` | Product guidance and advanced technical reference | Actual current routes and capabilities; no invented integrations |
| All routes | Phantom/Solflare signing, session/logout, notifications, responsive navigation | `/api/auth/nonce/:walletAddress`, `/api/auth/verify`, `/api/auth/session`, `/api/auth/logout`; users, sessions |

## Regression strategy

- Compare original HTTP endpoint declarations against the final implementation.
- Check unchanged schema and encryption modules against the safety reference.
- Keep legacy route paths and public request/response contracts working.
- Unit-test network classification, fail-closed verification, transaction-route
  matching and safe stop/settings paths without submitting transactions.
- Run TypeScript and production build after integrating the frontend.
- Inspect real screenshots of desktop, tablet, and mobile, all principal routes,
  light/dark themes, disconnected states, and safely available populated data.
- Use ephemeral signed test identities only for authentication/API checks; never
  collect or expose real private keys.
- Clearly label unverified live-wallet and on-chain flows in the final report.
