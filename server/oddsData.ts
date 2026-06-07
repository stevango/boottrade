// The Odds API (the-odds-api.com) — pluggable sports odds feed.
// Free tier: ~500 req/mês. Used to surface value bets across bookmakers for
// the Oracle AI brain. Pure helpers; no execution endpoints exist on this API.

import { getAppSetting } from "./db";
import { computeValueBets, type NormalizedEvent, type ValueBet } from "./oddsAnalysis";

const BASE = "https://api.the-odds-api.com/v4";
const SETTING_KEY = "ODDS_API_KEY";

export class OddsNotConfiguredError extends Error {
  constructor() { super("Odds API not configured"); this.name = "OddsNotConfiguredError"; }
}

// Effective API key: prefers the server env var, otherwise the admin-stored
// app setting. Lets the operator pick either path without code changes.
export async function getOddsApiKey(): Promise<string | null> {
  return process.env.ODDS_API_KEY || (await getAppSetting(SETTING_KEY));
}

export async function isOddsConfigured(): Promise<boolean> {
  return (await getOddsApiKey()) !== null;
}

type ApiSport = { key: string; group: string; title: string; description: string; active: boolean; has_outrights: boolean };
type ApiOutcome = { name: string; price: number; point?: number };
type ApiMarket = { key: string; outcomes: ApiOutcome[] };
type ApiBookmaker = { key: string; title: string; last_update: string; markets: ApiMarket[] };
type ApiEvent = { id: string; sport_key: string; commence_time: string; home_team: string; away_team: string; bookmakers: ApiBookmaker[] };

export type Sport = { key: string; title: string; group: string; active: boolean };
export type { ValueBet };

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = await getOddsApiKey();
  if (!apiKey) throw new OddsNotConfiguredError();
  const qs = new URLSearchParams({ ...params, apiKey }).toString();
  const resp = await fetch(`${BASE}${path}?${qs}`, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Odds API ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

export async function fetchSports(): Promise<Sport[]> {
  const data = await call<ApiSport[]>("/sports", {});
  return data.filter(s => s.active).map(s => ({ key: s.key, title: s.title, group: s.group, active: s.active }));
}

export async function fetchOpportunities(opts: {
  sport: string;
  regions?: string; // CSV: us,uk,eu,au
  markets?: string; // CSV: h2h,totals,spreads
  bookmakers?: string; // CSV bookmaker keys; overrides regions
  edgeThresholdPct?: number; // min edge % to include
}): Promise<{ events: ApiEvent[]; valueBets: ValueBet[] }> {
  const params: Record<string, string> = {
    regions: opts.regions ?? "eu,uk",
    markets: opts.markets ?? "h2h",
    oddsFormat: "decimal",
  };
  if (opts.bookmakers) params.bookmakers = opts.bookmakers;
  const events = await call<ApiEvent[]>(`/sports/${encodeURIComponent(opts.sport)}/odds`, params);
  const normalized: NormalizedEvent[] = events.map(ev => ({
    id: ev.id,
    commenceTime: ev.commence_time,
    home: ev.home_team,
    away: ev.away_team,
    bookmakers: (ev.bookmakers ?? []).map(bm => ({
      name: bm.title,
      markets: (bm.markets ?? []).map(mk => ({ key: mk.key, outcomes: mk.outcomes ?? [] })),
    })),
  }));
  const valueBets = computeValueBets(normalized, opts.edgeThresholdPct ?? 3);
  return { events, valueBets };
}
