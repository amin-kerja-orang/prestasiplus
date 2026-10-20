# Staging deploy (single VPS, same origin)

One stack: nginx serves the SPA (built with `VITE_API_MODE=http`) and proxies `/api/` to the `api` container.
Browser and API share one origin, so there is no CORS and the cookie session and CSRF work. Files:
`compose.yaml` (base) + `compose.staging.yaml` (staging overlay). Never use `compose.http.yaml` on staging
(dev/e2e only: seeds demo accounts on every start and sets `COOKIE_SECURE=false`).

## Prerequisites
- A VPS with Docker Engine and the Compose plugin (v2.24 or newer, the overlay uses `!override`), at least 2 GB RAM for the build.
- A domain with TLS. HTTPS must terminate in front of the frontend nginx (Caddy, Traefik, host nginx or a cloud load balancer) and forward to `127.0.0.1:5192` with `X-Forwarded-For` and `X-Forwarded-Proto`. The container itself speaks plain http on 8080.
- The repo checked out on the VPS at the release commit.
- Env files created from the examples (never committed):
  ```
  cp .env.api.example .env.api
  cp .env.db.example .env.db
  ```

## Env values
| Where | Key | Staging value |
|---|---|---|
| overlay (fixed) | `VITE_API_MODE` | `http` (build arg set by `compose.staging.yaml`) |
| overlay (fixed) | `COOKIE_SECURE` | `true` (cannot be overridden by `.env`) |
| shell or `.env` | `TRUST_PROXY_HOPS` | `1` = only the frontend nginx; `2` = one more TLS proxy in front. A wrong value lets clients spoof their address (too high) or throttles everyone as one (too low). With 2, also add real_ip handling in `docker/frontend/nginx.conf`. |
| `.env.api` | `NODE_ENV` | `production` (the compose file sets it) |
| `.env.api` | `DATABASE_URL` | `postgresql://<user>:<password>@db:5432/<db>` matching `.env.db` |
| `.env.api` | `SESSION_SECRET`, `IC_HASH_KEY` | random, 32+ chars, different from each other (`openssl rand -hex 32`) |
| `.env.api` | `PUBLIC_BASE_URL` | `https://<staging domain>` |
| `.env.api` | `ALLOW_DEMO_SEED` | leave `false`. Demo accounts are loaded only by the explicit one-off command below, staging only. Never `true` in production. |
| `.env.api` | `BIJAK_POC_QUESTIONS` | `true` on staging only. Not on this base yet: set it when BE-15/16 merge (it is not in `env.schema.ts` here). |
| `.env.db` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | own values, random password |

## Deploy
```
git fetch && git checkout <release-commit>
docker compose -f compose.yaml -f compose.staging.yaml up -d --build --wait
```
Order is enforced: `db` healthy, then `migrate` (`prisma migrate deploy`, exits), then `api`, then `frontend`. A failed migration stops the api from starting.

Seed the staging demo accounts (STAGING ONLY, explicit and idempotent; refused by the guard unless the flag is given):
```
docker compose -f compose.yaml -f compose.staging.yaml run --rm -e ALLOW_DEMO_SEED=true migrate npm run be:db:seed
```
Demo accounts and their published password are listed in the seed docs (`apps/api/prisma/seed`). Do not run this on production; without the flag the production seed loads reference data only.

Health:
```
docker compose -f compose.yaml -f compose.staging.yaml ps
curl -fsS http://127.0.0.1:5192/healthz            # nginx
curl -fsS https://<domain>/api/health              # through TLS, nginx and the api
```

Log in with a demo account at `https://<domain>/` (credentials from the seed docs).

## Smoke checklist
- [ ] SPA loads at `https://<domain>/`; a deep link (reload on a client route) returns the app, not 404.
- [ ] `/api/health` returns OK through the domain.
- [ ] Login succeeds; the response sets `pp_session` with `HttpOnly; Secure; SameSite=Lax` (browser dev tools, Application, Cookies).
- [ ] A Bijak paper list loads for a student (needs BE-15/16 and `BIJAK_POC_QUESTIONS=true`).
- [ ] An upload under the limit works (default 10 MB; nginx allows 22 MB on `/api/files`); an oversize one is rejected cleanly.
- [ ] `docker compose ... logs api` shows structured log lines and no stack traces for the above.

## Roll back
Images are rebuilt from the checked-out commit, so roll back by redeploying the previous commit:
```
git checkout <previous-commit>
docker compose -f compose.yaml -f compose.staging.yaml up -d --build --wait
```
Migrations are forward-only. If the bad release applied a migration, restore the database backup taken before the deploy instead (take one first: see Backups). Uploads live in the `apifiles` volume and survive redeploys.

## Stop
```
docker compose -f compose.yaml -f compose.staging.yaml down        # keeps data volumes
docker compose -f compose.yaml -f compose.staging.yaml down -v     # DESTROYS database and uploads
```

## Backups
Take a dump before every deploy that carries a migration. The full backup and tested-restore procedure is BE-33 (`docs/plan/backend-tasks/BE-33-hardening-release.md`); `docs/ops/db-backup.md` is not on this base yet. Minimum until then:
```
docker compose -f compose.yaml -f compose.staging.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > backup-$(date +%F-%H%M).dump
```
Store dumps outside the repo and off the VPS.

## Security notes
- No demo seed in production: demo accounts have a published password. Production `.env.api` keeps `ALLOW_DEMO_SEED=false`.
- Staging must hold fictitious or anonymised data only. Real personal data (PDPA, including IC numbers and minors) needs the anonymiser (BE-35) or a production-grade setup with consent and retention rules.
- Secrets live only in `.env.api` and `.env.db` on the VPS (mode 600), never in the repo or in build args. `VITE_*` values are public in the bundle.
- Logs: `docker compose ... logs -f api frontend`. nginx redacts 64-hex path tokens and does not log the Referer; the API redacts the same. Do not paste logs with cookies or tokens into tickets. Docker's default json log driver has no rotation: set `log-opts` (`max-size`, `max-file`) in `/etc/docker/daemon.json`.
- Publish only the TLS proxy; the frontend port is bound to loopback and `db`/`api` publish nothing.
