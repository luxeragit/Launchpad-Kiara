import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, LogOut, Loader2 } from "lucide-react";

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletConnectButton({ compact = false }: { compact?: boolean }) {
  const { user, isLoading, isAuthenticated, connectWallet, disconnect, error } = useAuth();

  if (isLoading) {
    return (
      <Button variant="outline" disabled data-testid="button-wallet-loading">
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="button-wallet-connected" aria-label={`Connected wallet ${truncateAddress(user.walletAddress)}`}>
            <span className="relative"><Wallet className={`w-4 h-4 ${compact ? "sm:mr-2" : "mr-2"}`} />
              {compact && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 sm:hidden" />}
            </span>
            <span className={compact ? "hidden sm:inline" : undefined}>{truncateAddress(user.walletAddress)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => disconnect()}
            data-testid="button-disconnect-wallet"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        variant="default"
        onClick={() => connectWallet()}
        data-testid="button-connect-wallet"
        aria-label="Connect wallet"
      >
        <Wallet className={`w-4 h-4 ${compact ? "sm:mr-2" : "mr-2"}`} />
        <span className={compact ? "hidden sm:inline" : undefined}>Connect Wallet</span>
      </Button>
      {error && (
        <span className="text-xs text-destructive" data-testid="text-wallet-error">
          {error}
        </span>
      )}
    </div>
  );
}
