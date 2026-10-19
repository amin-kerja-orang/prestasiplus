# New PC onboarding (zero to working setup)

Audience: a person or a Claude Code session on a brand-new PC. Windows 11 first; macOS/Linux differences are noted. Status legend used below: **exists** = in the repo today, **added by BE-xx** = planned by that card and not yet on the branch. Always check the card status in [backend-tracker.md](backend-tracker.md) before relying on a "planned" item.

Related: [agent-kickoff/README.md](agent-kickoff/README.md) (lane prompts), [AGENT-SYNC.md](AGENT-SYNC.md) (claim and PR rules), [sessions.md](sessions.md) (programme), [../ops/containers.md](../ops/containers.md) (Docker detail).

## 1. Prerequisites

| Tool | Version / note | Check |
|---|---|---|
| Node.js | `package.json` engines: `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`. `.nvmrc` and the Dockerfiles pin **22.22.2**; use that. | `node -v` |
| npm | The version bundled with Node 22. The lockfile is `package-lock.json`; use `npm ci`, never `npm install`, for a clean setup. | `npm -v` |
| Git | Any recent Git for Windows (includes Git Bash). | `git --version` |
| GitHub CLI `gh` | Needed for `gh pr list`, `gh pr create`, `gh issue list` (AGENT-SYNC). Authenticate once: `gh auth login`, then `gh auth status`. | `gh --version` |
| Docker Desktop | Compose v2. Required for the preview container, the compose stack, PostgreSQL and Testcontainers. Must be running before backend tests. On Windows use the WSL 2 backend. | `docker version`, `docker compose version` |
| Playwright browsers | `@playwright/test` is a dev dependency; the browsers are downloaded separately (section 8). Only needed for e2e. | `npx playwright --version` |
| Claude Code | Installed and signed in (`claude`). Project agents live in `.claude/agents/` (role definitions); there is no committed `settings.json`. | `claude --version` |
| MCP servers | Declared in `.mcp.json` and started on demand by Claude Code: `playwright`, `playwright2`, `playwright3` (browser lanes) and `nuxt-ui` (HTTP, `https://ui.nuxt.com/mcp`). They run `cmd /c npx @playwright/mcp@latest`, so they need Node and internet; approve them on first use. | `/mcp` inside Claude Code |

Node version management: Windows `nvm-windows` or `fnm` (`fnm use` reads `.nvmrc`); macOS/Linux `nvm use` or `fnm use`.

macOS/Linux differences:
- `.mcp.json` uses `cmd /c npx ...`, which only works on Windows. On macOS/Linux override locally with `command: "npx"` and `args: ["@playwright/mcp@latest", ...]`; do not commit that change (OQ-ONB-1).
- Examples below use POSIX syntax. In PowerShell use `Copy-Item` instead of `cp`, and `$env:NAME='x'` instead of `NAME=x cmd`.

## 2. Clone, branches and worktrees

```
git clone https://github.com/amin-kerja-orang/prestasiplus.git
cd prestasiplus
git fetch origin --prune
git switch feature/v2-backend
git config core.autocrlf input    # see section 8, CRLF
```

Which branch for what:

| Work | Branch base | Branch you create |
|---|---|---|
| Backend cards | `origin/feature/v2-backend` | `be/<card-id>-<slug>` (e.g. `be/BE-01-scaffold-ci`) |
| Frontend / lead work | `feature/student-prototype` (lead only) | `v2/*` (lead only) |
| Docs-only tasks | as the lead assigns | as the lead assigns |

Never push to `main`, `feature/student-prototype`, `feature/v2-backend` or `v2/*`; the lead merges PRs. The claim-by-draft-PR process, the Open list, commit/push cadence and the 5-line end report are in [AGENT-SYNC.md](AGENT-SYNC.md); follow it, it is not repeated here.

**PC name:** automatic. Run `hostname`; the agent uses `pc-` plus the lower-case computer name (for example `pc-desktop-7h2k`) and writes the tracker Owner as `<pc-name>/S<n>` (n = session number on that PC).

**Parallel sessions on one PC: use git worktrees, never switch branches in a shared folder.** A second Claude Code session in the same folder would see your half-edited files, and a `git switch` under a running session breaks it. Instead:

```
git fetch origin
git worktree add ../pp-be01 -b be/BE-01-scaffold-ci origin/feature/v2-backend
cd ../pp-be01
npm ci
```

