import { Agent } from "undici";

// Betfair Exchange (Brasil) — read + execute. Endpoints regionais (.bet.br)
// com suporte a login interativo OU por certificado cliente (recomendado
// pra Brasil). Funcionalidades:
//   - getAccountFunds (saldo + exposição)
//   - listMarketCatalogue (procura mercados por nome de competidores e data)
//   - placeOrders (envia aposta BACK/LAY)
//   - listCurrentOrders (apostas pendentes)
//   - listClearedOrders (apostas liquidadas com P&L real)

export type BetfairFunds = {
  availableToBetBalance: number;
  exposure: number;
  retainedCommission?: number;
  exposureLimit?: number;
  wallet?: string;
};

export type BetfairCreds = {
  appKey: string;
  username: string;
  password: string;
  cert?: string; // PEM do certificado cliente (opcional)
  key?: string;  // PEM da chave privada (opcional)
};

const TLD = ".bet.br";
const URL_LOGIN = `https://identitysso.betfair${TLD}/api/login`;
const URL_CERTLOGIN = `https://identitysso-cert.betfair${TLD}/api/certlogin`;
const URL_ACCOUNT = `https://api.betfair${TLD}/exchange/account/rest/v1.0`;
const URL_BETTING = `https://api.betfair${TLD}/exchange/betting/rest/v1.0`;

// =============================================================================
// Auth — session token (~4h validity).
// =============================================================================

async function loginInteractive(creds: BetfairCreds): Promise<string> {
  const body = `username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
  const resp = await fetch(URL_LOGIN, {
    method: "POST",
    headers: { "X-Application": creds.appKey, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Betfair login ${resp.status}: ${t.slice(0, 200)}`);
  }
  const j = (await resp.json()) as { status?: string; token?: string; error?: string };
  if (j.status !== "SUCCESS" || !j.token) {
    throw new Error(`Betfair login: ${j.status ?? "unknown"}${j.error ? " — " + j.error : ""}`);
  }
  return j.token;
}

async function loginCert(creds: BetfairCreds): Promise<string> {
  const dispatcher = new Agent({ connect: { cert: creds.cert!, key: creds.key! } });
  const body = `username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
  const resp = await fetch(URL_CERTLOGIN, {
    method: "POST",
    headers: { "X-Application": creds.appKey, "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
    dispatcher,
  } as unknown as RequestInit);
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Betfair certlogin ${resp.status}: ${t.slice(0, 200)}`);
  }
  const j = (await resp.json()) as { sessionToken?: string; loginStatus?: string };
  if (j.loginStatus !== "SUCCESS" || !j.sessionToken) {
    throw new Error(`Betfair certlogin: ${j.loginStatus ?? "unknown"}`);
  }
  return j.sessionToken;
}

async function getSessionToken(creds: BetfairCreds): Promise<string> {
  const useCert = !!(creds.cert && creds.key);
  return useCert ? loginCert(creds) : loginInteractive(creds);
}

// In-memory session cache so we don't re-login on every call within a single
// scheduler tick (session token is valid for ~4 hours).
type CachedSession = { token: string; fetchedAt: number };
const sessionCache = new Map<string, CachedSession>();
const SESSION_TTL = 3 * 60 * 60 * 1000; // refresh after 3h to be safe

async function getOrRefreshSession(creds: BetfairCreds): Promise<string> {
  const cacheKey = `${creds.appKey}|${creds.username}`;
  const cached = sessionCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < SESSION_TTL) return cached.token;
  const token = await getSessionToken(creds);
  sessionCache.set(cacheKey, { token, fetchedAt: Date.now() });
  return token;
}

