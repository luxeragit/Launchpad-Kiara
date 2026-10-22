import { fetchTokenInfo, buyTokenTransaction, sellTokenTransaction } from "./pumpfun-api";
import { buyTokenOnJupiter, sellTokenOnJupiter, canBuyOnJupiter } from "./jupiter-api";
import { buyTokenOnRaydium, sellTokenOnRaydium } from "./raydium-api";

export type TradePlatform = "pumpfun" | "raydium" | "jupiter";

export interface TradeAttempt {
  platform: TradePlatform;
  success: boolean;
  error?: string;
  signature?: string;
  tokenAmount?: number;
  solAmount?: number;
}

export interface OrchestratedTradeResult {
  success: boolean;
  platform?: TradePlatform;
  signature?: string;
  tokenAmount?: number;
  solAmount?: number;
  error?: string;
  attempts: TradeAttempt[];
}

export interface TokenContext {
  mint: string;
  hasBondingCurve: boolean;
  isGraduated: boolean;
  hasJupiterLiquidity: boolean;
  bondingCurveAddress?: string;
}

async function buildTokenContext(tokenMint: string): Promise<TokenContext> {
  const context: TokenContext = {
    mint: tokenMint,
    hasBondingCurve: false,
    isGraduated: false,
    hasJupiterLiquidity: false,
  };

  try {
    const tokenInfo = await fetchTokenInfo(tokenMint);
    if (tokenInfo) {
      context.hasBondingCurve = true;
      context.isGraduated = tokenInfo.complete;
      context.bondingCurveAddress = tokenInfo.bondingCurve;
    }
  } catch (error) {
    console.log(`[Orchestrator] Could not fetch Pump.fun info for ${tokenMint}`);
  }

  try {
    context.hasJupiterLiquidity = await canBuyOnJupiter(tokenMint);
  } catch (error) {
    console.log(`[Orchestrator] Could not check Jupiter liquidity for ${tokenMint}`);
  }

  console.log(`[Orchestrator] Token context for ${tokenMint}:`, {
    hasBondingCurve: context.hasBondingCurve,
    isGraduated: context.isGraduated,
    hasJupiterLiquidity: context.hasJupiterLiquidity,
  });

  return context;
}

