// Centralized environment detection for consistent behavior across preview and production

export const isProduction = 
  process.env.NODE_ENV === "production" || 
  process.env.REPLIT_DEPLOYMENT === "1";

export const isDevelopment = !isProduction;

// Log environment at startup for debugging
console.log(`[ENV] Running in ${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode`);
console.log(`[ENV] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[ENV] REPLIT_DEPLOYMENT: ${process.env.REPLIT_DEPLOYMENT || "not set"}`);
console.log(`[ENV] DATABASE_URL: ${process.env.DATABASE_URL ? "configured" : "NOT SET"}`);
console.log(`[ENV] SESSION_SECRET: ${process.env.SESSION_SECRET ? "configured" : "NOT SET"}`);
