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

/*
 * Every unhandled API error answers as JSON.
 *
 * Without this, express's default handler renders an HTML page — in production
 * just "Internal Server Error". The admin screens read the server's own
 * sentence out of a JSON body and show it to the person, so an HTML body left
 * them with nothing to say but "Please try again", which tells the person
 * nothing and leaves whoever is debugging with no clue either.
 *
 * The message goes to the log at error level and only a reference reaches the
 * browser: a stack trace or a raw driver message is not something to hand to a
 * client, but the person does need something they can quote when reporting it.
 */
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) return next(err);

    const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
    logger.error(
      { err, ref, method: req.method, url: req.originalUrl },
      "unhandled API error",
    );

    res.status(500).json({
      error: `Something went wrong on the server (reference ${ref}). The details are in the server log.`,
    });
  },
);

const publicDir = process.env["PUBLIC_DIR"] || path.resolve(process.cwd(), "public");

if (fs.existsSync(publicDir)) {
  /*
   * Cache headers, which express.static does not set on its own — its default
   * maxAge is 0, so every navigation revalidated every asset and re-downloaded
   * media that had not changed in months. On a slow link that alone made each
   * page load feel like a cold one.
   *
   * Vite writes a content hash into every filename under /assets, so those can
   * be immutable for a year: a changed file is a new name and cannot be served
   * stale. Videos, images and fonts are not hashed, so they get a long-but-
   * revalidatable year instead. index.html must never be cached, or a redeploy
   * would leave browsers pointing at asset names that no longer exist.
   */
  app.use(
    express.static(publicDir, {
      etag: true,
      lastModified: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }
        if (/[\\/]assets[\\/]/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        if (/\.(webm|mp4|jpe?g|png|webp|avif|svg|woff2?)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000");
        }
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    /*
     * Same rule as the static index.html above: this shell names the hashed
     * asset files, so a cached copy after a redeploy points at bundles that
     * are no longer there.
     *
     * sendFile writes its own Cache-Control from its maxAge option (0 by
     * default), and that write lands after both res.setHeader and the
     * `headers` option — so the only way to keep ours is to switch sendFile's
     * own header off with cacheControl: false.
     */
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(publicDir, "index.html"), { cacheControl: false });
  });
}

export default app;
