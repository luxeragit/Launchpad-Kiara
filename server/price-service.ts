import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getRaydiumSwapQuote } from "./raydium-api";

const PUMP_API_URL = "https://frontend-api.pump.fun";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface PriceData {
  price: number;
  priceInSol: number;
  source: "pumpfun" | "raydium" | "cached" | "fallback";
  timestamp: number;
  isGraduated: boolean;
}

interface CachedPrice {
  data: PriceData;
  expiresAt: number;
}

const priceCache = new Map<string, CachedPrice>();
const CACHE_DURATION_MS = 10000;
const REQUEST_COOLDOWN_MS = 2000;
const lastRequestTime = new Map<string, number>();

export async function getTokenPrice(tokenMint: string, fallbackPrice?: number): Promise<PriceData> {
  const cached = priceCache.get(tokenMint);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, source: "cached" };
  }

  const lastRequest = lastRequestTime.get(tokenMint) || 0;
  const timeSinceLastRequest = Date.now() - lastRequest;
  if (timeSinceLastRequest < REQUEST_COOLDOWN_MS && cached) {
    return { ...cached.data, source: "cached" };
  }

  lastRequestTime.set(tokenMint, Date.now());

  try {
    const pumpfunData = await fetchPumpFunPrice(tokenMint);
    
    if (pumpfunData) {
      if (pumpfunData.isGraduated) {
        const raydiumPrice = await fetchRaydiumPrice(tokenMint);
        if (raydiumPrice) {
          cachePrice(tokenMint, raydiumPrice);
          return raydiumPrice;
        }
      }
      
      cachePrice(tokenMint, pumpfunData);
      return pumpfunData;
    }

    const raydiumPrice = await fetchRaydiumPrice(tokenMint);
    if (raydiumPrice) {
      cachePrice(tokenMint, raydiumPrice);
      return raydiumPrice;
    }

  } catch (error) {
    console.error(`[PriceService] Error fetching price for ${tokenMint}:`, error);
  }

  const fallbackData: PriceData = {
    price: fallbackPrice || 0,
    priceInSol: fallbackPrice || 0,
    source: "fallback",
    timestamp: Date.now(),
    isGraduated: false,
  };
  
  return fallbackData;
}

async function fetchPumpFunPrice(tokenMint: string): Promise<PriceData | null> {
  try {
    const response = await fetch(`${PUMP_API_URL}/coins/${tokenMint}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.log(`[PriceService] Pump.fun API returned ${response.status} for ${tokenMint}`);
      return null;
    }

    const data = await response.json();
    
    const virtualSolReserves = Number(data.virtual_sol_reserves || 0);
    const virtualTokenReserves = Number(data.virtual_token_reserves || 0);
    const isComplete = data.complete === true;

    if (virtualTokenReserves <= 0) {
      console.log(`[PriceService] Invalid reserves for ${tokenMint}`);
      return null;
    }

    // Pump.fun API returns reserves in lamports
    // buyPrice is stored as SOL/token = (solAmount / tokenAmount)
    // So we need: (virtual_sol_reserves / LAMPORTS_PER_SOL) / virtual_token_reserves
    const priceInSol = (virtualSolReserves / LAMPORTS_PER_SOL) / virtualTokenReserves;

    console.log(`[PriceService] Pump.fun price for ${tokenMint}: ${priceInSol.toExponential(4)} SOL/token (graduated: ${isComplete})`);

    return {
      price: priceInSol,
      priceInSol,
      source: "pumpfun",
      timestamp: Date.now(),
      isGraduated: isComplete,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      console.log(`[PriceService] Pump.fun request timed out for ${tokenMint}`);
    } else {
      console.error(`[PriceService] Pump.fun fetch error for ${tokenMint}:`, error);
    }
    return null;
  }
}

async function fetchRaydiumPrice(tokenMint: string): Promise<PriceData | null> {
  try {
    // Use 1 SOL worth of lamports as test amount
    const testAmount = 1 * LAMPORTS_PER_SOL;
    
    const quote = await getRaydiumSwapQuote(SOL_MINT, tokenMint, testAmount, 100);
    
    if (!quote.success || quote.outputAmount <= 0) {
      console.log(`[PriceService] Raydium quote failed for ${tokenMint}`);
      return null;
    }

    // quote.outputAmount is in raw token units (with decimals applied)
    // For 1 SOL, we get X raw tokens
    // Price in SOL/raw_token = 1 SOL / rawTokensReceived
    // This matches how buyPrice is calculated: solAmount / rawTokenAmount
    const rawTokensPerSol = quote.outputAmount;
    const pricePerRawToken = 1 / rawTokensPerSol;

    console.log(`[PriceService] Raydium price for ${tokenMint}: ${pricePerRawToken.toExponential(4)} SOL/raw_token (${rawTokensPerSol.toExponential(2)} raw tokens per SOL)`);

    return {
      price: pricePerRawToken,
      priceInSol: pricePerRawToken,
      source: "raydium",
      timestamp: Date.now(),
      isGraduated: true,
    };
  } catch (error) {
    console.error(`[PriceService] Raydium fetch error for ${tokenMint}:`, error);
    return null;
  }
}

function cachePrice(tokenMint: string, data: PriceData): void {
  priceCache.set(tokenMint, {
    data,
    expiresAt: Date.now() + CACHE_DURATION_MS,
  });
}

export function clearPriceCache(): void {
  priceCache.clear();
  lastRequestTime.clear();
}

export function getPriceCacheStats(): { size: number; tokens: string[] } {
  return {
    size: priceCache.size,
    tokens: Array.from(priceCache.keys()),
  };
}

export async function getBatchPrices(
  tokenMints: string[],
  fallbackPrices?: Map<string, number>
): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>();
  
  const chunks: string[][] = [];
  for (let i = 0; i < tokenMints.length; i += 3) {
    chunks.push(tokenMints.slice(i, i + 3));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(mint => 
      getTokenPrice(mint, fallbackPrices?.get(mint))
    );
    
    const chunkResults = await Promise.all(promises);
    
    chunk.forEach((mint, index) => {
      results.set(mint, chunkResults[index]);
    });

    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}