Each worktree is a full folder with its own branch and its own `node_modules`. Remove it when the PR is merged: `git worktree remove ../pp-be01`. A branch can be checked out in only one worktree at a time. Keep worktrees outside the main repo folder; `.claude/worktrees/` is used by the Claude Code harness, do not touch it.

## 3. Install and first run (mock-only frontend, exists today)

```
npm ci                      # installs every workspace (packages/contract today; apps/api after BE-01)
npm run dev                 # Vite dev server, http://localhost:5173 (mock API in the browser, no backend needed)
```

- First load is slow because Vite transforms files on demand; the login screen appears in about 1 s and the mock data needs about 5 s after login.
- Demo login: open `/login` and use the accounts in [../AKAUN-DEMO.md](../AKAUN-DEMO.md) (fictitious accounts; the password is listed there, not repeated here).
- Mock data lives in the browser (IndexedDB). To start clean, clear site data for `localhost:5173` in the browser.

Baseline checks (must be green on a clean checkout):

| Command | What it does |
|---|---|
| `npm run contract:check` | Fails if `packages/contract/openapi.json` is stale. Fix with `npm run contract:emit`. |
| `npm run typecheck` | `vue-tsc -b --noEmit` |
| `npm run lint` | ESLint and stylelint via `scripts/lint.mjs` |
| `npm test` | Vitest unit project |
| `npm run build` | Demo build plus bundle guard |
| `npm run verify` | lint + typecheck + test + build (the lead runs this) |
| `npm run test:e2e` | Playwright on mobile/tablet/desktop; builds `dist-e2e` and serves it on port **4173** with `--strictPort`. Backend cards must not edit `e2e/**`. |
| `npm run test:e2e:module -- <module>` | Playwright for one module folder |

## 4. Environment files

Rule: copy from an example, edit locally, **never commit** `.env`, `.env.api`, `.env.db`, API keys, dumps or `.migration-out/`. Use obviously fictitious data only. Secrets are shown here by name only.

### Committed env files (exist; no secrets)

| File | Variables | Purpose |
|---|---|---|
| `.env.development` | `VITE_API_MODE=mock`, `VITE_TEST_HOOKS=true`, `VITE_MOCK_LATENCY_MS=400` | `npm run dev`. |
| `.env.demo` | `VITE_API_MODE=mock`, `VITE_TEST_HOOKS=false`, `VITE_MOCK_LATENCY_MS=400` | demo / preview builds. |
| `.env.e2e` | as demo, `VITE_TEST_HOOKS=true`, plus `VITE_PROTOTYPE_SCOPE=off`, `VITE_DATA_PROFILE=full` | `build:e2e`. |

Do not edit these for personal settings; use `.env.local` (Vite loads it; not committed) if you need a personal override.

### `.env` (compose build defaults; exists as `.env.example`, optional)

`cp .env.example .env`. The defaults work without it. `.env` is git-ignored.

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `FRONTEND_PORT` | 5192 | no | Host port of the `frontend` compose service. |
| `BUILD_MODE` | `demo` | no | Vite `--mode` for the image build. |
| `VITE_API_MODE` | `mock` | no | `mock` (in-browser) or `http` (real backend). |
| `VITE_TEST_HOOKS` | `false` | no | Must stay `false` for any shipped image. |
| `VITE_PROTOTYPE_SCOPE` | `on` | no | Prototype scope switch. |
| `VITE_MOCK_LATENCY_MS` | 400 | no | Simulated mock latency. |
| `VITE_API_BASE_URL` | empty | no | API origin in `http` mode; empty = same origin `/api`. |

All `VITE_*` values are baked into the static bundle: never put secrets in them.

### `.env.api` (added by BE-01; copy from `.env.api.example`, required for `be:dev`)

