# KiaraFun documentation

KiaraFun brings Solana token discovery, managed wallets, token creation, and
trading controls into one workspace. This is an existing application with live
external integrations, not a trading simulator.

## Start here

| Destination | What you can do |
|---|---|
| Explore `/` | Browse live tokens, switch discovery views, search a mint, inspect a token, and prepare a quick buy |
| Create `/deploy` | Enter token identity, upload artwork, add social links, select a launch configuration, and review |
| My Tokens `/my-tokens` | Open saved launch records and their management workspaces |
| Token workspace `/deploy/:id` | Inspect analytics, holdings, safety information, creator settings, liquidity, and activity |
| Wallets `/wallets` | Create or import managed wallets, review balances, and access everyday or advanced operations |
| Monitor `/monitor` | Review automation status, buy qualification, sell protection, holdings, and start/stop controls |
| Docs `/docs` | Read product guidance inside the application |

### Connect versus import

Connect Phantom or Solflare to sign the authentication message. Connecting proves
ownership of the external wallet; it does **not** import its private key.
Creating or importing a managed wallet is a separate action. Imported private
keys are encrypted by the server using the existing encryption implementation.

Private keys must never be included in screenshots, logs, telemetry, or support
messages. Reveal and export them only deliberately, on a trusted device.

### Before moving funds

The network banner reports wallet and trading networks separately. The imported
defaults are inconsistent: the wallet module defaults to Devnet, while trading
modules default to Mainnet. These defaults have **not** been switched.

Financial execution fails closed until all of the following are true:

1. A shared `SOLANA_RPC_URL` is explicitly configured.
2. A read-only `getGenesisHash` request verifies the RPC as Solana Mainnet.
3. The operator explicitly approves financial execution by setting
   `MAINNET_TRANSACTIONS_ENABLED=true`.

This flag is **not enabled by the redesign**. A green network status is not a
security audit or a guarantee of successful execution. Verify integrations,
funding, fees, and the intended network before enabling it.

The gate covers transfers, batch funding/consolidation, token and LP burning,
deployment, buy/sell, fee execution, and enabling transaction automation.
It also covers automatic buys and sells in background services. It does not
erase saved settings. Stop controls remain usable. Devnet airdrops remain
available only on Devnet outside production.

## Current capability boundaries

- **Pump.fun:** the existing backend contains the live deployment path.
- **Bonk.fun and Meteora:** existing choices save launch configuration/pending
  records; live deployment is not implemented in the imported backend. A saved
  record is not a confirmed launch.
- **Creator claims:** the imported service directs creators to Pump.fun for
  actual fee claiming. Its auto-claim service monitors enabled records; it does
  not execute automatic claims.
- **Trading:** existing Pump.fun, Raydium, and Jupiter modules/routing remain
  intact, but individual routes do not necessarily use every fallback. No real
  transactions were submitted as redesign tests.
- **Charts:** market information comes from external services. A current price
  is not historical price data; missing history must not be filled with
  invented candles or earlier observations.
- **Wallet labels:** creation/import supports labels. There is no implemented
  wallet PATCH endpoint in this version; do not document one.
- **Risk information:** safety scores are indicators, not an independent audit
  or a promise that a token is safe. Never trade money you cannot afford to lose.

## Authentication API

| Method | Path | Contract |
|---|---|---|
| GET | `/api/auth/nonce/:walletAddress` | Returns `message` and `nonce`; message begins `KiaraFun Authentication` |
| POST | `/api/auth/verify` | JSON `{walletAddress, signatureHex, messageHex}`; signs the exact message bytes, creates the existing session |
| GET | `/api/auth/session` | Returns `{authenticated, user?}` |
| POST | `/api/auth/logout` | Destroys the current session |

Use credentials-included requests. The legacy session-cookie identifier remains
unchanged for compatibility. The message branding changed; signing/verification,
key encryption, key formats, and database identity did not.

## API reference

Except for public network/discovery endpoints, these routes require the current
authenticated session. The route implementation and shared validation schemas
are the authoritative source for payloads; no API or storage identifiers were
renamed for branding.

### Network and discovery

- `GET /api/network/status` — credential-free network-safety summary, including
  verified state, approval state, and financial/airdrop availability.
