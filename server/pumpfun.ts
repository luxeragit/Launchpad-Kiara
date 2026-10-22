import WebSocket from "ws";
import { triggerAutoBuyCallback } from "./autobuy";

export interface PumpfunToken {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image: string | null;
  creator: string;
  timestamp: number;
  signature?: string;
  tradeCount?: number;
  volume?: number;
  lastPrice?: number;
  priceChange?: number;
  marketCapSol?: number;
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

interface TokenTradeData {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  tradeCount: number;
  volume: number;
  lastPrice: number;
  firstPrice: number;
  lastTradeTime: number;
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

interface TokenMetadata {
  image: string | null;
  description?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

const MAX_TOKENS = 50;
const MAX_TRENDING = 20;
let recentTokens: PumpfunToken[] = [];
let tradeData: Map<string, TokenTradeData> = new Map();
let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;

async function fetchTokenMetadata(uri: string): Promise<TokenMetadata | null> {
  if (!uri) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(uri, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const metadata = await response.json();
    return {
      image: metadata.image || null,
      description: metadata.description || undefined,
      twitter: metadata.twitter || undefined,
      telegram: metadata.telegram || undefined,
      website: metadata.website || undefined,
    };
  } catch (error) {
    return null;
  }
}

function connectWebSocket() {
  if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;
  console.log("[PumpFun] Connecting to PumpPortal WebSocket...");

  try {
    ws = new WebSocket("wss://pumpportal.fun/api/data");

    ws.on("open", () => {
      isConnecting = false;
      console.log("[PumpFun] Connected to PumpPortal WebSocket");
      
      // Subscribe to new token events
      ws?.send(JSON.stringify({ method: "subscribeNewToken" }));
      console.log("[PumpFun] Subscribed to new token events");
      
      // Subscribe to all token trades for trending/movers tracking
      ws?.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [] }));
      console.log("[PumpFun] Subscribed to token trade events");
    });

