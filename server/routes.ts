import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import multer from "multer";
import { storage } from "./storage";
import { authRouter, requireAuth } from "./auth";
import { getNetworkStatus, networkSafetyMiddleware } from "./network-safety";

// Configure multer for file uploads (memory storage for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

// Multer error handler middleware
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 5MB." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message || "Upload failed" });
  }
  next();
};
import { 
  generateKeypair, 
  importKeypair, 
  getBalance, 
  getBalances, 
  transferSol, 
  isValidAddress,
  requestAirdrop,
  getConnectionInfo,
  burnSplTokens,
  getTokenBalance
} from "./solana";
import { 
  initPumpfunStream, 
  getRecentTokens,
  getTrendingTokens,
  getTrendingTokensAsync,
  getTopMovers,
  getPumpfunConnectionStatus 
} from "./pumpfun";
import {
  executeSell,
  startAutoSellMonitor,
  stopAutoSellMonitor,
  isAutoSellMonitorRunning
} from "./autosell";
import { 
  createWalletFormSchema, 
  importWalletFormSchema, 
  transferFormSchema,
  tokenDeployFormSchema
} from "@shared/schema";
import { z } from "zod";
import { fetchTokenAnalytics, calculateRugSafetyScore } from "./token-analytics";
import { distributeFees, claimCreatorFees, startAutoClaimService } from "./fee-distribution";
import { encrypt, decrypt } from "./crypto";
import { getLPTokenInfo, burnLPTokens } from "./raydium-lp";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    walletAddress?: string;
  }
}

