// Odds-API.io — alternativa ao The Odds API. Base + auth conforme
// docs.odds-api.io (auth por query param `apiKey`, base /v3). Free tier:
// 100 req/hora. WebSocket existe em planos pagos.
//
// Esta primeira versão só faz "prova de vida" via /sports, suficiente para
// validar a chave e o endpoint. Quando confirmarmos a forma exata da resposta
// de /odds em produção, o scanner é ligado igual ao The Odds API.

import { getAppSetting } from "./db";
import { computeValueBets, type NormalizedEvent, type ValueBet } from "./oddsAnalysis";

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

// Different envelope shapes seen across odds providers: raw array, or wrapped
// in { data | sports | results | items }. Try each before giving up.
function unwrapList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["data", "sports", "results", "items", "list"]) {
      if (Array.isArray(o[key])) return o[key] as T[];
    }
  }
  return [];
}

export async function fetchSports(): Promise<OddsIoSportNormalized[]> {
  const raw = await call<unknown>("/sports");
  const list = unwrapList<OddsIoSport>(raw);
  if (list.length === 0 && raw && typeof raw === "object") {
    const peek = JSON.stringify(raw).slice(0, 180);
    throw new Error(`Resposta inesperada de /sports (não é array nem envelope conhecido): ${peek}`);
  }
  return list.map((s) => ({
    key: s.key ?? s.id ?? "",
    title: s.title ?? s.name ?? s.key ?? s.id ?? "",
    group: s.group ?? "Outros",
    active: s.active !== false,
  })).filter((s) => s.key);
}

// Tolerant parser for /odds — different odds APIs return slightly different
// JSON shapes. Try common field names and skip what doesn't parse.
function normalize(raw: unknown[]): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  for (const r of raw ?? []) {
    const ev = r as Record<string, unknown>;
    const id = String(ev.id ?? ev.event_id ?? ev.eventId ?? "");
    const home = String(ev.home_team ?? ev.home ?? ev.homeTeam ?? "");
    const away = String(ev.away_team ?? ev.away ?? ev.awayTeam ?? "");
    const commenceTime = String(ev.commence_time ?? ev.commenceTime ?? ev.start_time ?? ev.startTime ?? "");
    if (!home || !away) continue;
    const bms = (ev.bookmakers ?? ev.books ?? []) as unknown[];
    const bookmakers = bms.map((b) => {
      const bm = b as Record<string, unknown>;
      const name = String(bm.title ?? bm.name ?? bm.key ?? "");
      const mks = (bm.markets ?? bm.lines ?? []) as unknown[];
      const markets = mks.map((m) => {
        const mk = m as Record<string, unknown>;
        const key = String(mk.key ?? mk.name ?? mk.market ?? "");
        const outs = (mk.outcomes ?? mk.selections ?? mk.lines ?? []) as unknown[];
        const outcomes = outs.map((o) => {
          const oc = o as Record<string, unknown>;
          const ocName = String(oc.name ?? oc.label ?? oc.selection ?? "");
          const price = Number(oc.price ?? oc.odds ?? oc.decimal ?? 0);
          const point = oc.point != null ? Number(oc.point) : oc.handicap != null ? Number(oc.handicap) : undefined;
          return { name: ocName, price, point };
        }).filter((o) => o.name && Number.isFinite(o.price) && o.price > 1);
        return { key, outcomes };
      }).filter((mk) => mk.key && mk.outcomes.length > 0);
      return { name, markets };
    }).filter((bm) => bm.name && bm.markets.length > 0);
    events.push({ id, commenceTime, home, away, bookmakers });
  }
  return events;
}

export async function fetchOpportunities(opts: {
  sport: string;
  bookmakers?: string;
  edgeThresholdPct?: number;
}): Promise<{ valueBets: ValueBet[]; eventCount: number }> {
  const params: Record<string, string> = { sport: opts.sport };
  if (opts.bookmakers) params.bookmakers = opts.bookmakers;
  const raw = await call<unknown>("/odds", params);
  const events = normalize(unwrapList<unknown>(raw));
  const valueBets = computeValueBets(events, opts.edgeThresholdPct ?? 3);
  return { valueBets, eventCount: events.length };
}
