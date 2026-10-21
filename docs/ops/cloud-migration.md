# Moving the team to Claude Code in the cloud

Status: DRAFT for LEAD review (2026-10-21). Docs only; nothing here has been run. Branch `docs/cloud-migration`.

Audience: the LEAD (Amin), Group B (Azarul) and one new member. Roles and names follow `docs/plan/AGENT-SYNC.md` (the HANDOFF notice names "Amin, Azarul, +1"; GitHub handles `@aminfaudzi` and `@azarulhakim` appear in the same file).

Convention: each fact taken from the official docs carries its URL. Anything the docs do not state is marked **Perlu pengesahan** (needs confirming by a real test in a cloud session). Never put a secret, password, token, private URL or connection string in this file.

Official pages used:

- [CC-WEB] https://code.claude.com/docs/en/claude-code-on-the-web
- [CC-ENV] https://code.claude.com/docs/en/cloud-environments
- [CC-QS] https://code.claude.com/docs/en/web-quickstart

## 1. One-time setup

### 1.1 Requirements

| Item | Requirement | Source |
|---|---|---|
| Plan | Cloud sessions are available on Pro, Max and Team plans, and for Enterprise users with premium seats or Chat + Claude Code seats | [CC-WEB] |
| Login | A claude.ai account. API-key login or Bedrock/Vertex does not work for `--cloud` / `--teleport` (run `claude auth login`) | [CC-WEB] |
| Org policy (Team/Enterprise) | `allow_remote_sessions` must be on; an Owner turns on the GitHub connector at Organization settings > Connectors | [CC-WEB], [CC-QS] |
| Repo host | GitHub only for clone and PR creation. The repo is `amin-kerja-orang/prestasiplus` (private) | [CC-WEB] |
| Usage | Cloud sessions share rate limits with all other Claude usage of the account; no separate VM charge. Parallel sessions use limits proportionally | [CC-WEB] |
| Which plan the team has | Perlu pengesahan (not stated in the repo) | - |

### 1.2 GitHub access for the private repo

Two documented methods ([CC-WEB] "GitHub authentication options", [CC-QS] "Connect GitHub"):

| Method | Steps | Notes |
|---|---|---|
| A. Claude GitHub App (recommended for the team) | The repo owner installs the app at https://github.com/apps/claude/installations/new on the account/org that owns `amin-kerja-orang/prestasiplus`, with repository access that includes it. An org owner may need to approve | A private repo shows up in the picker only when the app is installed and its access includes the repo. Also enables Auto-fix on PRs |
| B. `/web-setup` | In the CLI: `gh auth login`, then `/login` (claude.ai account), then `/web-setup`; confirm sending the `gh` token | Sessions then reach any repo that token can reach. Stored encrypted with the person's Claude account. On Team/Enterprise the command is hidden until an Owner turns on Quick setup. Remove via claude.ai/customize/connectors |

Who does what:

1. Repo owner (Amin): install the Claude GitHub App on the repo (method A). Anyone else who prefers method B does it for themselves.
2. Each person: sign in at https://claude.ai/code with their own claude.ai account, complete "Sign in with GitHub", and confirm `amin-kerja-orang/prestasiplus` appears in the repository selector.
3. Each person needs their own GitHub write access to the repo (collaborator). Whether the cloud push uses the person's own GitHub identity or the app: Perlu pengesahan. The docs say sessions "can push back ... only when your GitHub connection has push access" ([CC-WEB], bundle section).
4. Branch rule carries over from `AGENT-SYNC.md`: work on `be/*` or `fe/*` branches; only the LEAD pushes to `feature/v2-backend`.

## 2. The cloud environment

Create one environment per person (named e.g. `pp-backend`), or, if the plan allows it, one organization-shared environment created by an Owner so all three get the same settings ([CC-ENV] "Organization-shared environments", Team/Enterprise Owners only).

### 2.1 Network access level

| Level | Meaning | Source |
|---|---|---|
| None | No outbound access through the session network | [CC-ENV] |
| Trusted (default) | Allowlisted domains only: package registries (npm, PyPI, ...), GitHub, cloud SDKs, Docker Hub | [CC-ENV] |
| Full | Any domain | [CC-ENV] |
| Custom | Own domain list, optionally plus the defaults | [CC-ENV] |

