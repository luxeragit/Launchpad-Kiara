import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpRight, CircleAlert, Plus, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TokenDeployment } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { WalletConnectButton } from "@/components/wallet-connect-button";

export default function MyTokensPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: tokens, isLoading, isError, refetch } = useQuery<TokenDeployment[]>({ queryKey: ["/api/tokens"], enabled: isAuthenticated });
  return (
    <section className="page-frame page-enter max-w-6xl space-y-7 py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-primary">Your launches</p>
          <h1 className="text-3xl font-semibold md:text-[38px]">My Tokens</h1>
          <p className="mt-2 text-sm text-muted-foreground">Deployment status and management for tokens linked to your account.</p>
        </div>
        <Link href="/deploy" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" />Create token
        </Link>
      </div>
      <div className="sky-rule" />
      {!authLoading && !isAuthenticated && <Card className="border-primary/25 bg-primary/[.035]"><CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10"><Rocket className="h-5 w-5 text-primary" /></div>
        <h2 className="font-display text-lg font-semibold">Connect to view your tokens</h2>
        <p className="max-w-sm text-sm text-muted-foreground">Your launch records are private to your signed-in wallet. Connect to load them; you can still create a launch setup now.</p>
        <WalletConnectButton />
      </CardContent></Card>}
      {(authLoading || (isAuthenticated && isLoading)) && <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[86px] w-full" />)}</div>}
      {isAuthenticated && isError && <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <CircleAlert className="h-7 w-7 text-destructive" /><p className="font-semibold">Tokens could not be loaded</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </CardContent></Card>}
      {isAuthenticated && !isLoading && !isError && tokens?.length === 0 && <Card className="surface">
        <CardContent className="flex flex-col items-center py-14 text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10"><Rocket className="h-6 w-6 text-primary" /></div>
          <h2 className="font-display text-xl font-semibold">Your launches will live here</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Start with a token identity, choose a supported launch platform, and review everything before submitting.</p>
          <Link href="/deploy" className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Create your first token</Link>
        </CardContent>
      </Card>}
      {isAuthenticated && !isLoading && !isError && !!tokens?.length && <div className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_220px_150px_24px] gap-4 border-b bg-muted/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <span>Token</span><span>Mint address</span><span>Status</span><span />
        </div>
        {tokens.map((token) => <Link key={token.id} href={`/deploy/${token.id}`} className="flex min-w-0 items-center gap-3 border-b px-4 py-4 last:border-0 hover:bg-muted/30 md:grid md:grid-cols-[minmax(0,1fr)_220px_150px_24px] md:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="max-w-full truncate font-semibold">{token.name}</span><Badge variant="secondary" className="font-mono text-[10px]">{token.symbol}</Badge></div>
            <code className="mt-1 block max-w-full truncate text-[11px] text-muted-foreground md:hidden">{token.tokenAddress || "Mint pending"}</code>
          </div>
          <code className="hidden min-w-0 truncate text-[11px] text-muted-foreground md:block">{token.tokenAddress || "Pending mint"}</code>
          <Badge variant={token.status === "deployed" ? "default" : "outline"} className="shrink-0">{token.status}</Badge>
          <ArrowUpRight className="hidden h-4 w-4 text-muted-foreground md:block" />
        </Link>)}
      </div>}
    </section>
  );
}
