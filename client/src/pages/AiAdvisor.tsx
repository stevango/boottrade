import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Sparkles, TrendingUp, Shield, Globe, Target, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const contextOptions = [
  { id: "consultor", label: "Consultor Financeiro", icon: Sparkles, description: "Análise de patrimônio e sugestões de alocação" },
  { id: "auditor", label: "Auditor de Operações", icon: Shield, description: "Análise de trades e identificação de padrões" },
  { id: "mercado", label: "Analista de Mercado", icon: Globe, description: "Tendências nacionais e internacionais" },
  { id: "operacao", label: "Assistente de Trading", icon: Target, description: "Suporte a decisões de compra e venda" },
];

const suggestedPrompts: Record<string, string[]> = {
  consultor: [
    "Tenho R$ 50.000 para investir. Como devo alocar entre renda fixa e variável?",
    "Qual a melhor estratégia para curto prazo com perfil moderado?",
    "Compare CDB, Tesouro Direto e Fundos para reserva de emergência",
    "Como diversificar minha carteira para longo prazo?",
  ],
  auditor: [
    "Analise minhas últimas operações e identifique padrões de erro",
    "Qual meu maior problema operacional atualmente?",
    "Como melhorar minha taxa de acerto nos trades?",
    "Quais horários tenho melhor performance?",
  ],
  mercado: [
    "Quais as principais tendências do mercado brasileiro hoje?",
    "Como o cenário internacional afeta meus investimentos?",
    "Quais setores estão em alta para os próximos meses?",
    "Análise do dólar e impacto na bolsa brasileira",
  ],
  operacao: [
    "Devo comprar PETR4 no preço atual?",
    "Qual o melhor ponto de entrada para mini índice?",
    "Calcule o risk/reward de uma operação com stop em 2% e alvo em 5%",
    "Quando devo realizar lucro em uma posição de swing trade?",
  ],
};

export default function AiAdvisor() {
  const [activeContext, setActiveContext] = useState<string>("consultor");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const message = text || inputValue;
    if (!message.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: message, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const result = await chatMutation.mutateAsync({
        message,
        context: activeContext as any,
      });
      const assistantMsg: Message = { role: "assistant", content: result.response || "", timestamp: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente.", timestamp: Date.now() };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContextChange = (ctx: string) => {
    setActiveContext(ctx);
    setMessages([]);
  };

  const currentContext = contextOptions.find((c) => c.id === activeContext);

  return (
    <AppLayout>
      <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Brain className="w-7 h-7 text-primary" />
            Consultor Financeiro IA
          </h1>
          <p className="text-muted-foreground">Seu auditor e consultor pessoal para decisões financeiras inteligentes</p>
        </div>

        {/* Context Selector */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {contextOptions.map((ctx) => (
            <button
              key={ctx.id}
              onClick={() => handleContextChange(ctx.id)}
              className={`p-3 rounded-lg border text-left transition-all ${
                activeContext === ctx.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <ctx.icon className={`w-4 h-4 ${activeContext === ctx.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium text-foreground">{ctx.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{ctx.description}</p>
            </button>
          ))}
        </div>

        {/* Chat Area */}
        <Card className="bg-card border-border flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              {currentContext && <currentContext.icon className="w-4 h-4 text-primary" />}
              <CardTitle className="text-sm">{currentContext?.label}</CardTitle>
              <Badge variant="outline" className="text-xs ml-auto">IA Ativa</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <Brain className="w-16 h-16 text-primary/20 mb-4" />
                  <p className="text-lg font-medium text-foreground mb-2">Como posso ajudar?</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                    Sou seu {currentContext?.label?.toLowerCase()}. Pergunte sobre investimentos, estratégias, mercado ou análise de operações.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2 max-w-lg w-full">
                    {suggestedPrompts[activeContext]?.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(prompt)}
                        className="text-left p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
                      >
                        <p className="text-xs text-muted-foreground line-clamp-2">{prompt}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-secondary/50 border border-border"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-secondary/50 border border-border rounded-lg p-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={`Pergunte ao ${currentContext?.label?.toLowerCase()}...`}
                  className="bg-secondary border-border"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
