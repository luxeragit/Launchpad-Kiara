import crypto from "crypto";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { decode as bs58Decode } from "./base58";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!key) {
    throw new Error("ENCRYPTION_KEY or SESSION_SECRET environment variable is required for encryption");
  }
  return key;
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, "sha512");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const buffer = Buffer.from(encryptedData, "base64");
  
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, "sha512");
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  
  return decipher.update(encrypted) + decipher.final("utf8");
}

export function generateNonce(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Verify signature against raw message bytes (for SIWS / production mode)
export async function verifySignatureBytesAsync(messageBytes: Uint8Array, signature: string, publicKeyStr: string): Promise<boolean> {
  try {
    console.log("=== BYTE-LEVEL VERIFICATION START ===");
    console.log("Wallet:", publicKeyStr);
    console.log("Signature length:", signature.length);
    console.log("Message bytes length:", messageBytes.length);
    
    const pubKeyBytes = bs58Decode(publicKeyStr);
    const signatureBytes = bs58Decode(signature);
    
    console.log("Decoded - sig:", signatureBytes.length, "pub:", pubKeyBytes.length);
    console.log("Msg bytes (first 20):", Array.from(messageBytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Try @noble/ed25519 first
    try {
      const ed = await import("@noble/ed25519");
      const nobleResult = await ed.verifyAsync(signatureBytes, messageBytes, pubKeyBytes);
      console.log("Noble ed25519 byte verification:", nobleResult);
      if (nobleResult) {
        console.log("=== BYTE VERIFICATION SUCCESS (noble) ===");
        return true;
      }
    } catch (e) {
      console.log("Noble error:", e instanceof Error ? e.message : String(e));
    }
    
    // Try tweetnacl
    try {
      const naclResult = nacl.sign.detached.verify(messageBytes, signatureBytes, pubKeyBytes);
      console.log("Tweetnacl byte verification:", naclResult);
      if (naclResult) {
        console.log("=== BYTE VERIFICATION SUCCESS (nacl) ===");
        return true;
      }
    } catch (e) {
      console.log("Nacl error:", e instanceof Error ? e.message : String(e));
    }
    
    console.log("=== BYTE VERIFICATION FAILED ===");
    return false;
  } catch (error) {
    console.error("Byte verification error:", error);
    return false;
  }
}

// Verify signature against string message (for dev/legacy mode)
export async function verifySignatureAsync(message: string, signature: string, publicKeyStr: string): Promise<boolean> {
  const messageBytes = new TextEncoder().encode(message);
  console.log("Converting string message to bytes, length:", messageBytes.length);
  return verifySignatureBytesAsync(messageBytes, signature, publicKeyStr);
}

export function verifySignature(message: string, signature: string, publicKeyStr: string): boolean {
  try {
    console.log("Verifying signature (sync) for wallet:", publicKeyStr);
    console.log("Message to verify:", message);
    console.log("Signature (first 20 chars):", signature.substring(0, 20));
    
    // Use bs58 directly instead of PublicKey class
    const pubKeyBytes = bs58Decode(publicKeyStr);
    const signatureBytes = bs58Decode(signature);
    
    console.log("Signature bytes length:", signatureBytes.length);
    console.log("Public key bytes length:", pubKeyBytes.length);
    
    // Format 1: Plain message (standard approach)
    const messageBytes = new TextEncoder().encode(message);
    console.log("Trying plain message, bytes length:", messageBytes.length);
    
    let result = nacl.sign.detached.verify(messageBytes, signatureBytes, pubKeyBytes);
    console.log("Plain message verification result:", result);
    if (result) return true;
    
    // Format 2: Solana off-chain message signing format (CAIP-122)
    const solanaPrefix = Buffer.from([0xff]);
    const domainPrefix = Buffer.from("solana offchain");
    const versionByte = Buffer.from([0]);
    const formatByte = Buffer.from([0]); // ASCII format
    const lengthBytes = Buffer.alloc(2);
    lengthBytes.writeUInt16LE(message.length, 0);
    
    const prefixedMessage = Buffer.concat([
      solanaPrefix,
      domainPrefix,
      versionByte,
      formatByte,
      lengthBytes,
      Buffer.from(message)
    ]);
    
    console.log("Trying CAIP-122 format, bytes length:", prefixedMessage.length);
    result = nacl.sign.detached.verify(prefixedMessage, signatureBytes, pubKeyBytes);
    console.log("CAIP-122 verification result:", result);
    if (result) return true;
    
    // Format 3: Phantom may use format byte 1 (UTF-8) instead of 0 (ASCII)
    const formatByteUtf8 = Buffer.from([1]);
    const prefixedMessageUtf8 = Buffer.concat([
      solanaPrefix,
      domainPrefix,
      versionByte,
      formatByteUtf8,
      lengthBytes,
      Buffer.from(message)
    ]);
    
    console.log("Trying CAIP-122 UTF-8 format, bytes length:", prefixedMessageUtf8.length);
    result = nacl.sign.detached.verify(prefixedMessageUtf8, signatureBytes, pubKeyBytes);
    console.log("CAIP-122 UTF-8 verification result:", result);
    if (result) return true;
    
    // Format 4: Some wallets use version 1
    const versionByte1 = Buffer.from([1]);
    const prefixedMessageV1 = Buffer.concat([
      solanaPrefix,
      domainPrefix,
      versionByte1,
      formatByte,
      lengthBytes,
      Buffer.from(message)
    ]);
    
    console.log("Trying CAIP-122 v1 format");
    result = nacl.sign.detached.verify(prefixedMessageV1, signatureBytes, pubKeyBytes);
    console.log("CAIP-122 v1 verification result:", result);
    if (result) return true;
    
    // Format 5: Just the domain without version/format bytes
    const simplePrefixed = Buffer.concat([
      Buffer.from("solana offchain"),
      Buffer.from(message)
    ]);
    
    console.log("Trying simple domain prefix");
    result = nacl.sign.detached.verify(simplePrefixed, signatureBytes, pubKeyBytes);
    console.log("Simple prefix verification result:", result);
    if (result) return true;
    
    // Format 6: With application header (newer Phantom format)
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32LE(0, 0); // No header
    const bodyLength = Buffer.alloc(4);
    bodyLength.writeUInt32LE(message.length, 0);
    
    const applicationFormat = Buffer.concat([
      solanaPrefix,
      domainPrefix,
      Buffer.from([0, 0]), // version + format
      headerLength,
      bodyLength,
      Buffer.from(message)
    ]);
    
    console.log("Trying application format");
    result = nacl.sign.detached.verify(applicationFormat, signatureBytes, pubKeyBytes);
    console.log("Application format verification result:", result);
    if (result) return true;
    
    console.log("All verification formats failed");
    return false;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}
