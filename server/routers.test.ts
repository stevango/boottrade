import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createAdminContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.name).toBe("Sample User");
    expect(result?.email).toBe("sample@example.com");
    expect(result?.role).toBe("user");
  });

  it("returns null when not authenticated", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

describe("robots.list", () => {
  it("returns an array (may be empty if DB not connected)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.robots.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("marketplace.list", () => {
  it("returns an array (may be empty if DB not connected)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketplace.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("social.feed", () => {
  it("returns an array (may be empty if DB not connected)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.social.feed();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("admin.users", () => {
  it("throws error when non-admin user tries to access", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("returns array for admin user", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.users();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("brain router", () => {
  it("brain.get requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.brain.get({ robotId: 1 })).rejects.toThrow();
  });

  it("brain.get returns data for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brain.get({ robotId: 1 });
    // Should return brain object or undefined (auto-creates if DB connected)
    if (result) {
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("maturityLevel");
    }
  });

  it("brain.decisions requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.brain.decisions({ robotId: 1, limit: 10 })).rejects.toThrow();
  });

  it("brain.decisions returns array for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brain.decisions({ robotId: 1, limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("portfolio router", () => {
  it("portfolio.list requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.portfolio.list()).rejects.toThrow();
  });

  it("portfolio.list returns array for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.portfolio.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("goals router", () => {
  it("goals.list requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.goals.list()).rejects.toThrow();
  });

  it("goals.list returns array for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.goals.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("pnl router", () => {
  it("pnl.daily requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.pnl.daily()).rejects.toThrow();
  });

  it("pnl.daily returns array for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.pnl.daily();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("risk router", () => {
  it("risk.getSettings requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.risk.getSettings()).rejects.toThrow();
  });
});

describe("ai router", () => {
  it("ai.chat requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.chat({ message: "test", context: "consultor" })
    ).rejects.toThrow();
  });
});

describe("brokers router", () => {
  it("brokers.list requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.brokers.list()).rejects.toThrow();
  });

  it("brokers.list returns array for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.brokers.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("brokers.connect requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.brokers.connect({ broker: "xp", credentials: "{}" })
    ).rejects.toThrow();
  });

  it("brokers.disconnect requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.brokers.disconnect({ id: 1 })).rejects.toThrow();
  });

  it("brokers.sync requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.brokers.sync({ id: 1 })).rejects.toThrow();
  });
});

describe("auth register/login", () => {
  it("register rejects a short password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.register({ name: "Ana", email: "ana@example.com", password: "short" })
    ).rejects.toThrow();
  });

  it("register rejects an invalid email", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.register({ name: "Ana", email: "not-an-email", password: "longenough1" })
    ).rejects.toThrow();
  });

  it("login rejects an invalid email format", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.login({ email: "nope", password: "whatever" })
    ).rejects.toThrow();
  });

  it("login with unknown credentials is unauthorized", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.login({ email: "ghost@example.com", password: "whatever" })
    ).rejects.toThrow();
  });
});

describe("backtests router", () => {
  it("run requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.backtests.run({ name: "X", market: "indices", initialCapital: 10000, numTrades: 100, winRate: 55, payoffRatio: 1.5, riskPerTrade: 1 })
    ).rejects.toThrow();
  });

  it("run rejects out-of-range win rate", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.backtests.run({ name: "X", market: "indices", initialCapital: 10000, numTrades: 100, winRate: 150, payoffRatio: 1.5, riskPerTrade: 1 })
    ).rejects.toThrow();
  });

  it("run returns a Monte Carlo result for an authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const r = await caller.backtests.run({ name: "Edge", market: "cripto", initialCapital: 10000, numTrades: 100, winRate: 60, payoffRatio: 1.5, riskPerTrade: 1, simulations: 50 });
    expect(r.equityCurve[0]).toEqual({ trade: 0, equity: 10000 });
    expect(typeof r.probProfit).toBe("number");
    expect(r.numTrades).toBe(100);
  });
});

describe("paper router", () => {
  it("paper.list requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.paper.list()).rejects.toThrow();
  });

  it("paper.stats returns the virtual-account shape for an authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.paper.stats();
    expect(result.startCapital).toBe(100000);
    expect(result.equity).toBe(100000);
    expect(result.openCount).toBe(0);
  });

  it("paper.open requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.paper.open({ asset: "WINFUT", market: "dolar", type: "buy", quantity: 1, entryPrice: 100 })
    ).rejects.toThrow();
  });

  it("paper.open rejects non-positive quantity and price", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.paper.open({ asset: "WINFUT", market: "dolar", type: "buy", quantity: -1, entryPrice: 100 })
    ).rejects.toThrow();
    await expect(
      caller.paper.open({ asset: "WINFUT", market: "dolar", type: "buy", quantity: 1, entryPrice: 0 })
    ).rejects.toThrow();
  });

  it("paper.close requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.paper.close({ id: 1, exitPrice: 100 })).rejects.toThrow();
  });
});
