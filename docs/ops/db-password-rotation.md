# Database password rotation runbook (AZ-08)

How to rotate the database password with the least downtime, plus the related application secrets. Names only, no values. Rule for every step below: get the lead's explicit confirmation before touching the demo or production environment (api-runbook.md, top of file). The general secret-rotation table is in [api-runbook.md](api-runbook.md) section 13; this runbook extends it for the database and does not replace it. Settings reference: [platform-settings.md](platform-settings.md).

Common rules:

- Generate the new password on the laptop: `openssl rand -hex 24` (alphanumeric, so it needs no URL-encoding inside `DATABASE_URL`). Keep it in the password manager only.
- Never put a password on a command line, in shell history, a ticket, a chat or the repo. Type it at an interactive prompt, or read it from a mode-600 file outside the repo that you delete afterwards.
- Rotate on a schedule (recommended every 90 days, aligned with api-runbook.md section 13) and immediately after a suspected leak, a departing operator, or a laptop/backup loss.
- Do it off-peak. Never during the 23 Oct demo window.
- Take a fresh backup first (demo: manual `pg_dump` from the laptop, see demo-cloudflare-supabase.md; production: `npm run db:backup`).

## 1. Demo (Supabase + Render)

Who uses the password: the Render service (`DATABASE_URL`), and any laptop shell used for migrations, the seed or `pg_dump` (their `DATABASE_URL` is typed per session, not stored).

Supabase has one `postgres` login behind the pooler (user `postgres.<PROJECT_REF>`), and the API owns every table as that role, so a second role would need ownership transfers and a code review; it is not worth it for the demo. The procedure therefore has a short window (the Render restart) rather than zero downtime. Existing pool connections usually stay up until Render restarts the process, so users mostly see nothing, but plan for about 1 to 3 minutes of errors.

Steps:

1. Confirm with the lead and pick a quiet time. Open the Render service Environment page and the Supabase Project Settings, Database page in two tabs.
2. Backup: manual `pg_dump` from the laptop (the URL typed into the prompt, not the command line, as in demo-cloudflare-supabase.md "Backups").
3. Generate the new password (above) and store it in the password manager.
4. Supabase: Project Settings, Database, reset the database password, and paste the new value into the dialog. The old password stops working for new connections immediately. `LEAD: confirm` the exact UI wording; it is not in the repo.
5. Render: edit `DATABASE_URL` (secret), replacing only the password inside the URL. Keep the host, user `postgres.<PROJECT_REF>`, port 5432 (session pooler) and the `?sslmode=...&sslrootcert=...` suffix unchanged. Save; Render restarts or redeploys. Wait for "Live" and `API listening on port ...`.
6. Verify (section 3): `/api/health` and `/api/ready` 200, then one login with a demo account.
7. Revoke the old password: nothing more to do on Supabase (a reset replaces it). Delete the old value from the password manager, and from any saved laptop shell profile or notes.
8. Laptop sessions: close any shell that still has the old `DATABASE_URL` exported. Re-enter the new one at the next migration or seed (`read -rs` prompt as in demo-cloudflare-supabase.md).
9. Re-run the Data API lockdown only if a migration was applied meanwhile (`scripts/supabase/lockdown-data-api.sql`); a password reset does not change grants.
10. Write the rotation log entry (section 4).

Rollback (if step 5 or 6 fails): the old password is gone, so there is no going back to it. Fix forward: re-check that the password in `DATABASE_URL` is exactly the one set in step 4 (no stray whitespace, no characters needing URL-encoding), or reset the password again to a fresh value and repeat step 5. Keep step 2's backup until the verification passes.

## 2. Production (VPS, docker compose, Postgres 16)

Applies once the production stack from the production VPS runbook (`docs/ops/production-vps.md`, AZ-09) exists. Services: `db` (Postgres 16, volume `pgdata`, `.env.db`), `api` and `migrate` (read `.env.api`), backup job (`scripts/db-backup.mjs`). Commands run on the VPS from the compose directory. The database port is not published; psql runs inside the `db` container.

