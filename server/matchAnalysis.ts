// Match analysis — Inteligência estatística pra partidas entre seleções.
// Usa a API-Football (api-sports.io) que cobre H2H, forma recente, predições,
// estatísticas de time e jogadores. Plano free: 100 req/dia.
//
// Fase A (este arquivo): H2H + forma recente + predição pré-computada.
// Fases B e C (artilheiros, síntese LLM) virão em arquivos separados.

import { getAppSetting, getCachedTeam, setCachedTeam } from "./db";

const BASE = "https://v3.football.api-sports.io";

export class ApiFootballNotConfiguredError extends Error {
  constructor() { super("API-Football not configured"); this.name = "ApiFootballNotConfiguredError"; }
}

export async function getApiFootballKey(): Promise<string | null> {
  return process.env.API_FOOTBALL_KEY || (await getAppSetting("API_FOOTBALL_KEY"));
}

export async function isApiFootballConfigured(): Promise<boolean> {
  return (await getApiFootballKey()) !== null;
}

// Lightweight verification — /status returns the account quota usage.
export async function testApiFootballConnection(): Promise<{ ok: boolean; message: string }> {
  const key = await getApiFootballKey();
  if (!key) return { ok: false, message: "Nenhuma chave configurada." };
  try {
    const resp = await fetch(`${BASE}/status`, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return { ok: false, message: `${resp.status} ${resp.statusText}` };
    const data = await resp.json().catch(() => ({})) as { response?: { requests?: { current?: number; limit_day?: number } } };
    const r = data.response?.requests;
    return { ok: true, message: r ? `Conectado · ${r.current ?? 0}/${r.limit_day ?? "?"} req hoje` : "Conectado" };
  } catch (e) {
    return { ok: false, message: String(e).slice(0, 200) };
  }
}

// Returns the current daily usage so other code paths can include it in
// error messages when something might be quota-related.
async function getQuotaUsage(): Promise<{ current: number; limit: number } | null> {
  const key = await getApiFootballKey();
  if (!key) return null;
  try {
    const resp = await fetch(`${BASE}/status`, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => ({})) as { response?: { requests?: { current?: number; limit_day?: number } } };
    const r = data.response?.requests;
    if (!r) return null;
    return { current: r.current ?? 0, limit: r.limit_day ?? 100 };
  } catch {
    return null;
  }
}

async function call<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const key = await getApiFootballKey();
  if (!key) throw new ApiFootballNotConfiguredError();
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`;
  const resp = await fetch(url, {
    headers: { "x-apisports-key": key },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`API-Football ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json() as { response?: T; errors?: unknown; results?: number };
  // API-Football returns 200 OK with errors in the body when the request is
  // bad (invalid params, quota exceeded, plan-restricted endpoint). Surface
  // these so the caller doesn't get a silent empty array.
  if (data.errors && typeof data.errors === "object" && Object.keys(data.errors).length > 0) {
    const first = Object.values(data.errors)[0];
    throw new Error(`API-Football erro: ${String(first).slice(0, 200)}`);
  }
  return (data.response ?? ([] as unknown as T));
}

// =============================================================================
// Team resolution
// =============================================================================

type ApiTeam = { team: { id: number; name: string; country: string; code: string | null; national: boolean; logo: string } };

const teamCache = new Map<string, { id: number; name: string; logo: string; fetchedAt: number }>();
const TEAM_CACHE_TTL = 24 * 60 * 60 * 1000;