Recommendation: Trusted. It covers `npm ci` and Docker Hub images (Postgres, Redis) per [CC-ENV] "Default allowed domains". The Prisma engine binary download host and any `npm` postinstall download hosts: Perlu pengesahan (if `npm ci` fails on a download, add that host through Custom).

### 2.2 Install dependencies

The docs give two mechanisms ([CC-ENV] "Setup scripts" and "Install dependencies with a SessionStart hook"):

| | Setup script | SessionStart hook |
|---|---|---|
| Where | Environment dialog, "Setup script" field | `.claude/settings.json` committed to the repo |
| When | Before Claude starts; skipped when a cached environment exists. Cached only if it finishes in roughly 5 minutes; cache rebuilds when the script or allowed hosts change, and after about 7 days | After Claude starts, on every session including resumed |
| Use for | Toolchains, large downloads, `docker compose pull` | Project install such as `npm` (also runs locally unless gated by `CLAUDE_CODE_REMOTE`) |

Setup script (paste into the environment dialog; Bash). This is our adaptation of the docs pattern, using `npm ci` instead of the docs' `npm install`:

```bash
#!/bin/bash
set -x
cd "$PWD" || exit 1
# Repo is already cloned; install exactly from the lockfile.
npm ci
# Optional warm-up of images used by compose/e2e (keep total under ~5 min):
# docker compose -f compose.yaml -f compose.http.yaml pull || true
```

Whether the setup script's working directory is the repo root: Perlu pengesahan. Safer: put the logic in a committed script and have the hook below call it.

SessionStart hook (the exact shape from [CC-ENV]; the LEAD commits both files in a separate change, not in this docs task):

`.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR\"/scripts/cloud-install.sh"
          }
        ]
      }
    ]
  }
}
```

`scripts/cloud-install.sh`

```bash
#!/bin/bash
# Cloud sessions only: the VM sets CLAUDE_CODE_REMOTE=true, never true locally.
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR" || exit 1
hashes=node_modules/.cloud_install.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if npm ci; then
    # Workspaces: hash every manifest that npm ci reads (docs note).
    sha256sum scripts/cloud-install.sh package.json package-lock.json \
      apps/*/package.json packages/*/package.json > "$hashes" || rm -f "$hashes"
  fi
fi
exit 0
```

Notes:

- Hook timeout is 600 s unless `timeout` is set on the hook entry ([CC-ENV] "Time limits").
- A session with several repositories does not load repo hooks; use the setup script then ([CC-ENV]). We use one repo per session.
- The repo already has a `.claude/` folder (agents). Merge the hook into any existing `.claude/settings.json` rather than replacing it.
- Docker/package/Node versions: the image has Node 20, 21 and 22 and npm. Which Node the repo needs: check the `engines` field in `package.json`; selecting a version in the VM: Perlu pengesahan.

### 2.3 Postgres for the API tests

Facts from [CC-ENV] "Installed tools" and "Run tests, start services": PostgreSQL 16 and Redis 7.0 are pre-installed but not running by default; start with `service postgresql start`. Docker (docker, dockerd, docker compose) is available; Docker Hub is on the Trusted allowlist. The environment cache keeps files (pulled images) but not running processes, so start the DB every session.

Repo fact (`apps/api/test/support/global-setup.ts`, lines 46-52): the comment says "`TEST_DATABASE_URL` (CI service container) wins over Testcontainers", the code reads `let adminUrl = process.env.TEST_DATABASE_URL ?? ''` and creates `const template = \`pp_tpl_${randomBytes(6).toString('hex')}\``. Only when `adminUrl` is empty does it start `new PostgreSqlContainer('postgres:16-alpine')`. If neither works it fails with "Test database unavailable (start Docker or set TEST_DATABASE_URL)". Because the template DB name is random per run, a shared server is safe for sequential runs.

Recommended path (no Docker-in-Docker dependency):

```bash
service postgresql start
# Make a role the tests can use. The tests create and drop databases, so the role needs CREATEDB (superuser is simplest).
# Placeholder form; choose your own role name and do not commit it:
export TEST_DATABASE_URL='postgresql://<user>@localhost:5432/postgres'
npm run be:test -- <path-to-one-spec>
```

Perlu pengesahan: the default authentication (peer vs trust vs password) of the VM's PostgreSQL, the exact `sudo -u postgres createuser ...` command that works, and whether a password is needed in the URL. If a password is needed, put it in the environment's variables (section 3), never in the repo.