Zero or near-zero downtime: changing the role password does not drop existing connections, so the API keeps serving on its old pool until it restarts with the new `DATABASE_URL`. Only a connection opened between the `ALTER ROLE` and the api restart can fail, which is seconds.

Steps:

1. Confirm with the lead; back up first: `npm run db:backup` (exit code 0, newest `pp-backup-*.dump` and its `.sha256` exist). Optionally `npm run db:restore-check` if the last drill is older than a month.
2. Generate the new password with `openssl rand -hex 24`; keep it in the password manager. You paste it at the `\password` prompt (step 3) and into the two env files with an editor (step 4); no temporary file is needed.
3. Set the new password inside the database, without typing it on a command line. Either interactively with `\password`:

   ```
   docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   -- inside psql:
   \password <role name from .env.db POSTGRES_USER>
   -- psql prompts twice (no echo), hashes it client-side (scram-sha-256) and never logs the clear text
   \q
   ```

   Use the interactive `\password` only. Do not use `ALTER ROLE ... PASSWORD 'literal'` typed on a command line or pasted into a script: the literal lands in shell history and, with `log_statement` enabled, in the server log. `\password` sends a pre-hashed value. A non-interactive variant (a psql script on stdin using `ALTER ROLE <role> PASSWORD :'pw'` with the value read from a mode-600 file inside the container) was not exercised from the repo; `LEAD: confirm` before using it. Note that `psql` inside the container connects through the local socket, which the official image trusts, so no current password is needed.
4. Update the secret files consistently (edit with an editor, not `echo >>`):
   - `.env.api`: `DATABASE_URL=postgresql://<USER>:<NEW PASSWORD>@db:5432/<DBNAME>` (this is what `api` and the `migrate` job read).
   - `.env.db`: `POSTGRES_PASSWORD=<NEW PASSWORD>`. Note: this value only matters at the FIRST initialisation of an empty `pgdata` volume; the live role changes only by `ALTER ROLE`/`\password`. Keeping it in sync matters for a future re-init, and because `db` containers and the backup script read `POSTGRES_PASSWORD` from the container environment.
   - Check modes: `chmod 600 .env.api .env.db`.
5. Restart the api with the new URL: `docker compose up -d api` (the API shuts down gracefully, `SHUTDOWN_GRACE_MS`, and answers `/api/ready` 503 while draining). The `db` container is recreated later (step 8), because recreating it restarts Postgres.
6. Verify (section 3).
7. Remove every copy of the old password (password manager, notes, editor backup files of `.env.api` and `.env.db`).
8. Align the `db` container environment at the next maintenance window: `docker compose up -d db` recreates it with the new `.env.db` (a few seconds of database downtime; schedule it, and expect the api to reconnect). The backup script runs `pg_dump -h 127.0.0.1` inside the `db` container using the container's `POSTGRES_PASSWORD`; the official image trusts loopback, so the backup normally keeps working with the stale value, but run `npm run db:backup` after the rotation anyway and again after step 8 to prove it (`LEAD: confirm`, depends on the image's `pg_hba.conf`). Any other backup job or external tool (off-site `pg_dump`, monitoring user) that stores the old password must be updated now.
9. Confirm `docker compose logs --since 10m api | grep '"level":50'` shows no authentication error, then write the rotation log entry (section 4).

Optional zero-gap variant (second role): create a second role with the same grants and ownership, switch `DATABASE_URL` to it, then drop the first. The tables are owned by the first role and migrations run as it, so ownership must move (`REASSIGN OWNED BY`), which is a DBA change; only do it with the backend developers.

Rollback: if the api cannot connect after step 5, the database still holds the new password you set in step 3. Check `.env.api` for a typo first (`docker compose logs api` names `DATABASE_URL` or an authentication failure, never the value). If you must go back to the old password, set it again with `\password` (the old value from the password manager, still kept until step 7) and restore the previous `.env.api`/`.env.db`, then `docker compose up -d api`. If the volume must be rebuilt, restore from the step 1 backup (db-backup.md "Real restore"), which needs the lead's confirmation.