// Resolves a free-text team name to an api-football team id, preferring
// national teams since the value-bet feed is mostly World Cup matches.
// Tries multiple search strategies: search by query string, exact name,
// and search by country (national teams have country == name for most
// FIFA members). Returns null only if every strategy returns nothing.
export async function resolveTeam(name: string): Promise<{ id: number; name: string; logo: string } | null> {
  const cleaned = name.trim();
  if (!cleaned) return null;
  // Persistent DB cache first — national team names don't change, hits don't
  // consume any api-football quota at all.
  try {
    const db = await getCachedTeam(cleaned);
    if (db) return { id: db.teamId, name: db.teamName, logo: db.logo || "" };
  } catch { /* fall through to memory + API */ }
  const cacheKey = cleaned.toLowerCase();
  const cached = teamCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TEAM_CACHE_TTL) return { id: cached.id, name: cached.name, logo: cached.logo };

  // 1) free-text search — works for clubs and named national sides
  // 2) exact name match — sometimes the search index misses short names like
  //    "Iraq" or "Iran"
  // 3) country filter — national teams often have country == team name
  const strategies: { params: Record<string, string | number>; label: string }[] = [
    { params: { search: cleaned }, label: "search" },
    { params: { name: cleaned }, label: "name" },
    { params: { country: cleaned }, label: "country" },
  ];
  let results: ApiTeam[] = [];
  const errors: { strategy: string; error: string }[] = [];
  for (const s of strategies) {
    try {
      results = await call<ApiTeam[]>("/teams", s.params);
      if (Array.isArray(results) && results.length > 0) break;
    } catch (e) {
      errors.push({ strategy: s.label, error: e instanceof Error ? e.message : String(e) });
    }
  }
  if (!Array.isArray(results) || results.length === 0) {
    // All strategies failed/returned empty. Probe quota so the caller can
    // tell the user whether it's "team really unknown" vs "out of credits".
    const quota = await getQuotaUsage();
    const quotaMsg = quota ? ` (quota: ${quota.current}/${quota.limit} req hoje)` : "";
    const errSummary = errors.length > 0 ? ` Estratégias falharam: ${errors.map((e) => `${e.strategy}=${e.error.slice(0, 80)}`).join("; ")}` : " Estratégias retornaram vazio.";
    throw new Error(`Não consegui resolver "${cleaned}"${quotaMsg}.${errSummary}`);
  }
  // Prefer national teams when multiple matches, then exact-name match.
  const exactNational = results.find((r) => r.team.national && r.team.name.toLowerCase() === cleaned.toLowerCase());
  const anyNational = results.find((r) => r.team.national);
  const exactName = results.find((r) => r.team.name.toLowerCase() === cleaned.toLowerCase());
  const t = (exactNational ?? anyNational ?? exactName ?? results[0]).team;
  const value = { id: t.id, name: t.name, logo: t.logo };
  teamCache.set(cacheKey, { ...value, fetchedAt: Date.now() });
  // Persist permanently — quota saved on every future analysis of this team.
  try { await setCachedTeam(cleaned, t.id, t.name, t.logo || null); } catch { /* non-fatal */ }
  return value;
}

// =============================================================================
// Head-to-Head
// =============================================================================

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; country: string; season: number };
  teams: { home: { id: number; name: string; winner: boolean | null }; away: { id: number; name: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
  score?: { fulltime?: { home: number | null; away: number | null } };
};

export type H2HAnalysis = {
  totalGames: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  goalsFor1: number;
  goalsFor2: number;
  avgGoals: number;
  recent: { date: string; home: string; away: string; score: string; competition: string }[];
  mostCommonResult: string;
};

export async function fetchH2H(team1Id: number, team2Id: number): Promise<H2HAnalysis> {
  // Free plan rejects ?last=N. Without it the API returns the H2H history
  // sorted by date desc; we cap to 20 client-side.
  const all = await call<ApiFixture[]>("/fixtures/headtohead", { h2h: `${team1Id}-${team2Id}` });
  const fixtures = (Array.isArray(all) ? all : []).slice(0, 20);
  let team1Wins = 0, team2Wins = 0, draws = 0, goalsFor1 = 0, goalsFor2 = 0;
  const recent: H2HAnalysis["recent"] = [];
  const resultCounts = new Map<string, number>();

  for (const f of fixtures) {
    const homeScore = f.goals.home ?? 0;
    const awayScore = f.goals.away ?? 0;
    const isTeam1Home = f.teams.home.id === team1Id;
    const t1Score = isTeam1Home ? homeScore : awayScore;
    const t2Score = isTeam1Home ? awayScore : homeScore;
    goalsFor1 += t1Score;
    goalsFor2 += t2Score;
    if (t1Score > t2Score) team1Wins++;
    else if (t2Score > t1Score) team2Wins++;
    else draws++;
    const r = `${t1Score}-${t2Score}`;
    resultCounts.set(r, (resultCounts.get(r) ?? 0) + 1);
    if (recent.length < 5) {
      recent.push({
        date: f.fixture.date,
        home: f.teams.home.name,
        away: f.teams.away.name,
        score: `${homeScore}-${awayScore}`,
        competition: f.league.name,
      });
    }
  }

  const totalGames = fixtures.length;
  const avgGoals = totalGames > 0 ? (goalsFor1 + goalsFor2) / totalGames : 0;
  let mostCommonResult = "—";
  let maxCount = 0;
  for (const [r, c] of Array.from(resultCounts.entries())) {
    if (c > maxCount) { mostCommonResult = r; maxCount = c; }
  }
  return { totalGames, team1Wins, team2Wins, draws, goalsFor1, goalsFor2, avgGoals, recent, mostCommonResult };
}

// =============================================================================
// Recent form per team across multiple time windows
// =============================================================================

export type FormWindow = {
  months: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  avgGF: number;
  avgGA: number;
  winRatePct: number;
  pointsRate: number; // (3W + D) / (3 * G) * 100, full = 100
};

export type FormAnalysis = {
  teamId: number;
  teamName: string;
  windows: FormWindow[];
  lastResults: { date: string; opponent: string; venue: "home" | "away" | "neutral"; goalsFor: number; goalsAgainst: number; result: "W" | "D" | "L" }[];
};

// API-Football's /fixtures supports ?team=X but the free plan rejects ?last=N.
// We instead pull by season — current year + previous — and bucket the
// fixtures locally into the requested time windows. National teams sometimes
// have sparse calendars so two seasons usually give enough sample to fill
// at least the 12 and 24 month windows.
export async function fetchRecentForm(teamId: number, teamName: string, windowsMonths = [12, 24, 36, 48, 60]): Promise<FormAnalysis> {
  const currentYear = new Date().getUTCFullYear();
  const seasons = [currentYear, currentYear - 1];
  const fetched: ApiFixture[] = [];
  for (const season of seasons) {
    try {
      const part = await call<ApiFixture[]>("/fixtures", { team: teamId, season });
      if (Array.isArray(part)) fetched.push(...part);
    } catch (e) {
      // One season failing (e.g. no fixtures yet) shouldn't kill the whole form analysis.
      console.warn(`[matchAnalysis] /fixtures season=${season} team=${teamId} failed:`, e instanceof Error ? e.message : e);
    }
  }
  // Dedupe by fixture.id since the same match can appear if it sits on the
  // calendar boundary between seasons.
  const seen = new Set<number>();
  const unique = fetched.filter((f) => {
    if (seen.has(f.fixture.id)) return false;
    seen.add(f.fixture.id);
    return true;
  });
  const finished = unique.filter((f) => ["FT", "AET", "PEN"].includes(f.fixture.status.short))
    .sort((a, b) => Date.parse(b.fixture.date) - Date.parse(a.fixture.date));
  const now = Date.now();

  const lastResults = finished.slice(0, 10).map((f) => {
    const isHome = f.teams.home.id === teamId;
    const gf = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
    const ga = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
    const opponent = isHome ? f.teams.away.name : f.teams.home.name;
    const result: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D";
    return { date: f.fixture.date, opponent, venue: isHome ? "home" as const : "away" as const, goalsFor: gf, goalsAgainst: ga, result };
  });

  const windows: FormWindow[] = windowsMonths.map((months) => {
    const cutoff = now - months * 30 * 24 * 60 * 60 * 1000;
    const inWindow = unique.filter((f) => ["FT", "AET", "PEN"].includes(f.fixture.status.short) && Date.parse(f.fixture.date) >= cutoff);
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (const f of inWindow) {
      const isHome = f.teams.home.id === teamId;
      const gf = isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0);
      const ga = isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0);
      goalsFor += gf; goalsAgainst += ga;
      if (gf > ga) wins++; else if (ga > gf) losses++; else draws++;
    }
    const games = inWindow.length;
    const winRatePct = games > 0 ? (wins / games) * 100 : 0;
    const pointsRate = games > 0 ? ((3 * wins + draws) / (3 * games)) * 100 : 0;
    return {
      months, games, wins, draws, losses, goalsFor, goalsAgainst,
      avgGF: games > 0 ? goalsFor / games : 0,
      avgGA: games > 0 ? goalsAgainst / games : 0,
      winRatePct, pointsRate,
    };
  });

  return { teamId, teamName, windows, lastResults };
}

