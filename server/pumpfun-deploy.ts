import { Keypair, Connection, Transaction, VersionedTransaction, TransactionInstruction, PublicKey, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { encode as bs58Encode, decode as bs58Decode } from "./base58";

// Compatibility wrapper
const bs58 = { encode: bs58Encode, decode: bs58Decode };

const PUMP_FUN_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_FUN_GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const PUMP_FUN_FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCJtGb9zKwXy");
const PUMP_FUN_EVENT_AUTHORITY = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
const PUMP_METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 120000,
  });
}

interface DeployResult {
  success: boolean;
  tokenAddress?: string;
  signature?: string;
  metadataUri?: string;
  error?: string;
}

interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  showName?: boolean;
}

async function uploadMetadataToIPFS(
  metadata: TokenMetadata,
  imageBuffer?: Buffer
): Promise<{ success: boolean; metadataUri?: string; error?: string }> {
  try {
    console.log("[PumpFun Deploy] Uploading metadata to IPFS...");
    
    const formData = new FormData();
    formData.append("name", metadata.name);
    formData.append("symbol", metadata.symbol);
    formData.append("description", metadata.description || "");
    
    if (metadata.twitter) formData.append("twitter", metadata.twitter);
    if (metadata.telegram) formData.append("telegram", metadata.telegram);
    if (metadata.website) formData.append("website", metadata.website);
    formData.append("showName", metadata.showName ? "true" : "false");
    
    if (imageBuffer) {
      const blob = new Blob([imageBuffer], { type: "image/png" });
      formData.append("file", blob, "token-logo.png");
    } else {
      const placeholderImage = Buffer.alloc(100);
      const blob = new Blob([placeholderImage], { type: "image/png" });
      formData.append("file", blob, "placeholder.png");
    }
    
    const response = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[PumpFun Deploy] IPFS upload failed:", errorText);
      return { success: false, error: `IPFS upload failed: ${response.status}` };
    }
    
    const result = await response.json();
    console.log("[PumpFun Deploy] IPFS upload successful:", result.metadataUri);
    
    return { success: true, metadataUri: result.metadataUri };
  } catch (error) {
    console.error("[PumpFun Deploy] IPFS upload error:", error);
    return { success: false, error: String(error) };
  }
}

export async function deployTokenOnPumpFun(
  privateKey: string,
  metadata: TokenMetadata,
  initialBuySOL: number = 0,
  imageBuffer?: Buffer
): Promise<DeployResult> {
  try {
    console.log(`[PumpFun Deploy] Creating token: ${metadata.name} (${metadata.symbol})`);
    
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = getConnection();
    
    const balance = await connection.getBalance(keypair.publicKey);
    const requiredBalance = 0.02 * LAMPORTS_PER_SOL;
    
    if (balance < requiredBalance) {
      return {
        success: false,
        error: `Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL (need at least 0.02 SOL)`,
      };
    }
    
    const ipfsResult = await uploadMetadataToIPFS(metadata, imageBuffer);
    if (!ipfsResult.success || !ipfsResult.metadataUri) {
      return { success: false, error: ipfsResult.error || "Failed to upload metadata" };
    }
    
    const mintKeypair = Keypair.generate();
    console.log(`[PumpFun Deploy] Generated mint address: ${mintKeypair.publicKey.toBase58()}`);
    
    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding-curve"), mintKeypair.publicKey.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    );
    
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        PUMP_METADATA_PROGRAM.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      PUMP_METADATA_PROGRAM
    );
    
    const associatedBondingCurve = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      bondingCurvePDA,
      true
    );
    
    const transaction = new Transaction();
    
    const nameBytes = Buffer.from(metadata.name.slice(0, 32).padEnd(32, "\0"));
    const symbolBytes = Buffer.from(metadata.symbol.slice(0, 10).padEnd(10, "\0"));
    const uriBytes = Buffer.from(ipfsResult.metadataUri.slice(0, 200).padEnd(200, "\0"));
    
    const createInstructionData = Buffer.alloc(1 + 32 + 10 + 200);
    createInstructionData.writeUInt8(0, 0);
    nameBytes.copy(createInstructionData, 1);
    symbolBytes.copy(createInstructionData, 33);
    uriBytes.copy(createInstructionData, 43);
    
    const createInstruction = new TransactionInstruction({
      programId: PUMP_FUN_PROGRAM_ID,
      keys: [
        { pubkey: mintKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
        { pubkey: bondingCurvePDA, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: metadataPDA, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: PUMP_METADATA_PROGRAM, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: createInstructionData,
    });
    
    transaction.add(createInstruction);
    
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = keypair.publicKey;
    
    transaction.sign(keypair, mintKeypair);
    
    console.log("[PumpFun Deploy] Sending transaction...");
    
    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair, mintKeypair], {
      commitment: "confirmed",
      maxRetries: 3,
    });
    
    console.log(`[PumpFun Deploy] Token created! Signature: ${signature}`);
    console.log(`[PumpFun Deploy] Token address: ${mintKeypair.publicKey.toBase58()}`);
    
    return {
      success: true,
      tokenAddress: mintKeypair.publicKey.toBase58(),
      signature,
      metadataUri: ipfsResult.metadataUri,
    };
  } catch (error) {
    console.error("[PumpFun Deploy] Deployment failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during deployment",
    };
  }
}

