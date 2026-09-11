import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function configureCors(app: express.Express) {
  const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || "*";

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    const origin = allowedOrigin === "*" ? "*" : requestOrigin === allowedOrigin ? allowedOrigin : "";

    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  configureCors(app);
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: true }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "quality-analyzer-api" });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Quality Analyzer API listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start Quality Analyzer API", error);
  process.exitCode = 1;
});
