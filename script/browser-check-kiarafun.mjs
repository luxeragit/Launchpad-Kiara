/**
 * Non-destructive Chromium/CDP regression check. Uses the existing system browser
 * and ws dependency; no extra browser framework or application bypass is needed.
 * All sign-in keys are ephemeral, never printed, saved or used for transactions.
 */
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import WebSocket from "ws";
import nacl from "tweetnacl";
import bs58 from "bs58";
import pg from "pg";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") {
  throw new Error("Only run this non-transactional check in Replit development.");
}
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const output = "generated-artifacts/kiarafun/browser";
await mkdir(output, { recursive: true });
const profile = await mkdtemp("/tmp/kiara-ui-");
const browser = spawn(process.argv[2] || "/repl/tools/bin/chromium", [
  "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run",
  "--ignore-certificate-errors",
  "--disable-gpu", "--disable-background-networking", "--disable-features=VizDisplayCompositor",
  "--no-default-browser-check", "--remote-debugging-port=9223",
  `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const only = process.argv[3];
const errors = [];
let socket;
let fixtureId;
const fixture = nacl.sign.keyPair();
const address = bs58.encode(fixture.publicKey);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let seq = 0;
const callbacks = new Map();

async function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { callbacks.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 25_000);
    callbacks.set(id, {
      resolve(value) { clearTimeout(timer); resolve(value); },
      reject(value) { clearTimeout(timer); reject(value); },
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
async function until(expression, timeout = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(150);
  }
  throw new Error(`Browser condition not met: ${expression.slice(0, 140)}`);
}
async function navigate(path) {
  await cdp("Page.navigate", { url: `${base}${path}` });
  try {
    await until("document.querySelector('header') && document.querySelector('main')?.children.length > 0");
  } catch (error) {
    console.log("Browser page diagnostic:", await evaluate("({title:document.title,text:document.body?.innerText?.slice(0,240)})"));
    await screenshot("navigation-failure");
    throw error;
  }
  await evaluate("document.fonts.ready.then(() => true)");
  await delay(700);
}
async function viewport(width, height) {
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
}
async function screenshot(name) {
  const result = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 82 });
  await writeFile(`${output}/${name}.jpg`, Buffer.from(result.data, "base64"));
}
async function click(selector) {
  assert.equal(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), true, `Missing control ${selector}`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await delay(180);
}
async function input(selector, value) {
  await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await delay(150);
}
async function clickText(text) {
  const found = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(text)});
    if (!button) return false;
    button.click(); return true;
  })()`);
  assert.equal(found, true, `Missing button: ${text}`);
  await delay(250);
}
async function check(name, fn) {
  if (only && !name.includes(only)) return;
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.log(`FAIL: ${name}: ${error.message}`); }
}

