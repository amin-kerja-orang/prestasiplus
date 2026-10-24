# a1-35 — run v2 on the migrated data: what is proven, what is not

`deploy/rehearsal/a1-35-run-v2.sh` is step **a1-35** of the A1 chain (`a1-20` dump sitting →
`a1-30` load and migrate → **`a1-35`** → `a1-40` rollback probes and restore). Before this card it had
only ever passed a syntax check. It has now been built in the repository and run end to end, twice in a
row, against a **synthetic** rehearsal database. No real data, no real dump and no `prestasiplus.cloud`
access was involved at any point.

## 1. The rehearsal database it was proven against

Built with the project's own tooling and the normal migration path:

| step | command | result |
|---|---|---|
| up | `rehearsal-db.sh up` | 38 of 38 migrations applied, 7 s |
| seed | `rehearsal-db.sh exec target -- env NODE_ENV=production npm run db:seed -w @pp/api -- --profile=migration` | 3 reference modules, `users` = 0, 5 s |
| fixture | `npm run fixtures:generate -w @pp/api -- --size medium --seed 7` | 55 files, 71 MB, 20 000 synthetic users, 2 s |
| load-dump | `rehearsal-db.sh load-dump <dir> --attest-anonymised` | 127 tables, 366 075 rows, 9 s |
| stage | `rehearsal-db.sh stage` | STAGE COPY PASSED, 127 tables, 3 s |
| apply | `exec target -- env PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of=…` | 4 runs succeeded, **4 m 47 s** |
| snapshot | `rehearsal-db.sh snapshot after_full` | 197 tables recorded, 1 s |

After the apply: 19 599 users, 44 812 `etl_id_map` rows (19 599 of them `legacy_source = 'cloud'`,
`entity = 'users'`), 15 179 active student accounts — of which 14 679 carry a legacy `$2y$` hash,
200 an argon2id hash, 300 none, and **900 have `must_reset_password = true`**.

## 2. a1-35 timings (two clean runs in a row, plus one `--hash argon2` run)

| step | run 1 | run 2 |
|---|---|---|
| boot → `/api/health` reports `db: up` | 2 s | 3 s |
| pick account + write password (bcrypt cost 10) | 1 s | 1 s |
| `POST /api/auth/login` | 465 ms | 410 ms |
| `GET /api/me` | 49 ms | 37 ms |
| whole script, wall clock | **4.0 s** | **4.3 s** |

With `--hash argon2` the login is 222 ms instead of ~450 ms: the difference is the cost-10 bcrypt
verification in `LegacyBcryptPool`. Budget a1-35 at well under a minute on the night, boot included.

## 3. What a1-35 writes, and why that is safe

One run changes exactly five tables: `users.password_hash` (one row, no row-count change),
`sessions` +1, `login_attempts` +1, `audit_events` +1, `coin_ledger` +1 (the daily-login reward fires
for the account it logs in as). `rehearsal-db.sh restore-snapshot after_full --yes` put all five back
(`ROLLBACK VERIFIED: … 5 table(s) differed before the rollback`), which is what a1-40 does first.

## 4. Proven

- The v2 API boots against a freshly migrated database and `/api/health` answers `{status: ok, db: up}`.
- A **migrated** account (joined through `etl_id_map`, `legacy_source = 'cloud'`) can log in through the
  real `POST /api/auth/login` with `{identifier, password}` and gets a `pp_session` cookie
  (`HttpOnly`, `SameSite=Lax`).
- The **legacy bcrypt verification path** works on a migrated row: the script writes a real `$2y$10$`
  hash with the repository's own `bcryptHashWithSalt`, the login verifies it in `LegacyBcryptPool`, and
  the stored hash is then **rehashed to argon2id**, as designed.
- One authenticated read (`GET /api/me`) returns the same migrated account, with role `student` and its
  school resolved — so migrated identity, roles and school FKs hang together at the API level.
- The script stops only the process it started (pid recorded by its own wrapper, never a pattern kill)
  and shreds its log, its helpers and its credential file.

## 5. NOT proven — read this before the night

- **A carried-over `.cloud` bcrypt hash was never exercised.** a1-35 *overwrites* the hash before it logs
  in, so the hash it verifies is one the script made. Nothing here shows that a hash produced by the live
  Laravel app and carried through the ETL verifies in v2. It cannot be shown this way either: the
  synthetic fixture's hashes are filler strings (`fixtures/generate.ts`), and for real anonymised rows
  nobody holds the plaintext. The only honest proof is a login by a real person with their real password
  after cutover, or a hash made by `password_hash()` in PHP with a known plaintext, loaded on purpose.
  **The verification *code path* is proven; the *carried data* is not.**
