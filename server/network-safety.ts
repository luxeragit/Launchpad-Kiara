import type { Request, Response, NextFunction } from "express";
import { isProduction } from "./env";

export type SolanaNetwork = "mainnet-beta" | "devnet" | "testnet" | "unknown";

export interface NetworkStatus {
  walletNetwork: SolanaNetwork;
  tradingNetwork: SolanaNetwork;
  consistent: boolean;
  explicitlyConfigured: boolean;
  rpcVerified: boolean;
  approvalPresent: boolean;
  transactionsEnabled: boolean;
  reason: string;
  explorerSuffix: string;
  airdropEnabled: boolean;
}

const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

export function networkFromUrl(url: string): SolanaNetwork {
  // URL labels are only informational. The genesis hash authorizes Mainnet.
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("devnet")) return "devnet";
    if (host.includes("testnet")) return "testnet";
    if (host.includes("mainnet")) return "mainnet-beta";
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function evaluateNetwork(
  rpcUrl: string | undefined,
  approved: boolean,
  genesisHash?: string,
  production = false,
): NetworkStatus {
  const configured = Boolean(rpcUrl);
  let walletNetwork = networkFromUrl(rpcUrl || "https://api.devnet.solana.com");
  let tradingNetwork = networkFromUrl(rpcUrl || "https://api.mainnet-beta.solana.com");
  const rpcVerified = configured && genesisHash === MAINNET_GENESIS;
  if (configured && genesisHash) {
    const verifiedNetwork = genesisHash === MAINNET_GENESIS
      ? "mainnet-beta" : genesisHash === DEVNET_GENESIS ? "devnet" : "unknown";
    walletNetwork = verifiedNetwork;
    tradingNetwork = verifiedNetwork;
  }
  const consistent = configured && walletNetwork === tradingNetwork
    && walletNetwork !== "unknown";
  const transactionsEnabled = consistent && rpcVerified && approved;
  let reason = "Mainnet verified. Transactions are enabled.";
  if (!configured) {
    reason = "Trading paused: wallet and trading services use different networks. Configure a shared Mainnet RPC first.";
  } else if (!rpcVerified) {
    reason = "Trading paused: the configured RPC has not been verified as Solana Mainnet.";
  } else if (!approved) {
    reason = "Mainnet verified. Transactions remain paused until explicitly approved.";
  }
  return {
    walletNetwork, tradingNetwork, consistent, explicitlyConfigured: configured,
    rpcVerified, approvalPresent: approved, transactionsEnabled, reason,
    explorerSuffix: walletNetwork === "devnet" ? "?cluster=devnet"
      : walletNetwork === "testnet" ? "?cluster=testnet" : "",
    airdropEnabled: walletNetwork === "devnet" && !production,
  };
}

let cached: { until: number; status: NetworkStatus } | undefined;
let pending: Promise<NetworkStatus> | undefined;

export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (cached && cached.until > Date.now()) return cached.status;
  if (pending) return pending;
  pending = (async () => {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const approved = process.env.MAINNET_TRANSACTIONS_ENABLED === "true";
    let genesisHash: string | undefined;
    if (rpcUrl) {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const json = await response.json();
          if (typeof json.result === "string") genesisHash = json.result;
        }
      } catch {
        // Never expose the RPC URL: it can contain provider credentials.
      }
    }
    const status = evaluateNetwork(rpcUrl, approved, genesisHash, isProduction);
    cached = { until: Date.now() + 60_000, status };
    return status;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}

/** Keep transaction implementations intact; block entry while configuration is unsafe. */
export function isFinancialRequest(method: string, path: string, body?: Record<string, unknown>): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
  const normalized = path.replace(/\/+$/, "").toLowerCase();
  if ([
    "/wallets/transfer", "/wallets/fund", "/wallets/consolidate", "/wallets/burn",
    "/tokens/deploy", "/trade/buy", "/trade/sell",
    "/monitoring/start", "/autosell/start",
  ].includes(normalized)) return true;
  if (/^\/holdings\/[^/]+\/sell$/.test(normalized)) return true;
  if (/^\/tokens\/[^/]+\/fees\/(claim|distribute)$/.test(normalized)) return true;
  if (/^\/tokens\/mint\/[^/]+\/burn-lp$/.test(normalized)) return true;
  if (/^\/tokens\/[^/]+\/autoclaim\/toggle$/.test(normalized)) return Boolean(body?.enabled);
  // Saved automation may be disabled or edited; never enable it through settings
  // while financial execution is blocked. Existing saved settings are not reset.
  return normalized === "/trade/settings"
    && Boolean(body?.isMonitoring || body?.autoSellEnabled);
}

export async function networkSafetyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Let existing route auth preserve its own 401 behavior.
  if (!req.session?.userId) return next();
  const isAirdrop = req.method === "POST" && /^\/wallets\/[^/]+\/airdrop\/?$/i.test(req.path);
  if (!isAirdrop && !isFinancialRequest(req.method, req.path, req.body)) return next();
  const status = await getNetworkStatus();
  if (isAirdrop ? status.airdropEnabled : status.transactionsEnabled) return next();
  return res.status(409).json({
    error: isAirdrop ? "Airdrops are only available on Devnet outside production." : status.reason,
    code: "NETWORK_NOT_READY",
  });
}
