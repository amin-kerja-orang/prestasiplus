# syntax=docker/dockerfile:1
# PrestaPlus v2 frontend: build stage (node) -> serving stage (nginx, non-root).
# Build from the repo root:  docker build -f docker/frontend/Dockerfile -t pretasiplus-frontend .
# See docs/ops/containers.md.

# ---- build ----
FROM node:22.22.2-alpine AS build
WORKDIR /app

# Dependencies first, so this layer is cached until a package manifest changes.
COPY package.json package-lock.json ./
COPY packages/contract/package.json packages/contract/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .

# Build-time config. VITE_* values are baked into the static bundle (never put secrets here).
ARG BUILD_MODE=demo
ARG VITE_API_MODE=mock
ARG VITE_TEST_HOOKS=false
ARG VITE_PROTOTYPE_SCOPE=on
ARG VITE_MOCK_LATENCY_MS=400
ARG VITE_API_BASE_URL=
# Commit shown on the demo login screen; .git is not in the build context. Pass --build-arg VITE_BUILD_SHA=$(git rev-parse --short HEAD).
ARG VITE_BUILD_SHA=
ENV VITE_API_MODE=$VITE_API_MODE \
    VITE_TEST_HOOKS=$VITE_TEST_HOOKS \
    VITE_PROTOTYPE_SCOPE=$VITE_PROTOTYPE_SCOPE \
    VITE_MOCK_LATENCY_MS=$VITE_MOCK_LATENCY_MS \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_BUILD_SHA=$VITE_BUILD_SHA

# Type-check, lint and tests run in CI, not here. The demo guard fails the build if test hooks leak.
RUN npx vite build --mode "$BUILD_MODE" --outDir dist \
 && if [ "$BUILD_MODE" = "demo" ]; then node scripts/check-demo-bundle.mjs dist; fi

# ---- serve ----
FROM nginx:1.27-alpine AS runtime
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