Names from [plan section 11](../architecture/v2-backend-plan.md); BE-01 owns the example file and may add keys, and the app fails fast if a required key is missing.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | yes | `development` locally. |
| `PORT` | no (3000) | API listen port. |
| `DATABASE_URL` | yes (from BE-02) | Postgres connection string; host `db` inside compose, the override port from the host. Contains a password: local only. |
| `SESSION_COOKIE_NAME` | yes | Session cookie name. |
| `SESSION_SECRET` | yes | Secret; generate locally, never share. |
| `SESSION_TTL_HOURS`, `SESSION_REMEMBER_DAYS` | no | Session lifetimes. |
| `COOKIE_DOMAIN`, `COOKIE_SECURE` | no | Cookie attributes (`COOKIE_SECURE=false` for plain-http localhost). |
| `PUBLIC_BASE_URL` | no | Public origin of the app. |
| `LOG_LEVEL` | no | pino level. |
| `FILE_STORAGE_DIR`, `MAX_UPLOAD_MB` | no | Local file storage (BE-04) and upload limit. |
| `THROTTLE_LOGIN_PER_MINUTE` | no | Login rate limit. |
| `SEED_DEMO_PASSWORD_HASH` | seed only | Hash of the demo password, not the password. |
| `CLOUD_SOURCE_URL` | migration only | Read-only source for the ETL. Collaborator PCs never receive it; work from fixtures. |
| `AI_PROVIDER` (`mock` default), `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY`, `AI_RATE_LIMIT_PER_MIN`, `AI_MONTHLY_BUDGET_SEN`, `AI_PRICE_TABLE_JSON`, `OCR_MAX_PAGES`, `OCR_WORKERS`, `OCR_PAGE_TIMEOUT_MS`, `INTAKE_MAX_FILE_MB`, `INTAKE_RETENTION_MONTHS` | intake cards only | AI intake (BE-36/37). Keep `AI_PROVIDER=mock` unless the lead gives you a key; `AI_API_KEY` is a secret. |

### `.env.db` (added by BE-02; copy from `.env.db.example`)

`POSTGRES_USER`, `POSTGRES_PASSWORD` (secret, local only), `POSTGRES_DB`. Read by the compose `db` service.

## 5. Docker

### 5.1 Preview container `pretasiplus-preview` (exists)

Rule: preview the prototype **only** through this Docker container, never through a long-running background `vite`/`node` server, and never leave stray servers running. Stop what you started.

```
# 1. build the static bundle (PowerShell: set the variables with $env:NAME='x' first)
VITE_PROTOTYPE_SCOPE=on VITE_API_MODE=mock VITE_TEST_HOOKS=false npx vite build --mode demo --outDir dist-preview
# 2. start
docker compose -f docker-compose.preview.yml up -d      # container pretasiplus-preview, nginx 1.27, http://localhost:5191
# 3. after a rebuild just refresh the browser; the bundle is mounted read-only
# 4. stop
docker compose -f docker-compose.preview.yml down       # or Stop in Docker Desktop
```

Then open `http://localhost:5191/login`. Note: [AKAUN-DEMO.md](../AKAUN-DEMO.md) says to read the port from the compose file; it is 5191.

### 5.2 Compose stack (`compose.yaml`)

| Service | Today | Planned |
|---|---|---|
| `frontend` | **exists.** Multi-stage `docker/frontend/Dockerfile` (node 22.22.2-alpine build, nginx 1.27-alpine serve), read-only rootfs, container port 8080, host `${FRONTEND_PORT:-5192}`, health at `/healthz`. | BE-32 adds the `/api/` proxy to `api:3000` and an http-mode build overlay. |
| `api` | commented placeholder | **added by BE-01** (`docker/api/Dockerfile`, port 3000, `.env.api`); `depends_on: db` healthy from BE-02. |
| `db` | commented placeholder | **added by BE-02**: `postgres:16-alpine`, named volume `pgdata`, healthcheck, **no host port**, `.env.db`. |
| `migrate` job | none | **added by BE-32** (`prisma migrate deploy`, optional seed, before `api`). |

Commands (exist for `frontend`):

```
docker compose build
docker compose up -d            # http://localhost:5192
docker compose down             # keeps volumes
docker compose down -v          # also deletes pgdata (database reset, after BE-02)
```

Ports already used on the lead's PC (avoid them): 5173, 5191, 5432, 5433, 6380, 8080, 8081. Check yours before starting anything (section 7). To reach Postgres from a host tool, copy `compose.override.example.yaml` (**added by BE-02**) to the git-ignored `compose.override.yaml`; it maps `127.0.0.1:${DB_HOST_PORT:-5434}:5432`.

Resetting the database: `npm run be:db:reset` (dev only; refuses when `NODE_ENV=production`; **added by BE-02**), or `docker compose down -v` then `docker compose up -d db` and `npm run be:db:migrate`.

## 6. Backend dev loop (after BE-01 and BE-02 are merged)

Today `package.json` has **no** `be:*` scripts and `workspaces` is only `["packages/*"]`; BE-01 adds `apps/*` and the scripts. Verified against `package.json` on this branch:

