import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Bot, TrendingUp, Shield, Zap, BarChart3, Users, ArrowRight, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Redirect signed-in users to the dashboard. Navigation must run as an
  // effect, never during render.
  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const scrollToRobots = () => {
    document.getElementById("robots")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl text-foreground">Boot Trade</span>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI</span>
          </div>
          <Button onClick={() => window.location.href = getLoginUrl()} variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Acessar Plataforma
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.15_185/0.08),transparent_60%)]" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Plataforma de Trading com Inteligência Artificial
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Automatize seus{" "}
              <span className="text-gradient">investimentos</span>{" "}
              com IA preditiva
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Robôs especializados em múltiplos mercados, gestão de risco automatizada e 
              inteligência artificial que aprende continuamente para maximizar seus resultados.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => window.location.href = getLoginUrl()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-12 text-base glow-cyan"
              >
                Começar Agora <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" onClick={scrollToRobots} className="px-8 h-12 text-base border-border hover:bg-secondary">
                Ver Demonstração
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 max-w-4xl mx-auto">
            {[
              { label: "Robôs Ativos", value: "12+", icon: Bot },
              { label: "Taxa de Acerto", value: "78%", icon: TrendingUp },
              { label: "Mercados", value: "7", icon: BarChart3 },
              { label: "Traders", value: "2.5k+", icon: Users },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-4 text-center">
                <stat.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Ecossistema Completo de Trading</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para operar com inteligência em um único lugar.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Bot,
                title: "Robôs Especializados",
                description: "Cada robô é especialista em um mercado: Dólar, Ações, Cripto, Forex e Apostas Esportivas.",
              },
              {
                icon: Shield,
                title: "Gestão de Risco IA",
                description: "Sistema inteligente que protege seu capital com stop loss dinâmico, limites diários e drawdown máximo.",
              },
              {
                icon: TrendingUp,
                title: "Backtest Engine",
                description: "Simule estratégias com dados históricos reais antes de arriscar capital. Monte Carlo e stress test inclusos.",
              },
              {
                icon: Zap,
                title: "Paper Trade",
                description: "Teste robôs em ambiente simulado ultra realista antes de operar em conta real.",
              },
              {
                icon: Users,
                title: "Social Trading",
                description: "Siga os melhores traders, copie estratégias vencedoras e construa sua reputação.",
              },
              {
                icon: BarChart3,
                title: "Marketplace",
                description: "Compre, venda e assine robôs criados pela comunidade. Monetize suas estratégias.",
              },
            ].map((feature) => (
              <div key={feature.title} className="glass rounded-xl p-6 hover:border-primary/30 transition-all duration-300 group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Robots Section */}
      <section id="robots" className="py-20 border-t border-border/50 scroll-mt-16">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">Robôs Especialistas</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Cada robô é treinado com IA para dominar um mercado específico.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: "Athena AI", market: "Mini Índice", return: "+18.5%", color: "text-primary" },
              { name: "Kraken AI", market: "Criptomoedas", return: "+24.2%", color: "text-chart-2" },
              { name: "Odin AI", market: "Forex", return: "+12.8%", color: "text-chart-3" },
              { name: "Titan AI", market: "Day Trade", return: "+15.3%", color: "text-chart-4" },
            ].map((robot) => (
              <div key={robot.name} className="glass rounded-xl p-5 hover:border-primary/30 transition-all duration-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{robot.name}</p>
                    <p className="text-xs text-muted-foreground">{robot.market}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Retorno Mensal</span>
                  <span className={`font-bold ${robot.color}`}>{robot.return}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/50">
        <div className="container">
          <div className="glass rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto glow-cyan">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Pronto para operar com inteligência?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Comece gratuitamente com paper trade e evolua para operações reais quando estiver confiante.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              {["Sem risco inicial", "IA adaptativa", "Suporte 24/7"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 h-12 text-base"
            >
              Criar Conta Gratuita <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">Boot Trade AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Investimentos envolvem riscos. Resultados passados não garantem retornos futuros.
          </p>
        </div>
      </footer>
    </div>
  );
}
