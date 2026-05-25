import { ENV } from "./_core/env";
import { invokeLLM, type Message } from "./_core/llm";

// Provider-agnostic chat wrapper so the AI features work standalone.
// Priority: Manus Forge (if configured) → OpenAI-compatible provider via
// OPENAI_API_KEY / LLM_* env vars → graceful "not configured" error.

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

function standaloneConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "";
  if (!apiKey) return null;
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

export function isLLMConfigured(): boolean {
  return forgeConfigured() || standaloneConfig() !== null;
}

export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  if (forgeConfigured()) {
    const result = await invokeLLM({ messages: messages as Message[] });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : JSON.stringify(content);
  }

  const cfg = standaloneConfig();
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
