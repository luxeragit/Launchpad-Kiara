import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { TokenDashboardWorkspace } from "@/components/terminal/token-dashboard-workspace";
import { useAuth } from "@/contexts/AuthContext";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FeeActivity, TokenDeployment, TokenHolding, Wallet as WalletType } from "@shared/schema";

interface TokenAnalytics {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  priceChange1m: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  transactions: number;
  bondingCurveProgress: number;
  bondingCurveTarget: number;
  score: number;
}

interface RugSafetyScore {
  totalScore: number;
  checks: { name: string; passed: boolean; value: string; weight: number }[];
}

interface FeeInfo {
  deployment: {
    id: string;
    name: string;
    symbol: string;
    tokenAddress: string;
    burnPercent: number;
    ammPercent: number;
    creatorPercent: number;
    liquidityPercent: number;
    totalFeesCollected: number;
    totalFeesDistributed: number;
    totalBurned: number;
    autoClaimEnabled: boolean;
    lastClaimAt: string | null;
  };
  activities: FeeActivity[];
}

interface LPTokenInfo {
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

function formatNumber(num: number, decimals = 2): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

function formatSOL(amount: number): string {
  return `${amount.toFixed(4)} SOL`;
}

export default function TokenDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const network = useNetworkStatus();
  const transactionsEnabled = !!network.data?.transactionsEnabled && !network.isError;

  const [allocations, setAllocations] = useState({ burn: 20, amm: 30, creator: 25, liquidity: 25 });
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [buyAmount, setBuyAmount] = useState("0.1");
  const [sellPercent, setSellPercent] = useState(100);
  const [lpBurnAmount, setLpBurnAmount] = useState("");
  const [selectedLpWalletId, setSelectedLpWalletId] = useState("");
  const [distributionAmount, setDistributionAmount] = useState("");

