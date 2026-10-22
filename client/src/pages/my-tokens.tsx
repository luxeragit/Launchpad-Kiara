import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpRight, CircleAlert, Plus, Rocket, Search, RefreshCw } from "lucide-react";
import type { TokenDeployment } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { TerminalPanel, TerminalEmpty } from "@/components/terminal/terminal-panel";

type StatusFilter = "all" | "deployed" | "pending" | "other";
type PlatformFilter = "all" | "pumpfun" | "bonkfun" | "meteora";
const short = (value: string | null | undefined) => value ? `${value.slice(0, 7)}…${value.slice(-6)}` : "Not assigned";
const platformName = (platform: string) => platform === "pumpfun" ? "Pump.fun" : platform === "bonkfun" ? "Bonk.fun" : platform === "meteora" ? "Meteora" : platform;

export default function MyTokensPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: tokens, isLoading, isError, refetch, isFetching } = useQuery<TokenDeployment[]>({ queryKey: ["/api/tokens"], enabled: isAuthenticated });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = useMemo(() => (tokens ?? []).filter((token) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [token.name, token.symbol, token.tokenAddress, token.platform].some((value) => value?.toLowerCase().includes(term));
    const matchesPlatform = platform === "all" || token.platform === platform;
    const matchesStatus = status === "all" || (status === "deployed" ? token.status === "deployed" : status === "pending" ? token.status === "pending" : token.status !== "deployed" && token.status !== "pending");
    return matchesSearch && matchesPlatform && matchesStatus;
  }), [tokens, search, status, platform]);
  useEffect(() => {
    if (!filtered.some((token) => token.id === selectedId)) setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);
  const selected = filtered.find((token) => token.id === selectedId) ?? null;
  const tokenState = (token: TokenDeployment) => token.platform !== "pumpfun" ? "Pending configuration" : token.status === "deployed" ? "Deployed" : token.status === "pending" ? "Pending" : token.status || "Unknown";

  return <main className="terminal-workspace min-h-0 overflow-hidden">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-[#292d36] px-3">
        <div className="flex min-w-0 items-center gap-2"><Rocket className="h-4 w-4 text-[#32a9ff]" /><h1 className="text-[13px] font-semibold">My Tokens</h1><span className="hidden text-[10px] text-muted-foreground sm:inline">{tokens?.length ?? "—"} records</span></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => refetch()} aria-label="Refresh token records" className="grid h-7 w-7 place-items-center text-muted-foreground hover:bg-[#1b202a] hover:text-foreground"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /></button><Link href="/deploy" className="inline-flex h-7 items-center gap-1.5 bg-[#32a9ff] px-2.5 text-[10px] font-semibold text-[#07111a] hover:opacity-90"><Plus className="h-3 w-3" />Create token</Link></div>
      </header>
      {!authLoading && !isAuthenticated && <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
        <div className="grid h-9 w-9 place-items-center border border-[#292d36] text-[#32a9ff]"><Rocket className="h-4 w-4" /></div><h2 className="text-[13px] font-semibold">Connect to load launch records</h2><p className="max-w-sm text-[11px] text-muted-foreground">Token records are private to the authenticated session. Use the toolbar wallet control to connect.</p>
      </div>}
      {(authLoading || (isAuthenticated && isLoading)) && <div className="flex-1 space-y-0 p-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="mb-2 h-12 animate-pulse border border-[#292d36] bg-[#151820]" />)}</div>}
      {isAuthenticated && isError && <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center"><CircleAlert className="h-6 w-6 text-rose-300" /><p className="text-[12px] font-semibold">Token records could not be loaded</p><p className="text-[10px] text-muted-foreground">Check the session connection and retry.</p><button onClick={() => refetch()} className="border border-[#383d48] px-3 py-1.5 text-[10px] hover:bg-[#1b202a]">Retry</button></div>}
      {isAuthenticated && !isLoading && !isError && <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,.8fr)]">
        <TerminalPanel title="Deployment directory" testId="my-tokens-table" className="min-h-0 border-0" headerActions={<span className="font-mono text-[10px] text-muted-foreground">{filtered.length} shown</span>}>
          <div className="shrink-0 border-b border-[#292d36] px-2.5 py-2">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[180px] flex-1"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ticker, mint…" aria-label="Search token records" className="h-8 w-full border border-[#292d36] bg-[#0b0d12] pl-7 pr-2 text-[11px] outline-none focus:border-[#32a9ff]/50" /></div>
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Filter by status" className="h-8 border border-[#292d36] bg-[#0b0d12] px-2 text-[10px]"><option value="all">All statuses</option><option value="deployed">Deployed</option><option value="pending">Pending</option><option value="other">Other status</option></select>
              <select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformFilter)} aria-label="Filter by platform" className="h-8 border border-[#292d36] bg-[#0b0d12] px-2 text-[10px]"><option value="all">All platforms</option><option value="pumpfun">Pump.fun</option><option value="bonkfun">Bonk.fun</option><option value="meteora">Meteora</option></select>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-[minmax(140px,1.1fr)_minmax(120px,1fr)_105px_92px] gap-2 border-b border-[#292d36] bg-[#151820] px-3 py-2 text-[9px] font-semibold uppercase text-muted-foreground max-sm:grid-cols-[minmax(120px,1fr)_85px_80px]">
            <span>Token / symbol</span><span className="hidden sm:block">Mint address</span><span>Platform</span><span>Status</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {filtered.map((token) => <button key={token.id} type="button" onClick={() => setSelectedId(token.id)} aria-pressed={selected?.id === token.id} className={`grid w-full grid-cols-[minmax(140px,1.1fr)_minmax(120px,1fr)_105px_92px] items-center gap-2 border-b border-[#292d36] px-3 py-2.5 text-left transition-colors max-sm:grid-cols-[minmax(120px,1fr)_85px_80px] ${selected?.id === token.id ? "bg-[#32a9ff]/[.07] shadow-[inset_2px_0_0_#32a9ff]" : "hover:bg-[#151820]"}`}>
              <span className="min-w-0"><span className="block truncate text-[11px] font-semibold">{token.name}</span><span className="font-mono text-[9px] text-muted-foreground">{token.symbol}</span><span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground sm:hidden">{short(token.tokenAddress)}</span></span>
              <code className="hidden truncate text-[10px] text-muted-foreground sm:block">{token.tokenAddress || "Mint pending"}</code>
              <span className="truncate text-[10px] text-muted-foreground">{platformName(token.platform)}</span>
              <span className={`truncate text-[9px] ${token.platform !== "pumpfun" || token.status === "pending" ? "text-amber-200" : token.status === "deployed" ? "text-emerald-300" : "text-muted-foreground"}`}>{tokenState(token)}</span>
            </button>)}
            {!filtered.length && <TerminalEmpty title={tokens?.length ? "No records match these filters" : "No launch records yet"} detail={tokens?.length ? "Try a different search or filter." : "Submitted requests and saved configurations appear here."} />}
          </div>
        </TerminalPanel>
        <TerminalPanel title="Record inspector" testId="my-token-inspector" className="min-h-[300px] border-0 border-t lg:min-h-0 lg:border-l lg:border-t-0" headerActions={selected ? <span className={`text-[9px] ${selected.platform !== "pumpfun" || selected.status === "pending" ? "text-amber-200" : "text-emerald-300"}`}>{tokenState(selected)}</span> : undefined}>
          {selected ? <div className="min-h-0 flex-1 overflow-auto">
            <div className="flex items-center gap-3 border-b border-[#292d36] p-3">
              {selected.logoUrl ? <img src={selected.logoUrl} alt="" className="h-11 w-11 object-cover" /> : <div className="grid h-11 w-11 place-items-center border border-[#292d36] bg-[#151820] font-mono text-[12px] text-[#72c5ff]">{selected.symbol.slice(0, 2)}</div>}
              <div className="min-w-0"><h2 className="truncate text-[13px] font-semibold">{selected.name}</h2><p className="font-mono text-[10px] text-muted-foreground">{selected.symbol}</p></div>
              <span className="ml-auto border border-[#292d36] px-1.5 py-1 text-[9px] text-muted-foreground">{platformName(selected.platform)}</span>
            </div>
            <div className="divide-y divide-[#292d36]">
              <InspectorRow label="Record status" value={tokenState(selected)} />
              <InspectorRow label="Mint / address" value={selected.tokenAddress || "Not assigned"} mono />
              <InspectorRow label="Transaction signature" value={selected.txSignature || "Not available"} mono />
              <InspectorRow label="Funding wallet" value={selected.walletId || "Not associated"} mono />
              <InspectorRow label="Created" value={selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "Not available"} />
              <InspectorRow label="Fees collected" value={selected.totalFeesCollected != null ? `${selected.totalFeesCollected} SOL` : "Not reported"} mono />
              <InspectorRow label="Fees distributed" value={selected.totalFeesDistributed != null ? `${selected.totalFeesDistributed} SOL` : "Not reported"} mono />
              <InspectorRow label="Burned" value={selected.totalBurned != null ? `${selected.totalBurned} SOL` : "Not reported"} mono />
            </div>
            {selected.description && <div className="border-b border-[#292d36] p-3"><p className="mb-1 text-[9px] font-semibold uppercase text-muted-foreground">Description</p><p className="whitespace-pre-wrap text-[11px] leading-relaxed">{selected.description}</p></div>}
            {selected.platform !== "pumpfun" && <p className="m-3 border-l-2 border-amber-400 bg-amber-400/[.05] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100">Saved platform configuration only. This record is not represented as a confirmed on-chain launch.</p>}
            {selected.platform === "pumpfun" && selected.status !== "deployed" && <p className="m-3 border-l-2 border-amber-400 bg-amber-400/[.05] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100">A request or pending status does not confirm an on-chain launch.</p>}
            <div className="flex flex-wrap gap-2 border-t border-[#292d36] p-3">
              <Link href={`/deploy/${selected.id}`} className="inline-flex h-8 items-center gap-1.5 bg-[#32a9ff] px-2.5 text-[10px] font-semibold text-[#07111a] hover:opacity-90">Open token workspace <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </div> : <TerminalEmpty title="Select a deployment" detail="Record status, available activity summaries, and relevant actions appear here." />}
        </TerminalPanel>
      </div>}
    </div>
  </main>;
}

function InspectorRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex min-w-0 items-start justify-between gap-3 px-3 py-2"><span className="shrink-0 text-[10px] text-muted-foreground">{label}</span><span className={`min-w-0 break-all text-right text-[10px] ${mono ? "font-mono tabular-nums" : ""}`}>{value}</span></div>;
}