export async function orchestratedBuy(
  privateKey: string,
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 500
): Promise<OrchestratedTradeResult> {
  const attempts: TradeAttempt[] = [];
  
  console.log(`[Orchestrator] Starting buy for ${solAmount} SOL of ${tokenMint}`);
  
  const context = await buildTokenContext(tokenMint);

  if (context.hasBondingCurve && !context.isGraduated) {
    console.log(`[Orchestrator] Attempting Pump.fun buy (token has bonding curve)`);
    try {
      const result = await buyTokenTransaction(privateKey, tokenMint, solAmount, slippageBps);
      const attempt: TradeAttempt = {
        platform: "pumpfun",
        success: result.success,
        error: result.error,
        signature: result.signature,
        tokenAmount: result.tokenAmount,
        solAmount: result.solAmount,
      };
      attempts.push(attempt);
      
      if (result.success) {
        console.log(`[Orchestrator] Pump.fun buy succeeded: ${result.signature}`);
        return {
          success: true,
          platform: "pumpfun",
          signature: result.signature,
          tokenAmount: result.tokenAmount,
          solAmount: result.solAmount,
          attempts,
        };
      }
      console.log(`[Orchestrator] Pump.fun buy failed: ${result.error}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      attempts.push({
        platform: "pumpfun",
        success: false,
        error: errorMsg,
      });
      console.log(`[Orchestrator] Pump.fun buy threw error: ${errorMsg}`);
    }
  }

  // Try Raydium if: graduated, no bonding curve, or Pump.fun failed
  const pumpfunAttempted = attempts.some(a => a.platform === "pumpfun");
  if (context.isGraduated || !context.hasBondingCurve || pumpfunAttempted) {
    console.log(`[Orchestrator] Attempting Raydium buy`);
    try {
      const result = await buyTokenOnRaydium(privateKey, tokenMint, solAmount, slippageBps);
      const attempt: TradeAttempt = {
        platform: "raydium",
        success: result.success,
        error: result.error,
        signature: result.signature,
        tokenAmount: result.outputAmount,
        solAmount: result.inputAmount,
      };
      attempts.push(attempt);
      
      if (result.success) {
        console.log(`[Orchestrator] Raydium buy succeeded: ${result.signature}`);
        return {
          success: true,
          platform: "raydium",
          signature: result.signature,
          tokenAmount: result.outputAmount,
          solAmount: result.inputAmount,
          attempts,
        };
      }
      console.log(`[Orchestrator] Raydium buy failed: ${result.error}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      attempts.push({
        platform: "raydium",
        success: false,
        error: errorMsg,
      });
      console.log(`[Orchestrator] Raydium buy threw error: ${errorMsg}`);
    }
  }

  // Always try Jupiter as final fallback
  console.log(`[Orchestrator] Attempting Jupiter buy (final fallback)`);
  {
    try {
      const result = await buyTokenOnJupiter(privateKey, tokenMint, solAmount, slippageBps);
      const attempt: TradeAttempt = {
        platform: "jupiter",
        success: result.success,
        error: result.error,
        signature: result.signature,
        tokenAmount: result.outputAmount,
        solAmount: result.inputAmount,
      };
      attempts.push(attempt);
      
      if (result.success) {
        console.log(`[Orchestrator] Jupiter buy succeeded: ${result.signature}`);
        return {
          success: true,
          platform: "jupiter",
          signature: result.signature,
          tokenAmount: result.outputAmount,
          solAmount: result.inputAmount,
          attempts,
        };
      }
      console.log(`[Orchestrator] Jupiter buy failed: ${result.error}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      attempts.push({
        platform: "jupiter",
        success: false,
        error: errorMsg,
      });
      console.log(`[Orchestrator] Jupiter buy threw error: ${errorMsg}`);
    }
  }

  const lastError = attempts.length > 0 
    ? attempts[attempts.length - 1].error 
    : "No trading platforms available for this token";

  console.log(`[Orchestrator] All buy attempts failed. Attempts: ${attempts.length}`);
  
  return {
    success: false,
    error: `All platforms failed. Last error: ${lastError}`,
    attempts,
  };
}

export async function orchestratedSell(
  privateKey: string,
  tokenMint: string,
  tokenAmount: number,
  slippageBps: number = 500
): Promise<OrchestratedTradeResult> {
  const attempts: TradeAttempt[] = [];
  
  console.log(`[Orchestrator] Starting sell for ${tokenAmount} tokens of ${tokenMint}`);
  
  const context = await buildTokenContext(tokenMint);

  if (context.hasBondingCurve && !context.isGraduated) {
    console.log(`[Orchestrator] Attempting Pump.fun sell (token has bonding curve)`);
    try {
      const result = await sellTokenTransaction(privateKey, tokenMint, tokenAmount, slippageBps);
      const attempt: TradeAttempt = {
        platform: "pumpfun",
        success: result.success,
        error: result.error,
        signature: result.signature,
        tokenAmount: result.tokenAmount,
        solAmount: result.solAmount,
      };
      attempts.push(attempt);
      
      if (result.success) {
        console.log(`[Orchestrator] Pump.fun sell succeeded: ${result.signature}`);
        return {
          success: true,
          platform: "pumpfun",
          signature: result.signature,
          tokenAmount: result.tokenAmount,
          solAmount: result.solAmount,
          attempts,
        };
      }
      console.log(`[Orchestrator] Pump.fun sell failed: ${result.error}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      attempts.push({
        platform: "pumpfun",
        success: false,
        error: errorMsg,
      });
      console.log(`[Orchestrator] Pump.fun sell threw error: ${errorMsg}`);
    }
  }

  // Try Raydium if: graduated, no bonding curve, or Pump.fun failed
  const pumpfunSellAttempted = attempts.some(a => a.platform === "pumpfun");
  if (context.isGraduated || !context.hasBondingCurve || pumpfunSellAttempted) {
    console.log(`[Orchestrator] Attempting Raydium sell`);
    try {
      const result = await sellTokenOnRaydium(privateKey, tokenMint, tokenAmount, slippageBps);
      const attempt: TradeAttempt = {
        platform: "raydium",
        success: result.success,
        error: result.error,
        signature: result.signature,
        tokenAmount: result.inputAmount,
        solAmount: result.outputAmount,
      };
      attempts.push(attempt);
      
      if (result.success) {
        console.log(`[Orchestrator] Raydium sell succeeded: ${result.signature}`);
        return {
          success: true,
          platform: "raydium",
          signature: result.signature,
          tokenAmount: result.inputAmount,
          solAmount: result.outputAmount,
          attempts,
        };
      }
      console.log(`[Orchestrator] Raydium sell failed: ${result.error}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      attempts.push({
        platform: "raydium",
        success: false,
        error: errorMsg,
      });
      console.log(`[Orchestrator] Raydium sell threw error: ${errorMsg}`);
    }
  }

  // Always try Jupiter as final fallback
  console.log(`[Orchestrator] Attempting Jupiter sell (final fallback)`);
  {
    try {
      const result = await sellTokenOnJupiter(privateKey, tokenMint, tokenAmount, slippageBps);
      const attempt: TradeAttempt = {
        platform: "jupiter",
        success: result.success,
        error: result.error,
        signature: result.signature,
        tokenAmount: result.inputAmount,
        solAmount: result.outputAmount,
      };
      attempts.push(attempt);
      
      if (result.success) {
        console.log(`[Orchestrator] Jupiter sell succeeded: ${result.signature}`);
        return {
          success: true,
          platform: "jupiter",
          signature: result.signature,
          tokenAmount: result.inputAmount,
          solAmount: result.outputAmount,
          attempts,
        };
      }
      console.log(`[Orchestrator] Jupiter sell failed: ${result.error}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      attempts.push({
        platform: "jupiter",
        success: false,
        error: errorMsg,
      });
      console.log(`[Orchestrator] Jupiter sell threw error: ${errorMsg}`);
    }
  }

  const lastError = attempts.length > 0 
    ? attempts[attempts.length - 1].error 
    : "No trading platforms available for this token";

  console.log(`[Orchestrator] All sell attempts failed. Attempts: ${attempts.length}`);
  
  return {
    success: false,
    error: `All platforms failed. Last error: ${lastError}`,
    attempts,
  };
}
