# Demo deploy workflow (deploy-demo / rollback-demo)

**BM:** Dokumen ini ialah persediaan sekali sahaja untuk LEAD, dan cara menjalankan, meluluskan dan membatalkan (rollback)
deploy demo melalui GitHub Actions. **EN:** One-time setup for the LEAD, plus how to run, approve and roll back the demo
deploy through GitHub Actions.

- **Spec:** run sheet #170 (`docs/ops/demo-deploy-22oct-run-sheet.md`) and #112 (`docs/ops/demo-deploy-23oct.md`).
  The workflow does the run sheet steps 1–10 and the step 11 rollback block. Step 11's browser go/no-go and the
  two-network login check stay manual.
- **Files:** `.github/workflows/deploy-demo.yml`, `.github/workflows/rollback-demo.yml`, `scripts/deploy-demo.sh` (all
  the logic; also runs locally), `scripts/deploy-demo-local-pg.sh` (local test database).
- **LEAD exception (22 Oct 2026):** exactly these two workflow files.

## 1. What the deploy does / Apa yang deploy buat

| # | Step (run sheet) | Check (any mismatch → `NO-GO: <step>`, exit 1) |
|---|---|---|
| 0 | `render-env` (step 8 table) | Render env names: `BIJAK_POC_QUESTIONS=true`, `AI_PROVIDER=mock`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY_HOPS=2`, `ALLOW_DEMO_SEED=false`, `LOG_LEVEL=info`; the keep-names set; the AI/intake/mail names unset. Values are never printed. Read-only. |
| 1 | `checkout` (1) | Both SHAs are full 40-hex and on `feature/v2-backend` / `be/integration-frontend`; `23c98226` is an ancestor of FRONTEND_SHA; expected migrations / newest / questions read from BACKEND_SHA. |
| 2 | `spa-build` (7) | `vite build --mode demo` (http), `check-demo-bundle: OK`, `_worker.js` copied, worker + demo scripts equal BACKEND_SHA. **Runs before any DB change**, so a build failure leaves the DB untouched. |
| 3 | `db-target`, `backup`, `backup-encrypt` (2) | Pooler user = `postgres.<DEMO_REF>`; `psql: OK`; `pg_dump` major ≥ server major (17); non-demo accounts = 0; `pg_dump -n public -Fc` with TABLE DATA > 0 and `SCHEMA - public` = 1; `pp_gate` → `GATE OK`; dump encrypted with GPG. **No key → NO-GO before anything is changed.** |
| 4 | `reset` (3, mode `reset` only) | `pp_gate`, `DROP SCHEMA public CASCADE; CREATE SCHEMA public`, 0 tables. |
| 5 | `migrate` (4) | `demo-db-delta.mjs`: reset mode expects `Dry run: 36 migration(s) would be applied` and `Done: 36 migration(s) applied`; both modes end `Up to date`. |
| 6 | `seed` (5, mode `reset` only) | argon2id hash of the demo password (masked), `seed: profile=poc, 25 module(s)`. |
| 7 | `lockdown-counts` (6) | grants 0, `has_table_privilege(anon, users)` = `f`; counts line = expect line (`36 \| 0042_… \| 197 \| 51 \| 18 \| 0 \| 4 \| 15 \| 34 \| 15 \| 5 \| 1271 \| 3 \| 10 \| 71 \| 4`). Redeploy mode compares the migration fields only (demo writes change the rows). |
| 8 | `edge-secret + render-env` (8) | Fresh `openssl rand -hex 32` (masked, never printed) → `wrangler pages secret put EDGE_PROXY_SECRET` and Render `EDGE_PROXY_SECRET`; Render `CLIENT_IP_HEADER=x-pp-client-ip`. `keep_edge_secret` skips the rotation. |
| 9 | `render-deploy`, `render-health`, `pages-deploy`, `pages-health` (9) | Render branch `feature/v2-backend`, deploy of BACKEND_SHA, poll until `live` (30 min max); Render `/api/health` `db: up`; `wrangler pages deploy dist`; Pages `/api/health` `db: up`. The previous Pages deployment id is written to the run summary (rollback target). |
| 10 | `smoke`, `walkthrough-read-only`, `walkthrough-writes` (10) | `Result: 29 passed, 0 failed`; `102 passed, 0 failed, 5 skipped` exit 3; `116 passed, 0 failed, 0 skipped` + GO exit 0 (writes only in mode `reset`). |

The last line is `GO (reset)` or `GO (redeploy)`. Then do step 11 in the browser.

## 2. One-time setup / Persediaan sekali sahaja (LEAD)

### 2.1 Environment `demo` + required reviewer

1. GitHub → repo **Settings → Environments → New environment** → name `demo`.
2. **Required reviewers:** tick it, add **azarulhakim** only. Tick **Prevent self-review** off (you start and approve your
   own runs). / *Tandakan "Required reviewers", tambah azarulhakim sahaja.*
3. **Deployment branches and tags:** *Selected branches* → add `feature/v2-backend` (and, until the PR merges,
   `ops/AZ-deploy-demo-workflow`; remove it after the merge). Runs from any other branch cannot read the secrets.
4. **Wait timer:** 0. **Allow administrators to bypass:** leave off.

### 2.2 Secrets (environment `demo` → Environment secrets)

| Name | What / Apa | How to get it / Cara dapatkan |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Pages deploy + Pages secret + Pages rollback | Cloudflare → My Profile → **API Tokens → Create Token → Custom token**. Permissions: **Account → Cloudflare Pages → Edit**, nothing else. Account resources: your account only. TTL: e.g. 30 days. |
| `RENDER_API_KEY` | Render env + deploy | Render → **Account Settings → API Keys → Create API Key**. (Render keys are account-wide: delete it after the demo period or rotate it.) |
| `SUPABASE_POOLER_URL` | Session pooler URL **without the password** | Supabase → project `prestasiplus-demo` → **Connect → Session pooler**. Remove `:[YOUR-PASSWORD]`, so it is `postgresql://postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432/postgres`. No `?` part. The script refuses a URL with a password in it. |
| `SUPABASE_DB_PASSWORD` | DB password | From the vault (Supabase → Database → password). |
| `DEMO_PASSWORD` | Demo persona password | From the vault (`docs/AKAUN-DEMO.md` names the accounts). The seed hashes it; the smoke/walkthrough log in with it. |
| `BACKUP_GPG_PRIVATE_KEY` | Rollback only: decrypts the backup | See 2.4. |
| `BACKUP_GPG_PASSPHRASE` | Rollback only, optional | The passphrase of that key, if it has one. |

