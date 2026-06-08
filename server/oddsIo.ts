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

type OddsIoSport = { key?: string; id?: string; slug?: string; name?: string; title?: string; group?: string; category?: string; active?: boolean };
export type OddsIoSportNormalized = { key: string; title: string; group: string; active: boolean };

// Returns the HTTP status, the raw text body and the parsed JSON (if any) so
// callers can build precise diagnostic messages when the body shape isn't what
// they expected. The /sports endpoint at odds-api.io has been observed to
// return {} or [] for some accounts/plans — we want the UI to surface that
// instead of silently saying "Resposta vazia".
async function callRaw(path: string, params: Record<string, string> = {}): Promise<{ status: number; text: string; json: unknown }> {
  const apiKey = await getOddsIoApiKey();
  if (!apiKey) throw new OddsIoNotConfiguredError();
  const qs = new URLSearchParams({ ...params, apiKey }).toString();
  const resp = await fetch(`${BASE}${path}?${qs}`, { signal: AbortSignal.timeout(20_000) });
  const text = await resp.text().catch(() => "");
  if (!resp.ok) {
    throw new Error(`Odds-API.io ${resp.status}: ${text.slice(0, 200)}`);
  }
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave json null, callers will use text */ }
  return { status: resp.status, text, json };
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
  const { status, text, json } = await callRaw("/sports");
  const list = unwrapList<OddsIoSport>(json);
  const mapped = list.map((s) => ({
    key: s.slug ?? s.key ?? s.id ?? "",
    title: s.title ?? s.name ?? s.slug ?? s.key ?? s.id ?? "",
    group: s.group ?? s.category ?? "Outros",
    active: s.active !== false,
  })).filter((s) => s.key);
  if (mapped.length === 0) {
    let peek: string;
    if (json == null) peek = text ? `body não-JSON: ${text.slice(0, 200)}` : "body vazio";
    else if (Array.isArray(json) && json.length === 0) peek = "[] (array vazio — token válido mas plano sem esportes)";
    else if (list.length === 0) peek = `shape (sem array reconhecido): ${JSON.stringify(json).slice(0, 220)}`;
    else peek = `${list.length} itens devolvidos mas sem campos key/id — primeiro item: ${JSON.stringify(list[0]).slice(0, 220)}`;
    throw new Error(`/sports HTTP ${status} → ${peek}`);
  }
  return mapped;
}

// Tolerant parser for a single /odds event response. odds-api.io returns the
// event-level odds with bookmakers/markets/outcomes nested inside; field names
// vary across endpoint versions so we accept several aliases.
type RawEventLite = { id?: string; event_id?: string; eventId?: string; home?: string; away?: string; home_team?: string; away_team?: string; homeTeam?: string; awayTeam?: string; commence_time?: string; commenceTime?: string; start_time?: string; startTime?: string };

function normalizeOneEvent(raw: unknown, fallback?: RawEventLite): NormalizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const ev = raw as Record<string, unknown>;
  const id = String(ev.id ?? ev.event_id ?? ev.eventId ?? fallback?.id ?? fallback?.event_id ?? fallback?.eventId ?? "");
  const home = String(ev.home_team ?? ev.home ?? ev.homeTeam ?? fallback?.home ?? fallback?.home_team ?? fallback?.homeTeam ?? "");
  const away = String(ev.away_team ?? ev.away ?? ev.awayTeam ?? fallback?.away ?? fallback?.away_team ?? fallback?.awayTeam ?? "");
  const commenceTime = String(ev.commence_time ?? ev.commenceTime ?? ev.start_time ?? ev.startTime ?? fallback?.commence_time ?? fallback?.commenceTime ?? fallback?.start_time ?? fallback?.startTime ?? "");
  if (!home || !away) return null;
  const bms = (ev.bookmakers ?? ev.books ?? ev.odds ?? []) as unknown[];
  const bookmakers = bms.map((b) => {
    const bm = b as Record<string, unknown>;
    const name = String(bm.title ?? bm.name ?? bm.key ?? bm.bookmaker ?? "");
    const mks = (bm.markets ?? bm.lines ?? bm.bets ?? []) as unknown[];
    const markets = mks.map((m) => {
      const mk = m as Record<string, unknown>;
      const key = String(mk.key ?? mk.name ?? mk.market ?? mk.type ?? "");
      const outs = (mk.outcomes ?? mk.selections ?? mk.lines ?? mk.options ?? []) as unknown[];
      const outcomes = outs.map((o) => {
        const oc = o as Record<string, unknown>;
        const ocName = String(oc.name ?? oc.label ?? oc.selection ?? oc.outcome ?? "");
        const price = Number(oc.price ?? oc.odds ?? oc.decimal ?? oc.value ?? 0);
        const point = oc.point != null ? Number(oc.point) : oc.handicap != null ? Number(oc.handicap) : undefined;
        return { name: ocName, price, point };
      }).filter((o) => o.name && Number.isFinite(o.price) && o.price > 1);
      return { key, outcomes };
    }).filter((mk) => mk.key && mk.outcomes.length > 0);
    return { name, markets };
  }).filter((bm) => bm.name && bm.markets.length > 0);
  return { id, commenceTime, home, away, bookmakers };
}

