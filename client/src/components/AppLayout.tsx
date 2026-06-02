import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bot,
  Brain,
  Calendar,
  CircuitBoard,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PieChart,
  Plug2,
  Radar,
  Shield,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/robots", label: "Robôs", icon: Bot },
  { path: "/portfolio", label: "Carteira", icon: Wallet },
  { path: "/goals", label: "Metas", icon: Target },
  { path: "/advisor", label: "Consultor IA", icon: Sparkles },
  { path: "/allocator", label: "Alocação IA", icon: PieChart },
  { path: "/opportunities", label: "Oportunidades", icon: Radar },
  { path: "/pnl", label: "P&L", icon: BarChart3 },
  { path: "/backtest", label: "Backtest", icon: FlaskConical },
  { path: "/paper-trade", label: "Paper Trade", icon: TrendingUp },
  { path: "/risk", label: "Gestão de Risco", icon: Shield },
  { path: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { path: "/social", label: "Social Trading", icon: Users },
  { path: "/calendar", label: "Calendário", icon: Calendar },
  { path: "/integrations", label: "Integrações", icon: Plug2 },
];

const adminItems = [
  { path: "/admin", label: "Admin", icon: BarChart3 },
  { path: "/auditor", label: "Auditor Técnico", icon: CircuitBoard },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated: the useAuth hook redirects to /login as an effect.
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[240px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground">Boot Trade</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard" className="mx-auto">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/dashboard" && location.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <>
              <div className={cn("my-3 border-t border-border", collapsed && "mx-2")} />
              {adminItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-3">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name || "Trader"}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
              <button
                onClick={() => logout()}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => logout()}
              className="w-full flex justify-center text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-border border border-border items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-6 bg-background/80 backdrop-blur-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground mr-4"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm">
              <div className="w-2 h-2 rounded-full bg-profit animate-pulse" />
              <span className="text-muted-foreground">Mercado</span>
              <span className="text-profit font-medium">Aberto</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
