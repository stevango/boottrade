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
    for (const key of ["data", "sports", "results", "items", "list", "bookmakers", "events"]) {
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

// Keys inside an odds object that are metadata, not outcome prices.
const ODDS_META_KEYS = new Set(["hdp", "handicap", "line", "label", "name", "updatedAt", "point", "spread", "total"]);

// odds-api.io structures /odds responses like:
//   bookmakers: {
//     Bet365: [
//       { name: "ML", odds: [{ home: "1.444", draw: "4.333", away: "7.500" }] },
//       { name: "Totals", odds: [{ hdp: 2.25, over: "1.900", under: "1.950" }] }
//     ],
//     Betano: [...]
//   }
// Each "odds" entry is a flat object whose KEYS are the outcome names
// (home/draw/away/over/under/yes/no/label) and VALUES are decimal prices.
// `hdp`/`label` are metadata. For Double Chance markets the `label` field
// names the specific outcome ("Mexico or Draw") and the price is under
// `under`/`over`.
function normalizeOneEvent(raw: unknown, fallback?: RawEventLite): NormalizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const ev = raw as Record<string, unknown>;
  const id = String(ev.id ?? ev.event_id ?? ev.eventId ?? fallback?.id ?? fallback?.event_id ?? fallback?.eventId ?? "");
  const home = String(ev.home_team ?? ev.home ?? ev.homeTeam ?? fallback?.home ?? fallback?.home_team ?? fallback?.homeTeam ?? "");
  const away = String(ev.away_team ?? ev.away ?? ev.awayTeam ?? fallback?.away ?? fallback?.away_team ?? fallback?.awayTeam ?? "");
  const commenceTime = String(ev.commence_time ?? ev.commenceTime ?? ev.start_time ?? ev.startTime ?? fallback?.commence_time ?? fallback?.commenceTime ?? fallback?.start_time ?? fallback?.startTime ?? "");
  if (!home || !away) return null;

  const bmsRaw = ev.bookmakers ?? ev.books ?? ev.odds;
  if (!bmsRaw || typeof bmsRaw !== "object") return null;
  const bmsEntries: [string, unknown][] = Array.isArray(bmsRaw)
    ? bmsRaw.map((bm, i) => {
        const o = (bm && typeof bm === "object" ? bm : {}) as Record<string, unknown>;
        const name = String(o.name ?? o.title ?? o.key ?? `bookie_${i}`);
        return [name, o.markets ?? o.lines ?? o.bets ?? bm];
      })
    : Object.entries(bmsRaw as Record<string, unknown>);

  const bookmakers = bmsEntries.map(([bookieName, marketsRaw]) => {
    const marketsList = Array.isArray(marketsRaw) ? marketsRaw : [];
    const markets = marketsList.map((mk) => {
      const m = (mk && typeof mk === "object" ? mk : {}) as Record<string, unknown>;
      const marketKey = String(m.name ?? m.key ?? m.market ?? m.type ?? "").trim();
      if (!marketKey) return { key: "", outcomes: [] as NormalizedEvent["bookmakers"][number]["markets"][number]["outcomes"] };
      const oddsList = Array.isArray(m.odds) ? m.odds : Array.isArray(m.outcomes) ? m.outcomes : Array.isArray(m.selections) ? m.selections : [];
      const outcomes: { name: string; price: number; point?: number }[] = [];
      for (const entry of oddsList) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const point = e.hdp != null ? Number(e.hdp) : e.handicap != null ? Number(e.handicap) : e.point != null ? Number(e.point) : undefined;
        const label = typeof e.label === "string" ? e.label : null;
        for (const [k, v] of Object.entries(e)) {
          if (ODDS_META_KEYS.has(k)) continue;
          const price = Number(v);
          if (!Number.isFinite(price) || price <= 1) continue;
          // For label-style markets (Double Chance), the outcome is the
          // label itself; the key ("under"/"over") is just where the price
          // lives. Use the label so different bookies' "Mexico or Draw"
          // entries bucket together.
          const name = label ? label : k;
          outcomes.push({ name, price, ...(Number.isFinite(point as number) ? { point } : {}) });
        }
      }
      return { key: marketKey, outcomes };
    }).filter((mk) => mk.key && mk.outcomes.length > 0);
    return { name: String(bookieName), markets };
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

// Cache leagues per sport so the dropdown loads instantly after the first
// open (and burns at most 1 quota call per sport per hour).
type CachedLeagues = { leagues: { slug: string; name: string }[]; fetchedAt: number };
const leaguesCache = new Map<string, CachedLeagues>();
const LEAGUES_TTL_MS = 60 * 60 * 1000;

export async function fetchLeagues(sport: string): Promise<{ slug: string; name: string }[]> {
  const cached = leaguesCache.get(sport);
  if (cached && Date.now() - cached.fetchedAt < LEAGUES_TTL_MS) return cached.leagues;
  const { status, json } = await callRaw("/leagues", { sport });
  const list = unwrapList<string | Record<string, unknown>>(json);
  const leagues = list.map((l) => {
    if (typeof l === "string") return { slug: l.trim(), name: l.trim() };
    if (l && typeof l === "object") {
      const o = l as Record<string, unknown>;
      const slug = String(o.slug ?? o.key ?? o.id ?? o.name ?? "").trim();
      const name = String(o.name ?? o.title ?? o.label ?? slug).trim();
      return { slug, name };
    }
    return { slug: "", name: "" };
  }).filter((l) => l.slug);
  if (leagues.length === 0) {
    throw new Error(`/leagues HTTP ${status} (sport=${sport}) → shape: ${JSON.stringify(json).slice(0, 220)}`);
  }
  leaguesCache.set(sport, { leagues, fetchedAt: Date.now() });
  return leagues;
}

export async function fetchEvents(sport: string, league?: string): Promise<RawEventLite[]> {
  const params: Record<string, string> = { sport };
  if (league) params.league = league;
  const { status, text, json } = await callRaw("/events", params);
  const list = unwrapList<RawEventLite & { date?: string; status?: string }>(json);
  const all = list.filter((e) => e && (e.id || e.event_id || e.eventId));
  // odds-api.io /events returns past + upcoming. Past matches have
  // bookmakers:{} so they'd waste calls. Keep only events whose date hasn't
  // passed (or has no date), and sort ascending so we hit the nearest first.
  const now = Date.now();
  const upcoming = all.filter((e) => {
    const d = e.date ?? e.commence_time ?? e.commenceTime ?? e.start_time ?? e.startTime;
    if (!d) return true;
    const t = Date.parse(d);
    return !Number.isFinite(t) || t >= now - 30 * 60 * 1000;
  }).sort((a, b) => {
    const ta = Date.parse(a.date ?? a.commence_time ?? a.commenceTime ?? a.start_time ?? a.startTime ?? "") || 0;
    const tb = Date.parse(b.date ?? b.commence_time ?? b.commenceTime ?? b.start_time ?? b.startTime ?? "") || 0;
    return ta - tb;
  });
  const events = upcoming.length > 0 ? upcoming : all;
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
  league?: string;
  bookmakers?: string;
  edgeThresholdPct?: number;
  maxEvents?: number;
}): Promise<{ valueBets: ValueBet[]; eventCount: number; diag?: string }> {
  // odds-api.io requires fetching odds per-event: 1 call to /events, then N
  // calls to /odds?eventId=…. Cap N so we don't burn the user's hourly quota.
  // Default conservatively: free plan has 100 req/h, each search burns
  // 1 (/events) + N (/odds). 5 events = 6 calls/click ≈ 16 searches/hour.
  const maxEvents = Math.max(1, Math.min(opts.maxEvents ?? 5, 20));
  const events = await fetchEvents(opts.sport, opts.league);
  // Try up to maxScan events but stop early after maxEvents have real odds —
  // this skips past-game stubs (bookmakers:{}) without burning the full
  // quota on every search.
  const maxScan = Math.min(events.length, maxEvents * 3);
  const slice = events.slice(0, maxScan);

  const bookmakers = opts.bookmakers || await fetchBookmakers();

  const normalized: NormalizedEvent[] = [];
  let firstOddsError: string | null = null;
  let firstOddsPeek: string | null = null;
  let eventsWithoutBookmakers = 0;
  for (const e of slice) {
    if (normalized.length >= maxEvents) break;
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
        if (!firstOddsPeek) firstOddsPeek = `eventId=${eventId} → keys=[${json && typeof json === "object" ? Object.keys(json).join(",") : "n/a"}] body=${JSON.stringify(json).slice(0, 1400)}`;
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
