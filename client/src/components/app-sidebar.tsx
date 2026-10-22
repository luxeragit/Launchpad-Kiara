import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Activity, Rocket, Wallet, ExternalLink, FileText } from "lucide-react";

const navItems = [
  {
    title: "Explore",
    url: "/",
    icon: Activity,
    description: "Trade monitoring",
  },
  {
    title: "Create",
    url: "/deploy",
    icon: Rocket,
    description: "Token deployment",
  },
  {
    title: "Wallets",
    url: "/wallets",
    icon: Wallet,
    description: "Wallet management",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
          <img
            src="/kiara.png"
            alt="KiaraFun"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">
              KiaraFun
            </span>
            <span className="text-xs text-muted-foreground">
              Solana Trading Dashboard
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Dashboard
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.description}
                    >
                      <Link
                        href={item.url}
                        data-testid={`link-nav-${item.title.toLowerCase()}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={location === "/docs"}
              tooltip="Documentation"
            >
              <Link href="/docs" data-testid="link-nav-docs">
                <FileText className="h-4 w-4" />
                <span>Documentation</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="rounded-md border border-border bg-card/50 p-3">
          <p className="text-xs text-muted-foreground mb-2">
            Open Source Project
          </p>
          <p className="text-xs text-muted-foreground/70">
            Built with transparency in mind.
          </p>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary mt-2"
            data-testid="link-github"
          >
            View Source
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
