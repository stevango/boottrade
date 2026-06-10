import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// After a new deploy, hashed chunk filenames change, so a stale browser tab can
// fail to load a lazy page chunk. Recover automatically by reloading once
// (guarded against an infinite loop if the chunk is genuinely missing).
function lazyWithReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory()
      .then((m) => { sessionStorage.removeItem("chunkReload"); return m; })
      .catch((err) => {
        if (sessionStorage.getItem("chunkReload")) throw err;
        sessionStorage.setItem("chunkReload", "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // never resolves; the page is reloading
      }),
  );
}

// Lazy-load feature pages so the landing page ships a small initial bundle.
// Heavy deps (recharts, streamdown/shiki/mermaid) stay out of the first paint.
const Login = lazyWithReload(() => import("./pages/Login"));
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Robots = lazyWithReload(() => import("./pages/Robots"));
const RobotDetail = lazyWithReload(() => import("./pages/RobotDetail"));
const RobotBrain = lazyWithReload(() => import("./pages/RobotBrain"));
const Backtest = lazyWithReload(() => import("./pages/Backtest"));
const PaperTrade = lazyWithReload(() => import("./pages/PaperTrade"));
const RiskManagement = lazyWithReload(() => import("./pages/RiskManagement"));
const Marketplace = lazyWithReload(() => import("./pages/Marketplace"));
const SocialTrading = lazyWithReload(() => import("./pages/SocialTrading"));
const Admin = lazyWithReload(() => import("./pages/Admin"));
const Calendar = lazyWithReload(() => import("./pages/Calendar"));
const Portfolio = lazyWithReload(() => import("./pages/Portfolio"));
const AiAdvisor = lazyWithReload(() => import("./pages/AiAdvisor"));
const Goals = lazyWithReload(() => import("./pages/Goals"));
const PnL = lazyWithReload(() => import("./pages/PnL"));
const SmartAllocator = lazyWithReload(() => import("./pages/SmartAllocator"));
const Opportunities = lazyWithReload(() => import("./pages/Opportunities"));
const Auditor = lazyWithReload(() => import("./pages/Auditor"));
const Integrations = lazyWithReload(() => import("./pages/Integrations"));
const Signals = lazyWithReload(() => import("./pages/Signals"));
const Recommendations = lazyWithReload(() => import("./pages/Recommendations"));
const Simulation = lazyWithReload(() => import("./pages/Simulation"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/robots" component={Robots} />
        <Route path="/robots/:id" component={RobotDetail} />
        <Route path="/robots/:id/brain" component={RobotBrain} />
        <Route path="/backtest" component={Backtest} />
        <Route path="/paper-trade" component={PaperTrade} />
        <Route path="/risk" component={RiskManagement} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/social" component={SocialTrading} />
        <Route path="/admin" component={Admin} />
        <Route path="/auditor" component={Auditor} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/advisor" component={AiAdvisor} />
        <Route path="/goals" component={Goals} />
        <Route path="/pnl" component={PnL} />
        <Route path="/allocator" component={SmartAllocator} />
        <Route path="/opportunities" component={Opportunities} />
        <Route path="/signals" component={Signals} />
        <Route path="/recommendations" component={Recommendations} />
        <Route path="/simulation" component={Simulation} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/brokers" component={Integrations} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
