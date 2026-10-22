import { Request, Response, NextFunction, Router } from "express";
import session from "express-session";
import { storage } from "./storage";
import { generateNonce, verifySignatureAsync, verifySignatureBytesAsync } from "./crypto";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    walletAddress?: string;
  }
}

interface AuthRequest extends Request {
  session: session.Session & Partial<session.SessionData> & {
    userId?: string;
    walletAddress?: string;
  };
}

export const authRouter = Router();

authRouter.get("/nonce/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress || walletAddress.length < 32) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    
    let user = await storage.getUserByWalletAddress(walletAddress);
    const nonce = generateNonce();
    
    if (!user) {
      user = await storage.createUser({
        walletAddress,
        nonce,
      });
    } else {
      await storage.updateUserNonce(user.id, nonce);
    }
    
    // Use simple message format without newlines to avoid encoding issues
    const message = `KiaraFun Authentication - Nonce: ${nonce}`;
    
    res.json({ message, nonce });
  } catch (error) {
    console.error("Nonce generation error:", error);
    res.status(500).json({ error: "Failed to generate nonce" });
  }
});

authRouter.post("/verify", async (req: AuthRequest, res) => {
  try {
    const { walletAddress, signatureHex, messageHex } = req.body;
    
    console.log("=== VERIFY REQUEST ===");
    console.log("Wallet Address:", walletAddress);
    console.log("Signature hex length:", signatureHex?.length);
    console.log("Message hex length:", messageHex?.length);
    
    if (!walletAddress || !signatureHex || !messageHex) {
      return res.status(400).json({ error: "Wallet address, signature, and message are required" });
    }
    
    const user = await storage.getUserByWalletAddress(walletAddress);
    
    console.log("User found:", user ? "yes" : "no");
    console.log("Stored nonce:", user?.nonce?.substring(0, 20) + "...");
    
    if (!user) {
      return res.status(401).json({ error: "User not found. Request a nonce first." });
    }
    
    // Convert hex to bytes
    const hexToBytes = (hex: string): Uint8Array => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytes;
    };
    
    const messageBytes = hexToBytes(messageHex);
    const signatureBytes = hexToBytes(signatureHex);
    const receivedMessage = new TextDecoder().decode(messageBytes);
    
    console.log("Received message:", receivedMessage);
    console.log("Message bytes length:", messageBytes.length);
    console.log("Signature bytes length:", signatureBytes.length);
    
    // Security: Ensure the nonce is present in the signed message
    if (!receivedMessage.includes(user.nonce)) {
      console.log("SECURITY: Nonce not found in signed message!");
      return res.status(401).json({ error: "Invalid nonce in message" });
    }
    
    // Verify signature using raw bytes
    const bs58 = await import("bs58");
    const pubKeyBytes = bs58.default.decode(walletAddress);
    
    let isValid = false;
    
    // Try @noble/ed25519 first
    try {
      const ed = await import("@noble/ed25519");
      isValid = await ed.verifyAsync(signatureBytes, messageBytes, pubKeyBytes);
      console.log("Noble ed25519 verification:", isValid);
    } catch (e) {
      console.log("Noble error:", e instanceof Error ? e.message : String(e));
    }
    
    // Fallback to tweetnacl
    if (!isValid) {
      try {
        const nacl = await import("tweetnacl");
        isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, pubKeyBytes);
        console.log("Tweetnacl verification:", isValid);
      } catch (e) {
        console.log("Nacl error:", e instanceof Error ? e.message : String(e));
      }
    }
    
    console.log("Final signature valid:", isValid);
    
    if (!isValid) {
      return res.status(401).json({ 
        error: "Invalid signature",
        debug: {
          walletAddress: walletAddress,
          storedNonce: user.nonce ? user.nonce.substring(0, 10) + "..." : "null",
          messageLength: messageBytes.length,
          signatureLength: signatureBytes.length,
          receivedMessage: receivedMessage.substring(0, 50) + "..."
        }
      });
    }
    
    const newNonce = generateNonce();
    await storage.updateUserNonce(user.id, newNonce);
    await storage.updateUserLastLogin(user.id);
    
    req.session.userId = user.id;
    req.session.walletAddress = walletAddress;
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      }
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

authRouter.get("/session", async (req: AuthRequest, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ authenticated: false });
    }
    
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false });
    }
    
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
      }
    });
  } catch (error) {
    console.error("Session check error:", error);
    res.status(500).json({ error: "Failed to check session" });
  }
});

authRouter.post("/logout", (req: AuthRequest, res) => {
  req.session.destroy((err: Error | null) => {
    if (err) {
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.json({ success: true });
  });
});

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  next();
}

export function getUserId(req: AuthRequest): string | undefined {
  return req.session.userId;
}
