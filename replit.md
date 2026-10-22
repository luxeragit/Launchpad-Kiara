# KiaraFun

## Running on Replit

- Click **Run** to start the `Start application` workflow (`npm run dev`).
- Express serves both the React frontend and `/api` on `0.0.0.0:5000`.
- Required secrets: `DATABASE_URL` (managed PostgreSQL) and `SESSION_SECRET`. Keep the session secret stable: it also encrypts stored wallet private keys.
- Initialize a new development database with `npm run db:push`. Do not run schema commands against an existing external database without confirming the target.
- Imported RPC fallbacks disagree (wallets: Devnet, trading: Mainnet). Financial execution fails closed until `SOLANA_RPC_URL` is explicitly configured, genesis verification confirms Mainnet, and the operator explicitly sets `MAINNET_TRANSACTIONS_ENABLED=true`. No RPC or approval variable was changed by the redesign.
- Checks: `npm run check` for TypeScript; `npm run build` for the production bundle; `npm start` to serve that bundle.

## Overview

KiaraFun is a Solana discovery, managed-wallet, token-creation, and trading workspace. The original user-supplied Kiara character accompanies a light-first sky/navy interface with persisted dark mode. The existing stack, schema, wallet encryption, transaction builders, and route contracts are retained. Pump.fun has the existing live deployment implementation; Bonk.fun/Meteora save configuration-only pending records. See `DOCS.md` for current capability boundaries.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state, local React state for UI
- **Styling**: Tailwind CSS with custom CSS variables for theming (dark/light mode support)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a page-based structure:
- `/`: Explore, backed by real token feeds and mint search.
- `/monitor`: Existing automation and holdings controls in a dedicated workspace.
- `/deploy`: Token creation studio; `/deploy/:id`: token management.
- `/my-tokens`: Saved deployment records.
- `/wallets`: Managed-wallet controls.
- `/docs`: Product guidance and technical reference.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: RESTful endpoints under `/api/` prefix
- **Blockchain Integration**: @solana/web3.js for Solana network interactions
- **Authentication**: Wallet-based auth using Solana message signing

Key backend modules:
- `server/routes.ts`: API endpoint definitions for wallets, tokens, and Solana operations
- `server/storage.ts`: Database abstraction layer implementing IStorage interface
- `server/solana.ts`: Solana blockchain utilities (keypair generation, balance queries, transfers)
- `server/auth.ts`: Authentication routes and middleware (nonce, verify, session, logout)
- `server/crypto.ts`: Cryptographic utilities (AES-256-GCM encryption, signature verification)

### Authentication System
- **Method**: Wallet-based authentication (Phantom, Solflare)
- **Flow**: 
  1. Frontend requests nonce from /api/auth/nonce/:walletAddress
  2. User signs message containing nonce with their wallet
  3. Backend verifies signature using tweetnacl
  4. Session created with userId stored
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session store
- **Data Isolation**: All routes filter data by userId - users only see their own wallets/tokens
- **Private Key Security**: AES-256-GCM encryption using SESSION_SECRET as encryption key
- **Protected Routes**: All wallet, token, and trading routes require authentication via requireAuth middleware

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Tables**:
  - `users`: User accounts with wallet addresses and nonces for authentication
  - `wallets`: Solana wallet storage with encrypted private keys (userId foreign key)
  - `tokenDeployments`: Token deployment records and status (userId foreign key)
  - `transactions`: Transaction history
  - `tradeSettings`: User trading configuration with auto-sell settings (userId foreign key)
  - `tokenHoldings`: Tracks purchased tokens with buy/sell prices and PnL (userId foreign key)

### Auto-Sell System
- Backend service (`server/autosell.ts`) monitors holdings every 5 seconds
- Take Profit: Sells when price increases by configured percentage
- Stop Loss: Sells when price decreases by configured percentage
- **Real-time price fetching** via unified price service (`server/price-service.ts`)
  - Fetches prices from Pump.fun API for tokens on bonding curve
  - Fetches prices from Raydium API for graduated tokens (complete=true)
  - 10-second cache with 2-second cooldown to avoid rate limits
  - Batch processing with 500ms delays for multiple tokens
- Auto-detects graduated tokens and sells via Raydium instead of Pump.fun
- Manual sell endpoint: POST /api/holdings/:id/sell

### Token Holdings
- Created automatically when auto-buy succeeds
- Tracks: tokenMint, buyPrice, buyAmount (SOL), currentPrice, status (holding/sold)
- API endpoints: GET /api/holdings, GET /api/holdings/active, POST /api/holdings/:id/sell

