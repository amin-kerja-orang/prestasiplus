# syntax=docker/dockerfile:1
# PrestaPlus v2 API (NestJS): deps -> build -> runtime (non-root, read-only rootfs compatible).
# Build from the repo root:  docker build -f docker/api/Dockerfile -t pretasiplus-api:local .
# See docs/ops/containers.md. The root .dockerignore applies (context = repo root).

# ---- production dependencies only (workspace @pp/api and its @pp/contract + @pp/exam-core links) ----
FROM node:22.22.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY packages/exam-core/package.json packages/exam-core/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace @pp/api --include-workspace-root=false --no-audit --no-fund

# ---- build (also the target of the one-shot `migrate` compose service: full npm ci, Prisma CLI) ----
FROM node:22.22.2-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
COPY packages/exam-core/package.json packages/exam-core/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY packages ./packages
COPY apps/api ./apps/api
# DSKP extracts read by the seed (curriculum.ts: ../../../../docs/reference/dskp = /app/docs/reference/dskp).
# Build stage only (the migrate job); the runtime image does not read them.
COPY docs/reference/dskp ./docs/reference/dskp
# Lint, type-check and tests run in CI, not here.
RUN npm run be:build

# ---- runtime ----
FROM node:22.22.2-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
# Pull the Alpine security fixes published after the base image was built (OpenSSL libcrypto3/libssl3).
# Runtime stage only; the apk cache is not kept.
RUN apk upgrade --no-cache
# Nothing in the runtime image runs npm, npx, corepack or yarn (CMD is `node dist/main.js`), so remove the base image's global
# copies: their bundled dependencies (tar, brace-expansion, picomatch, ...) are scanned by Trivy but are never loaded.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    /opt/yarn-*
WORKDIR /app
# Same layout as the repo so the node_modules/@pp/* workspace symlinks resolve.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node packages/contract ./packages/contract
# @pp/exam-core is bundled into dist/main.js (ssr.noExternal); copied only so its workspace symlink is not dangling.
COPY --chown=node:node packages/exam-core ./packages/exam-core
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
# Migration folder names only matter to GET /api/ready (shipped migrations must be applied); the SQL is not executed here.
COPY --from=build --chown=node:node /app/apps/api/prisma/migrations ./apps/api/prisma/migrations
WORKDIR /app/apps/api
# Non-root (uid 1000 from the base image). Nothing writes outside /tmp (tmpfs) and the uploads folder.
# The uploads folder is owned by node in the image, so a new named volume (apifiles) inherits that owner.
ENV FILE_STORAGE_DIR=/var/lib/pretasiplus/files
RUN mkdir -p /var/lib/pretasiplus/files && chown -R node:node /var/lib/pretasiplus
# Read-only rootfs (docker run --read-only --tmpfs /tmp): at runtime the API writes only to FILE_STORAGE_DIR
# (uploads) and os.tmpdir() (/tmp: PDF/OCR scratch, tesseract cache). Prisma 7 uses the pg driver adapter, so no
# query engine is unpacked into node_modules at start, and nothing runs npm. CI proves it (api.yml, docker job).
USER node
EXPOSE 3000
# SIGTERM starts the graceful shutdown (common/health/graceful-shutdown.ts, SHUTDOWN_GRACE_MS, default 25 s). Give the container
# a stop timeout above that (compose: stop_grace_period 30s), otherwise Docker sends SIGKILL after 10 s.
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
# Exec form with node directly (not npm/sh): node is PID 1 and receives SIGTERM itself.
CMD ["node", "dist/main.js"]
