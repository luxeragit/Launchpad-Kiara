import { Link, useLocation } from "wouter";
import { Activity, Rocket, Wallet, FileText, Menu, X } from "lucide-react";
import { SiTelegram, SiX, SiGithub } from "react-icons/si";
import logoPath from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    title: "Monitor",
    url: "/",
    icon: Activity,
  },
  {
    title: "Deploy",
    url: "/deploy",
    icon: Rocket,
  },
  {
    title: "Wallets",
    url: "/wallets",
    icon: Wallet,
  },
  {
    title: "Docs",
    url: "/docs",
    icon: FileText,
  },
];

const socialLinks = [
  {
    title: "Telegram",
    url: "#",
    icon: SiTelegram,
  },
  {
    title: "X",
    url: "https://x.com/pyremarket/status/2023747402084348199?s=46",
    icon: SiX,
  },
  {
    title: "Github",
    url: "https://github.com/PyreMarket/",
    icon: SiGithub,
  },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
            <img
              src={logoPath}
              alt="Pyre Market"
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-lg font-semibold tracking-tight hidden sm:inline">
              Pyre Market
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.url;
              return (
                <Link
                  key={item.title}
                  href={item.url}
                  data-testid={`link-nav-${item.title.toLowerCase()}`}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            {socialLinks.map((social) => (
              <a
                key={social.title}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-social-${social.title.toLowerCase()}`}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={social.title}
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>

          <div className="hidden sm:block">
            <WalletConnectButton />
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.url;
            return (
              <Link
                key={item.title}
                href={item.url}
                data-testid={`link-mobile-nav-${item.title.toLowerCase()}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}

          <div className="flex items-center gap-2 px-3 py-2">
            {socialLinks.map((social) => (
              <a
                key={social.title}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-mobile-social-${social.title.toLowerCase()}`}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={social.title}
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>

          <div className="px-3 py-2 sm:hidden">
            <WalletConnectButton />
          </div>
        </div>
      )}
    </nav>
  );
}
