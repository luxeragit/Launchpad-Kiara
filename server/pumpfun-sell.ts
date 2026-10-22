import { sellTokenTransaction, fetchTokenInfo } from "./pumpfun-api";
import { sellTokenOnRaydium, getTokenDecimals } from "./raydium-api";

export interface SellResult {
  success: boolean;
  signature?: string;
  tokenAmount?: number;
  solAmount?: number;
  error?: string;
  platform?: "pumpfun" | "raydium";
}

export async function sellTokenOnPumpFun(
  privateKey: string,
  tokenMint: string,
  tokenAmount: number,
  slippageBps: number = 500,
  sellPercentage: number = 100
): Promise<SellResult> {
  console.log(`[Trade] Selling ${sellPercentage}% (${tokenAmount} tokens) of ${tokenMint}`);
  
  const tokenInfo = await fetchTokenInfo(tokenMint);
  
  if (tokenInfo && tokenInfo.complete) {
    console.log(`[Trade] Token ${tokenMint} has graduated - using Raydium`);
    
    const decimals = await getTokenDecimals(tokenMint);
    const raydiumResult = await sellTokenOnRaydium(privateKey, tokenMint, tokenAmount, decimals, slippageBps);
    
    return {
      success: raydiumResult.success,
      signature: raydiumResult.signature,
      tokenAmount: tokenAmount,
      solAmount: raydiumResult.outputAmount,
      error: raydiumResult.error,
      platform: "raydium",
    };
  }
  
  console.log(`[Trade] Token ${tokenMint} on bonding curve - using Pump.fun`);
  // Pass percentage to PumpPortal API for more reliable selling
  const result = await sellTokenTransaction(privateKey, tokenMint, tokenAmount, slippageBps, sellPercentage);
  
  return {
    success: result.success,
    signature: result.signature,
    tokenAmount: result.tokenAmount,
    solAmount: result.solAmount,
    error: result.error,
    platform: "pumpfun",
  };
}
