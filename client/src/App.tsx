import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import MonitorPage from "@/pages/monitor";
import DeployPage from "@/pages/deploy";
import WalletsPage from "@/pages/wallets";
import TokenDashboardPage from "@/pages/token-dashboard";
import DocsPage from "@/pages/docs";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MonitorPage} />
      <Route path="/deploy" component={DeployPage} />
      <Route path="/deploy/:id" component={TokenDashboardPage} />
      <Route path="/wallets" component={WalletsPage} />
      <Route path="/docs" component={DocsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <div className="flex flex-col min-h-screen w-full">
            <Navbar />
            <main className="flex-1 overflow-auto">
              <Router />
            </main>

          </div>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
