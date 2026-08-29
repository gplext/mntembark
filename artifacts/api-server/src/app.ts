import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import pinoHttp from "pino-http";
import fs from "fs";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

/*
 * Sessions live in Postgres, not in this process's memory.
 *
 * express-session's default MemoryStore drops every session when the container
 * restarts — so each redeploy signed every admin out — grows without bound for
 * as long as the process lives, and breaks entirely behind more than one
 * replica, because a request reaching the other instance sees no session.
 *
 * Reuses the pool @workspace/db already opened rather than a second one.
 * createTableIfMissing creates `user_sessions` on first run; it touches no
 * existing table.
 *
 * connect-pg-simple must stay in build.mjs's `external` list — it reads a
 * table.sql file from inside its own package, and bundling it leaves that file
 * behind, at which point the store fails silently and every login appears to
 * succeed while no session is ever saved.
 */
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      /*
       * "auto" rather than NODE_ENV === "production": mark the cookie Secure
       * only when the connection actually is HTTPS, which the `trust proxy`
       * setting above makes correct behind Coolify. Keying it off NODE_ENV
       * meant a production build served over plain HTTP — every local
       * `docker compose up` — issued no cookie at all, so admin login could
       * not work there.
       */
      secure: "auto",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  }),
);

app.use("/api", router);

const publicDir = process.env["PUBLIC_DIR"] || path.resolve(process.cwd(), "public");

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