Fallback: leave `TEST_DATABASE_URL` unset and let Testcontainers start `postgres:16-alpine`. Perlu pengesahan: the docs say Docker is available but do not mention Testcontainers or the Docker socket permissions.

### 2.4 VM limits and splitting long commands

| Limit | Value | Source |
|---|---|---|
| Compute | About 4 vCPUs, 16 GB RAM, 30 GB disk (approximate ceilings, may change). The VM may stop tasks needing significantly more memory | [CC-ENV] "Resource limits" |
| Foreground command | 2 minutes by default; Claude can ask for up to 10 minutes. At the timeout the command moves to the background (not killed; unless it starts with `sleep`) and may run up to 30 more minutes | [CC-ENV] "Time limits" |
| Raise timeouts | Add `BASH_DEFAULT_TIMEOUT_MS` and `BASH_MAX_TIMEOUT_MS` (milliseconds) to the environment variables, e.g. `BASH_DEFAULT_TIMEOUT_MS=600000` | [CC-ENV] "Time limits" |
| Setup script | Cached only if it finishes in about 5 minutes | [CC-ENV] |
| Idle | The VM pauses after a few minutes idle and is restored on the next message; a paused VM can be reclaimed, and reopening gives a fresh VM. Conversation history is restored; background processes are not | [CC-ENV], [CC-WEB] "Environment expired" |

The ~4 vCPU / 16 GB figure matches the lead's note. Compare with the old PC: a full `be:verify` took long locally (4982 tests in the batch3 note), so expect it to be slow on 4 vCPUs.

Splitting (`package.json` scripts, verified in the worktree):

| Script | Runs |
|---|---|
| `be:typecheck` | `npm run typecheck -w @pp/api` |
| `be:lint`, `be:lint:migration`, `be:build` | lint, migration lint, build of `@pp/api` |
| `be:test` | `npm run test -w @pp/api --` (pass a path or filter after it) |
| `contract:check`, `contract:emit`, `contract:test` | contract checks / emit `openapi.json` / vitest unit project |
| `be:verify` | `contract:check && npm test -w @pp/contract-tests && be:lint && be:lint:migration && be:typecheck && be:test && be:build` |
| `test:e2e`, `test:e2e:http`, `test:e2e:observed`, `test:e2e:module` | Playwright variants |

Split plan when one call would hit the timeout:

1. Raise the two `BASH_*_TIMEOUT_MS` variables first, and run long steps in the background with output to a file (`npm run be:test > /tmp/be-test.log 2>&1 &`) then poll the log.
2. Else run `be:verify` as its parts, one command per call: `contract:check`, then `npm test -w @pp/contract-tests`, `be:lint`, `be:lint:migration`, `be:typecheck`, `be:build`, then `be:test` split by folder (`npm run be:test -- apps/api/src/<module>`).
3. Full `be:verify` once before a push only, and tell the LEAD first (existing rule: one full verify per push; dev uses targeted checks).

## 3. Secrets

Rules:

1. Nothing secret in the repo (the existing gitleaks rule still applies).
2. Cloud environment variables are plain `.env`-format `KEY=value` lines and "anyone who uses the environment can read the values" ([CC-ENV] "Set environment variables"). So only low-sensitivity values (test DB URL pieces, dev flags) go there.
3. For API keys that Claude calls over HTTP, use a network secret (key stays outside the VM, attached by the agent proxy to listed hosts; cannot be viewed after saving; not for GitHub or for setup-script requests) ([CC-ENV] "Add network secrets"). Availability by role on Team: Owners/admin role get the full form, others a one-host form. Whether a key needed as a plain env var by our tests (such as `E2E_DEMO_PASSWORD`) can be a network secret: no, it must be an env var, so it is readable by environment users. Decide per value.
4. The old PC credential vault does not move. Each person re-enters only what their lane needs, from their own sources. Staging demo password is held by Amin (AGENT-SYNC HANDOFF) and is not in the repo.
5. Prefer per-person environments for secrets; a shared environment shares every variable with every member ([CC-ENV]).

Env names the project uses (names only; sources: `.env.api.example`, `.env.db.example`, `.env.example`, `.env.e2e`, `apps/api/src/common/config/env.schema.ts`, `e2e/`):

