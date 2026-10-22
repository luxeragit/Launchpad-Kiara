import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, getMint } from "@solana/spl-token";
import { encode as bs58Encode, decode as bs58Decode } from "./base58";

// Compatibility wrapper
const bs58 = { encode: bs58Encode, decode: bs58Decode };

// Helper to detect which token program a mint uses
async function getTokenProgram(connection: Connection, mintAddress: PublicKey): Promise<PublicKey> {
  try {
    // Try Token-2022 first since Pump.fun now uses it
    const mintInfo = await connection.getAccountInfo(mintAddress);
    if (mintInfo && mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return TOKEN_2022_PROGRAM_ID;
    }
    return TOKEN_PROGRAM_ID;
  } catch {
    return TOKEN_PROGRAM_ID;
  }
}

const PUMP_FUN_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_FUN_GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const PUMP_FUN_FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJtGRnPD9wG1");
const PUMP_FUN_EVENT_AUTHORITY = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
const RENT_PROGRAM = new PublicKey("SysvarRent111111111111111111111111111111111");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const PUMP_FEE_PROGRAM_ID = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");

// Derive global volume accumulator PDA (singleton)
function getGlobalVolumeAccumulatorPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

// Derive user volume accumulator PDA
function getUserVolumeAccumulatorPDA(userPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), userPubkey.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

// Derive creator vault PDA (uses hyphen not underscore)
function getCreatorVaultPDA(creatorPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creatorPubkey.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return pda;
}

// Derive fee config PDA - includes program ID in seed
function getFeeConfigPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), PUMP_FUN_PROGRAM_ID.toBuffer()],
    PUMP_FEE_PROGRAM_ID
  );
  return pda;
}

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export interface TokenInfo {
  mint: string;
  bondingCurve: string;
  associatedBondingCurve: string;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  tokenTotalSupply: number;
  complete: boolean;
}

export interface TradeResult {
  success: boolean;
  signature?: string;
  tokenAmount?: number;
  solAmount?: number;
  error?: string;
}

export function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

export async function getBondingCurveAddress(mintAddress: PublicKey): Promise<PublicKey> {
  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mintAddress.toBuffer()],
    PUMP_FUN_PROGRAM_ID
  );
  return bondingCurve;
}

export async function getAssociatedBondingCurve(mintAddress: PublicKey, bondingCurve: PublicKey, tokenProgramId: PublicKey = TOKEN_2022_PROGRAM_ID): Promise<PublicKey> {
  // Pump.fun uses Token-2022 program, so we need to use it for the ATA
  return await getAssociatedTokenAddress(mintAddress, bondingCurve, true, tokenProgramId);
}

