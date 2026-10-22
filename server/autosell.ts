import { storage } from "./storage";
import { sellTokenOnPumpFun, type SellResult } from "./pumpfun-sell";
import { sellTokenOnRaydium, getTokenDecimals } from "./raydium-api";
import { decrypt } from "./crypto";
import { getTokenPrice, getBatchPrices } from "./price-service";
import type { TokenHolding, TradeSetting } from "@shared/schema";
import { getNetworkStatus } from "./network-safety";

export interface AutoSellResult {
  holdingId: string;
  tokenSymbol: string;
  result: SellResult;
  reason: "take_profit" | "stop_loss" | "manual";
  priceSource?: string;
}

let autoSellInterval: NodeJS.Timeout | null = null;

export function checkShouldSell(
  holding: TokenHolding,
  currentPrice: number,
  settings: TradeSetting
): { shouldSell: boolean; reason?: "take_profit" | "stop_loss" } {
  if (!settings.autoSellEnabled) {
    return { shouldSell: false };
  }

  const priceChange = ((currentPrice - holding.buyPrice) / holding.buyPrice) * 100;

  if (settings.takeProfitPercent && priceChange >= settings.takeProfitPercent) {
    console.log(`[AutoSell] ${holding.tokenSymbol} hit take profit: ${priceChange.toFixed(2)}% >= ${settings.takeProfitPercent}%`);
    return { shouldSell: true, reason: "take_profit" };
  }

  if (settings.stopLossPercent && priceChange <= -settings.stopLossPercent) {
    console.log(`[AutoSell] ${holding.tokenSymbol} hit stop loss: ${priceChange.toFixed(2)}% <= -${settings.stopLossPercent}%`);
    return { shouldSell: true, reason: "stop_loss" };
  }

  return { shouldSell: false };
}

export async function executeSell(
  holding: TokenHolding,
  reason: "take_profit" | "stop_loss" | "manual"
): Promise<AutoSellResult> {
  const network = await getNetworkStatus();
  if (!network.transactionsEnabled) {
    return {
      holdingId: holding.id, tokenSymbol: holding.tokenSymbol,
      result: { success: false, error: network.reason }, reason,
    };
  }
  console.log(`[AutoSell] Executing ${reason} sell for ${holding.tokenSymbol}`);

  const wallet = await storage.internal_getWalletUnsafe(holding.walletId!);
  if (!wallet) {
    return {
      holdingId: holding.id,
      tokenSymbol: holding.tokenSymbol,
      result: { success: false, error: "Wallet not found" },
      reason,
    };
  }

  // Security sanity check: ensure wallet belongs to the same user as the holding
  if (wallet.userId !== holding.userId) {
    console.error(`[AutoSell] Security violation: wallet userId (${wallet.userId}) !== holding userId (${holding.userId})`);
    return {
      holdingId: holding.id,
      tokenSymbol: holding.tokenSymbol,
      result: { success: false, error: "User mismatch - security violation prevented" },
      reason,
    };
  }

  const tokenQuantity = holding.tokenQuantity || 0;
  if (tokenQuantity <= 0) {
    return {
      holdingId: holding.id,
      tokenSymbol: holding.tokenSymbol,
      result: { success: false, error: "No tokens to sell" },
      reason,
    };
  }

  // Decrypt private key before using for trading
  const decryptedPrivateKey = decrypt(wallet.privateKey);
  
  const sellResult = await sellTokenOnPumpFun(
    decryptedPrivateKey,
    holding.tokenMint,
    tokenQuantity
  );

  if (sellResult.success) {
    await storage.internal_updateTokenHoldingUnsafe(holding.id, {
      status: "sold",
      soldPrice: holding.currentPrice || holding.buyPrice,
      soldAmount: sellResult.solAmount,
      soldAt: new Date(),
    });

    await storage.createTransaction({
      walletId: wallet.id,
      type: reason === "manual" ? "manual_sell" : "auto_sell",
      amount: sellResult.solAmount || holding.buyAmount,
      toAddress: wallet.address,
      fromAddress: holding.tokenMint,
      signature: sellResult.signature,
      status: sellResult.success ? "confirmed" : "failed",
    });
  }

  console.log(`[AutoSell] ${holding.tokenSymbol}: ${sellResult.success ? "success" : "failed"}`);

  return {
    holdingId: holding.id,
    tokenSymbol: holding.tokenSymbol,
    result: sellResult,
    reason,
  };
}

