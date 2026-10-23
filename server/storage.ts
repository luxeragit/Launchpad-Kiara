import { 
  users, wallets, tokenDeployments, transactions, tradeSettings, tokenHoldings, feeActivities,
  type User, type InsertUser,
  type Wallet, type InsertWallet,
  type TokenDeployment, type InsertTokenDeployment,
  type Transaction, type InsertTransaction,
  type TradeSetting, type InsertTradeSetting,
  type TokenHolding, type InsertTokenHolding,
  type FeeActivity, type InsertFeeActivity
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUserByWalletAddress(walletAddress: string): Promise<User | undefined>;
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserNonce(id: string, nonce: string): Promise<User | undefined>;
  updateUserLastLogin(id: string): Promise<User | undefined>;
  
  // Wallet operations - userId REQUIRED for all operations
  getWallets(userId: string): Promise<Wallet[]>;
  getWallet(id: string, userId: string): Promise<Wallet | undefined>;
  getWalletByAddress(address: string, userId: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWallet(id: string, data: Partial<InsertWallet>, userId: string): Promise<Wallet | undefined>;
  deleteWallet(id: string, userId: string): Promise<boolean>;
  
  // Token deployment operations - userId REQUIRED
  getTokenDeployments(userId: string): Promise<TokenDeployment[]>;
  getTokenDeployment(id: string, userId: string): Promise<TokenDeployment | undefined>;
  createTokenDeployment(deployment: InsertTokenDeployment): Promise<TokenDeployment>;
  updateTokenDeployment(id: string, data: Partial<TokenDeployment>, userId: string): Promise<TokenDeployment | undefined>;
  deleteTokenDeployment(id: string, userId: string): Promise<boolean>;
  
  // Transaction operations - userId REQUIRED
  getTransactions(userId: string, walletId?: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction | undefined>;
  
  // Trade settings operations - userId REQUIRED
  getTradeSettings(userId: string): Promise<TradeSetting | undefined>;
  upsertTradeSettings(settings: InsertTradeSetting, userId: string): Promise<TradeSetting>;
  
  // Token holdings operations - userId REQUIRED
  getTokenHoldings(userId: string, walletId?: string): Promise<TokenHolding[]>;
  getActiveHoldings(userId: string): Promise<TokenHolding[]>;
  getTokenHolding(id: string, userId: string): Promise<TokenHolding | undefined>;
  createTokenHolding(holding: InsertTokenHolding): Promise<TokenHolding>;
  updateTokenHolding(id: string, data: Partial<TokenHolding>, userId: string): Promise<TokenHolding | undefined>;
  
  // Fee activity operations
  getFeeActivities(tokenDeploymentId: string): Promise<FeeActivity[]>;
  createFeeActivity(activity: InsertFeeActivity): Promise<FeeActivity>;
  getTokenDeploymentsWithAutoClaim(userId: string): Promise<TokenDeployment[]>;
  updateTokenDeploymentFees(id: string, data: Partial<TokenDeployment>, userId: string): Promise<TokenDeployment | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUserByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
    return user || undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUserNonce(id: string, nonce: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ nonce }).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  async updateUserLastLogin(id: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  // Wallet operations - ALL require userId
  async getWallets(userId: string): Promise<Wallet[]> {
    if (!userId) {
      throw new Error("userId is required for getWallets");
    }
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async getWallet(id: string, userId: string): Promise<Wallet | undefined> {
    if (!userId) {
      throw new Error("userId is required for getWallet");
    }
    const [wallet] = await db.select().from(wallets).where(and(eq(wallets.id, id), eq(wallets.userId, userId)));
    return wallet || undefined;
  }

  async getWalletByAddress(address: string, userId: string): Promise<Wallet | undefined> {
    if (!userId) {
      throw new Error("userId is required for getWalletByAddress");
    }
    const [wallet] = await db.select().from(wallets).where(and(eq(wallets.address, address), eq(wallets.userId, userId)));
    return wallet || undefined;
  }

  async createWallet(wallet: InsertWallet): Promise<Wallet> {
    if (!wallet.userId) {
      throw new Error("userId is required for createWallet");
    }
    const [created] = await db.insert(wallets).values(wallet).returning();
    return created;
  }

  async updateWallet(id: string, data: Partial<InsertWallet>, userId: string): Promise<Wallet | undefined> {
    if (!userId) {
      throw new Error("userId is required for updateWallet");
    }
    const [updated] = await db.update(wallets).set(data).where(and(eq(wallets.id, id), eq(wallets.userId, userId))).returning();
    return updated || undefined;
  }

  async deleteWallet(id: string, userId: string): Promise<boolean> {
    if (!userId) {
      throw new Error("userId is required for deleteWallet");
    }
    const result = await db.delete(wallets).where(and(eq(wallets.id, id), eq(wallets.userId, userId))).returning();
    return result.length > 0;
  }

  // Token deployment operations - ALL require userId
  async getTokenDeployments(userId: string): Promise<TokenDeployment[]> {
    if (!userId) {
      throw new Error("userId is required for getTokenDeployments");
    }
    return await db.select().from(tokenDeployments)
      .where(eq(tokenDeployments.userId, userId))
      .orderBy(desc(tokenDeployments.createdAt));
  }

  async getTokenDeployment(id: string, userId: string): Promise<TokenDeployment | undefined> {
    if (!userId) {
      throw new Error("userId is required for getTokenDeployment");
    }
    const [deployment] = await db.select().from(tokenDeployments).where(and(eq(tokenDeployments.id, id), eq(tokenDeployments.userId, userId)));
    return deployment || undefined;
  }

  async createTokenDeployment(deployment: InsertTokenDeployment): Promise<TokenDeployment> {
    if (!deployment.userId) {
      throw new Error("userId is required for createTokenDeployment");
    }
    const [created] = await db.insert(tokenDeployments).values(deployment).returning();
    return created;
  }

  async updateTokenDeployment(id: string, data: Partial<TokenDeployment>, userId: string): Promise<TokenDeployment | undefined> {
    if (!userId) {
      throw new Error("userId is required for updateTokenDeployment");
    }
    const [updated] = await db.update(tokenDeployments).set(data).where(and(eq(tokenDeployments.id, id), eq(tokenDeployments.userId, userId))).returning();
    return updated || undefined;
  }

  async deleteTokenDeployment(id: string, userId: string): Promise<boolean> {
    if (!userId) {
      throw new Error("userId is required for deleteTokenDeployment");
    }
    const result = await db.delete(tokenDeployments).where(and(eq(tokenDeployments.id, id), eq(tokenDeployments.userId, userId)));
    return true;
  }

  // Transaction operations
  async getTransactions(userId: string, walletId?: string): Promise<Transaction[]> {
    if (!userId) {
      throw new Error("userId is required for getTransactions");
    }
    // First get all wallet IDs for this user
    const userWallets = await this.getWallets(userId);
    const userWalletIds = userWallets.map(w => w.id);
    
    if (userWalletIds.length === 0) {
      return [];
    }
    
    // If specific walletId provided, verify it belongs to user
    if (walletId) {
      if (!userWalletIds.includes(walletId)) {
        return []; // Wallet doesn't belong to user
      }
      return await db.select().from(transactions).where(eq(transactions.walletId, walletId));
    }
    
    // Return transactions for all user's wallets
    const allTransactions: Transaction[] = [];
    for (const wId of userWalletIds) {
      const txs = await db.select().from(transactions).where(eq(transactions.walletId, wId));
      allTransactions.push(...txs);
    }
    return allTransactions;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const [updated] = await db.update(transactions).set(data).where(eq(transactions.id, id)).returning();
    return updated || undefined;
  }

  // Trade settings operations - ALL require userId
  async getTradeSettings(userId: string): Promise<TradeSetting | undefined> {
    if (!userId) {
      throw new Error("userId is required for getTradeSettings");
    }
    const [settings] = await db.select().from(tradeSettings).where(eq(tradeSettings.userId, userId));
    return settings || undefined;
  }

  async upsertTradeSettings(settings: InsertTradeSetting, userId: string): Promise<TradeSetting> {
    if (!userId) {
      throw new Error("userId is required for upsertTradeSettings");
    }
    const existing = await this.getTradeSettings(userId);
    if (existing) {
      const [updated] = await db
        .update(tradeSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(tradeSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(tradeSettings).values({ ...settings, userId }).returning();
    return created;
  }

  // Token holdings operations - ALL require userId
  async getTokenHoldings(userId: string, walletId?: string): Promise<TokenHolding[]> {
    if (!userId) {
      throw new Error("userId is required for getTokenHoldings");
    }
    if (walletId) {
      return await db.select().from(tokenHoldings).where(and(eq(tokenHoldings.userId, userId), eq(tokenHoldings.walletId, walletId)));
    }
    return await db.select().from(tokenHoldings).where(eq(tokenHoldings.userId, userId));
  }

  async getActiveHoldings(userId: string): Promise<TokenHolding[]> {
    if (!userId) {
      throw new Error("userId is required for getActiveHoldings");
    }
    return await db.select().from(tokenHoldings).where(and(eq(tokenHoldings.status, "holding"), eq(tokenHoldings.userId, userId)));
  }

  async getTokenHolding(id: string, userId: string): Promise<TokenHolding | undefined> {
    if (!userId) {
      throw new Error("userId is required for getTokenHolding");
    }
    const [holding] = await db.select().from(tokenHoldings).where(and(eq(tokenHoldings.id, id), eq(tokenHoldings.userId, userId)));
    return holding || undefined;
  }

  async createTokenHolding(holding: InsertTokenHolding): Promise<TokenHolding> {
    if (!holding.userId) {
      throw new Error("userId is required for createTokenHolding");
    }
    const [created] = await db.insert(tokenHoldings).values(holding).returning();
    return created;
  }

  async updateTokenHolding(id: string, data: Partial<TokenHolding>, userId: string): Promise<TokenHolding | undefined> {
    if (!userId) {
      throw new Error("userId is required for updateTokenHolding");
    }
    const [updated] = await db.update(tokenHoldings).set(data).where(and(eq(tokenHoldings.id, id), eq(tokenHoldings.userId, userId))).returning();
    return updated || undefined;
  }

  // Fee activity operations
  async getFeeActivities(tokenDeploymentId: string): Promise<FeeActivity[]> {
    return await db
      .select()
      .from(feeActivities)
      .where(eq(feeActivities.tokenDeploymentId, tokenDeploymentId))
      .orderBy(desc(feeActivities.createdAt));
  }

  async createFeeActivity(activity: InsertFeeActivity): Promise<FeeActivity> {
    const [created] = await db.insert(feeActivities).values(activity).returning();
    return created;
  }

  async getTokenDeploymentsWithAutoClaim(userId: string): Promise<TokenDeployment[]> {
    if (!userId) {
      throw new Error("userId is required for getTokenDeploymentsWithAutoClaim");
    }
    return await db
      .select()
      .from(tokenDeployments)
      .where(and(eq(tokenDeployments.autoClaimEnabled, true), eq(tokenDeployments.userId, userId)));
  }

  async updateTokenDeploymentFees(id: string, data: Partial<TokenDeployment>, userId: string): Promise<TokenDeployment | undefined> {
    if (!userId) {
      throw new Error("userId is required for updateTokenDeploymentFees");
    }
    const [updated] = await db
      .update(tokenDeployments)
      .set(data)
      .where(and(eq(tokenDeployments.id, id), eq(tokenDeployments.userId, userId)))
      .returning();
    return updated || undefined;
  }

  // INTERNAL METHODS FOR BACKGROUND SERVICES
  // These methods iterate over all users for automated processing
  // Each item includes userId for proper scoping in subsequent operations
  
  async internal_getAllMonitoringSettings(): Promise<TradeSetting[]> {
    return await db.select().from(tradeSettings).where(eq(tradeSettings.isMonitoring, true));
  }

  async internal_getAllActiveHoldings(): Promise<TokenHolding[]> {
    return await db.select().from(tokenHoldings).where(eq(tokenHoldings.status, "holding"));
  }

  async internal_getAllAutoClaimDeployments(): Promise<TokenDeployment[]> {
    return await db.select().from(tokenDeployments).where(eq(tokenDeployments.autoClaimEnabled, true));
  }

  async internal_getWalletUnsafe(id: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet || undefined;
  }

  async internal_updateTokenHoldingUnsafe(id: string, data: Partial<TokenHolding>): Promise<TokenHolding | undefined> {
    const [updated] = await db.update(tokenHoldings).set(data).where(eq(tokenHoldings.id, id)).returning();
    return updated || undefined;
  }

  async internal_getTokenDeploymentUnsafe(id: string): Promise<TokenDeployment | undefined> {
    const [deployment] = await db.select().from(tokenDeployments).where(eq(tokenDeployments.id, id));
    return deployment || undefined;
  }

  async internal_updateTokenDeploymentFeesUnsafe(id: string, data: Partial<TokenDeployment>): Promise<TokenDeployment | undefined> {
    const [updated] = await db.update(tokenDeployments).set(data).where(eq(tokenDeployments.id, id)).returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