async function rpc<T>(creds: BetfairCreds, base: string, path: string, payload: unknown): Promise<T> {
  const token = await getOrRefreshSession(creds);
  const resp = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "X-Application": creds.appKey,
      "X-Authentication": token,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    // Session might have expired despite TTL; invalidate cache so the next
    // call re-logs in cleanly.
    if (resp.status === 401 || resp.status === 403) sessionCache.delete(`${creds.appKey}|${creds.username}`);
    throw new Error(`Betfair ${path} ${resp.status}: ${t.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

// =============================================================================
// Account
// =============================================================================

export async function fetchBetfairFunds(creds: BetfairCreds): Promise<BetfairFunds> {
  const f = await rpc<BetfairFunds>(creds, URL_ACCOUNT, "/getAccountFunds/", {});
  return {
    availableToBetBalance: Number(f.availableToBetBalance ?? 0),
    exposure: Number(f.exposure ?? 0),
    retainedCommission: f.retainedCommission != null ? Number(f.retainedCommission) : undefined,
    exposureLimit: f.exposureLimit != null ? Number(f.exposureLimit) : undefined,
    wallet: f.wallet,
  };
}

// =============================================================================
// Market discovery
// =============================================================================

export type BetfairMarket = {
  marketId: string;
  marketName: string;
  marketStartTime: string;
  event: { id: string; name: string; openDate: string; countryCode?: string };
  competition?: { id: string; name: string };
  runners: { selectionId: number; runnerName: string; handicap: number }[];
};

// listMarketCatalogue: encontra mercados por filtros. Pra apostar precisamos
// do marketId + selectionId. Filtramos pelo nome do evento e janela de tempo.
export async function findMarketsForEvent(creds: BetfairCreds, opts: {
  textQuery: string;           // ex: "Brazil vs Argentina"
  startTime: Date;              // janela de busca: hora do jogo
  windowHours?: number;         // largura da janela ±N horas, default 12
  marketTypeCodes?: string[];   // MATCH_ODDS, OVER_UNDER_25, etc; default MATCH_ODDS
  maxResults?: number;          // default 5
}): Promise<BetfairMarket[]> {
  const from = new Date(opts.startTime.getTime() - (opts.windowHours ?? 12) * 60 * 60 * 1000);
  const to = new Date(opts.startTime.getTime() + (opts.windowHours ?? 12) * 60 * 60 * 1000);
  const payload = {
    filter: {
      textQuery: opts.textQuery,
      marketTypeCodes: opts.marketTypeCodes ?? ["MATCH_ODDS"],
      marketStartTime: { from: from.toISOString(), to: to.toISOString() },
    },
    maxResults: String(opts.maxResults ?? 5),
    marketProjection: ["EVENT", "COMPETITION", "RUNNER_DESCRIPTION", "MARKET_START_TIME"],
    sort: "FIRST_TO_START",
  };
  const r = await rpc<BetfairMarket[]>(creds, URL_BETTING, "/listMarketCatalogue/", payload);
  return Array.isArray(r) ? r : [];
}

export type RunnerBook = {
  selectionId: number;
  status: string;             // ACTIVE, REMOVED, WINNER, LOSER, etc
  lastPriceTraded?: number;
  totalMatched?: number;
  ex?: {
    availableToBack?: { price: number; size: number }[];
    availableToLay?: { price: number; size: number }[];
  };
};

export type MarketBook = {
  marketId: string;
  isMarketDataDelayed: boolean;
  status: string;             // OPEN, CLOSED, SUSPENDED
  inplay: boolean;
  runners: RunnerBook[];
};

// listMarketBook: traz preços ao vivo de um mercado específico. Chamado antes
// de apostar pra confirmar que o preço recomendado ainda está disponível.
export async function listMarketBook(creds: BetfairCreds, marketId: string): Promise<MarketBook | null> {
  const payload = {
    marketIds: [marketId],
    priceProjection: { priceData: ["EX_BEST_OFFERS"] },
  };
  const r = await rpc<MarketBook[]>(creds, URL_BETTING, "/listMarketBook/", payload);
  return Array.isArray(r) && r.length > 0 ? r[0] : null;
}

// =============================================================================
// Placing orders
// =============================================================================

export type PlaceBetInput = {
  marketId: string;
  selectionId: number;
  side: "BACK" | "LAY";          // BACK = você aposta a favor (igual casa fixed-odds)
  price: number;                  // odd decimal — Betfair faz tick rounding
  size: number;                   // stake em R$
  persistenceType?: "LAPSE" | "PERSIST" | "MARKET_ON_CLOSE"; // default LAPSE
  customerRef?: string;           // até 32 chars, ascii, pra idempotência
};

export type PlaceBetResult = {
  status: "SUCCESS" | "FAILURE" | "PROCESSED_WITH_ERRORS";
  errorCode?: string;
  marketId: string;
  betId?: string;
  averagePriceMatched?: number;
  sizeMatched?: number;
  sizeRemaining?: number;
  placedDate?: string;
  instructionReports?: any[];
};

// Round price to Betfair's allowed tick ladder. Required by the API or it
// rejects with INVALID_ODDS.
function roundPriceToTick(price: number): number {
  // From Betfair docs:
  //   1.01-2.00 step 0.01
  //   2.0-3.0   step 0.02
  //   3.0-4.0   step 0.05
  //   4.0-6.0   step 0.1
  //   6.0-10.0  step 0.2
  //   10-20     step 0.5
  //   20-30     step 1
  //   30-50     step 2
  //   50-100    step 5
  //   100-1000  step 10
  const ranges: [number, number, number][] = [
    [1.01, 2.0, 0.01],
    [2.0, 3.0, 0.02],
    [3.0, 4.0, 0.05],
    [4.0, 6.0, 0.1],
    [6.0, 10.0, 0.2],
    [10, 20, 0.5],
    [20, 30, 1],
    [30, 50, 2],
    [50, 100, 5],
    [100, 1000, 10],
  ];
  for (const [lo, hi, step] of ranges) {
    if (price >= lo && price < hi) {
      return Math.round(price / step) * step;
    }
  }
  return Math.min(1000, Math.max(1.01, price));
}

export async function placeBet(creds: BetfairCreds, input: PlaceBetInput): Promise<PlaceBetResult> {
  const payload = {
    marketId: input.marketId,
    instructions: [{
      orderType: "LIMIT",
      selectionId: input.selectionId,
      side: input.side,
      limitOrder: {
        size: Number(input.size.toFixed(2)),
        price: roundPriceToTick(input.price),
        persistenceType: input.persistenceType ?? "LAPSE",
      },
    }],
    ...(input.customerRef ? { customerRef: input.customerRef.slice(0, 32) } : {}),
  };
  const r = await rpc<{
    status: PlaceBetResult["status"];
    errorCode?: string;
    marketId: string;
    instructionReports?: {
      status: string;
      errorCode?: string;
      betId?: string;
      placedDate?: string;
      averagePriceMatched?: number;
      sizeMatched?: number;
      orderStatus?: string;
    }[];
  }>(creds, URL_BETTING, "/placeOrders/", payload);

  const ir = r.instructionReports?.[0];
  return {
    status: r.status,
    errorCode: r.errorCode ?? ir?.errorCode,
    marketId: r.marketId,
    betId: ir?.betId,
    averagePriceMatched: ir?.averagePriceMatched,
    sizeMatched: ir?.sizeMatched,
    sizeRemaining: ir?.sizeMatched != null ? input.size - (ir.sizeMatched ?? 0) : undefined,
    placedDate: ir?.placedDate,
    instructionReports: r.instructionReports,
  };
}

// =============================================================================
// Order monitoring + settlement
// =============================================================================

export type ClearedOrder = {
  eventTypeId?: string;
  eventId?: string;
  marketId: string;
  selectionId: number;
  side: "BACK" | "LAY";
  betId: string;
  placedDate: string;
  settledDate?: string;
  priceMatched?: number;
  sizeSettled?: number;
  profit?: number;            // R$ profit (negative if lost)
  betOutcome?: "WON" | "LOST" | "PLACED" | "COMMISSION_REVERSED";
};

// Lists settled bets. We call this from the resolution scheduler to mark
// brain_decisions as profit/loss based on real money outcomes.
export async function listClearedOrders(creds: BetfairCreds, opts?: { since?: Date }): Promise<ClearedOrder[]> {
  const from = opts?.since ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const payload = {
    betStatus: "SETTLED",
    settledDateRange: { from: from.toISOString(), to: new Date().toISOString() },
    groupBy: "BET",
    recordCount: 200,
  };
  const r = await rpc<{ clearedOrders: ClearedOrder[]; moreAvailable?: boolean }>(creds, URL_BETTING, "/listClearedOrders/", payload);
  return r.clearedOrders ?? [];
}

export async function listCurrentOrders(creds: BetfairCreds): Promise<{ marketId: string; selectionId: number; betId: string; status: string; sizeMatched?: number; sizeRemaining?: number; averagePriceMatched?: number; placedDate: string }[]> {
  const r = await rpc<{ currentOrders: any[] }>(creds, URL_BETTING, "/listCurrentOrders/", {});
  return (r.currentOrders ?? []).map((o: any) => ({
    marketId: o.marketId,
    selectionId: o.selectionId,
    betId: o.betId,
    status: o.status,
    sizeMatched: o.sizeMatched,
    sizeRemaining: o.sizeRemaining,
    averagePriceMatched: o.averagePriceMatched,
    placedDate: o.placedDate,
  }));
}
