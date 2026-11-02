# R1 operator checklist (one page)

Short form of [r1-runbook.md](r1-runbook.md) (section numbers below point there). A human with deploy rights runs this, after the lead's explicit confirmation. Placeholders only: `<DATABASE_URL>`, `<pid>`. No secrets on this page.

**Not covered by the rehearsal:** `deploy.sh` and the compose path, the API running as `pp_app`. The migration rehearsal (REQ-B-083: local Postgres 16, 409k `question_versions`, base `87466acc`) covered the normal apply (20.3 s total, 0106 16.6 s), revert, re-apply, `/api/ready` and the reference seed.

## 1. Pre-deploy

- [ ] Full dump taken and the restore tested ([db-backup.md](db-backup.md); runbook section 0, step 1). 0100 cannot be undone in place.
- [ ] Maintenance window agreed; `lock_timeout` set for the migrate role or URL (runbook 2.4, value 5 s). This also avoids the W1 case below.
- [ ] No blocking sessions (read-only): `SELECT pid, usename, state, xact_start, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle' AND pid <> pg_backend_pid() ORDER BY xact_start;`
- [ ] `pg_trgm` is available (2.4 item 3): `SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';` returns 1 row.
- [ ] Migrate role may create it. Run as the migrate role; it must return `t`:
  `SELECT has_database_privilege(current_user, current_database(), 'CREATE') OR (SELECT rolsuper FROM pg_roles WHERE rolname = current_user);`
- [ ] Environment confirmed (REQ-B-080, runbook section 6): `THROTTLE_GLOBAL_PER_MINUTE` (recommended `3000`, code default 300) and `TRUST_PROXY_HOPS` (recommended `1`, code default 0). Write down the values you set.
- [ ] Pre-migration counts recorded (runbook 3.1).

## 2. Deploy

- [ ] `prisma migrate deploy` (via the deploy script, the normal path). Order and list: runbook 2.1. Expect 0105 to hold a lock on `question_versions` for under a second; 0106 about 17 to 20 s at 409k rows (writes wait, reads do not).
- [ ] Right after 0106 and 0107: `ANALYZE question_versions;`

## 3. Detect a failed migration

`prisma migrate status` does **not** name a failed migration and can exit 0. Run this as the migrate role; any row means a migration is unfinished:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at, logs FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;
```

`migrate deploy` then answers P3009 and `/api/ready` answers 503 until it is fixed. Recover promptly (runbook 2.4 and section 8).

## 4. Recovery: client died while 0105 waited for a lock (W1)

Only when the migrate process died while 0105 waited and no `lock_timeout` was set. Do **not** run `resolve --rolled-back` first: the server may have committed 0105, and `deploy` would then fail with 42701 (`column "last_editor" already exists`).

1. Find and stop the stale session (**not tested in the rehearsal**):
   `SELECT pid, state, wait_event_type, left(query, 80) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND query ILIKE '%question_versions%' AND state <> 'idle';` then `SELECT pg_terminate_backend(<pid>);`
2. Check what 0105 left (read-only):
   - `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'question_versions' AND column_name IN ('last_editor', 'declared_marks');`
   - `SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'question_versions'::regclass AND conname IN ('ck_question_versions_last_editor', 'ck_question_versions_declared_marks');`
3. Both columns and both validated constraints present: `prisma migrate resolve --applied 0105_gate_facts` (tested in the rehearsal; the backfill is kept), then `prisma migrate deploy`.
   None present: `prisma migrate resolve --rolled-back 0105_gate_facts`, then `prisma migrate deploy`.
   Some but not all: run the `DROP ... IF EXISTS` revert in runbook 2.4 (Recovery step 2), then the rolled-back path.
4. Re-run the detection query (0 rows) and check `/api/ready`.

For a lock timeout while the client is still connected, 0105 rolls back whole; use the normal recovery in runbook 2.4 (terminate the blocker, `resolve --rolled-back`, `deploy`).

## 5. Rollback

- Past 0100: restore the pre-deploy dump with the previous API/FE build ([r1-release-notes.md](r1-release-notes.md) 6.2). After a dump restore do **not** run `prisma migrate resolve` (P3011).
- Reverting only 0104 to 0107 by hand (runbook 2.3): reverse SQL plus `DELETE FROM _prisma_migrations ...`, with the old API/FE build back. **0110 stays applied by design** (no reverse).

## 6. Post-deploy

- [ ] `GET /api/ready` answers 200 (`db` up, `migrations` applied) and `GET /api/health` 200.
- [ ] Detection query of section 3 returns 0 rows.
- [ ] Schema checks 3.5d and 3.5e; servable counts 3.6.
- [ ] Smoke (runbook 5.5 and release notes 6.1): login, a practice session, the admin list.
- [ ] Record the date, the build, the migration list applied and who ran it.