// =============================================================================
// Squad / key players — Fase B
// =============================================================================

type ApiSquad = { team: { id: number; name: string }; players: { id: number; name: string; age: number | null; number: number | null; position: string | null; photo: string | null }[] };

export type SquadPlayer = { id: number; name: string; age: number | null; number: number | null; position: string };
export type SquadAnalysis = {
  teamId: number;
  attackers: SquadPlayer[];
  midfielders: SquadPlayer[];
  defenders: SquadPlayer[];
  goalkeepers: SquadPlayer[];
  total: number;
};

// In-memory cache keyed by teamId for 24h — squads change rarely.
const squadCache = new Map<number, { value: SquadAnalysis; fetchedAt: number }>();
const SQUAD_TTL = 24 * 60 * 60 * 1000;

export async function fetchSquad(teamId: number): Promise<SquadAnalysis> {
  const cached = squadCache.get(teamId);
  if (cached && Date.now() - cached.fetchedAt < SQUAD_TTL) return cached.value;
  const data = await call<ApiSquad[]>("/players/squads", { team: teamId });
  const players = Array.isArray(data) && data[0]?.players ? data[0].players : [];
  const bucket = (key: string): SquadPlayer[] =>
    players
      .filter((p) => (p.position || "").toLowerCase().startsWith(key))
      .map((p) => ({ id: p.id, name: p.name, age: p.age, number: p.number, position: p.position || "" }))
      .sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  const result: SquadAnalysis = {
    teamId,
    attackers: bucket("a"),    // "Attacker"
    midfielders: bucket("m"),  // "Midfielder"
    defenders: bucket("d"),    // "Defender"
    goalkeepers: bucket("g"),  // "Goalkeeper"
    total: players.length,
  };
  squadCache.set(teamId, { value: result, fetchedAt: Date.now() });
  return result;
}

// =============================================================================
// Combined match analysis
// =============================================================================