    ws.on("message", async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle new token creation events (txType: "create")
        if (message.mint && message.name && message.txType === 'create') {
          const uri = message.uri || message.metadataUri || "";
          const marketCapSol = parseFloat(message.marketCapSol) || 0;
          
          const token: PumpfunToken = {
            mint: message.mint || message.tokenAddress || "",
            name: message.name || "Unknown",
            symbol: message.symbol || "???",
            uri: uri,
            image: null,
            creator: message.traderPublicKey || message.user || message.creator || "",
            timestamp: Date.now(),
            signature: message.signature || message.txnHash || "",
            marketCapSol: marketCapSol,
          };

          recentTokens.unshift(token);
          if (recentTokens.length > MAX_TOKENS) {
            recentTokens = recentTokens.slice(0, MAX_TOKENS);
          }
          
          console.log(`[PumpFun] New token: ${token.symbol} (${token.name})`);
          
          // Also initialize trade data for this token
          if (!tradeData.has(token.mint)) {
            tradeData.set(token.mint, {
              mint: token.mint,
              name: token.name,
              symbol: token.symbol,
              image: null,
              tradeCount: 1,
              volume: parseFloat(message.solAmount) || 0,
              lastPrice: marketCapSol,
              firstPrice: marketCapSol,
              lastTradeTime: Date.now(),
            });
          }
          
          // Fetch full metadata including social links, then trigger auto-buy callback
          fetchTokenMetadata(uri).then((metadata) => {
            // Update token with metadata
            if (metadata) {
              const tokenIndex = recentTokens.findIndex(t => t.mint === token.mint);
              if (tokenIndex !== -1) {
                recentTokens[tokenIndex].image = metadata.image;
                recentTokens[tokenIndex].description = metadata.description;
                recentTokens[tokenIndex].twitter = metadata.twitter;
                recentTokens[tokenIndex].telegram = metadata.telegram;
                recentTokens[tokenIndex].website = metadata.website;
              }
              // Also update trade data if exists
              const existing = tradeData.get(token.mint);
              if (existing) {
                existing.image = metadata.image;
                existing.description = metadata.description;
                existing.twitter = metadata.twitter;
                existing.telegram = metadata.telegram;
                existing.website = metadata.website;
              }
            }
            
            // Trigger auto-buy callback AFTER metadata is fetched (so social filters work)
            triggerAutoBuyCallback({
              mint: token.mint,
              name: token.name,
              symbol: token.symbol,
              marketCapSol: token.marketCapSol,
              twitter: metadata?.twitter,
              telegram: metadata?.telegram,
              website: metadata?.website,
            });
          }).catch(() => {
            // Even if metadata fetch fails, still trigger callback with partial data
            triggerAutoBuyCallback({
              mint: token.mint,
              name: token.name,
              symbol: token.symbol,
              marketCapSol: token.marketCapSol,
            });
          });
        }
        
        // Handle trade events (buy/sell) - check multiple formats
        const isTrade = message.txType === 'buy' || message.txType === 'sell' || 
                       message.type === 'trade' || message.tradeType;
        
        if (isTrade && !message.txType?.includes('create')) {
          const mint = message.mint || message.tokenAddress || "";
          const solAmount = parseFloat(message.solAmount) || parseFloat(message.amount) || 0;
          const price = parseFloat(message.marketCapSol) || parseFloat(message.vSolInBondingCurve) || parseFloat(message.price) || 0;
          
          if (mint && solAmount > 0) {
            const existing = tradeData.get(mint);
            
            if (existing) {
              existing.tradeCount++;
              existing.volume += solAmount;
              existing.lastPrice = price || existing.lastPrice;
              existing.lastTradeTime = Date.now();
              
              // Log every 10th trade to avoid spam
              if (existing.tradeCount % 10 === 0) {
                console.log(`[PumpFun] ${existing.symbol}: ${existing.tradeCount} trades, ${existing.volume.toFixed(2)} SOL volume`);
              }
            } else {
              // New token we're seeing trades for
              const uri = message.uri || "";
              tradeData.set(mint, {
                mint,
                name: message.name || message.symbol || "Unknown",
                symbol: message.symbol || "???",
                image: null,
                tradeCount: 1,
                volume: solAmount,
                lastPrice: price,
                firstPrice: price,
                lastTradeTime: Date.now(),
              });
              
              // Fetch full metadata for this token
              if (uri) {
                fetchTokenMetadata(uri).then((metadata) => {
                  const data = tradeData.get(mint);
                  if (data && metadata) {
                    data.image = metadata.image;
                    data.description = metadata.description;
                    data.twitter = metadata.twitter;
                    data.telegram = metadata.telegram;
                    data.website = metadata.website;
                  }
                });
              }
            }
            
            // Cleanup old trade data (older than 1 hour)
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            Array.from(tradeData.entries()).forEach(([key, value]) => {
              if (value.lastTradeTime < oneHourAgo) {
                tradeData.delete(key);
              }
            });
          }
        }
      } catch (error) {
        console.error("[PumpFun] Error parsing message:", error);
      }
    });

    ws.on("error", (error) => {
      console.error("[PumpFun] WebSocket error:", error.message);
      isConnecting = false;
    });

    ws.on("close", () => {
      console.log("[PumpFun] WebSocket connection closed, reconnecting in 5s...");
      isConnecting = false;
      ws = null;
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      reconnectTimeout = setTimeout(connectWebSocket, 5000);
    });
  } catch (error) {
    console.error("[PumpFun] Failed to create WebSocket:", error);
    isConnecting = false;
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    reconnectTimeout = setTimeout(connectWebSocket, 5000);
  }
}

// Cache for API-fetched trending/king of the hill tokens
let cachedApiTrending: PumpfunToken[] = [];
let lastApiFetch = 0;
const API_CACHE_TTL = 30000; // 30 seconds

