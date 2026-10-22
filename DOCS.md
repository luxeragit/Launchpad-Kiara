# Zapera Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Authentication System](#authentication-system)
4. [API Reference](#api-reference)
5. [Database Schema](#database-schema)
6. [Frontend Pages](#frontend-pages)
7. [Trading System](#trading-system)
8. [Token Analytics](#token-analytics)
9. [External Integrations](#external-integrations)
10. [Environment Variables](#environment-variables)
11. [Technical Architecture](#technical-architecture)

---

## Project Overview

Zapera is a comprehensive Solana trading dashboard designed for cryptocurrency wallet management, token deployment, and automated trade monitoring. The platform provides a light-mode focused interface with crypto-specific aesthetics.

### Key Capabilities

- **Wallet Management**: Create, import, and manage multiple Solana wallets with encrypted private key storage
- **Token Deployment**: Deploy tokens to Pump.fun, BonkFun, and Meteora platforms
- **Automated Trading**: Configure auto-buy and auto-sell with price-based filters
- **Real-time Monitoring**: Live token feeds with trending and top movers
- **Token Analytics**: Price charts, holder analysis, and rug safety scoring
- **Fee Distribution**: Manage token creator fees with burn, AMM, and liquidity allocation

---

## Features

### Wallet Features
- Create new Solana wallets (keypair generation)
- Import existing wallets via private key
- Wallet balance tracking with auto-refresh
- SOL transfers between wallets
- Wallet archiving and labeling
- Encrypted private key storage (AES-256-GCM)

### Token Deployment
- Multi-step deployment wizard
- Platform selection (Pump.fun, BonkFun, Meteora)
- Token metadata configuration (name, symbol, description, image)
- Social links setup (Twitter, Telegram, Website)
- Fee distribution configuration

### Trading Features
- **Auto-Buy**: Automatically purchase new tokens based on filters
- **Auto-Sell**: Take profit and stop loss automation
- **Quick Buy**: One-click purchase from monitor page
- **Multi-Platform Execution**: Pump.fun → Raydium → Jupiter fallback

### Filtering Options
- Market cap range (min/max)
- Social requirements (Twitter, Telegram, Website)
- Volume/Market Cap ratio filter
- Keyword blacklist

### Analytics
- Real-time price charts (lightweight-charts)
- Holder concentration analysis
- Rug safety scoring
- Bonding curve progress tracking
- Fee activity history

---

## Authentication System

### Overview
Zapera uses wallet-based authentication where users sign a message with their Solana wallet (Phantom, Solflare) to prove ownership.

### Authentication Flow

```
1. User connects wallet → Frontend requests nonce
2. Backend generates nonce → Stores in database
3. User signs message containing nonce
4. Backend verifies signature using tweetnacl
5. Session created with userId stored
6. All subsequent requests authenticated via session
```

### API Endpoints

#### Get Nonce
```
GET /api/auth/nonce/:walletAddress
```
Response:
```json
{
  "nonce": "abc123xyz..."
}
```

#### Verify Signature
```
POST /api/auth/verify
```
Request:
```json
{
  "walletAddress": "HBJ9qD7AXW4UNP6a7tiAz1EmMx7PT1zRggdnjwVsmRak",
  "signature": "base58-encoded-signature",
  "message": "Sign this message to authenticate: abc123xyz..."
}
```
Response:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "walletAddress": "HBJ9qD7AXW4UNP6a7tiAz1EmMx7PT1zRggdnjwVsmRak"
  }
}
```

#### Check Session
```
GET /api/auth/session
```
Response:
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "walletAddress": "HBJ9qD7AXW4UNP6a7tiAz1EmMx7PT1zRggdnjwVsmRak"
  }
}
```

#### Logout
```
POST /api/auth/logout
```

---

## API Reference

### Wallet Endpoints

#### List Wallets
```
GET /api/wallets
```
Response: Array of wallet objects
```json
[
  {
    "id": "uuid",
    "label": "Main Wallet",
    "address": "HBJ9qD7AXW4UNP6a7tiAz1EmMx7PT1zRggdnjwVsmRak",
    "balance": 1.5,
    "isActive": true,
    "isArchived": false,
    "walletType": "created",
    "createdAt": "2026-01-07T06:53:07.788Z"
  }
]
```

#### Create Wallet
```
POST /api/wallets
```
Request:
```json
{
  "label": "Trading Wallet"
}
```

#### Import Wallet
```
POST /api/wallets/import
```
Request:
```json
{
  "label": "Imported Wallet",
  "privateKey": "base58-private-key"
}
```

#### Update Wallet
```
PATCH /api/wallets/:id
```
Request:
```json
{
  "label": "New Label",
  "isActive": true
}
```

#### Delete Wallet
```
DELETE /api/wallets/:id
```

#### Transfer SOL
```
POST /api/wallets/:id/transfer
```
Request:
```json
{
  "toAddress": "destination-address",
  "amount": 0.5
}
```

#### Refresh Balances
```
POST /api/wallets/refresh-balances
```

### Token Monitor Endpoints

#### Get New Tokens (WebSocket Feed)
```
GET /api/pumpfun/tokens
```
Response:
```json
{
  "tokens": [...],
  "connected": true,
  "tokenCount": 50,
  "trendingCount": 20
}
```

#### Get Trending Tokens
```
GET /api/pumpfun/trending
```
Returns tokens sorted by trade count (most active)

#### Get Top Movers
```
GET /api/pumpfun/movers
```
Returns tokens sorted by volume (highest volume)

#### Get Monitoring Status
```
GET /api/monitoring/status
```
Response:
```json
{
  "isMonitoring": true,
  "pumpfunConnected": true,
  "tokenCount": 50,
  "settings": {...}
}
```

### Trading Endpoints

#### Get Trade Settings
```
GET /api/trade/settings
```
Response:
```json
{
  "solAmount": 0.1,
  "autoRedirect": false,
  "selectedWallets": ["wallet-id-1"],
  "isMonitoring": false,
  "minMarketCap": 1000,
  "maxMarketCap": 100000,
  "requireTwitter": true,
  "requireTelegram": false,
  "requireWebsite": false,
  "takeProfitPercentage": 50,
  "stopLossPercentage": 20,
  "autoSellEnabled": false
}
```

#### Update Trade Settings
```
PUT /api/trade/settings
```

#### Quick Buy
```
POST /api/trade/quick-buy
```
Request:
```json
{
  "tokenMint": "token-address",
  "walletId": "wallet-uuid",
  "solAmount": 0.1,
  "tokenName": "Token Name",
  "tokenSymbol": "TKN",
  "tokenImage": "https://..."
}
```

#### Start/Stop Monitoring
```
POST /api/monitoring/start
POST /api/monitoring/stop
```

### Holdings Endpoints

#### Get All Holdings
```
GET /api/holdings
```

#### Get Active Holdings
```
GET /api/holdings/active
```

#### Sell Holding
```
POST /api/holdings/:id/sell
```

### Token Analytics Endpoints

#### Get Token Analytics
```
GET /api/tokens/:mint/analytics
```
Response:
```json
{
  "mint": "token-address",
  "name": "Token Name",
  "symbol": "TKN",
  "price": 0.00001234,
  "priceUsd": 0.00247,
  "marketCapSol": 1500,
  "marketCapUsd": 300000,
  "volume24h": 50000,
  "holders": 1234,
  "bondingProgress": 75.5,
  "isGraduated": false
}
```

#### Get Rug Safety Score
```
GET /api/tokens/:mint/safety
```
Response:
```json
{
  "score": 85,
  "checks": {
    "mintAuthority": { "passed": true, "message": "Mint authority revoked" },
    "freezeAuthority": { "passed": true, "message": "Freeze authority revoked" },
    "topHolderConcentration": { "passed": false, "message": "Top holder owns 15%" },
    "liquidityLocked": { "passed": true, "message": "Liquidity locked" },
    "bondingProgress": { "passed": true, "message": "75% bonding complete" }
  }
}
```

#### Get Price History
```
GET /api/tokens/:mint/price-history
```

### Fee Distribution Endpoints

#### Get Fee Stats
```
GET /api/tokens/:id/fees
```

#### Update Fee Allocation
```
PUT /api/tokens/:id/fees/allocation
```
Request:
```json
{
  "burnPercentage": 25,
  "ammPercentage": 25,
  "creatorPercentage": 25,
  "liquidityPercentage": 25
}
```

#### Claim Fees
```
POST /api/tokens/:id/fees/claim
```

#### Toggle Auto-Claim
```
POST /api/tokens/:id/autoclaim/toggle
```

### LP Token Endpoints

#### Get LP Token Info
```
GET /api/tokens/mint/:mint/lp-info
```

#### Burn LP Tokens
```
POST /api/tokens/mint/:mint/burn-lp
```
Request:
```json
{
  "walletId": "wallet-uuid",
  "amount": 1000000
}
```

---

## Database Schema

### Users Table
```typescript
users = pgTable("users", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  nonce: text("nonce"),
  createdAt: timestamp("created_at").defaultNow()
})
```

### Wallets Table
```typescript
wallets = pgTable("wallets", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  label: text("label").notNull(),
  address: text("address").notNull(),
  privateKey: text("private_key").notNull(), // Encrypted AES-256-GCM
  balance: real("balance").default(0),
  isActive: boolean("is_active").default(true),
  isArchived: boolean("is_archived").default(false),
  walletType: text("wallet_type").default("created"),
  createdAt: timestamp("created_at").defaultNow()
})
```

### Token Deployments Table
```typescript
tokenDeployments = pgTable("token_deployments", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  walletId: text("wallet_id").references(() => wallets.id),
  tokenMint: text("token_mint"),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  image: text("image"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  website: text("website"),
  platform: text("platform").default("pumpfun"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow()
})
```

### Trade Settings Table
```typescript
tradeSettings = pgTable("trade_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  solAmount: real("sol_amount").default(0.1),
  selectedWallets: text("selected_wallets").array(),
  isMonitoring: boolean("is_monitoring").default(false),
  minMarketCap: real("min_market_cap"),
  maxMarketCap: real("max_market_cap"),
  requireTwitter: boolean("require_twitter").default(false),
  requireTelegram: boolean("require_telegram").default(false),
  requireWebsite: boolean("require_website").default(false),
  takeProfitPercentage: real("take_profit_percentage"),
  stopLossPercentage: real("stop_loss_percentage"),
  autoSellEnabled: boolean("auto_sell_enabled").default(false),
  minVolMcapRatio: real("min_vol_mcap_ratio"),
  maxVolMcapRatio: real("max_vol_mcap_ratio")
})
```

### Token Holdings Table
```typescript
tokenHoldings = pgTable("token_holdings", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  walletId: text("wallet_id").references(() => wallets.id),
  tokenMint: text("token_mint").notNull(),
  tokenName: text("token_name"),
  tokenSymbol: text("token_symbol"),
  tokenImage: text("token_image"),
  buyPrice: real("buy_price").notNull(),
  buyAmount: real("buy_amount").notNull(),
  tokenQuantity: real("token_quantity"),
  currentPrice: real("current_price"),
  status: text("status").default("holding"), // holding, sold
  soldPrice: real("sold_price"),
  soldAmount: real("sold_amount"),
  soldAt: timestamp("sold_at"),
  createdAt: timestamp("created_at").defaultNow()
})
```

### Fee Activities Table
```typescript
feeActivities = pgTable("fee_activities", {
  id: text("id").primaryKey(),
  tokenId: text("token_id").references(() => tokenDeployments.id),
  activityType: text("activity_type"), // claim, distribute, burn
  amount: real("amount"),
  txSignature: text("tx_signature"),
  createdAt: timestamp("created_at").defaultNow()
})
```

---

## Frontend Pages

### Monitor Page (`/monitor`)
The main trading dashboard with three tabs:

**New Tab**
- Real-time feed of newly created tokens from Pump.fun WebSocket
- Token cards showing name, symbol, market cap, social links
- Quick buy button for instant purchases
- Auto-refreshes every 3 seconds

**Trending Tab**
- Tokens sorted by trade count (most active)
- Data from DexScreener API
- Shows 24h trade volume and price change
- Includes social verification indicators

**Movers Tab**
- Tokens sorted by 24h volume (biggest movers)
- Data from DexScreener API
- Price change percentages
- Market cap display

**Auto-Buy Configuration**
- SOL amount per trade
- Wallet selection
- Market cap filters (min/max)
- Social requirements checkboxes
- Volume/MCap ratio filter
- Start/Stop monitoring toggle

### Wallets Page (`/wallets`)
- Wallet list with balances
- Create new wallet button
- Import wallet modal
- Per-wallet actions:
  - Edit label
  - Transfer SOL
  - View address (copy)
  - Archive/Delete
- Bulk balance refresh

### Deploy Page (`/deploy`)
Multi-step token deployment wizard:
1. Select platform (Pump.fun, BonkFun, Meteora)
2. Token details (name, symbol, description)
3. Upload image
4. Social links
5. Select funding wallet
6. Review and deploy

### Token Dashboard (`/deploy/:id`)
Comprehensive token management:
- Price chart with historical data
- Current metrics (price, market cap, holders)
- Bonding curve progress
- Rug safety score breakdown
- Fee distribution configuration
- Activity history
- LP token burning (for graduated tokens)

---

## Trading System

### Auto-Buy System

**Flow:**
1. Pump.fun WebSocket streams new token creations
2. Backend applies user-configured filters:
   - Market cap range
   - Social requirements
   - Vol/MCap ratio
3. Matching tokens trigger buy attempt
4. Multi-platform execution: Pump.fun → Raydium → Jupiter
5. Success creates holding record

**Configuration Options:**
- `solAmount`: Amount to spend per buy
- `minMarketCap` / `maxMarketCap`: Filter by market cap
- `requireTwitter` / `requireTelegram` / `requireWebsite`: Social checks
- `minVolMcapRatio` / `maxVolMcapRatio`: Volume filter

### Auto-Sell System

**Service:** `server/autosell.ts`
- Monitors holdings every 5 seconds
- Fetches current prices via unified price service
- Executes based on settings:

**Take Profit:**
```
if (currentPrice >= buyPrice * (1 + takeProfitPercentage/100))
  → Execute sell
```

**Stop Loss:**
```
if (currentPrice <= buyPrice * (1 - stopLossPercentage/100))
  → Execute sell
```

**Platform Detection:**
- Checks if token graduated via DexScreener `dexId`
- Pump.fun tokens: Sell via Pump.fun API
- Graduated tokens: Sell via Raydium API

### Quick Buy

Allows instant purchase from Monitor page:
```
POST /api/trade/quick-buy
{
  tokenMint, walletId, solAmount, tokenName, tokenSymbol
}
```

### Trade Orchestration

**Platform Fallback Chain:**
1. **Pump.fun**: For tokens on bonding curve
2. **Raydium**: For graduated tokens
3. **Jupiter**: Universal fallback

---

## Token Analytics

### Price Service (`server/price-service.ts`)
Unified price fetching with smart routing:
- **Pump.fun tokens**: Uses Pump.fun API (`/coins/{mint}`)
- **Graduated tokens**: Uses Raydium API
- 10-second cache with 2-second cooldown
- Batch processing with 500ms delays

### Bonding Curve Progress
Calculation based on DexScreener `dexId`:
- `dexId: "pumpfun"` → Calculate from market cap ($0-$69K range)
- `dexId: "raydium"` → 100% (graduated)

### Safety Score (`server/token-analytics.ts`)
Analyzes rug risk with multiple checks:
- **Mint Authority**: Should be revoked
- **Freeze Authority**: Should be revoked
- **Top Holder Concentration**: < 10% ideal
- **Developer Holdings**: Should be reasonable
- **Liquidity**: Should be locked
- **Bonding Progress**: Higher = safer

### Price Charts
- Uses lightweight-charts library
- Fetches trade history from Pump.fun API
- 5-minute data aggregation
- Dark/light mode theme support

---

## External Integrations

### Pump.fun
- **WebSocket**: `wss://pumpportal.fun/api/data`
  - New token events
  - Trade events
  - Auto-reconnect on disconnect
- **REST API**: Token data, trades, bonding curve info
  - Note: May return 530/1016 errors during outages

### DexScreener
- **Token Profiles**: `https://api.dexscreener.com/token-profiles/latest/v1`
- **Pairs API**: `https://api.dexscreener.com/latest/dex/tokens/{address}`
- Used for trending/movers when Pump.fun is unavailable

### Raydium
- **Swap Quotes**: For graduated tokens
- **Transaction Building**: Swap execution
- Decimal handling for token amounts

### Jupiter
- **Fallback DEX**: When Pump.fun and Raydium fail
- **Universal Liquidity**: Aggregates all Solana DEXes

### Solana RPC
- Configured via `SOLANA_RPC_URL`
- Balance queries
- Transaction submission
- Holder analysis

---

## Environment Variables

### Required Secrets

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session encryption key (also used for private key encryption) |
| `SOLANA_RPC_URL` | Solana RPC endpoint (defaults to devnet if not set) |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 5000 |

### Security Notes
- Private keys encrypted with AES-256-GCM using `SESSION_SECRET`
- Sessions stored in PostgreSQL via connect-pg-simple
- All wallet data isolated by userId - zero cross-user visibility

---

## Technical Architecture

### Stack Overview

**Frontend:**
- React 18 with TypeScript
- Vite build tool with HMR
- TanStack React Query for data fetching
- Wouter for routing
- shadcn/ui component library (Radix UI primitives)
- Tailwind CSS for styling
- lightweight-charts for price charts

**Backend:**
- Express.js with TypeScript
- Drizzle ORM with PostgreSQL
- express-session for authentication
- @solana/web3.js for blockchain interactions
- tweetnacl for signature verification

### Directory Structure
```
├── client/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities (queryClient, etc.)
│   │   ├── pages/          # Route components
│   │   └── App.tsx         # Root component with routing
│   └── index.html
├── server/
│   ├── routes.ts           # API endpoint definitions
│   ├── storage.ts          # Database abstraction layer
│   ├── auth.ts             # Authentication middleware
│   ├── solana.ts           # Blockchain utilities
│   ├── pumpfun.ts          # Pump.fun WebSocket service
│   ├── autosell.ts         # Auto-sell monitoring service
│   ├── price-service.ts    # Unified price fetching
│   ├── token-analytics.ts  # Analytics calculations
│   ├── fee-distribution.ts # Fee management service
│   ├── raydium-api.ts      # Raydium DEX integration
│   └── crypto.ts           # Encryption utilities
├── shared/
│   └── schema.ts           # Drizzle schema + Zod types
└── package.json
```

### Data Flow
```
User Action
    ↓
React Component
    ↓
TanStack Query (useQuery/useMutation)
    ↓
API Request (apiRequest helper)
    ↓
Express Route Handler
    ↓
Storage Interface (IStorage)
    ↓
Drizzle ORM
    ↓
PostgreSQL
```

### Real-time Updates
- WebSocket for Pump.fun token stream
- Frontend polling every 3 seconds for token feeds
- Auto-sell service checks every 5 seconds
- Balance refresh on demand

### Security Measures
- Wallet-based authentication (no passwords)
- AES-256-GCM encryption for private keys
- Session-based access control
- User data isolation via userId foreign keys
- Signature verification with tweetnacl

---

## Quick Start

1. **Connect Wallet**: Click "Connect Wallet" and authorize with Phantom/Solflare
2. **Create/Import Wallets**: Go to Wallets page to set up trading wallets
3. **Fund Wallets**: Transfer SOL to your trading wallets
4. **Configure Trading**: Set up auto-buy filters on Monitor page
5. **Start Monitoring**: Enable monitoring to auto-buy matching tokens
6. **Track Holdings**: View purchased tokens and configure auto-sell

---

## Support

For issues or feature requests, please contact the development team.

**Version**: 1.0.0
**Last Updated**: January 2026
