import { useQuery } from "@tanstack/react-query";
import type { TokenHolding, Transaction } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface WalletRecordsProps {
  walletId: string;
  isAuthenticated: boolean;
}

function stamp(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function WalletRecords({ walletId, isAuthenticated }: WalletRecordsProps) {
  const holdingsQuery = useQuery<TokenHolding[]>({
    queryKey: ["/api/holdings", walletId],
    queryFn: async () => (await apiRequest("GET", "/api/holdings")).json(),
    enabled: isAuthenticated && !!walletId,
  });
  const transactionsQuery = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", walletId],
    queryFn: async () => (await apiRequest("GET", `/api/transactions?walletId=${encodeURIComponent(walletId)}`)).json(),
    enabled: isAuthenticated && !!walletId,
  });

  const holdings = holdingsQuery.data?.filter(holding => holding.walletId === walletId);
  const transactions = transactionsQuery.data;

  return <div className="space-y-4 py-3">
    <section aria-labelledby="wallet-holdings-title">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 id="wallet-holdings-title" className="text-[11px] font-medium">Tracked token positions</h3>
          <p className="text-[9px] text-muted-foreground">Application records, not a complete on-chain SPL balance scan.</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Refresh wallet holdings" onClick={() => holdingsQuery.refetch()} disabled={holdingsQuery.isFetching || !isAuthenticated}>
          <RefreshCw className={`h-3 w-3 ${holdingsQuery.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {holdingsQuery.isLoading ? <div className="space-y-1.5" aria-label="Loading token holdings">{[1, 2].map(row => <div key={row} className="h-10 animate-pulse bg-secondary/50" />)}</div>
        : holdingsQuery.isError ? <div className="border border-border p-2 text-[10px] text-muted-foreground"><p>Tracked holdings could not be loaded.</p><Button size="sm" variant="ghost" className="mt-1 h-6 px-1 text-[10px]" onClick={() => holdingsQuery.refetch()}>Retry holdings</Button></div>
        : holdings?.length ? holdings.map(holding => <div key={holding.id} className="border-b border-border py-2">
          <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-medium">{holding.tokenName} <span className="font-mono text-muted-foreground">{holding.tokenSymbol}</span></span><span className="text-[9px] text-muted-foreground">{holding.status || "recorded"}</span></div>
          <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-[10px]"><span className="font-mono">{holding.tokenQuantity == null ? "Quantity unavailable" : `${holding.tokenQuantity.toLocaleString()} ${holding.tokenSymbol}`}</span><span className="font-mono text-muted-foreground">Cost {holding.buyAmount.toFixed(4)} SOL</span></div>
          <div className="mt-1 text-[9px] text-muted-foreground">Recorded {stamp(holding.createdAt)}</div>
        </div>)
        : <p className="border-l border-border py-1 pl-2 text-[10px] text-muted-foreground">No tracked position records for this wallet.</p>}
    </section>

    <section aria-labelledby="wallet-activity-title" className="border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 id="wallet-activity-title" className="text-[11px] font-medium">Transaction history</h3>
          <p className="text-[9px] text-muted-foreground">Recorded wallet transactions</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Refresh transaction history" onClick={() => transactionsQuery.refetch()} disabled={transactionsQuery.isFetching || !isAuthenticated}>
          <RefreshCw className={`h-3 w-3 ${transactionsQuery.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {transactionsQuery.isLoading ? <div className="space-y-1.5" aria-label="Loading transaction history">{[1, 2].map(row => <div key={row} className="h-10 animate-pulse bg-secondary/50" />)}</div>
        : transactionsQuery.isError ? <div className="border border-border p-2 text-[10px] text-muted-foreground"><p>Transaction history could not be loaded.</p><Button size="sm" variant="ghost" className="mt-1 h-6 px-1 text-[10px]" onClick={() => transactionsQuery.refetch()}>Retry history</Button></div>
        : transactions?.length ? transactions.map(transaction => <div key={transaction.id} className="border-b border-border py-2">
          <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium capitalize">{transaction.type.replaceAll("_", " ")}</span><span className="text-[9px] text-muted-foreground">{transaction.status || "status unavailable"}</span></div>
          <div className="mt-1 flex items-center justify-between gap-2"><span className="font-mono text-[10px]">{transaction.amount.toLocaleString()} SOL</span><span className="text-[9px] text-muted-foreground">{stamp(transaction.createdAt)}</span></div>
          {transaction.signature && <code className="mt-1 block truncate font-mono text-[9px] text-muted-foreground" title={transaction.signature}>{transaction.signature}</code>}
          {(transaction.toAddress || transaction.fromAddress) && <div className="mt-1 truncate font-mono text-[9px] text-muted-foreground">{transaction.fromAddress ? `From ${transaction.fromAddress}` : ""}{transaction.fromAddress && transaction.toAddress ? " · " : ""}{transaction.toAddress ? `To ${transaction.toAddress}` : ""}</div>}
        </div>)
        : <p className="border-l border-border py-1 pl-2 text-[10px] text-muted-foreground">No recorded transactions for this wallet.</p>}
    </section>
  </div>;
}