async function fetchTrendingFromApi(): Promise<PumpfunToken[]> {
  const now = Date.now();
  if (cachedApiTrending.length > 0 && now - lastApiFetch < API_CACHE_TTL) {
    return cachedApiTrending;
  }
  
  try {
    // Fetch latest token profiles from DexScreener (includes trending Solana tokens)
    const response = await fetch("https://api.dexscreener.com/token-profiles/latest/v1", {
      headers: { 
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log("[PumpFun] DexScreener API fetch failed:", response.status);
      return cachedApiTrending;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      // Filter only Solana tokens
      const solanaTokens = data.filter((t: any) => t.chainId === 'solana');
      
      // Fetch additional data for each token from DexScreener pairs API
      const enrichedTokens: PumpfunToken[] = [];
      
      for (const token of solanaTokens.slice(0, 20)) {
        try {
          const pairRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`);
          if (pairRes.ok) {
            const pairData = await pairRes.json();
            const pair = pairData.pairs?.[0];
            
            if (pair) {
              enrichedTokens.push({
                mint: token.tokenAddress,
                name: pair.baseToken?.name || "Unknown",
                symbol: pair.baseToken?.symbol || "???",
                uri: "",
                image: token.icon || null,
                creator: "",
                timestamp: pair.pairCreatedAt || Date.now(),
                tradeCount: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
                volume: pair.volume?.h24 || 0,
                lastPrice: parseFloat(pair.priceNative) || 0,
                priceChange: pair.priceChange?.h24 || 0,
                marketCapSol: (pair.marketCap || 0) / 200, // Approximate SOL value
                twitter: token.links?.find((l: any) => l.type === 'twitter')?.url,
                telegram: token.links?.find((l: any) => l.type === 'telegram')?.url,
                website: token.links?.find((l: any) => l.type === 'website')?.url,
              });
            }
          }
        } catch (e) {
          // Skip failed tokens
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (enrichedTokens.length > 0) {
        // Sort by trade count (most active)
        enrichedTokens.sort((a, b) => (b.tradeCount || 0) - (a.tradeCount || 0));
        cachedApiTrending = enrichedTokens;
        lastApiFetch = now;
        console.log(`[PumpFun] Fetched ${cachedApiTrending.length} trending tokens from DexScreener`);
      }
    }
    
    return cachedApiTrending;
  } catch (error) {
    console.error("[PumpFun] Error fetching trending from DexScreener:", error);
    return cachedApiTrending;
  }
}

export function initPumpfunStream() {
  connectWebSocket();
  // Initial fetch of trending tokens
  fetchTrendingFromApi();
}

export function getRecentTokens(): PumpfunToken[] {
  return recentTokens;
}

export async function getTrendingTokensAsync(): Promise<PumpfunToken[]> {
  // First try to get from Pump.fun API (king of the hill = trending tokens)
  const apiTrending = await fetchTrendingFromApi();
  if (apiTrending.length > 0) {
    return apiTrending;
  }
  
  // Fallback to WebSocket-tracked tokens sorted by trade count
  const trending = Array.from(tradeData.values())
    .filter(t => t.tradeCount > 1) // Only tokens with actual trades
    .sort((a, b) => b.tradeCount - a.tradeCount)
    .slice(0, MAX_TRENDING)
    .map(t => ({
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      uri: "",
      image: t.image,
      creator: "",
      timestamp: t.lastTradeTime,
      tradeCount: t.tradeCount,
      volume: t.volume,
      lastPrice: t.lastPrice,
      priceChange: t.firstPrice > 0 ? ((t.lastPrice - t.firstPrice) / t.firstPrice) * 100 : 0,
      marketCapSol: t.lastPrice,
      description: t.description,
      twitter: t.twitter,
      telegram: t.telegram,
      website: t.website,
    }));
  
  return trending;
}

// Sync version for compatibility
export function getTrendingTokens(): PumpfunToken[] {
  // Return cached API tokens if available
  if (cachedApiTrending.length > 0) {
    return cachedApiTrending;
  }
  
  // Fallback to WebSocket-tracked tokens
  return Array.from(tradeData.values())
    .filter(t => t.tradeCount > 1)
    .sort((a, b) => b.tradeCount - a.tradeCount)
    .slice(0, MAX_TRENDING)
    .map(t => ({
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      uri: "",
      image: t.image,
      creator: "",
      timestamp: t.lastTradeTime,
      tradeCount: t.tradeCount,
      volume: t.volume,
      lastPrice: t.lastPrice,
      priceChange: t.firstPrice > 0 ? ((t.lastPrice - t.firstPrice) / t.firstPrice) * 100 : 0,
      marketCapSol: t.lastPrice,
      description: t.description,
      twitter: t.twitter,
      telegram: t.telegram,
      website: t.website,
    }));
}

export function getTopMovers(): PumpfunToken[] {
  // Use DexScreener API data sorted by volume (biggest movers)
  if (cachedApiTrending.length > 0) {
    const movers = [...cachedApiTrending]
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, MAX_TRENDING);
    return movers;
  }
  
  // Fallback to WebSocket-tracked tokens sorted by volume
  const movers = Array.from(tradeData.values())
    .filter(t => t.volume > 0.5) // Minimum 0.5 SOL volume
    .sort((a, b) => b.volume - a.volume)
    .slice(0, MAX_TRENDING)
    .map(t => ({
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      uri: "",
      image: t.image,
      creator: "",
      timestamp: t.lastTradeTime,
      tradeCount: t.tradeCount,
      volume: t.volume,
      lastPrice: t.lastPrice,
      priceChange: t.firstPrice > 0 ? ((t.lastPrice - t.firstPrice) / t.firstPrice) * 100 : 0,
      marketCapSol: t.lastPrice,
      description: t.description,
      twitter: t.twitter,
      telegram: t.telegram,
      website: t.website,
    }));
  
  return movers;
}

export function getPumpfunConnectionStatus(): { connected: boolean; tokenCount: number; trendingCount: number } {
  return {
    connected: ws !== null && ws.readyState === WebSocket.OPEN,
    tokenCount: recentTokens.length,
    trendingCount: tradeData.size,
  };
}
