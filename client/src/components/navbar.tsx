import { Link, useLocation } from "wouter";
import { Activity, Compass, FileText, Menu, Plus, Search, Wallet, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const primaryNav = [
  { title: "Explore", url: "/", icon: Compass },
  { title: "Create", url: "/deploy", icon: Plus },
  { title: "My Tokens", url: "/my-tokens", icon: Activity },
  { title: "Wallets", url: "/wallets", icon: Wallet },
  { title: "Monitor", url: "/monitor", icon: Activity },
];

export function Navbar() {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mint, setMint] = useState("");
  const submitMint = () => {
    const value = mint.trim();
    if (!value) return;
    setLocation(`/?mint=${encodeURIComponent(value)}`);
    window.dispatchEvent(new CustomEvent("kiara:mint-search", { detail: value }));
    setMint("");
  };
  const active = (url: string) => url === "/" ? location === "/" : location === url || location.startsWith(`${url}/`);

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="page-frame flex min-h-[64px] items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="KiaraFun home">
            <img src="/kiara.png" alt="Kiara, KiaraFun character" className="brand-mark h-9 w-9 rounded-full object-cover object-top" />
            <span className="font-display text-[17px] font-semibold tracking-[-.055em]">Kiara<span className="text-primary">Fun</span></span>
          </Link>
          <nav className="hidden xl:flex items-center gap-0.5" aria-label="Main navigation">
            {primaryNav.map((item) => (
              <Link key={item.title} href={item.url} className={cn(
                "rounded-md px-2.5 py-2 text-[13px] font-semibold transition-colors",
                active(item.url) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>{item.title}</Link>
            ))}
            <Link href="/docs" className={cn("rounded-md px-2.5 py-2 text-[13px] font-semibold transition-colors", active("/docs") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>Docs</Link>
          </nav>
          <div className="hidden lg:flex min-w-[190px] max-w-[260px] flex-1 items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search by token mint address" placeholder="Paste a token mint…" value={mint} onChange={(e) => setMint(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitMint()} className="h-9 pl-9 pr-12 text-xs" />
            <button type="button" onClick={submitMint} className="absolute right-2 rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:text-primary" aria-label="Search token">Enter</button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <div className="hidden sm:block"><WalletConnectButton /></div>
            <Button variant="ghost" size="icon" className="xl:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen((open) => !open)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        <div className="lg:hidden border-t border-border/70 px-4 py-2">
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search by token mint address" placeholder="Search token mint address" value={mint} onChange={(e) => setMint(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitMint()} className="h-9 pl-9 pr-16 text-xs" />
            <button type="button" onClick={submitMint} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary">Search</button>
          </div>
        </div>
        {mobileOpen && <div className="xl:hidden border-t px-4 py-2">
          <nav className="grid grid-cols-2 gap-1">
            {[...primaryNav, { title: "Docs", url: "/docs", icon: FileText }].map((item) => (
              <Link key={item.title} href={item.url} onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium", active(item.url) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                <item.icon className="h-4 w-4" />{item.title}
              </Link>
            ))}
          </nav>
          <div className="sm:hidden mt-2"><WalletConnectButton /></div>
        </div>}
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/97 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur md:hidden" aria-label="Mobile navigation">
        {[
          { title: "Explore", url: "/", icon: Compass },
          { title: "Create", url: "/deploy", icon: Plus },
          { title: "Monitor", url: "/monitor", icon: Activity },
          { title: "Wallets", url: "/wallets", icon: Wallet },
          { title: "More", url: "/docs", icon: ChevronDown },
        ].map((item) => (
          <Link key={item.title} href={item.url} className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold", active(item.url) ? "text-primary" : "text-muted-foreground")}>
            <item.icon className="h-[18px] w-[18px]" strokeWidth={active(item.url) ? 2.4 : 1.8} />{item.title}
          </Link>
        ))}
      </nav>
    </>
  );
}
