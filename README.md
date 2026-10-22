# KiaraFun

A Solana token discovery, creation, wallet, and trading workspace built on the
existing React/Express/PostgreSQL application.

## Run

Click **Run** in Replit, or use `npm run dev`. The application serves the frontend
and API together on port 5000.

```sh
npm run check
npm run build
npm start
node --import tsx --test server/network-safety.test.ts
```

Use the existing `DATABASE_URL` and `SESSION_SECRET`. Do not rotate encryption
secrets or replace stored wallets for a visual migration.

## Financial execution is paused by default

The imported wallet and trading network defaults disagree. No endpoints were
silently switched. Live execution requires an explicitly configured shared
Mainnet RPC, successful genesis-hash verification, and explicit operator approval
through `MAINNET_TRANSACTIONS_ENABLED=true`. The redesign does not set that flag.

Bonk.fun/Meteora currently save pending launch configurations; the existing live
deployment implementation is Pump.fun. Creator claiming is completed on Pump.fun;
the imported auto-claim service monitors rather than executes claims.

See [product and API documentation](DOCS.md),
[design guidelines](design_guidelines.md), and the
[feature-preservation checklist](docs/kiarafun-preservation.md).
