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
# Stage 1 — install every workspace dependency (including dev) so we can build
###############################################################################
FROM node:${NODE_VERSION} AS deps
ARG PNPM_VERSION
# npm_config_package_import_method=copy: the pnpm store lives on a BuildKit
# cache mount that is not part of the final image. Copying (rather than
# hardlinking) guarantees node_modules contains real files that survive into
# the runtime stage.
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true \
    npm_config_package_import_method=copy
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy only the manifests first so this layer is cached until a dependency
# actually changes.
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
    pnpm install --frozen-lockfile

###############################################################################
# Stage 2 — build the API bundle and the frontend
###############################################################################
FROM deps AS build
ENV NODE_ENV=production \
    BASE_PATH=/

COPY . .

# Frontend -> artifacts/mnt-embark-web/dist/public
# API      -> artifacts/api-server/dist/index.mjs
RUN pnpm --filter @workspace/mnt-embark-web run build \
 && pnpm --filter @workspace/api-server   run build

###############################################################################
# Stage 3 — production dependencies only (no devDependencies)
###############################################################################
FROM deps AS prod-deps
ENV NODE_ENV=production
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @workspace/api-server...

###############################################################################
# Stage 4 — slim runtime
###############################################################################
FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    PUBLIC_DIR=/app/public \
    UPLOAD_DIR=/data/uploads \
    MODEL_CACHE_DIR=/data/model-cache

WORKDIR /app

# pnpm uses a symlinked (isolated) node_modules layout, so the directory tree
# must be copied wholesale and kept at the same paths or the links break.
# The prod-deps stage contains only manifests + pruned node_modules — no source.
COPY --from=prod-deps /app ./

# The bundled server and the compiled frontend.
COPY --from=build /app/artifacts/api-server/dist            ./artifacts/api-server/dist
COPY --from=build /app/artifacts/mnt-embark-web/dist/public ./public

# Uploads and the embedding-model cache live on a persistent volume.
RUN mkdir -p /data/uploads /data/model-cache \
 && chown -R node:node /app /data

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