export type MatchAnalysis = {
  generatedAt: string;
  team1: { id: number; name: string; logo: string };
  team2: { id: number; name: string; logo: string };
  h2h: H2HAnalysis;
  form1: FormAnalysis;
  form2: FormAnalysis;
  squad1: SquadAnalysis | null;
  squad2: SquadAnalysis | null;
  // Goal probability estimates derived from form windows (Poisson-ish heuristic).
  goalProbabilities: {
    team1ScoresPct: number;
    team2ScoresPct: number;
    bothScorePct: number;
    over05Pct: number;
    over15Pct: number;
    over25Pct: number;
    over35Pct: number;
    expectedTotal: number;
    expectedTeam1: number;
    expectedTeam2: number;
  };
  // Heuristic prediction summary.
  prediction: {
    favorite: "team1" | "team2" | "draw";
    team1WinPct: number;
    drawPct: number;
    team2WinPct: number;
    probableScore: string;
    confidence: "low" | "medium" | "high";
    reasoning: string[];
  };
};

// Poisson PMF: P(X=k) = (λ^k * e^-λ) / k!
function poisson(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p = p * lambda / i;
  return p;
}
// P(X >= k) for Poisson, capped to a reasonable upper bound.
function poissonOver(lambda: number, threshold: number): number {
  // threshold = 0.5 → P(X >= 1) = 1 - P(X=0). threshold = 1.5 → P(X >= 2) etc.
  const minK = Math.ceil(threshold);
  let p = 0;
  for (let k = 0; k < minK; k++) p += poisson(lambda, k);
  return Math.max(0, Math.min(1, 1 - p));
}

function computeGoalProbabilities(form1: FormAnalysis, form2: FormAnalysis): MatchAnalysis["goalProbabilities"] {
  // Use 24-month window when available, fall back to 12-month or 60-month.
  const pick = (f: FormAnalysis) => f.windows.find((w) => w.months === 24 && w.games >= 5)
    ?? f.windows.find((w) => w.months === 12 && w.games >= 5)
    ?? f.windows.find((w) => w.games >= 5)
    ?? f.windows[0];
  const w1 = pick(form1), w2 = pick(form2);
  // Expected goals for each team = avgGF blended with opponent's avgGA.
  const lambda1 = ((w1.avgGF + w2.avgGA) / 2) || 1.2;
  const lambda2 = ((w2.avgGF + w1.avgGA) / 2) || 1.0;
  const team1ScoresPct = poissonOver(lambda1, 0.5) * 100;
  const team2ScoresPct = poissonOver(lambda2, 0.5) * 100;
  const bothScorePct = (team1ScoresPct / 100) * (team2ScoresPct / 100) * 100;
  const total = lambda1 + lambda2;
  return {
    team1ScoresPct,
    team2ScoresPct,
    bothScorePct,
    over05Pct: poissonOver(total, 0.5) * 100,
    over15Pct: poissonOver(total, 1.5) * 100,
    over25Pct: poissonOver(total, 2.5) * 100,
    over35Pct: poissonOver(total, 3.5) * 100,
    expectedTotal: total,
    expectedTeam1: lambda1,
    expectedTeam2: lambda2,
  };
}

function computePrediction(form1: FormAnalysis, form2: FormAnalysis, h2h: H2HAnalysis, gp: MatchAnalysis["goalProbabilities"]): MatchAnalysis["prediction"] {
  const pick = (f: FormAnalysis) => f.windows.find((w) => w.months === 24 && w.games >= 5)
    ?? f.windows.find((w) => w.months === 12 && w.games >= 5)
    ?? f.windows[0];
  const w1 = pick(form1), w2 = pick(form2);

  // Simple strength score blending points rate (60%) with H2H record (40%).
  const formStrength1 = w1.pointsRate;
  const formStrength2 = w2.pointsRate;
  let h2hAdjust = 0;
  if (h2h.totalGames >= 4) {
    const h2hAvg1 = (h2h.team1Wins * 3 + h2h.draws) / (h2h.totalGames * 3) * 100;
    const h2hAvg2 = (h2h.team2Wins * 3 + h2h.draws) / (h2h.totalGames * 3) * 100;
    h2hAdjust = (h2hAvg1 - h2hAvg2) * 0.4;
  }
  const score1 = formStrength1 * 0.6 + h2hAdjust;
  const score2 = formStrength2 * 0.6 - h2hAdjust;

  // Map score gap to win probabilities using a softmax-style spread, with
  // a baseline draw probability of ~22% (typical international football).
  const diff = score1 - score2;
  const team1WinPct = Math.max(8, Math.min(78, 39 + diff * 0.55));
  const team2WinPct = Math.max(8, Math.min(78, 39 - diff * 0.55));
  const drawPct = Math.max(8, 100 - team1WinPct - team2WinPct);

  // Normalize so the three sum to 100.
  const sum = team1WinPct + team2WinPct + drawPct;
  const w1n = (team1WinPct / sum) * 100;
  const w2n = (team2WinPct / sum) * 100;
  const dn = (drawPct / sum) * 100;

  const favorite: "team1" | "team2" | "draw" = w1n > w2n + 5 ? "team1" : w2n > w1n + 5 ? "team2" : "draw";
  // Most likely score: round expected goals to integers.
  const probableScore = `${Math.round(gp.expectedTeam1)}-${Math.round(gp.expectedTeam2)}`;

  const minGames = Math.min(w1.games, w2.games);
  const confidence: "low" | "medium" | "high" =
    minGames < 6 || h2h.totalGames < 3 ? "low"
    : minGames < 12 ? "medium"
    : "high";

  const reasoning: string[] = [];
  reasoning.push(`${form1.teamName}: aproveitamento ${w1.pointsRate.toFixed(0)}% em ${w1.games} jogos (últimos ${w1.months}m).`);
  reasoning.push(`${form2.teamName}: aproveitamento ${w2.pointsRate.toFixed(0)}% em ${w2.games} jogos (últimos ${w2.months}m).`);
  if (h2h.totalGames > 0) {
    reasoning.push(`Histórico direto: ${h2h.team1Wins} vitórias de ${form1.teamName}, ${h2h.team2Wins} de ${form2.teamName}, ${h2h.draws} empates em ${h2h.totalGames} jogos.`);
  }
  reasoning.push(`Total esperado de gols: ${gp.expectedTotal.toFixed(2)} (over 2.5 ≈ ${gp.over25Pct.toFixed(0)}%).`);

  return {
    favorite,
    team1WinPct: Math.round(w1n * 10) / 10,
    drawPct: Math.round(dn * 10) / 10,
    team2WinPct: Math.round(w2n * 10) / 10,
    probableScore,
    confidence,
    reasoning,
  };
}

