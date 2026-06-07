// Odds-API.io — alternativa ao The Odds API. Base + auth conforme
// docs.odds-api.io (auth por query param `apiKey`, base /v3). Free tier:
// 100 req/hora. WebSocket existe em planos pagos.
//
// Esta primeira versão só faz "prova de vida" via /sports, suficiente para
// validar a chave e o endpoint. Quando confirmarmos a forma exata da resposta
// de /odds em produção, o scanner é ligado igual ao The Odds API.

import { getAppSetting } from "./db";

const BASE = "https://api.odds-api.io/v3";
const SETTING_KEY = "ODDS_IO_API_KEY";

export class OddsIoNotConfiguredError extends Error {
  constructor() { super("Odds-API.io not configured"); this.name = "OddsIoNotConfiguredError"; }
}

export async function getOddsIoApiKey(): Promise<string | null> {
  return process.env.ODDS_IO_API_KEY || (await getAppSetting(SETTING_KEY));
}

export async function isOddsIoConfigured(): Promise<boolean> {
  return (await getOddsIoApiKey()) !== null;
}

type OddsIoSport = { key?: string; id?: string; name?: string; title?: string; group?: string; active?: boolean };
export type OddsIoSportNormalized = { key: string; title: string; group: string; active: boolean };

async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = await getOddsIoApiKey();
  if (!apiKey) throw new OddsIoNotConfiguredError();
  const qs = new URLSearchParams({ ...params, apiKey }).toString();
  const resp = await fetch(`${BASE}${path}?${qs}`, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Odds-API.io ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

export async function fetchSports(): Promise<OddsIoSportNormalized[]> {
  const raw = await call<OddsIoSport[]>("/sports");
  // Normaliza para o mesmo shape que usamos no UI (key/title/group/active).
  return (raw ?? []).map((s) => ({
    key: s.key ?? s.id ?? "",
    title: s.title ?? s.name ?? s.key ?? s.id ?? "",
    group: s.group ?? "Outros",
    active: s.active !== false,
  })).filter((s) => s.key);
}
