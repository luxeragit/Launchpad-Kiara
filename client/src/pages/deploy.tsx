import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Rocket, Upload, ChevronLeft, ChevronRight, Check, Wallet, ExternalLink, Settings, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Wallet as WalletType, TokenDeployment } from "@shared/schema";

const tokenDeployFormSchema = z.object({
  name: z.string().min(1, "Token name is required").max(32),
  symbol: z.string().min(1, "Symbol is required").max(10),
  description: z.string().optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  website: z.string().optional(),
  platform: z.enum(["pumpfun", "bonkfun", "meteora"]),
  mode: z.enum(["normal", "mayhem"]).default("normal"),
  walletId: z.string().min(1, "Select a wallet"),
  initialBuyAmount: z.coerce.number().min(0.01, "Minimum 0.01 SOL required").default(0.01),
});

type TokenDeployForm = z.infer<typeof tokenDeployFormSchema>;

const platforms = [
  {
    id: "pumpfun",
    name: "PUMP.FUN",
    description: "Fast deployment with bonding curve",
    color: "text-green-500",
  },
  {
    id: "bonkfun",
    name: "BONK.FUN",
    description: "Advanced bot integration",
    color: "text-orange-500",
  },
  {
    id: "meteora",
    name: "METEORA",
    description: "Dynamic bonding curve",
    color: "text-blue-500",
  },
];

