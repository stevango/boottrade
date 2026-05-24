import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bot, Loader2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/dashboard");
  }, [loading, isAuthenticated, navigate]);

  const [tab, setTab] = useState<"login" | "register">("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const onAuthed = async () => {
    await utils.auth.me.invalidate();
    navigate("/dashboard");
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: onAuthed,
    onError: (e) => toast.error(e.message || "Falha ao entrar."),
  });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: onAuthed,
    onError: (e) => toast.error(e.message || "Falha ao criar conta."),
  });

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return toast.error("Preencha e-mail e senha.");
    loginMutation.mutate({ email: loginEmail, password: loginPassword });
  };

  const submitRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return toast.error("Informe seu nome.");
    if (regPassword.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres.");
    registerMutation.mutate({ name: regName, email: regEmail, password: regPassword });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.15_185/0.08),transparent_60%)]" />
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-10">
        <button
          onClick={() => navigate("/")}
          className="absolute top-6 left-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl text-foreground">Boot Trade</span>
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI</span>
        </div>

        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2 bg-secondary">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6">
                <form onSubmit={submitLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm text-muted-foreground">E-mail</Label>
                    <Input id="login-email" type="email" autoComplete="email" value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)} placeholder="voce@email.com" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm text-muted-foreground">Senha</Label>
                    <Input id="login-password" type="password" autoComplete="current-password" value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" className="bg-secondary border-border" />
                  </div>
                  <Button type="submit" disabled={loginMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    {loginMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</> : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-6">
                <form onSubmit={submitRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-sm text-muted-foreground">Nome</Label>
                    <Input id="reg-name" autoComplete="name" value={regName}
                      onChange={(e) => setRegName(e.target.value)} placeholder="Seu nome" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-sm text-muted-foreground">E-mail</Label>
                    <Input id="reg-email" type="email" autoComplete="email" value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)} placeholder="voce@email.com" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-sm text-muted-foreground">Senha</Label>
                    <Input id="reg-password" type="password" autoComplete="new-password" value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="bg-secondary border-border" />
                  </div>
                  <Button type="submit" disabled={registerMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    {registerMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando conta...</> : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="relative text-xs text-muted-foreground mt-6 max-w-md text-center">
          Ao continuar, você concorda que investimentos envolvem riscos. Resultados passados não garantem retornos futuros.
        </p>
      </div>
    </div>
  );
}
