import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PriceChart } from "@/components/price-chart";
import { Activity, Wallet, ChevronRight, ChevronLeft, Zap, ExternalLink, Circle, Copy, TrendingUp, Flame, Globe, Square, Filter, Target, AlertTriangle, Coins, DollarSign, Search, Loader2, MoreVertical, Clock, Star, ArrowUpDown, Sparkles } from "lucide-react";
import { SiX, SiTelegram } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Wallet as WalletType, TradeSetting, TokenHolding } from "@shared/schema";

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

interface SearchResult {
  found: boolean;
  source: string;
  token: {
    mint: string;
    name: string;
    symbol: string;
    image: string | null;
    description: string | null;
    twitter: string | null;
    telegram: string | null;
    website: string | null;
    priceUsd: number;
    priceChange24h?: number;
    volume24h?: number;
    liquidity?: number;
    marketCap?: number;
    fdv?: number;
    bondingCurveProgress: number;
    complete: boolean;
    dexId?: string;
  };
  allPairs?: Array<{
    dexId: string;
    pairAddress: string;
    priceUsd: string;
    liquidity: number;
  }>;
}

function TokenImage({ src, symbol, size = "md" }: { src: string | null; symbol: string; size?: "sm" | "md" | "lg" }) {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base"
  };
  
  if (!src || hasError) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold`}>
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} rounded-lg overflow-hidden bg-primary/10`}>
      <img 
        src={src} 
        alt={symbol}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function formatMarketCap(mcSol: number, solPrice: number): string {
  const mcUsd = mcSol * solPrice;
  if (mcUsd >= 1000000) return `$${(mcUsd / 1000000).toFixed(2)}M`;
  if (mcUsd >= 1000) return `$${(mcUsd / 1000).toFixed(2)}K`;
  return `$${mcUsd.toFixed(0)}`;
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(2)}K`;
  return `$${volume.toFixed(0)}`;
}

function FeaturedCard({ token, solPrice, onClick }: { token: PumpfunToken; solPrice: number; onClick: () => void }) {
  const priceChange = token.priceChange || 0;
  const isPositive = priceChange >= 0;
  
  return (
    <div 
      className="min-w-[200px] p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer flex-shrink-0"
      onClick={onClick}
      data-testid={`featured-card-${token.mint}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TokenImage src={token.image} symbol={token.symbol} size="md" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate max-w-[80px]" data-testid={`text-featured-name-${token.mint}`}>{token.name}</p>
            <p className="text-xs text-muted-foreground" data-testid={`text-featured-symbol-${token.mint}`}>{token.symbol}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-xs ${isPositive ? "text-green-500" : "text-red-500"}`} data-testid={`text-featured-change-${token.mint}`}>
          <TrendingUp className={`h-3 w-3 ${!isPositive && "rotate-180"}`} />
          {isPositive ? "+" : ""}{priceChange.toFixed(2)}%
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div>
          <p className="text-muted-foreground">Market Cap</p>
          <p className="font-semibold" data-testid={`text-featured-mcap-${token.mint}`}>{token.marketCapSol ? formatMarketCap(token.marketCapSol, solPrice) : "N/A"}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">24h Volume</p>
          <p className="font-semibold" data-testid={`text-featured-volume-${token.mint}`}>{token.volume ? formatVolume(token.volume) : "N/A"}</p>
        </div>
      </div>
    </div>
  );
}

function TrendingCard({ token, solPrice, onClick }: { token: PumpfunToken; solPrice: number; onClick: () => void }) {
  return (
    <div 
      className="min-w-[180px] p-3 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer flex-shrink-0"
      onClick={onClick}
      data-testid={`trending-card-${token.mint}`}
    >
      <div className="flex items-center justify-between mb-2">
        <TokenImage src={token.image} symbol={token.symbol} size="lg" />
        <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()} data-testid={`button-menu-${token.mint}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
      <div className="font-semibold text-sm truncate flex items-center gap-1" data-testid={`text-trending-name-${token.mint}`}>
        {token.name}
        {token.twitter && <Star className="h-3 w-3 text-yellow-500" />}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <div>
          <p className="text-muted-foreground">Market Cap</p>
          <p className="font-semibold" data-testid={`text-trending-mcap-${token.mint}`}>{token.marketCapSol ? formatMarketCap(token.marketCapSol, solPrice) : "N/A"}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">24h Volume</p>
          <p className="font-semibold" data-testid={`text-trending-volume-${token.mint}`}>{token.volume ? formatVolume(token.volume) : "N/A"}</p>
        </div>
      </div>
    </div>
  );
}