// In-memory cache so repeated opens of the same match don't burn quota.
const analysisCache = new Map<string, { value: MatchAnalysis; fetchedAt: number }>();
const ANALYSIS_TTL = 6 * 60 * 60 * 1000;

export async function analyzeMatch(homeName: string, awayName: string): Promise<MatchAnalysis> {
  const key = `${homeName.toLowerCase().trim()}__${awayName.toLowerCase().trim()}`;
  const cached = analysisCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ANALYSIS_TTL) return cached.value;

  const [team1, team2] = await Promise.all([
    resolveTeam(homeName).catch((e) => { throw new Error(`${homeName}: ${e instanceof Error ? e.message : e}`); }),
    resolveTeam(awayName).catch((e) => { throw new Error(`${awayName}: ${e instanceof Error ? e.message : e}`); }),
  ]);
  if (!team1) throw new Error(`API-Football não encontrou "${homeName}".`);
  if (!team2) throw new Error(`API-Football não encontrou "${awayName}".`);

  const [h2h, form1, form2, squad1, squad2] = await Promise.all([
    fetchH2H(team1.id, team2.id),
    fetchRecentForm(team1.id, team1.name),
    fetchRecentForm(team2.id, team2.name),
    fetchSquad(team1.id).catch(() => null),
    fetchSquad(team2.id).catch(() => null),
  ]);

  const goalProbabilities = computeGoalProbabilities(form1, form2);
  const prediction = computePrediction(form1, form2, h2h, goalProbabilities);

  const result: MatchAnalysis = {
    generatedAt: new Date().toISOString(),
    team1, team2, h2h, form1, form2, squad1, squad2, goalProbabilities, prediction,
  };
  analysisCache.set(key, { value: result, fetchedAt: Date.now() });
  return result;
}

// =============================================================================
// AI advisor — builds a structured prompt from the analysis + signal context
// and calls the configured LLM. Output is short, honest, and Portuguese.
// =============================================================================

// =============================================================================
// Bet intelligence — deterministic decision before calling the LLM
// =============================================================================

export type BetIntelligence = {
  decision: "SIM" | "NÃO" | "CAUTELOSO";
  reason: string;                    // Curta explicação determinística da decisão
  ourProbabilityPct: number | null;  // Nossa estimativa da probabilidade da aposta
  marketImpliedPct: number | null;   // Prob implícita do preço (1/odd)
  ourEdgePct: number | null;         // Edge real segundo nosso modelo (não do mercado)
  reportedEdgePct: number | null;    // Edge do feed (best vs avg)
  kellyPct: number | null;           // 1/4 Kelly capped at 3%
  recommendedStakePct: number;       // Stake final (sempre definido)
  recommendedStakeBrl: number;       // Stake em R$ usando o bankroll
  expectedReturnBrl: number;         // Lucro esperado se ganhar
  sampleQuality: "alta" | "média" | "baixa";
  bullets: string[];                 // Razões usadas pela decisão
};

const MAX_STAKE_PCT = 3;       // Nunca mais que 3% num único sinal
const FLAT_LOW_CONFIDENCE = 0.5;
const FLAT_MEDIUM = 1;