## 3. Verification checklist (both environments)

- [ ] `/api/health` returns 200 with `db: up`.
- [ ] `/api/ready` returns 200 with `status: ready` and `migrations: applied` (demo: `curl -fsS https://<project>.pages.dev/api/ready`; production: `curl -fsS http://127.0.0.1:5192/api/ready` through nginx, and `docker compose exec api wget -qO- http://127.0.0.1:3000/api/ready`).
- [ ] One real login works (a demo account on the demo; a test staff account in production).
- [ ] A write works (for example change a profile setting, then revert it).
- [ ] The API log has no authentication error: Render log view, or `docker compose logs --since 10m api | grep '"level":50'`.
- [ ] The migrate job still authenticates (production: `docker compose run --rm migrate` is a no-op if nothing is pending; skip if the lead prefers to test it at the next release).
- [ ] The backup job runs (`npm run db:backup`, exit 0).
- [ ] The old password no longer works (a laptop shell with the old URL is refused).
- [ ] No password in the shell history, the repo (`git status` clean) or tickets.

## 4. Rotation log template

Keep the log in the lead's private ops notes (not in the repo if it contains anything sensitive; this template contains no secret).

| Date (MYT) | Environment | Secret rotated | Operator role | Approved by | Backup taken | Result | Notes |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD | demo / production | DB password / SESSION_SECRET / EDGE_PROXY_SECRET | LEAD (devops) | LEAD | yes (file name only) | OK / rolled back / failed | window length, follow-ups |

## 5. Other secrets

### 5.1 `SESSION_SECRET`

Effect: every signed-in session and CSRF token becomes invalid; all users must log in again; login-throttle counters and reset hashes keyed with it restart (api-runbook.md section 13). No database change.

1. Announce it to the users who are signed in, and do it off-peak (never during the demo).
2. Generate `openssl rand -hex 32`; it must differ from `IC_HASH_KEY` (schema minimum 16 characters; use 32 or more).
3. Update `SESSION_SECRET` in the secret store (Render Environment; production `.env.api`) and restart the api (Render saves and restarts; `docker compose up -d api`).
4. Verify: `/api/ready`, then log in again. Old cookies are rejected.
5. Rollback: put the previous value back and restart (sessions signed under the old value work again; sessions created in between are lost).

### 5.2 `IC_HASH_KEY` - do not rotate casually

`IC_HASH_KEY` is the HMAC key of every stored `ic_hash` (`.env.api.example`). Changing it breaks every stored IC hash (password reset by IC, IC search) until ALL hashes are recomputed with the new key. Rotation needs a written recompute plan, a maintenance window and a database backup, prepared with the backend developers (api-runbook.md section 13; go-live-bijak-spm.md section 3.1). Treat it as a one-time secret chosen at go-live. If it leaks, the lead decides with the backend developers whether a recompute is needed. Never reuse the `SESSION_SECRET` value.

### 5.3 `EDGE_PROXY_SECRET` (demo)

See [platform-settings.md](platform-settings.md) section 3: the API accepts one value, so there is a short window of shared throttle buckets between the Render and Pages updates.

## 6. Cadence recommendation

| Secret | Cadence | Also rotate when |
|---|---|---|
| Database password | Every 90 days | Operator leaves, laptop or backup lost, suspected leak, a shell with `DATABASE_URL` was shared |
| `EDGE_PROXY_SECRET` | Every 90 days | Suspected leak (it is redacted in logs, but a worker misconfiguration could echo it) |
| `SESSION_SECRET` | Every 180 days, or on a leak | Suspected cookie forgery or leak of the secret |
| `IC_HASH_KEY` | Never on a schedule | Only after a confirmed leak, with a recompute plan |
| `AI_API_KEY` | Per the provider's advice, and on any leak | Unexpected spend |
| Demo | After the 23 Oct demo, rotate the database password and `EDGE_PROXY_SECRET` if more than one person had them, and re-check the demo seed password | |
