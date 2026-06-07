import { ENV } from "./_core/env";
import { invokeLLM, type Message } from "./_core/llm";
import { getAppSetting } from "./db";

// Provider-agnostic chat wrapper so the AI features work standalone.
// Priority: Manus Forge (if configured) → OpenAI-compatible provider via
// OPENAI_API_KEY / LLM_* env vars OR admin-managed app settings → graceful
// "not configured" error.

export class LLMNotConfiguredError extends Error {
  constructor() {
    super("LLM provider not configured");
    this.name = "LLMNotConfiguredError";
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function forgeConfigured() {
  return Boolean(ENV.forgeApiKey);
}

async function standaloneConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || (await getAppSetting("OPENAI_API_KEY")) || "";
  if (!apiKey) return null;
  const baseUrl = (process.env.LLM_BASE_URL || (await getAppSetting("OPENAI_BASE_URL")) || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || (await getAppSetting("OPENAI_MODEL")) || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export async function isLLMConfigured(): Promise<boolean> {
  return forgeConfigured() || (await standaloneConfig()) !== null;
}

// Lightweight verification: GET {baseUrl}/models — confirms key + base without
// consuming tokens. Returns ok/message for the UI tester.
export async function testLLMConnection(): Promise<{ ok: boolean; message: string }> {
  if (forgeConfigured()) return { ok: true, message: "Forge (Manus) ativo" };
  const cfg = await standaloneConfig();
  if (!cfg) return { ok: false, message: "Nenhuma chave configurada (env ou UI)." };
  try {
    const resp = await fetch(`${cfg.baseUrl}/models`, {
      headers: { authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return { ok: false, message: `${resp.status} ${resp.statusText}` };
    const data = await resp.json().catch(() => ({})) as { data?: unknown[] };
    const count = Array.isArray(data.data) ? data.data.length : 0;
    return { ok: true, message: `Conectado em ${cfg.baseUrl} (${count} modelos disponíveis)` };
  } catch (e) {
    return { ok: false, message: String(e).slice(0, 200) };
  }
}

export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  if (forgeConfigured()) {
    const result = await invokeLLM({ messages: messages as Message[] });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : JSON.stringify(content);
  }

  const cfg = await standaloneConfig();
  if (!cfg) throw new LLMNotConfiguredError();

  const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: 1500 }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`LLM ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