// Map the bet's outcome string to our model's probability for that outcome.
// Returns a number 0..100, or null if we can't map (e.g. exotic market we
// don't model). Mainline markets supported: ML/h2h (home/draw/away or team
// name), Totals/Goals Over-Under (over/under + point), BTTS (yes/no),
// Double Chance (label-based).
function resolveOurProbability(input: AdviseInput, a: MatchAnalysis): number | null {
  const m = input.market.trim().toLowerCase();
  const o = input.outcome.trim().toLowerCase();
  const home = a.team1.name.toLowerCase();
  const away = a.team2.name.toLowerCase();

  // h2h / ML
  if (m === "h2h" || m === "ml" || m === "moneyline" || m === "1x2" || m === "match winner") {
    if (o === "draw" || o === "tie" || o === "empate") return a.prediction.drawPct;
    if (o === "home" || o === home) return a.prediction.team1WinPct;
    if (o === "away" || o === away) return a.prediction.team2WinPct;
    return null;
  }

  // Totals / Goals Over-Under
  if (m === "totals" || m === "goals over/under" || m === "over/under") {
    const gp = a.goalProbabilities;
    const point = input.bestPrice != null ? null : null; // we don't have point passed in here
    // Without point, we can only guess at the threshold from the outcome string
    const pt = /([\d.]+)/.exec(o)?.[1];
    const threshold = pt ? parseFloat(pt) : 2.5;
    const overPct =
      threshold < 1 ? gp.over05Pct :
      threshold < 2 ? gp.over15Pct :
      threshold < 3 ? gp.over25Pct :
      gp.over35Pct;
    if (o.includes("over")) return overPct;
    if (o.includes("under")) return 100 - overPct;
    return null;
  }

  // Both Teams To Score
  if (m === "btts" || m === "both teams to score") {
    if (o === "yes" || o === "sim") return a.goalProbabilities.bothScorePct;
    if (o === "no" || o === "não") return 100 - a.goalProbabilities.bothScorePct;
    return null;
  }

  // Double Chance — outcome looks like "Home or Draw"
  if (m === "double chance" || m.includes("dupla")) {
    const t1 = a.prediction.team1WinPct;
    const t2 = a.prediction.team2WinPct;
    const dr = a.prediction.drawPct;
    if ((o.includes("home") || o.includes(home)) && o.includes("draw")) return t1 + dr;
    if ((o.includes("away") || o.includes(away)) && o.includes("draw")) return t2 + dr;
    if (o.includes("home") && o.includes("away")) return t1 + t2;
    return null;
  }

  return null;
}

function sampleQuality(a: MatchAnalysis): "alta" | "média" | "baixa" {
  const w = (f: FormAnalysis) => f.windows.find((x) => x.games >= 5) ?? f.windows[0];
  const min = Math.min(w(a.form1).games, w(a.form2).games);
  if (min < 5 || a.h2h.totalGames < 2) return "baixa";
  if (min < 12) return "média";
  return "alta";
}

