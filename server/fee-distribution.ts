import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createBurnInstruction, getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { encode as bs58Encode, decode as bs58Decode } from "./base58";
import { storage } from "./storage";

// Compatibility wrapper
const bs58 = { encode: bs58Encode, decode: bs58Decode };

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const PUMP_API_URL = "https://frontend-api.pump.fun";

export interface FeeDistributionResult {
  success: boolean;
  burnAmount?: number;
  burnTx?: string;
  ammAmount?: number;
  ammTx?: string;
  creatorAmount?: number;
  creatorTx?: string;
  liquidityAmount?: number;
  liquidityTx?: string;
  error?: string;
}

export async function getCreatorFeeBalance(tokenMint: string, walletAddress: string): Promise<number> {
  try {
    // Note: Pump.fun does not expose creator fee balances via public API
    // This would need direct program interaction or their private API
    // For now, returns 0 - real implementation would query their program state
    const response = await fetch(`${PUMP_API_URL}/coins/${tokenMint}`);
    if (!response.ok) return 0;

    const data = await response.json();
    
    // Check if wallet is the creator
    if (data.creator !== walletAddress) {
      return 0;
    }

    // Pump.fun does not expose fee balance via API
    // Real implementation would need to decode the bonding curve account
    return 0;
  } catch (error) {
    console.error("[FeeDistribution] Error getting creator fee balance:", error);
    return 0;
  }
}

export async function claimCreatorFees(
  tokenMint: string,
  walletPrivateKey: string
): Promise<{ success: boolean; amount: number; txSignature?: string; error?: string }> {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));
    const walletAddress = keypair.publicKey.toBase58();

    // Pump.fun fee claiming requires their proprietary program instruction
    // The Pump.fun program address and instruction layout are not publicly documented
    // Users must claim fees via the pump.fun website directly
    
    console.log(`[FeeDistribution] Fee claim requested for ${tokenMint}`);
    console.log(`[FeeDistribution] Note: Direct claim not supported - use pump.fun website`);
    
    return {
      success: false,
      amount: 0,
      error: "Direct fee claiming not available. Please claim via pump.fun website.",
    };
  } catch (error) {
    console.error("[FeeDistribution] Error claiming fees:", error);
    return { success: false, amount: 0, error: String(error) };
  }
}

export async function burnTokens(
  tokenMint: string,
  tokenAmount: number, // Amount of tokens to burn (in token units)
  walletPrivateKey: string
): Promise<{ success: boolean; txSignature?: string; error?: string }> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const keypair = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));
    const mintPubkey = new PublicKey(tokenMint);

    // Get token account and check balance
    const tokenAccount = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
    
    try {
      const accountInfo = await getAccount(connection, tokenAccount);
      const balance = Number(accountInfo.amount);
      
      if (balance === 0) {
        return { success: false, error: "No tokens to burn" };
      }
      
      // Pump.fun tokens typically have 6 decimals
      const burnAmount = Math.min(Math.floor(tokenAmount * 1e6), balance);
      
      if (burnAmount <= 0) {
        return { success: false, error: "Invalid burn amount" };
      }

      const burnIx = createBurnInstruction(
        tokenAccount,
        mintPubkey,
        keypair.publicKey,
        BigInt(burnAmount)
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const transaction = new Transaction().add(burnIx);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = keypair.publicKey;
      transaction.sign(keypair);

      const txSignature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight });

      console.log(`[FeeDistribution] Burned ${burnAmount / 1e6} tokens, tx: ${txSignature}`);
      return { success: true, txSignature };
    } catch (accountError: any) {
      if (accountError.name === "TokenAccountNotFoundError") {
        return { success: false, error: "No token account found" };
      }
      throw accountError;
    }
  } catch (error) {
    console.error("[FeeDistribution] Error burning tokens:", error);
    return { success: false, error: String(error) };
  }
}