### Design System
The KiaraFun design system uses:
- Light-first sky-blue/navy surfaces with persisted midnight dark mode.
- Sora headings, DM Sans interface text, IBM Plex Mono financial values.
- The original supplied Kiara artwork, without generated substitutes.
- Existing Radix/shadcn primitives refined for responsive financial workflows.

### Pump.fun Integration
- Real-time token feed via PumpPortal WebSocket (wss://pumpportal.fun/api/data)
- Backend service (`server/pumpfun.ts`) maintains persistent WebSocket connection
- Auto-reconnect on connection loss
- Stores last 50 tokens in memory
- API endpoint: GET /api/pumpfun/tokens returns { tokens, connected, tokenCount }
- Frontend auto-refreshes every 3 seconds

### Raydium DEX Integration
- Auto-detects when tokens graduate from Pump.fun bonding curve (token.complete=true)
- Seamlessly switches from Pump.fun API to Raydium API for graduated tokens
- Proper decimal handling for token amounts (converts from atomic units)
- Backend service (`server/raydium-api.ts`) handles Raydium swap quotes and transactions

### Dynamic SOL Pricing
- Real-time SOL/USD price from CoinGecko API
- Updates every 60 seconds with automatic caching
- Shows price unavailable rather than inventing a fallback quote
- Displayed in monitor page header

### Token Analytics System
- Backend service (`server/token-analytics.ts`) fetches data from Pump.fun API
- Real-time price, market cap, liquidity from Pump.fun bonding curve
- On-chain holder analysis via Solana RPC (top 10 holders, concentration %)
- Rug safety scoring: checks mint/freeze authority, top holder %, dev holdings, liquidity, bonding progress
- API endpoints:
  - GET /api/tokens/:id/analytics - Token metrics from Pump.fun
  - GET /api/tokens/:id/safety - Rug safety score with detailed checks

### Fee Distribution Engine
- Backend service (`server/fee-distribution.ts`) manages token creator fees
- Configurable allocation percentages: burn, AMM, creator, liquidity (must total 100%)
- Token burning implemented via real Solana transactions (SPL Token burn instruction)
- Auto-claim service monitors enabled records every 10 minutes; it cannot execute claims. Actual creator claiming must be completed on Pump.fun.
- Database table `feeActivities` tracks all fee operations
- API endpoints:
  - GET /api/tokens/:id/fees - Fee stats and activity history
  - PUT /api/tokens/:id/fees/allocation - Update distribution percentages
  - POST /api/tokens/:id/fees/claim - Existing request contract; service reports that direct claiming is unavailable
  - POST /api/tokens/:id/fees/distribute - Execute fee distribution
  - POST /api/tokens/:id/autoclaim/toggle - Enable/disable auto-claim

### Token Dashboard
- Route: /deploy/:id - Full management interface for deployed tokens
- Price/market cap/holders/bonding curve progress cards
- Rug safety score with visual breakdown of all checks
- Fee statistics (collected, distributed, burned)
- Allocation sliders for fee distribution configuration
- Activity stream showing fee operations history
- **Price Chart**: Existing real-data DEXTools embed with theme-aware presentation
  - The separate price-history API aggregates actual Pump.fun trades
  - Missing history is not backfilled with invented earlier price points
  - Dark/light mode theme support
- **LP Token Burning**: Burn Raydium LP tokens for graduated tokens
  - Wallet ownership verification
  - Balance validation before burn
  - Confirmation dialog with irreversibility warning
  - API endpoints: GET /api/tokens/mint/:mint/lp-info, POST /api/tokens/mint/:mint/burn-lp

### Vol/MCap Ratio Filter
- Added to auto-buy settings in Monitor page
- Filter tokens by volume-to-market-cap ratio percentage
- Only applies when token has valid volume data
- Schema fields: `minVolMcapRatio`, `maxVolMcapRatio` in tradeSettings table
- Calculated as: (volume24h / marketCapSol) * 100

## External Dependencies

### Blockchain
- **Solana RPC**: Configurable via `SOLANA_RPC_URL` environment variable (defaults to devnet)
- **@solana/web3.js**: Core Solana blockchain interactions

### Database
- **PostgreSQL**: Required, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Schema management and query building

### UI Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, forms, etc.)
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library

### Form Handling
- **React Hook Form**: Form state management
- **Zod**: Schema validation (shared between frontend and backend via drizzle-zod)

### Development
- **Vite**: Development server with HMR
- **tsx**: TypeScript execution for server
- **esbuild**: Production bundling for server code