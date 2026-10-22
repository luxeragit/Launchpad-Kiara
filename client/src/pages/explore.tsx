import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ArrowDownUp, ArrowUpRight, Check, Copy, ExternalLink, Globe2, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PriceChart } from "@/components/price-chart";
import { useAuth } from "@/contexts/AuthContext";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TokenHolding, Wallet, TradeSetting } from "@shared/schema";
import { TerminalEmpty, TerminalPanel } from "@/components/terminal/terminal-panel";

interface MarketToken {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  timestamp: number;
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
interface FeedResponse { tokens: MarketToken[]; connected: boolean; tokenCount?: number }
interface TokenSearchResponse {
  found: boolean; source: string; token: {
    mint: string; name: string; symbol: string; image: string | null; description: string | null;
    twitter: string | null; telegram: string | null; website: string | null; priceUsd: number;
    priceChange24h?: number; volume24h?: number; marketCap?: number; bondingCurveProgress: number; complete: boolean;
  };
}
type Category = "Trending" | "New" | "Most Active" | "Top Movers";
type PanelTab = "trending" | "activity" | "leaderboard";
type RankBy = "movers" | "volume" | "trades";
type InspectorTradeMode = "buy" | "sell";
interface SellResult { success?: boolean; error?: string; solAmount?: number; tokenSymbol?: string; signature?: string; }
interface TradeOutcome { mint: string; success: boolean; message: string; }

function shortMint(value: string) { return `${value.slice(0, 5)}…${value.slice(-4)}`; }
function metric(value?: number, unit = "") {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${unit}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${unit}${(value / 1_000).toFixed(1)}K`;
  if (value >= 1_000) return `${unit}${(value / 1_000).toFixed(2)}K`;
  return `${unit}${value.toFixed(value < 1 ? 4 : 0)}`;
}
function since(timestamp: number) {
  const ms = Date.now() - timestamp;
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function TokenMark({ token, size = "sm" }: { token: MarketToken; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const dimensions = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  return <div className={`${dimensions} flex shrink-0 items-center justify-center overflow-hidden border border-border bg-[#1b202a] text-[10px] font-semibold text-sky-300`}>
    {token.image && !failed ? <img src={token.image} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : token.symbol.slice(0, 2).toUpperCase()}
  </div>;
}

function TokenRow({ token, rank, metricLabel, metricValue, onSelect, onCopy, onBuy, canBuy }: {
  token: MarketToken; rank?: number; metricLabel?: string; metricValue?: string; onSelect: () => void; onCopy: (mint: string) => void; onBuy: () => void; canBuy: boolean;
}) {
  const gain = typeof token.priceChange === "number" ? token.priceChange >= 0 : undefined;
  return <article data-testid={`market-token-row-${token.mint}`} onClick={onSelect} onKeyDown={(e) => e.key === "Enter" && onSelect()} tabIndex={0} role="button" className="group flex min-h-[68px] cursor-pointer items-center gap-2.5 border-b border-border/80 px-3 py-2 transition-colors hover:bg-[#151820] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500/50">
    {rank !== undefined && <span className="w-4 shrink-0 font-mono text-[10px] text-muted-foreground">{String(rank + 1).padStart(2, "0")}</span>}
    <TokenMark token={token} />
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[11px] font-semibold text-foreground">{token.name}</span>
        <span className="shrink-0 text-[9px] text-muted-foreground">{token.symbol}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-muted-foreground">
        <span className="font-mono">{shortMint(token.mint)}</span><span>·</span><span>{since(token.timestamp)}</span>
        {token.twitter && <a href={token.twitter.startsWith("http") ? token.twitter : `https://x.com/${token.twitter}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`${token.symbol} social link`} className="text-muted-foreground hover:text-sky-300"><ExternalLink className="h-2.5 w-2.5" /></a>}
        {token.telegram && <a href={token.telegram.startsWith("http") ? token.telegram : `https://t.me/${token.telegram}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`${token.symbol} Telegram`} className="text-muted-foreground hover:text-sky-300"><ExternalLink className="h-2.5 w-2.5" /></a>}
        {token.website && <a href={token.website.startsWith("http") ? token.website : `https://${token.website}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`${token.symbol} website`} className="text-muted-foreground hover:text-sky-300"><Globe2 className="h-2.5 w-2.5" /></a>}
      </div>
    </div>
    <div className="hidden w-[74px] shrink-0 text-right sm:block">
      <div className="text-[8px] text-muted-foreground">{metricLabel ?? "MCap · SOL"}</div>
      <div className="mt-1 font-mono text-[10px] text-foreground">{metricValue ?? metric(token.marketCapSol)}</div>
    </div>
    <div className={`min-w-[54px] shrink-0 text-right font-mono text-[10px] ${gain === undefined ? "text-muted-foreground" : gain ? "text-emerald-400" : "text-rose-400"}`}>
      {gain === undefined ? "—" : `${gain ? "+" : ""}${token.priceChange?.toFixed(2)}%`}
    </div>
    <button type="button" data-testid={`button-buy-${token.mint}`} disabled={!canBuy} title={canBuy ? `Buy ${token.symbol}` : "Connect a wallet, select an active managed wallet, and verify network safety"} onClick={(e) => { e.stopPropagation(); onBuy(); }} className="h-6 min-w-8 shrink-0 border border-sky-500/30 px-1.5 text-[9px] font-semibold text-sky-300 transition-colors hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground/50">Buy</button>
    <button type="button" onClick={(e) => { e.stopPropagation(); onCopy(token.mint); }} title="Copy mint" aria-label={`Copy ${token.symbol} mint`} className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground opacity-50 transition-opacity hover:text-sky-300 group-hover:opacity-100"><Copy className="h-3 w-3" /></button>
  </article>;
}

export default function ExplorePage() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const network = useNetworkStatus();
  const canTransact = !!network.data?.transactionsEnabled && !network.isError;
  const [category, setCategory] = useState<Category>("Trending");
  const [rankBy, setRankBy] = useState<RankBy>("movers");
  const [panelTab, setPanelTab] = useState<PanelTab>("trending");
  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [searching, setSearching] = useState(false);
  const [amount, setAmount] = useState("0.1");
  const [walletId, setWalletId] = useState("");
  const [inspectorTradeMode, setInspectorTradeMode] = useState<InspectorTradeMode>("buy");
  const [sellPercent, setSellPercent] = useState("100");
  const [tradeOutcome, setTradeOutcome] = useState<TradeOutcome | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const { data: tokensFeed, isLoading: loadingTokens, isError: tokenError, refetch: refetchTokens } = useQuery<FeedResponse>({ queryKey: ["/api/pumpfun/tokens"], refetchInterval: 3000 });
  const { data: trendingFeed, isLoading: loadingTrending, isError: trendingError, refetch: refetchTrending } = useQuery<FeedResponse>({ queryKey: ["/api/pumpfun/trending"], refetchInterval: 3000 });
  const { data: moversFeed, isLoading: loadingMovers, isError: moversError, refetch: refetchMovers } = useQuery<FeedResponse>({ queryKey: ["/api/pumpfun/movers"], refetchInterval: 3000 });
  const { data: wallets } = useQuery<Wallet[]>({ queryKey: ["/api/wallets"], enabled: isAuthenticated });
  const { data: settings } = useQuery<TradeSetting>({ queryKey: ["/api/trade/settings"], enabled: isAuthenticated });
  const {
    data: tokenHoldings,
    isLoading: loadingTokenHoldings,
    isError: tokenHoldingsError,
    error: tokenHoldingsErrorValue,
    refetch: refetchTokenHoldings,
  } = useQuery<TokenHolding[]>({
    queryKey: ["/api/holdings/token", selectedToken?.mint],
    enabled: isAuthenticated && detailsOpen && inspectorTradeMode === "sell" && !!selectedToken?.mint,
    refetchInterval: 5000,
  });
  const walletOptions = useMemo(() => wallets?.filter((wallet) => wallet.isActive && !wallet.isArchived) ?? [], [wallets]);
  const selectedWallet = walletOptions.find((wallet) => wallet.id === walletId);
  const selectedWalletHoldings = tokenHoldings?.filter((holding) =>
    holding.tokenMint === selectedToken?.mint && holding.walletId === walletId
  ) ?? [];
  const sellableHolding = tokenHoldings?.find((holding) =>
    holding.tokenMint === selectedToken?.mint &&
    holding.walletId === walletId &&
    holding.status === "holding" &&
    Number(holding.tokenQuantity ?? 0) > 0
  );

  useEffect(() => {
    if (!walletId && walletOptions.length) {
      const preferred = settings?.selectedWallets?.[0];
      setWalletId(preferred && walletOptions.some((wallet) => wallet.id === preferred) ? preferred : walletOptions[0].id);
    }
  }, [walletId, walletOptions, settings]);

  const getTokensForCategory = useCallback((): MarketToken[] => {
    if (category === "Trending") {
      const trending = trendingFeed?.tokens ?? [];
      return trending;
    }
    if (category === "Top Movers") {
      const movers = moversFeed?.tokens ?? [];
      return movers.length ? movers : [...(tokensFeed?.tokens ?? [])].filter((token) => token.priceChange !== undefined).sort((a, b) => (b.priceChange ?? 0) - (a.priceChange ?? 0));
    }
    if (category === "New") return [...(tokensFeed?.tokens ?? [])].sort((a, b) => b.timestamp - a.timestamp);
    return [...(tokensFeed?.tokens ?? [])].sort((a, b) => (b.tradeCount ?? 0) - (a.tradeCount ?? 0));
  }, [category, trendingFeed?.tokens, moversFeed?.tokens, tokensFeed?.tokens]);
  const displayTokens = getTokensForCategory();
  const activityTokens = useMemo(() => [...(tokensFeed?.tokens ?? [])].sort((a, b) => b.timestamp - a.timestamp), [tokensFeed?.tokens]);
  const rankedTokens = useMemo(() => {
    const all = [...(trendingFeed?.tokens ?? []), ...(moversFeed?.tokens ?? []), ...(tokensFeed?.tokens ?? [])];
    const unique = Array.from(new Map(all.map((token) => [token.mint, token])).values());
    if (rankBy === "volume") return unique.filter((token) => token.volume !== undefined).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    if (rankBy === "trades") return unique.filter((token) => token.tradeCount !== undefined).sort((a, b) => (b.tradeCount ?? 0) - (a.tradeCount ?? 0));
    return unique.filter((token) => token.priceChange !== undefined).sort((a, b) => (b.priceChange ?? 0) - (a.priceChange ?? 0));
  }, [trendingFeed?.tokens, moversFeed?.tokens, tokensFeed?.tokens, rankBy]);

  const buyMutation = useMutation({
    mutationFn: async (token: MarketToken) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to buy a token.");
      if (!canTransact) throw new Error(network.data?.reason || "Network safety has not been verified.");
      if (!walletOptions.some((wallet) => wallet.id === walletId)) throw new Error("Select an active wallet before trading.");
      const response = await apiRequest("POST", "/api/trade/buy", {
        walletId, tokenMint: token.mint, solAmount: Number(amount), tokenName: token.name, tokenSymbol: token.symbol, tokenImage: token.image,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/holdings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] }),
      ]);
      toast({ title: "Purchase submitted", description: data?.tokenSymbol ? `Buy request for ${data.tokenSymbol} submitted.` : "The trade request was submitted." });
    },
    onError: (error: Error) => toast({ title: "Buy failed", description: error.message, variant: "destructive" }),
  });

  const sellMutation = useMutation({
    mutationFn: async (trade: { mint: string; walletId: string; percentage: number }) => {
      if (!isAuthenticated) throw new Error("Connect your wallet before selling.");
      if (!canTransact) throw new Error(network.data?.reason || "Network safety has not been verified.");
      if (!walletOptions.some((wallet) => wallet.id === trade.walletId)) throw new Error("Select an active wallet before selling.");
      if (!Number.isFinite(trade.percentage) || trade.percentage < 1 || trade.percentage > 100) throw new Error("Sell percentage must be between 1 and 100.");
      const holding = tokenHoldings?.find((item) =>
        item.tokenMint === trade.mint &&
        item.walletId === trade.walletId &&
        item.status === "holding" &&
        Number(item.tokenQuantity ?? 0) > 0
      );
      if (!holding) throw new Error("No open holding for this token exists in the selected wallet.");
      const response = await apiRequest("POST", "/api/trade/sell", {
        walletId: trade.walletId,
        tokenMint: trade.mint,
        percentage: trade.percentage,
      });
      return response.json() as Promise<SellResult>;
    },
    onSuccess: async (result, trade) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/holdings/token", trade.mint] }),
        queryClient.invalidateQueries({ queryKey: ["/api/holdings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/wallets"] }),
      ]);
      if (result?.success) {
        const message = result.solAmount != null
          ? `Sold ${trade.percentage}% for ${result.solAmount.toFixed(4)} SOL.`
          : `Sell request for ${trade.percentage}% was confirmed.`;
        setTradeOutcome({ mint: trade.mint, success: true, message });
        toast({ title: "Sell submitted", description: message });
      } else {
        const message = result?.error || "The sell request was not confirmed.";
        setTradeOutcome({ mint: trade.mint, success: false, message });
        toast({ title: "Sell failed", description: message, variant: "destructive" });
      }
    },
    onError: (error: Error, trade) => {
      setTradeOutcome({ mint: trade.mint, success: false, message: error.message });
      toast({ title: "Sell failed", description: error.message, variant: "destructive" });
    },
  });

  const selectToken = (token: MarketToken) => {
    setSelectedToken(token);
    setInspectorTradeMode("buy");
    setSellPercent("100");
    setTradeOutcome(null);
    setDetailsOpen(true);
  };
  const copyMint = async (mint: string) => {
    try { await navigator.clipboard.writeText(mint); toast({ title: "Mint copied", description: shortMint(mint) }); }
    catch { toast({ title: "Could not copy mint", description: "Clipboard access is unavailable.", variant: "destructive" }); }
  };

  const lookupMint = useCallback(async (mint: string) => {
    const value = mint.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
      setSearchError("Enter a valid Solana mint address.");
      toast({ title: "Invalid mint address", description: "Enter a valid Solana token mint.", variant: "destructive" });
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const response = await fetch(`/api/tokens/search/${encodeURIComponent(value)}`, { credentials: "include" });
      if (!response.ok) {
        const failure = await response.json();
        throw new Error(failure.error || "Token not found");
      }
      const result: TokenSearchResponse = await response.json();
      const token = result.token;
      setSelectedToken({
        mint: token.mint, name: token.name, symbol: token.symbol, image: token.image, timestamp: Date.now(),
        priceChange: token.priceChange24h, volume: token.volume24h, marketCapSol: undefined, description: token.description ?? undefined,
        twitter: token.twitter ?? undefined, telegram: token.telegram ?? undefined, website: token.website ?? undefined,
      });
      setInspectorTradeMode("buy");
      setSellPercent("100");
      setTradeOutcome(null);
      setDetailsOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token lookup failed";
      setSearchError(message);
      toast({ title: "Token search failed", description: message, variant: "destructive" });
    } finally { setSearching(false); }
  }, [toast]);

  useEffect(() => {
    const initialMint = new URLSearchParams(window.location.search).get("mint");
    if (initialMint) void lookupMint(initialMint);
    const onMint = (event: Event) => {
      const mint = (event as CustomEvent<string>).detail;
      if (typeof mint === "string") void lookupMint(mint);
    };
    window.addEventListener("kiara:mint-search", onMint);
    return () => window.removeEventListener("kiara:mint-search", onMint);
  }, [lookupMint]);

  const marketLoading = displayTokens.length === 0 && (category === "Trending" ? loadingTrending : category === "Top Movers" ? loadingMovers || loadingTokens : loadingTokens);
  const marketError = displayTokens.length === 0 && (category === "Trending" ? trendingError : category === "Top Movers" ? moversError && tokenError : tokenError);
  const retryMarket = () => {
    if (category === "Trending") void refetchTrending();
    else if (category === "Top Movers") void refetchMovers();
    else void refetchTokens();
  };
  const buyEnabled = isAuthenticated && !!selectedWallet && canTransact && Number(amount) > 0 && !buyMutation.isPending;
  const sellEnabled = isAuthenticated && !!selectedWallet && !!sellableHolding && canTransact && Number(sellPercent) >= 1 && Number(sellPercent) <= 100 && !sellMutation.isPending;

  const mobileTabs: { id: PanelTab; label: string }[] = [
    { id: "trending", label: "Trending" }, { id: "activity", label: "Live Activity" }, { id: "leaderboard", label: "Leaderboard" },
  ];

  return <div className="terminal-workspace page-enter">
    <div className="flex h-9 items-center justify-between border-b border-border bg-[#0d0f14] px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-[10px]">
        <span className={`h-1.5 w-1.5 rounded-full ${tokensFeed?.connected ? "bg-emerald-400" : "bg-muted-foreground"}`} />
        <span className="font-semibold">Explore markets</span>
        <span className="hidden text-muted-foreground sm:inline">{searching ? "Looking up mint…" : tokensFeed?.connected ? "Pump.fun feed connected" : loadingTokens ? "Connecting to public feed" : "Public market feed"}</span>
        {searchError && <span className="truncate text-rose-400">{searchError}</span>}
      </div>
      <div className="flex items-center gap-2">
        <label className="hidden items-center gap-1.5 sm:flex">
          <span className="text-[11px] text-muted-foreground">BUY SOL</span>
          <input aria-label="Quick-buy SOL amount" type="number" min="0.001" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-6 w-16 border border-border bg-[#101218] px-1.5 text-right font-mono text-[10px] outline-none focus:border-sky-500/60" />
        </label>
        <label className="hidden max-w-[150px] items-center gap-1.5 md:flex">
          <span className="text-[11px] text-muted-foreground">WALLET</span>
          <select aria-label="Quick-buy wallet" value={walletId} onChange={(e) => setWalletId(e.target.value)} disabled={!isAuthenticated || !walletOptions.length} className="h-6 min-w-0 max-w-[110px] border border-border bg-[#101218] px-1.5 text-[10px] text-foreground outline-none">
            {!isAuthenticated && <option value="">Connect wallet</option>}
            {isAuthenticated && !walletOptions.length && <option value="">No active wallet</option>}
            {walletOptions.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.label} · {shortMint(wallet.address)}</option>)}
          </select>
        </label>
        {!canTransact && <span className="flex items-center gap-1 text-[9px] text-amber-300" title={network.data?.reason || "Network safety verification pending"}><ShieldAlert className="h-3 w-3" /><span className="hidden sm:inline">Trading paused</span></span>}
      </div>
    </div>
    <div className="explore-mobile-tabs flex h-9 items-stretch border-b border-border bg-[#101218] min-[1280px]:hidden" role="tablist" aria-label="Market panels">
      {mobileTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={panelTab === tab.id} onClick={() => setPanelTab(tab.id)} className={`flex-1 border-b-2 px-1 text-[10px] font-medium transition-colors ${panelTab === tab.id ? "border-sky-400 text-sky-300" : "border-transparent text-muted-foreground"}`}>{tab.label}</button>)}
    </div>
    <div className="explore-panels min-h-0 flex-1">
      <TerminalPanel title="Trending" testId="panel-trending" className={`explore-panel explore-panel-trending ${panelTab !== "trending" ? "panel-inactive" : ""}`} headerActions={
        <>
          <span className="hidden text-[9px] text-muted-foreground sm:inline">{displayTokens.length} tokens</span>
          <button onClick={retryMarket} type="button" title="Refresh market feed" aria-label="Refresh market feed" className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"><RefreshCw className={`h-3.5 w-3.5 ${marketLoading ? "animate-spin" : ""}`} /></button>
        </>
      }>
        <div className="border-b border-border px-2 py-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(["Trending", "New", "Most Active", "Top Movers"] as Category[]).map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={`shrink-0 px-2 py-1 text-[11px] ${category === value ? "bg-[#1b202a] text-sky-300" : "text-muted-foreground hover:text-foreground"}`}>{value}</button>)}
            <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"><ArrowDownUp className="h-3 w-3" />LIVE</span>
          </div>
        </div>
        <div data-testid="panel-scroll" className="terminal-scroll">
          {marketLoading && displayTokens.length === 0 ? <div className="space-y-0">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex h-[68px] items-center gap-3 border-b border-border px-3"><div className="h-9 w-9 animate-pulse bg-[#1b202a]" /><div className="flex-1"><div className="mb-2 h-2 w-24 animate-pulse bg-[#1b202a]" /><div className="h-2 w-16 animate-pulse bg-[#1b202a]" /></div></div>)}</div>
            : marketError ? <TerminalEmpty title="Market feed unavailable" detail="The public data provider could not be reached." retry={retryMarket} />
            : displayTokens.length ? displayTokens.map((token) => <TokenRow key={token.mint} token={token} onSelect={() => selectToken(token)} onCopy={copyMint} onBuy={() => buyMutation.mutate(token)} canBuy={buyEnabled} />)
            : <TerminalEmpty title="No tokens in this feed" detail="Try another data-backed market view or refresh." />}
        </div>
      </TerminalPanel>

      <TerminalPanel title="Live Activity" testId="panel-activity" className={`explore-panel explore-panel-activity ${panelTab !== "activity" ? "panel-inactive" : ""}`} headerActions={<span className="flex items-center gap-1 text-[9px] text-muted-foreground"><Activity className="h-3 w-3 text-sky-400" />Indexed tokens</span>}>
        <div data-testid="panel-scroll" className="terminal-scroll">
          {loadingTokens && activityTokens.length === 0 ? <div className="space-y-0">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[88px] animate-pulse border-b border-border bg-[#151820]/40" />)}</div>
            : tokenError ? <TerminalEmpty title="Activity feed unavailable" detail="Could not load public token feed." retry={() => void refetchTokens()} />
            : activityTokens.length ? activityTokens.slice(0, 30).map((token) => <div key={token.mint} className="border-b border-border px-3 py-3">
              <div className="flex items-start gap-2.5">
                <TokenMark token={token} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => selectToken(token)} className="truncate text-left text-[11px] font-semibold hover:text-sky-300">{token.name} <span className="font-normal text-muted-foreground">{token.symbol}</span></button>
                    <span className="shrink-0 text-[9px] text-muted-foreground">{since(token.timestamp)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[9px] text-muted-foreground">
                    <span className="text-sky-300/80">Recently indexed</span>
                    {token.tradeCount !== undefined && <span>{metric(token.tradeCount)} trades</span>}
                    {token.volume !== undefined && <span>Vol {metric(token.volume, "$")}</span>}
                  </div>
                  <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">{shortMint(token.mint)}</div>
                </div>
              </div>
            </div>)
            : <TerminalEmpty title="Waiting for market activity" detail="Newly observed tokens from the supported public feed will appear here." />}
        </div>
        <footer className="border-t border-border px-3 py-2 text-[9px] text-muted-foreground">Source: public token feed · No social posts or trader P&L displayed</footer>
      </TerminalPanel>

      <TerminalPanel title="Token Leaderboard" testId="panel-leaderboard" className={`explore-panel explore-panel-leaderboard ${panelTab !== "leaderboard" ? "panel-inactive" : ""}`} headerActions={
        <select aria-label="Leaderboard ranking metric" value={rankBy} onChange={(e) => setRankBy(e.target.value as RankBy)} className="h-6 border border-border bg-[#151820] px-1.5 text-[9px] text-foreground outline-none">
          <option value="movers">Top movers</option><option value="volume">Volume</option><option value="trades">Most active</option>
        </select>
      }>
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground"><span>Token · Ranked by {rankBy === "movers" ? "change" : rankBy}</span><span>{rankBy === "movers" ? "Change" : rankBy === "volume" ? "Volume" : "Trades"}</span></div>
        <div data-testid="panel-scroll" className="terminal-scroll">
          {rankedTokens.length ? rankedTokens.slice(0, 60).map((token, index) => {
            const value = rankBy === "movers" ? `${(token.priceChange ?? 0) >= 0 ? "+" : ""}${token.priceChange?.toFixed(2)}%` : rankBy === "volume" ? metric(token.volume, "$") : metric(token.tradeCount);
            return <TokenRow key={token.mint} token={token} rank={index} metricLabel={rankBy === "movers" ? "MCap · SOL" : rankBy === "volume" ? "Volume" : "Trades"} metricValue={rankBy === "movers" ? metric(token.marketCapSol) : value} onSelect={() => selectToken(token)} onCopy={copyMint} onBuy={() => buyMutation.mutate(token)} canBuy={buyEnabled} />;
          }) : <TerminalEmpty title="No ranking data yet" detail="The provider has not returned this metric for current tokens." />}
        </div>
        <footer className="border-t border-border px-3 py-2 text-[9px] text-muted-foreground">Ranked by real market feed metrics · No trader-profit claims</footer>
      </TerminalPanel>
    </div>

    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto border-border bg-[#101218] p-0 text-foreground">
        {selectedToken && <>
          <DialogHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <TokenMark token={selectedToken} size="md" />
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-[15px]">{selectedToken.name} <span className="text-muted-foreground">{selectedToken.symbol}</span></DialogTitle>
                <DialogDescription className="mt-1 font-mono text-[10px]">{shortMint(selectedToken.mint)}</DialogDescription>
              </div>
              <button type="button" onClick={() => void copyMint(selectedToken.mint)} aria-label="Copy token mint" className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button>
            </div>
          </DialogHeader>
          <div className="grid min-h-0 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 p-3 sm:p-4">
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="border border-border bg-[#151820] p-2"><div className="text-[9px] text-muted-foreground">Market cap · SOL</div><div className="mt-1 font-mono text-[11px]">{metric(selectedToken.marketCapSol)}</div></div>
                <div className="border border-border bg-[#151820] p-2"><div className="text-[9px] text-muted-foreground">Volume</div><div className="mt-1 font-mono text-[11px]">{metric(selectedToken.volume, "$")}</div></div>
                <div className="border border-border bg-[#151820] p-2"><div className="text-[9px] text-muted-foreground">Change</div><div className={`mt-1 font-mono text-[11px] ${(selectedToken.priceChange ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{selectedToken.priceChange === undefined ? "—" : `${selectedToken.priceChange >= 0 ? "+" : ""}${selectedToken.priceChange.toFixed(2)}%`}</div></div>
              </div>
              <div className="h-[290px] overflow-hidden border border-border bg-[#0c0e13]"><PriceChart tokenMint={selectedToken.mint} height={290} /></div>
              {selectedToken.description && <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{selectedToken.description}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
                {selectedToken.twitter && <a href={selectedToken.twitter.startsWith("http") ? selectedToken.twitter : `https://x.com/${selectedToken.twitter}`} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">X profile <ArrowUpRight className="inline h-3 w-3" /></a>}
                {selectedToken.telegram && <a href={selectedToken.telegram.startsWith("http") ? selectedToken.telegram : `https://t.me/${selectedToken.telegram}`} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">Telegram <ArrowUpRight className="inline h-3 w-3" /></a>}
                {selectedToken.website && <a href={selectedToken.website.startsWith("http") ? selectedToken.website : `https://${selectedToken.website}`} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200">Website <ArrowUpRight className="inline h-3 w-3" /></a>}
              </div>
            </div>
            <aside className="border-t border-border bg-[#0d0f14] p-4 md:border-l md:border-t-0">
              <div className="mb-3 flex items-center justify-between text-[11px] font-semibold">Trade token <span className="text-[9px] font-normal uppercase tracking-wide text-muted-foreground">{inspectorTradeMode} terminal</span></div>
              <div role="tablist" aria-label="Trade mode" className="mb-4 grid grid-cols-2 border border-border bg-[#151820] p-0.5">
                <button type="button" role="tab" aria-selected={inspectorTradeMode === "buy"} data-testid="inspector-trade-mode-buy" onClick={() => { setInspectorTradeMode("buy"); setTradeOutcome(null); }} className={`h-8 text-[11px] font-semibold transition-colors ${inspectorTradeMode === "buy" ? "bg-sky-400/15 text-sky-300" : "text-muted-foreground hover:text-foreground"}`}>Buy</button>
                <button type="button" role="tab" aria-selected={inspectorTradeMode === "sell"} data-testid="inspector-trade-mode-sell" onClick={() => { setInspectorTradeMode("sell"); setTradeOutcome(null); }} className={`h-8 text-[11px] font-semibold transition-colors ${inspectorTradeMode === "sell" ? "bg-rose-400/15 text-rose-300" : "text-muted-foreground hover:text-foreground"}`}>Sell</button>
              </div>
              <label className="mb-3 block text-[9px] text-muted-foreground">WALLET
                <select aria-label="Trade wallet" value={walletId} onChange={(e) => setWalletId(e.target.value)} disabled={!isAuthenticated || !walletOptions.length} className="mt-1 h-9 w-full border border-border bg-[#151820] px-2 text-[11px] text-foreground outline-none">
                  {!isAuthenticated && <option value="">Connect a wallet</option>}
                  {isAuthenticated && !walletOptions.length && <option value="">No active managed wallet</option>}
                  {walletOptions.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.label} · {shortMint(wallet.address)}</option>)}
                </select>
              </label>
              <div className="mb-3 flex items-center justify-between border border-border bg-[#151820] px-2 py-2 text-[10px]">
                <span className="text-muted-foreground">Selected wallet balance</span>
                <span className="font-mono tabular-nums">{selectedWallet?.balance == null ? "Balance unavailable" : `${selectedWallet.balance.toFixed(4)} SOL`}</span>
              </div>
              {inspectorTradeMode === "buy" ? <label className="mb-3 block text-[9px] text-muted-foreground">AMOUNT · SOL
                <input aria-label="Trade amount in SOL" type="number" min="0.001" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-9 w-full border border-border bg-[#151820] px-2 font-mono text-[11px] text-foreground outline-none focus:border-sky-500/60" />
              </label> : <>
                <div className="mb-3 border border-border bg-[#151820] p-2.5">
                  <div className="mb-2 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Open holding in selected wallet</span>
                    {sellableHolding && <span className="text-emerald-300">Eligible</span>}
                  </div>
                  {!isAuthenticated ? <p className="text-[10px] text-muted-foreground">Connect your wallet to load private holdings.</p>
                    : !walletId ? <p className="text-[10px] text-muted-foreground">Select an active wallet to check its holding.</p>
                    : loadingTokenHoldings ? <div className="h-5 w-28 animate-pulse bg-[#242a35]" />
                    : tokenHoldingsError ? <div className="flex items-center justify-between gap-2 text-[10px] text-rose-300">
                      <span className="min-w-0">{tokenHoldingsErrorValue instanceof Error ? tokenHoldingsErrorValue.message : "Could not load holdings."}</span>
                      <button type="button" onClick={() => void refetchTokenHoldings()} className="shrink-0 text-sky-300 hover:text-sky-200">Retry</button>
                    </div>
                    : sellableHolding ? <div className="font-mono text-[11px] tabular-nums">{Number(sellableHolding.tokenQuantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedToken.symbol} <span className="font-sans text-[9px] text-muted-foreground">recorded · {selectedWallet?.label}</span></div>
                    : selectedWalletHoldings.length ? <p className="text-[10px] text-amber-200">A record exists, but it is not an open positive-quantity holding.</p>
                    : <p className="text-[10px] text-muted-foreground">No open holding for {selectedToken.symbol} in this wallet.</p>}
                </div>
                <label className="mb-2 block text-[9px] text-muted-foreground">SELL PERCENT
                  <div className="mt-1 flex items-center gap-2">
                    <input aria-label="Sell percentage" type="number" min="1" max="100" step="1" value={sellPercent} onChange={(e) => setSellPercent(e.target.value)} className="h-9 min-w-0 flex-1 border border-border bg-[#151820] px-2 font-mono text-[11px] text-foreground outline-none focus:border-rose-400/60" />
                    <span className="text-[10px] text-muted-foreground">%</span>
                  </div>
                </label>
                <div className="mb-3 grid grid-cols-4 gap-1">
                  {[25, 50, 75, 100].map((percentage) => <button key={percentage} type="button" aria-pressed={Number(sellPercent) === percentage} onClick={() => setSellPercent(String(percentage))} className={`h-7 border text-[10px] font-mono ${Number(sellPercent) === percentage ? "border-rose-400/50 bg-rose-400/10 text-rose-300" : "border-border text-muted-foreground hover:text-foreground"}`}>{percentage}%</button>)}
                </div>
              </>}
              {!canTransact && <div className="mb-3 border border-amber-900/60 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-200"><ShieldAlert className="mr-1 inline h-3 w-3" />Financial operations are paused. {network.data?.reason || "Network safety is not verified."}</div>}
              {!isAuthenticated && <div className="mb-3 border border-border bg-[#151820] p-2 text-[10px] text-muted-foreground">Connect your wallet to access managed wallets and trading.</div>}
              {inspectorTradeMode === "buy" ? <button type="button" disabled={!buyEnabled} onClick={() => buyMutation.mutate(selectedToken)} className="flex h-10 w-full items-center justify-center gap-2 bg-[#32a9ff] text-[11px] font-semibold text-[#081018] transition-colors hover:bg-[#57b8ff] disabled:cursor-not-allowed disabled:bg-[#26303a] disabled:text-muted-foreground">
                {buyMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {buyMutation.isPending ? "Submitting…" : "Buy token"}
              </button> : <button type="button" data-testid="button-inspector-sell" disabled={!sellEnabled} onClick={() => sellMutation.mutate({ mint: selectedToken.mint, walletId, percentage: Number(sellPercent) })} className="flex h-10 w-full items-center justify-center gap-2 border border-rose-400/40 bg-rose-400/15 text-[11px] font-semibold text-rose-200 transition-colors hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-[#1a1d24] disabled:text-muted-foreground">
                {sellMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowDownUp className="h-3.5 w-3.5" />}
                {sellMutation.isPending ? "Submitting sale…" : `Sell ${sellPercent || 0}%`}
              </button>}
              {inspectorTradeMode === "sell" && tradeOutcome?.mint === selectedToken.mint && <p role={tradeOutcome.success ? "status" : "alert"} className={`mt-2 border p-2 text-[10px] leading-relaxed ${tradeOutcome.success ? "border-emerald-900/60 bg-emerald-950/20 text-emerald-200" : "border-rose-900/60 bg-rose-950/20 text-rose-200"}`}>{tradeOutcome.message}</p>}
              <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">A trade is submitted only after an explicit click. Network safety and authenticated wallet checks remain enforced.</p>
              <Link href={`/deploy`} className="mt-4 block border-t border-border pt-3 text-[10px] text-muted-foreground hover:text-sky-300">Token launch workspace <ArrowUpRight className="inline h-3 w-3" /></Link>
            </aside>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
