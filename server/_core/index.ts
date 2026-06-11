import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runOracleForAllActive, tryResolveAllOracleSignals, listOracleActiveUsers } from "../oracle";
import { runAthenaForAllActive } from "../athena";
import { runKrakenForAllActive } from "../kraken";
import { settleBetfairBetsForUser } from "../betfairExecutor";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const BOOTED_AT = new Date().toISOString();

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Security headers: clickjacking, MIME sniffing, referrer leakage, HSTS.
  // (HSTS is ignored by browsers over plain HTTP, so it's safe in dev.)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Public version probe so we can verify which build is actually running on
  // the deployed environment (Railway exposes RAILWAY_GIT_COMMIT_SHA).
  app.get("/api/version", (_req, res) => {
    res.json({
      commit: (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || "dev").slice(0, 12),
      branch: process.env.RAILWAY_GIT_BRANCH || "unknown",
      env: process.env.NODE_ENV || "development",
      bootedAt: BOOTED_AT,
    });
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Background scheduler — runs the Oracle AI sports scan every hour for
  // every user who has the robot activated. First tick fires 5 min after
  // boot to give DB connections time to warm up.
  if (process.env.NODE_ENV !== "test") {
    // Oracle full scan (generate new signals + run advisor on top edges)
    // hourly. Resolver (check /scores for finished games) runs every 15m so
    // the user sees results land quickly during match days.
    const ORACLE_INTERVAL_MS = 60 * 60 * 1000;
    const RESOLVE_INTERVAL_MS = 15 * 60 * 1000;
    const ORACLE_FIRST_DELAY_MS = 5 * 60 * 1000;
    const RESOLVE_FIRST_DELAY_MS = 90 * 1000;
    const tickOracle = async () => {
      try {
        const created = await runOracleForAllActive();
        const totalC = created.reduce((s, r) => s + r.created, 0);
        if (totalC > 0) console.log(`[oracle] scan: ${created.length} usuário(s), ${totalC} novos sinais`);
      } catch (e) {
        console.error("[oracle] scan tick failed:", e);
      }
    };
    const tickResolve = async () => {
      try {
        const resolved = await tryResolveAllOracleSignals();
        const totalR = resolved.reduce((s, r) => s + r.resolved, 0);
        const totalE = resolved.reduce((s, r) => s + ((r as any).expired ?? 0), 0);
        if (totalR > 0 || totalE > 0) console.log(`[oracle] resolve: ${totalR} resolvidos, ${totalE} expirados`);
      } catch (e) {
        console.error("[oracle] resolve tick failed:", e);
      }
    };
    setTimeout(() => { tickOracle(); setInterval(tickOracle, ORACLE_INTERVAL_MS); }, ORACLE_FIRST_DELAY_MS);
    setTimeout(() => { tickResolve(); setInterval(tickResolve, RESOLVE_INTERVAL_MS); }, RESOLVE_FIRST_DELAY_MS);

    // Athena AI (B3 stock signals) — runs every 4 hours during market hours.
    // Stocks move slower than sports odds; hourly would just duplicate.
    const tickAthena = async () => {
      try {
        const r = await runAthenaForAllActive();
        const total = r.reduce((s, x) => s + x.created, 0);
        if (total > 0) console.log(`[athena] scan: ${r.length} usuário(s), ${total} novos sinais`);
      } catch (e) {
        console.error("[athena] scan tick failed:", e);
      }
    };
    setTimeout(() => { tickAthena(); setInterval(tickAthena, 4 * 60 * 60 * 1000); }, 3 * 60 * 1000);

    // Kraken AI (crypto) — every 2h (crypto moves faster than stocks).
    const tickKraken = async () => {
      try {
        const r = await runKrakenForAllActive();
        const total = r.reduce((s, x) => s + x.created, 0);
        if (total > 0) console.log(`[kraken] scan: ${r.length} usuário(s), ${total} novos sinais`);
      } catch (e) {
        console.error("[kraken] scan tick failed:", e);
      }
    };
    setTimeout(() => { tickKraken(); setInterval(tickKraken, 2 * 60 * 60 * 1000); }, 4 * 60 * 1000);

    // Betfair settlement — every 10 min query listClearedOrders for each
    // active Oracle user and mirror real-money P&L into brain_decisions.
    const tickBetfairSettle = async () => {
      try {
        const userIds = await listOracleActiveUsers();
        for (const uid of userIds) {
          const r = await settleBetfairBetsForUser(uid);
          if (r.settled > 0) console.log(`[betfair] settled ${r.settled} bet(s) for user ${uid}`);
        }
      } catch (e) {
        console.error("[betfair] settle tick failed:", e);
      }
    };
    setTimeout(() => { tickBetfairSettle(); setInterval(tickBetfairSettle, 10 * 60 * 1000); }, 120_000);
  }
}

startServer().catch(console.error);
