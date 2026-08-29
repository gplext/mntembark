# syntax=docker/dockerfile:1

###############################################################################
# MNT Embark — single-container image
#
# One Node process serves both the API (/api/*) and the built React SPA.
# Build once, run anywhere. Designed for Coolify but is a plain Dockerfile.
###############################################################################

ARG NODE_VERSION=24-bookworm-slim
ARG PNPM_VERSION=10.18.0

###############################################################################
# Stage 1 — Base setup with pnpm
###############################################################################
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

###############################################################################
# Stage 2 — Install all workspace dependencies (including dev) for build
###############################################################################
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY artifacts/api-server/package.json        artifacts/api-server/package.json
COPY artifacts/mnt-embark/package.json        artifacts/mnt-embark/package.json
COPY artifacts/mnt-embark-web/package.json    artifacts/mnt-embark-web/package.json
COPY lib/api-client-react/package.json        lib/api-client-react/package.json
COPY lib/api-spec/package.json                lib/api-spec/package.json
COPY lib/api-zod/package.json                 lib/api-zod/package.json
COPY lib/db/package.json                      lib/db/package.json
COPY lib/object-storage-web/package.json      lib/object-storage-web/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --no-frozen-lockfile

###############################################################################
# Stage 3 — Build API bundle and React frontend SPA
###############################################################################
FROM deps AS build
ENV NODE_ENV=production \
    BASE_PATH=/

COPY . .

RUN pnpm --filter @workspace/mnt-embark-web run build \
 && pnpm --filter @workspace/api-server   run build

###############################################################################
# Stage 4 — Isolated production dependencies only (using pnpm deploy)
###############################################################################
FROM deps AS prod-deps
ENV NODE_ENV=production

# pnpm deploy isolates only production dependencies into /prod/app (--legacy flag required for pnpm v10 monorepos)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @workspace/api-server deploy --legacy --prod /prod/app

###############################################################################
# Stage 5 — Slim runtime
###############################################################################
FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    PUBLIC_DIR=/app/public \
    UPLOAD_DIR=/data/uploads \
    MODEL_CACHE_DIR=/data/model-cache

WORKDIR /app

# Copy pruned production runtime directory (node_modules + package.json)
COPY --from=prod-deps --chown=node:node /prod/app ./

# Copy compiled API ESM bundle and static web assets from build stage
COPY --from=build --chown=node:node /app/artifacts/api-server/dist            ./artifacts/api-server/dist
COPY --from=build --chown=node:node /app/artifacts/mnt-embark-web/dist/public ./public

# Create volume directories
RUN mkdir -p /data/uploads /data/model-cache \
 && chown -R node:node /data

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

