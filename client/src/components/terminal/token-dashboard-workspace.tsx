import { useState } from "react";
import type { FeeActivity, TokenDeployment, TokenHolding, Wallet as WalletType } from "@shared/schema";
import { PriceChart } from "@/components/price-chart";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Activity, AlertTriangle, ArrowLeft, Check, Shield, Trash2, Wallet, Zap } from "lucide-react";

type Analytics = {
  name: string; symbol: string; price: number; priceChange1h: number; priceChange24h: number;
  marketCap: number; liquidity: number; volume24h: number; holders: number; transactions: number;
  bondingCurveProgress: number; bondingCurveTarget: number;
};
type Safety = { totalScore: number; checks: { name: string; passed: boolean; value: string; weight: number }[] };
type Fees = {
  deployment: { totalFeesCollected: number; totalFeesDistributed: number; totalBurned: number; autoClaimEnabled: boolean };
  activities: FeeActivity[];
};
type LPInfo = { lpMint: string | null; lpBalance: number; lpDecimals: number; poolId: string | null; tokenReserve: number; quoteReserve: number; error?: string } | undefined;

interface Props {
  deployment: TokenDeployment; analytics?: Analytics; analyticsLoading: boolean; safety?: Safety; safetyLoading: boolean;
  fees?: Fees; feeLoading: boolean; feeError: boolean; holdings?: TokenHolding[]; wallets?: WalletType[];
  lpInfo: LPInfo; lpLoading: boolean; transactionsEnabled: boolean; networkReason?: string;
  onBack: () => void; onRefreshFees: () => void; onBuy: () => void; onSell: (walletId: string) => void;
  onAllocation: (values: { burnPercent: number; ammPercent: number; creatorPercent: number; liquidityPercent: number }) => void;
  onClaim: () => void; onAutoClaim: (enabled: boolean) => void; onBurnLp: () => void; onDelete: () => void;
  onOpenClaim: () => void;
  onDistribute: () => void; distributionPending: boolean; distributionAmount: string; setDistributionAmount: (amount: string) => void;
  buyPending: boolean; sellPending: boolean; allocationPending: boolean; claimPending: boolean; autoClaimPending: boolean;
  burnPending: boolean; deletePending: boolean;
  selectedWalletId: string; setSelectedWalletId: (id: string) => void; buyAmount: string; setBuyAmount: (v: string) => void;
  sellPercent: number; setSellPercent: (v: number) => void; allocations: { burn: number; amm: number; creator: number; liquidity: number };
  setAllocations: (updater: (old: { burn: number; amm: number; creator: number; liquidity: number }) => { burn: number; amm: number; creator: number; liquidity: number }) => void;
  selectedLpWalletId: string; setSelectedLpWalletId: (id: string) => void; lpBurnAmount: string; setLpBurnAmount: (v: string) => void;
}

const tabs = ["Overview", "Holdings", "Safety", "Fees", "Liquidity", "Activity"] as const;
type Tab = typeof tabs[number];
const fmt = (n: number, d = 2) => n >= 1e9 ? `${(n / 1e9).toFixed(d)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(d)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(d)}K` : n.toFixed(d);