// /odds requires real bookmaker slugs (the upstream errors on guesses like
// "bet365"). Cache the canonical list for an hour to avoid burning quota on
// every search.
type CachedBookmakers = { csv: string; fetchedAt: number };
let bookmakersCache: CachedBookmakers | null = null;
const BOOKMAKERS_TTL_MS = 60 * 60 * 1000;

export async function fetchBookmakers(): Promise<string> {
  if (bookmakersCache && Date.now() - bookmakersCache.fetchedAt < BOOKMAKERS_TTL_MS) {
    return bookmakersCache.csv;
  }
  // /bookmakers/selected returns the slugs the caller's plan is actually
  // allowed to query. Using the full /bookmakers list triggers a 403
  // "Access denied. You're allowed max N bookmakers" because the upstream
  // validates the request against the account's selection.
  const { status, json } = await callRaw("/bookmakers/selected");
  const list = unwrapList<string | Record<string, unknown>>(json);
  const slugs = list
    .map((b) => {
      if (typeof b === "string") return b.trim();
      if (b && typeof b === "object") return String(b.slug ?? b.key ?? b.id ?? b.name ?? "").trim();
      return "";
    })
    .filter((s) => s.length > 0);
  if (slugs.length === 0) {
    throw new Error(`/bookmakers/selected HTTP ${status} → sem slugs selecionados (configure no painel da Odds-API.io). Shape: ${JSON.stringify(json).slice(0, 220)}`);
  }
  // /odds caps the bookmakers param at 30 entries (well above any plan's
  // selected count, so this is just a defensive guard).
  const csv = slugs.slice(0, 30).join(",");
  bookmakersCache = { csv, fetchedAt: Date.now() };
  return csv;
}

export async function fetchEvents(sport: string): Promise<RawEventLite[]> {
  const { status, text, json } = await callRaw("/events", { sport });
  const list = unwrapList<RawEventLite>(json);
  const events = list.filter((e) => e && (e.id || e.event_id || e.eventId));
  if (events.length === 0) {
    const peek = json == null
      ? (text ? `body não-JSON: ${text.slice(0, 200)}` : "body vazio")
      : Array.isArray(json) && json.length === 0 ? "sem eventos disponíveis pra esse esporte"
      : list.length === 0 ? `shape (sem array): ${JSON.stringify(json).slice(0, 220)}`
      : `${list.length} itens sem campo id — primeiro: ${JSON.stringify(list[0]).slice(0, 220)}`;
    throw new Error(`/events HTTP ${status} → ${peek}`);
  }
  return events;
}

export async function fetchOpportunities(opts: {
  sport: string;
  bookmakers?: string;
  edgeThresholdPct?: number;
  maxEvents?: number;
}): Promise<{ valueBets: ValueBet[]; eventCount: number; diag?: string }> {
  // odds-api.io requires fetching odds per-event: 1 call to /events, then N
  // calls to /odds?eventId=…. Cap N so we don't burn the user's hourly quota.
  // Default conservatively: free plan has 100 req/h, each search burns
  // 1 (/events) + N (/odds). 5 events = 6 calls/click ≈ 16 searches/hour.
  const maxEvents = Math.max(1, Math.min(opts.maxEvents ?? 5, 20));
  const events = await fetchEvents(opts.sport);
  const slice = events.slice(0, maxEvents);

  // /odds requires real bookmaker slugs (the upstream rejects guessed names
  // like "bet365" with a 400). When the caller doesn't pass an explicit list,
  // fetch the canonical /v3/bookmakers list once and reuse it; the upstream
  // still filters to whatever the caller's plan actually covers.
  const bookmakers = opts.bookmakers || await fetchBookmakers();

  const normalized: NormalizedEvent[] = [];
  let firstOddsError: string | null = null;
  let firstOddsPeek: string | null = null;
  let eventsWithoutBookmakers = 0;
  for (const e of slice) {
    const eventId = String(e.id ?? e.event_id ?? e.eventId ?? "");
    if (!eventId) continue;
    const params: Record<string, string> = { eventId, bookmakers };
    try {
      const { json } = await callRaw("/odds", params);
      const n = normalizeOneEvent(json, e);
      if (n && n.bookmakers.length > 0) {
        normalized.push(n);
      } else {
        eventsWithoutBookmakers++;
        if (!firstOddsPeek) firstOddsPeek = `eventId=${eventId} → ${JSON.stringify(json).slice(0, 220)}`;
      }
    } catch (err) {
      if (!firstOddsError) firstOddsError = `eventId=${eventId} → ${String(err).slice(0, 200)}`;
      console.warn(`[oddsIo] /odds eventId=${eventId} failed:`, err);
    }
  }
  const valueBets = computeValueBets(normalized, opts.edgeThresholdPct ?? 3);
  let diag: string | undefined;
  if (normalized.length === 0) {
    if (firstOddsError) diag = `/events trouxe ${events.length} eventos, mas /odds falhou — ${firstOddsError}`;
    else if (eventsWithoutBookmakers > 0) diag = `/events trouxe ${events.length} eventos, mas nenhum tinha bookmakers usáveis. Amostra: ${firstOddsPeek}`;
    else diag = `Nenhum eventId válido nos ${events.length} eventos retornados.`;
  }
  return { valueBets, eventCount: normalized.length, diag };
}
