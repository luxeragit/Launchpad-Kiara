/**
 * Actual-browser terminal regression suite. No chain mutation, launch, wallet
 * export, funding or automation activation. Only ephemeral real API sign-in.
 * Optional token-record fixtures are intercepted inside this isolated browser,
 * visibly labelled, never written to the application database.
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import WebSocket from "ws";
import nacl from "tweetnacl";
import bs58 from "bs58";
import pg from "pg";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") throw new Error("Development-only browser check.");
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const output = "generated-artifacts/terminal/browser";
await mkdir(output, { recursive: true });
const suppliedBrowser = process.argv[2];
const existingBrowser = execFileSync("ps", ["-eo", "args"], { encoding: "utf8" }).split("\n")
  .find((line) => line.startsWith("/nix/store/") && line.includes("playwright-browsers") && line.includes("/chrome "));
const executable = suppliedBrowser || existingBrowser?.split(" --")[0] || "/repl/tools/bin/chromium";
const profile = await mkdtemp("/tmp/kiara-terminal-");
const child = spawn(executable, ["--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
  "--disable-background-networking", "--disable-features=VizDisplayCompositor", "--ignore-certificate-errors",
  "--no-first-run", "--remote-debugging-port=9234", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pending = new Map();
const eventHandlers = new Map();
let socket, sequence = 0, identityId;
const identity = nacl.sign.keyPair();
const address = bs58.encode(identity.publicKey);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [], exceptions = [], forbiddenRequests = [];
const geometry = [];
const only = process.argv[3];
const fixtureRecord = {
  id: "terminal-visual-fixture", name: "Isolated visual fixture", symbol: "TEST",
  description: "Browser-only pending configuration, not a live token.", logoUrl: "/kiara.png",
  platform: "bonkfun", mode: "normal", status: "pending", tokenAddress: null,
  txSignature: null, walletId: null, createdAt: "2026-10-22T00:00:00.000Z",
  burnPercent: 20, ammPercent: 30, creatorPercent: 25, liquidityPercent: 25,
  totalFeesCollected: 0, totalFeesDistributed: 0, totalBurned: 0, autoClaimEnabled: false,
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser protocol timeout: ${method}`)); }, 25_000);
    pending.set(id, { resolve(value) { clearTimeout(timer); resolve(value); }, reject(value) { clearTimeout(timer); reject(value); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
async function until(expression, timeout = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await pause(100);
  }
  throw new Error(`Condition not met: ${expression.slice(0, 130)}`);
}
async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
}
async function navigate(path) {
  await send("Page.navigate", { url: `${base}${path}` });
  await until("document.querySelector('[data-testid=\"terminal-shell\"]') && document.querySelector('main')?.children.length");
  // Dismiss the development host's own optional notice using its real close
  // control, just as a user can. Never remove or bypass application UI/auth.
  await evaluate(`(() => {
    const banner=[...document.querySelectorAll('body > div')].find(el=>
      !el.querySelector('[data-testid="terminal-shell"]') &&
      el.innerText?.includes('This is a temporary development preview'));
    banner?.querySelector('button')?.click();
  })()`);
  await evaluate("document.fonts.ready.then(()=>true)");
  await pause(550);
}
async function capture(name, fixture = false) {
  if (fixture) await evaluate(`(() => {
    let note=document.getElementById('isolated-fixture-note');
    if(!note){note=document.createElement('div');note.id='isolated-fixture-note';document.body.append(note)}
    note.textContent='ISOLATED VISUAL FIXTURE · PENDING CONFIGURATION · NO LIVE LAUNCH';
    Object.assign(note.style,{position:'fixed',bottom:'56px',right:'8px',zIndex:'99999',background:'#452f10',color:'#ffd98a',font:'10px monospace',padding:'5px',maxWidth:'90vw'});
  })()`);
  const result = await send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
  await writeFile(`${output}/${name}.jpg`, Buffer.from(result.data, "base64"));
}
async function click(selector) {
  await until(`document.querySelector(${JSON.stringify(selector)})`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await pause(180);
}
async function type(selector, value) {
  await until(`document.querySelector(${JSON.stringify(selector)})`);
  await evaluate(`(() => {
    const el=document.querySelector(${JSON.stringify(selector)});
    const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await pause(100);
}
async function check(name, run) {
  if (only && !new RegExp(only).test(name)) return;
  try { await run(); results.push({ name, passed: true }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.log(`FAIL: ${name}: ${error.message}`); }
}
try {
  let targets;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { targets = await (await fetch("http://127.0.0.1:9234/json/list")).json(); if (targets.length) break; } catch {}
    await pause(100);
  }
  assert.ok(targets?.[0]?.webSocketDebuggerUrl, "Chromium could not start; supply a compatible executable.");
  socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  socket.on("message", (raw) => {
    const event = JSON.parse(raw.toString());
    if (event.id) {
      const callback = pending.get(event.id); if (!callback) return;
      pending.delete(event.id);
      if (event.error) callback.reject(new Error(event.error.message)); else callback.resolve(event.result);
    }
    if (event.method === "Runtime.exceptionThrown") exceptions.push(event.params.exceptionDetails.text);
    if (event.method === "Network.requestWillBeSent") {
      const { method, url } = event.params.request;
      if (method !== "GET" && /\/api\/(trade\/(buy|sell)|monitoring\/start|autosell\/start|tokens\/deploy|wallets\/(export|transfer|fund|consolidate|burn))/.test(url)) forbiddenRequests.push(new URL(url).pathname);
    }
    const handler = eventHandlers.get(event.method);
    if (handler) Promise.resolve(handler(event.params)).catch((error) => exceptions.push(error.message));
  });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await viewport(1440, 900);
  await navigate("/");
  await evaluate("localStorage.removeItem('theme')");
  await navigate("/");
  await check("dark terminal geometry and independent desktop scrolling", async () => {
    assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), true);
    const bounds = await evaluate(`(() => {
      const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
      return {rail:box('[data-testid="terminal-rail"]'),toolbar:box('[data-testid="terminal-topbar"]'),ticker:box('[data-testid="market-ticker"]'),
        panels:['trending','activity','leaderboard'].map(n=>box('[data-testid="panel-'+n+'"]'))}
    })()`);
    geometry.push({ viewport: "1440x900", bounds });
    assert.ok(bounds.rail.width >= 52 && bounds.rail.width <= 56);
    assert.ok(bounds.toolbar.height >= 48 && bounds.toolbar.height <= 52);
    assert.ok(bounds.ticker.height >= 30 && bounds.ticker.height <= 34);
    assert.ok(bounds.panels.every((panel) => panel.height > 600 && panel.width > 400));
    assert.ok(bounds.panels[0].x < bounds.panels[1].x && bounds.panels[1].x < bounds.panels[2].x);
    await until("document.querySelector('[data-testid^=\"market-token-row-\"]')", 20_000);
    const scroll = await evaluate(`(() => {const a=document.querySelector('[data-testid="panel-trending"] [data-testid="panel-scroll"]');
      const b=document.querySelector('[data-testid="panel-activity"] [data-testid="panel-scroll"]');
      a.scrollTop=100;return {changed:a.scrollTop,other:b.scrollTop,overflow:getComputedStyle(a).overflowY}})()`);
    assert.ok(scroll.changed > 0);
    assert.equal(scroll.other, 0);
    assert.equal(scroll.overflow, "auto");
    await navigate("/");
    await capture("explore-desktop-live");
  });
  await check("real public token selection and paused quick-buy eligibility", async () => {
    await click('[data-testid^="market-token-row-"]');
    await until("document.querySelector('[role=\"dialog\"]') || document.body.innerText.includes('Order entry')");
    assert.equal(await evaluate("[...document.querySelectorAll('[data-testid^=\"button-buy-\"]')].every(b=>b.disabled)"), true);
    await capture("public-token-inspector");
    await click('[data-testid="inspector-trade-mode-sell"]');
    assert.equal(await evaluate("document.querySelector('[data-testid=\"button-inspector-sell\"]')?.disabled"), true);
    await capture("public-token-inspector-sell-paused");
    await click('[data-testid="inspector-trade-mode-buy"]');
  });
  await check("global public mint search validates input from another workspace", async () => {
    await navigate("/docs");
    await type('input[aria-label="Search by token mint address"]', "not-a-mint");
    await click('button[aria-label="Search token"]');
    await until("document.body.innerText.toLowerCase().includes('invalid') || document.querySelector('input[aria-invalid=\"true\"]')");
    await navigate("/docs");
    const feed = await (await fetch(`${base}/api/pumpfun/trending`)).json();
    assert.ok(feed.tokens?.[0]?.mint);
    await type('input[aria-label="Search by token mint address"]', feed.tokens[0].mint);
    await click('button[aria-label="Search token"]');
    await until("document.querySelector('[role=\"dialog\"]') || document.body.innerText.includes('Search failed')", 30_000);
    await capture("global-public-search");
  });
  // Real sign-in, not a UI authentication bypass.
  const nonce = await (await fetch(`${base}/api/auth/nonce/${address}`)).json();
  const message = new TextEncoder().encode(nonce.message);
  const signature = nacl.sign.detached(message, identity.secretKey);
  const signed = await fetch(`${base}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: address, messageHex: Buffer.from(message).toString("hex"), signatureHex: Buffer.from(signature).toString("hex") }) });
  const signedBody = await signed.json();
  assert.equal(signedBody.success, true);
  identityId = signedBody.user.id;
  const cookie = signed.headers.getSetCookie()[0]?.split(";")[0];
  assert.ok(cookie);
  const equals = cookie.indexOf("=");
  await send("Network.setCookie", { name: cookie.slice(0, equals), value: cookie.slice(equals + 1), url: base, httpOnly: true, sameSite: "Lax" });
  await check("wallet create/import controls preserve hidden key entry", async () => {
    await navigate("/wallets");
    await click('[data-testid="button-create-wallet"]');
    await until("document.querySelector('[role=\"dialog\"]')");
    await capture("wallet-create-dialog");
    await click('[role="dialog"] button:has(.sr-only)');
    await click('[data-testid="button-import-wallet"]');
    await until("document.querySelector('[role=\"dialog\"] input[type=\"password\"]')");
    await capture("wallet-import-dialog");
    await click('[role="dialog"] button:has(.sr-only)');
  });
  await check("launch fields and uploaded artwork update the actual live preview", async () => {
    await navigate("/deploy");
    await type('[data-testid="input-token-name"]', "Browser verification");
    await type('[data-testid="input-token-symbol"]', "CHECK");
    const document = await send("DOM.getDocument");
    const field = await send("DOM.querySelector", { nodeId: document.root.nodeId, selector: 'input[type="file"]' });
    assert.ok(field.nodeId);
    await send("DOM.setFileInputFiles", { nodeId: field.nodeId, files: [`${process.cwd()}/client/public/kiara.png`] });
    await until("document.querySelector('[data-testid=\"live-launch-preview\"]')?.innerText.includes('Browser verification')");
    assert.equal(await evaluate("document.querySelector('[data-testid=\"button-deploy-submit\"]')?.disabled"), true);
    await capture("launch-live-preview");
  });
  await check("network pause remains visible and automation start remains disabled", async () => {
    await viewport(375, 812);
    await navigate("/monitor");
    assert.equal(await evaluate("document.querySelector('[data-testid=\"button-start-autobuy\"]')?.disabled"), true);
    await click('button[aria-label="Network status"]');
    await until("document.body.innerText.includes('devnet') && document.body.innerText.includes('mainnet-beta')");
    const popup = await evaluate("(() => {const r=document.getElementById('network-details').getBoundingClientRect();return {left:r.left,right:r.right}})()");
    assert.ok(popup.left >= 0 && popup.right <= 375, "Network details must fit a narrow phone");
    await capture("network-mismatch-details");
  });
  // This only intercepts one fabricated record ID in this browser. Production
  // feed requests are never intercepted, seeded or replaced.
  eventHandlers.set("Fetch.requestPaused", async ({ requestId, request }) => {
    const path = new URL(request.url).pathname;
    let body = { error: "No visual fixture for this resource" };
    let responseCode = 404;
    if (request.method === "GET" && path === "/api/tokens/terminal-visual-fixture") { body = { ...fixtureRecord, userId: identityId }; responseCode = 200; }
    if (request.method === "GET" && path === "/api/tokens/terminal-visual-fixture/fees") { body = { deployment: fixtureRecord, activities: [], pendingFees: 0 }; responseCode = 200; }
    await send("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
  });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/tokens/terminal-visual-fixture*", requestStage: "Request" }] });
  await check("isolated pending-record dashboard exposes all operational tabs", async () => {
    await navigate("/deploy/terminal-visual-fixture");
    await until("document.querySelector('[data-testid=\"token-dashboard-workspace\"]')");
    const labels = await evaluate("[...document.querySelectorAll('[role=\"tab\"]')].map(el=>el.textContent.trim().toLowerCase())");
    for (const label of ["overview", "holdings", "safety", "fees", "liquidity", "activity"]) assert.ok(labels.some((text) => text.includes(label)), `Missing operation: ${label}`);
    await capture("token-dashboard-isolated-fixture", true);
  });
  await check("all workspaces fit all five required viewport sizes", async () => {
    const sizes = [[1440, 900], [1280, 800], [768, 1024], [390, 844], [375, 812]];
    const routes = [["/", "explore"], ["/deploy", "create"], ["/wallets", "wallets"], ["/monitor", "monitor"],
      ["/my-tokens", "my-tokens"], ["/docs", "docs"], ["/deploy/terminal-visual-fixture", "token-dashboard-isolated-fixture"]];
    for (const [width, height] of sizes) {
      await viewport(width, height);
      for (const [path, name] of routes) {
        await navigate(path);
        const fit = await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})");
        assert.ok(fit.scroll <= fit.width + 1, `${name}: horizontal overflow at ${width}: ${fit.scroll}`);
        await capture(`${name}-${width}x${height}`, path.includes("fixture"));
      }
    }
  });
  await check("mobile panel switching and persisted optional light mode work", async () => {
    await viewport(390, 844); await navigate("/");
    for (const label of ["Live Activity", "Leaderboard", "Trending"]) {
      const found = await evaluate(`(() => {const el=[...document.querySelectorAll('[role="tab"]')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
      assert.equal(found, true, `Missing mobile panel tab ${label}`);
      await pause(100);
    }
    await viewport(1440, 900); await navigate("/");
    await click('button[aria-label="Toggle theme"]');
    assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), false);
    await navigate("/docs");
    assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), false);
    const lightSurface = await evaluate("getComputedStyle(document.querySelector('.terminal-panel')).backgroundColor");
    assert.ok(Number.parseInt(lightSurface.slice(lightSurface.indexOf("(") + 1), 10) > 180,
      "Light mode must not retain a near-black panel behind dark text");
    await capture("docs-optional-light");
  });
  await check("browser journey caused no financial requests or unhandled exceptions", async () => {
    assert.deepEqual(forbiddenRequests, []);
    assert.deepEqual(exceptions, []);
  });
} finally {
  if (socket) { try { await send("Network.clearBrowserCookies"); } catch {} socket.close(); }
  child.kill("SIGTERM");
  if (identityId) await pool.query("DELETE FROM session WHERE sess->>'userId' = $1", [identityId]);
  await pool.query("DELETE FROM users WHERE wallet_address = $1 AND ($2::text IS NULL OR id::text = $2)", [address, identityId ?? null]);
  identity.secretKey.fill(0); await pool.end();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  let mergedResults = results, mergedGeometry = geometry;
  if (only) {
    try {
      const previous = JSON.parse(await readFile(`${output}/results.json`, "utf8"));
      mergedResults = [...previous.results.filter((old) => !results.some((current) => current.name === old.name)), ...results];
      if (!geometry.length) mergedGeometry = previous.geometry;
    } catch {}
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ results: mergedResults, geometry: mergedGeometry, unhandledExceptions: exceptions.length, financialRequests: forbiddenRequests.length, fixtureNotice: "Only the pending Token Dashboard record is an isolated browser fixture; no fixture data is persisted or used as market data." }, null, 2));
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
