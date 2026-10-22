# Containers (v2)

The v2 frontend ships as a container image. This is release prep (G6); nothing is deployed from here yet.

## Files

| File | Purpose |
|---|---|
| `docker/frontend/Dockerfile` | Multi-stage: `node:22.22.2-alpine` builds with `npm ci` + `vite build`, then `nginx:1.27-alpine` serves `dist`. |
| `docker/frontend/nginx.conf` | SPA fallback, gzip, immutable cache for `/assets/`, `no-cache` for `index.html`, security headers, `/healthz`, and the `/api/` proxy to the API (see "nginx /api proxy"). |
| `compose.yaml` | Project `pretasiplus`: `frontend` (nginx + SPA), `api` (NestJS), `migrate` (one-shot) and `db` (PostgreSQL 16). Defaults to the mock build of the SPA. |
| `compose.http.yaml` | Dev and e2e overlay: SPA built for the real API, demo seed, e2e-friendly API settings. See "Real-API stack (BE-32)". Never for production. |
| `playwright.http.config.ts` | Playwright config for e2e against the real stack. See "Real-API stack (BE-32)". |
| `functions/api/[[path]].ts`, `render.yaml` | Cloudflare Pages proxy and Render blueprint (primary staging path). See `docs/ops/deploy-staging.md`. |
| `compose.staging.yaml` | Staging overlay (http build, Secure cookie, loopback port). See `docs/ops/deploy-staging.md`. |
| `.env.example` | Compose/build defaults. Copy to `.env` (git-ignored) to override. No secrets. |
| `.dockerignore` | Keeps `node_modules`, `.git`, `.claude`, test output, `dist*`, docs and e2e out of the build context. |
| `docker-compose.preview.yml` | Older local preview (host-built `dist-preview`, port 5191). Mock only, no `/api` proxy and no fixed `container_name`. Still works. |

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

## Services in `compose.yaml`

| Service | Image / build | Notes |
|---|---|---|
| `frontend` | `docker/frontend/Dockerfile` | nginx on 8080 in the container, host port `FRONTEND_PORT` (default 5192). Read-only root, `/tmp` tmpfs. Proxies `/api/` to `api:3000`. |
| `api` | `docker/api/Dockerfile` | No host port (only `expose: 3000`). `NODE_ENV=production`, `TRUST_PROXY_HOPS=1` fixed in the file. Uploads live in the `apifiles` volume. Waits for `db` (healthy) and `migrate` (completed). Reads secrets from `.env.api` (git-ignored; copy `.env.api.example`). |
| `migrate` | `build` stage of `docker/api/Dockerfile` | One-shot `prisma migrate deploy` (see "Database migrations"). The base file never seeds. |
| `db` | `postgres:16-alpine` | No host port (5432 and 5433 are taken on the dev PC). Volume `pgdata`. `pg_isready` healthcheck. Reads `.env.db` (git-ignored). For local tooling use an uncommitted `compose.override.yaml` (see `compose.override.example.yaml`). |

Env variable names only are documented here; values live in `.env.api`, `.env.db` and the platform secret store.

## Real-API stack (BE-32)

`compose.http.yaml` is an overlay for DEV and E2E. It changes three services compared with `compose.yaml`:

- `frontend`: built with `BUILD_MODE=production`, `VITE_API_MODE=http`, `VITE_TEST_HOOKS=false`, empty `VITE_API_BASE_URL` (same origin, so the session cookie is same-site and no CORS is configured). Image tag `pretasiplus-frontend:http`.
- `migrate`: runs `npm run be:db:migrate && npm run be:db:seed` with `ALLOW_DEMO_SEED=true`, so the demo accounts (published password) exist. Re-running is idempotent (`migrate deploy` plus upserting seeds). Production never sets this variable; staging sets it only for the explicit one-off seed command (`docs/ops/deploy-staging.md`, `docs/ops/demo-reseed.md`).
- `api`: `COOKIE_SECURE` (default `false`, plain http on localhost), `THROTTLE_LOGIN_PER_MINUTE` from `E2E_THROTTLE_LOGIN_PER_MINUTE` (default 200, because e2e logs in many times from one address) and `BIJAK_POC_QUESTIONS=true`.

