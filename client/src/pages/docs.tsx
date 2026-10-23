import { useState } from "react";
import { Link } from "wouter";
import {
  Activity, ArrowRight, ArrowRightLeft, BarChart3, BookOpen, Check, ChevronRight,
  Database, FileCode, Globe, Lock, Rocket, Server, Shield, Wallet, Zap,
} from "lucide-react";
import { TerminalPanel } from "@/components/terminal/terminal-panel";

const topics = [
  { id: "overview", title: "Overview", icon: BookOpen },
  { id: "quick-start", title: "Quick start", icon: Zap },
  { id: "capabilities", title: "Product capabilities", icon: Activity },
  { id: "api-reference", title: "API reference", icon: Server },
  { id: "trading", title: "Trading & monitoring", icon: ArrowRightLeft },
  { id: "security", title: "Security & network", icon: Shield },
] as const;

const sections = [
  { id: "wallet-auth", label: "Wallet authentication" },
  { id: "wallet-tools", label: "Wallet management" },
  { id: "deployment", label: "Token deployment" },
  { id: "trading-automation", label: "Trading automation" },
  { id: "analytics", label: "Analytics" },
  { id: "api-auth", label: "Authentication endpoints" },
  { id: "api-wallet", label: "Wallet endpoints" },
  { id: "api-monitor", label: "Monitoring endpoints" },
  { id: "api-trade", label: "Trading endpoints" },
  { id: "api-analytics", label: "Analytics endpoints" },
  { id: "network-gates", label: "Network gates" },
  { id: "safety-checks", label: "Token safety" },
] as const;

const apiGroups = [
  { id: "api-auth", title: "Authentication", rows: [["GET", "/api/auth/nonce/:walletAddress", "Get nonce for wallet signature"], ["POST", "/api/auth/verify", "Verify wallet signature and create session"], ["GET", "/api/auth/session", "Check current session status"], ["POST", "/api/auth/logout", "End current session"]] },
  { id: "api-wallet", title: "Wallets", rows: [["GET", "/api/wallets", "List authenticated user's wallets"], ["POST", "/api/wallets", "Create a wallet"], ["POST", "/api/wallets/import", "Import wallet from private key"], ["POST", "/api/wallets/transfer", "Transfer SOL to another address"]] },
  { id: "api-monitor", title: "Monitoring", rows: [["GET", "/api/pumpfun/tokens", "New token events via PumpPortal"], ["GET", "/api/pumpfun/trending", "Pump.fun/PumpSwap pools by 5m USD volume"], ["GET", "/api/pumpfun/trending?sort=activity", "Pools by 5m buy + sell transaction count"], ["GET", "/api/pumpfun/movers", "Pools by absolute 5m price change"], ["GET", "/api/monitoring/status", "Get monitoring status"]] },
  { id: "api-trade", title: "Trading", rows: [["GET", "/api/trade/settings", "Get trade settings"], ["PUT", "/api/trade/settings", "Update trade settings"], ["POST", "/api/trade/buy", "Execute a token buy"], ["GET", "/api/holdings", "Get token holdings"], ["POST", "/api/holdings/:id/sell", "Sell a holding"]] },
  { id: "api-analytics", title: "Analytics", rows: [["GET", "/api/tokens/:mint/analytics", "Get token analytics"], ["GET", "/api/tokens/:mint/safety", "Get rug safety score"], ["GET", "/api/tokens/:mint/price-history", "Get chart price history"]] },
] as const;

