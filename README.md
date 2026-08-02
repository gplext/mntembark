# MNT Embark

An ultra-luxury all-inclusive tour company website. Public multi-page site,
editorial travel journals, destination and category browsing, enquiry-based
booking, and a protected admin panel for managing all content.

## Stack

| Layer         | Choice                                                    |
| ------------- | --------------------------------------------------------- |
| Runtime       | Node.js 24, TypeScript 5.9, pnpm workspaces                |
| API           | Express 5, bundled to a single ESM file with esbuild        |
| Database      | PostgreSQL + Drizzle ORM                                    |
| Frontend      | React 19, Vite 7, Tailwind 4, wouter, TanStack Query        |
| Design system | `@workspace/mnt-embark` — DTCG tokens + shadcn components   |
| Search        | Local sentence embeddings (`Xenova/all-MiniLM-L6-v2`)       |

## Repository layout

```
artifacts/
  api-server/       Express API. Also serves the built SPA in production.
  mnt-embark/       Design system: tokens.json is the single source of truth.
  mnt-embark-web/   The website + admin panel (React SPA).
lib/
  api-spec/         OpenAPI contract — source of truth for the API.
  api-zod/          Zod schemas generated from the spec.
  api-client-react/ React Query hooks generated from the spec.
  db/               Drizzle schema and connection pool.
  object-storage-web/ Upload hook + component used by the admin panel.
```

## Local development

Requires Node 24+, pnpm 10, and a PostgreSQL database.

```bash
pnpm install
cp .env.example .env        # then fill in DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD
pnpm --filter @workspace/db run push        # create the schema

# two terminals:
pnpm --filter @workspace/api-server  run dev   # API on :8080
pnpm --filter @workspace/mnt-embark-web run dev   # SPA on :5173, proxies /api to :8080
```

Other useful commands:

```bash
pnpm run typecheck                                  # typecheck everything
pnpm run build                                      # typecheck + build all packages
pnpm --filter @workspace/mnt-embark run tokens      # regenerate design tokens
pnpm --filter @workspace/api-spec run codegen       # regenerate API hooks + schemas
```

## Deploying to Coolify

The app ships as a **single container**: one Node process serves the API under
`/api/*` and the compiled React SPA for everything else.

1. **Create the resource** — in Coolify, add a new resource from this Git
   repository and choose **Dockerfile** as the build pack. Set the port to `8080`.

2. **Provision Postgres** — add a PostgreSQL service in Coolify and copy its
   internal connection string.

3. **Set environment variables:**

   | Variable         | Required | Notes                                    |
   | ---------------- | -------- | ---------------------------------------- |
   | `DATABASE_URL`   | yes      | Postgres connection string               |
   | `SESSION_SECRET` | yes      | `openssl rand -hex 32`                   |
   | `ADMIN_PASSWORD` | yes      | Password for the `/admin` login          |
   | `PORT`           | no       | Defaults to `8080`                       |
   | `UPLOAD_DIR`     | no       | Defaults to `/data/uploads`              |
   | `MODEL_CACHE_DIR` | no      | Defaults to `/data/model-cache`          |
   | `MAX_UPLOAD_BYTES` | no     | Defaults to 25 MB                        |

4. **Add a persistent volume** mounted at `/data`. This holds admin-uploaded
   images and the cached embedding model. Without it, uploads are lost on every
   redeploy.

5. **Push the database schema** once, from a machine with `DATABASE_URL` set:

   ```bash
   pnpm --filter @workspace/db run push
   ```

6. **Health check** — the container already declares one against
   `GET /api/healthz`.

To run the whole stack locally instead, `docker-compose.yml` brings up the app
and a Postgres instance together:

```bash
SESSION_SECRET=$(openssl rand -hex 32) ADMIN_PASSWORD=changeme docker compose up --build
```

## File uploads

Admin image uploads are stored on local disk under `UPLOAD_DIR`, using a signed
two-step flow:

1. `POST /api/storage/uploads/request-url` (admin session required) returns a
   short-lived HMAC-signed URL.
2. The browser `PUT`s the file to that URL.
3. The file is served back from `GET /api/storage/objects/<id>`.

Because uploads live on a volume rather than in object storage, the app must run
as a **single instance**. If you later need horizontal scaling, swap
`artifacts/api-server/src/lib/objectStorage.ts` for an S3-compatible
implementation — the route contract above does not need to change.

## Known limitations

- **Sessions are in-memory.** Admins are logged out whenever the container
  restarts. Add `connect-pg-simple` (or Redis) as a session store if that
  becomes annoying.
- **The build needs network access to `api.nuget.org`**, because
  `onnxruntime-node` downloads native binaries during install. This is only a
  build-time requirement.
- **The embedding model (~23 MB) is downloaded on first use** and cached in
  `MODEL_CACHE_DIR`. Keep that on the volume or it re-downloads every restart.

## Conventions

- Dark-first: the site renders with `class="dark"` on `<html>`; surfaces default
  to near-black (`#0A0908`).
- Gold is the primary colour (`#C9A84C`) — never substitute a generic blue or gray.
- Cormorant Garamond for display (`font-serif`), Montserrat for UI (`font-sans`).
- 4px base radius — architectural, not playful.
- Always run `pnpm tokens` after editing `tokens.json`; never hand-edit
  `src/index.css` or `src/generated/tokens.tsx`.
- All files in `artifacts/mnt-embark/src/` use the `.tsx` extension.
- No emojis in the UI.
- Consume the design system through package imports; never copy token values.
