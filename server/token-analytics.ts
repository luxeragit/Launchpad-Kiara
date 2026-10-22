import { Connection, PublicKey } from "@solana/web3.js";

const PUMP_API_URL = "https://frontend-api.pump.fun";
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export interface TokenAnalytics {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  price: number;
  priceChange1m: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  holders: number;
  transactions: number;
  bondingCurveProgress: number;
  bondingCurveTarget: number;
  score: number;
}

export interface RugSafetyScore {
  totalScore: number;
  checks: {
    name: string;
    passed: boolean;
    value: string;
    weight: number;
  }[];
}

// Fetch from both APIs and merge data - Pump.fun for bonding curve, DexScreener for price data
export async function fetchTokenAnalytics(mint: string): Promise<TokenAnalytics | null> {
  try {
    // Fetch both in parallel
    const [pumpData, dexData] = await Promise.all([
      fetchFromPumpFun(mint),
      fetchFromDexScreener(mint)
    ]);

    // If Pump.fun has data, use it as base (has accurate bonding curve info)
    if (pumpData) {
      console.log(`[Analytics] Got data from Pump.fun for ${mint}`);
      // If DexScreener also has data, merge price data (more accurate for graduated tokens)
      if (dexData && pumpData.bondingCurveProgress >= 100) {
        return {
          ...pumpData,
          price: dexData.price || pumpData.price,
          marketCap: dexData.marketCap || pumpData.marketCap,
          volume24h: dexData.volume24h || pumpData.volume24h,
          priceChange5m: dexData.priceChange5m || pumpData.priceChange5m,
          priceChange1h: dexData.priceChange1h || pumpData.priceChange1h,
          priceChange24h: dexData.priceChange24h || pumpData.priceChange24h,
        };
      }
      return pumpData;
    }

    // If only DexScreener has data (token might have graduated)
    if (dexData) {
      console.log(`[Analytics] Got data from DexScreener for ${mint}`);
      return dexData;
    }

    // Return placeholder if both fail
    console.log(`[Analytics] No data available for ${mint}`);
    return createPlaceholder(mint);
  } catch (error) {
    console.error(`[Analytics] Error fetching token ${mint}:`, error);
    return createPlaceholder(mint);
  }
}

