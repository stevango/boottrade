import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Streamdown } from "streamdown";

type Topic = "risco" | "alocacao" | "operacao" | "tecnologia" | "geral";

/**
 * Reusable AI consultant. Each screen passes a topic and a function that builds
 * the real, on-screen context to send. Degrades gracefully when no LLM is set.
 */
export function AdvisorPanel({
  topic,
  title = "Consultor IA",
  description,
  getContext,
  buttonLabel = "Consultar IA",
}: {
  topic: Topic;
  title?: string;
  description?: string;
  getContext: () => string;
  buttonLabel?: string;
}) {
  const [response, setResponse] = useState("");
  const advise = trpc.ai.advise.useMutation({
    onSuccess: (r) => setResponse(r.response),
  });

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> {title}
          </CardTitle>
          <Button size="sm" onClick={() => advise.mutate({ topic, context: getContext().slice(0, 8000) })} disabled={advise.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {advise.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analisando...</> : <><Sparkles className="w-3 h-3 mr-1" /> {buttonLabel}</>}
          </Button>
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardHeader>
      {(response || advise.isPending) && (
        <CardContent>
          {advise.isPending && !response ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Analisando seus dados...
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none"><Streamdown>{response}</Streamdown></div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
