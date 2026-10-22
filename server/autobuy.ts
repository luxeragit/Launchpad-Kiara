import { storage } from "./storage";
import { buyTokenOnPumpFun, type BuyResult } from "./pumpfun-buy";
import { decrypt } from "./crypto";
import type { TradeSetting, Wallet } from "@shared/schema";

export interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  marketCapSol?: number;
  volume24h?: number;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface AutoBuyResult {
  walletId: string;
  walletAddress: string;
  result: BuyResult;
}

type AutoBuyCallback = (token: TokenData) => void;

let autoBuyCallback: AutoBuyCallback | null = null;

export function registerAutoBuyCallback(callback: AutoBuyCallback): void {
  autoBuyCallback = callback;
  console.log("[AutoBuy] Callback registered");
}

export function triggerAutoBuyCallback(token: TokenData): void {
  if (autoBuyCallback) {
    autoBuyCallback(token);
  }
}

export function checkTokenMatchesFilters(
  token: TokenData,
  settings: TradeSetting
): boolean {
  if (settings.minMarketCap !== null && settings.minMarketCap !== undefined) {
    if (!token.marketCapSol || token.marketCapSol < settings.minMarketCap) {
      console.log(`[AutoBuy] Token ${token.symbol} rejected: market cap ${token.marketCapSol} < min ${settings.minMarketCap}`);
      return false;
    }
  }

  if (settings.maxMarketCap !== null && settings.maxMarketCap !== undefined) {
    if (!token.marketCapSol || token.marketCapSol > settings.maxMarketCap) {
      console.log(`[AutoBuy] Token ${token.symbol} rejected: market cap ${token.marketCapSol} > max ${settings.maxMarketCap}`);
      return false;
    }
  }

  if (settings.requireTwitter && !token.twitter) {
    console.log(`[AutoBuy] Token ${token.symbol} rejected: no Twitter link`);
    return false;
  }

  if (settings.requireTelegram && !token.telegram) {
    console.log(`[AutoBuy] Token ${token.symbol} rejected: no Telegram link`);
    return false;
  }

  if (settings.requireWebsite && !token.website) {
    console.log(`[AutoBuy] Token ${token.symbol} rejected: no Website link`);
    return false;
  }

  // Vol/MCap ratio filter - only apply when:
  // 1. Filter is explicitly set (not null/undefined)
  // 2. Token has valid volume data (volume > 0)
  const hasMinVolMcapFilter = settings.minVolMcapRatio !== null && settings.minVolMcapRatio !== undefined && settings.minVolMcapRatio > 0;
  const hasMaxVolMcapFilter = settings.maxVolMcapRatio !== null && settings.maxVolMcapRatio !== undefined && settings.maxVolMcapRatio > 0;
  
  if (hasMinVolMcapFilter || hasMaxVolMcapFilter) {
    // Filter is set, check if token has valid volume data
    if (token.volume24h && token.volume24h > 0 && token.marketCapSol && token.marketCapSol > 0) {
      const volMcapRatio = (token.volume24h / token.marketCapSol) * 100;
      console.log(`[AutoBuy] Token ${token.symbol} Vol/MCap ratio: ${volMcapRatio.toFixed(2)}%`);
      
      if (hasMinVolMcapFilter && volMcapRatio < settings.minVolMcapRatio!) {
        console.log(`[AutoBuy] Token ${token.symbol} rejected: Vol/MCap ratio ${volMcapRatio.toFixed(2)}% < min ${settings.minVolMcapRatio}%`);
        return false;
      }
      
      if (hasMaxVolMcapFilter && volMcapRatio > settings.maxVolMcapRatio!) {
        console.log(`[AutoBuy] Token ${token.symbol} rejected: Vol/MCap ratio ${volMcapRatio.toFixed(2)}% > max ${settings.maxVolMcapRatio}%`);
        return false;
      }
    } else {
      // Token has no valid volume data - skip filter but log it
      console.log(`[AutoBuy] Token ${token.symbol}: Vol/MCap filter set but token has no volume data (volume=${token.volume24h}, mcap=${token.marketCapSol}) - skipping filter`);
    }
  } else {
    console.log(`[AutoBuy] Token ${token.symbol}: Vol/MCap filter not set, skipping check`);
  }

  console.log(`[AutoBuy] Token ${token.symbol} matches all filters`);
  return true;
}

