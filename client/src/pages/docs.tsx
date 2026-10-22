import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Wallet,
  Rocket,
  Activity,
  Shield,
  Database,
  Globe,
  Zap,
  Lock,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Settings,
  ArrowRightLeft,
  FileCode,
  Server,
} from "lucide-react";
import { Link } from "wouter";
import { ArrowUpRight, CircleCheck } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="docs-page flex h-full min-w-0 flex-col">
      <div className="border-b bg-card/70 px-4 py-5 sm:px-6">
        <div className="page-frame">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Field guide</p>
          <h1 className="font-display text-2xl font-semibold" data-testid="text-docs-title">Documentation</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Practical instructions for your wallets, token launches, and market tools—with limits stated plainly.
          </p>
        </div>
      </div>

      <ScrollArea className="min-w-0 w-full max-w-full flex-1 overflow-hidden">
        <div className="page-frame space-y-6 py-5 sm:py-7">
          <Tabs defaultValue="overview" className="w-full min-w-0 max-w-full">
            <div className="w-full overflow-x-auto pb-1">
            <TabsList className="grid w-[520px] grid-cols-5 md:w-full" data-testid="tabs-docs">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
              <TabsTrigger value="api" data-testid="tab-api">API</TabsTrigger>
              <TabsTrigger value="trading" data-testid="tab-trading">Trading</TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
            </TabsList>
            </div>

            <TabsContent value="overview" className="mt-6 min-w-0 max-w-full space-y-6">
              <div className="flex flex-col justify-between gap-5 overflow-hidden rounded-lg border border-primary/20 bg-[linear-gradient(110deg,hsl(var(--primary)/.09),hsl(var(--card))_65%)] p-5 sm:flex-row sm:items-center sm:p-6">
                <div className="max-w-xl">
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Before a financial action</p>
                  <h2 className="mt-2 font-display text-xl font-semibold">Check the network, then check the action.</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The server independently enforces its mainnet approval gate. A mismatched or unverifiable network pauses financial controls; the interface cannot override that policy.</p>
                </div>
                <div className="flex min-w-[180px] items-center gap-2 rounded-md border bg-card/80 px-3 py-3 text-xs font-medium"><CircleCheck className="h-4 w-4 shrink-0 text-primary" />Status stays visible across the app</div>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Welcome to KiaraFun
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    KiaraFun brings token discovery, wallet management, Pump.fun launch requests, and configurable trade monitoring into one Solana workspace. Review the active network status before any financial action.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="flex flex-col gap-2 p-4 rounded-md border">
                      <Wallet className="h-8 w-8 text-primary" />
                      <h3 className="font-semibold">Wallet Management</h3>
                      <p className="text-sm text-muted-foreground">
                        Create, import, and manage multiple Solana wallets with encrypted storage
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 p-4 rounded-md border">
                      <Rocket className="h-8 w-8 text-primary" />
                      <h3 className="font-semibold">Token Deployment</h3>
                      <p className="text-sm text-muted-foreground">
                        Submit live Pump.fun launches. Bonk.fun and Meteora are configuration-only selections; live launch is not implemented.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 p-4 rounded-md border">
                      <Activity className="h-8 w-8 text-primary" />
                      <h3 className="font-semibold">Trade Monitoring</h3>
                      <p className="text-sm text-muted-foreground">
                        Real-time token feeds with trending and top movers analysis
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Quick Start
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1 shrink-0">1</Badge>
                      <div>
                        <h4 className="font-medium">Connect Wallet</h4>
                        <p className="text-sm text-muted-foreground">
                          Click "Connect Wallet" and authorize with Phantom or Solflare
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1 shrink-0">2</Badge>
                      <div>
                        <h4 className="font-medium">Create/Import Wallets</h4>
                        <p className="text-sm text-muted-foreground">
                          Go to Wallets page to set up your trading wallets
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1 shrink-0">3</Badge>
                      <div>
                        <h4 className="font-medium">Fund Wallets</h4>
                        <p className="text-sm text-muted-foreground">
                          Transfer SOL to your trading wallets
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1 shrink-0">4</Badge>
                      <div>
                        <h4 className="font-medium">Configure Trading</h4>
                        <p className="text-sm text-muted-foreground">
                          Set up auto-buy filters on the Monitor page
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <Badge variant="outline" className="mt-1 shrink-0">5</Badge>
                      <div>
                        <h4 className="font-medium">Start Monitoring</h4>
                        <p className="text-sm text-muted-foreground">
                          Enable monitoring to auto-buy matching tokens
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="flex flex-wrap items-center gap-2 border-t pt-5">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Go to a task</span>
                <Link href="/wallets" className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50">Create or import a wallet</Link>
                <Link href="/" className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50">Explore tokens</Link>
                <Link href="/deploy" className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50">Create a launch</Link>
                <Link href="/monitor" className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50">Configure monitoring</Link>
                <Link href="/my-tokens" className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-primary/50">Manage your tokens</Link>
              </div>
              <div className="grid gap-3 border-t pt-5 sm:grid-cols-2">
                <div className="rounded-md border bg-muted/25 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Launch support</p><p className="mt-2 text-sm text-muted-foreground">Pump.fun submits a live launch request. Bonk.fun and Meteora preserve platform configuration only; live launch is not implemented.</p><Link href="/deploy" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Open token studio <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
                <div className="rounded-md border bg-muted/25 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Creator fees</p><p className="mt-2 text-sm text-muted-foreground">KiaraFun can monitor claim availability, but does not execute automatic claims. Complete creator claims on Pump.fun.</p><Link href="/my-tokens" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">View token records <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
              </div>
            </TabsContent>

            <TabsContent value="features" className="mt-6 min-w-0 max-w-full space-y-6">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="wallets">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Wallet Management
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Create new Solana wallets with secure keypair generation</li>
                      <li>Import existing wallets via private key</li>
                      <li>Real-time balance tracking with auto-refresh</li>
                      <li>SOL transfers between wallets</li>
                      <li>Wallet archiving and custom labeling</li>
                      <li>AES-256-GCM encrypted private key storage</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="deployment">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Rocket className="h-4 w-4" />
                      Token Deployment
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Multi-step deployment wizard</li>
                      <li>Pump.fun live deployment request; Bonk.fun and Meteora save pending configuration only</li>
                      <li>Token metadata configuration (name, symbol, description, image)</li>
                      <li>Social links setup (Twitter, Telegram, Website)</li>
                      <li>Fee allocation configuration and claim-availability monitoring only; creator claims must be completed manually on Pump.fun</li>
                      <li>Token dashboard for post-deployment management</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="trading">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4" />
                      Trading Features
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>Auto-Buy:</strong> Automatically purchase new tokens based on filters</li>
                      <li><strong>Auto-Sell:</strong> Take profit and stop loss automation</li>
                      <li><strong>Quick Buy:</strong> One-click purchase from monitor page</li>
                      <li><strong>Multi-Platform:</strong> Pump.fun, Raydium, Jupiter fallback chain</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="filters">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Filtering Options
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Market cap range filters (min/max)</li>
                      <li>Social requirements (Twitter, Telegram, Website)</li>
                      <li>Volume/Market Cap ratio filter</li>
                      <li>Take profit percentage configuration</li>
                      <li>Stop loss percentage configuration</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="analytics">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Real-time price charts using lightweight-charts</li>
                      <li>Holder concentration analysis</li>
                      <li>Rug safety scoring with detailed checks</li>
                      <li>Bonding curve progress tracking</li>
                      <li>Fee activity history</li>
                      <li>24h volume and trade count metrics</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="api" className="mt-6 min-w-0 max-w-full space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    API Endpoints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="auth">
                      <AccordionTrigger>Authentication</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 font-mono text-sm">
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/auth/nonce/:walletAddress
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get nonce for wallet signature</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">POST</code> /api/auth/verify
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Verify wallet signature and create session</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/auth/session
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Check current session status</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">POST</code> /api/auth/logout
                            <p className="text-muted-foreground mt-1 font-sans text-xs">End current session</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="wallets">
                      <AccordionTrigger>Wallets</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 font-mono text-sm">
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/wallets
                            <p className="text-muted-foreground mt-1 font-sans text-xs">List all wallets</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">POST</code> /api/wallets
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Create new wallet</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">POST</code> /api/wallets/import
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Import wallet from private key</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">POST</code> /api/wallets/transfer
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Transfer SOL to another address</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="monitor">
                      <AccordionTrigger>Monitoring</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 font-mono text-sm">
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/pumpfun/tokens
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get new tokens from WebSocket feed</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/pumpfun/trending
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get trending tokens (by trade count)</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/pumpfun/movers
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get top movers (by volume)</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/monitoring/status
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get monitoring status</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="trading-api">
                      <AccordionTrigger>Trading</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 font-mono text-sm">
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/trade/settings
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get trade settings</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">PUT</code> /api/trade/settings
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Update trade settings</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">POST</code> /api/trade/buy
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Execute a token buy</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/holdings
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get all token holdings</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">POST</code> /api/holdings/:id/sell
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Sell a holding</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="analytics-api">
                      <AccordionTrigger>Analytics</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 font-mono text-sm">
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/tokens/:mint/analytics
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get token analytics</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/tokens/:mint/safety
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get rug safety score</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <code className="text-primary">GET</code> /api/tokens/:mint/price-history
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Get price history for charts</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trading" className="mt-6 min-w-0 max-w-full space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Auto-Buy System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    The auto-buy system monitors new token creations via Pump.fun WebSocket 
                    and automatically purchases tokens that match your configured filters.
                  </p>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium">How it works:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Pump.fun WebSocket streams new token creations</li>
                      <li>Backend applies your configured filters (market cap, socials, etc.)</li>
                      <li>Matching tokens trigger automatic buy attempt</li>
                      <li>Multi-platform execution: Pump.fun, Raydium, Jupiter</li>
                      <li>Successful buys create holding records</li>
                    </ol>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Configuration Options:</h4>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>SOL Amount:</strong> Amount to spend per buy</li>
                      <li><strong>Market Cap Range:</strong> Filter by min/max market cap</li>
                      <li><strong>Social Requirements:</strong> Require Twitter, Telegram, or Website</li>
                      <li><strong>Vol/MCap Ratio:</strong> Filter by volume to market cap ratio</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    Auto-Sell System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    The auto-sell system monitors your holdings every 5 seconds and 
                    automatically sells based on your take profit and stop loss settings.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-md border border-green-500/20 bg-green-500/5">
                      <h4 className="font-medium text-green-600 mb-2">Take Profit</h4>
                      <p className="text-sm text-muted-foreground">
                        Automatically sells when price increases by your configured percentage.
                      </p>
                      <code className="text-xs mt-2 block text-muted-foreground">
                        currentPrice &gt;= buyPrice * (1 + takeProfit%)
                      </code>
                    </div>
                    <div className="p-4 rounded-md border border-red-500/20 bg-red-500/5">
                      <h4 className="font-medium text-red-600 mb-2">Stop Loss</h4>
                      <p className="text-sm text-muted-foreground">
                        Automatically sells when price decreases by your configured percentage.
                      </p>
                      <code className="text-xs mt-2 block text-muted-foreground">
                        currentPrice &lt;= buyPrice * (1 - stopLoss%)
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Platform Fallback Chain
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Trades are executed using a multi-platform fallback system to ensure best execution:
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="default">1. Pump.fun</Badge>
                    <span className="text-muted-foreground">for bonding curve tokens</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <Badge variant="secondary">2. Raydium</Badge>
                    <span className="text-muted-foreground">for graduated tokens</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <Badge variant="outline">3. Jupiter</Badge>
                    <span className="text-muted-foreground">universal fallback</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-6 min-w-0 max-w-full space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Security Measures
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Lock className="h-5 w-5 text-primary mt-1 shrink-0" />
                      <div>
                        <h4 className="font-medium">Wallet-Based Authentication</h4>
                        <p className="text-sm text-muted-foreground">
                          No passwords stored. Authentication via cryptographic signature 
                          verification using your Solana wallet.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <Shield className="h-5 w-5 text-primary mt-1 shrink-0" />
                      <div>
                        <h4 className="font-medium">AES-256-GCM Encryption</h4>
                        <p className="text-sm text-muted-foreground">
                          All private keys are encrypted using military-grade AES-256-GCM 
                          encryption before storage in the database.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <Database className="h-5 w-5 text-primary mt-1 shrink-0" />
                      <div>
                        <h4 className="font-medium">User Data Isolation</h4>
                        <p className="text-sm text-muted-foreground">
                          All data is isolated by userId. Zero cross-user visibility - 
                          you can only see your own wallets, holdings, and settings.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <FileCode className="h-5 w-5 text-primary mt-1 shrink-0" />
                      <div>
                        <h4 className="font-medium">Session-Based Access Control</h4>
                        <p className="text-sm text-muted-foreground">
                          Sessions are stored securely in PostgreSQL and verified on 
                          every API request to ensure authorized access.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Network and airdrop gates
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Financial actions require server-approved mainnet settings and verified wallet/trading network consistency. A frontend toggle cannot bypass the server guard.</p>
                  <p>Airdrops are controlled by the network status&apos;s explicit <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">airdropEnabled</code> flag—not inferred from a network label. If permission is false or unavailable, no airdrop action should be offered.</p>
                  <p>Stopping automation and editing non-financial setup remain available when financial actions are paused.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Rug Safety Scoring
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Every token is analyzed for potential rug risk with the following checks:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">Check</Badge>
                      <span className="text-sm">Mint Authority - Should be revoked</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">Check</Badge>
                      <span className="text-sm">Freeze Authority - Should be revoked</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">Check</Badge>
                      <span className="text-sm">Top Holder Concentration - Less than 10% ideal</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">Check</Badge>
                      <span className="text-sm">Developer Holdings - Should be reasonable</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">Check</Badge>
                      <span className="text-sm">Liquidity - Should be locked</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">Check</Badge>
                      <span className="text-sm">Bonding Progress - Higher is safer</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