export async function distributeFees(
  deploymentId: string,
  tokenAmount: number, // Amount of tokens to distribute
  walletPrivateKey: string
): Promise<FeeDistributionResult> {
  try {
    const deployment = await storage.internal_getTokenDeploymentUnsafe(deploymentId);
    if (!deployment || !deployment.tokenAddress) {
      return { success: false, error: "Deployment not found" };
    }

    const burnPercent = deployment.burnPercent || 20;
    const ammPercent = deployment.ammPercent || 30;
    const creatorPercent = deployment.creatorPercent || 25;
    const liquidityPercent = deployment.liquidityPercent || 25;

    const burnTokens_ = tokenAmount * (burnPercent / 100);
    const ammTokens = tokenAmount * (ammPercent / 100);
    const creatorTokens = tokenAmount * (creatorPercent / 100);
    const liquidityTokens = tokenAmount * (liquidityPercent / 100);

    console.log(`[FeeDistribution] Distributing ${tokenAmount} tokens:`);
    console.log(`  - Burn: ${burnTokens_} tokens (${burnPercent}%)`);
    console.log(`  - AMM: ${ammTokens} tokens (${ammPercent}%)`);
    console.log(`  - Creator: ${creatorTokens} tokens (${creatorPercent}%)`);
    console.log(`  - Liquidity: ${liquidityTokens} tokens (${liquidityPercent}%)`);

    const result: FeeDistributionResult = {
      success: false, // Will be set true only if at least one operation succeeds
      burnAmount: burnTokens_,
      ammAmount: ammTokens,
      creatorAmount: creatorTokens,
      liquidityAmount: liquidityTokens,
    };

    let burnSuccess = false;
    let burnError: string | undefined;

    // Execute burn if percentage > 0 and tokens are available
    if (burnPercent > 0 && burnTokens_ > 0 && deployment.tokenAddress) {
      const burnResult = await burnTokens(deployment.tokenAddress, burnTokens_, walletPrivateKey);
      if (burnResult.success && burnResult.txSignature) {
        result.burnTx = burnResult.txSignature;
        burnSuccess = true;
        console.log(`[FeeDistribution] Burn tx: ${burnResult.txSignature}`);
      } else {
        burnError = burnResult.error;
        console.log(`[FeeDistribution] Burn failed: ${burnResult.error}`);
      }
    }

    // Only mark as successful if burn was executed
    result.success = burnSuccess;
    
    if (!burnSuccess && burnPercent > 0) {
      result.error = burnError || "Burn operation failed. AMM/Liquidity require manual DEX integration.";
    }

    // Note: AMM and Liquidity operations require DEX integration (e.g., Raydium)
    if (!burnSuccess) {
      console.log(`[FeeDistribution] Distribution incomplete - burn required tokens not available or failed`);
    }

    // Only record activity if something was actually executed
    if (burnSuccess) {
      await storage.createFeeActivity({
        tokenDeploymentId: deploymentId,
        activityType: "burn",
        amount: burnTokens_,
        txSignature: result.burnTx,
        details: JSON.stringify({
          burnTokens: burnTokens_,
          status: "complete",
        }),
      });

      await storage.internal_updateTokenDeploymentFeesUnsafe(deploymentId, {
        totalFeesDistributed: (deployment.totalFeesDistributed || 0) + burnTokens_,
        totalBurned: (deployment.totalBurned || 0) + burnTokens_,
      });
    }

    return result;
  } catch (error) {
    console.error("[FeeDistribution] Error distributing fees:", error);
    return { success: false, error: String(error) };
  }
}

let autoClaimInterval: NodeJS.Timeout | null = null;

export function startAutoClaimService() {
  if (autoClaimInterval) return;

  console.log("[FeeDistribution] Starting auto-claim service...");
  console.log("[FeeDistribution] Note: Direct fee claiming not available via Pump.fun API");
  console.log("[FeeDistribution] Auto-claim will monitor but cannot execute claims automatically");

  // The service runs to track deployments with auto-claim enabled
  // However, actual fee claiming requires manual execution via pump.fun website
  // This service can be extended when/if Pump.fun exposes a claim API
  
  autoClaimInterval = setInterval(async () => {
    try {
      const deployments = await storage.internal_getAllAutoClaimDeployments();
      
      if (deployments.length > 0) {
        console.log(`[FeeDistribution] Monitoring ${deployments.length} deployments with auto-claim enabled`);
      }
      
      // Future: When claim API becomes available, implement automatic claiming here
    } catch (error) {
      console.error("[FeeDistribution] Auto-claim monitoring error:", error);
    }
  }, 10 * 60 * 1000);
}

export function stopAutoClaimService() {
  if (autoClaimInterval) {
    clearInterval(autoClaimInterval);
    autoClaimInterval = null;
    console.log("[FeeDistribution] Auto-claim service stopped");
  }
}
