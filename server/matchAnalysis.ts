// Match analysis — Inteligência estatística pra partidas entre seleções.
// Usa a API-Football (api-sports.io) que cobre H2H, forma recente, predições,
// estatísticas de time e jogadores. Plano free: 100 req/dia.
//
// Fase A (este arquivo): H2H + forma recente + predição pré-computada.
// Fases B e C (artilheiros, síntese LLM) virão em arquivos separados.

import { getAppSetting } from "./db";

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
  const data = await resp.json() as { response?: T; errors?: unknown };
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
export async function resolveTeam(name: string): Promise<{ id: number; name: string; logo: string } | null> {
  const cleaned = name.trim();
  if (!cleaned) return null;
  const cacheKey = cleaned.toLowerCase();
  const cached = teamCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < TEAM_CACHE_TTL) return { id: cached.id, name: cached.name, logo: cached.logo };

  const results = await call<ApiTeam[]>("/teams", { search: cleaned });
  if (!Array.isArray(results) || results.length === 0) return null;
  // Prefer national teams when multiple matches.
  const nat = results.find((r) => r.team.national);
  const t = (nat ?? results[0]).team;
  const value = { id: t.id, name: t.name, logo: t.logo };
  teamCache.set(cacheKey, { ...value, fetchedAt: Date.now() });
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
  const fixtures = await call<ApiFixture[]>("/fixtures/headtohead", { h2h: `${team1Id}-${team2Id}`, last: 20 });
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

// API-Football's /fixtures supports ?team=X&last=N for the most recent N
// matches of any status. We pull last 40 and bucket them locally into the
// requested time windows; that minimizes quota usage to 1 request per team.
export async function fetchRecentForm(teamId: number, teamName: string, windowsMonths = [12, 24, 36, 48, 60]): Promise<FormAnalysis> {
  const fixtures = await call<ApiFixture[]>("/fixtures", { team: teamId, last: 60 });
  const finished = fixtures.filter((f) => ["FT", "AET", "PEN"].includes(f.fixture.status.short));
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
    const inWindow = finished.filter((f) => Date.parse(f.fixture.date) >= cutoff);
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
// Combined match analysis
// =============================================================================

export type MatchAnalysis = {
  generatedAt: string;
  team1: { id: number; name: string; logo: string };
  team2: { id: number; name: string; logo: string };
  h2h: H2HAnalysis;
  form1: FormAnalysis;
  form2: FormAnalysis;
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

  const [team1, team2] = await Promise.all([resolveTeam(homeName), resolveTeam(awayName)]);
  if (!team1) throw new Error(`Time não encontrado: ${homeName}`);
  if (!team2) throw new Error(`Time não encontrado: ${awayName}`);

  const [h2h, form1, form2] = await Promise.all([
    fetchH2H(team1.id, team2.id),
    fetchRecentForm(team1.id, team1.name),
    fetchRecentForm(team2.id, team2.name),
  ]);

  const goalProbabilities = computeGoalProbabilities(form1, form2);
  const prediction = computePrediction(form1, form2, h2h, goalProbabilities);

  const result: MatchAnalysis = {
    generatedAt: new Date().toISOString(),
    team1, team2, h2h, form1, form2, goalProbabilities, prediction,
  };
  analysisCache.set(key, { value: result, fetchedAt: Date.now() });
  return result;
}
