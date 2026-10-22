import { useQuery } from "@tanstack/react-query";

export interface NetworkStatusData {
  walletNetwork: string;
  tradingNetwork: string;
  consistent: boolean;
  explicitlyConfigured: boolean;
  rpcVerified: boolean;
  transactionsEnabled: boolean;
  airdropEnabled?: boolean;
  reason: string;
  explorerSuffix: string;
}

export function useNetworkStatus() {
  return useQuery<NetworkStatusData>({
    queryKey: ["/api/network/status"],
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
