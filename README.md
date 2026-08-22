# MNT Embark

An ultra-luxury all-inclusive tour company website for elite travelers. Features a public-facing multi-page site, editorial travel journals, destination browsing, and an admin panel — built on the MNT Embark Design System.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/mnt-embark run dev` — run the design system preview
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/mnt-embark run tokens` — regenerate design system CSS from tokens.json
- Required env: `DATABASE_URL` — Postgres connection string

## Deployment with Docker & Coolify (VPS)

### Deploying to Coolify with a Separate PostgreSQL Resource
1. **Create PostgreSQL Resource in Coolify**:
   - In Coolify UI, provision a standalone **PostgreSQL** database resource under your project.
2. **Set Environment Variables in Coolify**:
   - In your Coolify Application environment settings, add:
     `DATABASE_URL=postgres://<user>:<password>@<coolify-db-host>:5432/<dbname>`
3. **Deploy via Docker Compose**:
   - Point Coolify at this repository using Docker Compose. Coolify executes `docker compose up`, launching only the `app` container (since `db` is scoped under the `with-db` profile and `depends_on.db` has `required: false`). The app will seamlessly connect to your standalone Coolify PostgreSQL database.

### Running Locally with Docker Compose
- **With embedded PostgreSQL**: Run `docker compose --profile with-db up` (or set `COMPOSE_PROFILES=with-db` in your local `.env`).
- **With app only**: Run `docker compose up` (requires external `DATABASE_URL`).

### Database Initialization & Seeding
- **Automatic Seeding**: Upon server startup, if the database tables do not exist or are empty, the application automatically creates the tables and populates sample luxury tours, categories, destinations, and editorial travel journals.
- **On-Demand Seeding**: Trigger a database re-seed at any time via HTTP API:
  ```bash
  curl -X POST http://localhost:8080/api/seed
  ```
- **Manual Schema Push**: Push Drizzle schema updates to PostgreSQL during development:
  ```bash
  pnpm --filter @workspace/db run push
  ```

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Design system: `@workspace/mnt-embark` — DTCG tokens, shadcn components, Cormorant Garamond + Montserrat

## Where things live

- `artifacts/mnt-embark/` — MNT Embark Design System (tokens, components, style guide preview)
- `artifacts/mnt-embark/tokens.json` — single source of truth for all design tokens
- `artifacts/mnt-embark/docs/AGENTS.md` — how to consume the design system in other artifacts
- `artifacts/api-server/` — shared Express API server
- `lib/db/src/schema/` — Drizzle ORM schema
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for API)

## Architecture decisions

- Dark-first: the site renders with `class="dark"` on `<html>`. All surfaces default to near-black (#0A0908).
- Gold as primary: `--primary: #C9A84C` in dark mode. Never replace with a generic blue/gray.
- Cormorant Garamond for display/headlines (`font-serif`), Montserrat for UI/body (`font-sans`).
- Radius is 4px base — architectural, not playful.
- Design system must be consumed via package imports — never copy token values into the app.

## Product

MNT Embark is an ultra-luxury tour brand. The site serves elite travelers who browse exclusive all-inclusive tours, discover destinations and categories, read travel journals, and book via enquiry. Admins manage all content (tours, destinations, categories, journal entries) via a protected admin panel.

## Gotchas

- Always run `pnpm tokens` after editing `tokens.json` — never hand-edit `src/index.css` or `src/generated/tokens.tsx`.
- All files in `artifacts/mnt-embark/src/` must use `.tsx` extension (no `.ts`).
- Do not emit emojis anywhere in the UI.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `artifacts/mnt-embark/docs/AGENTS.md` for design system consumption guide
- See `artifacts/mnt-embark/docs/consuming-web.md` for React/Vite setup details
