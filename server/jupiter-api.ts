import { Connection, PublicKey, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { decode as bs58Decode } from "./base58";

const bs58 = { decode: bs58Decode };

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface JupiterSwapResult {
  success: boolean;
  signature?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: string;
}

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 500
): Promise<JupiterQuote | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: "false",
      asLegacyTransaction: "false",
    });

    const response = await fetch(`${JUPITER_QUOTE_API}?${params}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Jupiter] Quote API error: ${response.status} - ${errorText}`);
      return null;
    }

    const quote = await response.json();
    return quote as JupiterQuote;
  } catch (error) {
    console.error("[Jupiter] Error fetching quote:", error);
    return null;
  }
}

export async function canBuyOnJupiter(tokenMint: string): Promise<boolean> {
  try {
    const testAmount = 10_000_000;
    const quote = await getJupiterQuote(SOL_MINT, tokenMint, testAmount, 500);
    
    if (!quote || !quote.routePlan || quote.routePlan.length === 0) {
      return false;
    }
    
    const outAmount = BigInt(quote.outAmount);
    return outAmount > 0n;
  } catch (error) {
    console.error("[Jupiter] Error checking buy availability:", error);
    return false;
  }
}

export async function buyTokenOnJupiter(
  privateKey: string,
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 500
): Promise<JupiterSwapResult> {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = getConnection();
    
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    
    console.log(`[Jupiter] Getting quote for ${solAmount} SOL -> ${tokenMint}`);
    
    const quote = await getJupiterQuote(SOL_MINT, tokenMint, lamports, slippageBps);
    
    if (!quote) {
      return { success: false, error: "Failed to get Jupiter quote - no liquidity found" };
    }
    
    if (!quote.routePlan || quote.routePlan.length === 0) {
      return { success: false, error: "No swap route available on Jupiter" };
    }
    
    const outputAmount = Number(quote.outAmount);
    console.log(`[Jupiter] Quote: ${solAmount} SOL -> ${outputAmount} tokens`);
    console.log(`[Jupiter] Price impact: ${quote.priceImpactPct}%`);
    console.log(`[Jupiter] Route: ${quote.routePlan.map(r => r.swapInfo.label).join(" -> ")}`);
    
    console.log(`[Jupiter] Requesting swap transaction...`);
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    
    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error(`[Jupiter] Swap API error: ${swapResponse.status} - ${errorText}`);
      return { success: false, error: `Jupiter swap API error: ${errorText}` };
    }
    
    const swapData = await swapResponse.json();
    
    if (!swapData.swapTransaction) {
      return { success: false, error: "Jupiter returned empty swap transaction" };
    }
    
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    transaction.sign([keypair]);
    
    console.log(`[Jupiter] Sending transaction...`);
    
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    
    console.log(`[Jupiter] Transaction sent: ${signature}`);
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });
    
    console.log(`[Jupiter] Transaction confirmed: ${signature}`);
    
    return {
      success: true,
      signature,
      inputAmount: solAmount,
      outputAmount,
    };
  } catch (error) {
    console.error("[Jupiter] Swap failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during Jupiter swap",
    };
  }
}

export async function sellTokenOnJupiter(
  privateKey: string,
  tokenMint: string,
  tokenAmount: number,
  slippageBps: number = 500
): Promise<JupiterSwapResult> {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = getConnection();
    
    console.log(`[Jupiter] Getting quote for ${tokenAmount} tokens -> SOL`);
    
    const quote = await getJupiterQuote(tokenMint, SOL_MINT, Math.floor(tokenAmount), slippageBps);
    
    if (!quote) {
      return { success: false, error: "Failed to get Jupiter quote for sell" };
    }
    
    if (!quote.routePlan || quote.routePlan.length === 0) {
      return { success: false, error: "No swap route available on Jupiter for sell" };
    }
    
    const outputAmount = Number(quote.outAmount) / LAMPORTS_PER_SOL;
    console.log(`[Jupiter] Quote: ${tokenAmount} tokens -> ${outputAmount} SOL`);
    
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    
    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      return { success: false, error: `Jupiter swap API error: ${errorText}` };
    }
    
    const swapData = await swapResponse.json();
    
    if (!swapData.swapTransaction) {
      return { success: false, error: "Jupiter returned empty swap transaction" };
    }
    
    const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    transaction.sign([keypair]);
    
    console.log(`[Jupiter] Sending sell transaction...`);
    
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });
    
    console.log(`[Jupiter] Sell transaction confirmed: ${signature}`);
    
    return {
      success: true,
      signature,
      inputAmount: tokenAmount,
      outputAmount: outputAmount * LAMPORTS_PER_SOL,
    };
  } catch (error) {
    console.error("[Jupiter] Sell failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during Jupiter sell",
    };
  }
}