export async function executeAutoBuy(
  token: TokenData,
  walletIds: string[],
  solAmount: number,
  userId: string
): Promise<AutoBuyResult[]> {
  const results: AutoBuyResult[] = [];

  console.log(`[AutoBuy] Executing auto-buy for ${token.symbol} (${token.mint})`);
  console.log(`[AutoBuy] Wallets: ${walletIds.length}, Amount: ${solAmount} SOL each, userId: ${userId}`);

  for (const walletId of walletIds) {
    const wallet = await storage.getWallet(walletId, userId);
    
    if (!wallet) {
      console.log(`[AutoBuy] Wallet ${walletId} not found, skipping`);
      results.push({
        walletId,
        walletAddress: "unknown",
        result: {
          success: false,
          error: "Wallet not found",
        },
      });
      continue;
    }

    if (!wallet.isActive) {
      console.log(`[AutoBuy] Wallet ${wallet.label} is inactive, skipping`);
      results.push({
        walletId,
        walletAddress: wallet.address,
        result: {
          success: false,
          error: "Wallet is inactive",
        },
      });
      continue;
    }

    if ((wallet.balance || 0) < solAmount) {
      console.log(`[AutoBuy] Wallet ${wallet.label} has insufficient balance (${wallet.balance} < ${solAmount})`);
      results.push({
        walletId,
        walletAddress: wallet.address,
        result: {
          success: false,
          error: `Insufficient balance: ${wallet.balance} SOL`,
        },
      });
      continue;
    }

    // Decrypt private key before using for trading
    const decryptedPrivateKey = decrypt(wallet.privateKey);
    
    const buyResult = await buyTokenOnPumpFun(
      decryptedPrivateKey,
      token.mint,
      solAmount
    );

    await storage.createTransaction({
      walletId: wallet.id,
      type: "auto_buy",
      amount: solAmount,
      toAddress: token.mint,
      fromAddress: wallet.address,
      signature: buyResult.signature,
      status: buyResult.success ? "confirmed" : "failed",
    });

    if (buyResult.success && buyResult.tokenAmount) {
      const pricePerToken = buyResult.tokenAmount > 0 
        ? solAmount / buyResult.tokenAmount 
        : 0;
      
      await storage.createTokenHolding({
        walletId: wallet.id,
        tokenMint: token.mint,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        tokenImage: token.image,
        buyPrice: pricePerToken,
        buyAmount: solAmount,
        tokenQuantity: buyResult.tokenAmount,
        currentPrice: pricePerToken,
        status: "holding",
        userId,
      });
      console.log(`[AutoBuy] Created holding for ${token.symbol}: ${buyResult.tokenAmount} tokens at ${pricePerToken} SOL/token (${solAmount} SOL total)`);
    }

    results.push({
      walletId,
      walletAddress: wallet.address,
      result: buyResult,
    });

    console.log(`[AutoBuy] Wallet ${wallet.label}: ${buyResult.success ? "success" : "failed"}`);
  }

  return results;
}

export async function processNewToken(token: TokenData): Promise<void> {
  try {
    // Get all users with monitoring enabled using internal method
    const allSettings = await storage.internal_getAllMonitoringSettings();

    if (allSettings.length === 0) {
      return;
    }

    for (const settings of allSettings) {
      if (!settings.userId) {
        console.log("[AutoBuy] Settings missing userId, skipping");
        continue;
      }

      if (!settings.selectedWallets || settings.selectedWallets.length === 0) {
        console.log(`[AutoBuy] User ${settings.userId}: No wallets selected, skipping`);
        continue;
      }

      if (!checkTokenMatchesFilters(token, settings)) {
        continue;
      }

      const solAmount = settings.solAmount || 0.1;
      const results = await executeAutoBuy(token, settings.selectedWallets, solAmount, settings.userId);

      const successCount = results.filter(r => r.result.success).length;
      console.log(`[AutoBuy] User ${settings.userId}: ${successCount}/${results.length} successful buys for ${token.symbol}`);
    }
  } catch (error) {
    console.error("[AutoBuy] Error processing new token:", error);
  }
}

registerAutoBuyCallback(processNewToken);
