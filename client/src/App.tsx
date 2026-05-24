import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Lazy-load feature pages so the landing page ships a small initial bundle.
// Heavy deps (recharts, streamdown/shiki/mermaid) stay out of the first paint.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Robots = lazy(() => import("./pages/Robots"));
const RobotDetail = lazy(() => import("./pages/RobotDetail"));
const RobotBrain = lazy(() => import("./pages/RobotBrain"));
const Backtest = lazy(() => import("./pages/Backtest"));
const PaperTrade = lazy(() => import("./pages/PaperTrade"));
const RiskManagement = lazy(() => import("./pages/RiskManagement"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const SocialTrading = lazy(() => import("./pages/SocialTrading"));
const Admin = lazy(() => import("./pages/Admin"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const AiAdvisor = lazy(() => import("./pages/AiAdvisor"));
const Goals = lazy(() => import("./pages/Goals"));
const PnL = lazy(() => import("./pages/PnL"));
const SmartAllocator = lazy(() => import("./pages/SmartAllocator"));
const Brokers = lazy(() => import("./pages/Brokers"));

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
        <Route path="/calendar" component={Calendar} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/advisor" component={AiAdvisor} />
        <Route path="/goals" component={Goals} />
        <Route path="/pnl" component={PnL} />
        <Route path="/allocator" component={SmartAllocator} />
        <Route path="/brokers" component={Brokers} />
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
