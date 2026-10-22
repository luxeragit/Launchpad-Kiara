import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleAlert, ExternalLink, ImagePlus, Rocket, ShieldCheck, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Wallet as WalletType, TokenDeployment } from "@shared/schema";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useAuth } from "@/contexts/AuthContext";
import { WalletConnectButton } from "@/components/wallet-connect-button";

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
const steps = ["Identity", "Socials", "Launch", "Review"] as const;
const platforms = [
  { id: "pumpfun", name: "Pump.fun", detail: "Live launch request", live: true },
  { id: "bonkfun", name: "Bonk.fun", detail: "Configuration only · live launch not implemented", live: false },
  { id: "meteora", name: "Meteora", detail: "Configuration only · live launch not implemented", live: false },
] as const;

export default function DeployPage() {
  const [step, setStep] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<TokenDeployment | null>(null);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const network = useNetworkStatus();
  const transactionsEnabled = !!network.data?.transactionsEnabled && !network.isError;

  const { data: wallets, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
    enabled: isAuthenticated,
  });
  const { data: deployedTokens, isLoading: tokensLoading, isError: tokensError, refetch: refetchTokens } = useQuery<TokenDeployment[]>({
    queryKey: ["/api/tokens"],
    enabled: isAuthenticated,
  });

  const form = useForm<TokenDeployForm>({
    resolver: zodResolver(tokenDeployFormSchema),
    mode: "onTouched",
    defaultValues: {
      name: "", symbol: "", description: "", twitter: "", telegram: "", website: "",
      platform: "pumpfun", mode: "normal", walletId: "", initialBuyAmount: 0.01,
    },
  });
  const name = form.watch("name");
  const symbol = form.watch("symbol");
  const description = form.watch("description");
  const platform = form.watch("platform");
  const mode = form.watch("mode");
  const walletId = form.watch("walletId");
  const initialBuyAmount = form.watch("initialBuyAmount");
  const selectedWallet = wallets?.find((wallet) => wallet.id === walletId);

  const deployMutation = useMutation({
    mutationFn: async (data: TokenDeployForm) => {
      if (!isAuthenticated) throw new Error("Connect a wallet to submit a launch request.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("symbol", data.symbol);
      formData.append("platform", data.platform);
      formData.append("mode", data.mode);
      formData.append("walletId", data.walletId);
      formData.append("initialBuyAmount", data.initialBuyAmount.toString());
      if (data.description) formData.append("description", data.description);
      if (data.twitter) formData.append("twitter", data.twitter);
      if (data.telegram) formData.append("telegram", data.telegram);
      if (data.website) formData.append("website", data.website);
      if (logoFile) formData.append("logo", logoFile);
      const response = await fetch("/api/tokens/deploy", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        let message = "Launch request failed";
        try {
          const error = await response.json();
          message = error.error || error.message || message;
        } catch {
          message = (await response.text()) || message;
        }
        throw new Error(message);
      }
      return await response.json() as TokenDeployment;
    },
    onSuccess: (token) => {
      setCreatedToken(token);
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({
        title: platform === "pumpfun" ? "Pump.fun request submitted" : "Launch configuration saved",
        description: platform === "pumpfun"
          ? "The request was accepted. The token record will show its actual on-chain status."
          : "Saved as a pending configuration; a live launch is not implemented for this platform.",
      });
    },
    onError: (error: Error) => toast({ title: "Could not submit launch", description: error.message, variant: "destructive" }),
  });

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "destructive" });
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const advance = async () => {
    const fieldsByStep: Record<number, (keyof TokenDeployForm)[]> = {
      1: ["name", "symbol", "description"],
      2: ["twitter", "telegram", "website"],
      3: ["platform", "mode", "walletId", "initialBuyAmount"],
    };
    const valid = await form.trigger(fieldsByStep[step], { shouldFocus: true });
    if (!valid) return;
    if (step === 1 && !logoFile) {
      toast({ title: "Add token artwork", description: "An image is required for this launch.", variant: "destructive" });
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  };

  const beginAnother = () => {
    form.reset();
    setLogoFile(null);
    setLogoPreview(null);
    setCreatedToken(null);
    setStep(1);
  };

  const onSubmit = (data: TokenDeployForm) => {
    if (!isAuthenticated) {
      toast({ title: "Connect your wallet", description: "Your form is saved on this screen. Connect to submit.", variant: "destructive" });
      return;
    }
    if (!logoFile) {
      setStep(1);
      toast({ title: "Add token artwork", variant: "destructive" });
      return;
    }
    if (!transactionsEnabled) {
      toast({ title: "Launch paused", description: network.data?.reason || "Network safety has not been verified.", variant: "destructive" });
      return;
    }
    deployMutation.mutate(data);
  };

  const handleInvalid = (errors: FieldErrors<TokenDeployForm>) => {
    const identityInvalid = !!(errors.name || errors.symbol || errors.description);
    const socialsInvalid = !!(errors.twitter || errors.telegram || errors.website);
    setStep(identityInvalid ? 1 : socialsInvalid ? 2 : 3);
    toast({ title: "Review the highlighted fields", description: "Fix the validation issue before submitting.", variant: "destructive" });
  };

  return (
    <main className="page-frame page-enter max-w-6xl space-y-7 py-7 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-primary">Token studio</p>
          <h1 className="font-display text-3xl font-semibold md:text-[38px]">Create a token</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Shape the identity, choose where to launch, then review every detail before submitting.</p>
        </div>
        <Link href="/my-tokens" className="text-sm font-semibold text-primary hover:underline">My tokens</Link>
      </div>

      {!authLoading && !isAuthenticated && (
        <Card className="border-primary/25 bg-primary/[.035]">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Connect to load launch wallets</p>
                <p className="mt-1 text-sm text-muted-foreground">You can complete the token identity and social details first. Your existing wallet-signature flow is used to submit.</p>
              </div>
            </div>
            <WalletConnectButton />
          </CardContent>
        </Card>
      )}

      {createdToken && (
        <Card className="border-emerald-600/30 bg-emerald-500/[.04]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
              <Check className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold">{createdToken.platform === "pumpfun" ? "Launch request submitted" : "Configuration saved"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {createdToken.platform === "pumpfun" ? `Record status: ${createdToken.status}. This does not confirm an on-chain launch.` : "This platform is saved as a pending configuration; live launch is not implemented."}
              </p>
              {createdToken.tokenAddress && <code className="mt-3 block break-all rounded-md bg-background/70 p-2 text-xs">{createdToken.tokenAddress}</code>}
              {!createdToken.tokenAddress && <p className="mt-3 text-xs text-muted-foreground">Mint address is not available yet.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {createdToken.id && <Link href={`/deploy/${createdToken.id}`} className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted">Open record <ExternalLink className="h-3.5 w-3.5" /></Link>}
              <Button variant="outline" size="sm" onClick={beginAnother}>Create another</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/20 p-4 md:p-5">
            <ol className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Creation progress">
              {steps.map((label, index) => {
                const number = index + 1;
                const complete = step > number;
                const current = step === number;
                return <li key={label}>
                  <button type="button" onClick={() => number < step && setStep(number)} disabled={number >= step}
                    aria-current={current ? "step" : undefined}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${current ? "border-primary/40 bg-primary/10 text-primary" : complete ? "border-emerald-600/20 bg-emerald-500/[.04] text-foreground" : "border-transparent text-muted-foreground"}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${current ? "bg-primary text-primary-foreground" : complete ? "bg-emerald-600 text-white" : "bg-muted"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span>
                    <span className="truncate font-semibold">{label}</span>
                  </button>
                </li>;
              })}
            </ol>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, handleInvalid)} noValidate>
              {step === 1 && <section className="space-y-5 p-4 md:p-6">
                <div>
                  <h2 className="font-display text-xl font-semibold">Token identity</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Start with the name people will recognize.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField control={form.control} name="name" render={({ field }) => <FormItem>
                    <FormLabel>Name</FormLabel><FormControl><Input maxLength={32} placeholder="Token name" {...field} data-testid="input-token-name" /></FormControl><FormMessage />
                  </FormItem>} />
                  <FormField control={form.control} name="symbol" render={({ field }) => <FormItem>
                    <FormLabel>Symbol</FormLabel><FormControl><Input maxLength={10} placeholder="TICKER" {...field} onChange={(event) => field.onChange(event.target.value.toUpperCase())} data-testid="input-token-symbol" /></FormControl><FormMessage />
                  </FormItem>} />
                </div>
                <div>
                  <Label htmlFor="logo-upload">Token artwork <span className="text-destructive">*</span></Label>
                  <div className="mt-2 flex flex-col items-center gap-4 rounded-md border border-dashed bg-muted/20 p-4 sm:flex-row">
                    {logoPreview ? <img src={logoPreview} alt="Token artwork preview" className="h-24 w-24 rounded-md border object-cover" /> :
                      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><ImagePlus className="h-7 w-7" /></div>}
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-sm font-semibold">{logoFile?.name || "Add a square image"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Preview appears here before you continue.</p>
                      <div className="mt-3 flex justify-center gap-2 sm:justify-start">
                        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("logo-upload")?.click()}><ImagePlus className="mr-2 h-4 w-4" />{logoFile ? "Replace image" : "Choose image"}</Button>
                        {logoFile && <Button type="button" size="sm" variant="ghost" onClick={() => { setLogoFile(null); setLogoPreview(null); }}>Remove</Button>}
                      </div>
                    </div>
                    <input id="logo-upload" type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} data-testid="input-token-logo" />
                  </div>
                </div>
                <FormField control={form.control} name="description" render={({ field }) => <FormItem>
                  <FormLabel>Description <span className="text-xs font-normal text-muted-foreground">Optional</span></FormLabel><FormControl><Textarea rows={4} maxLength={500} className="resize-y" placeholder="What should people know about this token?" {...field} data-testid="input-token-description" /></FormControl><div className="text-right text-xs text-muted-foreground">{(description || "").length}/500</div><FormMessage />
                </FormItem>} />
              </section>}

              {step === 2 && <section className="space-y-5 p-4 md:p-6">
                <div>
                  <h2 className="font-display text-xl font-semibold">Social links</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Optional links help people find the places you already use.</p>
                </div>
                <FormField control={form.control} name="twitter" render={({ field }) => <FormItem>
                  <FormLabel>X / Twitter</FormLabel><FormControl><Input placeholder="https://x.com/your-project" {...field} data-testid="input-token-twitter" /></FormControl><FormMessage />
                </FormItem>} />
                <FormField control={form.control} name="telegram" render={({ field }) => <FormItem>
                  <FormLabel>Telegram</FormLabel><FormControl><Input placeholder="https://t.me/your-community" {...field} data-testid="input-token-telegram" /></FormControl><FormMessage />
                </FormItem>} />
                <FormField control={form.control} name="website" render={({ field }) => <FormItem>
                  <FormLabel>Website</FormLabel><FormControl><Input placeholder="https://your-project.site" {...field} data-testid="input-token-website" /></FormControl><FormMessage />
                </FormItem>} />
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Only add links you control or have permission to represent.</p>
              </section>}

              {step === 3 && <section className="space-y-6 p-4 md:p-6">
                <div>
                  <h2 className="font-display text-xl font-semibold">Launch setup</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a platform, mode, funding wallet, and initial buy.</p>
                </div>
                <div>
                  <Label>Platform</Label>
                  <div className="mt-2 grid gap-2">
                    {platforms.map((item) => <button key={item.id} type="button" aria-pressed={platform === item.id}
                      onClick={() => form.setValue("platform", item.id, { shouldDirty: true, shouldValidate: true })}
                      className={`flex w-full items-start justify-between gap-3 rounded-md border p-3 text-left transition-colors ${platform === item.id ? "border-primary bg-primary/[.06]" : "bg-card hover:bg-muted/30"}`}>
                      <span className="min-w-0"><span className="block font-semibold">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span></span>
                      <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${platform === item.id ? "border-primary bg-primary ring-2 ring-primary/15" : "border-muted-foreground/40"}`} />
                    </button>)}
                  </div>
                  {platform !== "pumpfun" && <p className="mt-2 flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/[.06] p-3 text-xs text-amber-900 dark:text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />This option saves launch configuration only. No live launch is implemented for {platform === "bonkfun" ? "Bonk.fun" : "Meteora"}.</p>}
                </div>
                <div>
                  <Label>Mode</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["normal", "mayhem"] as const).map((option) => <button key={option} type="button" aria-pressed={mode === option}
                      onClick={() => form.setValue("mode", option, { shouldDirty: true })}
                      className={`rounded-md border px-3 py-2.5 text-sm font-semibold capitalize ${mode === option ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted/30"}`}>
                      {option}
                    </button>)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label>Funding wallet</Label><Link href="/wallets" className="text-xs font-semibold text-primary hover:underline">Manage wallets</Link>
                  </div>
                  {!isAuthenticated && !authLoading && <div className="mt-2 rounded-md border border-dashed p-4">
                    <p className="text-sm font-semibold">Connect to choose a launch wallet</p><p className="mt-1 text-xs text-muted-foreground">Your identity and social details remain editable.</p><div className="mt-3"><WalletConnectButton /></div>
                  </div>}
                  {authLoading && <Skeleton className="mt-2 h-14 w-full" />}
                  {isAuthenticated && walletsLoading && <div className="mt-2 space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>}
                  {isAuthenticated && walletsError && <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm"><span>Wallets could not be loaded.</span><Button type="button" variant="outline" size="sm" onClick={() => refetchWallets()}>Retry</Button></div>}
                  {isAuthenticated && !walletsLoading && !walletsError && activeWalletsEmpty(wallets) && <div className="mt-2 rounded-md border border-dashed p-4"><p className="text-sm font-semibold">No active wallets yet</p><p className="mt-1 text-xs text-muted-foreground">Create or import a wallet before submitting a launch.</p><Link href="/wallets" className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">Open wallet control center</Link></div>}
                  {isAuthenticated && !!wallets?.filter((wallet) => wallet.isActive).length && <div className="mt-2 space-y-2">
                    {wallets.filter((wallet) => wallet.isActive).map((wallet) => <button key={wallet.id} type="button" aria-pressed={walletId === wallet.id}
                      onClick={() => form.setValue("walletId", wallet.id, { shouldValidate: true })}
                      className={`flex w-full min-w-0 items-center gap-3 rounded-md border p-3 text-left ${walletId === wallet.id ? "border-primary bg-primary/[.06]" : "hover:bg-muted/30"}`}>
                      <Wallet className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{wallet.label || "Solana wallet"}</span><code className="block truncate text-[11px] text-muted-foreground">{wallet.address}</code></span>
                      <span className="shrink-0 text-right"><span className="block font-mono text-xs">{wallet.balance != null ? `${wallet.balance.toFixed(4)} SOL` : "Balance unavailable"}</span><span className="text-[10px] text-muted-foreground">{wallet.walletType || "created"}</span></span>
                    </button>)}
                  </div>}
                  <FormField control={form.control} name="walletId" render={() => <FormItem><FormMessage /></FormItem>} />
                </div>
                <FormField control={form.control} name="initialBuyAmount" render={({ field }) => <FormItem>
                  <FormLabel>Initial buy (SOL)</FormLabel><FormControl><Input type="number" step="0.01" min="0.01" {...field} value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value)} data-testid="input-initial-buy-amount" /></FormControl>
                  <p className="text-xs text-muted-foreground">This amount is part of the launch request; fees and execution outcomes depend on the platform and network.</p><FormMessage />
                </FormItem>} />
              </section>}

              {step === 4 && <section className="space-y-5 p-4 md:p-6">
                <div>
                  <h2 className="font-display text-xl font-semibold">Review before you submit</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Check the real launch configuration and funding wallet.</p>
                </div>
                <div className="flex items-center gap-4 rounded-md border bg-muted/20 p-4">
                  {logoPreview ? <img src={logoPreview} alt="Token artwork preview" className="h-16 w-16 rounded-md border object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-md bg-primary/10 text-primary"><ImagePlus className="h-6 w-6" /></div>}
                  <div className="min-w-0"><p className="truncate font-display text-lg font-semibold">{name || "Token name"}</p><p className="font-mono text-sm text-muted-foreground">{symbol || "SYMBOL"}</p></div>
                </div>
                <div className="divide-y rounded-md border">
                  <ReviewRow label="Description" value={description || "Not provided"} />
                  <ReviewRow label="X / Twitter" value={form.getValues("twitter") || "Not provided"} />
                  <ReviewRow label="Telegram" value={form.getValues("telegram") || "Not provided"} />
                  <ReviewRow label="Website" value={form.getValues("website") || "Not provided"} />
                  <ReviewRow label="Platform" value={platforms.find((item) => item.id === platform)?.name || platform} />
                  <ReviewRow label="Mode" value={mode} />
                  <ReviewRow label="Funding wallet" value={selectedWallet ? `${selectedWallet.label || "Wallet"} · ${selectedWallet.address}` : "Choose a wallet"} mono />
                  <ReviewRow label="Initial buy" value={`${initialBuyAmount || "—"} SOL`} mono />
                </div>
                <div className={`flex gap-2 rounded-md border p-3 text-sm ${platform === "pumpfun" ? "border-amber-500/30 bg-amber-500/[.05]" : "border-amber-500/30 bg-amber-500/[.05]"}`}>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <p className="text-muted-foreground">{platform === "pumpfun" ? "Submission requests a live Pump.fun launch. Review fees and wallet balance in your wallet before proceeding; a submitted request is not an on-chain confirmation." : "This selection saves a pending configuration only. Live launch is not implemented for this platform."}</p>
                </div>
              </section>}

              <div className="flex items-center justify-between gap-3 border-t bg-muted/10 p-4 md:px-6">
                <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back</span>
                </Button>
                <span className="text-xs text-muted-foreground">Step {step} of 4</span>
                {step < 4 ? <Button type="button" onClick={() => void advance()} className="gap-2">Continue <ArrowRight className="h-4 w-4" /></Button> :
                  <Button type="submit" disabled={deployMutation.isPending || !isAuthenticated || !transactionsEnabled || !selectedWallet} className="gap-2" data-testid="button-deploy-submit">
                    {deployMutation.isPending ? "Submitting…" : platform === "pumpfun" ? "Submit launch request" : "Save configuration"}<Rocket className="h-4 w-4" />
                  </Button>}
              </div>
              {!transactionsEnabled && <div className="flex items-start gap-2 border-t bg-amber-500/[.05] px-4 py-3 text-xs text-amber-900 dark:text-amber-200 md:px-6">
                <ShieldCheck className="h-4 w-4 shrink-0" /><span>{network.data?.reason || "Financial submission is paused until network safety is verified."} You can still edit this setup.</span>
              </div>}
            </form>
          </Form>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-28">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Live preview</CardTitle><CardDescription>Updates as you shape the identity</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border bg-[linear-gradient(135deg,hsl(var(--primary)/.10),hsl(var(--card))_55%)] p-4">
                <div className="flex items-center gap-3">
                  {logoPreview ? <img src={logoPreview} alt="" className="h-12 w-12 rounded-md border object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-md bg-primary/10 font-display text-sm font-semibold text-primary">{symbol.slice(0, 2) || "K"}</div>}
                  <div className="min-w-0"><p className="truncate font-display font-semibold">{name || "Your token name"}</p><p className="font-mono text-xs text-muted-foreground">{symbol || "SYMBOL"}</p></div>
                </div>
                <p className="mt-4 line-clamp-3 min-h-12 text-xs leading-relaxed text-muted-foreground">{description || "A short description will appear here."}</p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Launch platform</span><span className="font-semibold">{platforms.find((item) => item.id === platform)?.name}</span></div>
              {selectedWallet && <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Wallet</span><span className="max-w-[150px] truncate font-mono">{selectedWallet.address}</span></div>}
            </CardContent>
          </Card>
          {isAuthenticated && (
            <Card>
              <CardHeader className="pb-2"><div className="flex items-center justify-between gap-3"><CardTitle className="text-base">Recent launches</CardTitle>{tokensLoading && <Skeleton className="h-4 w-10" />}</div></CardHeader>
              <CardContent className="space-y-2">
                {tokensError ? <div className="flex items-center justify-between gap-2 text-xs"><span>Launch records unavailable</span><Button type="button" size="sm" variant="ghost" onClick={() => refetchTokens()}>Retry</Button></div> :
                  deployedTokens?.slice(0, 4).map((token) => <Link key={token.id} href={`/deploy/${token.id}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-muted/30">
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{token.name}</span><span className="font-mono text-[11px] text-muted-foreground">{token.symbol}</span></span><Badge variant={token.status === "deployed" ? "default" : "outline"}>{token.status}</Badge>
                  </Link>)}
                {!tokensLoading && !tokensError && !deployedTokens?.length && <p className="text-xs text-muted-foreground">No launch records yet.</p>}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}

function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <span className="shrink-0 text-xs text-muted-foreground">{label}</span><span className={`break-words text-sm sm:max-w-[70%] sm:text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
  </div>;
}

function activeWalletsEmpty(wallets?: WalletType[]) {
  return !wallets?.some((wallet) => wallet.isActive);
}
