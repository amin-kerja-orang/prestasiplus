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
# Lint, type-check and tests run in CI, not here.
RUN npm run be:build

# ---- runtime ----
FROM node:22.22.2-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
# Same layout as the repo so the node_modules/@pp/* workspace symlinks resolve.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node packages/contract ./packages/contract
# @pp/exam-core is bundled into dist/main.js (ssr.noExternal); copied only so its workspace symlink is not dangling.
COPY --chown=node:node packages/exam-core ./packages/exam-core
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
# Non-root (uid 1000 from the base image). Nothing writes outside /tmp (tmpfs) and the uploads folder.
# The uploads folder is owned by node in the image, so a new named volume (apifiles) inherits that owner.
ENV FILE_STORAGE_DIR=/var/lib/pretasiplus/files
RUN mkdir -p /var/lib/pretasiplus/files && chown -R node:node /var/lib/pretasiplus
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1
CMD ["node", "dist/main.js"]
