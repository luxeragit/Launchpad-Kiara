import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowUpRight, Check, Circle, Clock3, Copy, ExternalLink, Filter, Globe2, LoaderCircle, Pause, Play, RefreshCw, ShieldAlert, Target, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { SiTelegram, SiX } from "react-icons/si";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "@/components/price-chart";
import { TerminalEmpty, TerminalPanel } from "@/components/terminal/terminal-panel";
import { useAuth } from "@/contexts/AuthContext";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TokenHolding, TradeSetting, Wallet as WalletType } from "@shared/schema";
import { WalletConnectButton } from "@/components/wallet-connect-button";

interface PumpfunToken {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image: string | null;
  creator: string;
  timestamp: number;
  signature?: string;
  tradeCount?: number;
  volume?: number;
  lastPrice?: number;
  priceChange?: number;
  marketCapSol?: number;
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}
interface PumpfunResponse {
  tokens: PumpfunToken[];
  connected: boolean;
  tokenCount: number;
  trendingCount?: number;
}
interface MonitoringStatus {
  isMonitoring: boolean;
  pumpfunConnected: boolean;
  tokenCount: number;
  settings: Partial<TradeSetting> | null;
}
type CandidateFeed = "newest" | "trending" | "movers";
type MobileZone = "strategy" | "candidates" | "positions";

const fieldClass = "h-8 rounded-none border-border bg-[#0d0f14] px-2 text-[12px] text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-sky-500/40";

