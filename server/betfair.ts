// Betfair Exchange — read-only account funds via interactive login + getAccountFunds.
// Docs: https://docs.developer.betfair.com/
// Untested from this sandbox (network allowlist); follows the documented spec.
// No bet-placement endpoints are ever called.

export type BetfairFunds = {
  availableToBetBalance: number;
  exposure: number;
  retainedCommission?: number;
  exposureLimit?: number;
  wallet?: string;
};

export async function fetchBetfairFunds(appKey: string, username: string, password: string): Promise<BetfairFunds> {
  // 1) Interactive login → sessionToken
  const loginBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  const loginResp = await fetch("https://identitysso.betfair.com/api/login", {
    method: "POST",
    headers: {
      "X-Application": appKey,
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: loginBody,
    signal: AbortSignal.timeout(20_000),
  });

  if (!loginResp.ok) {
    const t = await loginResp.text().catch(() => "");
    throw new Error(`Betfair login ${loginResp.status}: ${t.slice(0, 200)}`);
  }
  const login = (await loginResp.json()) as { status?: string; token?: string; error?: string };
  if (login.status !== "SUCCESS" || !login.token) {
    throw new Error(`Betfair login failed: ${login.status ?? "unknown"}${login.error ? " — " + login.error : ""}`);
  }

  // 2) Get account funds
  const fundsResp = await fetch("https://api.betfair.com/exchange/account/rest/v1.0/getAccountFunds/", {
    method: "POST",
    headers: {
      "X-Application": appKey,
      "X-Authentication": login.token,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(15_000),
  });

  if (!fundsResp.ok) {
    const t = await fundsResp.text().catch(() => "");
    throw new Error(`Betfair funds ${fundsResp.status}: ${t.slice(0, 200)}`);
  }

  const f = (await fundsResp.json()) as BetfairFunds;
  return {
    availableToBetBalance: Number(f.availableToBetBalance ?? 0),
    exposure: Number(f.exposure ?? 0),
    retainedCommission: f.retainedCommission != null ? Number(f.retainedCommission) : undefined,
    exposureLimit: f.exposureLimit != null ? Number(f.exposureLimit) : undefined,
    wallet: f.wallet,
  };
}
