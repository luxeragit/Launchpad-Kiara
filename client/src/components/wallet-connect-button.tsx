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

export function WalletConnectButton() {
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
          <Button variant="outline" data-testid="button-wallet-connected">
            <Wallet className="w-4 h-4 mr-2" />
            {truncateAddress(user.walletAddress)}
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
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="default"
        onClick={() => connectWallet()}
        data-testid="button-connect-wallet"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
      {error && (
        <span className="text-xs text-destructive" data-testid="text-wallet-error">
          {error}
        </span>
      )}
    </div>
  );
}
