import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { bytesToHex, signatureBytes, walletError } from "@/lib/wallet-auth";
import type { WalletKit } from "@/lib/reown";
import type { Provider } from "@reown/appkit-adapter-solana/react";

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
const loadWallet = () => import("@/lib/reown");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  const kitRef = useRef<WalletKit>();
  const generation = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  // Serialize session mutations: a stale signature cannot re-create a session
  // after an account change/disconnect has queued its logout.
  const sessionQueue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = sessionQueue.current.then(operation, operation);
    sessionQueue.current = result.catch(() => {});
    return result;
  }, []);
  const forgetUser = useCallback(() => {
    userRef.current = null;
    setUser(null);
    // Never leave the previous wallet's private records in the query cache.
    void queryClient.cancelQueries();
    queryClient.clear();
  }, []);

  useEffect(() => {
    mounted.current = true;
    let unsubscribe = () => {};
    let disposed = false;
    const initialGeneration = generation.current;
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { credentials: "include" });
        if (!response.ok) throw new Error("Session check failed.");
        const data = await response.json();
        if (!disposed && initialGeneration === generation.current) {
          userRef.current = data.authenticated ? data.user : null;
          setUser(userRef.current);
        }
      } catch {
        if (!disposed) setUser(null);
      } finally {
        if (!disposed) setIsLoading(false);
      }
      try {
        const wallet = await loadWallet();
        const kit = await wallet.getWalletKit();
        if (disposed) return;
        kitRef.current = kit;
        let previousAddress: string | undefined = kit.getAccount("solana")?.address;
        const onAccount = (account: { isConnected: boolean; address?: string } | undefined) => {
          const address = account?.isConnected ? account.address : undefined;
          const changed = !!previousAddress && address !== previousAddress;
          const mismatch = !!address && !!userRef.current && address !== userRef.current.walletAddress;
          previousAddress = address;
          if (!changed && !mismatch) return;
          generation.current++;
          forgetUser();
          setError(address ? "Wallet changed. Connect again to sign in." : null);
          void enqueue(() => apiRequest("POST", "/api/auth/logout", {})).catch(() => {
            if (mounted.current) setError("Session logout failed. Please retry Disconnect.");
          });
        };
        unsubscribe = kit.subscribeAccount(onAccount, "solana");
        onAccount(kit.getAccount("solana"));
      } catch {
        // Browse without a wallet; configuration/provider errors surface on Connect.
      }
    })();
    return () => { disposed = true; mounted.current = false; generation.current++; unsubscribe(); };
  }, [enqueue, forgetUser]);

  useEffect(() => {
    if (!user || !kitRef.current) return;
    const provider = kitRef.current.getProvider<Provider>("solana");
    if (!provider?.on) return;
    const changed = (publicKey: { toBase58?: () => string } | undefined) => {
      const address = publicKey?.toBase58?.();
      if (!userRef.current || address === userRef.current.walletAddress) return;
      generation.current++;
      forgetUser();
      setError(address ? "Wallet changed. Connect again to sign in." : null);
      void enqueue(() => apiRequest("POST", "/api/auth/logout", {})).catch(() => {
        if (mounted.current) setError("Session logout failed. Please retry Disconnect.");
      });
    };
    const disconnected = () => changed(undefined);
    provider.on("accountsChanged", changed);
    provider.on("disconnect", disconnected);
    return () => {
      provider.removeListener("accountsChanged", changed);
      provider.removeListener("disconnect", disconnected);
    };
  }, [user, enqueue, forgetUser]);

  const connectWallet = async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setIsLoading(true);
    const attempt = ++generation.current;
    try {
      const wallet = await loadWallet();
      const kit = await wallet.getWalletKit();
      kitRef.current = kit;
      const walletAddress = await wallet.connectSolana(kit);
      if (attempt !== generation.current) throw new Error("Wallet changed. Please connect again.");
      const provider = wallet.getSolanaProvider(kit);
      const nonceResponse = await fetch(`/api/auth/nonce/${encodeURIComponent(walletAddress)}`, { credentials: "include", cache: "no-store" });
      if (!nonceResponse.ok) throw new Error("Unable to request a login message. Please retry.");
      const { message } = await nonceResponse.json();
      if (typeof message !== "string" || !message.startsWith("KiaraFun Authentication - Nonce: ")) {
        throw new Error("The login message is invalid.");
      }
      const encoded = new TextEncoder().encode(message);
      const signature = signatureBytes(await provider.signMessage(encoded));
      const current = kit.getAccount("solana");
      if (attempt !== generation.current || !current?.isConnected || current.address !== walletAddress) {
        throw new Error("Wallet changed. Please connect again.");
      }
      await enqueue(async () => {
        if (attempt !== generation.current) throw new Error("Wallet changed. Please connect again.");
        const response = await apiRequest("POST", "/api/auth/verify", {
          walletAddress,
          signatureHex: bytesToHex(signature),
          messageHex: bytesToHex(encoded),
        });
        const { user: authenticatedUser } = await response.json();
        if (attempt !== generation.current) return;
        if (authenticatedUser?.walletAddress !== walletAddress) throw new Error("Wallet verification failed.");
        queryClient.clear();
        userRef.current = authenticatedUser;
        setUser(authenticatedUser);
      });
    } catch (err) {
      if (mounted.current) setError(walletError(err));
    } finally {
      busy.current = false;
      if (mounted.current) setIsLoading(false);
    }
  };

  const disconnect = async () => {
    generation.current++;
    setIsLoading(true);
    setError(null);
    forgetUser();
    const results = await Promise.allSettled([
      enqueue(() => apiRequest("POST", "/api/auth/logout", {})),
      kitRef.current?.disconnect("solana") ?? Promise.resolve(),
    ]);
    if (mounted.current) {
      setIsLoading(false);
      if (results.some((result) => result.status === "rejected")) {
        setError("Could not fully disconnect. Please retry Disconnect.");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, connectWallet, disconnect, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