  const { data: deployment, isLoading: deploymentLoading, isError: deploymentError, refetch: refetchDeployment } = useQuery<TokenDeployment>({
    queryKey: ["/api/tokens", id],
    enabled: !!id && isAuthenticated,
    refetchInterval: 10000,
  });
  const { data: feeInfo, isLoading: feeLoading, isError: feeError, refetch: refetchFees } = useQuery<FeeInfo>({
    queryKey: ["/api/tokens", id, "fees"],
    enabled: !!id && isAuthenticated,
    refetchInterval: 15000,
  });
  const { data: analytics, isLoading: analyticsLoading } = useQuery<TokenAnalytics>({
    queryKey: ["/api/tokens", id, "analytics"],
    enabled: !!id && isAuthenticated && !!deployment?.tokenAddress,
    refetchInterval: 5000,
  });
  const { data: safetyScore, isLoading: safetyLoading } = useQuery<RugSafetyScore>({
    queryKey: ["/api/tokens", id, "safety"],
    enabled: !!id && isAuthenticated && !!deployment?.tokenAddress,
    refetchInterval: 30000,
  });
  const { data: wallets } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });
  const { data: tokenHoldings, refetch: refetchHoldings } = useQuery<TokenHolding[]>({
    queryKey: ["/api/holdings/token", deployment?.tokenAddress],
    enabled: isAuthenticated && !!deployment?.tokenAddress,
    refetchInterval: 5000,
  });
  const { data: lpInfo, isLoading: lpLoading, refetch: refetchLpInfo } = useQuery<LPTokenInfo>({
    queryKey: ["/api/tokens/mint", deployment?.tokenAddress, "lp-info", selectedLpWalletId],
    enabled: isAuthenticated && !!deployment?.tokenAddress && !!selectedLpWalletId,
    refetchInterval: 10000,
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Connect your wallet to manage this launch record.");
      return apiRequest("DELETE", `/api/tokens/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Token deployment deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      setLocation("/deploy");
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const quickBuyMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Connect your wallet before buying.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      if (!selectedWalletId || !deployment?.tokenAddress) throw new Error("Select a wallet first");
      const amount = Number.parseFloat(buyAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid SOL amount");
      const response = await apiRequest("POST", "/api/trade/buy", {
        walletId: selectedWalletId,
        tokenMint: deployment.tokenAddress,
        solAmount: amount,
        tokenName: deployment.name,
        tokenSymbol: deployment.symbol,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        const description = data.tokenAmount
          ? `Bought ${formatNumber(data.tokenAmount)} tokens for ${buyAmount} SOL`
          : `Successfully bought tokens for ${buyAmount} SOL via ${data.platform || "Pump.fun"}`;
        toast({ title: "Buy Successful", description });
        refetchHoldings();
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      } else {
        toast({ title: "Buy Failed", description: data.error || "Transaction failed", variant: "destructive" });
      }
    },
    onError: (error: Error) => toast({ title: "Buy Error", description: error.message, variant: "destructive" }),
  });

  const quickSellMutation = useMutation({
    mutationFn: async (holdingWalletId: string) => {
      if (!isAuthenticated) throw new Error("Connect your wallet before selling.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      if (!deployment?.tokenAddress) throw new Error("Token address not found");
      const response = await apiRequest("POST", "/api/trade/sell", {
        walletId: holdingWalletId,
        tokenMint: deployment.tokenAddress,
        percentage: sellPercent,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Sell Successful", description: `Sold ${sellPercent}% for ${formatSOL(data.solAmount || 0)}` });
        refetchHoldings();
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
        queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      } else {
        toast({ title: "Sell Failed", description: data.error || "Transaction failed", variant: "destructive" });
      }
    },
    onError: (error: Error) => toast({ title: "Sell Error", description: error.message, variant: "destructive" }),
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async (data: { burnPercent: number; ammPercent: number; creatorPercent: number; liquidityPercent: number }) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to update fee allocation.");
      return apiRequest("PUT", `/api/tokens/${id}/fees/allocation`, data);
    },
    onSuccess: () => {
      toast({ title: "Allocation Updated", description: "Fee distribution allocation saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens", id, "fees"] });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const claimFeesMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Connect your wallet before opening Pump.fun.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      return apiRequest("POST", `/api/tokens/${id}/fees/claim`);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Fees Claimed", description: `Claimed ${formatSOL(data.amount || 0)}` });
      } else {
        toast({ title: "Claim Not Available", description: data.error || "Please claim fees via pump.fun website", variant: "destructive" });
      }
      refetchFees();
    },
    onError: (error: Error) => toast({ title: "Claim Failed", description: error.message, variant: "destructive" }),
  });

  const distributeFeesMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!isAuthenticated) throw new Error("Connect your wallet before distributing fees.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      if (!deployment?.tokenAddress) throw new Error("A confirmed token mint is required.");
      const response = await apiRequest("POST", `/api/tokens/${id}/fees/distribute`, { amount });
      return response.json() as Promise<{
        success: boolean; burnAmount?: number; ammAmount?: number; creatorAmount?: number;
        liquidityAmount?: number; burnTx?: string; error?: string;
      }>;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Fee distribution submitted",
          description: `Burn allocation: ${result.burnAmount ?? "—"} tokens${result.burnTx ? ` · ${result.burnTx.slice(0, 10)}…` : ""}`,
        });
      } else {
        toast({
          title: "Distribution incomplete",
          description: result.error || "No burn operation was confirmed. AMM and liquidity allocations require manual DEX integration.",
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tokens", id, "fees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens", id] });
      setDistributionAmount("");
    },
    onError: (error: Error) => toast({ title: "Fee distribution failed", description: error.message, variant: "destructive" }),
  });

  const toggleAutoClaimMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to change monitoring settings.");
      if (enabled && !transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      return apiRequest("POST", `/api/tokens/${id}/autoclaim/toggle`, { enabled });
    },
    onSuccess: (enabled) => {
      toast({
        title: "Claim monitoring updated",
        description: enabled
          ? "Availability checks are on; creator claims still need to be completed on Pump.fun."
          : "Claim availability monitoring is off.",
      });
      refetchFees();
    },
  });

  const burnLpMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Connect your wallet before burning LP tokens.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      if (!selectedLpWalletId || !lpInfo?.lpMint || !deployment?.tokenAddress) {
        throw new Error("Select a wallet and ensure LP info is available");
      }
      const amount = Number.parseFloat(lpBurnAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid LP burn amount");
      if (amount > lpInfo.lpBalance) throw new Error(`Amount exceeds balance. You have ${lpInfo.lpBalance.toFixed(6)} LP tokens`);
      return apiRequest("POST", `/api/tokens/mint/${deployment.tokenAddress}/burn-lp`, {
        walletId: selectedLpWalletId,
        amount,
        lpMint: lpInfo.lpMint,
        decimals: lpInfo.lpDecimals,
        confirmed: true,
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "LP Tokens Burned",
          description: `Successfully burned ${lpBurnAmount} LP tokens. Signature: ${data.signature?.slice(0, 8)}...`,
        });
        setLpBurnAmount("");
        refetchLpInfo();
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      } else {
        toast({ title: "Burn Failed", description: data.error || "Transaction failed", variant: "destructive" });
      }
    },
    onError: (error: Error) => toast({ title: "Burn Error", description: error.message, variant: "destructive" }),
  });

  if (authLoading) {
    return <main className="terminal-workspace flex min-h-0 flex-col gap-2 p-3"><div className="h-11 animate-pulse bg-secondary/60" /><div className="h-64 animate-pulse bg-secondary/60" /><div className="h-40 animate-pulse bg-secondary/60" /></main>;
  }
  if (!isAuthenticated) {
    return <main className="terminal-workspace flex min-h-0 items-center justify-center p-4"><section className="flex max-w-md items-center gap-4 border border-border p-5"><img src="/kiara.png" alt="" className="h-16 w-16 object-contain" /><div><h1 className="text-sm font-semibold">Connect to open this token workspace</h1><p className="mt-1 text-xs text-muted-foreground">Token records, holdings, and wallet operations are isolated to your signed-in session.</p><div className="mt-3 flex items-center gap-2"><WalletConnectButton /><Button variant="ghost" size="sm" onClick={() => setLocation("/my-tokens")}>My Tokens</Button></div></div></section></main>;
  }
  if (deploymentLoading) {
    return <main className="terminal-workspace flex min-h-0 flex-col gap-2 p-3"><div className="h-10 animate-pulse bg-secondary/60" /><div className="h-72 animate-pulse bg-secondary/60" /><div className="h-24 animate-pulse bg-secondary/60" /></main>;
  }
  if (!deployment && deploymentError) {
    return <main className="terminal-workspace flex min-h-0 items-center justify-center p-4"><section className="border border-border p-5 text-center"><AlertTriangle className="mx-auto mb-2 h-5 w-5 text-destructive" /><h1 className="text-sm font-semibold">Launch record unavailable</h1><p className="mt-2 text-xs text-muted-foreground">The feed returned no record. No wallet or chain action was performed.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => refetchDeployment()}>Retry</Button></section></main>;
  }
  if (!deployment) {
    return <main className="terminal-workspace flex min-h-0 items-center justify-center"><section className="text-center"><img src="/kiara.png" alt="" className="mx-auto h-16 w-16 object-contain" /><p className="mt-2 text-xs">Token record not found</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/deploy")}>Back to launches</Button></section></main>;
  }

  return <TokenDashboardWorkspace
    deployment={deployment}
    analytics={analytics} analyticsLoading={analyticsLoading}
    safety={safetyScore} safetyLoading={safetyLoading}
    fees={feeInfo} feeLoading={feeLoading} feeError={feeError}
    holdings={tokenHoldings} wallets={wallets} lpInfo={lpInfo} lpLoading={lpLoading}
    transactionsEnabled={transactionsEnabled} networkReason={network.data?.reason}
    onBack={() => setLocation("/deploy")} onRefreshFees={() => refetchFees()}
    onBuy={() => quickBuyMutation.mutate()} onSell={(walletId) => quickSellMutation.mutate(walletId)}
    onAllocation={(data) => updateAllocationMutation.mutate(data)} onClaim={() => claimFeesMutation.mutate()}
    onOpenClaim={() => deployment.tokenAddress && window.open(`https://pump.fun/coin/${deployment.tokenAddress}`, "_blank", "noopener,noreferrer")}
    onDistribute={() => distributeFeesMutation.mutate(Number(distributionAmount))}
    distributionPending={distributeFeesMutation.isPending} distributionAmount={distributionAmount}
    setDistributionAmount={setDistributionAmount}
    onAutoClaim={(enabled) => toggleAutoClaimMutation.mutate(enabled)} onBurnLp={() => burnLpMutation.mutate()}
    onDelete={() => deleteTokenMutation.mutate()}
    buyPending={quickBuyMutation.isPending} sellPending={quickSellMutation.isPending}
    allocationPending={updateAllocationMutation.isPending} claimPending={claimFeesMutation.isPending}
    autoClaimPending={toggleAutoClaimMutation.isPending} burnPending={burnLpMutation.isPending}
    deletePending={deleteTokenMutation.isPending}
    selectedWalletId={selectedWalletId} setSelectedWalletId={setSelectedWalletId}
    buyAmount={buyAmount} setBuyAmount={setBuyAmount} sellPercent={sellPercent} setSellPercent={setSellPercent}
    allocations={allocations} setAllocations={setAllocations}
    selectedLpWalletId={selectedLpWalletId} setSelectedLpWalletId={setSelectedLpWalletId}
    lpBurnAmount={lpBurnAmount} setLpBurnAmount={setLpBurnAmount}
  />;
}
