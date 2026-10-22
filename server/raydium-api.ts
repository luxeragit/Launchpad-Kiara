import { Connection, Keypair, VersionedTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { encode as bs58Encode, decode as bs58Decode } from "./base58";

const bs58 = { encode: bs58Encode, decode: bs58Decode };

const RAYDIUM_API_URL = "https://transaction-v1.raydium.io";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export interface RaydiumSwapResult {
  success: boolean;
  signature?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: string;
}

export interface RaydiumQuote {
  success: boolean;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  routePlan?: any[];
  error?: string;
}

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 120000,
  });
}

export async function getRaydiumSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100
): Promise<RaydiumQuote> {
  try {
    console.log(`[Raydium] Getting quote: ${amount} of ${inputMint} -> ${outputMint}`);
    
    const response = await fetch(
      `${RAYDIUM_API_URL}/compute/swap-base-in?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=${slippageBps}&` +
      `txVersion=V0`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Raydium] Quote failed: ${response.status} - ${errorText}`);
      return {
        success: false,
        inputMint,
        outputMint,
        inputAmount: 0,
        outputAmount: 0,
        priceImpact: 0,
        error: `Failed to get quote: ${response.status}`,
      };
    }

    const data = await response.json();
    
    if (!data.success || !data.data) {
      return {
        success: false,
        inputMint,
        outputMint,
        inputAmount: 0,
        outputAmount: 0,
        priceImpact: 0,
        error: data.msg || "Quote not available",
      };
    }

    return {
      success: true,
      inputMint,
      outputMint,
      inputAmount: parseInt(data.data.inputAmount),
      outputAmount: parseInt(data.data.outputAmount),
      priceImpact: parseFloat(data.data.priceImpactPct || "0"),
      routePlan: data.data.routePlan,
    };
  } catch (error) {
    console.error("[Raydium] Quote error:", error);
    return {
      success: false,
      inputMint,
      outputMint,
      inputAmount: 0,
      outputAmount: 0,
      priceImpact: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function executeRaydiumSwap(
  privateKey: string,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 100
): Promise<RaydiumSwapResult> {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = getConnection();
    const walletAddress = keypair.publicKey.toBase58();

    console.log(`[Raydium] Executing swap: ${amount} of ${inputMint} -> ${outputMint}`);
    console.log(`[Raydium] Wallet: ${walletAddress}`);

    const quoteResponse = await fetch(
      `${RAYDIUM_API_URL}/compute/swap-base-in?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=${slippageBps}&` +
      `txVersion=V0`
    );

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error(`[Raydium] Quote failed: ${quoteResponse.status}`);
      return { success: false, error: `Quote failed: ${errorText}` };
    }

    const quoteData = await quoteResponse.json();
    
    if (!quoteData.success || !quoteData.data) {
      return { success: false, error: quoteData.msg || "Failed to get swap quote" };
    }

    console.log(`[Raydium] Quote received: ${quoteData.data.inputAmount} -> ${quoteData.data.outputAmount}`);

    const swapResponse = await fetch(`${RAYDIUM_API_URL}/transaction/swap-base-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        computeUnitPriceMicroLamports: "auto",
        swapResponse: quoteData.data,
        txVersion: "V0",
        wallet: walletAddress,
        wrapSol: inputMint === SOL_MINT,
        unwrapSol: outputMint === SOL_MINT,
        inputAccount: undefined,
        outputAccount: undefined,
      }),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      console.error(`[Raydium] Swap transaction build failed: ${swapResponse.status}`);
      return { success: false, error: `Transaction build failed: ${errorText}` };
    }

    const swapData = await swapResponse.json();
    
    if (!swapData.success || !swapData.data || swapData.data.length === 0) {
      return { success: false, error: swapData.msg || "Failed to build swap transaction" };
    }

    const txData = swapData.data[0];
    const txBuffer = Buffer.from(txData.transaction, "base64");
    const transaction = VersionedTransaction.deserialize(txBuffer);

    transaction.sign([keypair]);

    console.log("[Raydium] Sending transaction...");
    
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    console.log(`[Raydium] Transaction sent: ${signature}`);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log(`[Raydium] Transaction confirmed: ${signature}`);

    return {
      success: true,
      signature,
      inputAmount: parseInt(quoteData.data.inputAmount),
      outputAmount: parseInt(quoteData.data.outputAmount),
    };
  } catch (error) {
    console.error("[Raydium] Swap error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown swap error",
    };
  }
}

export async function buyTokenOnRaydium(
  privateKey: string,
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 100
): Promise<RaydiumSwapResult> {
  const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  console.log(`[Raydium] Buying token ${tokenMint} with ${solAmount} SOL (${lamports} lamports)`);
  
  const decimals = await getTokenDecimals(tokenMint);
  
  const result = await executeRaydiumSwap(
    privateKey,
    SOL_MINT,
    tokenMint,
    lamports,
    slippageBps
  );

  if (result.success && result.outputAmount) {
    const humanReadableTokens = result.outputAmount / Math.pow(10, decimals);
    console.log(`[Raydium] Bought ${humanReadableTokens} tokens (raw: ${result.outputAmount}, decimals: ${decimals})`);
    return {
      ...result,
      inputAmount: solAmount,
      outputAmount: humanReadableTokens,
    };
  }
  
  return result;
}

export async function sellTokenOnRaydium(
  privateKey: string,
  tokenMint: string,
  tokenAmount: number,
  tokenDecimals: number = 6,
  slippageBps: number = 100
): Promise<RaydiumSwapResult> {
  const rawAmount = Math.floor(tokenAmount * Math.pow(10, tokenDecimals));
  console.log(`[Raydium] Selling ${tokenAmount} tokens (${rawAmount} raw, decimals: ${tokenDecimals}) of ${tokenMint}`);
  
  const result = await executeRaydiumSwap(
    privateKey,
    tokenMint,
    SOL_MINT,
    rawAmount,
    slippageBps
  );

  if (result.success && result.outputAmount) {
    const humanReadableSol = result.outputAmount / LAMPORTS_PER_SOL;
    console.log(`[Raydium] Sold for ${humanReadableSol} SOL (raw: ${result.outputAmount} lamports)`);
    return {
      ...result,
      inputAmount: tokenAmount,
      outputAmount: humanReadableSol,
    };
  }
  
  return result;
}

export async function checkTokenGraduated(tokenMint: string): Promise<boolean> {
  try {
    const response = await fetch(`https://frontend-api.pump.fun/coins/${tokenMint}`);
    if (!response.ok) {
      return true;
    }
    
    const data = await response.json();
    return data.complete === true;
  } catch (error) {
    console.error("[Raydium] Error checking graduation status:", error);
    return false;
  }
}

export async function getTokenDecimals(tokenMint: string): Promise<number> {
  try {
    const connection = getConnection();
    const { PublicKey } = await import("@solana/web3.js");
    const mintPubkey = new PublicKey(tokenMint);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    
    if (mintInfo.value?.data && typeof mintInfo.value.data === "object" && "parsed" in mintInfo.value.data) {
      return mintInfo.value.data.parsed.info.decimals;
    }
    
    return 6;
  } catch (error) {
    console.error("[Raydium] Error getting token decimals:", error);
    return 6;
  }
}