function TokenListItem({ 
  token, 
  solPrice, 
  onClick, 
  onBuy, 
  isBuying,
  canBuy,
  formatTimeAgo,
  copyToClipboard 
}: { 
  token: PumpfunToken; 
  solPrice: number; 
  onClick: () => void;
  onBuy: () => void;
  isBuying: boolean;
  canBuy: boolean;
  formatTimeAgo: (ts: number) => string;
  copyToClipboard: (text: string, label: string) => void;
}) {
  const priceChange = token.priceChange || 0;
  const isPositive = priceChange >= 0;
  
  return (
    <div 
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer group"
      onClick={onClick}
      data-testid={`token-list-item-${token.mint}`}
    >
      <TokenImage src={token.image} symbol={token.symbol} size="lg" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate" data-testid={`text-token-name-${token.mint}`}>{token.name}</p>
          <Badge variant="outline" size="sm" data-testid={`badge-token-symbol-${token.mint}`}>{token.symbol}</Badge>
          {token.twitter && (
            <a 
              href={token.twitter.startsWith('http') ? token.twitter : `https://twitter.com/${token.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
              data-testid={`link-twitter-${token.mint}`}
            >
              <SiX className="h-3.5 w-3.5" />
            </a>
          )}
          {token.telegram && (
            <a 
              href={token.telegram.startsWith('http') ? token.telegram : `https://t.me/${token.telegram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
              data-testid={`link-telegram-${token.mint}`}
            >
              <SiTelegram className="h-3.5 w-3.5" />
            </a>
          )}
          {token.website && (
            <a 
              href={token.website.startsWith('http') ? token.website : `https://${token.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
              data-testid={`link-website-${token.mint}`}
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" data-testid={`text-token-time-${token.mint}`}>
            <Clock className="h-3 w-3" />
            {formatTimeAgo(token.timestamp)}
          </span>
          <code 
            className="font-mono cursor-pointer hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(token.mint, "Token address");
            }}
            data-testid={`code-copy-mint-${token.mint}`}
          >
            {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
          </code>
        </div>
      </div>
      
      <div className="flex items-center gap-6 text-sm">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Market Cap</p>
          <p className="font-semibold" data-testid={`text-token-mcap-${token.mint}`}>{token.marketCapSol ? formatMarketCap(token.marketCapSol, solPrice) : "N/A"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Vol 24h</p>
          <p className="font-semibold" data-testid={`text-token-volume-${token.mint}`}>{token.volume ? formatVolume(token.volume) : "N/A"}</p>
        </div>
        <div className="text-right min-w-[60px]">
          <p className="text-xs text-muted-foreground">Change</p>
          <p className={`font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`} data-testid={`text-token-change-${token.mint}`}>
            {isPositive ? "+" : ""}{priceChange.toFixed(1)}%
          </p>
        </div>
      </div>
      
      <Button
        size="sm"
        disabled={!canBuy || isBuying}
        onClick={(e) => {
          e.stopPropagation();
          onBuy();
        }}
        data-testid={`button-buy-${token.mint}`}
      >
        {isBuying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
      </Button>
    </div>
  );
}

export default function MonitorPage() {
  const [solAmount, setSolAmount] = useState("0.1");
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState<PumpfunToken | null>(null);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [requireTwitter, setRequireTwitter] = useState(false);
  const [requireTelegram, setRequireTelegram] = useState(false);
  const [requireWebsite, setRequireWebsite] = useState(false);
  const [minMarketCap, setMinMarketCap] = useState("");
  const [maxMarketCap, setMaxMarketCap] = useState("");
  const [minVolMcapRatio, setMinVolMcapRatio] = useState("");
  const [maxVolMcapRatio, setMaxVolMcapRatio] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [autoSellEnabled, setAutoSellEnabled] = useState(false);
  const [takeProfitPercent, setTakeProfitPercent] = useState("");
  const [stopLossPercent, setStopLossPercent] = useState("");
  const [solPrice, setSolPrice] = useState(200);
  const [searchMint, setSearchMint] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"explore" | "newest" | "trending" | "movers">("newest");
  const [timeFilter, setTimeFilter] = useState<"5M" | "1H" | "6H" | "24H">("24H");
  const [migratedOnly, setMigratedOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const trendingScrollRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        if (res.ok) {
          const data = await res.json();
          if (data.solana?.usd) {
            setSolPrice(data.solana.usd);
          }
        }
      } catch (error) {
        console.log("Failed to fetch SOL price, using default");
      }
    };
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleTokenClick = (token: PumpfunToken) => {
    setSelectedToken(token);
    setChartDialogOpen(true);
  };

  const handleChartDialogClose = useCallback((open: boolean) => {
    setChartDialogOpen(open);
    if (!open) {
      setSelectedToken(null);
    }
  }, []);

  const handleSearch = async () => {
    const mint = searchMint.trim();
    if (!mint || mint.length < 32) {
      toast({ title: "Invalid mint address", description: "Please enter a valid Solana token mint address", variant: "destructive" });
      return;
    }
    
    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const res = await fetch(`/api/tokens/search/${mint}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Token not found");
      }
      const data: SearchResult = await res.json();
      setSearchResult(data);
      setSearchDialogOpen(true);
    } catch (error: any) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const { data: wallets, isLoading } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
  });

  const { data: tradeSettings } = useQuery<TradeSetting>({
    queryKey: ["/api/trade/settings"],
  });

  const { data: monitoringStatus, refetch: refetchStatus } = useQuery<MonitoringStatus>({
    queryKey: ["/api/monitoring/status"],
    refetchInterval: 2000,
  });

  const { data: pumpfunData, isLoading: isLoadingTokens } = useQuery<PumpfunResponse>({
    queryKey: ["/api/pumpfun/tokens"],
    refetchInterval: 3000,
  });

  const { data: trendingData } = useQuery<PumpfunResponse>({
    queryKey: ["/api/pumpfun/trending"],
    refetchInterval: 3000,
  });

  const { data: moversData } = useQuery<PumpfunResponse>({
    queryKey: ["/api/pumpfun/movers"],
    refetchInterval: 3000,
  });

  const { data: holdings, isLoading: isLoadingHoldings } = useQuery<TokenHolding[]>({
    queryKey: ["/api/holdings"],
    refetchInterval: 5000,
  });

  const isMonitoring = monitoringStatus?.isMonitoring ?? false;

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
      const res = await apiRequest("PUT", "/api/trade/settings", settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save settings", description: error.message, variant: "destructive" });
    },
  });

  const startMonitoringMutation = useMutation({
    mutationFn: async () => {
      await saveSettingsMutation.mutateAsync({
        solAmount: parseFloat(solAmount) || 0.1,
        autoRedirect,
        selectedWallets,
        requireTwitter,
        requireTelegram,
        requireWebsite,
        minMarketCap: minMarketCap ? parseFloat(minMarketCap) : null,
        maxMarketCap: maxMarketCap ? parseFloat(maxMarketCap) : null,
        minVolMcapRatio: minVolMcapRatio ? parseFloat(minVolMcapRatio) : null,
        maxVolMcapRatio: maxVolMcapRatio ? parseFloat(maxVolMcapRatio) : null,
      });
      const res = await apiRequest("POST", "/api/monitoring/start", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/status"] });
      toast({ title: "Monitoring started", description: "Auto-buy is now active" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start monitoring", description: error.message, variant: "destructive" });
    },
  });

  const stopMonitoringMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/monitoring/stop", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/status"] });
      toast({ title: "Monitoring stopped", description: "Auto-buy has been disabled" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop monitoring", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      solAmount: parseFloat(solAmount) || 0.1,
      autoRedirect,
      selectedWallets,
      requireTwitter,
      requireTelegram,
      requireWebsite,
      minMarketCap: minMarketCap ? parseFloat(minMarketCap) : null,
      maxMarketCap: maxMarketCap ? parseFloat(maxMarketCap) : null,
      minVolMcapRatio: minVolMcapRatio ? parseFloat(minVolMcapRatio) : null,
      maxVolMcapRatio: maxVolMcapRatio ? parseFloat(maxVolMcapRatio) : null,
      autoSellEnabled,
      takeProfitPercent: takeProfitPercent ? parseFloat(takeProfitPercent) : null,
      stopLossPercent: stopLossPercent ? parseFloat(stopLossPercent) : null,
    });
  };

  const sellTokenMutation = useMutation({
    mutationFn: async (holdingId: string) => {
      const res = await apiRequest("POST", `/api/holdings/${holdingId}/sell`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      toast({ title: "Token sold successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to sell token", description: error.message, variant: "destructive" });
    },
  });

  const buyTokenMutation = useMutation({
    mutationFn: async (params: { walletId: string; tokenMint: string; solAmount: number; tokenName: string; tokenSymbol: string; tokenImage: string | null }) => {
      const res = await apiRequest("POST", "/api/trade/buy", params);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ 
        title: "Token purchased", 
        description: `Bought ${data.tokenSymbol} for ${parseFloat(solAmount).toFixed(4)} SOL` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to buy token", description: error.message, variant: "destructive" });
    },
  });

  const handleQuickBuy = (token: PumpfunToken) => {
    if (selectedWallets.length === 0) {
      toast({ title: "No wallet selected", description: "Please select at least one wallet", variant: "destructive" });
      return;
    }
    
    buyTokenMutation.mutate({
      walletId: selectedWallets[0],
      tokenMint: token.mint,
      solAmount: parseFloat(solAmount) || 0.1,
      tokenName: token.name,
      tokenSymbol: token.symbol,
      tokenImage: token.image,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied`, description: text.slice(0, 20) + "..." });
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const scrollTrending = (direction: "left" | "right") => {
    if (trendingScrollRef.current) {
      const scrollAmount = 200;
      trendingScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  const getActiveTokens = () => {
    switch (activeTab) {
      case "explore":
        return [...(pumpfunData?.tokens || []), ...(trendingData?.tokens || [])].slice(0, 50);
      case "trending":
        return trendingData?.tokens || [];
      case "movers":
        return moversData?.tokens || [];
      default:
        return pumpfunData?.tokens || [];
    }
  };

  const activeHoldings = holdings?.filter(h => h.status === "holding") || [];
  const featuredTokens = trendingData?.tokens?.slice(0, 6) || [];
  const trendingTokens = moversData?.tokens?.slice(0, 8) || [];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="text-monitor-title">Monitor</h1>
            <div className="flex items-center gap-2">
              <Circle className={`h-2 w-2 ${pumpfunData?.connected ? "fill-green-500 text-green-500" : "fill-muted text-muted"}`} data-testid="status-connection-indicator" />
              <span className="text-xs text-muted-foreground" data-testid="text-connection-status">
                {pumpfunData?.connected ? "Live" : "Connecting..."}
              </span>
            </div>
            <Badge variant="outline" className="font-mono" data-testid="badge-sol-price">
              SOL ${solPrice.toFixed(2)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by mint address..."
                value={searchMint}
                onChange={(e) => setSearchMint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 w-[300px]"
                data-testid="input-search-mint"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              data-testid="button-search-token"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-toggle-settings"
            >
              <Filter className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {showSettings && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Trading Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">SOL Amount</Label>
                    <Input
                      type="number"
                      value={solAmount}
                      onChange={(e) => setSolAmount(e.target.value)}
                      className="mt-1"
                      data-testid="input-sol-amount"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min Market Cap (SOL)</Label>
                    <Input
                      type="number"
                      value={minMarketCap}
                      onChange={(e) => setMinMarketCap(e.target.value)}
                      className="mt-1"
                      placeholder="0"
                      data-testid="input-min-market-cap"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Max Market Cap (SOL)</Label>
                    <Input
                      type="number"
                      value={maxMarketCap}
                      onChange={(e) => setMaxMarketCap(e.target.value)}
                      className="mt-1"
                      placeholder="No limit"
                      data-testid="input-max-market-cap"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Select Wallet</Label>
                    <select 
                      className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
                      value={selectedWallets[0] || ""}
                      onChange={(e) => setSelectedWallets(e.target.value ? [e.target.value] : [])}
                      data-testid="select-wallet"
                    >
                      <option value="">Select wallet...</option>
                      {wallets?.filter(w => !w.isArchived).map(wallet => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.label || wallet.address.slice(0, 8)}... ({wallet.balance?.toFixed(2) || 0} SOL)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="twitter" 
                      checked={requireTwitter}
                      onCheckedChange={(checked) => setRequireTwitter(checked as boolean)}
                      data-testid="checkbox-require-twitter"
                    />
                    <Label htmlFor="twitter" className="text-xs">Require Twitter</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="telegram" 
                      checked={requireTelegram}
                      onCheckedChange={(checked) => setRequireTelegram(checked as boolean)}
                      data-testid="checkbox-require-telegram"
                    />
                    <Label htmlFor="telegram" className="text-xs">Require Telegram</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="website" 
                      checked={requireWebsite}
                      onCheckedChange={(checked) => setRequireWebsite(checked as boolean)}
                      data-testid="checkbox-require-website"
                    />
                    <Label htmlFor="website" className="text-xs">Require Website</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      id="autosell" 
                      checked={autoSellEnabled}
                      onCheckedChange={setAutoSellEnabled}
                      data-testid="switch-auto-sell"
                    />
                    <Label htmlFor="autosell" className="text-xs">Auto-Sell</Label>
                  </div>
                </div>
                
                {autoSellEnabled && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <Label className="text-xs text-green-500">Take Profit %</Label>
                      <Input
                        type="number"
                        value={takeProfitPercent}
                        onChange={(e) => setTakeProfitPercent(e.target.value)}
                        className="mt-1"
                        placeholder="e.g. 50"
                        data-testid="input-take-profit"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-red-500">Stop Loss %</Label>
                      <Input
                        type="number"
                        value={stopLossPercent}
                        onChange={(e) => setStopLossPercent(e.target.value)}
                        className="mt-1"
                        placeholder="e.g. 20"
                        data-testid="input-stop-loss"
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={handleSaveSettings} disabled={saveSettingsMutation.isPending} data-testid="button-save-settings">
                    Save Settings
                  </Button>
                  {isMonitoring ? (
                    <Button 
                      variant="destructive" 
                      onClick={() => stopMonitoringMutation.mutate()}
                      disabled={stopMonitoringMutation.isPending}
                      data-testid="button-stop-autobuy"
                    >
                      Stop Auto-Buy
                    </Button>
                  ) : (
                    <Button 
                      variant="secondary"
                      onClick={() => startMonitoringMutation.mutate()}
                      disabled={startMonitoringMutation.isPending || selectedWallets.length === 0}
                      data-testid="button-start-autobuy"
                    >
                      Start Auto-Buy
                    </Button>
                  )}
                  {isMonitoring && (
                    <Badge variant="secondary" className="animate-pulse" data-testid="badge-autobuy-active">
                      <Circle className="h-2 w-2 fill-green-500 text-green-500 mr-1" />
                      Auto-Buy Active
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeHoldings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  Active Holdings ({activeHoldings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {activeHoldings.map((holding) => {
                    const pnl = holding.currentPrice && holding.buyPrice 
                      ? ((holding.currentPrice - holding.buyPrice) / holding.buyPrice) * 100 
                      : 0;
                    return (
                      <div 
                        key={holding.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border"
                        data-testid={`holding-row-${holding.id}`}
                      >
                        <TokenImage src={holding.tokenImage} symbol={holding.tokenSymbol} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-holding-name-${holding.id}`}>{holding.tokenName}</p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-holding-buy-price-${holding.id}`}>
                            Buy: {holding.buyPrice?.toFixed(8)} SOL
                          </p>
                        </div>
                        <div className={`text-sm font-semibold ${pnl >= 0 ? "text-green-500" : "text-red-500"}`} data-testid={`text-holding-pnl-${holding.id}`}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => sellTokenMutation.mutate(holding.id)}
                          disabled={sellTokenMutation.isPending}
                          data-testid={`button-sell-holding-${holding.id}`}
                        >
                          Sell
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Featured</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  {(["5M", "1H", "6H", "24H"] as const).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={timeFilter === t ? "secondary" : "ghost"}
                      onClick={() => setTimeFilter(t)}
                      data-testid={`button-time-filter-${t.toLowerCase()}`}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="overflow-hidden">
              <div 
                className="flex gap-4 py-2 animate-marquee"
                style={{ 
                  animation: featuredTokens.length > 0 ? "marquee 30s linear infinite" : "none",
                  width: "max-content"
                }}
              >
                {featuredTokens.length > 0 ? (
                  <>
                    {featuredTokens.map((token) => (
                      <FeaturedCard 
                        key={token.mint} 
                        token={token} 
                        solPrice={solPrice}
                        onClick={() => handleTokenClick(token)}
                      />
                    ))}
                    {featuredTokens.map((token) => (
                      <FeaturedCard 
                        key={`${token.mint}-dup`} 
                        token={token} 
                        solPrice={solPrice}
                        onClick={() => handleTokenClick(token)}
                      />
                    ))}
                  </>
                ) : (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="min-w-[200px] h-[120px] rounded-xl flex-shrink-0" />
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Trending
                </h2>
                <h2 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-5 w-5" />
                  Top Movers
                </h2>
              </div>
              <Button variant="ghost" className="text-primary" data-testid="button-view-all-trending">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            
            <div className="relative">
              <div 
                ref={trendingScrollRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide py-2"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {trendingTokens.length > 0 ? (
                  trendingTokens.map((token) => (
                    <TrendingCard 
                      key={token.mint} 
                      token={token} 
                      solPrice={solPrice}
                      onClick={() => handleTokenClick(token)}
                    />
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="min-w-[180px] h-[140px] rounded-xl flex-shrink-0" />
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {[
                  { id: "explore", label: "Explore", icon: Globe },
                  { id: "newest", label: "Newest", icon: Sparkles },
                  { id: "trending", label: "Last Traded", icon: Clock },
                  { id: "movers", label: "Top", icon: TrendingUp },
                ].map((tab) => (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    data-testid={`tab-${tab.id}`}
                  >
                    <tab.icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </Button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="migratedOnly"
                  checked={migratedOnly}
                  onCheckedChange={setMigratedOnly}
                  data-testid="switch-migrated-only"
                />
                <Label htmlFor="migratedOnly" className="text-sm flex items-center gap-1">
                  <Sparkles className="h-4 w-4" />
                  Migrated Only
                </Label>
              </div>
            </div>
            
            <div className="space-y-3">
              {isLoadingTokens ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))
              ) : getActiveTokens().length > 0 ? (
                getActiveTokens().map((token) => (
                  <TokenListItem
                    key={token.mint}
                    token={token}
                    solPrice={solPrice}
                    onClick={() => handleTokenClick(token)}
                    onBuy={() => handleQuickBuy(token)}
                    isBuying={buyTokenMutation.isPending}
                    canBuy={selectedWallets.length > 0}
                    formatTimeAgo={formatTimeAgo}
                    copyToClipboard={copyToClipboard}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Zap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No tokens yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Tokens will appear here in real-time</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <Dialog open={chartDialogOpen} onOpenChange={handleChartDialogClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedToken?.image ? (
                <img src={selectedToken.image} alt={selectedToken.symbol} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {selectedToken?.symbol.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <span className="block">{selectedToken?.name}</span>
                <Badge variant="outline">{selectedToken?.symbol}</Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              Token details and quick actions
            </DialogDescription>
          </DialogHeader>
          
          {selectedToken && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Market Cap</p>
                  <p className="font-semibold">
                    {selectedToken.marketCapSol ? formatMarketCap(selectedToken.marketCapSol, solPrice) : "N/A"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">24h Volume</p>
                  <p className="font-semibold">
                    {selectedToken.volume ? formatVolume(selectedToken.volume) : "N/A"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Price Change</p>
                  <p className={`font-semibold ${(selectedToken.priceChange || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {(selectedToken.priceChange || 0) >= 0 ? "+" : ""}{(selectedToken.priceChange || 0).toFixed(2)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Trades</p>
                  <p className="font-semibold">{selectedToken.tradeCount || "N/A"}</p>
                </div>
              </div>
              
              <div className="rounded-lg border border-border overflow-hidden" data-testid="chart-container">
                <PriceChart tokenMint={selectedToken.mint} height={350} />
              </div>
              
              {selectedToken.description && (
                <p className="text-sm text-muted-foreground">{selectedToken.description}</p>
              )}
              
              <div className="flex items-center gap-3 flex-wrap">
                {selectedToken.twitter && (
                  <a
                    href={selectedToken.twitter.startsWith('http') ? selectedToken.twitter : `https://twitter.com/${selectedToken.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <SiX className="h-4 w-4 mr-2" />
                      Twitter
                    </Button>
                  </a>
                )}
                {selectedToken.telegram && (
                  <a
                    href={selectedToken.telegram.startsWith('http') ? selectedToken.telegram : `https://t.me/${selectedToken.telegram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <SiTelegram className="h-4 w-4 mr-2" />
                      Telegram
                    </Button>
                  </a>
                )}
                {selectedToken.website && (
                  <a
                    href={selectedToken.website.startsWith('http') ? selectedToken.website : `https://${selectedToken.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Globe className="h-4 w-4 mr-2" />
                      Website
                    </Button>
                  </a>
                )}
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(selectedToken.mint, "Token address")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Address
                </Button>
                <a
                  href={`https://pump.fun/coin/${selectedToken.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full">
                    Open on Pump.fun
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search Result
            </DialogTitle>
            <DialogDescription>
              Token information from {searchResult?.source === "dexscreener" ? "DexScreener" : "Pump.fun"}
            </DialogDescription>
          </DialogHeader>
          
          {searchResult?.token && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {searchResult.token.image ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-primary/10">
                    <img 
                      src={searchResult.token.image} 
                      alt={searchResult.token.symbol}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {searchResult.token.symbol.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{searchResult.token.name}</h3>
                  <Badge variant="outline" size="sm">{searchResult.token.symbol}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="text-sm font-mono font-medium">
                    ${searchResult.token.priceUsd?.toFixed(8) || "N/A"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">24h Change</p>
                  <p className={`text-sm font-mono font-medium ${(searchResult.token.priceChange24h || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {searchResult.token.priceChange24h ? `${searchResult.token.priceChange24h > 0 ? "+" : ""}${searchResult.token.priceChange24h.toFixed(2)}%` : "N/A"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Market Cap</p>
                  <p className="text-sm font-mono font-medium">
                    ${searchResult.token.marketCap?.toLocaleString() || "N/A"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Liquidity</p>
                  <p className="text-sm font-mono font-medium">
                    ${searchResult.token.liquidity?.toLocaleString() || "N/A"}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <p className="text-xs text-muted-foreground">Bonding Curve</p>
                  <Badge variant={searchResult.token.complete ? "secondary" : "outline"} size="sm">
                    {searchResult.token.complete ? "Graduated" : `${searchResult.token.bondingCurveProgress?.toFixed(1)}%`}
                  </Badge>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all" 
                    style={{ width: `${searchResult.token.bondingCurveProgress || 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(searchResult.token.mint, "Token address")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Address
                </Button>
                <a
                  href={`https://pump.fun/coin/${searchResult.token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full">
                    Open on Pump.fun
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