### 2.3 Variables (environment `demo` → Environment variables; not secret)

| Name | Value / Nilai |
|---|---|
| `DEMO_REF` | The project ref of `prestasiplus-demo` (from the Supabase dashboard URL). |
| `SUPABASE_CA_CERT` | The full text of the Supabase CA (`prod-ca-2021.crt`, Supabase → Database settings → SSL → Download certificate), including the BEGIN/END lines. |
| `BACKUP_GPG_PUBLIC_KEY` | The ASCII-armoured public key from 2.4. **Without it every deploy stops at `backup` (NO-GO).** |
| `RENDER_SERVICE_ID` | `srv-…` of `prestasiplus-api` (Render dashboard URL). |
| `RENDER_URL` | `https://<service>.onrender.com` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Account ID. |
| `PAGES_PROJECT` | `prestasiplus-demo` |
| `PAGES_URL` | `https://<project>.pages.dev` |
| `PAGES_BRANCH` | The Pages production branch (optional; default `main`). |

### 2.4 Backup key (GPG) / Kunci backup

On your own computer (Git Bash), once:

```bash
gpg --quick-gen-key 'PrestasiPlus demo backup' default default 1y     # set a passphrase
gpg --armor --export 'PrestasiPlus demo backup'                        # → variable BACKUP_GPG_PUBLIC_KEY
gpg --armor --export-secret-keys 'PrestasiPlus demo backup'            # → secret BACKUP_GPG_PRIVATE_KEY (+ passphrase secret)
```

The backup artifact (`demo-db-backup-<run id>`, 7 days) is encrypted to this key; anyone with repo read access can
download it but cannot read it. The private key lives only in environment `demo` (readable only by an approved run)
and in your vault. If you prefer, leave `BACKUP_GPG_PRIVATE_KEY` unset and restore by hand with run sheet §11 after
`gpg --decrypt`.

## 3. Run, approve, roll back / Jalankan, luluskan, rollback

### 3.1 Deploy