export function TokenDashboardWorkspace(p: Props) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [distributionConfirmOpen, setDistributionConfirmOpen] = useState(false);
  const [sellWallet, setSellWallet] = useState("");
  const total = p.allocations.burn + p.allocations.amm + p.allocations.creator + p.allocations.liquidity;
  const address = p.deployment.tokenAddress || "";
  const activeWallets = p.wallets?.filter(w => w.isActive) || [];
  const metric = (label: string, value: string) => <div className="min-w-0 border-r border-border px-3 last:border-0"><div className="text-[10px] text-muted-foreground">{label}</div><div className="truncate font-mono text-[12px] tabular-nums">{value}</div></div>;

  return <main className="terminal-workspace flex min-h-0 flex-col" data-testid="token-dashboard-workspace">
    <header className="flex min-h-12 flex-wrap items-center gap-3 border-b border-border px-3 py-2">
      <Button variant="ghost" size="icon" onClick={p.onBack} data-testid="button-back"><ArrowLeft className="h-4 w-4" /></Button>
      {p.deployment.logoUrl ? <img src={p.deployment.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full border border-border font-mono text-xs">{p.deployment.symbol.slice(0, 2)}</div>}
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{p.deployment.name}</strong><Badge variant="outline" className="font-mono">{p.deployment.symbol}</Badge><Badge variant="secondary">{p.deployment.status}</Badge></div><div className="max-w-[440px] truncate font-mono text-[10px] text-muted-foreground">{address || "No mint address recorded"}</div></div>
      <div className="ml-auto flex items-center gap-2 text-[10px]"><span className={`h-1.5 w-1.5 rounded-full ${p.transactionsEnabled ? "bg-emerald-400" : "bg-rose-400"}`} />{p.transactionsEnabled ? "Execution ready" : "Transactions paused"}</div>
      <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Delete launch record" data-testid="button-delete-token"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this launch record?</AlertDialogTitle><AlertDialogDescription>This deletes the saved deployment record for {p.deployment.name}. It does not reverse on-chain activity.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={p.onDelete} disabled={p.deletePending} className="bg-destructive text-destructive-foreground">Delete record</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </header>
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="order-last flex min-h-0 min-w-0 flex-col xl:order-first">
        <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
          {metric("PRICE", p.analytics ? `$${p.analytics.price.toFixed(8)}` : "—")}
          {metric("24H", p.analytics ? `${p.analytics.priceChange24h >= 0 ? "+" : ""}${p.analytics.priceChange24h.toFixed(2)}%` : "—")}
          {metric("MARKET CAP", p.analytics ? `$${fmt(p.analytics.marketCap)}` : "—")}
          {metric("LIQUIDITY", p.analytics ? `${fmt(p.analytics.liquidity)} SOL` : "—")}
        </div>
        <TerminalPanel title="Price history · live source" className="min-h-[280px] flex-1 border-0">
          {address ? <PriceChart tokenMint={address} height={320} /> : <div className="flex h-full min-h-[250px] items-center justify-center text-xs text-muted-foreground">Price history requires a confirmed token mint.</div>}
        </TerminalPanel>
        {p.analytics && <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4">{metric("24H VOLUME", `$${fmt(p.analytics.volume24h)}`)}{metric("HOLDERS", fmt(p.analytics.holders, 0))}{metric("TRANSACTIONS", fmt(p.analytics.transactions, 0))}{metric("CURVE", `${p.analytics.bondingCurveProgress.toFixed(1)}%`)}</div>}
        <div className="flex shrink-0 overflow-x-auto border-b border-border" role="tablist" aria-label="Token operations" data-testid="operations-tabs">
          {tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-[11px] ${tab === t ? "border-sky-400 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
        </div>
        <div className="terminal-scroll min-h-0 flex-1 p-3">
          {tab === "Overview" && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{metric("1H CHANGE", p.analytics ? `${p.analytics.priceChange1h.toFixed(2)}%` : "—")}{metric("CURVE TARGET", p.analytics ? `$${fmt(p.analytics.bondingCurveTarget)}` : "—")}{metric("PLATFORM", p.deployment.platform || "—")}{metric("RECORD STATUS", p.deployment.status || "—")}</div>
            {p.analyticsLoading && <div className="h-12 animate-pulse bg-secondary/50" />}
            {!p.analytics && !p.analyticsLoading && <div className="flex items-center gap-3 border border-border p-4 text-xs text-muted-foreground"><img src="/kiara.png" alt="" className="h-12 w-12 object-contain" /><span>Analytics are not available from the current market source. No price history is inferred.</span></div>}
            {!address && <p className="border-l-2 border-amber-400 px-3 py-2 text-[10px] text-amber-200">This launch has no confirmed mint address. Chart, order execution, safety checks, and on-chain operations are unavailable; all six operational tabs remain accessible.</p>}
            <p className="text-[11px] leading-5 text-muted-foreground">{p.deployment.description || "No token description provided."}</p>
            {p.deployment.platform !== "pumpfun" && <p className="border-l-2 border-amber-400 px-3 py-2 text-[11px] text-amber-200">This {p.deployment.platform} record is configuration-only; live launch is not implemented.</p>}
          </div>}
          {tab === "Holdings" && <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2"><div className="min-w-40 flex-1"><Label className="text-[10px]">Sell from wallet</Label><Select value={sellWallet} onValueChange={setSellWallet}><SelectTrigger data-testid="select-sell-wallet"><SelectValue placeholder="Select wallet holding" /></SelectTrigger><SelectContent>{(p.holdings || []).filter(h => !!h.walletId).map(h => <SelectItem key={h.id} value={h.walletId!}>{p.wallets?.find(w => w.id === h.walletId)?.label || h.walletId?.slice(0, 8) || "Wallet unavailable"} · {fmt(h.tokenQuantity || 0, 4)}</SelectItem>)}</SelectContent></Select></div><div className="flex gap-1">{[25, 50, 75, 100].map(v => <Button key={v} size="sm" variant={p.sellPercent === v ? "default" : "outline"} onClick={() => p.setSellPercent(v)}>{v}%</Button>)}</div></div>
            {(p.holdings || []).length ? p.holdings!.map(h => <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-xs"><div><div className="font-mono">{fmt(h.tokenQuantity || 0, 4)} {p.deployment.symbol}</div><div className="text-muted-foreground">{p.wallets?.find(w => w.id === h.walletId)?.label || "Wallet"} · cost {h.buyAmount?.toFixed(4) ?? "—"} SOL</div></div><Button size="sm" variant="outline" disabled={!p.transactionsEnabled || !address || !h.walletId || p.sellPending} onClick={() => p.onSell(h.walletId!)} data-testid={`button-sell-${h.id}`}>Sell {p.sellPercent}%</Button></div>) : <Empty text={!address ? "Holdings are unavailable until this record has a confirmed mint." : "No recorded holdings for this token."} />}
          </div>}
          {tab === "Safety" && <div className="space-y-3">
            {p.safetyLoading ? <div className="h-20 animate-pulse bg-secondary/50" /> : p.safety ? <><div className="flex items-center gap-3 border-b border-border pb-3"><Shield className="h-5 w-5 text-sky-400" /><strong className="font-mono text-xl">{p.safety.totalScore}/100</strong><span className="text-xs text-muted-foreground">Safety checks · provider report</span></div>{p.safety.checks.map((c, i) => <div key={`${c.name}-${i}`} className="flex items-center justify-between border-b border-border py-2 text-xs"><span className="flex items-center gap-2">{c.passed ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />}{c.name}</span><span className="font-mono text-muted-foreground">{c.value}</span></div>)}</> : <Empty text={!address ? "Safety checks require a confirmed token mint." : "Safety report unavailable."} /> }
          </div>}
          {tab === "Fees" && <div className="space-y-4">
            {p.fees ? <div className="grid grid-cols-3 gap-2 text-xs">{metric("COLLECTED", fmt(p.fees.deployment.totalFeesCollected))}{metric("DISTRIBUTED", fmt(p.fees.deployment.totalFeesDistributed))}{metric("BURNED", fmt(p.fees.deployment.totalBurned))}</div> : <Empty text={p.feeError ? "Fee data unavailable; this is not a zero balance." : "Fee information has not loaded."} retry={p.feeError ? p.onRefreshFees : undefined} />}
            <div className="border-t border-border pt-3"><div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-medium">Auto-claim availability monitoring</div><p className="text-[10px] text-muted-foreground">Monitoring only; claims are completed externally.</p></div><Switch checked={p.fees?.deployment.autoClaimEnabled || false} onCheckedChange={p.onAutoClaim} disabled={!address || !p.fees || p.autoClaimPending || (!p.transactionsEnabled && !p.fees?.deployment.autoClaimEnabled)} data-testid="switch-autoclaim" /></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={p.onOpenClaim} disabled={!p.transactionsEnabled || !address} data-testid="button-claim-fees-pumpfun"><Zap className="mr-2 h-3.5 w-3.5" />Open Pump.fun claim</Button><Button variant="ghost" size="sm" onClick={p.onClaim} disabled={!p.transactionsEnabled || p.claimPending || !address}>Check claim status</Button></div><p className="mt-2 text-[10px] text-muted-foreground">KiaraFun does not execute creator-fee claims.</p></div>
            <div className="border-t border-border pt-3"><div className="mb-2 flex justify-between text-xs"><strong>Fee allocation</strong><span className={total === 100 ? "text-emerald-400" : "text-rose-400"}>{total}% / 100%</span></div><p className="mb-3 text-[10px] text-muted-foreground">Burn executes on-chain. AMM and liquidity allocations are tracked for manual execution.</p>
              {(["burn", "amm", "creator", "liquidity"] as const).map(k => <div key={k} className="mb-3 grid grid-cols-[72px_1fr_36px] items-center gap-2 text-[11px]"><Label className="capitalize">{k}</Label><Slider value={[p.allocations[k]]} min={0} max={100} step={1} onValueChange={([v]) => p.setAllocations(old => ({ ...old, [k]: v }))} data-testid={`slider-${k}`} /><span className="font-mono">{p.allocations[k]}%</span></div>)}
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => p.onAllocation({ burnPercent: p.allocations.burn, ammPercent: p.allocations.amm, creatorPercent: p.allocations.creator, liquidityPercent: p.allocations.liquidity })} disabled={total !== 100 || p.allocationPending} data-testid="button-save-allocation">Save allocation</Button>
              <AlertDialog open={distributionConfirmOpen} onOpenChange={setDistributionConfirmOpen}><AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={!p.transactionsEnabled || !address} data-testid="button-distribute-fees">Distribute fees…</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm fee distribution</AlertDialogTitle><AlertDialogDescription>This submits the existing distribution operation for the exact token amount below. The configured burn share can execute on-chain; AMM and liquidity shares are not automatically routed and may remain manual.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Label htmlFor="fee-distribution-amount">Token amount</Label><Input id="fee-distribution-amount" type="number" min="0" step="any" value={p.distributionAmount} onChange={e => p.setDistributionAmount(e.target.value)} placeholder="Enter amount" data-testid="input-distribution-amount" /><p className="text-[10px] text-muted-foreground">No amount is prefilled from collected totals; enter only an amount you intend to distribute.</p></div><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { p.onDistribute(); setDistributionConfirmOpen(false); }} disabled={!p.transactionsEnabled || p.distributionPending || !Number.isFinite(Number(p.distributionAmount)) || Number(p.distributionAmount) <= 0} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-distribute-fees">{p.distributionPending ? "Submitting…" : "Confirm distribution"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
              {!address && <p className="text-[10px] text-amber-300">Distribution is unavailable until a token mint is confirmed.</p>}
              {address && !p.transactionsEnabled && <p className="text-[10px] text-rose-300">{p.networkReason || "Distribution disabled by network safety gate."}</p>}
            </div>
          </div>}
          {tab === "Liquidity" && <div className="max-w-xl space-y-3">
            <div><Label className="text-[10px]">Wallet for LP inspection</Label><Select value={p.selectedLpWalletId} onValueChange={p.setSelectedLpWalletId} disabled={!address}><SelectTrigger data-testid="select-lp-wallet-trigger"><SelectValue placeholder="Select wallet" /></SelectTrigger><SelectContent>{activeWallets.map(w => <SelectItem key={w.id} value={w.id}>{w.label} · {w.balance == null ? "balance unavailable" : `${w.balance.toFixed(4)} SOL`}</SelectItem>)}</SelectContent></Select></div>
            {!address && <Empty text="LP information and burn actions require a confirmed token mint." />}
            {address && p.lpLoading ? <div className="h-12 animate-pulse bg-secondary/50" /> : address && p.lpInfo?.lpMint ? <><div className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs">{metric("LP TOKEN BALANCE", p.lpInfo.lpBalance.toFixed(6))}{metric("POOL ID", p.lpInfo.poolId || "—")}{metric("TOKEN RESERVE", fmt(p.lpInfo.tokenReserve, 4))}{metric("QUOTE RESERVE", fmt(p.lpInfo.quoteReserve, 4))}</div>{p.lpInfo.lpBalance > 0 && <div className="space-y-2 border border-rose-500/30 p-3"><div className="text-xs text-rose-300">LP burn is irreversible and removes liquidity.</div><div className="flex gap-2"><Input type="number" value={p.lpBurnAmount} onChange={e => p.setLpBurnAmount(e.target.value)} placeholder="Amount" data-testid="input-lp-burn-amount" /><Button size="sm" variant="outline" onClick={() => p.setLpBurnAmount(String(p.lpInfo?.lpBalance || 0))}>Max</Button></div><AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={!p.transactionsEnabled || p.burnPending || Number(p.lpBurnAmount) <= 0 || Number(p.lpBurnAmount) > p.lpInfo.lpBalance} data-testid="button-burn-lp">Burn LP</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm irreversible LP burn</AlertDialogTitle><AlertDialogDescription>This permanently destroys {p.lpBurnAmount} LP tokens and removes their underlying liquidity. Transactions remain subject to network safety.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-testid="button-burn-lp-cancel">Cancel</AlertDialogCancel><AlertDialogAction onClick={p.onBurnLp} disabled={!p.transactionsEnabled || p.burnPending} className="bg-destructive text-destructive-foreground" data-testid="button-burn-lp-confirm">Burn permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>}</> : address && <Empty text={p.lpInfo?.error || "No Raydium LP pool found for this wallet."} />}
          </div>}
          {tab === "Activity" && <div>{p.feeLoading ? <div className="h-12 animate-pulse bg-secondary/50" /> : p.fees?.activities.length ? p.fees.activities.map((a, i) => <div key={a.id || i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-xs"><span className="flex items-center gap-2"><Badge variant="outline">{a.activityType}</Badge><span className="font-mono">{fmt(a.amount)} tokens</span>{a.txSignature && <span className="text-emerald-400">confirmed record</span>}</span><time className="text-muted-foreground">{a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}</time></div>) : <Empty text="No recorded fee activity." />}</div>}
        </div>
      </section>
      <TerminalPanel title="Order entry" testId="order-entry" className="order-first min-h-0 border-l-0 xl:order-last xl:border-l">
        <div className="terminal-scroll space-y-4 p-3">
          <div className="flex gap-2"><span className={`h-1.5 w-1.5 rounded-full ${p.transactionsEnabled ? "mt-1.5 bg-emerald-400" : "mt-1.5 bg-rose-400"}`} /><p className="text-[10px] leading-4 text-muted-foreground">{!address ? "Execution disabled: this record does not have a confirmed token mint." : p.transactionsEnabled ? "Network authorization is available." : p.networkReason || "Financial execution is paused until network safety is verified."}</p></div>
          <div><Label className="text-[10px]">Managed wallet</Label><Select value={p.selectedWalletId} onValueChange={p.setSelectedWalletId}><SelectTrigger data-testid="select-wallet-buy"><SelectValue placeholder="Choose wallet" /></SelectTrigger><SelectContent>{activeWallets.map(w => <SelectItem key={w.id} value={w.id}>{w.label} · {w.balance == null ? "—" : `${w.balance.toFixed(4)} SOL`}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-[10px]">Buy amount · SOL</Label><Input type="number" min="0.001" step="0.01" value={p.buyAmount} onChange={e => p.setBuyAmount(e.target.value)} data-testid="input-buy-amount" /></div>
          <div className="grid grid-cols-4 gap-1">{[0.1, 0.5, 1, 2].map(v => <Button key={v} size="sm" variant="outline" className="px-1 text-[10px]" onClick={() => p.setBuyAmount(String(v))} data-testid={`button-buy-preset-${v}`}>{v}</Button>)}</div>
          <Button className="w-full" onClick={p.onBuy} disabled={!p.transactionsEnabled || !p.selectedWalletId || !address || p.buyPending} data-testid="button-quick-buy">{p.buyPending ? "Submitting…" : `Buy ${p.deployment.symbol}`}</Button>
          <div className="border-t border-border pt-4"><div className="mb-2 text-xs font-semibold">Sell position</div><div className="mb-2 flex gap-1">{[25, 50, 75, 100].map(v => <Button key={v} size="sm" variant="outline" className="flex-1 px-1 text-[10px]" onClick={() => p.setSellPercent(v)}>{v}%</Button>)}</div><div className="mb-2 text-right font-mono text-xs">{p.sellPercent}%</div><Select value={sellWallet} onValueChange={setSellWallet}><SelectTrigger><SelectValue placeholder="Choose holding wallet" /></SelectTrigger><SelectContent>{(p.holdings || []).map(h => <SelectItem key={h.id} value={h.walletId || ""}>{p.wallets?.find(w => w.id === h.walletId)?.label || h.walletId?.slice(0, 8) || "Unknown"}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="mt-2 w-full" onClick={() => sellWallet && p.onSell(sellWallet)} disabled={!p.transactionsEnabled || !address || !sellWallet || p.sellPending}>Sell {p.sellPercent}%</Button></div>
          {!activeWallets.length && <p className="border-t border-border pt-3 text-[10px] text-muted-foreground"><Wallet className="mr-1 inline h-3 w-3" />No active managed wallet available.</p>}
        </div>
      </TerminalPanel>
    </div>
  </main>;
}

function Empty({ text, retry }: { text: string; retry?: () => void }) {
  return <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground"><Activity className="h-5 w-5 opacity-50" />{text}{retry && <Button size="sm" variant="outline" onClick={retry}>Retry fee data</Button>}</div>;
}