| Script | Status | Meaning |
|---|---|---|
| `contract:emit`, `contract:check` | exists | Regenerate / verify `openapi.json`. |
| `be:dev` | added by BE-01 | `nest start --watch` for `@pp/api` against the compose `db`. |
| `be:build`, `be:lint`, `be:typecheck` | added by BE-01 | Build, ESLint, `tsc --noEmit` for the API. |
| `be:test` | added by BE-01 (integration part needs BE-02) | Unit and integration tests; needs Docker for Testcontainers. |
| `be:db:migrate` | added by BE-02 | `prisma migrate deploy`. |
| `be:db:seed` | added by BE-02 (runner); domain seeds by their cards | Deterministic, idempotent seed. |
| `be:db:reset` | added by BE-02 | Dev-only reset. |
| `be:verify` | added by BE-01 | contract:check + lint + typecheck + test + build; the Definition of Done command. |
| `test:e2e:http` | added by BE-32 | Playwright against the real stack (`playwright.http.config.ts`). |

Typical loop once available:

```
cp .env.api.example .env.api      # then edit locally; never commit
cp .env.db.example .env.db
docker compose up -d db
npm run be:db:migrate
npm run be:dev                    # API on http://localhost:3000, GET /api/health
npm run be:verify                 # before every push; paste real output into the PR
```

Adding a Prisma migration: edit the module's `.prisma` file under `apps/api/prisma/schema/`, create the migration, commit the SQL. Never edit a merged migration; after a rebase conflict delete your own unmerged migration folder and regenerate it ([sessions.md](sessions.md) sections 5 and 6). Add dependencies only with `npm install -w @pp/api <pkg>`. If you change a contract schema, run `npm run contract:emit` and commit `openapi.json` (never hand-merge it).

CI does not exist yet: `.github/workflows/api.yml` is **added by BE-01**. There is no `.github/` folder today.

## 7. Multi-session safety

- **Check ports first.** Windows: `netstat -ano | findstr :5173` (then `tasklist /FI "PID eq <pid>"`). macOS/Linux: `lsof -i :5173`. Port 5173 may belong to another session. Vite falls back to the next free port, so read the URL it prints.
- **Never kill all `node.exe`** (or all Playwright/vite). Other sessions and servers depend on them. Stop only the process or container you started, by PID or by container name.
- **No hidden processes.** Do not leave dev servers or containers running when you finish; stop them.
- **Scratchpad subfolders.** Parallel agents share one scratchpad directory. Keep scripts and temp files in your own subfolder (for example `<scratchpad>/be01/`) and run scripts only from there.
- **Playwright lanes.** Three separate browsers: `mcp__playwright__*` (lane 1, keeps a saved login), `mcp__playwright2__*` and `mcp__playwright3__*` (lanes 2 and 3, isolated, no saved login; output in `.playwright-mcp/lane2`, `lane3`). One agent per lane, never two on one lane. `.playwright-mcp/` is git-ignored.
- **Shared tree.** Do not switch branches in a folder another session uses (use worktrees, section 2). Never leave half-done edits in a shared folder.
- **Live sites are read-only**, and credentials never enter the repo, PRs or chat. Collaborator PCs never receive .cloud credentials or real data.

## 8. Common errors and fixes