- **Docker mode was not exercised here** (the container registry is unreachable from this environment):
  the database ran in `PP_REHEARSAL_MODE=host` with `PP_REHEARSAL_MIGRATE=psql`. The LEAD's Mac uses
  docker mode, so the `up` and migrate lines will differ and the Postgres tuning of
  `compose.rehearsal.yaml` (fsync on, 1 GB shared_buffers) was **not** in force — timings in section 1
  are not production-like, only a1-35's own timings in section 2 are meaningful.
- Only one role (`student`), one endpoint (`GET /api/me`) and one session. Teacher, school admin and
  parent logins, role switching and `POST /session/mode` are untouched.
- https is not exercised: the run is plain http on loopback with `COOKIE_SECURE=false` (see finding 3).
- No file storage (`I4`) path, no job worker (`JOBS_WORKER_ENABLED=false`), no OCR.

## 6. What would have failed at 3 a.m. (found by running it)

1. **`npm run dev -w @pp/api` is the wrong entry point.** It is a watcher: `vite build --watch` plus
   `node --watch dist/main.js`, started after a hard-coded 4-second sleep, behind a `predev` that runs
   `prisma generate`. It leaves a process tree the script cannot stop precisely. a1-35 now requires
   `npm run build -w @pp/api` beforehand and runs the single built bundle, recording that process's own
   pid. **The real port is 3000** (`PORT` default in `env.schema.ts`), not 3001/8080; a1-35 uses 3099 so
   it can never collide with a dev server, and refuses to start if anything already listens there.
2. **The repo has no bcrypt package.** There is no `bcrypt`, `bcryptjs` or `@node-rs/bcrypt` dependency.
   Current hashes are argon2id via `@node-rs/argon2`; legacy `$2y$` hashes are verified by an in-house
   implementation, `apps/api/src/modules/auth/legacy-bcrypt.ts` (`bcryptHashWithSalt` for making one,
   `LegacyBcryptPool` for verifying off the event loop). Any a1-35 that expected to `require('bcrypt')`
   would have died on the first line.
3. **`COOKIE_SECURE` defaults to `true` in every environment** (`auth.config.ts`). Over plain
   `http://127.0.0.1` the login would set a `Secure` cookie that no normal client sends back, so the
   authenticated read would have returned 401 and looked like a migration bug. a1-35 sets
   `COOKIE_SECURE=false` for the loopback run and says so in its output.
4. **`rehearsal-db.sh exec` forces `NODE_ENV=development`.** Booting the API through it without an inner
   `env NODE_ENV=production` would have rehearsed the wrong mode. a1-35 restores production inside the
   command, the way A1.3 already does for the seed — and that in turn makes `SESSION_SECRET`,
   `IC_HASH_KEY` and an absolute `FILE_STORAGE_DIR` mandatory, which the script supplies.
5. **`IC_HASH_KEY` must be the one the ETL used.** `rehearsal-db.sh exec` generates it once and keeps it
   in the rehearsal state dir, and the ETL hashed all 19 599 `ic_hash` values with it. An API booted with
   any other key would leave every migrated `ic_hash` unmatchable and the reset-by-IC flow silently
   broken for every migrated account. a1-35 boots *through* `exec` so the same key is used. **The same
   trap exists on the real night**: whatever key `migrate:all` runs with must be the production
   `IC_HASH_KEY`.
6. **Picking "any active student" is not safe.** 900 of 15 179 migrated active students have
   `must_reset_password = true`: they log in, but every route except the password-change flow answers
   403, so the authenticated read fails for about 6 % of random picks. 300 have no hash at all, and a
   username can repeat across schools (login then needs `schoolId`). Two more refusals are possible on
   real `.cloud` data even though the medium fixture happens to contain none: an account whose school
   has `is_active = false` is refused with 403 `SCHOOL_INACTIVE` (`auth.service.ts`; `transformSchool`
   carries the flag over), and an account holding `student` plus any second role is refused with 403
   `ACCOUNT_INACTIVE` (`buildGrants`, `session-view.ts`). Every one of these would look like a
   migration bug at 3 a.m. and is none. The selection query now mirrors each refusal, so it can only
   ever pick an account the API is willing to log in.
7. **`shred` is not on a stock macOS.** The close-out step would have failed on the LEAD's Mac. a1-35
   falls back to `gshred`, then to an overwrite plus `rm -P`.
8. **The API binds `0.0.0.0`** (`apps/api/src/main.ts`), not loopback. During the rehearsal the machine
   must not be on an untrusted network; this is noted in the script header rather than patched, because
   the boot path must stay the real one.
9. Smaller ones: the fixture generator refuses an output directory outside the repo while `load-dump`
   requires the dump outside it, so the fixture has to be copied across; the fixture manifest carries
   `"synthetic": true` but no `"anonymised": true`, so `load-dump` needs `--attest-anonymised`; and
   `prisma generate` must have run, or the seed dies with `Cannot find module 'src/db/generated/client'`.
