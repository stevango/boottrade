import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Robots from "./pages/Robots";
import RobotDetail from "./pages/RobotDetail";
import RobotBrain from "./pages/RobotBrain";
import Backtest from "./pages/Backtest";
import PaperTrade from "./pages/PaperTrade";
import RiskManagement from "./pages/RiskManagement";
import Marketplace from "./pages/Marketplace";
import SocialTrading from "./pages/SocialTrading";
import Admin from "./pages/Admin";
import Calendar from "./pages/Calendar";
import Portfolio from "./pages/Portfolio";
import AiAdvisor from "./pages/AiAdvisor";
import Goals from "./pages/Goals";
import PnL from "./pages/PnL";
import SmartAllocator from "./pages/SmartAllocator";
import Brokers from "./pages/Brokers";

function Router() {
  return (
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
