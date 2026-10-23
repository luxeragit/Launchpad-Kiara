import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, BookOpen, Compass, Moon, Plus, Search, Sun, Wallet, Layers3, AlertTriangle, Check, ChevronDown, Pause, Play } from "lucide-react";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { SiX } from "react-icons/si";

interface MarketToken {
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  priceChange?: number;
}
interface MarketFeed { tokens?: MarketToken[]; connected?: boolean; market?: { source: string; scope: string; window: string; status: string } }

const navItems = [
  { label: "Explore", href: "/", icon: Compass },
  { label: "Create token", href: "/deploy", icon: Plus },
  { label: "My tokens", href: "/my-tokens", icon: Layers3 },
  { label: "Wallets", href: "/wallets", icon: Wallet },
  { label: "Monitor", href: "/monitor", icon: Activity },
  { label: "Documentation", href: "/docs", icon: BookOpen },
];

function NetworkControl() {
  const { data, isError, isLoading } = useNetworkStatus();
  const [open, setOpen] = useState(false);
  const ready = !!data?.transactionsEnabled && !isError;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Network status" aria-controls="network-details" aria-expanded={open} title="Network safety status" className={`flex h-8 items-center gap-1.5 rounded border px-2 text-[10px] font-semibold ${ready ? "border-emerald-900/70 text-emerald-300" : "border-amber-900/70 text-amber-300"}`}>
        {ready ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        <span className="hidden sm:inline">{isLoading ? "Checking" : ready ? "Ready" : "Paused"}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && <div id="network-details" role="region" aria-label="Network safety details" className="fixed left-3 right-3 top-[54px] z-[70] w-auto border border-border bg-popover p-3 text-xs shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-72">
        <div className="mb-2 flex items-center gap-2 font-semibold">{ready ? "Network verified" : "Financial actions paused"}</div>
        <p className="leading-relaxed text-muted-foreground">{isError ? "Network safety status is unavailable. Financial actions remain paused until verified." : data?.reason || "Network consistency has not been verified."}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2">
          <span className="text-muted-foreground">Wallet network</span><code>{data?.walletNetwork ?? "unknown"}</code>
          <span className="text-muted-foreground">Trading network</span><code>{data?.tradingNetwork ?? "unknown"}</code>
          <span className="text-muted-foreground">RPC verification</span><span>{data?.rpcVerified ? "Passed" : "Incomplete"}</span>
        </div>
      </div>}
    </div>
  );
}

