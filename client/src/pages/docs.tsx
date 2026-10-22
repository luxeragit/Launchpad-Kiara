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

export default function DocsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card/50 px-6 py-4">
        <h1 className="text-2xl font-bold" data-testid="text-docs-title">Documentation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Complete guide to Pyre Market
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5" data-testid="tabs-docs">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
              <TabsTrigger value="api" data-testid="tab-api">API</TabsTrigger>
              <TabsTrigger value="trading" data-testid="tab-trading">Trading</TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    What is Pyre Market?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Pyre Market is a comprehensive Solana trading dashboard designed for 
                    cryptocurrency wallet management, token deployment, and automated trade 
                    monitoring. The platform provides tools for managing multiple Solana wallets, 
                    deploying tokens to various platforms, and monitoring trading activities in real-time.
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
                        Deploy tokens to Pump.fun, BonkFun, and Meteora platforms
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
            </TabsContent>

            <TabsContent value="features" className="mt-6 space-y-6">
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
                      <li>Platform selection: Pump.fun, BonkFun, Meteora</li>
                      <li>Token metadata configuration (name, symbol, description, image)</li>
                      <li>Social links setup (Twitter, Telegram, Website)</li>
                      <li>Fee distribution configuration</li>
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

            <TabsContent value="api" className="mt-6 space-y-6">
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
                            <code className="text-primary">POST</code> /api/wallets/:id/transfer
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
                            <code className="text-primary">POST</code> /api/trade/quick-buy
                            <p className="text-muted-foreground mt-1 font-sans text-xs">Execute quick buy</p>
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

            <TabsContent value="trading" className="mt-6 space-y-6">
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

            <TabsContent value="security" className="mt-6 space-y-6">
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