function getUserId(req: Request): string | undefined {
  return req.session?.userId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for secure cookies (Replit always uses a reverse proxy)
  const { isProduction } = await import("./env");
  
  // IMPORTANT: Always trust proxy in Replit environment
  app.set("trust proxy", 1);
  
  // Configure session middleware
  const PgSession = connectPgSimple(session);
  
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "zapera-secret-key",
      resave: false,
      saveUninitialized: false,
      name: "zapera.sid", // Custom session name to avoid conflicts
      proxy: true, // Trust the reverse proxy
      cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: isProduction ? "none" : "lax", // "none" required for cross-site in production
      },
    })
  );
  
  // Auth routes
  app.use("/api/auth", authRouter);
  app.get("/api/network/status", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await getNetworkStatus());
  });
  app.use("/api", networkSafetyMiddleware);
  
  // Get Solana connection info
  app.get("/api/solana/info", async (_req, res) => {
    try {
      const info = getConnectionInfo();
      res.json(info);
    } catch (error) {
      res.status(500).json({ error: "Failed to get Solana info" });
    }
  });

  // Get all wallets (private keys are excluded by default for security)
  app.get("/api/wallets", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const wallets = await storage.getWallets(userId);
      const includeKeys = req.query.includeKeys === "true";
      
      // By default, don't expose private keys in listings
      const safeWallets = wallets.map(wallet => ({
        ...wallet,
        privateKey: includeKeys ? wallet.privateKey : "••••••••••••",
      }));
      
      res.json(safeWallets);
    } catch (error) {
      console.error("Error fetching wallets:", error);
      res.status(500).json({ error: "Failed to fetch wallets" });
    }
  });
  
  // Get wallet private key (explicit request required)
  app.get("/api/wallets/:id/key", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const wallet = await storage.getWallet(req.params.id, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      const decryptedPrivateKey = decrypt(wallet.privateKey);
      res.json({ privateKey: decryptedPrivateKey });
    } catch (error) {
      console.error("Error decrypting private key:", error);
      res.status(500).json({ error: "Failed to fetch private key" });
    }
  });

  // Get single wallet
  app.get("/api/wallets/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const wallet = await storage.getWallet(req.params.id, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wallet" });
    }
  });

  // Create new wallet
  app.post("/api/wallets", requireAuth, async (req, res) => {
    try {
      console.log("[WALLET CREATE] Starting wallet creation...");
      
      const userId = getUserId(req);
      console.log("[WALLET CREATE] userId:", userId);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      console.log("[WALLET CREATE] Parsing request body:", req.body);
      const validatedData = createWalletFormSchema.parse(req.body);
      console.log("[WALLET CREATE] Validated data:", validatedData);
      
      console.log("[WALLET CREATE] Generating keypair...");
      const keypair = generateKeypair();
      console.log("[WALLET CREATE] Keypair generated, publicKey:", keypair.publicKey);
      
      console.log("[WALLET CREATE] Getting balance...");
      const balance = await getBalance(keypair.publicKey);
      console.log("[WALLET CREATE] Balance:", balance);
      
      console.log("[WALLET CREATE] Encrypting private key...");
      const encryptedPrivateKey = encrypt(keypair.privateKey);
      console.log("[WALLET CREATE] Private key encrypted, length:", encryptedPrivateKey.length);
      
      console.log("[WALLET CREATE] Saving to database...");
      const wallet = await storage.createWallet({
        label: validatedData.label,
        address: keypair.publicKey,
        privateKey: encryptedPrivateKey,
        balance,
        isActive: true,
        walletType: "created",
        userId,
      });
      console.log("[WALLET CREATE] Wallet saved:", wallet.id);
      
      res.status(201).json(wallet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[WALLET CREATE] Validation error:", error.errors);
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("[WALLET CREATE] Full error details:");
      console.error("[WALLET CREATE] Error type:", error?.constructor?.name);
      console.error("[WALLET CREATE] Error message:", error instanceof Error ? error.message : String(error));
      console.error("[WALLET CREATE] Error stack:", error instanceof Error ? error.stack : "No stack");
      
      // Return detailed error in response for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.constructor?.name || "Unknown";
      res.status(500).json({ 
        error: "Failed to create wallet",
        details: `${errorType}: ${errorMessage}`,
        step: "unknown"
      });
    }
  });

  // Import wallet
  app.post("/api/wallets/import", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const validatedData = importWalletFormSchema.parse(req.body);
      
      const keypair = importKeypair(validatedData.privateKey);
      
      const existing = await storage.getWalletByAddress(keypair.publicKey, userId);
      if (existing) {
        return res.status(400).json({ error: "Wallet already exists" });
      }
      
      const balance = await getBalance(keypair.publicKey);
      const encryptedPrivateKey = encrypt(keypair.privateKey);
      
      const wallet = await storage.createWallet({
        label: validatedData.label,
        address: keypair.publicKey,
        privateKey: encryptedPrivateKey,
        balance,
        isActive: true,
        walletType: "imported",
        userId,
      });
      
      res.status(201).json(wallet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      if (error instanceof Error && error.message === "Invalid private key format") {
        return res.status(400).json({ error: "Invalid private key format" });
      }
      console.error("Error importing wallet:", error);
      res.status(500).json({ error: "Failed to import wallet" });
    }
  });

  // Refresh all wallet balances
  app.post("/api/wallets/refresh", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const wallets = await storage.getWallets(userId);
      const addresses = wallets.map(w => w.address);
      const balances = await getBalances(addresses);
      
      await Promise.all(
        wallets.map(wallet => 
          storage.updateWallet(wallet.id, { 
            balance: balances.get(wallet.address) || 0 
          }, userId)
        )
      );
      
      res.json({ success: true, updated: wallets.length });
    } catch (error) {
      console.error("Error refreshing balances:", error);
      res.status(500).json({ error: "Failed to refresh balances" });
    }
  });

  // Transfer SOL
  app.post("/api/wallets/transfer", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const schema = transferFormSchema.extend({
        fromWalletId: z.string().min(1),
      });
      const validatedData = schema.parse(req.body);
      
      // Get source wallet
      const wallet = await storage.getWallet(validatedData.fromWalletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Source wallet not found" });
      }
      
      // Validate destination address
      if (!isValidAddress(validatedData.toAddress)) {
        return res.status(400).json({ error: "Invalid destination address" });
      }
      
      // Check balance
      if ((wallet.balance || 0) < validatedData.amount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      // Create transaction record
      const transaction = await storage.createTransaction({
        walletId: wallet.id,
        type: "transfer",
        amount: validatedData.amount,
        toAddress: validatedData.toAddress,
        fromAddress: wallet.address,
        status: "pending",
      });
      
      try {
        // Decrypt private key before transfer
        const decryptedPrivateKey = decrypt(wallet.privateKey);
        
        // Execute transfer
        const signature = await transferSol(
          decryptedPrivateKey,
          validatedData.toAddress,
          validatedData.amount
        );
        
        // Update transaction with signature
        await storage.updateTransaction(transaction.id, {
          signature,
          status: "confirmed",
        });
        
        // Refresh wallet balance
        const newBalance = await getBalance(wallet.address);
        await storage.updateWallet(wallet.id, { balance: newBalance }, userId);
        
        res.json({ success: true, signature, transaction });
      } catch (transferError) {
        // Update transaction as failed
        await storage.updateTransaction(transaction.id, {
          status: "failed",
        });
        throw transferError;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Transfer error:", error);
      res.status(500).json({ error: "Transfer failed" });
    }
  });

  // Delete wallet
  app.delete("/api/wallets/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deleted = await storage.deleteWallet(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting wallet:", error);
      res.status(500).json({ error: "Failed to delete wallet" });
    }
  });

  // Request airdrop (devnet only)
  app.post("/api/wallets/:id/airdrop", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const info = getConnectionInfo();
      if (!info.isDevnet) {
        return res.status(400).json({ error: "Airdrop only available on devnet" });
      }
      
      const wallet = await storage.getWallet(req.params.id, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const amount = req.body.amount || 1;
      const signature = await requestAirdrop(wallet.address, amount);
      
      // Refresh balance
      const newBalance = await getBalance(wallet.address);
      await storage.updateWallet(wallet.id, { balance: newBalance }, userId);
      
      res.json({ success: true, signature, newBalance });
    } catch (error) {
      console.error("Airdrop error:", error);
      res.status(500).json({ error: "Airdrop failed" });
    }
  });

  // Download selected wallets' private keys
  app.post("/api/wallets/download", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { walletIds } = req.body;
      if (!walletIds || !Array.isArray(walletIds) || walletIds.length === 0) {
        return res.status(400).json({ error: "walletIds array is required" });
      }
      
      const wallets = await storage.getWallets(userId);
      const selectedWallets = wallets.filter(w => walletIds.includes(w.id));
      
      const result = await Promise.all(
        selectedWallets.map(async (wallet) => ({
          label: wallet.label,
          address: wallet.address,
          privateKey: decrypt(wallet.privateKey),
        }))
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error downloading wallets:", error);
      res.status(500).json({ error: "Failed to download wallets" });
    }
  });

  // Cleanup wallets with zero balance
  app.post("/api/wallets/cleanup", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const wallets = await storage.getWallets(userId);
      const zeroBalanceWallets = wallets.filter(w => (w.balance || 0) === 0);
      
      let deleted = 0;
      for (const wallet of zeroBalanceWallets) {
        const success = await storage.deleteWallet(wallet.id, userId);
        if (success) deleted++;
      }
      
      res.json({ deleted });
    } catch (error) {
      console.error("Error cleaning up wallets:", error);
      res.status(500).json({ error: "Failed to cleanup wallets" });
    }
  });

  // Toggle archive status
  app.post("/api/wallets/:id/archive", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const wallet = await storage.getWallet(req.params.id, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const updated = await storage.updateWallet(wallet.id, {
        isArchived: !wallet.isArchived,
      }, userId);
      
      res.json(updated);
    } catch (error) {
      console.error("Error toggling archive status:", error);
      res.status(500).json({ error: "Failed to toggle archive status" });
    }
  });

  // Fund multiple wallets from source wallet
  app.post("/api/wallets/fund", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { sourceWalletId, targetWalletIds, amountPerWallet } = req.body;
      if (!sourceWalletId || !targetWalletIds || !Array.isArray(targetWalletIds) || targetWalletIds.length === 0) {
        return res.status(400).json({ error: "sourceWalletId, targetWalletIds array, and amountPerWallet are required" });
      }
      if (typeof amountPerWallet !== 'number' || amountPerWallet <= 0) {
        return res.status(400).json({ error: "amountPerWallet must be a positive number" });
      }
      
      const sourceWallet = await storage.getWallet(sourceWalletId, userId);
      if (!sourceWallet) {
        return res.status(404).json({ error: "Source wallet not found" });
      }
      
      const totalRequired = amountPerWallet * targetWalletIds.length;
      if ((sourceWallet.balance || 0) < totalRequired) {
        return res.status(400).json({ error: `Insufficient balance. Need ${totalRequired} SOL but have ${sourceWallet.balance || 0} SOL` });
      }
      
      const wallets = await storage.getWallets(userId);
      const targetWallets = wallets.filter(w => targetWalletIds.includes(w.id));
      
      const results: { walletId: string; success: boolean; signature?: string; error?: string }[] = [];
      const decryptedSourceKey = decrypt(sourceWallet.privateKey);
      
      for (const target of targetWallets) {
        try {
          const signature = await transferSol(decryptedSourceKey, target.address, amountPerWallet);
          results.push({ walletId: target.id, success: true, signature });
        } catch (err) {
          results.push({ walletId: target.id, success: false, error: err instanceof Error ? err.message : "Transfer failed" });
        }
      }
      
      // Refresh all wallet balances
      const allAddresses = [sourceWallet.address, ...targetWallets.map(w => w.address)];
      const balances = await getBalances(allAddresses);
      
      await storage.updateWallet(sourceWallet.id, { balance: balances.get(sourceWallet.address) || 0 }, userId);
      for (const target of targetWallets) {
        await storage.updateWallet(target.id, { balance: balances.get(target.address) || 0 }, userId);
      }
      
      res.json({ results, funded: results.filter(r => r.success).length });
    } catch (error) {
      console.error("Error funding wallets:", error);
      res.status(500).json({ error: "Failed to fund wallets" });
    }
  });

  // Consolidate SOL from multiple wallets to one target
  app.post("/api/wallets/consolidate", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { sourceWalletIds, targetWalletId } = req.body;
      if (!sourceWalletIds || !Array.isArray(sourceWalletIds) || sourceWalletIds.length === 0) {
        return res.status(400).json({ error: "sourceWalletIds array is required" });
      }
      if (!targetWalletId) {
        return res.status(400).json({ error: "targetWalletId is required" });
      }
      
      const targetWallet = await storage.getWallet(targetWalletId, userId);
      if (!targetWallet) {
        return res.status(404).json({ error: "Target wallet not found" });
      }
      
      const wallets = await storage.getWallets(userId);
      const sourceWallets = wallets.filter(w => sourceWalletIds.includes(w.id));
      
      const RENT_EXEMPT_MINIMUM = 0.001;
      const results: { walletId: string; success: boolean; amount?: number; signature?: string; error?: string }[] = [];
      
      for (const source of sourceWallets) {
        const balance = source.balance || 0;
        const amountToSend = balance - RENT_EXEMPT_MINIMUM;
        
        if (amountToSend <= 0) {
          results.push({ walletId: source.id, success: false, error: "Insufficient balance to consolidate" });
          continue;
        }
        
        try {
          const decryptedKey = decrypt(source.privateKey);
          const signature = await transferSol(decryptedKey, targetWallet.address, amountToSend);
          results.push({ walletId: source.id, success: true, amount: amountToSend, signature });
        } catch (err) {
          results.push({ walletId: source.id, success: false, error: err instanceof Error ? err.message : "Transfer failed" });
        }
      }
      
      // Refresh all wallet balances
      const allAddresses = [targetWallet.address, ...sourceWallets.map(w => w.address)];
      const balances = await getBalances(allAddresses);
      
      await storage.updateWallet(targetWallet.id, { balance: balances.get(targetWallet.address) || 0 }, userId);
      for (const source of sourceWallets) {
        await storage.updateWallet(source.id, { balance: balances.get(source.address) || 0 }, userId);
      }
      
      const totalConsolidated = results.filter(r => r.success).reduce((sum, r) => sum + (r.amount || 0), 0);
      res.json({ results, totalConsolidated, consolidated: results.filter(r => r.success).length });
    } catch (error) {
      console.error("Error consolidating wallets:", error);
      res.status(500).json({ error: "Failed to consolidate wallets" });
    }
  });

  // Get token balance for a wallet
  app.get("/api/wallets/:walletId/token/:tokenMint/balance", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { walletId, tokenMint } = req.params;
      
      const wallet = await storage.getWallet(walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const { balance, decimals } = await getTokenBalance(wallet.address, tokenMint);
      res.json({ balance, decimals, tokenMint, walletAddress: wallet.address });
    } catch (error) {
      console.error("Error getting token balance:", error);
      res.status(500).json({ error: "Failed to get token balance" });
    }
  });

  // Burn SPL tokens from wallet
  app.post("/api/wallets/burn", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { walletId, tokenMint, amount } = req.body;
      if (!walletId || !tokenMint || typeof amount !== 'number') {
        return res.status(400).json({ error: "walletId, tokenMint, and amount are required" });
      }
      if (amount <= 0) {
        return res.status(400).json({ error: "Amount must be positive" });
      }
      
      const wallet = await storage.getWallet(walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      // Decrypt private key before burning
      const decryptedPrivateKey = decrypt(wallet.privateKey);
      
      // Execute the actual burn transaction
      const result = await burnSplTokens(decryptedPrivateKey, tokenMint, amount);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Successfully burned ${amount} tokens`,
          signature: result.signature,
          walletId,
          tokenMint,
          amount
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error || "Burn failed",
          walletId,
          tokenMint,
          amount
        });
      }
    } catch (error) {
      console.error("Error burning tokens:", error);
      res.status(500).json({ error: "Failed to burn tokens" });
    }
  });

  // Token deployment endpoints
  app.get("/api/tokens", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deployments = await storage.getTokenDeployments(userId);
      res.json(deployments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch token deployments" });
    }
  });

  // Get single token deployment
  app.get("/api/tokens/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deployment = await storage.getTokenDeployment(req.params.id, userId);
      if (!deployment) {
        return res.status(404).json({ error: "Token not found" });
      }
      res.json(deployment);
    } catch (error) {
      console.error("Error fetching token:", error);
      res.status(500).json({ error: "Failed to fetch token deployment" });
    }
  });

  // Delete pending/failed token deployment
  app.delete("/api/tokens/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deployment = await storage.getTokenDeployment(req.params.id, userId);
      if (!deployment) {
        return res.status(404).json({ error: "Token not found" });
      }
      if (deployment.status === "deployed" && deployment.tokenAddress) {
        return res.status(400).json({ error: "Cannot delete deployed tokens" });
      }
      await storage.deleteTokenDeployment(req.params.id, userId);
      res.json({ success: true, message: "Token deployment deleted" });
    } catch (error) {
      console.error("Error deleting token:", error);
      res.status(500).json({ error: "Failed to delete token deployment" });
    }
  });

  app.post("/api/tokens/deploy", requireAuth, upload.single("logo"), handleMulterError, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Parse form data - fields come as strings when using multipart
      const parsedBuyAmount = parseFloat(req.body.initialBuyAmount);
      const formData = {
        ...req.body,
        initialBuyAmount: !isNaN(parsedBuyAmount) && parsedBuyAmount >= 0.01 ? parsedBuyAmount : 0.01,
      };
      
      const validatedData = tokenDeployFormSchema.parse(formData);
      
      const wallet = await storage.getWallet(validatedData.walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      // Get logo buffer if uploaded
      const logoBuffer = req.file?.buffer;
      
      const deployment = await storage.createTokenDeployment({
        name: validatedData.name,
        symbol: validatedData.symbol,
        description: validatedData.description || null,
        twitter: validatedData.twitter || null,
        telegram: validatedData.telegram || null,
        website: validatedData.website || null,
        platform: validatedData.platform,
        mode: validatedData.mode,
        walletId: validatedData.walletId,
        logoUrl: null,
        userId,
      });
      
      if (validatedData.platform === "pumpfun") {
        const { deployTokenViaPumpPortal } = await import("./pumpfun-deploy");
        
        console.log(`[Deploy] Starting Pump.fun deployment for ${validatedData.name}`);
        console.log(`[Deploy] Initial buy amount: ${validatedData.initialBuyAmount} SOL`);
        console.log(`[Deploy] Logo uploaded: ${logoBuffer ? `${logoBuffer.length} bytes` : "No"}`);
        
        // Decrypt private key before using for deployment
        const decryptedPrivateKey = decrypt(wallet.privateKey);
        
        const deployResult = await deployTokenViaPumpPortal(
          decryptedPrivateKey,
          {
            name: validatedData.name,
            symbol: validatedData.symbol,
            description: validatedData.description || "",
            twitter: validatedData.twitter,
            telegram: validatedData.telegram,
            website: validatedData.website,
          },
          validatedData.initialBuyAmount,
          logoBuffer
        );
        
        if (deployResult.success && deployResult.tokenAddress) {
          await storage.updateTokenDeployment(deployment.id, {
            status: "deployed",
            tokenAddress: deployResult.tokenAddress,
            txSignature: deployResult.signature,
          }, userId);
          
          // Create token holding for the initial buy
          if (validatedData.initialBuyAmount > 0) {
            try {
              // Initial price on bonding curve is approximately 0.000000028 SOL per token
              const estimatedTokenAmount = validatedData.initialBuyAmount / 0.000000028;
              const initialPrice = validatedData.initialBuyAmount / estimatedTokenAmount;
              
              await storage.createTokenHolding({
                walletId: validatedData.walletId,
                tokenMint: deployResult.tokenAddress,
                tokenName: validatedData.name,
                tokenSymbol: validatedData.symbol,
                tokenImage: null,
                buyPrice: initialPrice,
                buyAmount: validatedData.initialBuyAmount,
                tokenQuantity: estimatedTokenAmount,
                currentPrice: initialPrice,
                status: "holding",
                userId,
              });
              console.log(`[Deploy] Created holding for initial buy of ${validatedData.initialBuyAmount} SOL`);
            } catch (holdingError) {
              console.error("[Deploy] Failed to create holding:", holdingError);
              // Don't fail the deployment if holding creation fails
            }
          }
          
          return res.status(201).json({
            ...deployment,
            status: "deployed",
            tokenAddress: deployResult.tokenAddress,
            txSignature: deployResult.signature,
            message: "Token deployed successfully to Pump.fun!",
          });
        } else {
          await storage.updateTokenDeployment(deployment.id, {
            status: "failed",
          }, userId);
          
          return res.status(400).json({
            ...deployment,
            status: "failed",
            error: deployResult.error || "Deployment failed",
            message: "Token deployment failed. Please check wallet balance and try again.",
          });
        }
      }
      
      res.status(201).json({
        ...deployment,
        message: `Deployment request created for ${validatedData.platform}. Note: Only Pump.fun is currently supported for live deployment.`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Deployment error:", error);
      res.status(500).json({ error: "Failed to create deployment" });
    }
  });

  // Trade settings
  app.get("/api/trade/settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.getTradeSettings(userId);
      res.json(settings || { 
        solAmount: 0.1, 
        autoRedirect: false, 
        selectedWallets: [],
        isMonitoring: false,
        minMarketCap: null,
        maxMarketCap: null,
        requireTwitter: false,
        requireTelegram: false,
        requireWebsite: false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trade settings" });
    }
  });

  app.post("/api/trade/settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.upsertTradeSettings(req.body, userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to save trade settings" });
    }
  });

  app.put("/api/trade/settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.upsertTradeSettings(req.body, userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to save trade settings" });
    }
  });

  // Monitoring control endpoints
  app.post("/api/monitoring/start", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.upsertTradeSettings({ isMonitoring: true }, userId);
      console.log("[Monitoring] Auto-buy monitoring started");
      res.json({ success: true, isMonitoring: true, settings });
    } catch (error) {
      console.error("Error starting monitoring:", error);
      res.status(500).json({ error: "Failed to start monitoring" });
    }
  });

  app.post("/api/monitoring/stop", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.upsertTradeSettings({ isMonitoring: false }, userId);
      console.log("[Monitoring] Auto-buy monitoring stopped");
      res.json({ success: true, isMonitoring: false, settings });
    } catch (error) {
      console.error("Error stopping monitoring:", error);
      res.status(500).json({ error: "Failed to stop monitoring" });
    }
  });

  app.get("/api/monitoring/status", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.getTradeSettings(userId);
      const pumpfunStatus = getPumpfunConnectionStatus();
      res.json({
        isMonitoring: settings?.isMonitoring || false,
        pumpfunConnected: pumpfunStatus.connected,
        tokenCount: pumpfunStatus.tokenCount,
        settings: settings ? {
          solAmount: settings.solAmount,
          selectedWallets: settings.selectedWallets,
          minMarketCap: settings.minMarketCap,
          maxMarketCap: settings.maxMarketCap,
          requireTwitter: settings.requireTwitter,
          requireTelegram: settings.requireTelegram,
          requireWebsite: settings.requireWebsite,
        } : null,
      });
    } catch (error) {
      console.error("Error getting monitoring status:", error);
      res.status(500).json({ error: "Failed to get monitoring status" });
    }
  });

  // Transactions
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const walletId = req.query.walletId as string | undefined;
      const txs = await storage.getTransactions(userId, walletId);
      res.json(txs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Pumpfun new tokens feed
  app.get("/api/pumpfun/tokens", async (_req, res) => {
    try {
      const tokens = getRecentTokens();
      const status = getPumpfunConnectionStatus();
      res.json({ tokens, ...status });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Pumpfun tokens" });
    }
  });

  // Pumpfun trending tokens (most traded)
  app.get("/api/pumpfun/trending", async (_req, res) => {
    try {
      const tokens = await getTrendingTokensAsync();
      const status = getPumpfunConnectionStatus();
      res.json({ tokens, ...status });
    } catch (error) {
      console.error("[API] Error fetching trending:", error);
      res.status(500).json({ error: "Failed to fetch trending tokens" });
    }
  });

  // Pumpfun top movers (highest volume)
  app.get("/api/pumpfun/movers", async (_req, res) => {
    try {
      const tokens = getTopMovers();
      const status = getPumpfunConnectionStatus();
      res.json({ tokens, ...status });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top movers" });
    }
  });

  app.get("/api/pumpfun/status", async (_req, res) => {
    try {
      const status = getPumpfunConnectionStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get Pumpfun status" });
    }
  });

  // Search token by mint address using DexScreener
  app.get("/api/tokens/search/:mint", async (req, res) => {
    try {
      const { mint } = req.params;
      
      if (!mint || mint.length < 32) {
        return res.status(400).json({ error: "Invalid mint address" });
      }

      // Fetch token data from DexScreener
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Token not found" });
      }

      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        // Try Pump.fun API as fallback
        try {
          const pumpResponse = await fetch(`https://frontend-api.pump.fun/coins/${mint}`);
          if (pumpResponse.ok) {
            const pumpData = await pumpResponse.json();
            return res.json({
              found: true,
              source: "pumpfun",
              token: {
                mint: pumpData.mint,
                name: pumpData.name,
                symbol: pumpData.symbol,
                image: pumpData.image_uri,
                description: pumpData.description,
                twitter: pumpData.twitter,
                telegram: pumpData.telegram,
                website: pumpData.website,
                marketCapSol: pumpData.market_cap ? pumpData.market_cap / 1e9 : 0,
                priceUsd: pumpData.usd_market_cap ? pumpData.usd_market_cap / 1e9 : 0,
                bondingCurveProgress: pumpData.bonding_curve_progress || 0,
                complete: pumpData.complete || false,
                creator: pumpData.creator,
                createdAt: pumpData.created_timestamp,
              }
            });
          }
        } catch (pumpErr) {
          console.log("[Search] Pump.fun fallback failed:", pumpErr);
        }
        
        return res.status(404).json({ error: "Token not found on any exchange" });
      }

      // Get the best pair (highest liquidity)
      const pair = data.pairs.sort((a: any, b: any) => 
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      res.json({
        found: true,
        source: "dexscreener",
        token: {
          mint: mint,
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          image: pair.info?.imageUrl || null,
          description: null,
          twitter: pair.info?.socials?.find((s: any) => s.type === "twitter")?.url || null,
          telegram: pair.info?.socials?.find((s: any) => s.type === "telegram")?.url || null,
          website: pair.info?.websites?.[0]?.url || null,
          priceUsd: parseFloat(pair.priceUsd) || 0,
          priceChange24h: pair.priceChange?.h24 || 0,
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
          marketCap: pair.marketCap || 0,
          fdv: pair.fdv || 0,
          pairAddress: pair.pairAddress,
          dexId: pair.dexId,
          chainId: pair.chainId,
          complete: pair.dexId !== "pumpfun",
          bondingCurveProgress: pair.dexId === "pumpfun" ? 
            Math.min(100, ((pair.marketCap || 0) / 69000) * 100) : 100,
        },
        allPairs: data.pairs.slice(0, 5).map((p: any) => ({
          dexId: p.dexId,
          pairAddress: p.pairAddress,
          priceUsd: p.priceUsd,
          liquidity: p.liquidity?.usd || 0,
        }))
      });
    } catch (error) {
      console.error("[Search] Error:", error);
      res.status(500).json({ error: "Failed to search token" });
    }
  });

  // Token holdings endpoints
  app.get("/api/holdings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const walletId = req.query.walletId as string | undefined;
      const holdings = await storage.getTokenHoldings(userId, walletId);
      res.json(holdings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });

  app.get("/api/holdings/active", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const holdings = await storage.getActiveHoldings(userId);
      res.json(holdings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active holdings" });
    }
  });

  // Manual sell endpoint
  app.post("/api/holdings/:id/sell", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const holding = await storage.getTokenHolding(req.params.id, userId);
      if (!holding) {
        return res.status(404).json({ error: "Holding not found" });
      }
      if (holding.status !== "holding") {
        return res.status(400).json({ error: "Token already sold" });
      }
      
      const result = await executeSell(holding, "manual");
      res.json(result);
    } catch (error) {
      console.error("Manual sell error:", error);
      res.status(500).json({ error: "Failed to sell token" });
    }
  });

  // Auto-sell control endpoints
  app.post("/api/autosell/start", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.upsertTradeSettings({ autoSellEnabled: true }, userId);
      startAutoSellMonitor();
      res.json({ success: true, autoSellEnabled: true, settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to start auto-sell" });
    }
  });

  app.post("/api/autosell/stop", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.upsertTradeSettings({ autoSellEnabled: false }, userId);
      stopAutoSellMonitor();
      res.json({ success: true, autoSellEnabled: false, settings });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop auto-sell" });
    }
  });

  app.get("/api/autosell/status", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const settings = await storage.getTradeSettings(userId);
      res.json({
        autoSellEnabled: settings?.autoSellEnabled || false,
        takeProfitPercent: settings?.takeProfitPercent,
        stopLossPercent: settings?.stopLossPercent,
        isMonitorRunning: isAutoSellMonitorRunning(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get auto-sell status" });
    }
  });

  // Token Analytics endpoints
  app.get("/api/tokens/:id/analytics", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deployment = await storage.getTokenDeployment(req.params.id, userId);
      if (!deployment || !deployment.tokenAddress) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      const analytics = await fetchTokenAnalytics(deployment.tokenAddress);
      if (!analytics) {
        return res.status(404).json({ error: "Failed to fetch analytics" });
      }
      
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch token analytics" });
    }
  });

  app.get("/api/tokens/mint/:mint/analytics", async (req, res) => {
    try {
      const analytics = await fetchTokenAnalytics(req.params.mint);
      if (!analytics) {
        return res.status(404).json({ error: "Token not found" });
      }
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch token analytics" });
    }
  });

  // Rug Safety Score endpoint
  app.get("/api/tokens/:id/safety", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deployment = await storage.getTokenDeployment(req.params.id, userId);
      if (!deployment || !deployment.tokenAddress) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      const safetyScore = await calculateRugSafetyScore(deployment.tokenAddress);
      res.json(safetyScore);
    } catch (error) {
      console.error("Safety score error:", error);
      res.status(500).json({ error: "Failed to calculate safety score" });
    }
  });

  app.get("/api/tokens/mint/:mint/safety", async (req, res) => {
    try {
      const safetyScore = await calculateRugSafetyScore(req.params.mint);
      res.json(safetyScore);
    } catch (error) {
      console.error("Safety score error:", error);
      res.status(500).json({ error: "Failed to calculate safety score" });
    }
  });

  // Fee Distribution endpoints
  app.get("/api/tokens/:id/fees", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deployment = await storage.getTokenDeployment(req.params.id, userId);
      if (!deployment) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      const activities = await storage.getFeeActivities(req.params.id);
      
      res.json({
        deployment: {
          id: deployment.id,
          name: deployment.name,
          symbol: deployment.symbol,
          tokenAddress: deployment.tokenAddress,
          burnPercent: deployment.burnPercent,
          ammPercent: deployment.ammPercent,
          creatorPercent: deployment.creatorPercent,
          liquidityPercent: deployment.liquidityPercent,
          totalFeesCollected: deployment.totalFeesCollected,
          totalFeesDistributed: deployment.totalFeesDistributed,
          totalBurned: deployment.totalBurned,
          autoClaimEnabled: deployment.autoClaimEnabled,
          lastClaimAt: deployment.lastClaimAt,
        },
        activities,
      });
    } catch (error) {
      console.error("Fee info error:", error);
      res.status(500).json({ error: "Failed to fetch fee info" });
    }
  });

  app.put("/api/tokens/:id/fees/allocation", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { burnPercent, ammPercent, creatorPercent, liquidityPercent } = req.body;
      
      const total = (burnPercent || 0) + (ammPercent || 0) + (creatorPercent || 0) + (liquidityPercent || 0);
      if (total !== 100) {
        return res.status(400).json({ error: "Allocation percentages must total 100%" });
      }
      
      const updated = await storage.updateTokenDeployment(req.params.id, {
        burnPercent,
        ammPercent,
        creatorPercent,
        liquidityPercent,
      }, userId);
      
      if (!updated) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update allocation error:", error);
      res.status(500).json({ error: "Failed to update allocation" });
    }
  });

  app.post("/api/tokens/:id/fees/claim", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deployment = await storage.getTokenDeployment(req.params.id, userId);
      if (!deployment || !deployment.tokenAddress || !deployment.walletId) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      const wallet = await storage.getWallet(deployment.walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      // Decrypt private key before claiming fees
      const decryptedPrivateKey = decrypt(wallet.privateKey);
      const result = await claimCreatorFees(deployment.tokenAddress, decryptedPrivateKey);
      
      if (result.success && result.amount > 0) {
        await storage.updateTokenDeploymentFees(deployment.id, {
          totalFeesCollected: (deployment.totalFeesCollected || 0) + result.amount,
          lastClaimAt: new Date(),
        }, userId);
        
        await storage.createFeeActivity({
          tokenDeploymentId: deployment.id,
          activityType: "claim",
          amount: result.amount,
          txSignature: result.txSignature,
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Claim fees error:", error);
      res.status(500).json({ error: "Failed to claim fees" });
    }
  });

  app.post("/api/tokens/:id/fees/distribute", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      
      const deployment = await storage.getTokenDeployment(req.params.id, userId);
      if (!deployment || !deployment.walletId) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      const wallet = await storage.getWallet(deployment.walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      // Decrypt private key before distributing fees
      const decryptedPrivateKey = decrypt(wallet.privateKey);
      const result = await distributeFees(deployment.id, amount, decryptedPrivateKey);
      res.json(result);
    } catch (error) {
      console.error("Distribute fees error:", error);
      res.status(500).json({ error: "Failed to distribute fees" });
    }
  });

  app.post("/api/tokens/:id/autoclaim/toggle", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { enabled } = req.body;
      const updated = await storage.updateTokenDeployment(req.params.id, {
        autoClaimEnabled: enabled,
      }, userId);
      
      if (!updated) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Toggle autoclaim error:", error);
      res.status(500).json({ error: "Failed to toggle autoclaim" });
    }
  });

  // Quick Trade endpoints
  app.post("/api/trade/buy", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { walletId, tokenMint, solAmount, tokenName, tokenSymbol, tokenImage } = req.body;
      
      if (!walletId || !tokenMint || !solAmount) {
        return res.status(400).json({ error: "Missing required fields: walletId, tokenMint, solAmount" });
      }
      
      if (solAmount <= 0 || solAmount > 100) {
        return res.status(400).json({ error: "Invalid SOL amount (must be 0-100)" });
      }
      
      const wallet = await storage.getWallet(walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      if (!wallet.isActive) {
        return res.status(400).json({ error: "Wallet is inactive" });
      }
      
      if ((wallet.balance || 0) < solAmount) {
        return res.status(400).json({ error: `Insufficient balance: ${wallet.balance} SOL` });
      }
      
      console.log(`[QuickTrade] Buying ${solAmount} SOL of ${tokenMint} with wallet ${wallet.label}`);
      
      // Decrypt private key before buying
      const decryptedPrivateKey = decrypt(wallet.privateKey);
      
      // Use trade orchestrator for multi-platform fallback (Pump.fun → Raydium → Jupiter)
      const { orchestratedBuy } = await import("./trade-orchestrator");
      const buyResult = await orchestratedBuy(decryptedPrivateKey, tokenMint, solAmount);
      
      await storage.createTransaction({
        walletId: wallet.id,
        type: "quick_buy",
        amount: solAmount,
        toAddress: tokenMint,
        fromAddress: wallet.address,
        signature: buyResult.signature,
        status: buyResult.success ? "confirmed" : "failed",
      });
      
      if (buyResult.success && buyResult.tokenAmount) {
        const pricePerToken = buyResult.tokenAmount > 0 ? solAmount / buyResult.tokenAmount : 0;
        
        await storage.createTokenHolding({
          walletId: wallet.id,
          tokenMint: tokenMint,
          tokenName: tokenName || "Unknown",
          tokenSymbol: tokenSymbol || "???",
          tokenImage: tokenImage || null,
          buyPrice: pricePerToken,
          buyAmount: solAmount,
          tokenQuantity: buyResult.tokenAmount,
          currentPrice: pricePerToken,
          status: "holding",
          userId,
        });
        
        console.log(`[QuickTrade] Created holding: ${buyResult.tokenAmount} tokens at ${pricePerToken} SOL/token`);
      }
      
      res.json({
        success: buyResult.success,
        signature: buyResult.signature,
        tokenAmount: buyResult.tokenAmount,
        solAmount: buyResult.solAmount,
        platform: buyResult.platform,
        error: buyResult.error,
        attempts: buyResult.attempts,
      });
    } catch (error) {
      console.error("[QuickTrade] Buy error:", error);
      res.status(500).json({ error: "Failed to buy token" });
    }
  });

  app.post("/api/trade/sell", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { walletId, tokenMint, percentage } = req.body;
      
      if (!walletId || !tokenMint) {
        return res.status(400).json({ error: "Missing required fields: walletId, tokenMint" });
      }
      
      const sellPercent = Math.min(100, Math.max(1, percentage || 100));
      
      // Find holding for this token/wallet
      const holdings = await storage.getTokenHoldings(userId, walletId);
      const holding = holdings.find(h => h.tokenMint === tokenMint && h.status === "holding");
      
      if (!holding) {
        return res.status(404).json({ error: "No active holding found for this token" });
      }
      
      const wallet = await storage.getWallet(walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const tokenQuantity = Math.floor((holding.tokenQuantity || 0) * (sellPercent / 100));
      if (tokenQuantity <= 0) {
        return res.status(400).json({ error: "No tokens to sell" });
      }
      
      console.log(`[QuickTrade] Selling ${sellPercent}% (${tokenQuantity} tokens) of ${tokenMint}`);
      
      // Decrypt private key before selling
      const decryptedPrivateKey = decrypt(wallet.privateKey);
      
      const { sellTokenOnPumpFun } = await import("./pumpfun-sell");
      const sellResult = await sellTokenOnPumpFun(decryptedPrivateKey, tokenMint, tokenQuantity, 500, sellPercent);
      
      if (sellResult.success) {
        if (sellPercent === 100) {
          await storage.updateTokenHolding(holding.id, {
            status: "sold",
            soldPrice: holding.currentPrice || holding.buyPrice,
            soldAmount: sellResult.solAmount,
            soldAt: new Date(),
          }, userId);
        } else {
          // Partial sell - update quantity
          await storage.updateTokenHolding(holding.id, {
            tokenQuantity: (holding.tokenQuantity || 0) - tokenQuantity,
          }, userId);
        }
        
        await storage.createTransaction({
          walletId: wallet.id,
          type: "quick_sell",
          amount: sellResult.solAmount || 0,
          toAddress: wallet.address,
          fromAddress: tokenMint,
          signature: sellResult.signature,
          status: "confirmed",
        });
      }
      
      res.json({
        success: sellResult.success,
        signature: sellResult.signature,
        tokenAmount: tokenQuantity,
        solAmount: sellResult.solAmount,
        platform: sellResult.platform,
        error: sellResult.error,
      });
    } catch (error) {
      console.error("[QuickTrade] Sell error:", error);
      res.status(500).json({ error: "Failed to sell token" });
    }
  });

  // Check if token has graduated from Pump.fun to Raydium
  app.get("/api/tokens/mint/:mint/status", async (req, res) => {
    try {
      const { fetchTokenInfo } = await import("./pumpfun-api");
      const tokenInfo = await fetchTokenInfo(req.params.mint);
      
      if (!tokenInfo) {
        return res.status(404).json({ error: "Token not found" });
      }
      
      res.json({
        mint: req.params.mint,
        graduated: tokenInfo.complete,
        tradingPlatform: tokenInfo.complete ? "raydium" : "pumpfun",
        bondingCurve: tokenInfo.bondingCurve,
        virtualSolReserves: tokenInfo.virtualSolReserves,
        virtualTokenReserves: tokenInfo.virtualTokenReserves,
      });
    } catch (error) {
      console.error("Error checking token status:", error);
      res.status(500).json({ error: "Failed to check token status" });
    }
  });

  // Get holdings for a specific token
  app.get("/api/holdings/token/:mint", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const holdings = await storage.getActiveHoldings(userId);
      const tokenHoldings = holdings.filter(h => h.tokenMint === req.params.mint);
      res.json(tokenHoldings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });

  // Price history cache (5 minute TTL)
  const priceHistoryCache = new Map<string, { data: any[]; timestamp: number }>();
  const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Price history endpoint for charts - uses real Pump.fun trade data
  app.get("/api/tokens/mint/:mint/price-history", async (req, res) => {
    try {
      const mint = req.params.mint;
      
      // Check cache first
      const cached = priceHistoryCache.get(mint);
      if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        console.log(`[PriceHistory] Returning cached data for ${mint}`);
        return res.json(cached.data);
      }
      
      // Fetch real trades from Pump.fun API
      console.log(`[PriceHistory] Fetching trades for ${mint}`);
      let priceHistory: { time: number; value: number }[] = [];
      
      try {
        const tradesResponse = await fetch(
          `https://frontend-api.pump.fun/trades/latest/${mint}?limit=200`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'KiaraFun/1.0',
            },
          }
        );
        
        if (tradesResponse.ok) {
          const trades = await tradesResponse.json();
          
          if (Array.isArray(trades) && trades.length > 0) {
            // Group trades by 5-minute intervals and calculate average price
            const intervalMs = 5 * 60 * 1000; // 5 minutes
            const priceByInterval = new Map<number, { prices: number[]; count: number }>();
            
            for (const trade of trades) {
              // Parse trade data - Pump.fun returns sol_amount and token_amount
              const solAmount = parseFloat(trade.sol_amount || trade.solAmount || 0);
              const tokenAmount = parseFloat(trade.token_amount || trade.tokenAmount || 0);
              const timestamp = trade.timestamp || trade.block_timestamp || Date.now();
              
              if (tokenAmount > 0 && solAmount > 0) {
                const price = solAmount / tokenAmount;
                const intervalTime = Math.floor(timestamp / intervalMs) * intervalMs;
                const intervalSeconds = Math.floor(intervalTime / 1000);
                
                if (!priceByInterval.has(intervalSeconds)) {
                  priceByInterval.set(intervalSeconds, { prices: [], count: 0 });
                }
                const interval = priceByInterval.get(intervalSeconds)!;
                interval.prices.push(price);
                interval.count++;
              }
            }
            
            // Convert to sorted array of price points
            const sortedIntervals = Array.from(priceByInterval.entries())
              .sort((a, b) => a[0] - b[0]);
            
            for (const [time, data] of sortedIntervals) {
              const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
              priceHistory.push({
                time,
                value: avgPrice,
              });
            }
            
            console.log(`[PriceHistory] Parsed ${priceHistory.length} price points from ${trades.length} trades`);
          }
        } else {
          console.log(`[PriceHistory] Pump.fun API returned status ${tradesResponse.status}`);
        }
      } catch (apiError) {
        console.error("[PriceHistory] Error fetching from Pump.fun API:", apiError);
      }
      
      // If no trade data, try to get current price from bonding curve
      if (priceHistory.length === 0) {
        try {
          const { fetchTokenInfo } = await import("./pumpfun-api");
          const tokenInfo = await fetchTokenInfo(mint);
          
          if (tokenInfo && tokenInfo.virtualSolReserves && tokenInfo.virtualTokenReserves) {
            // Calculate current price from bonding curve
            const currentPrice = tokenInfo.virtualSolReserves / tokenInfo.virtualTokenReserves;
            const now = Math.floor(Date.now() / 1000);
            
            // A current observation is not historical data. Never invent earlier
            // points: clients can show an insufficient-history state.
            priceHistory = [{ time: now, value: currentPrice }];
            console.log("[PriceHistory] Returning one current bonding-curve observation");
          }
        } catch (bondingError) {
          console.error("[PriceHistory] Error fetching bonding curve data:", bondingError);
        }
      }
      
      // Cache the result (even if empty)
      priceHistoryCache.set(mint, { data: priceHistory, timestamp: Date.now() });
      
      // Return the data (empty array is valid - UI will show appropriate message)
      res.json(priceHistory);
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });

  // LP token info endpoint
  app.get("/api/tokens/mint/:mint/lp-info", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { walletId } = req.query;
      if (!walletId || typeof walletId !== "string") {
        return res.status(400).json({ error: "Wallet ID is required" });
      }
      
      const wallet = await storage.getWallet(walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const lpInfo = await getLPTokenInfo(req.params.mint, wallet.address);
      res.json(lpInfo);
    } catch (error) {
      console.error("Error fetching LP info:", error);
      res.status(500).json({ error: "Failed to fetch LP token info" });
    }
  });

  // Burn LP tokens endpoint with confirmation requirement
  app.post("/api/tokens/mint/:mint/burn-lp", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { walletId, amount, lpMint, decimals, confirmed } = req.body;
      
      // Require explicit confirmation
      if (!confirmed) {
        return res.status(400).json({ 
          error: "Confirmation required. This action is irreversible.",
          requiresConfirmation: true 
        });
      }
      
      if (!walletId || !lpMint) {
        return res.status(400).json({ error: "Missing required fields: walletId, lpMint" });
      }
      
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number greater than 0" });
      }
      
      // Verify wallet ownership
      const wallet = await storage.getWallet(walletId, userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found or not owned by you" });
      }
      
      // Validate LP balance before burning
      const { validateLPBurn } = await import("./raydium-lp");
      const validation = await validateLPBurn(lpMint, wallet.address, amount, decimals || 9);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          error: validation.error,
          actualBalance: validation.actualBalance 
        });
      }
      
      // Check if token has graduated (LP only exists after graduation)
      try {
        const { fetchTokenInfo } = await import("./pumpfun-api");
        const tokenInfo = await fetchTokenInfo(req.params.mint);
        if (tokenInfo && !tokenInfo.complete) {
          return res.status(400).json({ 
            error: "Token has not graduated to Raydium yet. LP burning is only available for graduated tokens." 
          });
        }
      } catch (e) {
        console.log("[LP Burn] Could not verify token graduation status, proceeding with burn");
      }
      
      console.log(`[LP Burn] User ${userId} burning ${amount} LP tokens from wallet ${wallet.address}`);
      
      const decryptedPrivateKey = decrypt(wallet.privateKey);
      const result = await burnLPTokens(decryptedPrivateKey, lpMint, amount, decimals || 9);
      
      if (result.success) {
        await storage.createTransaction({
          walletId: wallet.id,
          type: "burn_lp",
          amount: amount,
          toAddress: "burn",
          fromAddress: wallet.address,
          signature: result.signature,
          status: "confirmed",
        });
        console.log(`[LP Burn] Successfully burned ${amount} LP tokens. Signature: ${result.signature}`);
      } else {
        console.log(`[LP Burn] Burn failed: ${result.error}`);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error burning LP tokens:", error);
      res.status(500).json({ error: "Failed to burn LP tokens" });
    }
  });

  // Initialize Pumpfun WebSocket stream
  initPumpfunStream();
  
  // Start auto-claim service
  startAutoClaimService();

  return httpServer;
}
