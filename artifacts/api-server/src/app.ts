import path from 'node:path';
import { existsSync } from 'node:fs';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import session from 'express-session';
import pinoHttp from 'pino-http';
import router from './routes';
import { logger } from './lib/logger';

const app: Express = express();

// Coolify (and most reverse proxies) terminate TLS upstream. Trusting the proxy
// lets express-session set Secure cookies correctly behind HTTPS.
app.set('trust proxy', 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split('?')[0],
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

const sessionSecret = process.env['SESSION_SECRET'];
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is required');
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  }),
);

app.use('/api', router);

/**
 * Single-container mode: serve the built frontend from this same process.
 *
 * PUBLIC_DIR points at the Vite build output. When it exists, static assets are
 * served with long-lived caching (filenames are content-hashed) and every other
 * GET falls through to index.html so client-side routing works on hard refresh.
 */
const publicDir = path.resolve(
  process.env['PUBLIC_DIR'] || path.join(process.cwd(), 'public'),
);

if (existsSync(path.join(publicDir, 'index.html'))) {
  logger.info({ publicDir }, 'Serving static frontend');

  app.use(
    express.static(publicDir, {
      index: false,
      maxAge: '1y',
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // SPA fallback. Registered as middleware rather than `app.get('/*splat')`
  // because in Express 5 the splat pattern does not match the root path.
  app.use((req: Request, res: Response, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    // Never let unmatched API routes fall through to the SPA shell.
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  logger.warn(
    { publicDir },
    'No frontend build found — running in API-only mode',
  );
}

export default app;
