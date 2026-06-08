import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Trophy, TrendingUp, Clock, CheckCircle, Pause, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const categoryLabels: Record<string, { label: string; color: string }> = {
  patrimonio: { label: "Patrimônio", color: "text-primary" },
  renda_passiva: { label: "Renda Passiva", color: "text-profit" },
  aposentadoria: { label: "Aposentadoria", color: "text-chart-3" },
  emergencia: { label: "Emergência", color: "text-warning" },
  projeto: { label: "Projeto", color: "text-chart-4" },
  outro: { label: "Outro", color: "text-muted-foreground" },
};

export default function Goals() {
  const { data: goals, isLoading } = trpc.goals.list.useQuery();
  const { data: projections } = trpc.goals.projections.useQuery();
  const addMutation = trpc.goals.add.useMutation({
    onSuccess: () => {
      toast.success("Meta criada com sucesso!");
      setDialogOpen(false);
    },
  });
  const utils = trpc.useUtils();
  const updateMutation = trpc.goals.update.useMutation({
    onSuccess: () => {
      toast.success("Meta atualizada!");
      utils.goals.list.invalidate();
      utils.goals.projections.invalidate();
      setDialogOpen(false);
      setEditingId(null);
    },
  });
  const removeMutation = trpc.goals.remove.useMutation({
    onSuccess: () => {
      toast.success("Meta excluída.");
      utils.goals.list.invalidate();
      utils.goals.projections.invalidate();
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: "",
    targetAmount: 0,
    deadline: "",
    priority: "medium" as string,
    category: "patrimonio" as string,
    monthlyContribution: 0,
  });

  const activeGoals = goals?.filter((g) => g.status === "active") || [];
  const completedGoals = goals?.filter((g) => g.status === "completed") || [];
  const totalTarget = activeGoals.reduce((sum, g) => sum + parseFloat(String(g.targetAmount || "0")), 0);
  const totalCurrent = activeGoals.reduce((sum, g) => sum + parseFloat(String(g.currentAmount || "0")), 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  const handleAddGoal = () => {
    if (!newGoal.title || !newGoal.targetAmount) {
      toast.error("Preencha título e valor alvo");
      return;
    }
    const payload = {
      title: newGoal.title,
      targetAmount: newGoal.targetAmount,
      deadline: newGoal.deadline || undefined,
      priority: newGoal.priority as any,
      category: newGoal.category as any,
      monthlyContribution: newGoal.monthlyContribution || undefined,
    };
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, ...payload, deadline: payload.deadline ?? null });
    } else {
      addMutation.mutate(payload);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Target className="w-7 h-7 text-primary" />
              Metas de Patrimônio
            </h1>
            <p className="text-muted-foreground">Defina objetivos e acompanhe sua evolução financeira</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => {
                setNewGoal({
                  title: "Copa do Mundo 2026 — Banca de Apostas",
                  targetAmount: 5000,
                  deadline: "2026-07-19",
                  priority: "low",
                  category: "projeto",
                  monthlyContribution: 0,
                });
                setDialogOpen(true);
              }}
              title="Pré-preenche uma banca defensiva para apostas durante a Copa do Mundo 2026 (11/jun a 19/jul)"
            >
              <Trophy className="w-4 h-4 mr-2" /> Preset: Copa 2026
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingId != null ? "Editar Meta" : "Criar Nova Meta"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Título da Meta</Label>
                  <Input value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="Ex: Primeiro milhão, Aposentadoria aos 50" className="bg-secondary border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Valor Alvo (R$)</Label>
                    <Input type="number" value={newGoal.targetAmount || ""} onChange={(e) => setNewGoal({ ...newGoal, targetAmount: parseFloat(e.target.value) || 0 })} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Aporte Mensal (R$)</Label>
                    <Input type="number" value={newGoal.monthlyContribution || ""} onChange={(e) => setNewGoal({ ...newGoal, monthlyContribution: parseFloat(e.target.value) || 0 })} className="bg-secondary border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Categoria</Label>
                    <Select value={newGoal.category} onValueChange={(v) => setNewGoal({ ...newGoal, category: v })}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Prioridade</Label>
                    <Select value={newGoal.priority} onValueChange={(v) => setNewGoal({ ...newGoal, priority: v })}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Prazo (opcional)</Label>
                  <Input type="date" value={newGoal.deadline} onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })} className="bg-secondary border-border" />
                </div>
                <Button onClick={handleAddGoal} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={addMutation.isPending || updateMutation.isPending}>
                  {editingId != null
                    ? (updateMutation.isPending ? "Salvando..." : "Salvar alterações")
                    : (addMutation.isPending ? "Criando..." : "Criar Meta")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Overall Progress */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-muted-foreground">Progresso Geral</p>
                <p className="text-2xl font-bold text-foreground">
                  R$ {totalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  <span className="text-sm text-muted-foreground font-normal ml-2">
                    / R$ {totalTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{overallProgress.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{activeGoals.length} metas ativas</p>
              </div>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </CardContent>
        </Card>

        {/* Active Goals */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeGoals.map((goal) => {
            const target = parseFloat(String(goal.targetAmount || "0"));
            const current = parseFloat(String(goal.currentAmount || "0"));
            const progress = target > 0 ? (current / target) * 100 : 0;
            const monthly = parseFloat(String(goal.monthlyContribution || "0"));
            const remaining = target - current;
            const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
            const cat = categoryLabels[goal.category];

            return (
              <Card key={goal.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{goal.title}</p>
                      <Badge variant="outline" className={`text-xs mt-1 ${cat?.color}`}>{cat?.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-xs ${
                        goal.priority === "high" ? "text-loss border-loss/30" :
                        goal.priority === "medium" ? "text-warning border-warning/30" :
                        "text-muted-foreground"
                      }`}>
                        {goal.priority === "high" ? "Alta" : goal.priority === "medium" ? "Média" : "Baixa"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingId(goal.id);
                          setNewGoal({
                            title: goal.title,
                            targetAmount: parseFloat(String(goal.targetAmount || "0")),
                            deadline: goal.deadline ? new Date(goal.deadline).toISOString().slice(0, 10) : "",
                            priority: goal.priority || "medium",
                            category: goal.category || "patrimonio",
                            monthlyContribution: parseFloat(String(goal.monthlyContribution || "0")),
                          });
                          setDialogOpen(true);
                        }}
                        title="Editar meta"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-loss"
                        onClick={() => {
                          if (confirm(`Excluir a meta "${goal.title}"? Essa ação não pode ser desfeita.`)) {
                            removeMutation.mutate({ id: goal.id });
                          }
                        }}
                        title="Excluir meta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">R$ {current.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                      <span className="text-foreground font-medium">{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Meta: R$ {target.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    {monthly > 0 && (
                      <span className="text-muted-foreground">
                        Aporte: R$ {monthly.toLocaleString("pt-BR")}/mês
                      </span>
                    )}
                    {monthsLeft && (
                      <span className="text-primary">
                        ~{monthsLeft} meses restantes
                      </span>
                    )}
                  </div>

                  {/* Projection from backend */}
                  {(() => {
                    const proj = projections?.find((p: any) => p.id === goal.id);
                    if (proj && proj.projectedDate) {
                      return (
                        <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                          <p className="text-xs text-primary font-medium">Projeção</p>
                          <p className="text-xs text-muted-foreground">
                            Data estimada: {new Date(proj.projectedDate).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                          </p>
                          {proj.monthsToGoal && monthly > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Sugestão: aumente para R$ {(monthly * 1.2).toFixed(0)}/mês para alcançar {Math.floor(proj.monthsToGoal * 0.8)} meses antes
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {goal.deadline && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Prazo: {new Date(goal.deadline).toLocaleDateString("pt-BR")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              Metas Conquistadas
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedGoals.map((goal) => (
                <Card key={goal.id} className="bg-card border-profit/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-profit" />
                      <p className="text-sm font-medium text-foreground">{goal.title}</p>
                    </div>
                    <p className="text-xs text-profit mt-1">
                      R$ {parseFloat(String(goal.targetAmount || "0")).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} alcançado!
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeGoals.length === 0 && completedGoals.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Target className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">Defina suas metas financeiras</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Crie metas de patrimônio, renda passiva, aposentadoria e projetos pessoais. Acompanhe seu progresso e mantenha o foco.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