- `GET /api/solana/info` — existing connection-info contract.
- `GET /api/pumpfun/tokens`
- `GET /api/pumpfun/trending`
- `GET /api/pumpfun/movers`
- `GET /api/pumpfun/status`
- `GET /api/tokens/search/:mint`

### Managed wallets

- `GET /api/wallets`
- `GET /api/wallets/:id`
- `GET /api/wallets/:id/key` — deliberate sensitive-key reveal.
- `POST /api/wallets` — create with a label.
- `POST /api/wallets/import` — import with label and private key.
- `POST /api/wallets/refresh`
- `POST /api/wallets/transfer` — includes `fromWalletId`, `toAddress`, `amount`.
- `DELETE /api/wallets/:id`
- `POST /api/wallets/:id/airdrop`
- `POST /api/wallets/download` — deliberate sensitive-key export.
- `POST /api/wallets/cleanup`
- `POST /api/wallets/:id/archive`
- `POST /api/wallets/fund`
- `POST /api/wallets/consolidate`
- `GET /api/wallets/:walletId/token/:tokenMint/balance`
- `POST /api/wallets/burn`

### Token creation and management

- `GET /api/tokens`
- `GET /api/tokens/:id`
- `DELETE /api/tokens/:id`
- `POST /api/tokens/deploy` — existing multipart form, image field `logo`.
- `GET /api/tokens/:id/analytics`
- `GET /api/tokens/mint/:mint/analytics`
- `GET /api/tokens/:id/safety`
- `GET /api/tokens/mint/:mint/safety`
- `GET /api/tokens/mint/:mint/status`
- `GET /api/tokens/mint/:mint/price-history`

### Trading and automation

- `GET /api/trade/settings`
- `POST /api/trade/settings`
- `PUT /api/trade/settings`
- `POST /api/monitoring/start`
- `POST /api/monitoring/stop`
- `GET /api/monitoring/status`
- `GET /api/transactions`
- `GET /api/holdings`
- `GET /api/holdings/active`
- `GET /api/holdings/token/:mint`
- `POST /api/holdings/:id/sell`
- `POST /api/autosell/start`
- `POST /api/autosell/stop`
- `GET /api/autosell/status`
- `POST /api/trade/buy`
- `POST /api/trade/sell`

### Creator fees and liquidity

- `GET /api/tokens/:id/fees`
- `PUT /api/tokens/:id/fees/allocation`
- `POST /api/tokens/:id/fees/claim`
- `POST /api/tokens/:id/fees/distribute`
- `POST /api/tokens/:id/autoclaim/toggle`
- `GET /api/tokens/mint/:mint/lp-info`
- `POST /api/tokens/mint/:mint/burn-lp`

Disabled execution responds with HTTP `409` and
`{code: "NETWORK_NOT_READY", error: "..."}`. Existing authentication failures
continue to use HTTP `401`.

## Data and architecture

The application retains React 18, TypeScript, Vite, Wouter, TanStack Query,
Tailwind/Radix, Express, PostgreSQL, and Drizzle. Existing users, encrypted
wallets, token deployments, transactions, trade settings, token holdings, fee
activities, and session data remain in the existing schema.

UI code: `client/src`. Backend: `server`. Shared schema: `shared/schema.ts`.
Original encryption implementation: `server/crypto.ts`.
Functionality inventory and verification boundaries:
`docs/kiarafun-preservation.md`.

## Running and checking

```sh
npm run dev
npm run check
npm run build
npm start
node --import tsx --test server/network-safety.test.ts
```

`npm start` serves the built production bundle. The app listens on port 5000
on all interfaces. The existing Replit workflow runs `npm run dev`.

### Environment

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Existing PostgreSQL connection; do not replace to redesign the UI |
| `SESSION_SECRET` | Existing session secret and encryption-key fallback; never rotate casually |
| `ENCRYPTION_KEY` | Optional existing encryption key; never change it for branding |
| `SOLANA_RPC_URL` | Shared RPC, required for safe live execution |
| `MAINNET_TRANSACTIONS_ENABLED` | Explicit approval gate; only literal `true` enables approved, verified Mainnet execution |
| `PORT` | Defaults to `5000` |
| `NODE_ENV` | Development/production behavior |

Never put secret values in documentation. No production schema migration or
real-fund verification is part of the visual rebuild.