```
npm run stack:up       # docker compose -f compose.yaml -f compose.http.yaml up -d --build --wait
npm run stack:down     # docker compose -f compose.yaml -f compose.http.yaml down
```

Ports: only the frontend is published (`FRONTEND_PORT`, default 5192). `api` and `db` are reachable inside the compose network only.
Do not combine this overlay with `compose.staging.yaml`.

E2E against this stack lives in `playwright.http.config.ts` (`npm run test:e2e:http -- --grep @api`). Base URL is `BASE_URL`, else `http://localhost:${FRONTEND_PORT:-5192}`. With `E2E_HTTP_START_STACK=1` Playwright starts the stack itself (`docker compose -f compose.yaml -f compose.http.yaml up --build`).
The `@api` tests that need the SPA's HTTP transport (hybrid mode) are not covered by this file yet (BE-32 AC3, tracked in `docs/plan/backend-tracker.md` row BE-32 and requested from half AZ on #109).

## nginx /api proxy

`docker/frontend/nginx.conf` proxies `/api/` to `http://api:3000`. The name is resolved at request time through Docker DNS (`resolver 127.0.0.11`), so the image also starts in the mock compose where no `api` container exists (requests to `/api/` then fail with a gateway error: a 502 in the check below). Outside Docker, change the resolver or use a fixed upstream.

| Topic | Behaviour |
|---|---|
| Body limits | `/api/`: `client_max_body_size 3m` (JSON and the 2200kb imports). `= /api/files`: `22m`, `client_body_timeout 120s`, `proxy_request_buffering on`. The API enforces each purpose itself (`MAX_UPLOAD_MB`, `INTAKE_MAX_FILE_MB`, JSON 100kb); nginx is the outer fence. If either env value is raised, raise the 22m (value plus about 2m multipart overhead). A new multipart route needs its own `location` like `/api/files`. |
| Oversize body | nginx answers 413 in the API error envelope (next section), not its HTML page. |
| Timeouts | `/api/`: connect 5s, send 60s, read 120s. `/api/files`: send and read 300s. |
| Forwarded headers | `Host`, `X-Real-IP`, `X-Forwarded-For` (appended), `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Request-Id` (nginx `$request_id`). `Connection` is cleared for upstream keep-alive. |
| `TRUST_PROXY_HOPS=1` | Matches this single proxy hop: the API reads the last `X-Forwarded-For` entry (the address nginx saw), which a client cannot choose. Behind a further load balancer set 2 and add real_ip handling in nginx.conf (`docs/ops/deploy-staging.md`). |
| Log redaction | The access log writes `$log_request`, where any 64-hex path segment (a parent invite token, 256 bit) becomes `[redacted]`. The `Referer` is not logged at all, because an SPA page URL can carry the same token. The API's own logs redact the token after `parent-invites/` (`apps/api/src/common/logging/logging.ts`). |
| Caching | None: no `proxy_cache`; the API sends `no-store` on session and CSRF responses. |

### 413 JSON envelope

When nginx itself rejects a body over `client_max_body_size`, it answers with the API error envelope (`ErrorBodySchema` in `packages/contract`), so the SPA transport can parse it. Status 413, `Content-Type: application/json`, `Cache-Control: no-store`, plus the same security headers as the rest of the server block.