export function computeBetIntelligence(input: AdviseInput, a: MatchAnalysis, bankrollBrl: number): BetIntelligence {
  const reportedEdgePct = input.edgePct ?? null;
  const odds = input.bestPrice ?? null;
  const marketImpliedPct = odds && odds > 1 ? (100 / odds) : null;
  const ourProbabilityPct = resolveOurProbability(input, a);
  // Real edge from OUR model's view: (p * odds - 1) * 100
  const ourEdgePct = (ourProbabilityPct != null && odds && odds > 1)
    ? (ourProbabilityPct / 100 * odds - 1) * 100
    : null;
  const sq = sampleQuality(a);
  const bullets: string[] = [];

  // Kelly fraction (1/4 Kelly), only when we have our probability and odds.
  let kellyPct: number | null = null;
  if (ourProbabilityPct != null && odds && odds > 1) {
    const p = ourProbabilityPct / 100;
    const b = odds - 1;
    const fullKelly = (p * b - (1 - p)) / b;
    kellyPct = Math.max(0, fullKelly * 100 / 4); // quarter Kelly
  }

  // Deterministic decision rules.
  let decision: BetIntelligence["decision"] = "CAUTELOSO";
  let reason = "";
  let stakePct = 0;

  if (reportedEdgePct != null && reportedEdgePct >= 25) {
    decision = "NÃO";
    reason = `Edge de ${reportedEdgePct.toFixed(1)}% no feed é alto demais pra ser real — quase sempre é erro de odd, definição diferente de mercado entre casas, ou liquidez baixa naquela casa.`;
    bullets.push(reason);
    stakePct = 0;
  } else if (ourProbabilityPct != null && ourEdgePct != null && ourEdgePct < 0) {
    decision = "NÃO";
    reason = `Nosso modelo estima ${ourProbabilityPct.toFixed(1)}% de chance pra esse desfecho. No preço ${odds!.toFixed(2)}, isso seria uma aposta de valor NEGATIVO (${ourEdgePct.toFixed(1)}%) — o mercado está mais correto que o feed sugere.`;
    bullets.push(reason);
    stakePct = 0;
  } else if (sq === "baixa" && (reportedEdgePct ?? 0) < 10) {
    decision = "CAUTELOSO";
    reason = `Amostra histórica é insuficiente (H2H ${a.h2h.totalGames} jogos; forma com poucos jogos). Sem confiança suficiente pra estaca normal.`;
    bullets.push(reason);
    stakePct = FLAT_LOW_CONFIDENCE; // 0.5% flat
  } else if (ourProbabilityPct != null && ourEdgePct != null && ourEdgePct >= 2 && kellyPct != null && kellyPct > 0) {
    // Real value bet according to our model.
    decision = "SIM";
    const cappedKelly = Math.min(kellyPct, MAX_STAKE_PCT);
    stakePct = sq === "alta" ? cappedKelly : Math.min(cappedKelly, FLAT_MEDIUM);
    reason = `Modelo confirma valor: nossa estimativa ${ourProbabilityPct.toFixed(1)}% vs implícita ${marketImpliedPct!.toFixed(1)}% (edge real ${ourEdgePct.toFixed(1)}%). Quarter-Kelly recomenda ${kellyPct.toFixed(2)}%; capamos em ${stakePct.toFixed(2)}%.`;
    bullets.push(`Edge real do modelo: ${ourEdgePct.toFixed(1)}%`);
    bullets.push(`Kelly fracionário 1/4: ${kellyPct.toFixed(2)}%`);
    bullets.push(`Cap por aposta: ${MAX_STAKE_PCT}%`);
  } else if (ourProbabilityPct == null) {
    // Market we don't model — fall back to the feed's edge with conservative stake.
    if ((reportedEdgePct ?? 0) >= 3 && (reportedEdgePct ?? 0) < 15) {
      decision = "CAUTELOSO";
      stakePct = sq === "alta" ? FLAT_MEDIUM : FLAT_LOW_CONFIDENCE;
      reason = `Não conseguimos modelar esse mercado (${input.market}) — usamos só o edge do feed (${reportedEdgePct?.toFixed(1)}%). Stake flat conservador.`;
      bullets.push(reason);
    } else {
      decision = "NÃO";
      reason = `Mercado não modelado e edge fora da faixa segura — sem fundamento estatístico pra apostar.`;
      bullets.push(reason);
    }
  } else {
    decision = "CAUTELOSO";
    stakePct = FLAT_LOW_CONFIDENCE;
    reason = `Edge marginal ou positivo mas pequeno. Stake flat 0.5%.`;
    bullets.push(reason);
  }

  const recommendedStakePct = stakePct;
  const recommendedStakeBrl = Math.round((bankrollBrl * stakePct / 100) * 100) / 100;
  const expectedReturnBrl = (odds && odds > 1) ? Math.round((recommendedStakeBrl * (odds - 1)) * 100) / 100 : 0;

  return {
    decision, reason,
    ourProbabilityPct, marketImpliedPct, ourEdgePct, reportedEdgePct,
    kellyPct,
    recommendedStakePct, recommendedStakeBrl, expectedReturnBrl,
    sampleQuality: sq, bullets,
  };
}

export type AdviseInput = {
  home: string;
  away: string;
  market: string;
  outcome: string;
  bestBook?: string;
  bestPrice?: number;
  avgPrice?: number;
  edgePct?: number;
  commence?: string;
};

