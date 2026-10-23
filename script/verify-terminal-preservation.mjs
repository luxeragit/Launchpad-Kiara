import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";

const baseline = "bf407d1459952a6eb32ec997d32cfe11f5b8a246";
const original = (path) => execFileSync("git", ["show", `${baseline}:${path}`], { encoding: "utf8" });
const protectedFiles = [
  "shared/schema.ts", "server/auth.ts", "server/crypto.ts", "server/routes.ts",
  "server/network-safety.ts", "server/solana.ts", "server/pumpfun-api.ts",
  "server/pumpfun-deploy.ts", "server/raydium-api.ts", "server/jupiter-api.ts",
  "server/trade-orchestrator.ts", "server/autobuy.ts", "server/autosell.ts",
];
// Approved read-only market corrections: exactly five discovery-route edits.
// Every other route byte (auth, wallets, finance, automation) stays protected.
const normalizeMarketRouteEdits = (source) => source
  .replace("// Verified Pump.fun/PumpSwap markets; explicit five-minute ranking.", "// Pumpfun trending tokens (most traded)")
  .replace('app.get("/api/pumpfun/trending", async (req, res)', 'app.get("/api/pumpfun/trending", async (_req, res)')
  .replace('getTrendingTokensAsync(req.query.sort === "activity" ? "activity" : "trending")', "getTrendingTokensAsync()")
  .replace("// Largest absolute five-minute price changes, not volume.", "// Pumpfun top movers (highest volume)")
  .replace("const tokens = await getTopMovers();", "const tokens = getTopMovers();");
for (const path of protectedFiles) {
  const current = await readFile(path, "utf8");
  assert.equal(path === "server/routes.ts" ? normalizeMarketRouteEdits(current) : current,
    original(path), `Protected implementation changed: ${path}`);
}
const routes = (text) => [...text.matchAll(/app\.(get|post|put|patch|delete)\("([^"]+)"/g)].map((match) => `${match[1]} ${match[2]}`);
const expectedRoutes = routes(original("server/routes.ts"));
assert.deepEqual(routes(await readFile("server/routes.ts", "utf8")), expectedRoutes);
async function sourceFiles(dir) {
  const output = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isDirectory()) output.push(...await sourceFiles(`${dir}/${item.name}`));
    else if (/\.(ts|tsx)$/.test(item.name)) output.push(`${dir}/${item.name}`);
  }
  return output;
}
const pages = ["monitor", "deploy", "wallets", "token-dashboard"];
const before = pages.flatMap((page) =>
  [...original(`client/src/pages/${page}.tsx`).matchAll(/const (\w+)\s*=\s*useMutation/g)].map((match) => match[1]));
const client = (await Promise.all((await sourceFiles("client/src")).map((path) => readFile(path, "utf8")))).join("\n");
const missing = before.filter((name) => !new RegExp(`\\b${name}\\s*=\\s*useMutation`).test(client));
assert.deepEqual(missing, [], "An original mutation requires manual preservation review");
for (const path of ['path="/"', 'path="/deploy"', 'path="/deploy/:id"', 'path="/wallets"', 'path="/docs"', 'path="/my-tokens"', 'path="/monitor"']) {
  assert.ok(client.includes(path), `Lost deep link: ${path}`);
}
console.log(`PASS: ${protectedFiles.length - 1} protected backend/schema modules byte-identical; only five approved read-only market-route edits; ${expectedRoutes.length} endpoints retained.`);
console.log(`PASS: ${before.length} original mutation identifiers retained across reachable client source; legacy and added routes retained.`);
console.log("This static inventory is supplemental; it does not prove UI reachability or live transaction execution.");