export async function fetchTokenInfo(mintAddress: string): Promise<TokenInfo | null> {
  try {
    const response = await fetch(`https://frontend-api.pump.fun/coins/${mintAddress}`);
    if (!response.ok) {
      // 530 error means token is too new and not yet indexed
      if (response.status === 530) {
        console.log(`[PumpFun API] Token ${mintAddress} not yet indexed (530) - deriving addresses`);
        // Derive bonding curve addresses programmatically
        const mint = new PublicKey(mintAddress);
        const connection = getConnection();
        
        // Detect token program
        const tokenProgramId = await getTokenProgram(connection, mint);
        console.log(`[PumpFun API] Token uses program: ${tokenProgramId.toBase58()}`);
        
        const bondingCurve = await getBondingCurveAddress(mint);
        const associatedBondingCurve = await getAssociatedBondingCurve(mint, bondingCurve, tokenProgramId);
        
        // Verify bonding curve account exists on-chain
        const bondingCurveInfo = await connection.getAccountInfo(bondingCurve);
        if (!bondingCurveInfo) {
          console.error(`[PumpFun API] Bonding curve ${bondingCurve.toBase58()} does not exist on-chain`);
          console.error(`[PumpFun API] Token may not be properly deployed on Pump.fun`);
          return null;
        }
        
        console.log(`[PumpFun API] Bonding curve verified: ${bondingCurve.toBase58()}`);
        console.log(`[PumpFun API] Associated bonding curve: ${associatedBondingCurve.toBase58()}`);
        
        // Try to read actual reserves from bonding curve account data
        // Pump.fun bonding curve layout: discriminator(8) + virtualTokenReserves(8) + virtualSolReserves(8) + ...
        let virtualSolReserves = 30_000_000_000; // Default: 30 SOL in lamports
        let virtualTokenReserves = 1_073_000_000_000_000; // Default: ~1.073B tokens
        
        if (bondingCurveInfo.data.length >= 24) {
          try {
            virtualTokenReserves = Number(bondingCurveInfo.data.readBigUInt64LE(8));
            virtualSolReserves = Number(bondingCurveInfo.data.readBigUInt64LE(16));
            console.log(`[PumpFun API] Read reserves from on-chain: SOL=${virtualSolReserves}, Tokens=${virtualTokenReserves}`);
          } catch (e) {
            console.log(`[PumpFun API] Could not parse reserves, using defaults`);
          }
        }
        
        return {
          mint: mintAddress,
          bondingCurve: bondingCurve.toBase58(),
          associatedBondingCurve: associatedBondingCurve.toBase58(),
          virtualSolReserves,
          virtualTokenReserves,
          tokenTotalSupply: 1_000_000_000_000_000_000,
          complete: false, // New token is not graduated
        };
      }
      console.error(`[PumpFun API] Failed to fetch token info: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return {
      mint: mintAddress,
      bondingCurve: data.bonding_curve,
      associatedBondingCurve: data.associated_bonding_curve,
      virtualSolReserves: data.virtual_sol_reserves,
      virtualTokenReserves: data.virtual_token_reserves,
      tokenTotalSupply: data.total_supply,
      complete: data.complete,
    };
  } catch (error) {
    console.error("[PumpFun API] Error fetching token info:", error);
    return null;
  }
}

export function calculateBuyAmount(
  solAmount: number,
  virtualSolReserves: number,
  virtualTokenReserves: number,
  slippageBps: number = 500
): { tokenAmount: number; maxSolCost: number } {
  const solLamports = solAmount * LAMPORTS_PER_SOL;
  const tokenAmount = Math.floor(
    (solLamports * virtualTokenReserves) / (virtualSolReserves + solLamports)
  );
  const maxSolCost = Math.floor(solLamports * (1 + slippageBps / 10000));
  return { tokenAmount, maxSolCost };
}

export function calculateSellAmount(
  tokenAmount: number,
  virtualSolReserves: number,
  virtualTokenReserves: number,
  slippageBps: number = 500
): { solAmount: number; minSolOutput: number } {
  const solAmount = Math.floor(
    (tokenAmount * virtualSolReserves) / (virtualTokenReserves + tokenAmount)
  );
  const minSolOutput = Math.floor(solAmount * (1 - slippageBps / 10000));
  return { solAmount, minSolOutput };
}

export async function buyTokenTransaction(
  privateKey: string,
  mintAddress: string,
  solAmount: number,
  slippageBps: number = 500
): Promise<TradeResult> {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = getConnection();

    console.log(`[PumpFun Buy] Using PumpPortal API for ${solAmount} SOL -> ${mintAddress}`);

    // Fetch token info to calculate estimated token amount
    const tokenInfo = await fetchTokenInfo(mintAddress);
    let estimatedTokenAmount = 0;
    if (tokenInfo) {
      const { tokenAmount } = calculateBuyAmount(
        solAmount,
        tokenInfo.virtualSolReserves,
        tokenInfo.virtualTokenReserves,
        slippageBps
      );
      estimatedTokenAmount = tokenAmount;
      console.log(`[PumpFun Buy] Estimated token amount: ${estimatedTokenAmount}`);
    }

    // Use PumpPortal Local Transaction API to build the transaction
    const response = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: keypair.publicKey.toBase58(),
        action: "buy",
        mint: mintAddress,
        amount: solAmount,
        denominatedInSol: "true",
        slippage: slippageBps / 100, // Convert bps to percent
        priorityFee: 0.0001,
        pool: "pump"
      })
    });

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error(`[PumpFun Buy] PumpPortal API error: ${response.status} - ${errorText}`);
      return { success: false, error: `PumpPortal API error: ${errorText}` };
    }

    // Get the serialized transaction from PumpPortal
    const txData = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

    // Sign the transaction with our keypair
    tx.sign([keypair]);

    console.log(`[PumpFun Buy] Sending transaction for ${solAmount} SOL`);

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log(`[PumpFun Buy] Transaction confirmed: ${signature}`);

    return {
      success: true,
      signature,
      solAmount: solAmount,
      tokenAmount: estimatedTokenAmount,
    };
  } catch (error) {
    console.error("[PumpFun Buy] Transaction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sellTokenTransaction(
  privateKey: string,
  mintAddress: string,
  tokenAmount: number,
  slippageBps: number = 500,
  sellPercentage?: number
): Promise<TradeResult> {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = getConnection();

    // Use percentage format if provided, otherwise sell all (100%)
    // PumpPortal supports "100%" format for selling all tokens
    const amountToSell = sellPercentage ? `${sellPercentage}%` : "100%";
    
    console.log(`[PumpFun Sell] Using PumpPortal API to sell ${amountToSell} of ${mintAddress}`);

    // Use PumpPortal Local Transaction API to build the transaction
    const response = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: keypair.publicKey.toBase58(),
        action: "sell",
        mint: mintAddress,
        amount: amountToSell,
        denominatedInSol: "false",
        slippage: slippageBps / 100, // Convert bps to percent
        priorityFee: 0.0001,
        pool: "pump"
      })
    });

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error(`[PumpFun Sell] PumpPortal API error: ${response.status} - ${errorText}`);
      return { success: false, error: `PumpPortal API error: ${errorText}` };
    }

    // Get the serialized transaction from PumpPortal
    const txData = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

    // Sign the transaction with our keypair
    tx.sign([keypair]);

    console.log(`[PumpFun Sell] Sending transaction for ${tokenAmount} tokens`);

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log(`[PumpFun Sell] Transaction confirmed: ${signature}`);

    return {
      success: true,
      signature,
      tokenAmount,
    };
  } catch (error) {
    console.error("[PumpFun Sell] Transaction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