try {
  let targets;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { targets = await (await fetch("http://127.0.0.1:9223/json/list")).json(); if (targets.length) break; } catch {}
    await delay(150);
  }
  assert.ok(targets?.[0]?.webSocketDebuggerUrl, "System Chromium did not start");
  socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id) {
      const callback = callbacks.get(message.id);
      if (!callback) return;
      callbacks.delete(message.id);
      if (message.error) callback.reject(new Error(message.error.message));
      else callback.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  });
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await viewport(1440, 900);
  await navigate("/");
  await evaluate("localStorage.setItem('theme','light')");
  await navigate("/");

  await check("public Explore renders live tokens without signing in", async () => {
    await until("document.querySelector('[data-testid^=\"token-list-item-\"]') || document.querySelector('[data-testid^=\"trending-card-\"]')", 20_000);
    assert.equal(await evaluate("document.title.includes('KiaraFun')"), true);
    await screenshot("explore-desktop-light");
  });
  await check("discovery filters, token details and safe Buy controls", async () => {
    for (const name of ["Explore", "Newest", "Last Traded", "Top"]) {
      await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(name)}); if(b)b.click(); })()`);
    }
    await click('[data-testid^="trending-card-"]');
    await until("document.querySelector('[role=\"dialog\"]')");
    await screenshot("token-details-desktop");
    assert.equal(await evaluate("[...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>/buy/i.test(b.textContent)).every(b=>b.disabled)"), true);
    await click('[role="dialog"] button:has(.sr-only)');
  });
  await check("public mint search works from another route and validates invalid input", async () => {
    await navigate("/docs");
    await input('input[aria-label="Search by token mint address"]', "not-a-mint");
    await click('button[aria-label="Search token"]');
    await until("document.body.innerText.includes('Invalid mint address')");
    assert.equal(await evaluate("document.body.innerText.includes('Connect to search tokens')"), false);
    await navigate("/docs");
    const feed = await (await fetch(`${base}/api/pumpfun/trending`)).json();
    const mint = feed.tokens?.[0]?.mint;
    assert.ok(mint, "No real token available for public lookup");
    await input('input[aria-label="Search by token mint address"]', mint);
    await click('button[aria-label="Search token"]');
    await until("document.querySelector('[role=\"dialog\"]') || document.body.innerText.includes('Search failed')", 30_000);
    const requested = await evaluate(`performance.getEntriesByType('resource').some(e=>e.name.includes('/api/tokens/search/${mint}'))`);
    assert.equal(requested, true, "Mint lookup should reach the public search API");
    assert.equal(await evaluate("document.body.innerText.includes('Connect to search tokens')"), false);
    await screenshot("public-mint-search");
  });
  await check("creation identity validation, upload preview and step persistence", async () => {
    await navigate("/deploy");
    await clickText("Continue");
    assert.equal(await evaluate("document.body.innerText.includes('Add a token name')"), true);
    await input('[data-testid="input-token-name"]', "Browser verification");
    await input('[data-testid="input-token-symbol"]', "CHECK");
    await input('[data-testid="input-token-description"]', "Non-submitted browser verification only.");
    const document = await cdp("DOM.getDocument");
    const fileInput = await cdp("DOM.querySelector", { nodeId: document.root.nodeId, selector: 'input[type="file"]' });
    await cdp("DOM.setFileInputFiles", { nodeId: fileInput.nodeId, files: [`${process.cwd()}/client/public/kiara.png`] });
    await delay(300);
    await screenshot("creation-identity-preview");
    await clickText("Continue");
    await until("document.querySelector('[data-testid=\"input-token-website\"]')");
    await input('[data-testid="input-token-website"]', "not-a-url");
    await clickText("Continue");
    assert.equal(await evaluate("!!document.querySelector('[data-testid=\"input-token-website\"]')"), true);
    await input('[data-testid="input-token-website"]', "");
    await clickText("Continue");
    await until("document.body.innerText.includes('Funding wallet')");
    assert.equal(await evaluate("document.body.innerText.includes('Configuration only') || document.body.innerText.includes('configuration')"), true);
    await clickText("Back");
    await clickText("Back");
    assert.equal(await evaluate("document.querySelector('[data-testid=\"input-token-name\"]').value"), "Browser verification");
  });

  await check("real signed API authentication enables empty private-data views", async () => {
    const nonce = await (await fetch(`${base}/api/auth/nonce/${address}`)).json();
    const message = new TextEncoder().encode(nonce.message);
    const signature = nacl.sign.detached(message, fixture.secretKey);
    const response = await fetch(`${base}/api/auth/verify`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address, messageHex: Buffer.from(message).toString("hex"), signatureHex: Buffer.from(signature).toString("hex") }),
    });
    const result = await response.json();
    assert.equal(result.success, true);
    fixtureId = result.user.id;
    const rawCookie = response.headers.getSetCookie()[0]?.split(";")[0];
    assert.ok(rawCookie);
    const equals = rawCookie.indexOf("=");
    await cdp("Network.setCookie", { name: rawCookie.slice(0, equals), value: rawCookie.slice(equals + 1), url: base, httpOnly: true, sameSite: "Lax" });
    await navigate("/wallets");
    assert.equal(await evaluate("document.body.innerText.includes('Connect to view')"), false);
    await click('[data-testid="button-create-wallet"]');
    await until("document.querySelector('[role=\"dialog\"]')");
    await screenshot("wallet-create-empty-signed-in");
    await click('[role="dialog"] button:has(.sr-only)');
    await click('[data-testid="button-import-wallet"]');
    await until("document.querySelector('[role=\"dialog\"] input[type=\"password\"]')");
    await screenshot("wallet-import-hidden-key-field");
    await click('[role="dialog"] button:has(.sr-only)');
    await navigate("/my-tokens");
    assert.equal(await evaluate("document.body.innerText.includes('Your launches will live here')"), true);
  });
  await check("automation can be configured without enabling financial execution", async () => {
    await navigate("/monitor");
    assert.equal(await evaluate("!!document.querySelector('[data-testid=\"input-sol-amount\"]')"), true);
    assert.equal(await evaluate("document.querySelector('[data-testid=\"button-start-autobuy\"]')?.disabled"), true);
    await screenshot("monitor-signed-in-paused");
  });

  await check("principal routes fit the requested mobile, tablet and desktop widths", async () => {
    const routes = [
      ["/", "explore", 390, 844],
      ["/deploy", "create", 375, 812],
      ["/wallets", "wallets", 1280, 800],
      ["/monitor", "monitor", 390, 844],
      ["/my-tokens", "my-tokens", 375, 812],
      ["/docs", "docs", 768, 1024],
      ["/deploy/verification-missing", "token-unavailable", 390, 844],
    ];
    for (const [path, name, width, height] of routes) {
      await viewport(width, height);
      await navigate(path);
      const layout = await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})");
      assert.ok(layout.scroll <= layout.width, `${name} overflows ${layout.scroll}/${layout.width}`);
      await screenshot(`${name}-${width}-light`);
    }
  });
  await check("dark preference persists and mobile navigation remains accessible", async () => {
    await viewport(390, 844);
    await navigate("/");
    await click('[data-testid="button-theme-toggle"]');
    assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), true);
    await navigate("/");
    assert.equal(await evaluate("document.documentElement.classList.contains('dark')"), true);
    await screenshot("explore-390-dark");
    await click('button[aria-label="Open menu"]');
    assert.equal(await evaluate("[...document.querySelectorAll('a')].some(a=>a.textContent.trim()==='My Tokens' && a.getBoundingClientRect().height>0)"), true);
    await viewport(1440, 900);
    await navigate("/docs");
    await screenshot("docs-desktop-dark");
  });
  await check("no unhandled application exceptions", async () => assert.equal(errors.length, 0));
} finally {
  if (socket) { try { await cdp("Network.clearBrowserCookies"); } catch {} socket.close(); }
  browser.kill("SIGTERM");
  // Clean only this generated authentication fixture. It owns no managed wallets
  // and no transactions are created by this test.
  if (fixtureId) {
    await pool.query("DELETE FROM session WHERE sess->>'userId' = $1", [fixtureId]);
  }
  await pool.query("DELETE FROM users WHERE wallet_address = $1 AND ($2::text IS NULL OR id::text = $2)", [address, fixtureId ?? null]);
  fixture.secretKey.fill(0);
  await pool.end();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  let combined = results;
  if (only) {
    try {
      const previous = JSON.parse(await readFile(`${output}/results.json`, "utf8"));
      combined = [...previous.results.filter((result) => !results.some((current) => current.name === result.name)), ...results];
    } catch {}
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ results: combined, unhandledExceptions: errors.length }, null, 2));
}
if (results.some((result) => !result.passed)) process.exitCode = 1;