export default function DocsPage() {
  const [activeTopic, setActiveTopic] = useState<string>("overview");
  const goTo = (id: string, topicId?: string) => {
    setActiveTopic(topicId || topicForSection(id));
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return <main className="terminal-workspace min-h-0 overflow-hidden">
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-[#292d36] px-3">
        <BookOpen className="h-4 w-4 text-[#32a9ff]" /><h1 className="text-[13px] font-semibold" data-testid="text-docs-title">Documentation</h1><span className="hidden text-[10px] text-muted-foreground sm:inline">Product behavior, operations, and reference</span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[174px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_190px]">
        <TerminalPanel title="Topics" testId="docs-topics" className="!hidden min-h-0 border-0 md:!flex">
          <nav className="flex-1 overflow-auto p-1.5" aria-label="Documentation topics">
            {topics.map(({ id, title, icon: Icon }) => <button key={id} type="button" onClick={() => goTo(id, id)} aria-current={activeTopic === id ? "location" : undefined} className={`flex w-full items-center gap-2 border-l-2 px-2 py-2 text-left text-[11px] transition-colors ${activeTopic === id ? "border-[#32a9ff] bg-[#32a9ff]/[.07] text-foreground" : "border-transparent text-muted-foreground hover:bg-[#151820] hover:text-foreground"}`}><Icon className="h-3.5 w-3.5 shrink-0" />{title}</button>)}
          </nav>
          <div className="border-t border-[#292d36] p-2 text-[9px] leading-relaxed text-muted-foreground">Operational documentation. Server-side policy remains authoritative.</div>
        </TerminalPanel>
        <TerminalPanel title="KiaraFun field guide" testId="docs-content" className="min-h-0 border-0 md:border-l xl:border-r">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#292d36] p-1 md:hidden" aria-label="Documentation topics">
            {topics.map((topic) => <button key={topic.id} type="button" onClick={() => goTo(topic.id, topic.id)} className={`shrink-0 border-b-2 px-2 py-1.5 text-[10px] ${activeTopic === topic.id ? "border-[#32a9ff] text-foreground" : "border-transparent text-muted-foreground"}`}>{topic.title}</button>)}
          </nav>
          <article className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-6">
            <section id="overview" className="scroll-mt-3 border-b border-[#292d36] pb-5">
              <p className="mb-1 font-mono text-[9px] text-[#32a9ff]">KIARAFUN / PRODUCT REFERENCE</p>
              <h2 className="text-[18px] font-semibold tracking-tight">A practical guide to the terminal</h2>
              <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">KiaraFun brings token discovery, managed Solana wallets, Pump.fun launch requests, and configurable trade monitoring into one workspace. The app presents records and request status; blockchain completion is only confirmed by the actual transaction state.</p>
              <div className="mt-3 flex items-start gap-2 border-l-2 border-amber-400 bg-amber-400/[.05] px-3 py-2 text-[10px] leading-relaxed text-amber-100"><Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Before a financial action, inspect network readiness. Server-side approval and wallet/network consistency gates cannot be overridden by a frontend setting.</span></div>
              <div className="mt-4 grid gap-0 border-y border-[#292d36] sm:grid-cols-3">
                <Summary label="Wallets" text="Create, import, and manage encrypted wallet records." icon={Wallet} />
                <Summary label="Launches" text="Pump.fun request path; other platform selections are pending configuration." icon={Rocket} />
                <Summary label="Monitor" text="Configure filters and monitor token and trade workflows." icon={Activity} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <DocLink href="/wallets">Wallet operations</DocLink><DocLink href="/">Explore tokens</DocLink><DocLink href="/deploy">Launch studio</DocLink><DocLink href="/monitor">Monitoring</DocLink><DocLink href="/my-tokens">Token records</DocLink>
              </div>
            </section>

            <section id="quick-start" className="scroll-mt-3 border-b border-[#292d36] py-5">
              <SectionKicker>01 / GET STARTED</SectionKicker><h2 className="mb-3 text-[15px] font-semibold">Quick start</h2>
              <ol className="divide-y divide-[#292d36] border-y border-[#292d36]">
                <Step number="01" title="Connect a wallet" detail="Use the wallet connection flow and authorize with Phantom or Solflare. Authentication verifies a wallet signature." />
                <Step number="02" title="Create or import a managed wallet" detail="Open Wallets to prepare a wallet used by launch and trading tools." />
                <Step number="03" title="Fund the managed wallet" detail="Transfer SOL using the existing wallet workflow. Confirm addresses and network before sending." />
                <Step number="04" title="Configure monitoring" detail="Set filters and trade parameters in Monitor. Use its current status before starting the service." />
                <Step number="05" title="Review network status" detail="Financial actions remain paused when the server reports an unapproved or unverifiable network." />
              </ol>
            </section>

            <section id="capabilities" className="scroll-mt-3 border-b border-[#292d36] py-5">
              <SectionKicker>02 / PRODUCT CAPABILITIES</SectionKicker><h2 className="mb-4 text-[15px] font-semibold">What the workspace supports</h2>
              <div id="wallet-tools" className="scroll-mt-3 border-t border-[#292d36] py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-semibold"><Wallet className="h-3.5 w-3.5 text-[#32a9ff]" />Wallet management</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Create Solana wallets, import existing wallets by private key, track balances, transfer SOL, archive wallets, and label wallet records. Stored key material uses AES-256-GCM encryption. Sensitive wallet operations remain behind their existing authorization flows.</p>
              </div>
              <div id="deployment" className="scroll-mt-3 border-t border-[#292d36] py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-semibold"><Rocket className="h-3.5 w-3.5 text-[#32a9ff]" />Token deployment</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Configure name, ticker, description, artwork, social references, platform, mode, funding wallet, and initial buy amount. Pump.fun uses the live launch-request path. Bonk.fun and Meteora save configuration only; live launch is not implemented for either. A successful API response is not proof of on-chain deployment.</p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">Fee allocation settings cover burn, AMM, creator, and liquidity shares and must total 100%. The interface can monitor claim availability; creator claims are not executed automatically and must be completed directly on Pump.fun.</p>
              </div>
              <div id="trading-automation" className="scroll-mt-3 border-t border-[#292d36] py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-semibold"><ArrowRightLeft className="h-3.5 w-3.5 text-[#32a9ff]" />Trading and automation</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">The product includes auto-buy settings, auto-sell take-profit and stop-loss configuration, quick-buy entry points, and a Pump.fun, Raydium, and Jupiter routing/fallback chain where supported. A real trade remains subject to authorization, actual wallet state, network approval, and the response returned by its execution path.</p>
              </div>
              <div className="border-t border-[#292d36] py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-semibold"><SettingsIcon />Filtering options</h3>
                <ul className="mt-2 grid gap-x-5 gap-y-1.5 text-[10px] text-muted-foreground sm:grid-cols-2">
                  <li>Market-cap minimum and maximum</li><li>Required X/Twitter, Telegram, or website</li><li>Volume-to-market-cap ratio</li><li>Take-profit percentage</li><li>Stop-loss percentage</li><li>Configured SOL amount per buy</li>
                </ul>
              </div>
              <div id="analytics" className="scroll-mt-3 border-t border-[#292d36] py-3">
                <h3 className="flex items-center gap-2 text-[12px] font-semibold"><BarChart3 className="h-3.5 w-3.5 text-[#32a9ff]" />Analytics and safety</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Available analytics include price history, holder concentration, safety checks, bonding progress, fee activity, volume, and trade counts where data is returned by the existing services. Safety indicators inform review; they do not guarantee token safety.</p>
              </div>
            </section>

            <section id="api-reference" className="scroll-mt-3 border-b border-[#292d36] py-5">
              <SectionKicker>03 / REFERENCE</SectionKicker><h2 className="mb-1 text-[15px] font-semibold">API endpoints</h2>
              <p className="mb-3 text-[10px] text-muted-foreground">Endpoint descriptions reflect the documented application interface. Authentication and server authorization continue to apply.</p>
              <div className="divide-y divide-[#292d36] border-y border-[#292d36]">
                {apiGroups.map((group) => <div key={group.id} id={group.id} className="scroll-mt-3 py-3">
                  <h3 className="mb-2 text-[11px] font-semibold">{group.title}</h3>
                  <div className="space-y-1.5">{group.rows.map(([method, path, description]) => <div key={`${method}-${path}`} className="grid grid-cols-[43px_minmax(0,1fr)] gap-2 border-l border-[#292d36] pl-2.5 sm:grid-cols-[43px_minmax(190px,.9fr)_1fr]">
                    <code className={`pt-0.5 font-mono text-[9px] ${method === "GET" ? "text-emerald-300" : method === "PUT" ? "text-amber-200" : "text-[#72c5ff]"}`}>{method}</code><code className="break-all font-mono text-[10px] text-foreground">{path}</code><span className="col-start-2 text-[9px] text-muted-foreground sm:col-start-auto">{description}</span>
                  </div>)}</div>
                </div>)}
              </div>
            </section>

            <section id="trading" className="scroll-mt-3 border-b border-[#292d36] py-5">
              <SectionKicker>04 / AUTOMATION</SectionKicker><h2 className="mb-3 text-[15px] font-semibold">Trading & monitoring</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border-l-2 border-[#32a9ff] pl-3">
                  <h3 className="text-[11px] font-semibold">Auto-buy path</h3>
                  <ol className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    <li>1. Pump.fun WebSocket streams new token creations.</li><li>2. Backend evaluates configured filters, including market cap and social requirements.</li><li>3. Matching candidates can trigger the configured buy attempt.</li><li>4. Existing platform routing may use Pump.fun, Raydium, or Jupiter.</li><li>5. Successful buys create holding records.</li>
                  </ol>
                </div>
                <div className="border-l-2 border-rose-400 pl-3">
                  <h3 className="text-[11px] font-semibold">Auto-sell thresholds</h3>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">The documented monitoring workflow checks holdings on a five-second interval. Take profit is evaluated against the configured increase from buy price; stop loss against the configured decrease. Actual execution depends on the running service, authorization, network gate, and resulting transaction status.</p>
                  <div className="mt-2 space-y-1 font-mono text-[9px] text-muted-foreground"><p>currentPrice &gt;= buyPrice × (1 + takeProfit%)</p><p>currentPrice &lt;= buyPrice × (1 − stopLoss%)</p></div>
                </div>
              </div>
              <div className="mt-4 border-t border-[#292d36] pt-3">
                <h3 className="text-[11px] font-semibold">Execution routing</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><RouteTag label="1 · Pump.fun" detail="Bonding curve tokens" /><ArrowRight className="h-3 w-3" /><RouteTag label="2 · Raydium" detail="Graduated tokens" /><ArrowRight className="h-3 w-3" /><RouteTag label="3 · Jupiter" detail="Fallback route" /></div>
              </div>
            </section>

            <section id="security" className="scroll-mt-3 py-5">
              <SectionKicker>05 / SECURITY & SAFETY</SectionKicker><h2 className="mb-3 text-[15px] font-semibold">Security measures and operational limits</h2>
              <div id="wallet-auth" className="scroll-mt-3 divide-y divide-[#292d36] border-y border-[#292d36]">
                <SecurityRow icon={Lock} title="Wallet-based authentication" detail="No password is stored. Authentication uses cryptographic signature verification through the connected Solana wallet." />
                <SecurityRow icon={Shield} title="Encrypted key storage" detail="Managed wallet private keys are encrypted using AES-256-GCM before database storage." />
                <SecurityRow icon={Database} title="User data isolation" detail="Wallets, holdings, and settings are scoped to the authenticated user; records are not shared across users." />
                <SecurityRow icon={FileCode} title="Session access control" detail="Sessions are stored in PostgreSQL and checked for authorized API access." />
              </div>
              <div id="network-gates" className="scroll-mt-3 mt-4 border-l-2 border-amber-400 bg-amber-400/[.05] p-3">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold text-amber-100"><Globe className="h-3.5 w-3.5" />Network and airdrop gates</h3>
                <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  <li>Financial actions require server-approved mainnet settings and verified wallet/trading network consistency. The frontend cannot bypass the server guard.</li>
                  <li>Airdrops are controlled by the explicit <code className="font-mono text-foreground">airdropEnabled</code> status flag. If permission is false or unavailable, no airdrop action should be offered.</li>
                  <li>Stopping automation and editing non-financial setup remain available while financial actions are paused.</li>
                </ul>
              </div>
              <div id="safety-checks" className="scroll-mt-3 mt-4">
                <h3 className="mb-2 text-[11px] font-semibold">Token safety checks</h3>
                <div className="grid gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground sm:grid-cols-2">
                  {["Mint authority should be revoked", "Freeze authority should be revoked", "Top-holder concentration (less than 10% is described as ideal)", "Developer holdings should be reasonable", "Liquidity should be locked", "Higher bonding progress is described as safer"].map((item) => <p key={item} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />{item}</p>)}
                </div>
                <p className="mt-2 text-[9px] text-muted-foreground">These are checks to evaluate, not guarantees or claims that an individual token passed them.</p>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-[#292d36] pt-3 text-[10px] text-muted-foreground"><ChevronRight className="h-3 w-3 text-[#32a9ff]" />For current launch records, open <Link href="/my-tokens" className="text-[#72c5ff] hover:underline">My Tokens</Link>. For an active launch setup, use <Link href="/deploy" className="text-[#72c5ff] hover:underline">Launch studio</Link>.</div>
            </section>
            <footer className="border-t border-[#292d36] py-3 text-[9px] text-muted-foreground">Documentation describes product capability; it is not confirmation that a transaction or deployment completed.</footer>
          </article>
        </TerminalPanel>
        <TerminalPanel title="On this page" className="!hidden min-h-0 border-0 xl:!flex">
          <nav className="flex-1 overflow-auto p-2" aria-label="Section outline">
            {sections.map((section) => <button key={section.id} type="button" onClick={() => goTo(section.id)} className="flex w-full items-start gap-2 border-l border-[#292d36] px-2 py-1.5 text-left text-[9px] leading-relaxed text-muted-foreground hover:border-[#32a9ff] hover:text-foreground"><span className="mt-1 h-1 w-1 shrink-0 bg-[#32a9ff]/70" />{section.label}</button>)}
          </nav>
          <div className="border-t border-[#292d36] p-2 text-[9px] text-muted-foreground">Updated to distinguish live requests from pending configuration.</div>
        </TerminalPanel>
      </div>
    </div>
  </main>;
}

function topicForSection(id: string) {
  if (id.startsWith("api-")) return "api-reference";
  if (["wallet-auth", "network-gates", "safety-checks"].includes(id)) return "security";
  if (id === "trading-automation") return "capabilities";
  if (id === "analytics") return "capabilities";
  return "overview";
}
function Summary({ label, text, icon: Icon }: { label: string; text: string; icon: typeof Wallet }) {
  return <div className="flex gap-2.5 border-r border-[#292d36] py-3 pr-2 last:border-0"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#32a9ff]" /><div><p className="text-[10px] font-semibold">{label}</p><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{text}</p></div></div>;
}
function SectionKicker({ children }: { children: string }) {
  return <p className="mb-1 font-mono text-[9px] text-[#32a9ff]">{children}</p>;
}
function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <li className="grid grid-cols-[34px_minmax(0,1fr)] gap-2 py-2.5"><span className="font-mono text-[9px] text-[#32a9ff]">{number}</span><div><h3 className="text-[11px] font-semibold">{title}</h3><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p></div></li>;
}
function DocLink({ href, children }: { href: string; children: string }) {
  return <Link href={href} className="inline-flex items-center gap-1 border border-[#292d36] px-2 py-1 text-[9px] text-muted-foreground hover:border-[#32a9ff]/40 hover:text-foreground">{children}<ArrowRight className="h-2.5 w-2.5" /></Link>;
}
function RouteTag({ label, detail }: { label: string; detail: string }) {
  return <span className="border border-[#292d36] px-2 py-1"><strong className="text-foreground">{label}</strong><span className="ml-1.5">{detail}</span></span>;
}
function SecurityRow({ icon: Icon, title, detail }: { icon: typeof Wallet; title: string; detail: string }) {
  return <div className="flex items-start gap-2.5 py-2.5"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#32a9ff]" /><div><h3 className="text-[10px] font-semibold">{title}</h3><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p></div></div>;
}
function SettingsIcon() {
  return <BarChart3 className="h-3.5 w-3.5 text-[#32a9ff]" />;
}
