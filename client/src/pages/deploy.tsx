import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Check, ExternalLink, ImagePlus, Rocket, ShieldCheck, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Wallet as WalletType, TokenDeployment } from "@shared/schema";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useAuth } from "@/contexts/AuthContext";
import { TerminalPanel } from "@/components/terminal/terminal-panel";

const optionalLink = z.string().trim().max(256, "Use 256 characters or fewer").optional().refine(
  (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
  "Use a complete http:// or https:// link",
);
const tokenDeployFormSchema = z.object({
  name: z.string().trim().min(1, "Add a token name").max(32, "Use 32 characters or fewer"),
  symbol: z.string().trim().min(1, "Add a ticker").max(10, "Use 10 characters or fewer"),
  description: z.string().max(500, "Use 500 characters or fewer").optional(),
  twitter: optionalLink,
  telegram: optionalLink,
  website: optionalLink,
  platform: z.enum(["pumpfun", "bonkfun", "meteora"]),
  mode: z.enum(["normal", "mayhem"]).default("normal"),
  walletId: z.string().min(1, "Choose a launch wallet"),
  initialBuyAmount: z.coerce.number().min(0.01, "Minimum initial buy is 0.01 SOL"),
});
type TokenDeployForm = z.infer<typeof tokenDeployFormSchema>;
const platforms = [
  { id: "pumpfun", name: "Pump.fun", detail: "Live launch request", live: true },
  { id: "bonkfun", name: "Bonk.fun", detail: "Pending configuration only", live: false },
  { id: "meteora", name: "Meteora", detail: "Pending configuration only", live: false },
] as const;
const fieldClass = "h-9 rounded-sm border-[#292d36] bg-[#0b0d12] text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:ring-[#32a9ff]/40";
const labelClass = "mb-1.5 block text-[11px] font-medium text-muted-foreground";

export default function DeployPage() {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<TokenDeployment | null>(null);
  const [mobilePane, setMobilePane] = useState<"setup" | "preview">("setup");
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const network = useNetworkStatus();
  const transactionsEnabled = !!network.data?.transactionsEnabled && !network.isError;
  const { data: wallets, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"], enabled: isAuthenticated,
  });
  const { data: deployedTokens, isLoading: tokensLoading, isError: tokensError, refetch: refetchTokens } = useQuery<TokenDeployment[]>({
    queryKey: ["/api/tokens"], enabled: isAuthenticated,
  });
  const form = useForm<TokenDeployForm>({
    resolver: zodResolver(tokenDeployFormSchema), mode: "onTouched",
    defaultValues: { name: "", symbol: "", description: "", twitter: "", telegram: "", website: "", platform: "pumpfun", mode: "normal", walletId: "", initialBuyAmount: 0.01 },
  });
  const [name, symbol, description, platform, mode, walletId, initialBuyAmount] = form.watch(["name", "symbol", "description", "platform", "mode", "walletId", "initialBuyAmount"]);
  const activeWallets = useMemo(() => wallets?.filter((wallet) => wallet.isActive) ?? [], [wallets]);
  const selectedWallet = activeWallets.find((wallet) => wallet.id === walletId);
  const platformInfo = platforms.find((item) => item.id === platform)!;
  const deployMutation = useMutation({
    mutationFn: async (data: TokenDeployForm) => {
      if (!isAuthenticated) throw new Error("Connect a wallet to submit a launch request.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      const formData = new FormData();
      formData.append("name", data.name); formData.append("symbol", data.symbol); formData.append("platform", data.platform);
      formData.append("mode", data.mode); formData.append("walletId", data.walletId); formData.append("initialBuyAmount", data.initialBuyAmount.toString());
      if (data.description) formData.append("description", data.description);
      if (data.twitter) formData.append("twitter", data.twitter);
      if (data.telegram) formData.append("telegram", data.telegram);
      if (data.website) formData.append("website", data.website);
      if (logoFile) formData.append("logo", logoFile);
      const response = await fetch("/api/tokens/deploy", { method: "POST", body: formData, credentials: "include" });
      if (!response.ok) {
        let message = "Launch request failed";
        try { const error = await response.json(); message = error.error || error.message || message; }
        catch { message = (await response.text()) || message; }
        throw new Error(message);
      }
      return await response.json() as TokenDeployment;
    },
    onSuccess: (token) => {
      setCreatedToken(token);
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({ title: token.platform === "pumpfun" ? "Pump.fun request submitted" : "Launch configuration saved", description: token.platform === "pumpfun" ? "The record shows the reported status; this is not on-chain confirmation." : "Saved as a pending configuration; a live launch is not implemented for this platform." });
    },
    onError: (error: Error) => toast({ title: "Could not submit launch", description: error.message, variant: "destructive" }),
  });
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Choose an image file", variant: "destructive" }); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };
  const onSubmit = (data: TokenDeployForm) => {
    if (!isAuthenticated) { toast({ title: "Connect your wallet", description: "Your setup remains on this screen until you connect.", variant: "destructive" }); return; }
    if (!logoFile) { toast({ title: "Add token artwork", description: "An image is required for this launch.", variant: "destructive" }); return; }
    if (!transactionsEnabled) { toast({ title: "Launch paused", description: network.data?.reason || "Network safety has not been verified.", variant: "destructive" }); return; }
    deployMutation.mutate(data);
  };
  const onInvalid = (errors: FieldErrors<TokenDeployForm>) => {
    toast({ title: "Review the highlighted fields", description: errors.name?.message || errors.symbol?.message || errors.walletId?.message || errors.initialBuyAmount?.message || "Fix the validation issue before submitting.", variant: "destructive" });
  };
  const clearForm = () => { form.reset(); setLogoFile(null); setLogoPreview(null); setCreatedToken(null); };
  const errorFor = (key: keyof TokenDeployForm) => form.formState.errors[key]?.message;

  return <main data-testid="launch-studio" className="terminal-workspace min-h-0 overflow-auto">
    <div className="flex min-h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-[#292d36] px-3">
        <div className="flex min-w-0 items-center gap-2"><Rocket className="h-4 w-4 text-[#32a9ff]" /><h1 className="text-[13px] font-semibold">Launch studio</h1><span className="hidden text-[11px] text-muted-foreground sm:inline">Configure, inspect, submit</span></div>
        <Link href="/my-tokens" className="text-[11px] font-medium text-[#32a9ff] hover:text-sky-300">My tokens</Link>
      </div>
      {createdToken && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 bg-emerald-500/[.06] px-3 py-2 text-[11px]">
        <div className="flex min-w-0 items-center gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-400" /><span className="font-semibold">{createdToken.platform === "pumpfun" ? "Request accepted" : "Configuration saved"}</span><span className="truncate text-muted-foreground">{createdToken.platform === "pumpfun" ? `Record status: ${createdToken.status}; not an on-chain confirmation.` : "Pending configuration; live launch is not implemented."}</span></div>
        <div className="flex items-center gap-3">{createdToken.id && <Link href={`/deploy/${createdToken.id}`} className="inline-flex items-center gap-1 text-[#32a9ff]">Open record <ExternalLink className="h-3 w-3" /></Link>}<button type="button" onClick={clearForm} className="text-muted-foreground hover:text-foreground">New setup</button></div>
      </div>}
      <div className="grid shrink-0 grid-cols-2 border-b border-[#292d36] lg:hidden" aria-label="Launch workspace panels">
        <button type="button" onClick={() => setMobilePane("setup")} aria-pressed={mobilePane === "setup"} className={`h-8 border-b-2 text-[10px] font-medium ${mobilePane === "setup" ? "border-[#32a9ff] text-foreground" : "border-transparent text-muted-foreground"}`}>Configuration</button>
        <button type="button" onClick={() => setMobilePane("preview")} aria-pressed={mobilePane === "preview"} className={`h-8 border-b-2 text-[10px] font-medium ${mobilePane === "preview" ? "border-[#32a9ff] text-foreground" : "border-transparent text-muted-foreground"}`}>Live review</button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <TerminalPanel title="Token configuration" className={`min-h-0 border-0 ${mobilePane === "setup" ? "flex" : "!hidden lg:!flex"}`} headerActions={<span className="text-[10px] text-muted-foreground">All fields remain editable</span>}>
          <form id="launch-config-form" onSubmit={form.handleSubmit(onSubmit, onInvalid)} noValidate className="min-h-0 flex-1 overflow-auto">
            <section className="border-b border-[#292d36] px-3 py-3">
              <SectionHeading index="01" title="Identity" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div><label className={labelClass} htmlFor="token-name">Name</label><input id="token-name" className={fieldClass} maxLength={32} placeholder="Token name" {...form.register("name")} data-testid="input-token-name" />{errorFor("name") && <FieldError>{String(errorFor("name"))}</FieldError>}</div>
                  <div><label className={labelClass} htmlFor="token-symbol">Ticker</label><input id="token-symbol" className={`${fieldClass} font-mono uppercase`} maxLength={10} placeholder="TICKER" {...form.register("symbol", { onChange: (event) => form.setValue("symbol", event.target.value.toUpperCase()) })} data-testid="input-token-symbol" />{errorFor("symbol") && <FieldError>{String(errorFor("symbol"))}</FieldError>}</div>
                  <div className="sm:col-span-2"><label className={labelClass} htmlFor="token-description">Description <span className="font-normal">optional · {(description || "").length}/500</span></label><textarea id="token-description" rows={2} maxLength={500} className="w-full resize-y rounded-sm border border-[#292d36] bg-[#0b0d12] px-3 py-2 text-[12px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#32a9ff]/40" placeholder="Describe this token" {...form.register("description")} data-testid="input-token-description" />{errorFor("description") && <FieldError>{String(errorFor("description"))}</FieldError>}</div>
                </div>
                <div>
                  <label className={labelClass}>Artwork <span className="text-rose-400">required</span></label>
                  <div className="flex h-[118px] items-center gap-2 border border-dashed border-[#383d48] bg-[#0b0d12] p-2">
                    {logoPreview ? <img src={logoPreview} alt="Token artwork preview" className="h-[58px] w-[58px] shrink-0 object-cover" /> : <div className="grid h-[58px] w-[58px] shrink-0 place-items-center bg-[#151820] text-muted-foreground"><ImagePlus className="h-5 w-5" /></div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] text-muted-foreground">{logoFile?.name || "No image selected"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <button type="button" onClick={() => document.getElementById("logo-upload")?.click()} className="inline-flex h-6 items-center gap-1 border border-[#383d48] px-1.5 text-[9px] whitespace-nowrap hover:bg-[#1b202a]"><ImagePlus className="h-3 w-3" />{logoFile ? "Replace" : "Choose"}</button>
                        {logoFile && <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="h-6 px-1.5 text-[9px] text-muted-foreground whitespace-nowrap hover:bg-[#1b202a] hover:text-foreground">Remove</button>}
                      </div>
                    </div>
                  </div><input id="logo-upload" type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} data-testid="input-token-logo" />
                </div>
              </div>
            </section>
            <section className="border-b border-[#292d36] px-3 py-3">
              <SectionHeading index="02" title="Social references" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {(["twitter", "telegram", "website"] as const).map((key) => <div key={key}><label className={labelClass} htmlFor={`social-${key}`}>{key === "twitter" ? "X / Twitter" : key === "telegram" ? "Telegram" : "Website"}</label><input id={`social-${key}`} className={fieldClass} placeholder={key === "twitter" ? "https://x.com/…" : key === "telegram" ? "https://t.me/…" : "https://…"} {...form.register(key)} data-testid={`input-token-${key}`} />{errorFor(key) && <FieldError>{String(errorFor(key))}</FieldError>}</div>)}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Only include links you control or have permission to represent.</p>
            </section>
            <section className="border-b border-[#292d36] px-3 py-3">
              <SectionHeading index="03" title="Deployment" />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_170px]">
                <fieldset><legend className={labelClass}>Platform</legend><div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {platforms.map((item) => <button key={item.id} type="button" aria-pressed={platform === item.id} onClick={() => form.setValue("platform", item.id, { shouldDirty: true, shouldValidate: true })} className={`min-h-[54px] border px-2.5 py-2 text-left ${platform === item.id ? "border-[#32a9ff]/60 bg-[#32a9ff]/[.07]" : "border-[#292d36] hover:bg-[#151820]"}`}>
                    <span className="flex items-center justify-between text-[11px] font-semibold">{item.name}<span className={`h-1.5 w-1.5 rounded-full ${item.live ? "bg-emerald-400" : "bg-amber-400"}`} /></span><span className={`mt-1 block text-[9px] ${item.live ? "text-emerald-300" : "text-amber-200"}`}>{item.detail}</span>
                  </button>)}
                </div>{platform !== "pumpfun" && <div className="mt-2 flex items-start gap-2 border-l-2 border-amber-400 px-2 py-1 text-[10px] text-amber-200"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />This selection stores a configuration only. It does not perform a live launch.</div>}</fieldset>
                <fieldset><legend className={labelClass}>Launch mode</legend><div className="grid grid-cols-2 border border-[#292d36]">
                  {(["normal", "mayhem"] as const).map((choice) => <button key={choice} type="button" aria-pressed={mode === choice} onClick={() => form.setValue("mode", choice, { shouldDirty: true })} className={`h-9 text-[11px] font-medium capitalize ${mode === choice ? "bg-[#32a9ff]/10 text-[#72c5ff]" : "text-muted-foreground hover:bg-[#151820]"}`}>{choice}</button>)}
                </div></fieldset>
              </div>
            </section>
            <section className="px-3 py-3">
              <SectionHeading index="04" title="Funding" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div><div className="mb-1.5 flex items-center justify-between"><label className="text-[11px] font-medium text-muted-foreground">Funding wallet</label><Link href="/wallets" className="text-[10px] text-[#32a9ff]">Manage wallets</Link></div>
                  {!isAuthenticated && !authLoading && <div className="border border-dashed border-[#383d48] p-2 text-[10px] text-muted-foreground">Use the toolbar wallet control to connect, then select a managed wallet.</div>}
                  {authLoading && <div className="h-10 animate-pulse bg-[#151820]" />}
                  {isAuthenticated && walletsLoading && <div className="h-10 animate-pulse bg-[#151820]" />}
                  {isAuthenticated && walletsError && <div className="flex items-center justify-between border border-rose-500/30 p-2 text-[10px]">Wallets unavailable<button type="button" onClick={() => refetchWallets()} className="text-[#32a9ff]">Retry</button></div>}
                  {isAuthenticated && !walletsLoading && !walletsError && activeWallets.length === 0 && <div className="border border-dashed border-[#383d48] p-2 text-[10px] text-muted-foreground">No active wallets. <Link href="/wallets" className="text-[#32a9ff]">Create or import one</Link></div>}
                  {activeWallets.length > 0 && <select value={walletId} onChange={(event) => form.setValue("walletId", event.target.value, { shouldValidate: true })} className={`${fieldClass} w-full`} aria-label="Funding wallet">
                    <option value="">Select a wallet</option>{activeWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.label || "Solana wallet"} · {wallet.address.slice(0, 5)}…{wallet.address.slice(-5)}{wallet.balance != null ? ` · ${wallet.balance.toFixed(4)} SOL` : ""}</option>)}
                  </select>}
                  {errorFor("walletId") && <FieldError>{String(errorFor("walletId"))}</FieldError>}
                </div>
                <div><label htmlFor="initial-buy" className={labelClass}>Initial buy · SOL</label><input id="initial-buy" type="number" min="0.01" step="0.01" className={`${fieldClass} font-mono tabular-nums`} {...form.register("initialBuyAmount", { valueAsNumber: true })} data-testid="input-initial-buy-amount" />{errorFor("initialBuyAmount") && <FieldError>{String(errorFor("initialBuyAmount"))}</FieldError>}</div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">The amount is sent with the launch request; fees and execution outcomes depend on platform and network. No fee estimate is available here.</p>
            </section>
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-[#292d36] bg-[#101218] px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground">Review every field before submission.</p>
              <button type="button" onClick={() => setMobilePane("preview")} className="h-8 bg-[#1b202a] px-3 text-[10px] font-medium text-foreground hover:bg-[#252b36] lg:hidden">Review setup</button>
            </div>
          </form>
        </TerminalPanel>
        <TerminalPanel title="Live launch preview" testId="live-launch-preview" className={`min-h-0 border-0 lg:border-l ${mobilePane === "preview" ? "flex" : "!hidden lg:!flex"}`}>
          <div className="flex-1 overflow-auto">
            <div className="border-b border-[#292d36] p-3">
              <div className="flex items-center gap-3">
                {logoPreview ? <img src={logoPreview} alt="" className="h-12 w-12 object-cover" /> : <div className="grid h-12 w-12 place-items-center border border-[#292d36] bg-[#151820] font-mono text-sm text-[#72c5ff]">{symbol.slice(0, 2) || "—"}</div>}
                <div className="min-w-0"><p className="truncate text-[13px] font-semibold">{name || "Token name"}</p><p className="font-mono text-[11px] text-muted-foreground">{symbol || "TICKER"}</p></div>
                <span className={`ml-auto shrink-0 border px-1.5 py-1 text-[9px] ${platformInfo.live ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-200"}`}>{platformInfo.live ? "LIVE REQUEST PATH" : "PENDING CONFIG"}</span>
              </div>
              <p className="mt-3 min-h-8 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">{description || "Description preview will appear here."}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                {form.watch("twitter") && <span className="text-[#72c5ff]">X / Twitter linked</span>}{form.watch("telegram") && <span className="text-[#72c5ff]">Telegram linked</span>}{form.watch("website") && <span className="text-[#72c5ff]">Website linked</span>}
                {!form.watch("twitter") && !form.watch("telegram") && !form.watch("website") && <span className="text-muted-foreground">No social links added</span>}
              </div>
            </div>
            <div className="divide-y divide-[#292d36]">
              <ReviewRow label="Platform" value={platformInfo.name} />
              <ReviewRow label="Mode" value={mode} />
              <ReviewRow label="Funding wallet" value={selectedWallet ? `${selectedWallet.label || "Wallet"} · ${selectedWallet.address}` : "Not selected"} mono />
              <ReviewRow label="Wallet balance" value={selectedWallet?.balance != null ? `${selectedWallet.balance.toFixed(4)} SOL` : "Unavailable"} mono />
              <ReviewRow label="Initial amount" value={`${Number(initialBuyAmount || 0).toString()} SOL`} mono />
              <ReviewRow label="Estimated fees" value="Not provided by this interface" />
            </div>
            <div className={`mx-3 my-3 flex items-start gap-2 border-l-2 p-2.5 text-[10px] leading-relaxed ${platformInfo.live ? "border-[#32a9ff] bg-[#32a9ff]/[.05] text-muted-foreground" : "border-amber-400 bg-amber-400/[.05] text-amber-100"}`}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {platformInfo.live ? "Pump.fun submission sends a launch request. Acceptance does not confirm on-chain deployment; use the returned record status." : `${platformInfo.name} currently saves a pending configuration only. A live launch is not implemented.`}
            </div>
            {!transactionsEnabled && <div className="mx-3 mb-3 flex items-start gap-2 border border-amber-500/30 bg-amber-500/[.06] p-2.5 text-[10px] text-amber-100"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{network.data?.reason || "Network safety has not been verified."} Submission stays paused; editing remains available.</span></div>}
            {authLoading ? <div className="mx-3 mb-3 h-8 animate-pulse bg-[#151820]" /> : !isAuthenticated ? <div className="mx-3 mb-3 flex items-center gap-2 text-[10px] text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Connect a wallet to submit.</div> : null}
            {isAuthenticated && <div className="border-t border-[#292d36] p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold">Recent records</span><button type="button" onClick={() => refetchTokens()} className="text-[10px] text-[#32a9ff]">{tokensLoading ? "Loading…" : "Refresh"}</button></div>
              {tokensError ? <button type="button" onClick={() => refetchTokens()} className="text-[10px] text-rose-300">Records unavailable — retry</button> : deployedTokens?.slice(0, 4).map((token) => <Link key={token.id} href={`/deploy/${token.id}`} className="flex items-center justify-between border-t border-[#292d36] py-2 text-[10px] hover:bg-[#151820]"><span className="min-w-0 truncate">{token.name} <span className="font-mono text-muted-foreground">{token.symbol}</span></span><span className="ml-2 shrink-0 text-muted-foreground">{token.platform === "pumpfun" ? token.status : "pending config"}</span></Link>)}
              {!tokensLoading && !tokensError && !deployedTokens?.length && <p className="text-[10px] text-muted-foreground">No launch records yet.</p>}
            </div>}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#292d36] bg-[#101218] px-3 py-2">
            <button type="button" onClick={() => setMobilePane("setup")} className="h-8 border border-[#383d48] px-2.5 text-[10px] text-muted-foreground hover:bg-[#1b202a] lg:hidden">Edit setup</button>
            <span className="hidden text-[9px] text-muted-foreground lg:block">Review the configuration before sending.</span>
            <button type="submit" form="launch-config-form" disabled={deployMutation.isPending || !isAuthenticated || !transactionsEnabled || !selectedWallet} data-testid="button-deploy-submit" className="ml-auto inline-flex h-8 items-center gap-2 bg-[#32a9ff] px-3 text-[10px] font-semibold text-[#07111a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              {deployMutation.isPending ? "Submitting…" : platform === "pumpfun" ? "Submit launch request" : "Save pending configuration"}<Rocket className="h-3 w-3" />
            </button>
          </div>
        </TerminalPanel>
      </div>
    </div>
  </main>;
}

function SectionHeading({ index, title }: { index: string; title: string }) {
  return <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold"><span className="font-mono text-[9px] text-[#32a9ff]">{index}</span>{title}</h2>;
}
function FieldError({ children }: { children: string }) {
  return <p className="mt-1 text-[10px] text-rose-300">{children}</p>;
}
function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex min-w-0 items-start justify-between gap-3 px-3 py-2 text-[10px]"><span className="shrink-0 text-muted-foreground">{label}</span><span className={`min-w-0 break-all text-right ${mono ? "font-mono tabular-nums" : ""}`}>{value}</span></div>;
}