| Group | Names | Who needs them |
|---|---|---|
| Tests | `TEST_DATABASE_URL` | Everyone running `be:test` |
| API core | `DATABASE_URL`, `SESSION_SECRET`, `IC_HASH_KEY`, `NODE_ENV`, `PORT`, `LOG_LEVEL`, `BASE_URL`, `PUBLIC_BASE_URL`, `PUBLIC_ORIGINS`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `SESSION_COOKIE_NAME`, `SESSION_REMEMBER_DAYS`, `SESSION_REMEMBER_DAYS_STAFF`, `TRUST_PROXY_HOPS` | Only when running the API itself; use dev-only throwaway values |
| DB container | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Compose / local stack |
| Seed and demo | `ALLOW_DEMO_SEED`, `BIJAK_POC_QUESTIONS`, `BIJAK_SWEEP_INTERVAL_SECONDS` | Seed, demo lanes |
| Jobs / OCR / intake | `JOBS_*`, `OCR_*`, `INTAKE_*`, `MAX_UPLOAD_MB`, `UPLOAD_RATE_PER_MINUTE`, `FILE_READS_PER_MINUTE` | Group B intake lane (non-secret tuning) |
| Throttles | `THROTTLE_*_PER_MINUTE` / `_PER_HOUR` (many), `E2E_THROTTLE_LOGIN_PER_MINUTE`, `LOGIN_IDENTIFIER_FAIL_LIMIT`, `LOGIN_FAILURE_FLOOR_MS` | Not secret |
| Observability | `METRICS_ENABLED`, `METRICS_INTERNAL_CIDRS`, `MAIL_LOG_RESET_LINKS` | Not secret |
| Frontend | `VITE_API_MODE`, `VITE_API_BASE_URL`, `VITE_DATA_PROFILE`, `VITE_MOCK_LATENCY_MS`, `VITE_PROTOTYPE_SCOPE`, `VITE_TEST_HOOKS`, `FRONTEND_PORT`, `BUILD_MODE` | FE lane |
| E2E | `E2E_DEMO_PASSWORD` (CI secret for the manual `e2e-http.yml`, backlog #78; set only when actually running it), `E2E_HTTP_START_STACK`, `E2E_HTTP_TEST_DIR`, `E2E_HTTP_WORKERS`, `E2E_BOOT_MS`, `E2E_BOOT_TIMEOUT_MS`, `E2E_EXPECT_MS`, `E2E_TIMEOUT_FACTOR`, `E2E_PROTOTYPE_SCOPE` | QA / FE lane |
| VM tuning | `BASH_DEFAULT_TIMEOUT_MS`, `BASH_MAX_TIMEOUT_MS` | Everyone (section 2.4) |

Secret-grade among these: `SESSION_SECRET`, `IC_HASH_KEY`, `POSTGRES_PASSWORD`, `E2E_DEMO_PASSWORD`, and any DB URL with a password. `BIJAK_*` tuning names are non-secret; the live-site and server credentials of the old vault (outside the repo) are never needed in the cloud and must not be copied there. The exact list of required-vs-optional keys is in `env.schema.ts`; read it there rather than trusting this table.

## 4. Workflow

Sources: `docs/plan/AGENT-SYNC.md` (groups D56, HANDOFF notice of 2026-10-21 ~09:30, standing rules), `docs/plan/backend-tracker.md`, GitHub issues #67 and #78.

### 4.1 Who is who

| Person | Group (D56) | Lanes |
|---|---|---|
| Amin (LEAD, repo owner) | A | PC-1 Identity, PC-4 Migration, PC-6 Teacher/Reports/Seed; also merges and pushes for everyone |
| Azarul | B | PC-2 Learning/Question bank, PC-3 Bijak/Paper builder, PC-5 AI intake, PC-7 Games |
| New member | proposal below | Perlu pengesahan (LEAD decides) |

Proposed lane for the new member (PROPOSAL, not a decision): take over the unowned migration lane cards in PC-4, starting with BE-30 (reconciliation, rehearsal and cutover scripts, tracker status `todo`, no owner) after BE-28 and BE-29 land. Reason: BE-28 and BE-29 already have Group A branches (`be/BE-28-etl-reference-identity`, `be/BE-29-etl-activity` draft PR #82), so the person can start with review and DB-spec verification of those, then build BE-30; PC-4 is Group A, so it also relieves the LEAD. Alternatives if the LEAD prefers frontend: the #78 items that "need a spec first" (verify self-registered teachers screen, Amaran summary screen). Not BE-42/BE-46 (Group A branches exist, waiting for verification only).

### 4.2 Starting point and boards

1. Start from the AGENT-SYNC HANDOFF (first Lead notice, `dd976ab6` and later). Re-read `docs/plan/AGENT-SYNC.md` from `origin/feature/v2-backend` at session start and end.
2. #67 is the Group B merge queue for the LEAD; read its latest comments first (it also carries Group B's cross-verify results from `be/groupa-verify-reint`).
3. #78 is the LEAD-owned follow-up backlog (needs-spec items, backend/contract items, frontend, ops).
4. The live card board is the list of `be/*` branches on GitHub: `git fetch origin --prune && git ls-remote --heads origin "be/*"`.

### 4.3 Rules that carry over

| Rule | Detail |
|---|---|
| LEAD merges and pushes | Workers push their own `be/*` / `fe/*` branches and open PRs; only the LEAD fast-forwards or squash-merges into `feature/v2-backend` and `main`-style branches |
| Contract edits are LEAD-only | `packages/contract` changes: send the exact diff to the LEAD. Checklist: `contract:emit` + `contract:check`, `packages/contract` unit tests, `apps/api` typecheck on the base. Never hand-edit `openapi.json` |
| GitHub comments | Always `gh issue comment ... --body-file <file>` / `gh pr comment ... --body-file <file>` (inline `--body` loses backticks and paths to shell substitution) |
| Before any push | Rebase on `origin/feature/v2-backend`, run `npm run contract:emit` and commit any change to `openapi.json`, then targeted checks |
| Full `be:verify` | Once before a push, tell the LEAD first; development uses targeted checks only |
| Actions budget | Every push can trigger CI and burns Actions minutes (workflows: `api.yml`, `no-dumps.yml`). No push-per-commit; batch and push once. Obey any LEAD push hold. Prefer a draft PR over repeated pushes |
| Migrations | LEAD allocates numbers (next free per HANDOFF: 0037; never 0024). Ask before creating a migration folder |
| Docker/DB-heavy jobs | One at a time per shared resource. In the cloud each session has its own VM, so a local DB is not shared; a shared DB (any hosted Postgres) must be used by one heavy job at a time. Do not point tests at staging or production |
| Report to the LEAD | On done, idle or blocked, post SHA plus status on the PR immediately; talk to teammates through GitHub, never through a relay |
| Group boundaries | Take cards only from your group's lanes; do not take over another group's claimed card |
| Staging / deploy | Needs explicit LEAD (and user) confirmation; see `docs/ops/staging-refresh-2.md` and `docs/ops/deploy-execution.md` |

Cloud-specific addition: the cloud VM pushes only branches you tell it to. Tell each session which branch it owns, and to never touch `feature/v2-backend` directly.

## 5. First day in the cloud: checklist

Derived from the HANDOFF. Tick each item and post the result on the lane's PR/issue.

| # | Step | Check |
|---|---|---|
| 1 | Sign in at https://claude.ai/code, connect GitHub, select `amin-kerja-orang/prestasiplus` (section 1) | Repo appears in the picker |
| 2 | Create/choose the environment: Trusted, setup script and/or hook from 2.2, timeout variables from 2.4 | Session starts without "Setup script failed" |
| 3 | Start a session on `feature/v2-backend` | `git log -1 --oneline` shows the current tip (HANDOFF said `e724b498`; `lead/merge-b5 @ 39d9e962` is the pending merge) |
| 4 | `npm ci` finished | `ls node_modules/.cloud_install.sha256` exists (or `npm ls --depth=0` is clean) |
| 5 | `service postgresql start`, then set `TEST_DATABASE_URL` (placeholder form, section 2.3) | `psql "$TEST_DATABASE_URL" -c 'select 1'` returns 1 |
| 6 | `npm run be:typecheck` | Exit 0 |
| 7 | One targeted test: `npm run be:test -- <one spec path>` | Green; record the elapsed time |
| 8 | `npm run contract:check` | Exit 0 (cheap, needs no DB) |
| 9 | `gh auth status` and `gh issue view 67 --repo amin-kerja-orang/prestasiplus` | Works. How `gh` is authenticated inside the VM: Perlu pengesahan (docs say GitHub operations go through a proxy that attaches the credential; they do not state that `gh` CLI is logged in) |
| 10 | Read `docs/plan/AGENT-SYNC.md` (HANDOFF notice first) and #67, #78 | Summarise it in one comment to the LEAD |
| 11 | Claim a lane/card: create `be/<card>-<slug>` from the tip and post the claim on the PR/tracker per AGENT-SYNC "Quick start" (session name from the `node -e` snippet there) | Branch exists on origin; tracker row updated by the LEAD |
| 12 | Post `--body-file` comment to the LEAD: "cloud setup done, timings for steps 4-7, blockers" | Comment visible on the issue |

Pending Group A/B items from the HANDOFF that the first useful jobs come from: finish the Group B merge (`lead/merge-b5`), full `be:verify` of it, then waiting branches (`BE-42`, `BE-28`, `BE-46`, `BE-33`, `BE-29`). These are LEAD or Group A jobs; the new member verifies only when assigned.

## 6. Known differences vs the old PC setup

| Old PC | Cloud | Status |
|---|---|---|
| Shared PC folders / one working tree for many sessions (worktree and junction rules) | Each session gets its own fresh clone in its own VM; a session's files are saved while paused, but a reclaimed VM comes back fresh. Anything uncommitted and unpushed can be lost. Worktree and node_modules-junction hazards no longer apply | Perlu pengesahan for how long files stay (docs say: paused VM saves files; reclaimed VM is rebuilt) |
| Cross-session pipes / messages between local sessions | None between cloud sessions. Teams talk through GitHub (PR comments, issues, AGENT-SYNC). `claude -p "msg" --cloud <session-id>` can queue a message into one's own cloud session | [CC-WEB] "Send follow-ups from the CLI" |
| Local credential vault (`C:\Users\hp\.prestasiplus\credentials.md`) | Does not exist in the cloud and is not to be copied. Re-enter lane secrets per person (section 3) | Documented |
| Playwright MCP lanes (`.mcp.json`, three browsers) | The cloud docs pages read do not describe MCP servers from `.mcp.json` or browser automation. Chromedriver is listed in Installed tools. Whether Playwright browsers install and run, and whether `.mcp.json` servers load, is not documented | Perlu pengesahan |
| Local Docker Postgres per session; max 3 heavy Docker jobs | 4 vCPU / 16 GB per VM, own Postgres per VM; parallel sessions do not compete for CPU, but each costs plan usage and rate limit | [CC-ENV], [CC-WEB] |
| Dev server on port 5173 for previews | Previewing a running dev server from a cloud VM: not described in the pages read | Perlu pengesahan |
| Long unattended commands | Foreground commands move to background at the timeout; sessions go idle and may be reclaimed | [CC-ENV] |
| Model selection by the main session (project CLAUDE.md model rules) | `/model <name>` takes an argument in cloud sessions; user-level `~/.claude/CLAUDE.md` and user `settings.json` hooks do not apply in the cloud, only repo-committed `.claude/` files and environment settings. A setup script can write `~/.claude/CLAUDE.md` | [CC-WEB], [CC-ENV] |
| Subagents | Work the same, and `.claude/agents/` in the repo is picked up automatically | [CC-WEB] "Manage context" |
| Permission modes | Cloud offers Auto (if allowed), Accept edits, Plan; no Manual or Bypass | [CC-QS] |
| Windows paths and PowerShell notes | VM is Linux (Ubuntu); scripts are POSIX. The repo's Windows-only workarounds (for example the `@swc/core` pin note in ADR-0020, `127.0.0.1` vs `localhost`) are not needed there | Perlu pengesahan only if a test behaves differently |

## 7. Open items for the LEAD

1. Confirm the plan type and whether an Owner can create a shared environment (section 1.1, 2).
2. Decide whether to commit `.claude/settings.json` hook + `scripts/cloud-install.sh` (a repo change, separate from this docs task).
3. Run the first-day checklist once and replace each "Perlu pengesahan" above with the observed result.
4. Confirm or change the proposed lane for the new member (4.1).

Related docs: `docs/ops/staging-refresh-2.md`, `docs/ops/deploy-execution.md`, `docs/ops/api-runbook.md`, `docs/plan/AGENT-SYNC.md`, `docs/plan/backend-tracker.md`.