async function fetchFromDexScreener(mint: string): Promise<TokenAnalytics | null> {
  try {
    const response = await fetch(`${DEXSCREENER_API}/${mint}`, {
      headers: { "Accept": "application/json" }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.pairs || data.pairs.length === 0) return null;

    // Get the pair with highest liquidity
    const pair = data.pairs.reduce((best: any, current: any) => {
      const bestLiq = best.liquidity?.usd || 0;
      const currLiq = current.liquidity?.usd || 0;
      return currLiq > bestLiq ? current : best;
    }, data.pairs[0]);

    const holders = await fetchHolderCount(mint);
    
    // Check if token is still on pumpfun bonding curve or graduated to raydium
    const dexId = pair.dexId?.toLowerCase() || "";
    const isPumpfunBondingCurve = dexId === "pumpfun";
    const marketCapUsd = pair.marketCap || pair.fdv || 0;
    
    // Pump.fun tokens graduate at ~$69K market cap
    // If on pumpfun, calculate progress based on market cap (0% at $0, 100% at $69K)
    const GRADUATION_MCAP = 69000;
    let bondingCurveProgress: number;
    
    if (isPumpfunBondingCurve) {
      bondingCurveProgress = Math.min(99, (marketCapUsd / GRADUATION_MCAP) * 100);
      console.log(`[Analytics] Token on Pump.fun bonding curve, progress: ${bondingCurveProgress.toFixed(1)}% (mcap: $${marketCapUsd})`);
    } else {
      // Token is on Raydium or other DEX = graduated
      bondingCurveProgress = 100;
      console.log(`[Analytics] Token graduated to ${dexId}`);
    }

    return {
      mint,
      name: pair.baseToken?.name || "Unknown",
      symbol: pair.baseToken?.symbol || "???",
      image: pair.info?.imageUrl || "",
      price: parseFloat(pair.priceNative) || 0,
      priceChange1m: pair.priceChange?.m5 ? parseFloat(pair.priceChange.m5) / 5 : 0,
      priceChange5m: parseFloat(pair.priceChange?.m5 || 0),
      priceChange1h: parseFloat(pair.priceChange?.h1 || 0),
      priceChange24h: parseFloat(pair.priceChange?.h24 || 0),
      marketCap: marketCapUsd,
      liquidity: (pair.liquidity?.usd || 0) / 200, // Convert USD to approximate SOL
      volume24h: pair.volume?.h24 || 0,
      holders,
      transactions: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      bondingCurveProgress,
      bondingCurveTarget: 85,
      score: isPumpfunBondingCurve ? 50 : 75,
    };
  } catch (error) {
    console.error(`[Analytics] DexScreener error for ${mint}:`, error);
    return null;
  }
}

async function fetchFromPumpFun(mint: string): Promise<TokenAnalytics | null> {
  try {
    console.log(`[Analytics] Fetching Pump.fun data for ${mint}`);
    const response = await fetch(`${PUMP_API_URL}/coins/${mint}`);
    
    if (!response.ok) {
      console.log(`[Analytics] Pump.fun returned ${response.status} for ${mint}`);
      return null;
    }

    const data = await response.json();
    console.log(`[Analytics] Pump.fun data received for ${mint}:`, JSON.stringify(data).slice(0, 200));
    
    const virtualSolReserves = data.virtual_sol_reserves || 0;
    const virtualTokenReserves = data.virtual_token_reserves || 1;
    const pricePerToken = virtualSolReserves / virtualTokenReserves;
    const totalSupply = data.total_supply || 1_000_000_000;
    const marketCapSol = pricePerToken * totalSupply / 1e9;
    
    // Check if token has graduated (complete field from Pump.fun)
    const isComplete = data.complete === true;
    
    const BONDING_TARGET_SOL = 85;
    // If complete, bonding is 100%. Otherwise calculate from reserves
    const bondingCurveProgress = isComplete 
      ? 100 
      : Math.min(99, ((virtualSolReserves / 1e9) / BONDING_TARGET_SOL) * 100); // Cap at 99% if not complete

    const holders = await fetchHolderCount(mint);
    
    return {
      mint: data.mint,
      name: data.name || "Unknown",
      symbol: data.symbol || "???",
      image: data.image_uri || "",
      price: pricePerToken / 1e9,
      priceChange1m: data.price_change_1m || 0,
      priceChange5m: data.price_change_5m || 0,
      priceChange1h: data.price_change_1h || 0,
      priceChange24h: data.price_change_24h || 0,
      marketCap: data.usd_market_cap || marketCapSol * 200,
      liquidity: virtualSolReserves / 1e9,
      volume24h: data.volume_24h || 0,
      holders,
      transactions: data.reply_count || 0,
      bondingCurveProgress,
      bondingCurveTarget: BONDING_TARGET_SOL,
      score: data.king_of_the_hill_timestamp ? 100 : Math.min(50, bondingCurveProgress / 2),
    };
  } catch (error) {
    console.error(`[Analytics] Pump.fun error for ${mint}:`, error);
    return null;
  }
}

function createPlaceholder(mint: string): TokenAnalytics {
  return {
    mint,
    name: "Loading...",
    symbol: "...",
    image: "",
    price: 0,
    priceChange1m: 0,
    priceChange5m: 0,
    priceChange1h: 0,
    priceChange24h: 0,
    marketCap: 0,
    liquidity: 0,
    volume24h: 0,
    holders: 0,
    transactions: 0,
    bondingCurveProgress: 0,
    bondingCurveTarget: 85,
    score: 0,
  };
}

async function fetchHolderCount(mint: string): Promise<number> {
  try {
    const connection = new Connection(SOLANA_RPC);
    const mintPubkey = new PublicKey(mint);
    const accounts = await connection.getTokenLargestAccounts(mintPubkey);
    return accounts.value.filter(a => Number(a.amount) > 0).length;
  } catch {
    return 0;
  }
}

export async function fetchTokenHolders(mint: string): Promise<{address: string; percentage: number}[]> {
  try {
    const connection = new Connection(SOLANA_RPC);
    const mintPubkey = new PublicKey(mint);
    
    const largestAccounts = await connection.getTokenLargestAccounts(mintPubkey);
    const supply = await connection.getTokenSupply(mintPubkey);
    const totalSupply = Number(supply.value.amount);
    
    const holders = largestAccounts.value.map(account => ({
      address: account.address.toBase58(),
      percentage: (Number(account.amount) / totalSupply) * 100,
    }));
    
    return holders.slice(0, 10);
  } catch (error) {
    console.error(`[Analytics] Error fetching holders for ${mint}:`, error);
    return [];
  }
}

export async function checkMintAuthority(mint: string): Promise<boolean> {
  try {
    const connection = new Connection(SOLANA_RPC);
    const mintPubkey = new PublicKey(mint);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    
    if (!mintInfo.value?.data || typeof mintInfo.value.data !== "object") {
      return false;
    }
    
    const parsed = (mintInfo.value.data as any).parsed;
    return parsed?.info?.mintAuthority === null;
  } catch (error) {
    console.error(`[Analytics] Error checking mint authority for ${mint}:`, error);
    return false;
  }
}

export async function checkFreezeAuthority(mint: string): Promise<boolean> {
  try {
    const connection = new Connection(SOLANA_RPC);
    const mintPubkey = new PublicKey(mint);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
    
    if (!mintInfo.value?.data || typeof mintInfo.value.data !== "object") {
      return false;
    }
    
    const parsed = (mintInfo.value.data as any).parsed;
    return parsed?.info?.freezeAuthority === null;
  } catch (error) {
    console.error(`[Analytics] Error checking freeze authority for ${mint}:`, error);
    return false;
  }
}

export async function calculateRugSafetyScore(mint: string): Promise<RugSafetyScore> {
  const checks: RugSafetyScore["checks"] = [];
  let totalScore = 0;
  let maxScore = 0;

  const holders = await fetchTokenHolders(mint);
  const top10Percentage = holders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
  const top10Passed = top10Percentage < 50;
  checks.push({
    name: "Top 10 Holders",
    passed: top10Passed,
    value: `${top10Percentage.toFixed(1)}%`,
    weight: 15,
  });
  if (top10Passed) totalScore += 15;
  maxScore += 15;

  const holdersCount = holders.length;
  const holdersPassed = holdersCount >= 10;
  checks.push({
    name: "Holder Count",
    passed: holdersPassed,
    value: holdersCount.toString(),
    weight: 10,
  });
  if (holdersPassed) totalScore += 10;
  maxScore += 10;

  const noMint = await checkMintAuthority(mint);
  checks.push({
    name: "Mint Disabled",
    passed: noMint,
    value: noMint ? "Yes" : "No",
    weight: 20,
  });
  if (noMint) totalScore += 20;
  maxScore += 20;

  const noFreeze = await checkFreezeAuthority(mint);
  checks.push({
    name: "Freeze Disabled",
    passed: noFreeze,
    value: noFreeze ? "Yes" : "No",
    weight: 20,
  });
  if (noFreeze) totalScore += 20;
  maxScore += 20;

  const devHolding = holders[0]?.percentage || 0;
  const devPassed = devHolding < 10;
  checks.push({
    name: "Dev Holdings",
    passed: devPassed,
    value: `${devHolding.toFixed(1)}%`,
    weight: 15,
  });
  if (devPassed) totalScore += 15;
  maxScore += 15;

  const analytics = await fetchTokenAnalytics(mint);
  const liquidityPassed = (analytics?.liquidity || 0) > 1;
  checks.push({
    name: "Liquidity > 1 SOL",
    passed: liquidityPassed,
    value: `${(analytics?.liquidity || 0).toFixed(2)} SOL`,
    weight: 10,
  });
  if (liquidityPassed) totalScore += 10;
  maxScore += 10;

  const bondingPassed = (analytics?.bondingCurveProgress || 0) > 20;
  checks.push({
    name: "Bonding Progress > 20%",
    passed: bondingPassed,
    value: `${(analytics?.bondingCurveProgress || 0).toFixed(1)}%`,
    weight: 10,
  });
  if (bondingPassed) totalScore += 10;
  maxScore += 10;

  return {
    totalScore: Math.round((totalScore / maxScore) * 100),
    checks,
  };
}
