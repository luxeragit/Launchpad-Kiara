import { AlertTriangle, CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkStatus() {
  const { data, isLoading, isError } = useNetworkStatus();
  const [expanded, setExpanded] = useState(false);
  const ready = !!data?.transactionsEnabled && !isError;
  const walletNetwork = data?.walletNetwork ?? "unknown";
  const tradingNetwork = data?.tradingNetwork ?? "unknown";
  const reason = isError ? "Network safety status is unavailable. Financial actions remain paused until it can be verified." :
    data?.reason || "Network consistency has not been verified.";
  return (
    <div aria-live="polite" className={ready
      ? "border-b border-emerald-700/15 bg-emerald-700/[.045]"
      : "border-b border-amber-700/20 bg-amber-500/[.07]"}>
      <div className="page-frame py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs">
          {isLoading ? <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" /> :
            ready ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" /> :
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-amber-300" />}
          <span className="font-semibold">{isLoading ? "Checking networks" : ready ? "Network verified" : "Financial actions paused"}</span>
          <span className="text-muted-foreground">Wallet <b className="font-mono font-medium text-foreground">{walletNetwork}</b></span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Trading <b className="font-mono font-medium text-foreground">{tradingNetwork}</b></span>
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="network-detail" className="ml-auto inline-flex min-h-7 items-center gap-1 rounded px-1.5 font-semibold text-foreground hover:bg-black/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {expanded ? "Hide details" : "Details"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
        {expanded && <div id="network-detail" className="mt-2 border-t border-current/10 pt-2 text-xs leading-relaxed text-muted-foreground">
          <p>{ready ? "Financial actions are enabled by the verified network configuration." : reason}</p>
          {data && <p className="mt-1">Wallet and trading networks {data.consistent ? "match" : "do not match"}; RPC verification {data.rpcVerified ? "passed" : "is incomplete"}; configuration {data.explicitlyConfigured ? "is explicit" : "is not explicit"}.</p>}
          {data && <p className="mt-1">Airdrop permission: {data.airdropEnabled === true ? "enabled by server configuration" : data.airdropEnabled === false ? "disabled by server configuration" : "not reported"}.</p>}
        </div>}
      </div>
    </div>
  );
}
