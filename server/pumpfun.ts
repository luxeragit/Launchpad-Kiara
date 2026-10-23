import WebSocket from "ws";
import { triggerAutoBuyCallback } from "./autobuy";
import { PumpMarketFeed, type MarketRanking } from "./market-feed";

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
let lastNewTokenAt: number | null = null;
const marketFeed = new PumpMarketFeed(() => recentTokens.map((token) => token.mint));

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
      
      // New-token streaming is free. Token trades require explicit mints and a
      // funded metered account; never silently enable that subscription.
    });

    ws.on("message", async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle new token creation events (txType: "create")
        if (message.mint && message.name && message.txType === 'create') {
          if (recentTokens.some((token) => token.mint === message.mint)) return;
          lastNewTokenAt = Date.now();
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

export function initPumpfunStream() {
  connectWebSocket();
  void marketFeed.refresh();
}

export function getRecentTokens(): PumpfunToken[] {
  return recentTokens;
}

export async function getTrendingTokensAsync(ranking: MarketRanking = "trending"): Promise<PumpfunToken[]> {
  await marketFeed.refresh();
  return marketFeed.ranked(ranking);
}

// Sync version for compatibility
export function getTrendingTokens(): PumpfunToken[] {
  return marketFeed.ranked("trending");
}

export async function getTopMovers(): Promise<PumpfunToken[]> {
  await marketFeed.refresh();
  return marketFeed.ranked("movers");
}

export function getPumpfunConnectionStatus() {
  return {
    connected: ws !== null && ws.readyState === WebSocket.OPEN,
    tokenCount: recentTokens.length,
    trendingCount: marketFeed.ranked("trending").length,
    stream: { source: "PumpPortal", lastEventAt: lastNewTokenAt },
    market: marketFeed.metadata(),
  };
}