function RailNetworkStatus() {
  const { data, isError, isLoading } = useNetworkStatus();
  const ready = !!data?.transactionsEnabled && !isError;
  return <span role="status" title={isLoading ? "Checking network safety" : ready ? "Network verified" : data?.reason || "Financial actions paused"} aria-label={isLoading ? "Checking network safety" : ready ? "Network verified" : "Financial actions paused"} className={`flex h-8 w-8 items-center justify-center rounded border ${ready ? "border-emerald-900/70 text-emerald-300" : "border-amber-900/70 text-amber-300"}`}>
    {ready ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
  </span>;
}

function MarketTicker() {
  const [paused, setPaused] = useState(false);
  const { data } = useQuery<MarketFeed>({ queryKey: ["/api/pumpfun/trending"], refetchInterval: 5000 });
  const { data: latestFeed } = useQuery<MarketFeed>({ queryKey: ["/api/pumpfun/tokens"], refetchInterval: 5000 });
  const tokens = (data?.tokens?.length ? data.tokens : latestFeed?.tokens ?? []).filter((t) => t.symbol).slice(0, 12);
  return <div data-testid="market-ticker" className="terminal-ticker flex min-w-0 items-center border-b border-border bg-[#0d0f14] px-3">
    <div className="mr-3 flex shrink-0 items-center gap-1.5 border-r border-border pr-3">
      <span title={data?.tokens?.length ? `${data.market?.scope ?? "Pump.fun / PumpSwap"} · ${data.market?.source ?? "DexScreener"} · ${data.market?.window ?? "5m"} price change${data.market?.status === "stale" ? " · delayed data" : ""}` : "New token events via PumpPortal"} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Market</span>
      <button type="button" data-testid="market-ticker-toggle" onClick={() => setPaused((value) => !value)} disabled={!tokens.length} aria-label={paused ? "Resume market ticker" : "Pause market ticker"} aria-pressed={paused} title={paused ? "Resume market ticker" : "Pause market ticker"} className="flex h-6 w-5 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40">
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>
    </div>
    <div className="market-ticker-viewport min-w-0 flex-1 overflow-hidden whitespace-nowrap">
      {tokens.length ? <div className="market-ticker-track" data-paused={paused}>
        {[0, 1].map((copy) => <div key={copy} className="market-ticker-group" aria-hidden={copy === 1 ? true : undefined}>
          {tokens.map((token) => <div key={token.mint} className="flex shrink-0 items-center gap-1.5 text-[10px]">
          {token.image ? <img src={token.image} alt="" className="h-4 w-4 rounded-[2px] object-cover" /> : <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80" />}
          <span className="font-semibold text-foreground">{token.symbol}</span>
          {typeof token.priceChange === "number" && <span className={token.priceChange >= 0 ? "font-mono text-emerald-400" : "font-mono text-rose-400"}>{token.priceChange >= 0 ? "+" : ""}{token.priceChange.toFixed(1)}%</span>}
          </div>)}
        </div>)}
      </div> : <span className="text-[10px] text-muted-foreground">{data?.connected === false ? "Market feed disconnected" : "Waiting for supported market feed"}</span>}
    </div>
  </div>;
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const [mint, setMint] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const active = (href: string) => href === "/" ? location === "/" || location === "/explore" : location === href || location.startsWith(`${href}/`);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const next = stored === "light" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
  }, []);

  const submitMint = () => {
    const value = mint.trim();
    if (!value) return;
    if (location !== "/" && location !== "/explore") setLocation(`/?mint=${encodeURIComponent(value)}`);
    else window.dispatchEvent(new CustomEvent("kiara:mint-search", { detail: value }));
    setMint("");
  };
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
  };

  return <>
    <aside data-testid="terminal-rail" className="terminal-rail fixed inset-y-0 left-0 z-50 flex w-14 flex-col items-center border-r border-[#252832] bg-[#090a0e] py-2">
      <Link href="/" title="KiaraFun Explore" aria-label="KiaraFun Explore" className="mb-5 block rounded-md p-1">
        <img src="/kiara.png" alt="Kiara" className="h-9 w-9 rounded-md object-cover object-top" />
      </Link>
      <nav aria-label="Main navigation" className="flex flex-1 flex-col items-center gap-1">
        {navItems.map(({ label, href, icon: Icon }) => <Link key={href} href={href} title={label} aria-label={label} className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${active(href) ? "bg-[#1b202a] text-sky-400" : "text-[#858c9a] hover:bg-[#151820] hover:text-foreground"}`}>
          {active(href) && <span className="absolute left-0 h-5 w-[2px] bg-[#32a9ff]" />}
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </Link>)}
      </nav>
      <div className="flex flex-col items-center gap-1">
        <a href="https://x.com/kiara_fun" target="_blank" rel="noopener noreferrer" title="KiaraFun on X" aria-label="KiaraFun on X (opens in a new tab)" data-testid="link-kiarafun-x-desktop" className="flex h-9 w-9 items-center justify-center rounded-md text-[#858c9a] hover:bg-[#151820] hover:text-foreground"><SiX className="h-3.5 w-3.5" /></a>
        <button type="button" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} aria-label="Toggle theme" className="flex h-9 w-9 items-center justify-center rounded-md text-[#858c9a] hover:bg-[#151820] hover:text-foreground">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
        <RailNetworkStatus />
      </div>
    </aside>
    <header data-testid="terminal-topbar" className="terminal-topbar z-40 flex min-w-0 items-center justify-between gap-3 border-b border-border bg-[#0b0d12] px-3">
      <form className="relative flex min-w-0 max-w-[420px] flex-1 items-center" onSubmit={(e) => { e.preventDefault(); submitMint(); }}>
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input value={mint} onChange={(e) => setMint(e.target.value)} aria-label="Search by token mint address" placeholder="Search token mint address…" className="h-8 w-full border border-border bg-[#101218] pl-8 pr-12 text-[12px] outline-none placeholder:text-muted-foreground focus:border-sky-500/60" />
        <button type="submit" aria-label="Search token" className="absolute right-2 text-[10px] text-muted-foreground hover:text-foreground">ENTER</button>
      </form>
      <div className="flex shrink-0 items-center gap-2">
        <NetworkControl />
        <a href="https://x.com/kiara_fun" target="_blank" rel="noopener noreferrer" title="KiaraFun on X" aria-label="KiaraFun on X (opens in a new tab)" data-testid="link-kiarafun-x-mobile" className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:bg-[#151820] hover:text-foreground sm:hidden"><SiX className="h-3 w-3" /></a>
        <button type="button" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} aria-label="Toggle theme" className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:bg-[#151820] hover:text-foreground sm:hidden">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
        <Link href="/deploy" className="hidden h-8 items-center gap-1.5 border border-border px-2.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-[#1b202a] sm:flex"><Plus className="h-3.5 w-3.5 text-sky-400" />Create</Link>
        <div className="[&_button]:h-8 [&_button]:px-2 [&_button]:text-[11px]"><WalletConnectButton compact /></div>
      </div>
    </header>
    <MarketTicker />
    <nav className="terminal-mobile-nav z-50 grid grid-cols-6 border-t border-border bg-[#090a0e] pb-[env(safe-area-inset-bottom)]" aria-label="Mobile navigation">
      {navItems.map(({ label, href, icon: Icon }) => <Link key={href} href={href} aria-label={label} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] ${active(href) ? "text-sky-400" : "text-muted-foreground"}`}>
        <Icon className="h-4 w-4" strokeWidth={1.8} /><span>{label === "Create token" ? "Create" : label === "My tokens" ? "Tokens" : label === "Documentation" ? "Docs" : label}</span>
      </Link>)}
    </nav>
  </>;
}
