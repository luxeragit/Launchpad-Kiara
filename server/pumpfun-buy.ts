import { buyTokenTransaction, fetchTokenInfo } from "./pumpfun-api";
import { buyTokenOnRaydium } from "./raydium-api";

export interface BuyResult {
  success: boolean;
  signature?: string;
  tokenAmount?: number;
  solAmount?: number;
  error?: string;
  platform?: "pumpfun" | "raydium";
}

export async function buyTokenOnPumpFun(
  privateKey: string,
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 500
): Promise<BuyResult> {
  console.log(`[Trade] Buying ${solAmount} SOL of ${tokenMint}`);
  
  const tokenInfo = await fetchTokenInfo(tokenMint);
  
  if (tokenInfo && tokenInfo.complete) {
    console.log(`[Trade] Token ${tokenMint} has graduated - using Raydium`);
    
    const raydiumResult = await buyTokenOnRaydium(privateKey, tokenMint, solAmount, slippageBps);
    
    return {
      success: raydiumResult.success,
      signature: raydiumResult.signature,
      tokenAmount: raydiumResult.outputAmount,
      solAmount: solAmount,
      error: raydiumResult.error,
      platform: "raydium",
    };
  }
  
  console.log(`[Trade] Token ${tokenMint} on bonding curve - using Pump.fun`);
  const result = await buyTokenTransaction(privateKey, tokenMint, solAmount, slippageBps);
  
  return {
    success: result.success,
    signature: result.signature,
    tokenAmount: result.tokenAmount,
    solAmount: result.solAmount,
    error: result.error,
    platform: "pumpfun",
  };
}
