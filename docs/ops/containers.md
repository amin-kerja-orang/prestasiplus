# Containers (v2)

The v2 frontend ships as a container image. This is release prep (G6); nothing is deployed from here yet.

## Files

| File | Purpose |
|---|---|
| `docker/frontend/Dockerfile` | Multi-stage: `node:22.22.2-alpine` builds with `npm ci` + `vite build`, then `nginx:1.27-alpine` serves `dist`. |
| `docker/frontend/nginx.conf` | SPA fallback, gzip, immutable cache for `/assets/`, `no-cache` for `index.html`, security headers, `/healthz`. |
| `compose.yaml` | `frontend` service (active) and commented `api` / `db` placeholders. |
| `functions/api/[[path]].ts`, `render.yaml` | Cloudflare Pages proxy and Render blueprint (primary staging path). See `docs/ops/deploy-staging.md`. |
| `compose.staging.yaml` | Staging overlay (http build, Secure cookie, loopback port). See `docs/ops/deploy-staging.md`. |
| `.env.example` | Compose/build defaults. Copy to `.env` (git-ignored) to override. No secrets. |
| `.dockerignore` | Keeps `node_modules`, `.git`, `.claude`, test output, `dist*`, docs and e2e out of the build context. |
| `docker-compose.preview.yml` | Older local preview (host-built `dist-preview`, port 5191). Unchanged and still works. |

## Build and run locally

```
docker compose build
docker compose up -d        # http://localhost:5192
docker compose down
```

Host port 5192 is the default (`FRONTEND_PORT`). Already in use on the dev PC: 5173, 5191, 5432, 5433, 6380, 8080, 8081.
The container listens on 8080 as the unprivileged `nginx` user, with a read-only root filesystem and `/tmp` as tmpfs.
Health check: `GET /healthz` returns `200 ok`.

Image size (demo build): about 96 MB. A cold build takes about 2 minutes; later builds reuse the npm cache and layers.

## Build args

Set them in `.env` or on the command line. All `VITE_*` values are baked into the static bundle, so never put secrets in them.

| Arg | Default | Meaning |
|---|---|---|
| `BUILD_MODE` | `demo` | Vite `--mode`. `demo` also runs `scripts/check-demo-bundle.mjs` and fails the build if test hooks leak. |
| `VITE_API_MODE` | `mock` | `mock` = in-browser mock API (prototype). `http` = real backend. |
| `VITE_TEST_HOOKS` | `false` | Must stay `false` for any shipped image. |
| `VITE_PROTOTYPE_SCOPE` | `on` | Prototype scope switch. |
| `VITE_MOCK_LATENCY_MS` | `400` | Simulated mock latency. |
| `VITE_API_BASE_URL` | empty | API origin for `http` mode. Empty = same origin (`/api`). |

Example for the real API later: `VITE_API_MODE=http BUILD_MODE=production docker compose build`
(add a `.env.production` first if mode-specific values are needed).

Type-check, lint and unit tests are not run inside the image build; they belong to CI (`npm run verify`).

## Adding the backend and database later

`compose.yaml` holds commented `api` (NestJS, `docker/api/Dockerfile`, port 3000, `env_file: .env.api`) and `db` (`postgres:16-alpine`, named volume `pgdata`, `pg_isready` healthcheck, no host port) services.
When the backend exists:

1. Uncomment both, create `docker/api/Dockerfile`, and keep `.env.api` / `.env.db` out of git (secrets come from the platform secret store in deploy).
2. Add a `location /api/ { proxy_pass http://api:3000; }` block to `docker/frontend/nginx.conf` so the SPA and API share one origin.
3. Build the frontend with `VITE_API_MODE=http`.
4. Run migrations as a one-off job before the API starts (see ADR-0015..0018 and `docs/architecture/v2-data-migration.md`).

## Database migrations (BE-03)

`compose.yaml` has a one-shot `migrate` service. It is built from the `build` stage of `docker/api/Dockerfile` (the runtime image has no Prisma CLI, which is a devDependency), runs `npm run be:db:migrate` (`prisma migrate deploy`) as the `node` user with a read-only root filesystem and `/tmp` as tmpfs, then exits. It reads `DATABASE_URL` from `.env.api`.
`api` has `depends_on: migrate: condition: service_completed_successfully`, so a failed migration keeps the API from starting.

```
docker compose up -d --build db migrate api
docker compose logs migrate        # applied migrations
```

Re-running is safe: `migrate deploy` only applies pending migrations.