export default function DeployPage() {
  const [step, setStep] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: wallets, isLoading: walletsLoading } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
  });

  const { data: deployedTokens, isLoading: tokensLoading } = useQuery<TokenDeployment[]>({
    queryKey: ["/api/tokens"],
  });

  const form = useForm<TokenDeployForm>({
    resolver: zodResolver(tokenDeployFormSchema),
    defaultValues: {
      name: "",
      symbol: "",
      description: "",
      twitter: "",
      telegram: "",
      website: "",
      platform: "pumpfun",
      mode: "normal",
      walletId: "",
      initialBuyAmount: 0.01,
    },
  });

  const deployMutation = useMutation({
    mutationFn: async (data: TokenDeployForm) => {
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
      
      const res = await fetch("/api/tokens/deploy", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        let errorMessage = "Deployment failed";
        try {
          const error = await res.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch {
          errorMessage = await res.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Deployment Initiated",
        description: "Your token deployment has been submitted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      form.reset();
      setStep(1);
      setLogoFile(null);
      setLogoPreview(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Deployment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const canProceedToStep2 = () => {
    const { name, symbol, platform } = form.getValues();
    return name && symbol && platform;
  };

  const canProceedToStep3 = () => {
    const { walletId } = form.getValues();
    return walletId;
  };

  const onSubmit = (data: TokenDeployForm) => {
    console.log("Form submitted with data:", data);
    deployMutation.mutate(data);
  };

  // Debug: Log form errors when they change
  const formErrors = form.formState.errors;
  if (Object.keys(formErrors).length > 0) {
    console.log("Form validation errors:", formErrors);
  }

  const activeWallets = wallets?.filter((w) => w.isActive) || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Token Deployment</h1>
            <p className="text-sm text-muted-foreground">
              Deploy your token on Pump.fun, Bonk.fun, or Meteora
            </p>
          </div>
        </div>
      </div>

      {deployedTokens && deployedTokens.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
            <div>
              <CardTitle className="text-lg">My Launches</CardTitle>
              <CardDescription>{deployedTokens.length} tokens deployed</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {deployedTokens.slice(0, 4).map((token) => (
                <Link key={token.id} href={`/deploy/${token.id}`}>
                  <div
                    className="flex items-center justify-between gap-3 p-4 rounded-md border border-border cursor-pointer transition-all hover:border-primary/50 hover:bg-muted/50"
                    data-testid={`token-card-${token.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{token.name}</p>
                        <Badge variant="secondary" size="sm" className="font-mono">
                          {token.symbol}
                        </Badge>
                      </div>
                      {token.tokenAddress ? (
                        <p className="text-xs font-mono text-muted-foreground truncate mt-1">
                          {token.tokenAddress}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          Pending deployment
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={token.status === "deployed" ? "default" : "outline"}
                        size="sm"
                      >
                        {token.status}
                      </Badge>
                      <Settings className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {deployedTokens.length > 4 && (
              <p className="text-sm text-muted-foreground text-center mt-3">
                + {deployedTokens.length - 4} more tokens
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            New Launch
          </CardTitle>
          <CardDescription>Create and deploy a new token</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`w-16 h-0.5 mx-2 transition-colors ${
                  step > s ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
        <span className="text-sm text-muted-foreground ml-2">
          {step === 1 && "Platform & Token"}
          {step === 2 && "Select Wallets"}
          {step === 3 && "Review"}
        </span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.log("Form validation failed:", errors);
        })}>
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-muted-foreground">&gt;</span>
                  Token Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="My Token"
                            {...field}
                            data-testid="input-token-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="symbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Symbol <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="MTK"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value.toUpperCase())
                            }
                            data-testid="input-token-symbol"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <Label>
                    Logo <span className="text-destructive">*</span>
                  </Label>
                  <div className="mt-2">
                    {logoPreview ? (
                      <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-md relative">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="h-24 w-24 object-contain rounded-md"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview(null);
                          }}
                          data-testid="button-remove-logo"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <label
                        htmlFor="logo-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-md cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          UPLOAD
                        </span>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                          data-testid="input-token-logo"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your token..."
                          className="resize-none"
                          rows={3}
                          {...field}
                          data-testid="input-token-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="@username"
                            {...field}
                            data-testid="input-token-twitter"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telegram</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="t.me/group"
                            {...field}
                            data-testid="input-token-telegram"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://..."
                            {...field}
                            data-testid="input-token-website"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <Label>
                    Platform <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid gap-3 md:grid-cols-3 mt-2">
                    {platforms.map((platform) => (
                      <div
                        key={platform.id}
                        className={`p-4 rounded-md border cursor-pointer transition-all ${
                          form.watch("platform") === platform.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                        onClick={() =>
                          form.setValue("platform", platform.id as "pumpfun" | "bonkfun" | "meteora")
                        }
                        data-testid={`platform-${platform.id}`}
                      >
                        <p className={`font-semibold ${platform.color}`}>
                          {platform.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {platform.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Mayhem Mode</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Button
                      type="button"
                      variant={form.watch("mode") === "normal" ? "default" : "outline"}
                      size="sm"
                      onClick={() => form.setValue("mode", "normal")}
                      data-testid="button-mode-normal"
                    >
                      NORMAL
                    </Button>
                    <Button
                      type="button"
                      variant={form.watch("mode") === "mayhem" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => form.setValue("mode", "mayhem")}
                      data-testid="button-mode-mayhem"
                    >
                      MAYHEM
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Wallet</CardTitle>
                <CardDescription>
                  Choose a wallet to deploy the token from
                </CardDescription>
              </CardHeader>
              <CardContent>
                {walletsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : activeWallets.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No wallets available</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Create a wallet first in the Wallets page
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-3">
                      {activeWallets.map((wallet) => (
                        <div
                          key={wallet.id}
                          className={`flex items-center gap-4 p-4 rounded-md border cursor-pointer transition-all ${
                            form.watch("walletId") === wallet.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                          onClick={() => form.setValue("walletId", wallet.id)}
                          data-testid={`deploy-wallet-${wallet.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{wallet.label}</p>
                            <p className="text-sm font-mono text-muted-foreground truncate">
                              {wallet.address}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-semibold">
                              {(wallet.balance || 0).toFixed(4)} SOL
                            </p>
                            <Badge variant="secondary" size="sm">
                              {wallet.walletType || "created"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-md border border-border bg-muted/30">
                      <FormField
                        control={form.control}
                        name="initialBuyAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Buy Amount (SOL)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                placeholder="0.01"
                                {...field}
                                data-testid="input-initial-buy-amount"
                              />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-muted-foreground mt-1">
                              Pump.fun requires a minimum initial buy of 0.01 SOL to create a token. 
                              This amount will be used to buy the first tokens from your new token.
                            </p>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Deployment</CardTitle>
                <CardDescription>
                  Confirm your token details before deploying
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Token Name
                      </p>
                      <p className="font-semibold" data-testid="text-review-name">
                        {form.watch("name")}
                      </p>
                    </div>
                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Symbol
                      </p>
                      <p className="font-semibold font-mono" data-testid="text-review-symbol">
                        {form.watch("symbol")}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Platform
                    </p>
                    <p className="font-semibold" data-testid="text-review-platform">
                      {platforms.find((p) => p.id === form.watch("platform"))?.name}
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Mode
                    </p>
                    <Badge variant={form.watch("mode") === "mayhem" ? "destructive" : "secondary"}>
                      {form.watch("mode").toUpperCase()}
                    </Badge>
                  </div>

                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Deploying Wallet
                    </p>
                    <p className="font-mono text-sm" data-testid="text-review-wallet">
                      {wallets?.find((w) => w.id === form.watch("walletId"))?.address}
                    </p>
                  </div>

                  <div className="p-4 rounded-md bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Initial Buy Amount
                    </p>
                    <p className="font-semibold font-mono text-primary" data-testid="text-review-initial-buy">
                      {form.watch("initialBuyAmount")} SOL
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This SOL will be used to buy the first tokens from your new token
                    </p>
                  </div>

                  {form.watch("description") && (
                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Description
                      </p>
                      <p className="text-sm">{form.watch("description")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="gap-2"
              data-testid="button-deploy-back"
            >
              <ChevronLeft className="h-4 w-4" />
              BACK
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedToStep2() : !canProceedToStep3()}
                className="gap-2"
                data-testid="button-deploy-next"
              >
                NEXT
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={deployMutation.isPending}
                className="gap-2"
                data-testid="button-deploy-submit"
                onClick={() => console.log("Deploy button clicked, form state:", form.getValues(), "errors:", form.formState.errors)}
              >
                {deployMutation.isPending ? "Deploying..." : "Deploy Token"}
                <Rocket className="h-4 w-4" />
              </Button>
            )}
          </div>
          </form>
        </Form>
        </CardContent>
      </Card>
    </div>
  );
}
