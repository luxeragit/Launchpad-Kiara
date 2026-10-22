import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table for wallet-based authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: text("wallet_address").notNull().unique(),
  nonce: text("nonce").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

// Wallets table for Solana wallets (managed wallets for trading)
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  label: text("label").notNull(),
  address: text("address").notNull().unique(),
  privateKey: text("private_key").notNull(),
  balance: real("balance").default(0),
  isActive: boolean("is_active").default(true),
  isArchived: boolean("is_archived").default(false),
  walletType: text("wallet_type").default("created"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Token deployments table
export const tokenDeployments = pgTable("token_deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  twitter: text("twitter"),
  telegram: text("telegram"),
  website: text("website"),
  platform: text("platform").notNull(),
  mode: text("mode").default("normal"),
  walletId: varchar("wallet_id").references(() => wallets.id),
  status: text("status").default("pending"),
  txSignature: text("tx_signature"),
  tokenAddress: text("token_address"),
  // Fee distribution settings (percentages must total 100)
  burnPercent: integer("burn_percent").default(20),
  ammPercent: integer("amm_percent").default(30),
  creatorPercent: integer("creator_percent").default(25),
  liquidityPercent: integer("liquidity_percent").default(25),
  // Collected fees tracking
  totalFeesCollected: real("total_fees_collected").default(0),
  totalFeesDistributed: real("total_fees_distributed").default(0),
  totalBurned: real("total_burned").default(0),
  // Automation
  autoClaimEnabled: boolean("auto_claim_enabled").default(false),
  lastClaimAt: timestamp("last_claim_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Fee distribution activity log
export const feeActivities = pgTable("fee_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenDeploymentId: varchar("token_deployment_id").references(() => tokenDeployments.id),
  activityType: text("activity_type").notNull(), // claim, distribute, burn
  amount: real("amount").notNull(),
  txSignature: text("tx_signature"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Trade monitor settings
export const tradeSettings = pgTable("trade_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  solAmount: real("sol_amount").default(0.1),
  autoRedirect: boolean("auto_redirect").default(false),
  selectedWallets: text("selected_wallets").array(),
  isMonitoring: boolean("is_monitoring").default(false),
  minMarketCap: real("min_market_cap"),
  maxMarketCap: real("max_market_cap"),
  requireTwitter: boolean("require_twitter").default(false),
  requireTelegram: boolean("require_telegram").default(false),
  requireWebsite: boolean("require_website").default(false),
  // Auto-sell settings
  autoSellEnabled: boolean("auto_sell_enabled").default(false),
  takeProfitPercent: real("take_profit_percent"),
  stopLossPercent: real("stop_loss_percent"),
  // Vol/MCap ratio filter
  minVolMcapRatio: real("min_vol_mcap_ratio"),
  maxVolMcapRatio: real("max_vol_mcap_ratio"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Token holdings - tracks tokens bought for auto-sell monitoring
export const tokenHoldings = pgTable("token_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  walletId: varchar("wallet_id").references(() => wallets.id),
  tokenMint: text("token_mint").notNull(),
  tokenName: text("token_name").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenImage: text("token_image"),
  buyPrice: real("buy_price").notNull(),
  buyAmount: real("buy_amount").notNull(),
  tokenQuantity: real("token_quantity"),
  currentPrice: real("current_price"),
  status: text("status").default("holding"), // holding, sold, pending_sell
  soldPrice: real("sold_price"),
  soldAmount: real("sold_amount"),
  soldAt: timestamp("sold_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transaction history
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").references(() => wallets.id),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  toAddress: text("to_address"),
  fromAddress: text("from_address"),
  signature: text("signature"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  tokenDeployments: many(tokenDeployments),
  tradeSettings: many(tradeSettings),
  tokenHoldings: many(tokenHoldings),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  tokenDeployments: many(tokenDeployments),
  transactions: many(transactions),
}));

export const tokenDeploymentsRelations = relations(tokenDeployments, ({ one, many }) => ({
  wallet: one(wallets, {
    fields: [tokenDeployments.walletId],
    references: [wallets.id],
  }),
  feeActivities: many(feeActivities),
}));

export const feeActivitiesRelations = relations(feeActivities, ({ one }) => ({
  tokenDeployment: one(tokenDeployments, {
    fields: [feeActivities.tokenDeploymentId],
    references: [tokenDeployments.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
}));

export const tokenHoldingsRelations = relations(tokenHoldings, ({ one }) => ({
  wallet: one(wallets, {
    fields: [tokenHoldings.walletId],
    references: [wallets.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
});

export const insertTokenDeploymentSchema = createInsertSchema(tokenDeployments).omit({
  id: true,
  createdAt: true,
  txSignature: true,
  tokenAddress: true,
  status: true,
});

export const insertTradeSettingsSchema = createInsertSchema(tradeSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertTokenHoldingSchema = createInsertSchema(tokenHoldings).omit({
  id: true,
  createdAt: true,
  soldAt: true,
});

export const insertFeeActivitySchema = createInsertSchema(feeActivities).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

export type TokenDeployment = typeof tokenDeployments.$inferSelect;
export type InsertTokenDeployment = z.infer<typeof insertTokenDeploymentSchema>;

export type TradeSetting = typeof tradeSettings.$inferSelect;
export type InsertTradeSetting = z.infer<typeof insertTradeSettingsSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type TokenHolding = typeof tokenHoldings.$inferSelect;
export type InsertTokenHolding = z.infer<typeof insertTokenHoldingSchema>;

export type FeeActivity = typeof feeActivities.$inferSelect;
export type InsertFeeActivity = z.infer<typeof insertFeeActivitySchema>;

// Validation schemas for forms
export const createWalletFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(50),
});

export const importWalletFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(50),
  privateKey: z.string().min(1, "Private key is required"),
});

export const transferFormSchema = z.object({
  fromWalletId: z.string().min(1, "Select source wallet"),
  toAddress: z.string().min(32, "Invalid Solana address"),
  amount: z.number().positive("Amount must be positive"),
});

export const tokenDeployFormSchema = z.object({
  name: z.string().min(1, "Token name is required").max(32),
  symbol: z.string().min(1, "Symbol is required").max(10).toUpperCase(),
  description: z.string().optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  website: z.string().optional(),
  platform: z.enum(["pumpfun", "bonkfun", "meteora"]),
  mode: z.enum(["normal", "mayhem"]).default("normal"),
  walletId: z.string().min(1, "Select a wallet"),
  initialBuyAmount: z.coerce.number().min(0.01, "Minimum 0.01 SOL required").optional().default(0.01),
});
