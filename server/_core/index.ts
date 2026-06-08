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
import { runOracleForAllActive } from "../oracle";

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
    const ORACLE_INTERVAL_MS = 60 * 60 * 1000;
    const ORACLE_FIRST_DELAY_MS = 5 * 60 * 1000;
    const tickOracle = async () => {
      try {
        const results = await runOracleForAllActive();
        if (results.length > 0) {
          const total = results.reduce((s, r) => s + r.created, 0);
          console.log(`[oracle] tick: ${results.length} usuário(s), ${total} sinais criados`);
        }
      } catch (e) {
        console.error("[oracle] tick failed:", e);
      }
    };
    setTimeout(() => { tickOracle(); setInterval(tickOracle, ORACLE_INTERVAL_MS); }, ORACLE_FIRST_DELAY_MS);
  }
}

startServer().catch(console.error);