| Symptom | Cause and fix |
|---|---|
| `EADDRINUSE` / "Port 4173 is already in use" during `npm run test:e2e` | `vite preview --strictPort` on 4173 is taken, probably by another session's e2e run. Find the owner (section 7) and wait, or stop only your own process. Never kill all node. |
| Dev server starts on 5174 instead of 5173 | 5173 is taken; use the URL Vite prints. |
| `npm ci` fails with "Unsupported engine" or odd native errors | Wrong Node. `node -v` must match engines (use 22.22.2 from `.nvmrc`), then delete `node_modules` and rerun `npm ci`. |
| "Cannot connect to the Docker daemon" / `docker compose` hangs on Windows | Docker Desktop is not running or WSL 2 is not ready. Start Docker Desktop, wait for "Engine running", retry. Testcontainers tests need it too. |
| `@prisma/client` did not initialize / "Prisma client not generated" (after BE-02) | Run the Prisma generate step for `@pp/api` (the install usually does this; if not: `npx prisma generate --schema apps/api/prisma/schema` from the repo root, or the `be:*` script BE-02 provides) and rerun. |
| `contract:check` fails | `openapi.json` is stale: `npm run contract:emit` and commit it. On a merge conflict regenerate; do not hand-edit. |
| `be:test` cannot start Postgres | Docker not running, or the image pull is blocked by a proxy. Pull `postgres:16-alpine` manually; as a fallback point `DATABASE_URL` at the compose `db` (plan section 3). |
| Lint/format failures on every file, or `git diff` shows whole files changed (CRLF) | Windows autocrlf rewrote line endings. The repo expects LF (`.editorconfig` `end_of_line = lf`; `.gitattributes` forces LF only for `openapi.json`). Set `git config core.autocrlf input` and make your editor save LF. A CRLF `openapi.json` makes `contract:check` fail. |
| "Filename too long" on checkout or `npm ci` (Windows) | `git config --global core.longpaths true`; enable Windows long paths (registry `LongPathsEnabled=1`, admin) and keep the clone near the drive root, for example `D:\Dev Projects\prestasiplus`. |
| "Executable doesn't exist" / browser not found in Playwright | Run `npx playwright install chromium` (the config only uses Chromium). On Linux add `--with-deps`. |
| `gh: To get started with GitHub CLI, please run: gh auth login` or a 404 on the repo | Run `gh auth login` (HTTPS, browser), then `gh auth status`; ask the lead for repo access if 404 persists. |
| Login works in the browser but API calls fail with 401/403 after BE-03 | Cookies are `HttpOnly; SameSite=Lax` and same-origin only. Use the Vite proxy (`npm run dev` plus `be:dev`, BE-32) or the compose stack on one origin; do not open the API port directly from the SPA. With `COOKIE_SECURE=true` on plain-http localhost the browser drops the cookie: set it to `false` locally. |
| `npm`/`npx` or Docker pulls fail behind a corporate proxy | Set `HTTPS_PROXY`/`HTTP_PROXY` for the shell, `npm config set proxy`/`https-proxy`, and the proxy in Docker Desktop settings. Playwright MCP also needs internet to fetch `@playwright/mcp@latest`. |
| Docker build is huge or slow | Context is trimmed by `.dockerignore`; make sure `dist-*`, `node_modules` and `test-results*` are not tracked. A cold frontend build takes about 2 minutes. |
| Playwright MCP "browser already in use" | Two agents share one lane. Use a different lane (section 7). |

## 9. Where to go next

- Backend handbook: [backend-dev-guide.md](backend-dev-guide.md)
- Frontend handbook: [frontend-dev-guide.md](frontend-dev-guide.md) (being written)
- Frontend/backend integration: [fullstack-integration-guide.md](fullstack-integration-guide.md) (being written)
- Test strategy: [../qa/v2-test-strategy.md](../qa/v2-test-strategy.md) (being written)
- API catalogue: [../architecture/v2-api-catalogue.md](../architecture/v2-api-catalogue.md) (being written)
- Data model: [../architecture/v2-data-model.md](../architecture/v2-data-model.md) (being written)
- Backend plan: [../architecture/v2-backend-plan.md](../architecture/v2-backend-plan.md) (stack, layout, config, migration-first rules)
- Claim a card: [AGENT-SYNC.md](AGENT-SYNC.md), tracker [backend-tracker.md](backend-tracker.md), cards in [backend-tasks/](backend-tasks/README.md)
- Containers detail: [../ops/containers.md](../ops/containers.md); demo accounts: [../AKAUN-DEMO.md](../AKAUN-DEMO.md)

## 10. Open questions

| ID | Question | Suggested owner |
|---|---|---|
| OQ-ONB-1 | `.mcp.json` hard-codes `cmd /c npx`, which fails on macOS/Linux. Provide a per-OS config or a committed `.mcp.json` that works on both? | devops / lead |
| OQ-ONB-2 | `.gitignore` ignores only `.env`; `.env.api`, `.env.db` and `compose.override.yaml` are to be added by BE-01/BE-02. Should the lead add them now so no PC can commit them by accident? | lead |
| OQ-ONB-3 | `.dockerignore` excludes `.env.*` except demo/development, but `.env.e2e` is tracked; confirm that is intended. | devops |
| OQ-ONB-4 | Confirm the Prisma generate command and whether `postinstall` runs it, once BE-02 lands (section 8 row is provisional). | BE-02 owner |
| OQ-ONB-5 | Pin an `.gitattributes` `* text=auto eol=lf` for all text files so CRLF problems cannot occur regardless of `core.autocrlf`? | lead |
| OQ-ONB-6 | The package.json engines allow Node 24/26 but all Docker images pin 22.22.2; should contributors be told to use 22.22.2 only (as written here)? | lead |
| OQ-ONB-7 | No committed Claude Code `settings.json`/permission allowlist exists; should one be added to cut permission prompts for new PCs? | lead |