function shortAddress(value: string) {
  return value.length > 13 ? `${value.slice(0, 5)}…${value.slice(-4)}` : value;
}
function timeAgo(timestamp: number) {
  const delta = Math.max(0, Date.now() - timestamp);
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}
function formatCompact(value?: number, prefix = "") {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 10_000) return `${prefix}${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1_000) return `${prefix}${(value / 1_000).toFixed(2)}K`;
  return `${prefix}${value.toFixed(value < 1 ? 4 : 0)}`;
}
function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "Time unavailable";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function TokenAvatar({ token }: { token: Pick<PumpfunToken, "image" | "symbol"> }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-border bg-[#1b202a] text-[11px] font-semibold text-sky-300">
    {token.image && !failed ? <img src={token.image} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : token.symbol.slice(0, 2).toUpperCase()}
  </div>;
}

function CandidateRow({ token, monitoring, onInspect, onBuy, buying, canBuy, onCopy }: {
  token: PumpfunToken; monitoring: boolean; onInspect: () => void; onBuy: () => void; buying: boolean; canBuy: boolean; onCopy: () => void;
}) {
  return <article className="flex min-h-[74px] items-center gap-2.5 border-b border-border px-3 py-2.5 transition-colors hover:bg-[#151820]" data-testid={`monitor-candidate-row-${token.mint}`}>
    <button type="button" onClick={onInspect} aria-label={`Inspect ${token.name}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
      <TokenAvatar token={token} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-foreground">{token.name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{token.symbol}</span>
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono">{shortAddress(token.mint)}</span><span>·</span><span>{timeAgo(token.timestamp)}</span>
        </span>
      </span>
    </button>
    <div className="hidden min-w-[74px] text-right sm:block">
      <div className="text-[10px] text-muted-foreground">MCap · SOL</div>
      <div className="mt-0.5 font-mono text-[11px]">{formatCompact(token.marketCapSol)}</div>
    </div>
    <div className="hidden min-w-[58px] text-right md:block">
      <div className="text-[10px] text-muted-foreground">Vol</div>
      <div className="mt-0.5 font-mono text-[11px]">{formatCompact(token.volume, "$")}</div>
    </div>
    <span className={`hidden min-w-[50px] text-right font-mono text-[10px] sm:block ${token.priceChange === undefined ? "text-muted-foreground" : token.priceChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{token.priceChange === undefined ? "—" : `${token.priceChange >= 0 ? "+" : ""}${token.priceChange.toFixed(1)}%`}</span>
    <span title={monitoring ? "Monitoring active" : "Monitoring stopped"} className={`hidden h-1.5 w-1.5 shrink-0 rounded-full lg:block ${monitoring ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
    <button type="button" onClick={onCopy} title="Copy mint" aria-label={`Copy ${token.symbol} mint`} className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground hover:text-sky-300"><Copy className="h-3.5 w-3.5" /></button>
    <button type="button" data-testid={`button-buy-${token.mint}`} disabled={!canBuy || buying} onClick={onBuy} className="flex h-7 min-w-10 shrink-0 items-center justify-center border border-sky-500/35 px-1.5 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/50">
      {buying ? <LoaderCircle className="h-3 w-3 animate-spin" /> : "Buy"}
    </button>
  </article>;
}

function HoldingRecord({ holding, onSell, selling, canSell }: { holding: TokenHolding; onSell: () => void; selling: boolean; canSell: boolean }) {
  const pnl = holding.currentPrice && holding.buyPrice ? ((holding.currentPrice - holding.buyPrice) / holding.buyPrice) * 100 : undefined;
  return <div className="flex items-center gap-2.5 border-b border-border px-3 py-3" data-testid={`holding-row-${holding.id}`}>
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-border bg-[#1b202a] text-[10px] font-semibold text-sky-300">
      {holding.tokenImage ? <img src={holding.tokenImage} alt="" className="h-full w-full object-cover" /> : holding.tokenSymbol.slice(0, 2).toUpperCase()}
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-[12px] font-semibold">{holding.tokenName} <span className="font-normal text-muted-foreground">{holding.tokenSymbol}</span></div>
      <div className="mt-1 text-[10px] text-muted-foreground">Buy {holding.buyPrice?.toFixed(6)} SOL · {holding.buyAmount?.toFixed(4)} SOL</div>
    </div>
    <div className="min-w-[64px] text-right">
      <div className={`font-mono text-[11px] ${pnl === undefined ? "text-muted-foreground" : pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{pnl === undefined ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`}</div>
      <div className="mt-1 text-[9px] text-muted-foreground">{holding.status}</div>
    </div>
    {holding.status === "holding" && <button type="button" data-testid={`button-sell-holding-${holding.id}`} disabled={!canSell || selling} onClick={onSell} className="flex h-7 min-w-10 items-center justify-center border border-rose-500/30 px-1.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/50">{selling ? <LoaderCircle className="h-3 w-3 animate-spin" /> : "Sell"}</button>}
  </div>;
}

export default function MonitorPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const network = useNetworkStatus();
  const transactionsEnabled = !!network.data?.transactionsEnabled && !network.isError;
  const [mobileZone, setMobileZone] = useState<MobileZone>("candidates");
  const [candidateFeed, setCandidateFeed] = useState<CandidateFeed>("newest");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [solAmount, setSolAmount] = useState("0.1");
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [requireTwitter, setRequireTwitter] = useState(false);
  const [requireTelegram, setRequireTelegram] = useState(false);
  const [requireWebsite, setRequireWebsite] = useState(false);
  const [minMarketCap, setMinMarketCap] = useState("");
  const [maxMarketCap, setMaxMarketCap] = useState("");
  const [minVolMcapRatio, setMinVolMcapRatio] = useState("");
  const [maxVolMcapRatio, setMaxVolMcapRatio] = useState("");
  const [autoSellEnabled, setAutoSellEnabled] = useState(false);
  const [takeProfitPercent, setTakeProfitPercent] = useState("");
  const [stopLossPercent, setStopLossPercent] = useState("");
  const [selectedToken, setSelectedToken] = useState<PumpfunToken | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  const { data: wallets, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"], enabled: isAuthenticated,
  });
  const { data: tradeSettings } = useQuery<TradeSetting>({
    queryKey: ["/api/trade/settings"], enabled: isAuthenticated,
  });
  const { data: monitoringStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<MonitoringStatus>({
    queryKey: ["/api/monitoring/status"], enabled: isAuthenticated, refetchInterval: 2000,
  });
  const { data: pumpfunData, isLoading: candidatesLoading, isError: feedError, refetch: refetchFeed } = useQuery<PumpfunResponse>({
    queryKey: ["/api/pumpfun/tokens"], refetchInterval: 3000,
  });
  const { data: trendingData, isLoading: trendingLoading, isError: trendingError, refetch: refetchTrending } = useQuery<PumpfunResponse>({
    queryKey: ["/api/pumpfun/trending"], refetchInterval: 3000,
  });
  const { data: moversData, isLoading: moversLoading, isError: moversError, refetch: refetchMovers } = useQuery<PumpfunResponse>({
    queryKey: ["/api/pumpfun/movers"], refetchInterval: 3000,
  });
  const { data: holdings, isLoading: holdingsLoading } = useQuery<TokenHolding[]>({
    queryKey: ["/api/holdings"], enabled: isAuthenticated, refetchInterval: 5000,
  });
  const activeHoldings = useMemo(() => holdings?.filter((holding) => holding.status === "holding") ?? [], [holdings]);
  const holdingHistory = useMemo(() => [...(holdings ?? [])].sort((a, b) => {
    const toMs = (value: Date | string | null | undefined) => value instanceof Date ? value.getTime() : value ? new Date(value).getTime() : 0;
    const dateA = toMs(a.soldAt ?? a.createdAt);
    const dateB = toMs(b.soldAt ?? b.createdAt);
    return dateB - dateA;
  }), [holdings]);
  const availableWallets = useMemo(() => wallets?.filter((wallet) => !wallet.isArchived) ?? [], [wallets]);
  const isMonitoring = monitoringStatus?.isMonitoring ?? false;
  const candidates = useMemo(() => {
    if (candidateFeed === "trending") return trendingData?.tokens ?? [];
    if (candidateFeed === "movers") return moversData?.tokens ?? [];
    return pumpfunData?.tokens ?? [];
  }, [candidateFeed, pumpfunData?.tokens, trendingData?.tokens, moversData?.tokens]);
  const candidatesAreLoading = candidateFeed === "trending" ? trendingLoading : candidateFeed === "movers" ? moversLoading : candidatesLoading;
  const candidateFeedError = candidateFeed === "trending" ? trendingError : candidateFeed === "movers" ? moversError : feedError;

  useEffect(() => {
    if (tradeSettings && !settingsLoaded) {
      setSolAmount(String(tradeSettings.solAmount || 0.1));
      setAutoRedirect(tradeSettings.autoRedirect || false);
      setSelectedWallets(tradeSettings.selectedWallets || []);
      setRequireTwitter(tradeSettings.requireTwitter || false);
      setRequireTelegram(tradeSettings.requireTelegram || false);
      setRequireWebsite(tradeSettings.requireWebsite || false);
      setMinMarketCap(tradeSettings.minMarketCap ? String(tradeSettings.minMarketCap) : "");
      setMaxMarketCap(tradeSettings.maxMarketCap ? String(tradeSettings.maxMarketCap) : "");
      setMinVolMcapRatio(tradeSettings.minVolMcapRatio ? String(tradeSettings.minVolMcapRatio) : "");
      setMaxVolMcapRatio(tradeSettings.maxVolMcapRatio ? String(tradeSettings.maxVolMcapRatio) : "");
      setAutoSellEnabled(tradeSettings.autoSellEnabled || false);
      setTakeProfitPercent(tradeSettings.takeProfitPercent ? String(tradeSettings.takeProfitPercent) : "");
      setStopLossPercent(tradeSettings.stopLossPercent ? String(tradeSettings.stopLossPercent) : "");
      setSettingsLoaded(true);
    }
  }, [tradeSettings, settingsLoaded]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<TradeSetting>) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to save automation settings.");
      const safeSettings = { ...settings };
      if (!transactionsEnabled && safeSettings.autoSellEnabled) {
        safeSettings.autoSellEnabled = false;
        setAutoSellEnabled(false);
        toast({ title: "Auto-sell turned off", description: "Network safety is unverified. Other settings can still be saved." });
      }
      const response = await apiRequest("PUT", "/api/trade/settings", safeSettings);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (error: Error) => toast({ title: "Failed to save settings", description: error.message, variant: "destructive" }),
  });
  const startMonitoringMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Connect your wallet to start monitoring.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      await saveSettingsMutation.mutateAsync({
        solAmount: Number(solAmount) || 0.1, autoRedirect, selectedWallets, requireTwitter, requireTelegram, requireWebsite,
        minMarketCap: minMarketCap ? Number(minMarketCap) : null,
        maxMarketCap: maxMarketCap ? Number(maxMarketCap) : null,
        minVolMcapRatio: minVolMcapRatio ? Number(minVolMcapRatio) : null,
        maxVolMcapRatio: maxVolMcapRatio ? Number(maxVolMcapRatio) : null,
      });
      const response = await apiRequest("POST", "/api/monitoring/start", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/status"] });
      toast({ title: "Monitoring started", description: "Auto-buy is active under the saved strategy." });
    },
    onError: (error: Error) => toast({ title: "Failed to start monitoring", description: error.message, variant: "destructive" }),
  });
  const stopMonitoringMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Connect your wallet to stop monitoring.");
      const response = await apiRequest("POST", "/api/monitoring/stop", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/status"] });
      toast({ title: "Monitoring stopped", description: "Auto-buy has been disabled." });
    },
    onError: (error: Error) => toast({ title: "Failed to stop monitoring", description: error.message, variant: "destructive" }),
  });
  const sellTokenMutation = useMutation({
    mutationFn: async (holdingId: string) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to sell a token.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      const response = await apiRequest("POST", `/api/holdings/${holdingId}/sell`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      toast({ title: "Token sold successfully" });
    },
    onError: (error: Error) => toast({ title: "Failed to sell token", description: error.message, variant: "destructive" }),
  });
  const buyTokenMutation = useMutation({
    mutationFn: async (params: { walletId: string; tokenMint: string; solAmount: number; tokenName: string; tokenSymbol: string; tokenImage: string | null }) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to buy a token.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      const response = await apiRequest("POST", "/api/trade/buy", params);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Token purchased", description: `Buy request for ${data.tokenSymbol} submitted.` });
    },
    onError: (error: Error) => toast({ title: "Failed to buy token", description: error.message, variant: "destructive" }),
  });

  const settingsPayload = (): Partial<TradeSetting> => ({
    solAmount: Number(solAmount) || 0.1,
    autoRedirect,
    selectedWallets,
    requireTwitter,
    requireTelegram,
    requireWebsite,
    minMarketCap: minMarketCap ? Number(minMarketCap) : null,
    maxMarketCap: maxMarketCap ? Number(maxMarketCap) : null,
    minVolMcapRatio: minVolMcapRatio ? Number(minVolMcapRatio) : null,
    maxVolMcapRatio: maxVolMcapRatio ? Number(maxVolMcapRatio) : null,
    autoSellEnabled,
    takeProfitPercent: takeProfitPercent ? Number(takeProfitPercent) : null,
    stopLossPercent: stopLossPercent ? Number(stopLossPercent) : null,
  });
  const handleSaveSettings = () => saveSettingsMutation.mutate(settingsPayload());
  const handleBuy = (token: PumpfunToken) => {
    if (!selectedWallets.length) {
      toast({ title: "No wallet selected", description: "Select a managed wallet before buying.", variant: "destructive" });
      return;
    }
    buyTokenMutation.mutate({
      walletId: selectedWallets[0], tokenMint: token.mint, solAmount: Number(solAmount) || 0.1,
      tokenName: token.name, tokenSymbol: token.symbol, tokenImage: token.image,
    });
  };
  const copyMint = async (mint: string) => {
    try {
      await navigator.clipboard.writeText(mint);
      toast({ title: "Token address copied", description: shortAddress(mint) });
    } catch {
      toast({ title: "Could not copy address", description: "Clipboard access is unavailable.", variant: "destructive" });
    }
  };
  const inspect = (token: PumpfunToken) => {
    setSelectedToken(token);
    setChartOpen(true);
  };
  const canStart = isAuthenticated && selectedWallets.length > 0 && transactionsEnabled && !startMonitoringMutation.isPending;
  const canTrade = isAuthenticated && selectedWallets.length > 0 && transactionsEnabled;
  const mobileTabs: { id: MobileZone; label: string }[] = [
    { id: "strategy", label: "Strategy" }, { id: "candidates", label: "Candidates" }, { id: "positions", label: "Positions" },
  ];

  return <div className="terminal-workspace monitor-workspace page-enter">
    <div className="flex h-9 items-center justify-between border-b border-border bg-[#0d0f14] px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-[12px]">
        <span className={`h-1.5 w-1.5 rounded-full ${isMonitoring ? "bg-emerald-400" : pumpfunData?.connected ? "bg-sky-400" : "bg-muted-foreground"}`} />
        <span className="font-semibold">Automation desk</span>
        <span className="hidden text-muted-foreground sm:inline">{isMonitoring ? "Strategy monitoring" : "Monitoring stopped"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`hidden items-center gap-1 text-[11px] sm:flex ${pumpfunData?.connected ? "text-emerald-300" : "text-muted-foreground"}`} data-testid="text-connection-status">
          <Circle className={`h-2 w-2 ${pumpfunData?.connected ? "fill-emerald-400 text-emerald-400" : "text-muted-foreground"}`} />
          {feedError ? "Feed unavailable" : pumpfunData?.connected ? "Feed live" : candidatesLoading ? "Connecting…" : "Feed idle"}
        </span>
        {!transactionsEnabled && <span title={network.data?.reason || "Financial actions paused pending network verification"} className="flex items-center gap-1 text-[10px] text-amber-300"><ShieldAlert className="h-3 w-3" /><span className="hidden sm:inline">Trading paused</span></span>}
        <button type="button" onClick={() => { void refetchFeed(); if (isAuthenticated) void refetchStatus(); }} aria-label="Refresh monitoring data" title="Refresh data" className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
    </div>
    <nav className="monitor-mobile-tabs flex h-9 border-b border-border bg-[#101218]" role="tablist" aria-label="Monitor zones">
      {mobileTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={mobileZone === tab.id} onClick={() => setMobileZone(tab.id)} className={`flex-1 border-b-2 px-1 text-[12px] font-medium ${mobileZone === tab.id ? "border-sky-400 text-sky-300" : "border-transparent text-muted-foreground"}`}>{tab.label}</button>)}
    </nav>
    <div className="monitor-panels">
      <TerminalPanel title="Strategy" testId="monitor-strategy" className={`monitor-zone monitor-strategy ${mobileZone !== "strategy" ? "zone-inactive" : ""}`} headerActions={
        <Badge variant="outline" className={`rounded-none px-1.5 py-0 text-[10px] ${isMonitoring ? "border-emerald-800 text-emerald-300" : "text-muted-foreground"}`}>{isMonitoring ? "ACTIVE" : "IDLE"}</Badge>
      }>
        <div className="terminal-scroll" data-testid="monitor-strategy-scroll">
          {!authLoading && !isAuthenticated && <div className="border-b border-border p-3">
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold"><WalletIcon className="h-4 w-4 text-sky-400" />Connect to configure automation</div>
            <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">Monitoring settings, managed wallets and positions are private to your signed-in session.</p>
            <WalletConnectButton />
          </div>}
          {isAuthenticated && <div className="flex items-center justify-between border-b border-border px-3 py-2.5 text-[11px]">
            <span className="text-muted-foreground">{statusLoading ? "Checking monitor status…" : isMonitoring ? "Automation running" : "Automation stopped"}</span>
            <span className="font-mono text-muted-foreground">{monitoringStatus?.tokenCount ?? pumpfunData?.tokenCount ?? "—"} observed</span>
          </div>}
          <section className="border-b border-border px-3 py-3">
            <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold"><Target className="h-3.5 w-3.5 text-sky-400" />Entry configuration</div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[11px] text-muted-foreground">Auto-buy · SOL
                <Input type="number" min="0.001" step="0.01" value={solAmount} onChange={(e) => setSolAmount(e.target.value)} className={`mt-1 ${fieldClass}`} data-testid="input-sol-amount" />
              </label>
              <label className="block text-[11px] text-muted-foreground">Funding wallet
                <select value={selectedWallets[0] || ""} onChange={(e) => setSelectedWallets(e.target.value ? [e.target.value] : [])} disabled={!isAuthenticated} className="mt-1 h-8 w-full border border-border bg-[#0d0f14] px-2 text-[11px] text-foreground outline-none focus:border-sky-500/50" data-testid="select-wallet">
                  <option value="">{!isAuthenticated ? "Connect wallet…" : walletsError ? "Wallet list unavailable" : walletsLoading ? "Loading wallets…" : "Select wallet…"}</option>
                  {availableWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.label} · {shortAddress(wallet.address)}</option>)}
                </select>
                {isAuthenticated && walletsError && <button type="button" onClick={() => void refetchWallets()} className="mt-1 text-[10px] text-sky-300 hover:text-sky-200">Retry wallet list</button>}
              </label>
            </div>
            {selectedWallets[0] && <div className="mt-2 font-mono text-[10px] text-muted-foreground">{availableWallets.find((wallet) => wallet.id === selectedWallets[0])?.balance?.toFixed(4) ?? "—"} SOL available</div>}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
              <Label htmlFor="auto-redirect" className="text-[11px] text-muted-foreground">Open token details after buy</Label>
              <Switch id="auto-redirect" checked={autoRedirect} onCheckedChange={setAutoRedirect} data-testid="switch-auto-redirect" />
            </div>
          </section>
          <section className="border-b border-border px-3 py-3">
            <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold"><Filter className="h-3.5 w-3.5 text-sky-400" />Market filters</div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[11px] text-muted-foreground">Min cap · SOL
                <Input type="number" min="0" value={minMarketCap} onChange={(e) => setMinMarketCap(e.target.value)} className={`mt-1 ${fieldClass}`} placeholder="No minimum" data-testid="input-min-market-cap" />
              </label>
              <label className="block text-[11px] text-muted-foreground">Max cap · SOL
                <Input type="number" min="0" value={maxMarketCap} onChange={(e) => setMaxMarketCap(e.target.value)} className={`mt-1 ${fieldClass}`} placeholder="No maximum" data-testid="input-max-market-cap" />
              </label>
              <label className="block text-[11px] text-muted-foreground">Min volume / cap
                <Input type="number" min="0" step="0.01" value={minVolMcapRatio} onChange={(e) => setMinVolMcapRatio(e.target.value)} className={`mt-1 ${fieldClass}`} placeholder="No minimum" data-testid="input-min-vol-mcap-ratio" />
              </label>
              <label className="block text-[11px] text-muted-foreground">Max volume / cap
                <Input type="number" min="0" step="0.01" value={maxVolMcapRatio} onChange={(e) => setMaxVolMcapRatio(e.target.value)} className={`mt-1 ${fieldClass}`} placeholder="No maximum" data-testid="input-max-vol-mcap-ratio" />
              </label>
            </div>
            <div className="mt-3 space-y-2 border-t border-border pt-2.5">
              {[
                { id: "monitor-require-twitter", label: "Require X / Twitter", checked: requireTwitter, change: setRequireTwitter },
                { id: "monitor-require-telegram", label: "Require Telegram", checked: requireTelegram, change: setRequireTelegram },
                { id: "monitor-require-website", label: "Require website", checked: requireWebsite, change: setRequireWebsite },
              ].map((filter) => <div key={filter.id} className="flex items-center gap-2">
                <Checkbox id={filter.id} checked={filter.checked} onCheckedChange={(value) => filter.change(value === true)} />
                <Label htmlFor={filter.id} className="text-[11px] text-muted-foreground">{filter.label}</Label>
              </div>)}
            </div>
          </section>
          <section className="border-b border-border px-3 py-3">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] font-semibold"><TrendingUp className="h-3.5 w-3.5 text-emerald-400" />Exit controls</div>
              <Switch id="monitor-auto-sell" checked={autoSellEnabled} onCheckedChange={(enabled) => { if (!enabled || transactionsEnabled) setAutoSellEnabled(enabled); }} data-testid="switch-auto-sell" />
            </div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label htmlFor="monitor-auto-sell" className="text-[11px] text-muted-foreground">Auto-sell</Label>
              {!transactionsEnabled && <span title={network.data?.reason || "Network safety is not verified"} className="text-[10px] text-amber-300">Paused by network</span>}
            </div>
            {autoSellEnabled && <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[11px] text-muted-foreground">Take profit · %
                <Input type="number" min="0" step="0.1" value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)} className={`mt-1 ${fieldClass}`} placeholder="Unset" data-testid="input-take-profit" />
              </label>
              <label className="block text-[11px] text-muted-foreground">Stop loss · %
                <Input type="number" min="0" step="0.1" value={stopLossPercent} onChange={(e) => setStopLossPercent(e.target.value)} className={`mt-1 ${fieldClass}`} placeholder="Unset" data-testid="input-stop-loss" />
              </label>
            </div>}
          </section>
          <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-[#101218] p-3">
            <Button type="button" variant="outline" size="sm" disabled={!isAuthenticated || saveSettingsMutation.isPending} onClick={handleSaveSettings} data-testid="button-save-settings" className="h-8 rounded-none text-[11px]">
              {saveSettingsMutation.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Save settings
            </Button>
            {isMonitoring ? <Button type="button" variant="destructive" size="sm" disabled={!isAuthenticated || stopMonitoringMutation.isPending} onClick={() => stopMonitoringMutation.mutate()} data-testid="button-stop-autobuy" className="h-8 rounded-none text-[11px]">
              {stopMonitoringMutation.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Pause className="mr-1.5 h-3.5 w-3.5" />}Stop
            </Button> : <Button type="button" size="sm" disabled={!canStart} onClick={() => startMonitoringMutation.mutate()} data-testid="button-start-autobuy" className="h-8 rounded-none text-[11px]">
              {startMonitoringMutation.isPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}Start
            </Button>}
          </div>
          {isMonitoring && <div className="flex items-center gap-2 px-3 pb-3 text-[11px] text-emerald-300" data-testid="badge-autobuy-active"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Auto-buy active</div>}
          {!transactionsEnabled && <div className="mx-3 mb-3 flex items-start gap-2 border border-amber-900/60 bg-amber-950/20 p-2.5 text-[11px] leading-relaxed text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{network.data?.reason || "Financial actions stay paused until network safety is verified."}</div>}
        </div>
      </TerminalPanel>

      <TerminalPanel title="Live candidates" testId="monitor-candidates" className={`monitor-zone monitor-candidates ${mobileZone !== "candidates" ? "zone-inactive" : ""}`} headerActions={
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] text-muted-foreground sm:inline">{pumpfunData?.connected ? "Live feed" : "Public feed"}</span>
          <button type="button" onClick={() => void refetchFeed()} title="Refresh candidates" aria-label="Refresh candidates" className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
      }>
        <div className="flex h-9 items-center gap-1 border-b border-border px-2">
          {[
            { id: "newest" as CandidateFeed, label: "New" },
            { id: "trending" as CandidateFeed, label: "Trending" },
            { id: "movers" as CandidateFeed, label: "Movers" },
          ].map((item) => <button key={item.id} type="button" onClick={() => setCandidateFeed(item.id)} className={`px-2.5 py-1 text-[11px] ${candidateFeed === item.id ? "bg-[#1b202a] text-sky-300" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${isMonitoring ? "bg-emerald-400" : "bg-muted-foreground/50"}`} />{isMonitoring ? "Strategy active" : "Observe only"}</span>
        </div>
        <div className="terminal-scroll" data-testid="monitor-candidates-scroll">
          {candidatesAreLoading && !candidates.length ? <div>{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex h-[74px] items-center gap-3 border-b border-border px-3"><div className="h-9 w-9 animate-pulse bg-[#1b202a]" /><div className="flex-1"><div className="mb-2 h-2 w-28 animate-pulse bg-[#1b202a]" /><div className="h-2 w-20 animate-pulse bg-[#1b202a]" /></div></div>)}</div>
            : candidateFeedError ? <TerminalEmpty title="Candidate feed unavailable" detail="The selected public provider could not be reached." retry={() => {
              if (candidateFeed === "trending") void refetchTrending();
              else if (candidateFeed === "movers") void refetchMovers();
              else void refetchFeed();
            }} />
            : candidates.length ? candidates.slice(0, 100).map((token) => <CandidateRow key={token.mint} token={token} monitoring={isMonitoring} onInspect={() => inspect(token)} onBuy={() => handleBuy(token)} buying={buyTokenMutation.isPending} canBuy={canTrade} onCopy={() => void copyMint(token.mint)} />)
            : <TerminalEmpty title="No candidates in this feed" detail="Supported public feed returned no tokens for this view." />}
        </div>
        <footer className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span>{pumpfunData?.tokenCount ?? candidates.length} feed records</span>
          <span>{monitoringStatus?.tokenCount ?? "—"} monitored records</span>
        </footer>
      </TerminalPanel>

      <TerminalPanel title="Positions & activity" testId="monitor-positions" className={`monitor-zone monitor-positions ${mobileZone !== "positions" ? "zone-inactive" : ""}`} headerActions={<span className="font-mono text-[10px] text-muted-foreground">{activeHoldings.length} open</span>}>
        <div className="terminal-scroll" data-testid="monitor-positions-scroll">
          <section className="border-b border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-semibold"><WalletIcon className="h-3.5 w-3.5 text-sky-400" />Open positions</span>
              {holdingsLoading && <LoaderCircle className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {!isAuthenticated ? <div className="p-3 text-[11px] text-muted-foreground">Connect to view private positions.</div>
              : holdingsLoading && activeHoldings.length === 0 ? <div>{[0, 1, 2].map((key) => <div key={key} className="h-14 animate-pulse border-b border-border bg-[#151820]/50" />)}</div>
              : activeHoldings.length ? activeHoldings.map((holding) => <HoldingRecord key={holding.id} holding={holding} onSell={() => sellTokenMutation.mutate(holding.id)} selling={sellTokenMutation.isPending} canSell={transactionsEnabled} />)
              : <div className="px-3 py-5 text-[11px] text-muted-foreground">No open positions in this session.</div>}
          </section>
          <section className="border-b border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-semibold"><ShieldAlert className="h-3.5 w-3.5 text-amber-300" />Risk state</span>
              <span className={`text-[10px] font-medium ${transactionsEnabled ? "text-emerald-300" : "text-amber-300"}`}>{transactionsEnabled ? "Verified" : "Execution paused"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3 text-[11px]">
              <span className="text-muted-foreground">Monitor</span><span className="text-right">{isMonitoring ? "Active" : "Stopped"}</span>
              <span className="text-muted-foreground">Auto-buy size</span><span className="text-right font-mono">{Number(solAmount) || 0.1} SOL</span>
              <span className="text-muted-foreground">Auto-sell</span><span className="text-right">{autoSellEnabled && transactionsEnabled ? "Enabled" : "Disabled"}</span>
              <span className="text-muted-foreground">Take profit</span><span className="text-right font-mono">{takeProfitPercent ? `${takeProfitPercent}%` : "Not set"}</span>
              <span className="text-muted-foreground">Stop loss</span><span className="text-right font-mono">{stopLossPercent ? `${stopLossPercent}%` : "Not set"}</span>
            </div>
            {!transactionsEnabled && <p className="border-t border-border px-3 py-2.5 text-[10px] leading-relaxed text-amber-200">{network.data?.reason || "Network safety could not be verified. Financial execution remains disabled."}</p>}
          </section>
          <section>
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-semibold"><Activity className="h-3.5 w-3.5 text-sky-400" />Position activity</span>
              <span className="text-[10px] text-muted-foreground">Stored holding records</span>
            </div>
            {!isAuthenticated ? <p className="px-3 py-4 text-[11px] text-muted-foreground">Activity is private to the connected session.</p>
              : holdingsLoading && holdingHistory.length === 0 ? <div>{[0, 1, 2].map((key) => <div key={key} className="h-12 animate-pulse border-b border-border bg-[#151820]/50" />)}</div>
              : holdingHistory.length ? holdingHistory.slice(0, 30).map((holding) => <div key={`activity-${holding.id}`} className="flex items-center gap-2.5 border-b border-border px-3 py-2.5" data-testid={`monitor-activity-${holding.id}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center border ${holding.status === "holding" ? "border-sky-900/70 text-sky-300" : holding.status === "sold" ? "border-emerald-900/70 text-emerald-300" : "border-amber-900/70 text-amber-300"}`}>
                  {holding.status === "sold" ? <ArrowUpRight className="h-3 w-3" /> : holding.status === "holding" ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium">{holding.tokenName} <span className="text-muted-foreground">{holding.tokenSymbol}</span></div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{holding.status} · {dateLabel(holding.soldAt ?? holding.createdAt)}</div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{holding.buyAmount?.toFixed(4)} SOL</span>
              </div>)
              : <p className="px-3 py-4 text-[11px] text-muted-foreground">No holding records are available.</p>}
          </section>
        </div>
        <footer className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">Execution records are shown only where returned by existing holding data.</footer>
      </TerminalPanel>
    </div>

    <Dialog open={chartOpen} onOpenChange={setChartOpen}>
      <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto border-border bg-[#101218] text-foreground">
        {selectedToken && <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-[14px]">
              <TokenAvatar token={selectedToken} />
              <span>{selectedToken.name} <span className="font-normal text-muted-foreground">{selectedToken.symbol}</span></span>
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px]">{shortAddress(selectedToken.mint)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_230px]">
            <div className="min-w-0">
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="border border-border bg-[#151820] p-2"><div className="text-[10px] text-muted-foreground">Market cap · SOL</div><div className="mt-1 font-mono text-[12px]">{formatCompact(selectedToken.marketCapSol)}</div></div>
                <div className="border border-border bg-[#151820] p-2"><div className="text-[10px] text-muted-foreground">Volume</div><div className="mt-1 font-mono text-[12px]">{formatCompact(selectedToken.volume, "$")}</div></div>
                <div className="border border-border bg-[#151820] p-2"><div className="text-[10px] text-muted-foreground">Change</div><div className="mt-1 font-mono text-[12px]">{selectedToken.priceChange === undefined ? "—" : `${selectedToken.priceChange >= 0 ? "+" : ""}${selectedToken.priceChange.toFixed(2)}%`}</div></div>
              </div>
              <div className="h-[300px] overflow-hidden border border-border bg-[#0c0e13]"><PriceChart tokenMint={selectedToken.mint} height={300} /></div>
              {selectedToken.description && <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{selectedToken.description}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                {selectedToken.twitter && <a href={selectedToken.twitter.startsWith("http") ? selectedToken.twitter : `https://x.com/${selectedToken.twitter}`} target="_blank" rel="noreferrer" className="text-sky-300"><SiX className="mr-1 inline h-3 w-3" />X profile</a>}
                {selectedToken.telegram && <a href={selectedToken.telegram.startsWith("http") ? selectedToken.telegram : `https://t.me/${selectedToken.telegram}`} target="_blank" rel="noreferrer" className="text-sky-300"><SiTelegram className="mr-1 inline h-3 w-3" />Telegram</a>}
                {selectedToken.website && <a href={selectedToken.website.startsWith("http") ? selectedToken.website : `https://${selectedToken.website}`} target="_blank" rel="noreferrer" className="text-sky-300"><Globe2 className="mr-1 inline h-3 w-3" />Website</a>}
              </div>
            </div>
            <aside className="border border-border bg-[#0d0f14] p-3">
              <div className="mb-3 text-[12px] font-semibold">Quick buy</div>
              <div className="mb-3 text-[11px] text-muted-foreground">Amount <span className="float-right font-mono text-foreground">{Number(solAmount) || 0.1} SOL</span></div>
              <div className="mb-3 truncate text-[11px] text-muted-foreground">Wallet <span className="font-mono text-foreground">{availableWallets.find((wallet) => wallet.id === selectedWallets[0])?.label || "Not selected"}</span></div>
              {!transactionsEnabled && <div className="mb-3 flex items-start gap-1.5 border border-amber-900/60 p-2 text-[10px] leading-relaxed text-amber-200"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{network.data?.reason || "Network safety is not verified."}</div>}
              <Button type="button" disabled={!canTrade || buyTokenMutation.isPending} onClick={() => handleBuy(selectedToken)} className="h-9 w-full rounded-none text-[11px]">
                {buyTokenMutation.isPending ? <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}Buy {selectedToken.symbol}
              </Button>
              <button type="button" onClick={() => void copyMint(selectedToken.mint)} className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" />Copy mint</button>
              <a href={`https://pump.fun/coin/${selectedToken.mint}`} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 border-t border-border pt-3 text-[11px] text-sky-300">Open on Pump.fun <ExternalLink className="h-3 w-3" /></a>
            </aside>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
