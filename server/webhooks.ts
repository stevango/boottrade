// Webhook OUT — sends each new signal to a user-configurable URL so external
// execution platforms (SmarttBot, TradingView strategies via webhook,
// n8n/Zapier automations, MetaTrader EAs) can pick it up and act.
//
// This is the realistic automation path for Brazilian stock brokers, none
// of which expose retail execution APIs. The user configures their target
// platform's webhook URL in /integrations; we POST a structured JSON for
// every new SIM/buy/sell signal.

import { getAppSetting, setAppSetting } from "./db";

export type SignalWebhookPayload = {
  robot: string;          // "athena-ai" | "oracle-ai" | etc
  source: "oracle" | "athena" | "manual";
  decisionId: number;
  asset: string;          // "PETR4" or "Brazil × Argentina | h2h | Brazil"
  side: "buy" | "sell" | "hold";
  market?: string;
  outcome?: string;
  confidence: number;     // 0-100
  reasoning: string;
  bestPrice?: number;
  recommendedStakeBrl?: number;
  decision?: string;      // "SIM" | "NÃO" | "CAUTELOSO" (when advisor ran)
  commence?: string;      // event start time (sports) or null (stocks)
  generatedAt: string;
};

export async function getWebhookConfig(): Promise<{ url: string | null; secret: string | null; enabled: boolean; onlySim: boolean }> {
  const url = await getAppSetting("WEBHOOK_OUT_URL");
  const secret = await getAppSetting("WEBHOOK_OUT_SECRET");
  const enabled = (await getAppSetting("WEBHOOK_OUT_ENABLED"))?.toLowerCase() === "true";
  const onlySim = (await getAppSetting("WEBHOOK_OUT_ONLY_SIM"))?.toLowerCase() !== "false"; // default true
  return { url, secret, enabled, onlySim };
}

export async function setWebhookConfig(input: { url?: string; secret?: string; enabled?: boolean; onlySim?: boolean }) {
  if (input.url != null) await setAppSetting("WEBHOOK_OUT_URL", input.url);
  if (input.secret != null) await setAppSetting("WEBHOOK_OUT_SECRET", input.secret);
  if (input.enabled != null) await setAppSetting("WEBHOOK_OUT_ENABLED", input.enabled ? "true" : "false");
  if (input.onlySim != null) await setAppSetting("WEBHOOK_OUT_ONLY_SIM", input.onlySim ? "true" : "false");
}

// Fire-and-forget post. Caller doesn't await — webhook failures must never
// block signal generation. Errors are logged for diagnostics.
export async function postSignalToWebhook(payload: SignalWebhookPayload): Promise<{ ok: boolean; status?: number; error?: string }> {
  const cfg = await getWebhookConfig();
  if (!cfg.enabled || !cfg.url) return { ok: false, error: "webhook desabilitado" };
  if (cfg.onlySim && payload.decision && payload.decision !== "SIM") {
    return { ok: false, error: "filtrado (somente SIM)" };
  }
  try {
    const resp = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BootTrade/1.0",
        ...(cfg.secret ? { "X-Webhook-Secret": cfg.secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, status: resp.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: resp.status };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

export async function testWebhook(): Promise<{ ok: boolean; status?: number; error?: string }> {
  const sample: SignalWebhookPayload = {
    robot: "test",
    source: "manual",
    decisionId: 0,
    asset: "PETR4 | trend | buy",
    side: "buy",
    confidence: 75,
    reasoning: "Teste de conexão do webhook do Boot Trade.",
    generatedAt: new Date().toISOString(),
  };
  return postSignalToWebhook(sample);
}
