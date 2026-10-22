import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createBurnInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { decode as bs58Decode } from "./base58";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RAYDIUM_LP_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const RAYDIUM_AMM_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 120000,
  });
}

export interface LPTokenInfo {
  lpMint: string | null;
  lpBalance: number;
  lpDecimals: number;
  poolId: string | null;
  tokenMint: string;
  quoteMint: string;
  tokenReserve: number;
  quoteReserve: number;
  error?: string;
}

export interface BurnLPResult {
  success: boolean;
  signature?: string;
  burnedAmount?: number;
  error?: string;
}

export async function getLPTokenInfo(
  tokenMint: string,
  walletAddress: string
): Promise<LPTokenInfo> {
  const connection = getConnection();
  
  try {
    const tokenPubkey = new PublicKey(tokenMint);
    const walletPubkey = new PublicKey(walletAddress);
    
    const lpData = await findRaydiumPool(tokenMint, connection);
    
    if (!lpData || !lpData.lpMint) {
      return {
        lpMint: null,
        lpBalance: 0,
        lpDecimals: 9,
        poolId: null,
        tokenMint: tokenMint,
        quoteMint: SOL_MINT.toBase58(),
        tokenReserve: 0,
        quoteReserve: 0,
        error: "No Raydium LP pool found for this token",
      };
    }
    
    let lpBalance = 0;
    let lpDecimals = 9;
    
    try {
      const lpMintPubkey = new PublicKey(lpData.lpMint);
      const lpTokenAccount = await getAssociatedTokenAddress(lpMintPubkey, walletPubkey);
      
      try {
        const account = await getAccount(connection, lpTokenAccount);
        const mintInfo = await connection.getParsedAccountInfo(lpMintPubkey);
        
        if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
          lpDecimals = mintInfo.value.data.parsed.info.decimals;
        }
        
        lpBalance = Number(account.amount) / Math.pow(10, lpDecimals);
      } catch (e) {
        lpBalance = 0;
      }
    } catch (e) {
      console.log("[Raydium LP] Error getting LP balance:", e);
    }
    
    return {
      lpMint: lpData.lpMint,
      lpBalance,
      lpDecimals,
      poolId: lpData.poolId,
      tokenMint: tokenMint,
      quoteMint: SOL_MINT.toBase58(),
      tokenReserve: lpData.tokenReserve || 0,
      quoteReserve: lpData.quoteReserve || 0,
    };
  } catch (error) {
    console.error("[Raydium LP] Error getting LP info:", error);
    return {
      lpMint: null,
      lpBalance: 0,
      lpDecimals: 9,
      poolId: null,
      tokenMint: tokenMint,
      quoteMint: SOL_MINT.toBase58(),
      tokenReserve: 0,
      quoteReserve: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function findRaydiumPool(
  tokenMint: string,
  connection: Connection
): Promise<{ lpMint: string; poolId: string; tokenReserve: number; quoteReserve: number } | null> {
  try {
    const response = await fetch(
      `https://api.raydium.io/v2/ammV3/ammPools?mint=${tokenMint}`
    );
    
    if (!response.ok) {
      const legacyResponse = await fetch(
        `https://api.raydium.io/v2/main/pairs?token=${tokenMint}`
      );
      
      if (legacyResponse.ok) {
        const data = await legacyResponse.json();
        if (data && Array.isArray(data) && data.length > 0) {
          const pool = data.find((p: any) => 
            p.baseMint === tokenMint || p.quoteMint === tokenMint
          );
          if (pool) {
            return {
              lpMint: pool.lpMint || null,
              poolId: pool.ammId || pool.id,
              tokenReserve: parseFloat(pool.baseReserve) || 0,
              quoteReserve: parseFloat(pool.quoteReserve) || 0,
            };
          }
        }
      }
      
      return null;
    }
    
    const data = await response.json();
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const pool = data.data[0];
      return {
        lpMint: pool.lpMint || null,
        poolId: pool.id,
        tokenReserve: parseFloat(pool.mintAmountA) || 0,
        quoteReserve: parseFloat(pool.mintAmountB) || 0,
      };
    }
    
    return null;
  } catch (error) {
    console.error("[Raydium LP] Error finding pool:", error);
    return null;
  }
}

export async function validateLPBurn(
  lpMint: string,
  walletAddress: string,
  amount: number,
  decimals: number = 9
): Promise<{ valid: boolean; error?: string; actualBalance?: number }> {
  const connection = getConnection();
  
  try {
    const lpMintPubkey = new PublicKey(lpMint);
    const walletPubkey = new PublicKey(walletAddress);
    
    // Validate amount is positive
    if (amount <= 0) {
      return { valid: false, error: "Burn amount must be greater than 0" };
    }
    
    // Get LP token account
    const tokenAccountAddress = await getAssociatedTokenAddress(
      lpMintPubkey,
      walletPubkey
    );
    
    let actualBalance = 0;
    try {
      const tokenAccount = await getAccount(connection, tokenAccountAddress);
      actualBalance = Number(tokenAccount.amount) / Math.pow(10, decimals);
    } catch (e) {
      return { valid: false, error: "LP token account not found. You may not hold any LP tokens.", actualBalance: 0 };
    }
    
    // Check balance
    if (amount > actualBalance) {
      return { 
        valid: false, 
        error: `Insufficient LP balance. You have ${actualBalance.toFixed(6)} LP tokens but tried to burn ${amount}`,
        actualBalance 
      };
    }
    
    return { valid: true, actualBalance };
  } catch (error: any) {
    return { valid: false, error: error.message || "Validation failed" };
  }
}

export async function burnLPTokens(
  privateKey: string,
  lpMint: string,
  amount: number,
  decimals: number = 9
): Promise<BurnLPResult> {
  const connection = getConnection();
  
  try {
    // Validate inputs
    if (!privateKey || !lpMint) {
      return { success: false, error: "Missing required parameters" };
    }
    
    if (amount <= 0) {
      return { success: false, error: "Burn amount must be greater than 0" };
    }
    
    const secretKey = bs58Decode(privateKey);
    const ownerKeypair = Keypair.fromSecretKey(secretKey);
    const lpMintPubkey = new PublicKey(lpMint);
    
    const tokenAccountAddress = await getAssociatedTokenAddress(
      lpMintPubkey,
      ownerKeypair.publicKey
    );
    
    // Get and validate token account
    let tokenAccount;
    try {
      tokenAccount = await getAccount(connection, tokenAccountAddress);
    } catch (e) {
      return {
        success: false,
        error: "LP token account not found. You may not hold any LP tokens for this pool.",
      };
    }
    
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
    const actualBalance = Number(tokenAccount.amount) / Math.pow(10, decimals);
    
    if (rawAmount > tokenAccount.amount) {
      return {
        success: false,
        error: `Insufficient LP balance. You have ${actualBalance.toFixed(6)} LP tokens but tried to burn ${amount}`,
      };
    }
    
    if (rawAmount <= 0) {
      return {
        success: false,
        error: "Calculated burn amount is zero. Please specify a larger amount.",
      };
    }
    
    console.log(`[Raydium LP] Burning ${amount} LP tokens (raw: ${rawAmount}) from account with ${actualBalance} LP tokens`);
    
    const burnInstruction = createBurnInstruction(
      tokenAccountAddress,
      lpMintPubkey,
      ownerKeypair.publicKey,
      rawAmount
    );
    
    const transaction = new Transaction().add(burnInstruction);
    
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [ownerKeypair],
      { commitment: "confirmed" }
    );
    
    console.log(`[Raydium LP] Successfully burned ${amount} LP tokens. Signature: ${signature}`);
    
    return {
      success: true,
      signature,
      burnedAmount: amount,
    };
  } catch (error: any) {
    console.error("[Raydium LP] Error burning LP tokens:", error);
    return {
      success: false,
      error: error.message || "Failed to burn LP tokens",
    };
  }
}