| Route | Body |
|---|---|
| `/api/` (over 3m) | `{"error":{"code":"PAYLOAD_TOO_LARGE","message":"Data terlalu besar.","requestId":"<nginx request id>"}}` |
| `/api/admin/students/import` (over 3m) | `{"error":{"code":"PAYLOAD_TOO_LARGE","message":"Fail import melebihi had yang dibenarkan.","requestId":"<nginx request id>"}}`: the route's own contract copy (`StudentImportTooLargeSchema`), chosen by a `map $uri` in nginx.conf. A new route whose contract fixes its own 413 message needs a line in that map. |
| `/api/files` (over 22m) | `{"error":{"code":"PAYLOAD_TOO_LARGE","message":"Fail terlalu besar.","requestId":"<nginx request id>"}}` |

Source: the code is the API's (`AllExceptionsFilter` maps any body-parser 413 to `PAYLOAD_TOO_LARGE`; the contract lists it for the 413 responses that "nginx may answer first"). The message for JSON bodies is the contract's `INTAKE_MESSAGES.payloadTooLarge`; the upload message is the one used by the Pages worker (`deploy/pages-direct/_worker.js`). The worker uses code `VALIDATION_ERROR` for the same condition, which differs from the API; the API's code is followed here, and the worker is left as is. The API's own generic 413 message is English ("Payload Too Large."); nginx uses BM because the message is shown to the user.
Smaller oversize uploads (up to 22m) reach the API, which answers 422 `VALIDATION_ERROR` with a per-purpose size message in `fields.file`.
Status: checked on 2026-10-22 with nginx 1.24.0 outside Docker (the same `nginx.conf`, with only the listen port, pid, log and temp paths changed): `nginx -t` passes; a 3.2 MB POST to `/api/health` and a 23.5 MB POST to `/api/files` both answer `413` with `Content-Type: application/json`, `Cache-Control: no-store`, the security headers and the envelope above; a 3.2 MB POST to `/api/files` (under its 22m limit) and a small POST to `/api/health` pass the limit and reach the proxy (502 there, because no API ran). Still to run once on a Docker host with the shipped image (nginx 1.27): `docker compose build && docker compose up -d`, then the same oversize POST against `http://localhost:5192/api/health`.

## Parallel stacks (`-p`)

No service sets `container_name` (also not `docker-compose.preview.yml`), so each compose project gets its own container, network and volume names. Run a second stack under another project name and another host port:

```
FRONTEND_PORT=5292 docker compose -p pp-feature-x -f compose.yaml -f compose.http.yaml up -d --build --wait
docker compose -p pp-feature-x -f compose.yaml -f compose.http.yaml ps
FRONTEND_PORT=5292 docker compose -p pp-feature-x -f compose.yaml -f compose.http.yaml down -v   # -v also removes this project's pgdata and apifiles
```

`-p` (or `COMPOSE_PROJECT_NAME`) wins over the `name:` in the file. Containers are `<project>-<service>-1`, for example `pp-feature-x-api-1`. Always refer to services by name in `docker compose` commands, not by container name. Caveats: the image tags (`pretasiplus-frontend:http`, `pretasiplus-api:local`, `pretasiplus-api-migrate:local`) are shared between projects, so a rebuild in one project retags the image the other started from (running containers are not affected); `FRONTEND_PORT` must differ per stack; `playwright.http.config.ts` points at `BASE_URL` / `FRONTEND_PORT`, so set the same values for the e2e run. The preview file can be run twice the same way (`-p`), with a different host port edited in a copy of the file.

## Database migrations (BE-03)

`compose.yaml` has a one-shot `migrate` service. It is built from the `build` stage of `docker/api/Dockerfile` (the runtime image has no Prisma CLI, which is a devDependency), runs `npm run be:db:migrate` (`prisma migrate deploy`) as the `node` user with a read-only root filesystem and `/tmp` as tmpfs, then exits. It reads `DATABASE_URL` from `.env.api`.
`api` has `depends_on: migrate: condition: service_completed_successfully`, so a failed migration keeps the API from starting.

```
docker compose up -d --build db migrate api
docker compose logs migrate        # applied migrations
```

Re-running is safe: `migrate deploy` only applies pending migrations.
