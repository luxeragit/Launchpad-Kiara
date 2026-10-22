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
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Wallet as WalletType } from "@shared/schema";

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
  const { toast } = useToast();
  
  const isMountedRef = useRef(true);
  const keyFetchAbortRef = useRef<AbortController | null>(null);

  const { data: wallets, isLoading, refetch, isRefetching } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
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
    mutationFn: (data: CreateWalletForm) =>
      apiRequest("POST", "/api/wallets", data),
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
    mutationFn: (data: ImportWalletForm) =>
      apiRequest("POST", "/api/wallets/import", data),
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
    mutationFn: (data: TransferForm & { fromWalletId: string }) =>
      apiRequest("POST", "/api/wallets/transfer", data),
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
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/wallets/${id}`, undefined),
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
    mutationFn: () => apiRequest("POST", "/api/wallets/refresh", undefined),
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
  const activeCount = wallets?.filter((w) => w.isActive).length || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Wallet Management</h1>
            <p className="text-sm text-muted-foreground">
              Create, import, and manage your Solana wallets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="font-mono">
            {wallets?.length || 0} of {wallets?.length || 0} SHOWN
          </Badge>
          <Badge variant="secondary" className="font-mono">
            {totalBalance.toFixed(4)} TOTAL SOL
          </Badge>
          <Badge variant="secondary">
            {activeCount} ACTIVE
          </Badge>
        </div>
      </div>

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
                NEW
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowImportDialog(true)}
                className="gap-2"
                data-testid="button-import-wallet"
              >
                <Download className="h-4 w-4" />
                IMPORT
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  refetch();
                  refreshBalancesMutation.mutate();
                }}
                disabled={isRefetching || refreshBalancesMutation.isPending}
                className="gap-2"
                data-testid="button-refresh-wallets"
              >
                <RefreshCw className={`h-4 w-4 ${(isRefetching || refreshBalancesMutation.isPending) ? "animate-spin" : ""}`} />
                REFRESH
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="ghost" disabled className="gap-1 text-xs">
                VIEW: ALL
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-2 border-y border-border bg-muted/30 flex-wrap">
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              onClick={() => setShowCreateDialog(true)}
              data-testid="toolbar-create"
            >
              <Plus className="h-3 w-3" /> CREATE
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              onClick={() => setShowImportDialog(true)}
              data-testid="toolbar-import"
            >
              <Download className="h-3 w-3" /> IMPORT
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="gap-1 text-xs" 
              disabled={selectedWallets.length === 0 || downloadMutation.isPending}
              onClick={() => downloadMutation.mutate(selectedWallets)}
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

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
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
                        {(wallet.balance || 0).toFixed(4)}
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
                                  if (!fetchedKeys.has(wallet.id)) {
                                    await toggleKeyVisibility(wallet.id);
                                  }
                                  const key = fetchedKeys.get(wallet.id);
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
                  disabled={createMutation.isPending}
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
              Import an existing Solana wallet using its private key.
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
                  disabled={importMutation.isPending}
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
                      Balance: {(selectedWallet.balance || 0).toFixed(4)} SOL
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
                    disabled={transferMutation.isPending}
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
                      {wallet.label} ({(wallet.balance || 0).toFixed(4)} SOL)
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
              disabled={!fundSourceWallet || !fundAmount || fundMutation.isPending}
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
                      {wallet.label} ({(wallet.balance || 0).toFixed(4)} SOL)
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
                      {wallet.label}: {(wallet.balance || 0).toFixed(4)} SOL
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
              disabled={!consolidateTargetWallet || consolidateMutation.isPending}
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
              disabled={!burnTokenMint || !burnAmount || parseFloat(burnAmount) <= 0 || burnMutation.isPending}
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
  );
}