export async function deployTokenViaPumpPortal(
  privateKey: string,
  metadata: TokenMetadata,
  initialBuySOL: number = 0.01,
  imageBuffer?: Buffer
): Promise<DeployResult> {
  try {
    console.log(`[PumpPortal] Creating token via API: ${metadata.name} (${metadata.symbol})`);
    
    const actualInitialBuy = Math.max(0.01, initialBuySOL);
    
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    const connection = getConnection();
    
    const balance = await connection.getBalance(keypair.publicKey);
    const requiredBalance = (actualInitialBuy + 0.02) * LAMPORTS_PER_SOL;
    
    console.log(`[PumpPortal] Wallet balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`[PumpPortal] Required: ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL (${actualInitialBuy} SOL buy + 0.02 SOL fees)`);
    
    if (balance < requiredBalance) {
      return {
        success: false,
        error: `Insufficient balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL. Need at least ${(requiredBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL (${actualInitialBuy} SOL for initial buy + ~0.02 SOL for fees).`,
      };
    }
    
    console.log(`[PumpPortal] Uploading metadata to IPFS...`);
    const ipfsResult = await uploadMetadataToIPFS(metadata, imageBuffer);
    if (!ipfsResult.success || !ipfsResult.metadataUri) {
      return { success: false, error: ipfsResult.error || "Failed to upload metadata to IPFS. Try again or check image format." };
    }
    
    console.log(`[PumpPortal] Metadata uploaded: ${ipfsResult.metadataUri}`);
    
    const mintKeypair = Keypair.generate();
    console.log(`[PumpPortal] Generated mint address: ${mintKeypair.publicKey.toBase58()}`);
    
    console.log(`[PumpPortal] Requesting transaction from PumpPortal API...`);
    console.log(`[PumpPortal] Initial buy: ${actualInitialBuy} SOL`);
    
    const response = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: keypair.publicKey.toBase58(),
        action: "create",
        tokenMetadata: {
          name: metadata.name,
          symbol: metadata.symbol,
          uri: ipfsResult.metadataUri,
        },
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: "true",
        amount: actualInitialBuy,
        slippage: 15,
        priorityFee: 0.001,
        pool: "pump",
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PumpPortal] API error response: ${errorText}`);
      return { success: false, error: `PumpPortal API error (${response.status}): ${errorText}` };
    }
    
    const txData = await response.arrayBuffer();
    if (txData.byteLength === 0) {
      return { success: false, error: "PumpPortal returned empty transaction data" };
    }
    
    console.log(`[PumpPortal] Received transaction data (${txData.byteLength} bytes)`);
    
    // PumpPortal returns versioned transactions, use VersionedTransaction.deserialize
    const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
    
    // Sign with both keypairs (deployer and mint)
    tx.sign([keypair, mintKeypair]);
    
    console.log(`[PumpPortal] Sending transaction to Solana...`);
    
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    
    console.log(`[PumpPortal] Transaction sent: ${signature}`);
    console.log(`[PumpPortal] Waiting for confirmation...`);
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed");
    
    if (confirmation.value.err) {
      console.error(`[PumpPortal] Transaction failed:`, confirmation.value.err);
      return { 
        success: false, 
        error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        signature 
      };
    }
    
    console.log(`[PumpPortal] Token created successfully!`);
    console.log(`[PumpPortal] Signature: ${signature}`);
    console.log(`[PumpPortal] Token address: ${mintKeypair.publicKey.toBase58()}`);
    console.log(`[PumpPortal] View on Pump.fun: https://pump.fun/${mintKeypair.publicKey.toBase58()}`);
    
    return {
      success: true,
      tokenAddress: mintKeypair.publicKey.toBase58(),
      signature,
      metadataUri: ipfsResult.metadataUri,
    };
  } catch (error) {
    console.error("[PumpPortal] Deployment failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("blockhash")) {
      return { success: false, error: "Transaction expired. Network may be congested, please try again." };
    }
    if (errorMessage.includes("insufficient")) {
      return { success: false, error: "Insufficient SOL balance. Please add more SOL to your wallet." };
    }
    
    return { success: false, error: errorMessage };
  }
}
