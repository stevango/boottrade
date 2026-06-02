import { Agent } from "undici";

// Betfair Exchange (Brasil) — read-only account funds.
// Endpoints regionais (.bet.br) com suporte a login interativo OU por
// certificado cliente (recomendado para Brasil). Não chamamos endpoints de
// envio de aposta — só getAccountFunds.

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
const URL_FUNDS = `https://api.betfair${TLD}/exchange/account/rest/v1.0/getAccountFunds/`;

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
    // undici-specific option; not in the standard Fetch types
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

export async function fetchBetfairFunds(creds: BetfairCreds): Promise<BetfairFunds> {
  const useCert = !!(creds.cert && creds.key);
  const sessionToken = useCert ? await loginCert(creds) : await loginInteractive(creds);

  const resp = await fetch(URL_FUNDS, {
    method: "POST",
    headers: {
      "X-Application": creds.appKey,
      "X-Authentication": sessionToken,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Betfair funds ${resp.status}: ${t.slice(0, 200)}`);
  }
  const f = (await resp.json()) as BetfairFunds;
  return {
    availableToBetBalance: Number(f.availableToBetBalance ?? 0),
    exposure: Number(f.exposure ?? 0),
    retainedCommission: f.retainedCommission != null ? Number(f.retainedCommission) : undefined,
    exposureLimit: f.exposureLimit != null ? Number(f.exposureLimit) : undefined,
    wallet: f.wallet,
  };
}
