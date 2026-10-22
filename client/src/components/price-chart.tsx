import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, LineChart, Loader2 } from "lucide-react";

interface PriceChartProps {
  tokenMint: string;
  height?: number;
}

export function PriceChart({ tokenMint, height = 450 }: PriceChartProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.classList.contains("dark") ? "dark" : "light");

  const dextoolsUrl = `https://www.dextools.io/app/en/solana/pair-explorer/${tokenMint}`;
  const embedUrl = `https://www.dextools.io/widget-chart/en/solana/pe-light/${tokenMint}?theme=${theme}&chartType=1&chartResolution=15&drawingToolbars=false`;

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [tokenMint]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div
        className="flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-md bg-muted/20"
        style={{ height: `${height}px` }}
        data-testid="price-chart-error"
      >
        <LineChart className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Chart not available</p>
        <p className="text-xs mt-2 text-center max-w-xs px-4">
          Token might not be listed on DEXTools yet or still on bonding curve.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.open(dextoolsUrl, "_blank")}
          data-testid="button-dextools-link"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Check on DEXTools
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        src={embedUrl}
        className="w-full h-full border-0 rounded-md"
        title="DEXTools Chart"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        data-testid="price-chart-iframe"
      />
    </div>
  );
}
