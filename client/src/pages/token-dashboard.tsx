import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PriceChart } from "@/components/price-chart";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Flame,
  Coins,
  Users,
  Activity,
  Shield,
  AlertTriangle,
  Check,
  X,
  Zap,
  Droplets,
  Wallet,
  LineChart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TokenDeployment, FeeActivity, Wallet as WalletType, TokenHolding } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  checks: {
    name: string;
    passed: boolean;
    value: string;
    weight: number;
  }[];
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

function formatNumber(num: number, decimals = 2): string {
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + "K";
  return num.toFixed(decimals);
}

function formatSOL(amount: number): string {
  return amount.toFixed(4) + " SOL";
}

export default function TokenDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [allocations, setAllocations] = useState({
    burn: 20,
    amm: 30,
    creator: 25,
    liquidity: 25,
  });

  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [buyAmount, setBuyAmount] = useState<string>("0.1");
  const [sellPercent, setSellPercent] = useState<number>(100);
  const [lpBurnAmount, setLpBurnAmount] = useState<string>("");
  const [selectedLpWalletId, setSelectedLpWalletId] = useState<string>("");

  const { data: deployment, isLoading: deploymentLoading } = useQuery<TokenDeployment>({
    queryKey: ["/api/tokens", id],
    enabled: !!id,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const { data: feeInfo, isLoading: feeLoading, refetch: refetchFees } = useQuery<FeeInfo>({
    queryKey: ["/api/tokens", id, "fees"],
    enabled: !!id,
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<TokenAnalytics>({
    queryKey: ["/api/tokens", id, "analytics"],
    enabled: !!id && !!deployment?.tokenAddress,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time data
  });

  const { data: safetyScore, isLoading: safetyLoading } = useQuery<RugSafetyScore>({
    queryKey: ["/api/tokens", id, "safety"],
    enabled: !!id && !!deployment?.tokenAddress,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: wallets } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const { data: tokenHoldings, refetch: refetchHoldings } = useQuery<TokenHolding[]>({
    queryKey: ["/api/holdings/token", deployment?.tokenAddress],
    enabled: !!deployment?.tokenAddress,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/tokens/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Token deployment deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      setLocation("/deploy");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const quickBuyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWalletId || !deployment?.tokenAddress) {
        throw new Error("Select a wallet first");
      }
      const amount = parseFloat(buyAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid SOL amount");
      }
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
          : `Successfully bought tokens for ${buyAmount} SOL via ${data.platform || 'Pump.fun'}`;
        toast({
          title: "Buy Successful",
          description,
        });
        refetchHoldings();
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      } else {
        toast({
          title: "Buy Failed",
          description: data.error || "Transaction failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Buy Error", description: error.message, variant: "destructive" });
    },
  });

  const quickSellMutation = useMutation({
    mutationFn: async (holdingWalletId: string) => {
      if (!deployment?.tokenAddress) {
        throw new Error("Token address not found");
      }
      const response = await apiRequest("POST", "/api/trade/sell", {
        walletId: holdingWalletId,
        tokenMint: deployment.tokenAddress,
        percentage: sellPercent,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "Sell Successful",
          description: `Sold ${sellPercent}% for ${formatSOL(data.solAmount || 0)}`,
        });
        refetchHoldings();
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
        queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      } else {
        toast({
          title: "Sell Failed",
          description: data.error || "Transaction failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Sell Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async (data: { burnPercent: number; ammPercent: number; creatorPercent: number; liquidityPercent: number }) => {
      return apiRequest("PUT", `/api/tokens/${id}/fees/allocation`, data);
    },
    onSuccess: () => {
      toast({ title: "Allocation Updated", description: "Fee distribution allocation saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens", id, "fees"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const claimFeesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/tokens/${id}/fees/claim`);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ 
          title: "Fees Claimed", 
          description: `Claimed ${formatSOL(data.amount || 0)}` 
        });
      } else {
        toast({ 
          title: "Claim Not Available", 
          description: data.error || "Please claim fees via pump.fun website",
          variant: "destructive"
        });
      }
      refetchFees();
    },
    onError: (error: Error) => {
      toast({ title: "Claim Failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleAutoClaimMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", `/api/tokens/${id}/autoclaim/toggle`, { enabled });
    },
    onSuccess: () => {
      toast({ title: "Auto-Claim Updated" });
      refetchFees();
    },
  });

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

  const { data: lpInfo, isLoading: lpLoading, refetch: refetchLpInfo } = useQuery<LPTokenInfo>({
    queryKey: ["/api/tokens/mint", deployment?.tokenAddress, "lp-info", selectedLpWalletId],
    enabled: !!deployment?.tokenAddress && !!selectedLpWalletId,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  const burnLpMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLpWalletId || !lpInfo?.lpMint || !deployment?.tokenAddress) {
        throw new Error("Select a wallet and ensure LP info is available");
      }
      const amount = parseFloat(lpBurnAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid LP burn amount");
      }
      if (amount > lpInfo.lpBalance) {
        throw new Error(`Amount exceeds balance. You have ${lpInfo.lpBalance.toFixed(6)} LP tokens`);
      }
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
        toast({
          title: "Burn Failed",
          description: data.error || "Transaction failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Burn Error", description: error.message, variant: "destructive" });
    },
  });
  
  const lpBurnAmountNum = parseFloat(lpBurnAmount) || 0;
  const isLpBurnAmountValid = lpBurnAmountNum > 0 && lpBurnAmountNum <= (lpInfo?.lpBalance || 0);

  if (deploymentLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Token not found</p>
            <Button variant="outline" className="mt-4" onClick={() => setLocation("/deploy")}>
              Back to Deploy
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!deployment.tokenAddress) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Deployment Incomplete
            </CardTitle>
            <CardDescription>
              Token "{deployment.name}" ({deployment.symbol}) was not fully deployed to the blockchain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-md space-y-2">
              <p className="text-sm font-medium">Possible causes:</p>
              <ul className="text-sm text-muted-foreground list-disc ml-4 space-y-1">
                <li>Insufficient SOL balance in wallet (need ~0.05+ SOL)</li>
                <li>Transaction failed or timed out</li>
                <li>Network congestion on Solana</li>
                <li>Session expired during deployment</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLocation("/deploy")} data-testid="button-back-deploy">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Deploy
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-delete-token">
                    <X className="h-4 w-4 mr-2" />
                    Delete Failed Deployment
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this deployment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the "{deployment.name}" entry. You can deploy a new token afterward.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteTokenMutation.mutate()}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAllocation = allocations.burn + allocations.amm + allocations.creator + allocations.liquidity;
  const isValidAllocation = totalAllocation === 100;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/deploy")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{deployment.name}</h1>
            <Badge variant="secondary" className="font-mono">{deployment.symbol}</Badge>
            <Badge variant={deployment.status === "deployed" ? "default" : "outline"}>
              {deployment.status}
            </Badge>
          </div>
          {deployment.tokenAddress && (
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {deployment.tokenAddress}
            </p>
          )}
        </div>
      </div>

      {/* Quick Trade Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Quick Trade
          </CardTitle>
          <CardDescription>
            Buy or sell this token directly from the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Buy Section */}
            <div className="space-y-4 p-4 border rounded-md">
              <h3 className="font-semibold text-green-500 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Buy {deployment.symbol}
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Select Wallet</Label>
                  <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                    <SelectTrigger data-testid="select-wallet-buy">
                      <SelectValue placeholder="Choose a wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets?.filter(w => w.isActive).map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          {wallet.label} ({(wallet.balance || 0).toFixed(4)} SOL)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (SOL)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.001"
                    max="100"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.1"
                    data-testid="input-buy-amount"
                  />
                </div>
                <div className="flex gap-2">
                  {[0.1, 0.5, 1, 2].map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      onClick={() => setBuyAmount(amt.toString())}
                      data-testid={`button-buy-preset-${amt}`}
                    >
                      {amt} SOL
                    </Button>
                  ))}
                </div>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => quickBuyMutation.mutate()}
                  disabled={quickBuyMutation.isPending || !selectedWalletId}
                  data-testid="button-quick-buy"
                >
                  {quickBuyMutation.isPending ? "Buying..." : `Buy ${deployment.symbol}`}
                </Button>
              </div>
            </div>

            {/* Sell Section */}
            <div className="space-y-4 p-4 border rounded-md">
              <h3 className="font-semibold text-red-500 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Sell {deployment.symbol}
              </h3>
              {tokenHoldings && tokenHoldings.length > 0 ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Sell Percentage</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[sellPercent]}
                        onValueChange={(v) => setSellPercent(v[0])}
                        min={25}
                        max={100}
                        step={25}
                        className="flex-1"
                        data-testid="slider-sell-percent"
                      />
                      <span className="w-12 text-right font-mono">{sellPercent}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <Button
                        key={pct}
                        variant={sellPercent === pct ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSellPercent(pct)}
                        data-testid={`button-sell-preset-${pct}`}
                      >
                        {pct}%
                      </Button>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Your Holdings</Label>
                    <div className="space-y-2">
                      {tokenHoldings.map((holding) => (
                        <div
                          key={holding.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <div>
                            <p className="text-sm font-mono">
                              {formatNumber(holding.tokenQuantity || 0)} tokens
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Cost: {formatSOL(holding.buyAmount || 0)}
                            </p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => quickSellMutation.mutate(holding.walletId!)}
                            disabled={quickSellMutation.isPending}
                            data-testid={`button-sell-${holding.id}`}
                          >
                            {quickSellMutation.isPending ? "..." : `Sell ${sellPercent}%`}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No holdings found for this token.</p>
                  <p className="text-sm mt-1">Buy some tokens first!</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Token Info Banner - show when analytics are placeholder (name="Loading...") or unavailable */}
      {!analyticsLoading && (!analytics || analytics.name === "Loading...") && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="font-medium">Token Recently Created</p>
              <p className="text-sm text-muted-foreground">
                Price data and analytics may take a few minutes to become available on Pump.fun.
                Data will update automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Price</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  ${analytics?.price?.toFixed(8) || "0.00000000"}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {(analytics?.priceChange24h || 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={(analytics?.priceChange24h || 0) >= 0 ? "text-green-500" : "text-red-500"}>
                    {(analytics?.priceChange24h || 0).toFixed(2)}% 24h
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Market Cap</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  ${formatNumber(analytics?.marketCap || 0)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Liquidity: {formatSOL(analytics?.liquidity || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Top Holders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {formatNumber(analytics?.holders || 0, 0)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(analytics?.transactions || 0, 0)} replies
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  (top 20 accounts)
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Bonding Curve</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">
                  {(analytics?.bondingCurveProgress || 0).toFixed(1)}%
                </div>
                <Progress value={analytics?.bondingCurveProgress || 0} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Target: ${formatNumber(analytics?.bondingCurveTarget || 69000)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {deployment?.tokenAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Price Chart
            </CardTitle>
            <CardDescription>24-hour price history</CardDescription>
          </CardHeader>
          <CardContent>
            <PriceChart tokenMint={deployment.tokenAddress} height={350} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Liquidity Pool (Raydium)
          </CardTitle>
          <CardDescription>Manage LP tokens for graduated tokens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Wallet</Label>
            <Select
              value={selectedLpWalletId}
              onValueChange={setSelectedLpWalletId}
              data-testid="select-lp-wallet"
            >
              <SelectTrigger data-testid="select-lp-wallet-trigger">
                <SelectValue placeholder="Select a wallet" />
              </SelectTrigger>
              <SelectContent>
                {wallets?.filter(w => w.isActive).map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.label} ({(wallet.balance || 0).toFixed(4)} SOL)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLpWalletId && (
            <>
              {lpLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : lpInfo?.lpMint ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">LP Token Balance</p>
                      <p className="text-2xl font-bold font-mono" data-testid="text-lp-balance">
                        {lpInfo.lpBalance.toFixed(6)}
                      </p>
                    </div>
                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Pool ID</p>
                      <p className="text-sm font-mono truncate" data-testid="text-pool-id">
                        {lpInfo.poolId?.slice(0, 12)}...{lpInfo.poolId?.slice(-8)}
                      </p>
                    </div>
                  </div>

                  {lpInfo.lpBalance > 0 && (
                    <div className="space-y-3 p-4 border rounded-md border-destructive/30 bg-destructive/5">
                      <h4 className="font-semibold text-destructive flex items-center gap-2">
                        <Flame className="h-4 w-4" />
                        Burn LP Tokens
                      </h4>
                      <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <div className="text-xs text-destructive">
                            <strong>Warning:</strong> Burning LP tokens permanently removes liquidity from the pool. 
                            This action is <strong>irreversible</strong> and cannot be undone. 
                            Your liquidity will be destroyed forever.
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Amount to burn"
                          value={lpBurnAmount}
                          onChange={(e) => setLpBurnAmount(e.target.value)}
                          className={`flex-1 ${lpBurnAmountNum > lpInfo.lpBalance ? 'border-destructive' : ''}`}
                          data-testid="input-lp-burn-amount"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLpBurnAmount(lpInfo.lpBalance.toString())}
                          data-testid="button-lp-burn-max"
                        >
                          Max
                        </Button>
                      </div>
                      {lpBurnAmountNum > lpInfo.lpBalance && (
                        <p className="text-xs text-destructive">
                          Amount exceeds balance. You have {lpInfo.lpBalance.toFixed(6)} LP tokens.
                        </p>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="w-full"
                            disabled={burnLpMutation.isPending || !isLpBurnAmountValid}
                            data-testid="button-burn-lp"
                          >
                            {burnLpMutation.isPending ? "Burning..." : "Burn LP Tokens"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                              <AlertTriangle className="h-5 w-5" />
                              Confirm LP Token Burn
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                              <p>
                                You are about to burn <strong className="text-foreground">{lpBurnAmount}</strong> LP tokens.
                              </p>
                              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                <strong>This action is permanent and irreversible.</strong> The burned LP tokens will be 
                                destroyed forever, and the underlying liquidity will be removed from the pool.
                              </div>
                              <p className="text-sm">
                                Are you absolutely sure you want to proceed?
                              </p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid="button-burn-lp-cancel">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => burnLpMutation.mutate()}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid="button-burn-lp-confirm"
                            >
                              Yes, Burn LP Tokens
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Droplets className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No Raydium LP pool found</p>
                  <p className="text-xs mt-1">
                    {lpInfo?.error || "LP tokens become available after token graduates to Raydium"}
                  </p>
                </div>
              )}
            </>
          )}

          {!selectedLpWalletId && (
            <div className="text-center py-6 text-muted-foreground">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a wallet to view LP token info</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Rug Safety Check
            </CardTitle>
            <CardDescription>Security analysis of your token</CardDescription>
          </CardHeader>
          <CardContent>
            {safetyLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : safetyScore ? (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`text-4xl font-bold ${
                    safetyScore.totalScore >= 70 ? "text-green-500" : 
                    safetyScore.totalScore >= 40 ? "text-yellow-500" : "text-red-500"
                  }`}>
                    {safetyScore.totalScore}/100
                  </div>
                  <div className="flex-1">
                    <Progress 
                      value={safetyScore.totalScore} 
                      className={`h-3 ${
                        safetyScore.totalScore >= 70 ? "[&>div]:bg-green-500" : 
                        safetyScore.totalScore >= 40 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
                      }`}
                    />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {safetyScore.checks.map((check, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {check.passed ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">{check.name}</span>
                      </div>
                      <Badge variant={check.passed ? "secondary" : "destructive"} size="sm">
                        {check.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>Unable to fetch safety score</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Fee Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feeLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : feeInfo ? (
              <>
                <div className="p-4 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Collected</p>
                  <p className="text-2xl font-bold font-mono text-primary">
                    {formatNumber(feeInfo.deployment.totalFeesCollected || 0)} tokens
                  </p>
                </div>
                <div className="p-4 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Distributed</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatNumber(feeInfo.deployment.totalFeesDistributed || 0)} tokens
                  </p>
                </div>
                <div className="p-4 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Tokens Burned</p>
                  <p className="text-2xl font-bold font-mono text-orange-500">
                    {formatNumber(feeInfo.deployment.totalBurned || 0)}
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Auto-Claim</Label>
                  <Switch
                    checked={feeInfo.deployment.autoClaimEnabled}
                    onCheckedChange={(checked) => toggleAutoClaimMutation.mutate(checked)}
                    data-testid="switch-autoclaim"
                  />
                </div>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => window.open(`https://pump.fun/coin/${deployment.tokenAddress}`, '_blank')}
                  data-testid="button-claim-fees-pumpfun"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Claim on Pump.fun
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Fee claiming requires pump.fun website
                </p>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">No fee data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee Distribution Allocation</CardTitle>
          <CardDescription>
            Configure how collected fees are distributed. Must total 100%.
            <br />
            <span className="text-xs">Burn executes on-chain. AMM/Liquidity tracked for manual execution.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Burn
                </Label>
                <span className="font-mono text-sm">{allocations.burn}%</span>
              </div>
              <Slider
                value={[allocations.burn]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setAllocations(prev => ({ ...prev, burn: v }))}
                data-testid="slider-burn"
              />
              <p className="text-xs text-muted-foreground">Tokens permanently destroyed</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  AMM
                </Label>
                <span className="font-mono text-sm">{allocations.amm}%</span>
              </div>
              <Slider
                value={[allocations.amm]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setAllocations(prev => ({ ...prev, amm: v }))}
                data-testid="slider-amm"
              />
              <p className="text-xs text-muted-foreground">Smart market making</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-green-500" />
                  Creator
                </Label>
                <span className="font-mono text-sm">{allocations.creator}%</span>
              </div>
              <Slider
                value={[allocations.creator]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setAllocations(prev => ({ ...prev, creator: v }))}
                data-testid="slider-creator"
              />
              <p className="text-xs text-muted-foreground">Revenue to you</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-purple-500" />
                  Liquidity
                </Label>
                <span className="font-mono text-sm">{allocations.liquidity}%</span>
              </div>
              <Slider
                value={[allocations.liquidity]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setAllocations(prev => ({ ...prev, liquidity: v }))}
                data-testid="slider-liquidity"
              />
              <p className="text-xs text-muted-foreground">Add to LP pool</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <Badge variant={isValidAllocation ? "secondary" : "destructive"}>
                {totalAllocation}%
              </Badge>
              {!isValidAllocation && (
                <span className="text-sm text-destructive">Must equal 100%</span>
              )}
            </div>
            <Button
              onClick={() => updateAllocationMutation.mutate({
                burnPercent: allocations.burn,
                ammPercent: allocations.amm,
                creatorPercent: allocations.creator,
                liquidityPercent: allocations.liquidity,
              })}
              disabled={!isValidAllocation || updateAllocationMutation.isPending}
              data-testid="button-save-allocation"
            >
              {updateAllocationMutation.isPending ? "Saving..." : "Save Allocations"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Stream</CardTitle>
          <CardDescription>Recent fee distribution activity</CardDescription>
        </CardHeader>
        <CardContent>
          {feeLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : feeInfo?.activities && feeInfo.activities.length > 0 ? (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {feeInfo.activities.map((activity, i) => (
                  <div
                    key={activity.id || i}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" size="sm">
                        {activity.activityType}
                      </Badge>
                      <span className="font-mono text-sm">
                        {formatNumber(activity.amount)} tokens
                      </span>
                      {activity.txSignature && (
                        <Badge variant="secondary" size="sm">
                          confirmed
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No activity yet</p>
              <p className="text-sm">Fee distributions will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