async function executeSellWithGraduation(
  holding: TokenHolding,
  reason: "take_profit" | "stop_loss" | "manual",
  isGraduated: boolean,
  priceSource: string
): Promise<AutoSellResult> {
  console.log(`[AutoSell] Executing ${reason} sell for ${holding.tokenSymbol} via ${isGraduated ? "Raydium" : "Pump.fun"} (source: ${priceSource})`);

  const wallet = await storage.internal_getWalletUnsafe(holding.walletId!);
  if (!wallet) {
    return {
      holdingId: holding.id,
      tokenSymbol: holding.tokenSymbol,
      result: { success: false, error: "Wallet not found" },
      reason,
      priceSource,
    };
  }

  if (wallet.userId !== holding.userId) {
    console.error(`[AutoSell] Security violation: wallet userId (${wallet.userId}) !== holding userId (${holding.userId})`);
    return {
      holdingId: holding.id,
      tokenSymbol: holding.tokenSymbol,
      result: { success: false, error: "User mismatch - security violation prevented" },
      reason,
      priceSource,
    };
  }

  const tokenQuantity = holding.tokenQuantity || 0;
  if (tokenQuantity <= 0) {
    return {
      holdingId: holding.id,
      tokenSymbol: holding.tokenSymbol,
      result: { success: false, error: "No tokens to sell" },
      reason,
      priceSource,
    };
  }

  const decryptedPrivateKey = decrypt(wallet.privateKey);
  
  let sellResult: SellResult;
  
  if (isGraduated) {
    console.log(`[AutoSell] Token ${holding.tokenSymbol} graduated, using Raydium for sell`);
    
    // Fetch actual token decimals
    const tokenDecimals = await getTokenDecimals(holding.tokenMint);
    console.log(`[AutoSell] Token ${holding.tokenSymbol} has ${tokenDecimals} decimals`);
    
    // tokenQuantity from Pump.fun buys is in raw units (with decimals)
    // sellTokenOnRaydium expects human-readable units, so we convert
    const humanReadableQuantity = tokenQuantity / Math.pow(10, tokenDecimals);
    console.log(`[AutoSell] Converting ${tokenQuantity} raw -> ${humanReadableQuantity} human-readable tokens`);
    
    const raydiumResult = await sellTokenOnRaydium(
      decryptedPrivateKey,
      holding.tokenMint,
      humanReadableQuantity,
      tokenDecimals
    );
    sellResult = {
      success: raydiumResult.success,
      signature: raydiumResult.signature,
      solAmount: raydiumResult.outputAmount,
      error: raydiumResult.error,
    };
  } else {
    sellResult = await sellTokenOnPumpFun(
      decryptedPrivateKey,
      holding.tokenMint,
      tokenQuantity
    );
  }

  if (sellResult.success) {
    await storage.internal_updateTokenHoldingUnsafe(holding.id, {
      status: "sold",
      soldPrice: holding.currentPrice || holding.buyPrice,
      soldAmount: sellResult.solAmount,
      soldAt: new Date(),
    });

    await storage.createTransaction({
      walletId: wallet.id,
      type: reason === "manual" ? "manual_sell" : "auto_sell",
      amount: sellResult.solAmount || holding.buyAmount,
      toAddress: wallet.address,
      fromAddress: holding.tokenMint,
      signature: sellResult.signature,
      status: sellResult.success ? "confirmed" : "failed",
    });
  }

  console.log(`[AutoSell] ${holding.tokenSymbol} via ${isGraduated ? "Raydium" : "Pump.fun"}: ${sellResult.success ? "success" : "failed"}`);

  return {
    holdingId: holding.id,
    tokenSymbol: holding.tokenSymbol,
    result: sellResult,
    reason,
    priceSource,
  };
}

interface PriceResult {
  price: number;
  source: string;
  isGraduated: boolean;
}

async function fetchCurrentPrice(tokenMint: string, buyPrice: number): Promise<PriceResult> {
  const priceData = await getTokenPrice(tokenMint, buyPrice);
  
  return {
    price: priceData.price,
    source: priceData.source,
    isGraduated: priceData.isGraduated,
  };
}

async function updateHoldingPrice(holding: TokenHolding): Promise<PriceResult> {
  const result = await fetchCurrentPrice(holding.tokenMint, holding.buyPrice);
  await storage.internal_updateTokenHoldingUnsafe(holding.id, { currentPrice: result.price });
  return result;
}

export async function checkAndExecuteAutoSells(): Promise<void> {
  try {
    const allHoldings = await storage.internal_getAllActiveHoldings();
    if (allHoldings.length === 0) {
      return;
    }

    const holdingsByUser = new Map<string, TokenHolding[]>();
    for (const holding of allHoldings) {
      if (!holding.userId) continue;
      const existing = holdingsByUser.get(holding.userId) || [];
      existing.push(holding);
      holdingsByUser.set(holding.userId, existing);
    }

    for (const [userId, holdings] of Array.from(holdingsByUser.entries())) {
      const settings = await storage.getTradeSettings(userId);
      if (!settings || !settings.autoSellEnabled) {
        continue;
      }

      const tokenMints = holdings.map(h => h.tokenMint);
      const fallbackPrices = new Map<string, number>();
      holdings.forEach(h => fallbackPrices.set(h.tokenMint, h.buyPrice));
      
      const priceMap = await getBatchPrices(tokenMints, fallbackPrices);

      for (const holding of holdings) {
        const priceData = priceMap.get(holding.tokenMint);
        if (!priceData) continue;

        const currentPrice = priceData.price;
        const priceSource = priceData.source;
        const isGraduated = priceData.isGraduated;

        await storage.internal_updateTokenHoldingUnsafe(holding.id, { currentPrice });

        const { shouldSell, reason } = checkShouldSell(holding, currentPrice, settings);

        if (shouldSell && reason) {
          console.log(`[AutoSell] Triggering ${reason} for ${holding.tokenSymbol} (price source: ${priceSource}, graduated: ${isGraduated})`);
          const updatedHolding = { ...holding, currentPrice };
          await executeSellWithGraduation(updatedHolding, reason, isGraduated, priceSource);
        }
      }
    }
  } catch (error) {
    console.error("[AutoSell] Error checking auto-sells:", error);
  }
}

export function startAutoSellMonitor(): void {
  if (autoSellInterval) {
    console.log("[AutoSell] Monitor already running");
    return;
  }

  console.log("[AutoSell] Starting price monitor");
  autoSellInterval = setInterval(checkAndExecuteAutoSells, 5000);
}

export function stopAutoSellMonitor(): void {
  if (autoSellInterval) {
    clearInterval(autoSellInterval);
    autoSellInterval = null;
    console.log("[AutoSell] Monitor stopped");
  }
}

export function isAutoSellMonitorRunning(): boolean {
  return autoSellInterval !== null;
}
