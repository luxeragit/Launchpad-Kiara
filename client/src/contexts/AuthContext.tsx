import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import bs58 from "bs58";

interface User {
  id: string;
  walletAddress: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  connectWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
      isConnected: boolean;
    };
    solflare?: {
      isSolflare?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
      isConnected: boolean;
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      const data = await response.json();
      
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Session check failed:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const getWalletProvider = () => {
    if (window.solana?.isPhantom) {
      return window.solana;
    }
    if (window.solflare?.isSolflare) {
      return window.solflare;
    }
    return null;
  };

  const connectWallet = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const provider = getWalletProvider();
      
      if (!provider) {
        throw new Error("No Solana wallet found. Please install Phantom or Solflare.");
      }

      const resp = await provider.connect();
      const walletAddress = resp.publicKey.toString();

      const nonceResponse = await fetch(`/api/auth/nonce/${walletAddress}`);
      if (!nonceResponse.ok) {
        throw new Error("Failed to get authentication nonce");
      }
      const { message } = await nonceResponse.json();

      const encodedMessage = new TextEncoder().encode(message);
      
      // Call signMessage with explicit "utf8" display mode
      const signedMessage = await (provider as any).signMessage(encodedMessage, "utf8");
      
      // Log response
      console.log("=== PHANTOM RESPONSE ===");
      console.log("Response keys:", signedMessage && typeof signedMessage === 'object' ? Object.keys(signedMessage) : 'N/A');
      
      // Extract signature bytes
      let signatureBytes: Uint8Array;
      
      if (signedMessage instanceof Uint8Array) {
        signatureBytes = signedMessage;
      } else if (signedMessage.signature instanceof Uint8Array) {
        signatureBytes = signedMessage.signature;
      } else if (signedMessage.signature && signedMessage.signature.type === 'Buffer' && Array.isArray(signedMessage.signature.data)) {
        signatureBytes = new Uint8Array(signedMessage.signature.data);
      } else {
        console.error("Unknown signature format:", signedMessage);
        throw new Error("Unexpected signature format from wallet");
      }
      
      // Use hex encoding instead of base58 - more reliable across environments
      const bytesToHex = (bytes: Uint8Array): string => 
        Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const signatureHex = bytesToHex(signatureBytes);
      const messageHex = bytesToHex(encodedMessage);
      
      console.log("Wallet address:", walletAddress);
      console.log("Message:", message);
      console.log("Signature bytes:", signatureBytes.length);
      console.log("Message hex (first 40):", messageHex.substring(0, 40) + "...");
      console.log("Signature hex (first 40):", signatureHex.substring(0, 40) + "...");

      const verifyResponse = await apiRequest("POST", "/api/auth/verify", {
        walletAddress,
        signatureHex,
        messageHex,
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || "Authentication failed");
      }

      const { user: authenticatedUser } = await verifyResponse.json();
      setUser(authenticatedUser);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(errorMessage);
      console.error("Wallet connection error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      
      const provider = getWalletProvider();
      if (provider?.isConnected) {
        await provider.disconnect();
      }
      
      setUser(null);
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        connectWallet,
        disconnect,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
