import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Plus,
  Download,
  RefreshCw,
  Trash2,
  Send,
  Eye,
  EyeOff,
  Copy,
  MoreHorizontal,
  ArrowDownToLine,
  ArrowUpFromLine,
  Flame,
  Archive,
  Loader2,
  CircleAlert,
  Search,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Wallet as WalletType } from "@shared/schema";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useAuth } from "@/contexts/AuthContext";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { WalletRecords } from "@/components/terminal/wallet-records";

const createWalletFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(50),
});

const importWalletFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(50),
  privateKey: z.string().min(1, "Private key is required"),
});

const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const transferFormSchema = z.object({
  toAddress: z.string()
    .min(32, "Address must be at least 32 characters")
    .max(44, "Address must be at most 44 characters")
    .regex(solanaAddressRegex, "Invalid Solana address format"),
  amount: z.coerce.number().positive("Amount must be positive"),
});

type CreateWalletForm = z.infer<typeof createWalletFormSchema>;
type ImportWalletForm = z.infer<typeof importWalletFormSchema>;
type TransferForm = z.infer<typeof transferFormSchema>;

export default function WalletsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [showFundDialog, setShowFundDialog] = useState(false);
  const [showConsolidateDialog, setShowConsolidateDialog] = useState(false);
  const [showBurnDialog, setShowBurnDialog] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [selectedWallets, setSelectedWallets] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [fetchedKeys, setFetchedKeys] = useState<Map<string, string>>(new Map());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [fundSourceWallet, setFundSourceWallet] = useState<string>("");
  const [fundAmount, setFundAmount] = useState<string>("0.01");
  const [consolidateTargetWallet, setConsolidateTargetWallet] = useState<string>("");
  const [burnTokenMint, setBurnTokenMint] = useState<string>("");
  const [burnAmount, setBurnAmount] = useState<string>("0");
  const [walletSearch, setWalletSearch] = useState("");
  const [walletPane, setWalletPane] = useState<"directory" | "inspector" | "actions">("directory");
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const network = useNetworkStatus();
  const transactionsEnabled = !!network.data?.transactionsEnabled && !network.isError;
  
  const isMountedRef = useRef(true);
  const keyFetchAbortRef = useRef<AbortController | null>(null);

  const { data: wallets, isLoading, isError: walletsError, refetch, isRefetching } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
    enabled: isAuthenticated,
  });

  const clearSensitiveData = useCallback(() => {
    setFetchedKeys(new Map());
    setVisibleKeys(new Set());
    if (keyFetchAbortRef.current) {
      keyFetchAbortRef.current.abort();
      keyFetchAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearSensitiveData();
    };
  }, [clearSensitiveData]);

  useEffect(() => {
    if (!showTransferDialog) {
      clearSensitiveData();
    }
  }, [showTransferDialog, clearSensitiveData]);

  const createForm = useForm<CreateWalletForm>({
    resolver: zodResolver(createWalletFormSchema),
    defaultValues: { label: "" },
  });

  const importForm = useForm<ImportWalletForm>({
    resolver: zodResolver(importWalletFormSchema),
    defaultValues: { label: "", privateKey: "" },
  });

  const transferForm = useForm<TransferForm>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: { toAddress: "", amount: 0 },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateWalletForm) => {
      if (!isAuthenticated) throw new Error("Connect a wallet before creating a managed wallet.");
      return apiRequest("POST", "/api/wallets", data);
    },
    onSuccess: () => {
      toast({ title: "Wallet Created", description: "New wallet has been created" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowCreateDialog(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: (data: ImportWalletForm) => {
      if (!isAuthenticated) throw new Error("Connect a wallet before importing a managed wallet.");
      return apiRequest("POST", "/api/wallets/import", data);
    },
    onSuccess: () => {
      toast({ title: "Wallet Imported", description: "Wallet has been imported" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowImportDialog(false);
      importForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (data: TransferForm & { fromWalletId: string }) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to transfer SOL.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      return apiRequest("POST", "/api/wallets/transfer", data);
    },
    onSuccess: () => {
      toast({ title: "Transfer Initiated", description: "Transaction submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowTransferDialog(false);
      transferForm.reset();
      setSelectedWallet(null);
    },
    onError: (error: Error) => {
      toast({ title: "Transfer Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to manage wallets.");
      return apiRequest("DELETE", `/api/wallets/${id}`, undefined);
    },
    onSuccess: () => {
      toast({ title: "Wallet Deleted", description: "Wallet has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowDeleteDialog(false);
      setSelectedWallet(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const refreshBalancesMutation = useMutation({
    mutationFn: () => {
      if (!isAuthenticated) throw new Error("Connect your wallet to refresh balances.");
      return apiRequest("POST", "/api/wallets/refresh", undefined);
    },
    onSuccess: () => {
      toast({ title: "Balances Updated", description: "All wallet balances refreshed" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (walletIds: string[]) => {
      if (!isAuthenticated) throw new Error("Connect your wallet before exporting wallet information.");
      const response = await apiRequest("POST", "/api/wallets/download", { walletIds });
      return response.json();
    },
    onSuccess: (data: { label: string; address: string; privateKey: string }[]) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallets-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download Complete", description: `Exported ${data.length} wallet(s)` });
    },
    onError: (error: Error) => {
      toast({ title: "Download Failed", description: error.message, variant: "destructive" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error("Connect your wallet to manage wallets.");
      const response = await apiRequest("POST", "/api/wallets/cleanup", undefined);
      return response.json();
    },
    onSuccess: (data: { deleted: number }) => {
      toast({ title: "Cleanup Complete", description: `Deleted ${data.deleted} wallet(s) with zero balance` });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowCleanupDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Cleanup Failed", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (walletId: string) => {
      if (!isAuthenticated) throw new Error("Connect your wallet to manage wallets.");
      const response = await apiRequest("POST", `/api/wallets/${walletId}/archive`, undefined);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Archive Status Updated", description: "Wallet archive status toggled" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
    onError: (error: Error) => {
      toast({ title: "Archive Failed", description: error.message, variant: "destructive" });
    },
  });

  const fundMutation = useMutation({
    mutationFn: async (data: { sourceWalletId: string; targetWalletIds: string[]; amountPerWallet: number }) => {
      if (!isAuthenticated) throw new Error("Connect your wallet before funding wallets.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      const response = await apiRequest("POST", "/api/wallets/fund", data);
      return response.json();
    },
    onSuccess: (data: { funded: number }) => {
      toast({ title: "Funding Complete", description: `Funded ${data.funded} wallet(s)` });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowFundDialog(false);
      setFundSourceWallet("");
      setFundAmount("0.01");
    },
    onError: (error: Error) => {
      toast({ title: "Funding Failed", description: error.message, variant: "destructive" });
    },
  });

  const consolidateMutation = useMutation({
    mutationFn: async (data: { sourceWalletIds: string[]; targetWalletId: string }) => {
      if (!isAuthenticated) throw new Error("Connect your wallet before consolidating funds.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      const response = await apiRequest("POST", "/api/wallets/consolidate", data);
      return response.json();
    },
    onSuccess: (data: { consolidated: number; totalConsolidated: number }) => {
      toast({ 
        title: "Consolidation Complete", 
        description: `Consolidated ${data.totalConsolidated.toFixed(4)} SOL from ${data.consolidated} wallet(s)` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setShowConsolidateDialog(false);
      setConsolidateTargetWallet("");
      setSelectedWallets([]);
    },
    onError: (error: Error) => {
      toast({ title: "Consolidation Failed", description: error.message, variant: "destructive" });
    },
  });

  const burnMutation = useMutation({
    mutationFn: async (data: { walletId: string; tokenMint: string; amount: number }) => {
      if (!isAuthenticated) throw new Error("Connect your wallet before burning tokens.");
      if (!transactionsEnabled) throw new Error(network.data?.reason || "Network safety has not been verified.");
      const response = await apiRequest("POST", "/api/wallets/burn", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Tokens Burned Successfully", 
        description: data.signature ? `TX: ${data.signature.slice(0, 20)}...` : `Burned ${data.amount} tokens`
      });
      setShowBurnDialog(false);
      setBurnTokenMint("");
      setBurnAmount("0");
    },
    onError: (error: Error) => {
      toast({ title: "Burn Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleArchiveSelected = async () => {
    for (const walletId of selectedWallets) {
      await archiveMutation.mutateAsync(walletId);
    }
    setSelectedWallets([]);
  };

  const toggleKeyVisibility = async (id: string) => {
    if (visibleKeys.has(id)) {
      setVisibleKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      return;
    }
    if (!isAuthenticated) {
      toast({ title: "Connect to reveal a key", description: "Private keys are only available to the signed-in wallet session.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Reveal this wallet's private key on screen? Anyone who sees it can control the funds.")) return;
    
    if (!fetchedKeys.has(id)) {
      if (keyFetchAbortRef.current) {
        keyFetchAbortRef.current.abort();
      }
      const abortController = new AbortController();
      keyFetchAbortRef.current = abortController;
      
      setLoadingKeys((prev) => new Set(prev).add(id));
      try {
        const response = await fetch(`/api/wallets/${id}/key`, {
          signal: abortController.signal,
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch key");
        const data = await response.json();
        
        if (!isMountedRef.current || abortController.signal.aborted) {
          return;
        }
        
        setFetchedKeys((prev) => new Map(prev).set(id, data.privateKey));
        toast({
          title: "Security Warning",
          description: "Keep your private key safe. Never share it with anyone.",
          variant: "destructive",
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          setLoadingKeys((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          return;
        }
        if (isMountedRef.current) {
          toast({ title: "Error", description: "Failed to fetch private key", variant: "destructive" });
        }
        setLoadingKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        return;
      }
      setLoadingKeys((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
    
    if (isMountedRef.current) {
      setVisibleKeys((prev) => new Set(prev).add(id));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const toggleWalletSelection = (id: string) => {
    setSelectedWallets((prev) =>
      prev.includes(id) ? prev.filter((wId) => wId !== id) : [...prev, id]
    );
  };

  const selectAllWallets = () => {
    if (selectedWallets.length === (wallets?.length || 0)) {
      setSelectedWallets([]);
    } else {
      setSelectedWallets(wallets?.map((w) => w.id) || []);
    }
  };

  const totalBalance = wallets?.reduce((sum, w) => sum + (w.balance || 0), 0) || 0;
  const balanceKnown = !!wallets && wallets.every((wallet) => wallet.balance !== null && wallet.balance !== undefined);
  const activeCount = wallets?.filter((w) => w.isActive).length || 0;

  return (
    <div className="terminal-workspace flex min-h-0 flex-col">
      <div className="flex min-h-11 items-center gap-3 border-b border-border px-3">
        <Wallet className="h-4 w-4 text-sky-400" />
        <h1 className="text-[13px] font-semibold">Wallet operations</h1>
        <span className="text-[10px] text-muted-foreground">MANAGED ASSETS</span>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          <span className={`h-1.5 w-1.5 rounded-full ${transactionsEnabled ? "bg-emerald-400" : "bg-rose-400"}`} />
          {transactionsEnabled ? "Execution ready" : "Transactions paused"}
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { refetch(); refreshBalancesMutation.mutate(); }} disabled={!isAuthenticated || isRefetching || refreshBalancesMutation.isPending} data-testid="button-refresh-wallets"><RefreshCw className={`mr-1 h-3 w-3 ${isRefetching || refreshBalancesMutation.isPending ? "animate-spin" : ""}`} />Refresh</Button>
        </div>
      </div>
      <nav className="flex border-b border-border xl:hidden" aria-label="Wallet workspace panels">
        {(["directory", "inspector", "actions"] as const).map(pane => <button key={pane} type="button" onClick={() => setWalletPane(pane)} aria-current={walletPane === pane ? "page" : undefined} className={`flex-1 px-3 py-2 text-[10px] capitalize ${walletPane === pane ? "border-b-2 border-sky-400 text-foreground" : "text-muted-foreground"}`}>{pane === "actions" ? "Actions & activity" : pane}</button>)}
      </nav>
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(250px,0.86fr)_minmax(300px,1.08fr)_minmax(280px,0.9fr)]">
        <section className={`terminal-panel min-h-0 ${walletPane !== "directory" ? "hidden xl:flex" : ""}`} data-testid="wallet-directory">
          <header className="terminal-panel-header"><div><h2 className="text-[12px] font-semibold">Wallet directory</h2><p className="text-[10px] text-muted-foreground">{isAuthenticated && wallets ? `${wallets.length} managed · ${activeCount} active` : "Private session data"}</p></div><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreateDialog(true)} aria-label="Create wallet" data-testid="button-create-wallet"><Plus className="h-4 w-4" /></Button></header>
          <div className="border-b border-border p-2"><div className="relative"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" /><Input value={walletSearch} onChange={e => setWalletSearch(e.target.value)} placeholder="Search label or address" className="h-8 pl-7 text-[11px]" aria-label="Search wallets" /></div><div className="mt-2 flex gap-1"><Button size="sm" variant="outline" className="h-7 flex-1 text-[10px]" onClick={() => setShowCreateDialog(true)} data-testid="button-create-wallet-empty"><Plus className="mr-1 h-3 w-3" />Create</Button><Button size="sm" variant="outline" className="h-7 flex-1 text-[10px]" onClick={() => setShowImportDialog(true)} data-testid="button-import-wallet-empty"><Download className="mr-1 h-3 w-3" />Import</Button></div></div>
          <div className="terminal-scroll min-h-0 flex-1">
            {authLoading || (isAuthenticated && isLoading) ? <div className="space-y-2 p-3">{[1,2,3].map(n => <div key={n} className="h-14 animate-pulse bg-secondary/60" />)}</div>
              : !isAuthenticated ? <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-4 text-center"><img src="/kiara.png" alt="" className="h-16 w-16 object-contain" /><p className="text-xs font-medium">Wallet directory is disconnected</p><p className="text-[10px] text-muted-foreground">Connect to load this session’s private managed wallets.</p><WalletConnectButton /></div>
              : walletsError ? <div className="p-4 text-center text-xs"><CircleAlert className="mx-auto mb-2 h-5 w-5 text-destructive" />Wallet list unavailable<Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>Retry</Button></div>
              : !wallets?.length ? <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-4 text-center"><img src="/kiara.png" alt="" className="h-14 w-14 object-contain" /><p className="text-xs">No managed wallets</p><p className="text-[10px] text-muted-foreground">Create or import a wallet to populate this directory.</p></div>
              : wallets.filter(w => `${w.label} ${w.address}`.toLowerCase().includes(walletSearch.toLowerCase())).map(wallet => <button key={wallet.id} type="button" onClick={() => { setSelectedWallet(wallet); setSelectedWallets(prev => prev.includes(wallet.id) ? prev.filter(id => id !== wallet.id) : [...prev, wallet.id]); }} aria-pressed={selectedWallets.includes(wallet.id)} className={`w-full border-b border-border px-3 py-3 text-left transition-colors hover:bg-secondary/60 ${selectedWallet?.id === wallet.id ? "bg-secondary/70" : ""}`} data-testid={`row-wallet-${wallet.id}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{wallet.label}</span><span className={`text-[9px] ${wallet.isArchived ? "text-muted-foreground" : wallet.isActive ? "text-emerald-400" : "text-amber-300"}`}>{wallet.isArchived ? "ARCHIVED" : wallet.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
                <div className="mt-1 flex items-center justify-between gap-2"><code className="truncate font-mono text-[10px] text-muted-foreground">{wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}</code><span className="shrink-0 font-mono text-[10px] tabular-nums">{wallet.balance == null ? "—" : `${wallet.balance.toFixed(4)} SOL`}</span></div>
                <div className="mt-1 text-[9px] text-muted-foreground">{wallet.walletType || "created"}</div>
              </button>)}
          </div>
          <div className="flex items-center justify-between border-t border-border p-2 text-[10px]"><span className="text-muted-foreground">Batch selection · {selectedWallets.length}</span><button type="button" className="text-sky-400 hover:underline" onClick={selectAllWallets} data-testid="checkbox-select-all">{selectedWallets.length === (wallets?.length || 0) ? "Clear all" : "Select all"}</button></div>
        </section>

        <section className={`terminal-panel min-h-0 border-t-0 xl:border-l-0 ${walletPane !== "inspector" ? "hidden xl:flex" : ""}`} data-testid="wallet-inspector">
          <header className="terminal-panel-header"><div><h2 className="text-[12px] font-semibold">Wallet inspector</h2><p className="text-[10px] text-muted-foreground">Verified account details</p></div><Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { refetch(); refreshBalancesMutation.mutate(); }} disabled={!isAuthenticated || refreshBalancesMutation.isPending}><RefreshCw className="mr-1 h-3 w-3" />Refresh</Button></header>
          {selectedWallet ? <div className="terminal-scroll min-h-0 flex-1 p-3">
            <div className="border-b border-border pb-3"><div className="text-[10px] text-muted-foreground">SELECTED WALLET</div><h3 className="mt-1 text-sm font-semibold">{selectedWallet.label}</h3><div className="mt-2 flex items-start gap-2"><code className="min-w-0 flex-1 break-all font-mono text-[10px] leading-5 text-muted-foreground">{selectedWallet.address}</code><Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(selectedWallet.address, "Address")} aria-label="Copy address"><Copy className="h-3.5 w-3.5" /></Button></div></div>
            <div className="border-b border-border py-4"><div className="text-[10px] text-muted-foreground">SOL BALANCE</div><div className="mt-1 font-mono text-2xl tabular-nums">{selectedWallet.balance == null ? "—" : selectedWallet.balance.toFixed(4)} <span className="text-xs text-muted-foreground">SOL</span></div><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { setSelectedWallet(selectedWallet); setShowDepositDialog(true); }}><ArrowDownToLine className="mr-1 h-3 w-3" />Receive</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { setSelectedWallet(selectedWallet); setShowTransferDialog(true); }}><Send className="mr-1 h-3 w-3" />Transfer</Button></div></div>
            <WalletRecords walletId={selectedWallet.id} isAuthenticated={isAuthenticated} />
            <div className="border-t border-border py-3"><div className="mb-2 text-[11px] font-medium">Key custody</div><div className="flex items-center gap-2"><code className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">{visibleKeys.has(selectedWallet.id) && fetchedKeys.has(selectedWallet.id) ? fetchedKeys.get(selectedWallet.id) : "Private key hidden"}</code><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleKeyVisibility(selectedWallet.id)} disabled={loadingKeys.has(selectedWallet.id)} data-testid={`button-toggle-key-${selectedWallet.id}`}>{loadingKeys.has(selectedWallet.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : visibleKeys.has(selectedWallet.id) ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}{visibleKeys.has(selectedWallet.id) ? "Hide" : "Reveal"}</Button></div><p className="mt-1 text-[9px] text-amber-300/80">Reveal requires explicit confirmation; key data is cleared when the page closes.</p></div>
          </div> : <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-4 text-center"><img src="/kiara.png" alt="" className="h-16 w-16 object-contain" /><p className="text-xs font-medium">Select a wallet to inspect</p><p className="text-[10px] text-muted-foreground">Balances appear only when returned by the authenticated wallet service.</p></div>}
        </section>

        <section className={`terminal-panel min-h-0 border-t-0 xl:border-l-0 ${walletPane !== "actions" ? "hidden xl:flex" : ""}`} data-testid="wallet-actions">
          <header className="terminal-panel-header"><div><h2 className="text-[12px] font-semibold">Actions &amp; activity</h2><p className="text-[10px] text-muted-foreground">{transactionsEnabled ? "Network execution available" : network.data?.reason || "Network safety not verified"}</p></div></header>
          <div className="terminal-scroll min-h-0 flex-1 p-3">
            {!isAuthenticated && <div className="mb-3 border border-border p-2 text-[10px] text-muted-foreground">Wallet mutations require the existing authenticated session.</div>}
            <div className="mb-2 text-[9px] font-semibold text-muted-foreground">EVERYDAY</div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="outline" className="justify-start text-[10px]" onClick={() => setShowCreateDialog(true)} data-testid="button-create-wallet"><Plus className="mr-1 h-3 w-3" />Create</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" onClick={() => setShowImportDialog(true)} data-testid="button-import-wallet"><Download className="mr-1 h-3 w-3" />Import</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallet} onClick={() => setShowDepositDialog(true)}><ArrowDownToLine className="mr-1 h-3 w-3" />Receive</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallet} onClick={() => setShowTransferDialog(true)} data-testid="toolbar-transfer"><Send className="mr-1 h-3 w-3" />Transfer SOL</Button>
            </div>
            <div className="mb-2 mt-4 text-[9px] font-semibold text-muted-foreground">SELECTED · {selectedWallets.length}</div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallets.length || downloadMutation.isPending} onClick={() => { if (window.confirm("Export selected private keys to a JSON file? Store securely; anyone with this file can control these wallets.")) downloadMutation.mutate(selectedWallets); }} data-testid="toolbar-download"><ArrowDownToLine className="mr-1 h-3 w-3" />Export JSON</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallets.length || archiveMutation.isPending} onClick={handleArchiveSelected} data-testid="toolbar-archive"><Archive className="mr-1 h-3 w-3" />Archive</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallets.length || !transactionsEnabled} onClick={() => setShowFundDialog(true)} data-testid="toolbar-fund"><ArrowUpFromLine className="mr-1 h-3 w-3" />Fund</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallets.length || !transactionsEnabled} onClick={() => setShowConsolidateDialog(true)} data-testid="toolbar-consolidate"><ArrowDownToLine className="mr-1 h-3 w-3" />Consolidate</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallet} onClick={() => setShowBurnDialog(true)} data-testid="toolbar-burn"><Flame className="mr-1 h-3 w-3" />Burn SPL</Button>
              <Button size="sm" variant="outline" className="justify-start text-[10px]" disabled={!selectedWallet} onClick={() => setShowDeleteDialog(true)}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-3 w-full justify-start text-[10px] text-destructive" onClick={() => setShowCleanupDialog(true)} data-testid="toolbar-cleanup"><Trash2 className="mr-2 h-3 w-3" />Cleanup zero-balance wallets…</Button>
            <div className="mt-4 border-t border-border pt-3"><div className="mb-1 text-[9px] font-semibold text-muted-foreground">TRANSACTION GATE</div><p className="text-[10px] leading-4 text-muted-foreground">{network.data?.reason || (transactionsEnabled ? "Network safety verification is enabled." : "Financial operations remain disabled until the configured network is verified.")}</p></div>
          </div>
        </section>
      </div>
      <div className="hidden">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[.16em] text-primary">Wallet control center</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Your wallets</h1>
            <p className="mt-1 text-sm text-muted-foreground">Balances, signing wallets, and wallet operations in one place.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="rounded-md border bg-card px-3 py-2"><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Wallets</span><span className="font-mono font-semibold">{isAuthenticated ? wallets?.length ?? "—" : "—"}</span></div>
          <div className="rounded-md border bg-card px-3 py-2"><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Combined SOL</span><span className="font-mono font-semibold">{isAuthenticated && balanceKnown ? totalBalance.toFixed(4) : "—"}</span></div>
          <div className="rounded-md border bg-card px-3 py-2"><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Active</span><span className="font-mono font-semibold">{isAuthenticated && wallets ? activeCount : "—"}</span></div>
        </div>
      </div>

      {!authLoading && !isAuthenticated && (
        <Card className="border-primary/25 bg-primary/[.035]">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div><p className="font-semibold">Connect to load your wallet portfolio</p><p className="mt-1 text-sm text-muted-foreground">Wallet data is private. You can open create or import forms now; changes require the existing signed-in wallet session.</p></div>
            </div>
            <WalletConnectButton />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="gap-2"
                data-testid="button-create-wallet"
              >
                <Plus className="h-4 w-4" />
                Create wallet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                className="gap-2"
                data-testid="button-import-wallet"
              >
                <Download className="h-4 w-4" />
                Import wallet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  refetch();
                  refreshBalancesMutation.mutate();
                }}
                disabled={!isAuthenticated || isRefetching || refreshBalancesMutation.isPending}
                className="gap-2"
                data-testid="button-refresh-wallets"
              >
                <RefreshCw className={`h-4 w-4 ${(isRefetching || refreshBalancesMutation.isPending) ? "animate-spin" : ""}`} />
                Refresh balances
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground">Select wallets to manage them</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-2 border-y border-border bg-muted/30 flex-wrap">
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length === 0 || downloadMutation.isPending}
              onClick={() => {
                if (window.confirm("Export selected private keys to a JSON file? Store it securely; anyone with the file can control these wallets.")) {
                  downloadMutation.mutate(selectedWallets);
                }
              }}
              data-testid="toolbar-download"
            >
              {downloadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />} DOWNLOAD
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs"
              onClick={() => setShowCleanupDialog(true)}
              data-testid="toolbar-cleanup"
            >
              <Trash2 className="h-3 w-3" /> CLEANUP
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length === 0 || archiveMutation.isPending}
              onClick={handleArchiveSelected}
              data-testid="toolbar-archive"
            >
              {archiveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />} ARCHIVE
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length === 0}
              onClick={() => setShowFundDialog(true)}
              data-testid="toolbar-fund"
            >
              <ArrowUpFromLine className="h-3 w-3" /> FUND
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length === 0}
              onClick={() => setShowConsolidateDialog(true)}
              data-testid="toolbar-consolidate"
            >
              <ArrowDownToLine className="h-3 w-3" /> CONSOLIDATE
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length !== 1}
              onClick={() => {
                if (selectedWallets.length === 1) {
                  const wallet = wallets?.find(w => w.id === selectedWallets[0]);
                  if (wallet) {
                    setSelectedWallet(wallet);
                    setShowTransferDialog(true);
                  }
                }
              }}
              data-testid="toolbar-transfer"
            >
              <Send className="h-3 w-3" /> TRANSFER
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length !== 1}
              onClick={() => {
                if (selectedWallets.length === 1) {
                  const wallet = wallets?.find(w => w.id === selectedWallets[0]);
                  if (wallet) {
                    setSelectedWallet(wallet);
                    setShowBurnDialog(true);
                  }
                }
              }}
              data-testid="toolbar-burn"
            >
              <Flame className="h-3 w-3" /> BURN
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length !== 1}
              onClick={() => {
                if (selectedWallets.length === 1) {
                  const wallet = wallets?.find(w => w.id === selectedWallets[0]);
                  if (wallet) {
                    setSelectedWallet(wallet);
                    setShowDepositDialog(true);
                  }
                }
              }}
              data-testid="toolbar-deposit"
            >
              <ArrowDownToLine className="h-3 w-3" /> DEPOSIT
            </Button>
            {selectedWallets.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {selectedWallets.length} selected
              </Badge>
            )}
          </div>

          {authLoading || (isAuthenticated && isLoading) ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !isAuthenticated ? (
            <div className="px-5 py-12 text-center">
              <Wallet className="mx-auto mb-4 h-10 w-10 text-primary/70" />
              <h2 className="font-display text-lg font-semibold">Your portfolio stays private until you connect</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Connect Phantom or Solflare through KiaraFun’s existing signature flow to load balances and actions.</p>
              <div className="mt-4 flex justify-center"><WalletConnectButton /></div>
            </div>
          ) : walletsError ? (
            <div className="px-5 py-12 text-center">
              <CircleAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <p className="font-semibold">Wallets could not be loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">Your balances are not available. Nothing has been changed.</p>
              <Button className="mt-4" variant="outline" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : !wallets || wallets.length === 0 ? (
            <div className="text-center py-16">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No wallets found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Create or import a wallet to get started
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="gap-2"
                  data-testid="button-create-wallet-empty"
                >
                  <Plus className="h-4 w-4" />
                  Create Wallet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(true)}
                  className="gap-2"
                  data-testid="button-import-wallet-empty"
                >
                  <Download className="h-4 w-4" />
                  Import Wallet
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedWallets.length === wallets.length}
                        onCheckedChange={selectAllWallets}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>LABEL</TableHead>
                    <TableHead className="w-20">QUICKMODE</TableHead>
                    <TableHead className="w-24">TYPE</TableHead>
                    <TableHead>ADDRESS</TableHead>
                    <TableHead className="text-right">SOL BALANCE</TableHead>
                    <TableHead>PRIVATE KEY</TableHead>
                    <TableHead className="w-20">ACTIONS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.map((wallet) => (
                    <TableRow key={wallet.id} data-testid={`row-wallet-${wallet.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedWallets.includes(wallet.id)}
                          onCheckedChange={() => toggleWalletSelection(wallet.id)}
                          data-testid={`checkbox-wallet-${wallet.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{wallet.label}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={wallet.isActive ? "default" : "secondary"}
                          size="sm"
                        >
                          {wallet.isActive ? "ON" : "OFF"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" size="sm">
                          {wallet.walletType || "created"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-muted-foreground">
                            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                          </code>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(wallet.address, "Address")}
                                data-testid={`button-copy-address-${wallet.id}`}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy address</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {wallet.balance != null ? wallet.balance.toFixed(4) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-muted-foreground">
                            {loadingKeys.has(wallet.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : visibleKeys.has(wallet.id) && fetchedKeys.has(wallet.id) ? (
                              `${fetchedKeys.get(wallet.id)!.slice(0, 12)}...`
                            ) : (
                              "••••••••••••"
                            )}
                          </code>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => toggleKeyVisibility(wallet.id)}
                                disabled={loadingKeys.has(wallet.id)}
                                data-testid={`button-toggle-key-${wallet.id}`}
                              >
                                {loadingKeys.has(wallet.id) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : visibleKeys.has(wallet.id) ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {visibleKeys.has(wallet.id) ? "Hide" : "Reveal"} key
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={async () => {
                                  if (!isAuthenticated) return;
                                  if (!window.confirm("Copy this private key to your clipboard? Anyone who can access it can control the funds.")) return;
                                  let key = fetchedKeys.get(wallet.id);
                                  if (!key) {
                                    setLoadingKeys((prev) => new Set(prev).add(wallet.id));
                                    try {
                                      const response = await fetch(`/api/wallets/${wallet.id}/key`, { credentials: "include" });
                                      if (!response.ok) throw new Error("Private key could not be loaded.");
                                      const data = await response.json();
                                      key = data.privateKey;
                                      setFetchedKeys((prev) => new Map(prev).set(wallet.id, key!));
                                    } catch (error) {
                                      toast({ title: "Could not copy key", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
                                    } finally {
                                      setLoadingKeys((prev) => {
                                        const next = new Set(prev);
                                        next.delete(wallet.id);
                                        return next;
                                      });
                                    }
                                  }
                                  if (key) copyToClipboard(key, "Private key");
                                }}
                                disabled={loadingKeys.has(wallet.id)}
                                data-testid={`button-copy-key-${wallet.id}`}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy private key</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-wallet-actions-${wallet.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedWallet(wallet);
                                setShowDepositDialog(true);
                              }}
                              data-testid={`action-deposit-${wallet.id}`}
                            >
                              <ArrowDownToLine className="h-4 w-4 mr-2" />
                              Deposit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedWallet(wallet);
                                setShowTransferDialog(true);
                              }}
                              data-testid={`action-transfer-${wallet.id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Transfer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedWallet(wallet);
                                setShowDeleteDialog(true);
                              }}
                              data-testid={`action-delete-${wallet.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Wallet</DialogTitle>
            <DialogDescription>
              Generate a new Solana wallet. The private key will be shown once.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))}>
              <FormField
                control={createForm.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wallet Label</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="My Wallet"
                        {...field}
                        data-testid="input-wallet-label"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !isAuthenticated}
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Wallet
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Wallet</DialogTitle>
            <DialogDescription>
              Add a signing key to KiaraFun&apos;s managed-wallet workflow. This is different from connecting an external browser wallet. Only import a key you intend to manage here.
            </DialogDescription>
          </DialogHeader>
          <Form {...importForm}>
            <form onSubmit={importForm.handleSubmit((data) => importMutation.mutate(data))}>
              <div className="space-y-4">
                <FormField
                  control={importForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet Label</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Imported Wallet"
                          {...field}
                          data-testid="input-import-label"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={importForm.control}
                  name="privateKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Private Key (Base58)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter private key..."
                          type="password"
                          {...field}
                          data-testid="input-import-privatekey"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowImportDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={importMutation.isPending || !isAuthenticated}
                  data-testid="button-confirm-import"
                >
                  {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import Wallet
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit SOL</DialogTitle>
            <DialogDescription>
              Send SOL to this wallet address
            </DialogDescription>
          </DialogHeader>
          {selectedWallet && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeSVG value={selectedWallet.address} size={180} />
                </div>
              </div>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm break-all flex-1">
                    {selectedWallet.address}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedWallet.address, "Address")}
                    data-testid="button-copy-deposit-address"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Send SOL to this address on Solana mainnet
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer SOL</DialogTitle>
            <DialogDescription>
              Send SOL from {selectedWallet?.label} to another address
            </DialogDescription>
          </DialogHeader>
          {selectedWallet && (
            <Form {...transferForm}>
              <form
                onSubmit={transferForm.handleSubmit((data) =>
                  transferMutation.mutate({ ...data, fromWalletId: selectedWallet.id })
                )}
              >
                <div className="space-y-4">
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs text-muted-foreground">From Wallet</p>
                    <p className="font-medium">{selectedWallet.label}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      Balance: {selectedWallet.balance != null ? `${selectedWallet.balance.toFixed(4)} SOL` : "Balance unavailable"}
                    </p>
                  </div>
                  <FormField
                    control={transferForm.control}
                    name="toAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Solana address..."
                            {...field}
                            data-testid="input-transfer-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={transferForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (SOL)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="0.0"
                            {...field}
                            data-testid="input-transfer-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTransferDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={transferMutation.isPending || !transactionsEnabled}
                    data-testid="button-confirm-transfer"
                  >
                    {transferMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Transfer SOL
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedWallet?.label}"? This action cannot be undone.
              Make sure you have backed up the private key if you need it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedWallet && deleteMutation.mutate(selectedWallet.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Wallet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cleanup Zero Balance Wallets</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all wallets with zero balance. This action cannot be undone.
              Make sure you have backed up any private keys you need.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cleanup">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cleanupMutation.mutate()}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-cleanup"
            >
              {cleanupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Zero Balance Wallets
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showFundDialog} onOpenChange={setShowFundDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Selected Wallets</DialogTitle>
            <DialogDescription>
              Send SOL from a source wallet to {selectedWallets.length} selected wallet(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Source Wallet</label>
              <Select value={fundSourceWallet} onValueChange={setFundSourceWallet}>
                <SelectTrigger data-testid="select-fund-source">
                  <SelectValue placeholder="Select source wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets?.filter(w => !selectedWallets.includes(w.id)).map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {wallet.label} ({wallet.balance != null ? `${wallet.balance.toFixed(4)} SOL` : "Balance unavailable"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Amount per Wallet (SOL)</label>
              <Input
                type="number"
                step="0.001"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="0.01"
                data-testid="input-fund-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Total: {(parseFloat(fundAmount) * selectedWallets.length).toFixed(4)} SOL
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowFundDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!fundSourceWallet || !fundAmount || fundMutation.isPending || !transactionsEnabled}
              onClick={() => {
                fundMutation.mutate({
                  sourceWalletId: fundSourceWallet,
                  targetWalletIds: selectedWallets,
                  amountPerWallet: parseFloat(fundAmount),
                });
              }}
              data-testid="button-confirm-fund"
            >
              {fundMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Fund Wallets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConsolidateDialog} onOpenChange={setShowConsolidateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consolidate SOL</DialogTitle>
            <DialogDescription>
              Collect all SOL from {selectedWallets.length} selected wallet(s) to a target wallet.
              A minimum of 0.001 SOL will be kept in each source for rent exemption.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Target Wallet</label>
              <Select value={consolidateTargetWallet} onValueChange={setConsolidateTargetWallet}>
                <SelectTrigger data-testid="select-consolidate-target">
                  <SelectValue placeholder="Select target wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets?.filter(w => !selectedWallets.includes(w.id)).map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {wallet.label} ({wallet.balance != null ? `${wallet.balance.toFixed(4)} SOL` : "Balance unavailable"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Selected Wallets to Consolidate:</p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                {selectedWallets.map((id) => {
                  const wallet = wallets?.find((w) => w.id === id);
                  return wallet ? (
                    <li key={id}>
                      {wallet.label}: {wallet.balance != null ? `${wallet.balance.toFixed(4)} SOL` : "Balance unavailable"}
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowConsolidateDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!consolidateTargetWallet || consolidateMutation.isPending || !transactionsEnabled}
              onClick={() => {
                consolidateMutation.mutate({
                  sourceWalletIds: selectedWallets,
                  targetWalletId: consolidateTargetWallet,
                });
              }}
              data-testid="button-confirm-consolidate"
            >
              {consolidateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Consolidate SOL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBurnDialog} onOpenChange={setShowBurnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Burn SPL Tokens</DialogTitle>
            <DialogDescription>
              Burn SPL tokens from {selectedWallet?.label}. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Token Mint Address</label>
              <Input
                value={burnTokenMint}
                onChange={(e) => setBurnTokenMint(e.target.value)}
                placeholder="Token mint address..."
                data-testid="input-burn-token-mint"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Amount to Burn</label>
              <Input
                type="number"
                step="1"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="0"
                data-testid="input-burn-amount"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowBurnDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!burnTokenMint || !burnAmount || parseFloat(burnAmount) <= 0 || burnMutation.isPending || !transactionsEnabled}
              onClick={() => {
                if (selectedWallet) {
                  burnMutation.mutate({
                    walletId: selectedWallet.id,
                    tokenMint: burnTokenMint,
                    amount: parseFloat(burnAmount),
                  });
                }
              }}
              data-testid="button-confirm-burn"
            >
              {burnMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Burn Tokens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