1. **Actions → deploy-demo → Run workflow.** Branch: `feature/v2-backend`.
   - `backend_sha`: e.g. `20d201c59776a68ead88f275b9117f7801a0c86c` (full 40 hex)
   - `frontend_sha`: e.g. `9a5b06808b5b3c7bec94f0f56513b9b927d560a1`
   - `mode`: `reset` (Path A, fresh demo data) or `redeploy` (keep the data, apply new migrations only)
   - `keep_edge_secret`: off (a fresh secret every run)
2. **Approve:** the run waits with *"Waiting for review: demo"*. Open it → **Review deployments → tick `demo` → Approve
   and deploy.** / *Klik "Review deployments", tanda `demo`, "Approve and deploy".*
3. Watch the log. Each step prints `== <step> ==` and `OK …` lines. The end is `GO (reset)`; any problem is a single
   `NO-GO: <step>: <reason>` line and a red run.
4. **After GO:** run sheet step 11 in the browser (D-01/D-02/D-03 must PASS), the two-network login check, and look at
   the Render log for a `ClientIp` warning.

Nobody may use the demo between the start of `reset` and the end of `pages-deploy` (about 10–15 min).

### 3.2 If it says NO-GO / Jika NO-GO

| Stopped at | Changed so far | What to do |
|---|---|---|
| `render-env`, `checkout`, `spa-build`, `db-target`, `backup`, `backup-encrypt` | nothing | Fix the cause, run again. |
| `reset`, `migrate`, `seed`, `lockdown-counts` | the DB | Run **rollback-demo** with `restore_db` on and this run's id (the old API still runs). Or fix and run deploy again in mode `reset`. |
| `edge-secret…`, `render-deploy`, `render-health` | DB + secrets (+ Render) | Usually run deploy again (`reset`). If the new API does not come up: **rollback-demo** (full). |
| `pages-deploy`, `pages-health`, `smoke`, `walkthrough-*` | everything | Look at the failing check; if it is not a quick fix, **rollback-demo** (full). |

### 3.3 Rollback

**Actions → rollback-demo → Run workflow** (branch `feature/v2-backend`), then approve as in 3.1.
- `render_sha` `adcaad0ce444bab734d43a3939e511fd7d8493fb`, `render_branch` `be/demo-deploy-2` (the pre-22-Oct demo, #112 §6);
- `pages_deployment_id`: empty = the production deployment before the current one (or the id from the deploy run summary);
- `restore_db`: on, and `backup_run_id` = the run id of the deploy-demo run (the number in its URL).

Order, as run sheet §11: decrypt the dump and `pp_gate` first (a bad dump stops before anything changes), Pages
rollback, Render deploy of `render_sha`, then `pp_gate` → `DROP SCHEMA public CASCADE` → `pg_restore --no-owner
--no-privileges --exit-on-error` → lockdown → grants 0 and `f` → counts printed → both `/api/health` `db: up`.

## 4. Security notes

- Secrets come only from environment `demo`; a run cannot start the job before your approval.
- Actions pinned by full SHA; `permissions: contents: read` (rollback adds `actions: read` for the artifact);
  `concurrency: deploy-demo` for both workflows (one at a time, never cancelled midway); timeouts 90 / 60 min.
- No `set -x`. Derived values (edge secret, password hash) are masked with `::add-mask::`. Render/Cloudflare tokens go
  in 0600 header files (`curl -H @file`), never in argv. Inputs reach the script as environment variables, never
  interpolated into shell code.
- Every destructive DB command is behind `pp_gate` (#112 §1.0).
- Only the GPG-encrypted dump leaves the runner.

## 5. Local test (no cloud) / Ujian setempat

```bash
scripts/deploy-demo-local-pg.sh up            # Supabase-like Postgres 16/17 on 127.0.0.1:55439
eval "$(scripts/deploy-demo-local-pg.sh env)" # PP_DEPLOY_STUB=1, loopback PGURL, sslmode=disable (stub only)
export BACKEND_SHA=… FRONTEND_SHA=… PP_MODE=reset DEMO_PASSWORD=… BACKUP_GPG_PUBLIC_KEY="$(cat pub.asc)"
scripts/deploy-demo.sh deploy                 # ends "STUB RUN COMPLETE (reset)"
scripts/deploy-demo-local-pg.sh down
```

`PP_DEPLOY_STUB=1` stubs every Render/Cloudflare call, is refused inside GitHub Actions and refuses a non-loopback
database. The results of the run behind this PR are in the PR description.