export function buildAdvisorPrompt(input: AdviseInput, a: MatchAnalysis, bankrollBrl = 5000, bi?: BetIntelligence): string {
  const w1 = a.form1.windows.find((w) => w.games >= 5) ?? a.form1.windows[0];
  const w2 = a.form2.windows.find((w) => w.games >= 5) ?? a.form2.windows[0];
  const gp = a.goalProbabilities;
  const p = a.prediction;
  const odds = input.bestPrice
    ? `Melhor odd: ${input.bestPrice.toFixed(2)} @ ${input.bestBook ?? "?"} (média do mercado ${input.avgPrice?.toFixed(2) ?? "?"}; edge ${input.edgePct?.toFixed(1) ?? "?"}%).`
    : "Sem dados de odds neste sinal.";
  const dateLine = input.commence ? `Data: ${new Date(input.commence).toLocaleString("pt-BR")}.` : "";

  const h2hLine = a.h2h.totalGames > 0
    ? `H2H: ${a.h2h.totalGames} jogos, ${a.h2h.team1Wins} vit. ${a.team1.name} / ${a.h2h.draws} empates / ${a.h2h.team2Wins} vit. ${a.team2.name}. Média ${a.h2h.avgGoals.toFixed(2)} gols/jogo. Placar mais comum: ${a.h2h.mostCommonResult}.`
    : "H2H: sem confrontos registrados na base.";

  const formLine = (name: string, w: typeof w1) =>
    w.games >= 5
      ? `${name} (últimos ${w.months}m): ${w.games}j, aproveitamento ${w.pointsRate.toFixed(0)}%, ${w.avgGF.toFixed(2)} gols feitos/j, ${w.avgGA.toFixed(2)} sofridos/j.`
      : `${name}: amostra insuficiente nos últimos meses (${w.games} jogos).`;

  return [
    `Partida: ${a.team1.name} × ${a.team2.name}.`,
    dateLine,
    "",
    `Sinal do robô:`,
    `- Mercado: ${input.market}`,
    `- Resultado apostado: ${input.outcome}`,
    `- ${odds}`,
    "",
    `Estatística:`,
    `- ${h2hLine}`,
    `- ${formLine(a.team1.name, w1)}`,
    `- ${formLine(a.team2.name, w2)}`,
    a.squad1 && a.squad1.attackers.length > 0 ? `- Atacantes ${a.team1.name}: ${a.squad1.attackers.slice(0, 4).map((p) => p.name).join(", ")}.` : "",
    a.squad2 && a.squad2.attackers.length > 0 ? `- Atacantes ${a.team2.name}: ${a.squad2.attackers.slice(0, 4).map((p) => p.name).join(", ")}.` : "",
    `- Predição interna: ${a.team1.name} ${p.team1WinPct}% / Empate ${p.drawPct}% / ${a.team2.name} ${p.team2WinPct}%. Placar provável ${p.probableScore}. Confiança ${p.confidence}.`,
    `- Probabilidade de gols: ambas marcam ${gp.bothScorePct.toFixed(0)}%, over 2.5 ${gp.over25Pct.toFixed(0)}%, total esperado ${gp.expectedTotal.toFixed(2)} gols.`,
    "",
    `Bankroll do usuário: R$ ${bankrollBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
    "",
    bi ? "DECISÃO JÁ CALCULADA PELO MODELO DETERMINÍSTICO (use esses números, não invente outros):" : "",
    bi ? `- Decisão: ${bi.decision}` : "",
    bi ? `- Stake recomendado: ${bi.recommendedStakePct.toFixed(2)}% (R$ ${bi.recommendedStakeBrl.toFixed(2)})` : "",
    bi && bi.ourProbabilityPct != null ? `- Nossa estimativa de probabilidade: ${bi.ourProbabilityPct.toFixed(1)}%` : "",
    bi && bi.marketImpliedPct != null ? `- Probabilidade implícita do preço: ${bi.marketImpliedPct.toFixed(1)}%` : "",
    bi && bi.ourEdgePct != null ? `- Edge real (modelo vs preço): ${bi.ourEdgePct.toFixed(1)}%` : "",
    bi && bi.reportedEdgePct != null ? `- Edge reportado pelo feed: ${bi.reportedEdgePct.toFixed(1)}%` : "",
    bi && bi.kellyPct != null ? `- Quarter-Kelly puro: ${bi.kellyPct.toFixed(2)}% (capamos em 3% por aposta)` : "",
    bi ? `- Qualidade da amostra estatística: ${bi.sampleQuality}` : "",
    bi ? `- Razão determinística: ${bi.reason}` : "",
    "",
    "Responda EXATAMENTE neste formato, sem markdown, sem asteriscos, sem títulos extras, uma linha por campo. Os 6 campos são obrigatórios e devem começar exatamente com a palavra-chave em maiúsculas seguida de dois-pontos:",
    "",
    bi ? `DECISÃO: ${bi.decision}` : "DECISÃO: SIM, NÃO ou CAUTELOSO (uma palavra só)",
    bi ? `TAMANHO: ${bi.recommendedStakePct.toFixed(2)}% (R$ ${bi.recommendedStakeBrl.toFixed(2)})` : "TAMANHO: percentual + valor em reais",
    bi && bi.decision === "SIM"
      ? `APOSTA: ${input.outcome} ${input.bestBook ? `na ${input.bestBook}` : ""} ${input.bestPrice ? `@ ${input.bestPrice.toFixed(2)}` : ""}${bi.expectedReturnBrl > 0 ? `, lucro esperado se ganhar: R$ ${bi.expectedReturnBrl.toFixed(2)}` : ""}`
      : "APOSTA: descrição da aposta (se SIM) ou traço (-) se NÃO/CAUTELOSO",
    "MERCADO_ALTERNATIVO: mercado mais seguro com base na estatística (use as probabilidades de gols mostradas — Over/Under, BTTS, Dupla Chance) ou traço (-) se nenhum oferecer valor melhor",
    "RISCO: risco principal em uma frase clara e específica",
    "RESUMO: justificativa final em uma ou duas frases — explique a decisão acima usando os números do modelo. Se for NÃO, explique o porquê (edge inflado, modelo discorda, amostra fraca, etc).",
    "",
    "REGRAS RÍGIDAS (não desobedeça):",
    "- Use EXATAMENTE a decisão e o tamanho que o modelo calculou acima. Sua função é explicar, não recalcular.",
    "- Se a decisão é NÃO, APOSTA deve ser traço (-).",
    "- Se a decisão é NÃO ou CAUTELOSO por edge alto demais (≥25%), explique no RESUMO que esse padrão geralmente indica erro de odd ou definição diferente de mercado entre casas, não oportunidade real.",
    "- Sugira MERCADO_ALTERNATIVO somente quando os dados de gols apontarem valor concreto (ex: 'Over 2.5 com 65% de prob histórica e mercado pagando 1.80').",
    "- Não use markdown. Não use asteriscos. Não invente números.",
  ].filter(Boolean).join("\n");
}
