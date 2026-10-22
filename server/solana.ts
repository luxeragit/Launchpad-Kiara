import { 
  Connection, 
  Keypair, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createBurnInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { encode as base58Encode, decode as base58Decode } from "./base58";

// Use devnet by default, can be configured via environment variable
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC_URL, "confirmed");

export interface WalletKeypair {
  publicKey: string;
  privateKey: string;
}

// Generate a new Solana keypair
export function generateKeypair(): WalletKeypair {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    privateKey: base58Encode(keypair.secretKey),
  };
}

// Import keypair from base58 private key
export function importKeypair(privateKeyBase58: string): WalletKeypair {
  try {
    const secretKey = base58Decode(privateKeyBase58);
    const keypair = Keypair.fromSecretKey(secretKey);
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: privateKeyBase58,
    };
  } catch (error) {
    throw new Error("Invalid private key format");
  }
}

// Get SOL balance for an address
export async function getBalance(address: string): Promise<number> {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error getting balance:", error);
    return 0;
  }
}

// Get balances for multiple addresses
export async function getBalances(addresses: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  
  await Promise.all(
    addresses.map(async (address) => {
      const balance = await getBalance(address);
      balances.set(address, balance);
    })
  );
  
  return balances;
}

// Transfer SOL from one wallet to another
export async function transferSol(
  fromPrivateKey: string,
  toAddress: string,
  amountSol: number
): Promise<string> {
  try {
    const secretKey = base58Decode(fromPrivateKey);
    const fromKeypair = Keypair.fromSecretKey(secretKey);
    const toPublicKey = new PublicKey(toAddress);
    
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports,
      })
    );
    
    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeypair]);
    return signature;
  } catch (error) {
    console.error("Transfer error:", error);
    throw error;
  }
}

// Validate Solana address
export function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Request airdrop (devnet only)
export async function requestAirdrop(address: string, amount: number = 1): Promise<string> {
  try {
    const publicKey = new PublicKey(address);
    const signature = await connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
    return signature;
  } catch (error) {
    console.error("Airdrop error:", error);
    throw error;
  }
}

// Get connection info
export function getConnectionInfo() {
  return {
    rpcUrl: SOLANA_RPC_URL,
    isDevnet: SOLANA_RPC_URL.includes("devnet"),
  };
}

// Get SPL token balance for a wallet
export async function getTokenBalance(
  walletAddress: string,
  tokenMint: string
): Promise<{ balance: number; decimals: number }> {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(tokenMint);
    
    const tokenAccountAddress = await getAssociatedTokenAddress(
      mintPubkey,
      walletPubkey
    );
    
    const tokenAccount = await getAccount(connection, tokenAccountAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    
    let decimals = 9; // default
    if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
      decimals = mintInfo.value.data.parsed.info.decimals;
    }
    
    const balance = Number(tokenAccount.amount) / Math.pow(10, decimals);
    return { balance, decimals };
  } catch (error) {
    console.error("Error getting token balance:", error);
    return { balance: 0, decimals: 9 };
  }
}

// Burn SPL tokens
export async function burnSplTokens(
  privateKey: string,
  tokenMint: string,
  amount: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const secretKey = base58Decode(privateKey);
    const ownerKeypair = Keypair.fromSecretKey(secretKey);
    const mintPubkey = new PublicKey(tokenMint);
    
    // Get the associated token account
    const tokenAccountAddress = await getAssociatedTokenAddress(
      mintPubkey,
      ownerKeypair.publicKey
    );
    
    // Get token account info to check balance and decimals
    const tokenAccount = await getAccount(connection, tokenAccountAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    
    let decimals = 9;
    if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
      decimals = mintInfo.value.data.parsed.info.decimals;
    }
    
    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
    
    if (rawAmount > tokenAccount.amount) {
      return {
        success: false,
        error: `Insufficient balance. You have ${Number(tokenAccount.amount) / Math.pow(10, decimals)} tokens`,
      };
    }
    
    // Create burn instruction
    const burnInstruction = createBurnInstruction(
      tokenAccountAddress,
      mintPubkey,
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
    
    console.log(`[Burn] Successfully burned ${amount} tokens. Signature: ${signature}`);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error("Error burning tokens:", error);
    return {
      success: false,
      error: error.message || "Failed to burn tokens",
    };
  }
}
