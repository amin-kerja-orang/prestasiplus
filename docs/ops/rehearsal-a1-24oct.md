# 24 Oct real-data rehearsal run sheet (A1 / P1): .cloud to v2, on the rehearsal DB (MIG-08 addendum)

- **Status:** draft for the LEAD. **Dress-rehearsed once (23 Oct) on synthetic data only (medium fixture, seed 7) on a local PostgreSQL 16 in host mode; never run on real data.** Every command, flag, variable, exit code and output line below was checked against the code or the docs named next to it; where something is not implemented or not known it is marked **Perlu pengesahan** with the person who confirms. Nothing is started without the LEAD's explicit confirmation.
- **Slug:** `v2-cutover-plan` (addendum). **Item:** half AM step 5 of MIG-08: plan steps A1 and P1 (it also feeds A4 / P6 and the budget P7). Docs only.
- **Builds on:** [cutover plan](v2-cutover-plan.md) sections 3 (P1, P2, P6, P7), 3.1, 3.3, 4.0, 4.1 (A1), 4.3, 4.6, 4.7, 5 and 6; [rehearsal DB recipe](rehearsal-db.md) and `deploy/rehearsal/rehearsal-db.sh` (PR #117); [migration runbook](../architecture/v2-migration-runbook.md) sections 12 to 18 (they arrive with PR #123 and exist only on branch `be/AM-09-migrate-orchestration` until then); the AM-10 procedure `docs/ops/cloud-dump-procedure.md` (PR #125); the MIG-07 reports `docs/ops/mig07-rehearsal-report.md` and `docs/ops/mig07-real-data-pass.md` (branch `be/AM-MIG-07-rehearsal`); [backup and restore drill](db-backup.md). The next sheet is [A4 timed rehearsal and window budget](rehearsal-a4-27oct-timing.md).
- **Time convention:** every time is Malaysia time (MYT, UTC+8) with UTC in brackets. The helper in section 5 prints UTC; add 8 hours for MYT. `.cloud` `DATETIME` values are read as +08:00 (DT-1 A).
- **Marker:** "Perlu pengesahan" means not decided or not verified yet; it is to be confirmed by the person named.
- **Privacy:** this repo is public. Roles only; no host names, no addresses, no names, no paths of real people, no secrets, no row values. Placeholders: `<db>`, `<dump dir>`, `<extract dir>`, `<files dir>`.

## LEAD quick path: Docker mode

**Docker mode is not dress-rehearsed; our sandbox has no Docker daemon. Host mode was (23 Oct, synthetic). So the first Docker `up` and its migration-count line are the LEAD's go point before the dump load: if `up` does not show `<n> of <F>` migrations (`MIGRATION CHECK PASSED: <n> of <n>` with `n` = the folder count `F` of A1.0), stop.** What was checked offline in the sandbox: the dry-runs of `up` and `down` in Docker mode, and `docker compose config` on `compose.rehearsal.yaml` (images, loopback port, `DATABASE_URL`); nothing was started.

**Required state.** #122, #160 and #123 at `aa3b325a` or newer (the `question_sets` verify row and `etl_runs.git_sha`), #133 and #125 merged; the three greps of A1.0 print 4, 4 and 1; `--as-of=2026-10-29` on every call that takes it (I5). `--content-owner` stays as the sheet says: not passed, and whether the night passes one is a **Perlu pengesahan (LEAD, half AM)** (A1.9). LEAD decision on #122 (item 2 A, item 3 A, "content tables empty"): content entities (articles, notes, videos, audio KBAT sets) with 0 rows loaded are expected, not red (section 9, red rule 6); the behaviour of the merged code for them is not checked here.

**Shell.** Every command is bash. On Windows run it inside WSL2 (Ubuntu) with Docker Desktop's WSL integration, with the checkout and `<extract dir>` on the WSL file system (not `/mnt/c`); on macOS use `sed -i ''` instead of `sed -i`. **Perlu pengesahan (LEAD):** the OS of the machine.

**What differs from host mode** (checked in `rehearsal-db.sh` and `rehearsal-db.md`):

- **Settings** come from `deploy/rehearsal/.env.rehearsal` (git-ignored; the script does not check its mode, so make it 600), not from `PP_REHEARSAL_ADMIN_URL`. Keys: `POSTGRES_USER`, `POSTGRES_PASSWORD` (letters and digits only, not starting `change-me`), `POSTGRES_DB` (`postgres`), `PP_REHEARSAL_DB` (keep `pp_rehearsal`: the script reads the file for itself but your shell does not, and `$DB` in section 5 and `--confirm "$DB"` of A1.13 assume that name), `PP_REHEARSAL_PORT` (55433), optional `PP_PG_*` tuning (defaults assume 4 GB RAM; A4 sets them to the VPS values). A variable already exported in the shell wins over the file, so unset them first.
- **Migrations by Prisma, not `psql`:** `up` builds and runs the migrate image, so there is no `psql path: applied <n> new migration(s)` line. Expect the compose build output, then the `prisma migrate deploy` output ending `All migrations have been successfully applied` (wording from `demo-cloudflare-supabase.md`, not seen here), then `[time] migrate (all schema migrations, prisma): <s>s`, `MIGRATION CHECK PASSED: <n> of <n> migrations applied in 'pp_rehearsal'`, `[time] up: <s>s`. Whether the NOTICE of migration 0018 (identifier truncated; `psql` printed it in host mode) shows with Prisma is not known: it is harmless either way.
- **Port:** the container publishes `127.0.0.1:55433` only (`status` shows `host: 127.0.0.1:55433`), never `0.0.0.0`. The host still needs Node 22, `npm ci`, `db:generate`, `psql`, `pg_dump`, `pg_restore` 16 and `gpg`: `exec`, `load-dump`, `stage` and the snapshots run on the host against that port.
- **Compose v2 or newer is required:** the script calls `docker compose -p pp-rehearsal` (never `docker-compose`), and the Dockerfile uses BuildKit cache mounts (the default in Compose v2). The sandbox had Compose v5.6.0.
- **Images:** the first `up` pulls `postgres:16-alpine` (the default registry, Docker Hub) and builds `pretasiplus-api-migrate:rehearsal` locally from `docker/api/Dockerfile` (target `build`), which pulls the base `node:22.22.2-alpine` and runs `npm ci` and `npm run be:build` (npm registry needed). The migrate image is built, not pulled; no data leaves the host.
- **`down --yes`** runs `docker compose down --volumes --remove-orphans` (container, network and the data volume with every database and template snapshot) and deletes the state dir. It does **not** remove the two images or `.env.rehearsal`. Never use `--keep-volume` at the close.

```bash
# Setup, once (I6, I7). Then paste the section 5 block (umask, RDB, DB, ASOF, DUMP, step, q) without its host-mode comment line.
unset PP_REHEARSAL_MODE PP_REHEARSAL_ADMIN_URL PP_REHEARSAL_DB PP_REHEARSAL_PORT POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
( umask 077; cp deploy/rehearsal/.env.rehearsal.example deploy/rehearsal/.env.rehearsal )
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" deploy/rehearsal/.env.rehearsal ; chmod 600 deploy/rehearsal/.env.rehearsal
docker compose version                        # Docker Compose version v2 or newer

# A1.0 pre-flight. Expect: LEAD's sha; nothing; F (36 at the time of the rehearsal); 4; 4; 1; tool versions; free disk >= 5 x dump
git rev-parse HEAD ; git status --short
ls -d apps/api/prisma/migrations/*/ | wc -l
grep -c '"migrate:all"\|"migrate:verify"\|"migrate:rollback"\|"migrate:delta"' apps/api/package.json
grep -c '"dump:check"\|"dump:cloud"\|"dump:produce"\|"dump:wipe"' apps/api/package.json
grep -c "'question_sets'" apps/api/src/migration/verify/entities.ts
node --version ; psql --version ; pg_dump --version ; pg_restore --version ; docker compose version
df -h <extract dir> ; free -m

# A1.1 receive. Expect: equal sha256; exit 0; "anon"; "<T> tables, <R> rows, anonymised=true" (T, R = the dump operator's report)
sha256sum <restricted dir>/pp-staging-dump-<date>.tar.gz.gpg
mkdir -m 700 <extract dir>
( set -o pipefail; gpg --decrypt <restricted dir>/pp-staging-dump-<date>.tar.gz.gpg | tar -xzf - -C <extract dir> ); echo "exit $?"
ls <extract dir> ; du -sh "$DUMP"
node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1]+"/manifest.json","utf8"));let n=0,t=0;for(const v of Object.values(m.tables)){t++;n+=v.rows}console.log(t+" tables, "+n+" rows, anonymised="+m.anonymised)' "$DUMP"
( cd "$DUMP" && find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum >SHA256SUMS )

# A1.2 up. Expect: "databases ready: pp_rehearsal, pp_rehearsal_staging; read-only role: pp_staging_reader", the image pull/build, prisma lines,
#   "MIGRATION CHECK PASSED: <n> of <n>" (n = F: GO POINT, else stop), "[time] up: <s>s"; status: "applied: <n> of <F>", no fsync WARNING
step up "$RDB" up
step status0 "$RDB" status

# A1.3 seed. Expect: "seed: profile=migration, 3 module(s): ...", users count 0
step seed "$RDB" exec target -- env NODE_ENV=production npm run db:seed -w @pp/api -- --profile=migration
q 'select count(*) from users'

# A1.4 load-dump. Expect: "dump kind: ndjson", "SHA256SUMS: OK", "attestation: ...", "Leak scan: clean", "Staging load finished: <t> tables, <r> rows." (r = R), exit 0
step load-dump "$RDB" load-dump "$DUMP"
shred -u -n 1 -z <restricted dir>/pp-staging-dump-<date>.tar.gz.gpg ; gpgconf --kill gpg-agent      # only after exit 0 (default of I8)

# A1.5 stage. Expect: "STAGE COPY PASSED: <b> tables", then archive_cloud|35 and staging_cloud|83
step stage "$RDB" stage
q "select table_schema, count(*) from information_schema.tables where table_schema in ('staging_cloud','archive_cloud') group by 1 order by 1"
step analyze q "ANALYZE"      # planner statistics for the staged tables (n_live_tup was 0 after the copy)

# A1.6 snapshots. Expect: "applied: <n> of <F>" with n = F; "snapshot 'pre_etl' created ...", "snapshot 'pre_etl_d' written as a dump (<size>)"; exit 0
"$RDB" status | grep 'applied:'
step snap-pre_etl "$RDB" snapshot pre_etl
step snap-pre_etl_d "$RDB" snapshot pre_etl_d --dump

# A1.7 profile. Expect: "Profile written: ... and ...", exit 0.   A1.8 dry-run. Expect: "migrate:all core dry-run: run <id> succeeded", activity skipped, exit 0
step profile "$RDB" exec target -- npm run staging:profile -w @pp/api
step all-dry "$RDB" exec target -- npm run migrate:all -w @pp/api -- --dry-run --as-of="$ASOF"

# A1.9 apply (the long step; B7). Expect: four "run <id> succeeded" lines, "migrate:all verify: succeeded", "verify pass: <n> entities, <m> checks", exit 0
step all-apply "$RDB" exec target -- env PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of="$ASOF"

# A1.10 verify. Expect: exit 0, "verify pass: ..."
step verify "$RDB" exec target -- npm run migrate:verify -w @pp/api

# A1.11 evidence queries: paste the q commands of A1.11 (a), (b), (c) and (e) as written ((d) is optional). Expect: 5 runs (the A1.8 core dry-run, then core and activity dry-run and apply of A1.9),
#   rejects by reason, the third reject query empty, reject % per entity within its threshold (content entities empty: expected), git_sha = the short sha of A1.0
# A1.12 snapshot. Expect: "snapshot 'after_full' created ...", exit 0
step snap-after_full "$RDB" snapshot after_full

# A1.13 rollback. Expect: probes a, b, c, d exit 2 each; dry-run and apply exit 0 ("migrate:rollback dry-run|apply on "pp_rehearsal": succeeded")
RB=(env PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 "PP_MIGRATE_TARGET_DB=$DB")
step probe-a env PP_ALLOW_MIGRATE_APPLY=1 "PP_MIGRATE_TARGET_DB=$DB" "$RDB" exec target -- env -u PP_ALLOW_MIGRATE_ROLLBACK npm run migrate:rollback -w @pp/api -- --confirm "$DB"
step probe-b env PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 "$RDB" exec target -- env -u PP_MIGRATE_TARGET_DB npm run migrate:rollback -w @pp/api -- --confirm "$DB"
step probe-c "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api -- --confirm not_the_database
step probe-d "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api
step rb-dry   "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api -- --confirm "$DB"
step rb-apply "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api -- --confirm "$DB" --apply

# A1.14 prove the rollback: paste the two q commands of A1.14. Expect: eleven counts 0 and etl_id_map 0
# A1.15 restore. Expect: "ROLLBACK VERIFIED ...", "MIGRATION CHECK PASSED: <n> of <n>", exit 0; applied <n> of <F>; etl_runs 0; archive_cloud|35, staging_cloud|83
step restore-pre_etl "$RDB" restore-snapshot pre_etl --yes
"$RDB" status | grep -E 'applied:|route'
q "select count(*) from etl_runs"
q "select table_schema, count(*) from information_schema.tables where table_schema in ('staging_cloud','archive_cloud') group by 1 order by 1"

# Close-out (section 10) after copying the figures out (status prints timings.log). Expect: "rehearsal environment removed. Still to do by hand: ..."
"$RDB" status
step down "$RDB" down --yes
shred -u -n 1 -z deploy/rehearsal/.env.rehearsal
find <extract dir> -type f -exec shred -u -n 1 -z {} + ; rm -rf <extract dir>      # default of I8 (alternative: keep until A4, LEAD decision)
gpgconf --kill gpg-agent ; docker image rm pretasiplus-api-migrate:rehearsal          # last one optional
```

Then the deletions of section 10 (reports under `.migration-out/`, temp files, history, terminal), the close line, and the evidence block of section 11 on #109. Optional steps O1 to O6 are in section 6 after A1.15. Details of each step: [A1.0](#a10-pre-flight-no-data-touched) [A1.1](#a11-receive-check-and-extract-the-dump) [A1.2](#a12-rehearsal-db-up-night-analogue-b0) [A1.3](#a13-reference-seed-the-etl-needs-the-reference-rows-before-migratecore) [A1.4](#a14-load-the-dump-night-analogue-b4) [A1.5](#a15-stage-copy-night-analogue-b5-copy) [A1.6](#a16-pre-etl-snapshot-and-the-migration-count-check-night-analogue-a5-restore-points) [A1.7](#a17-profile-night-analogue-b6-first-part) [A1.8](#a18-dry-run-night-analogue-b6-second-part) [A1.9](#a19-apply-night-analogue-b7) [A1.10](#a110-verify-stand-alone-night-analogue-b8) [A1.11](#a111-evidence-queries-read-only-aggregates-only) [A1.12](#a112-snapshot-of-the-migrated-state) [A1.13](#a113-rollback-guard-probes-dry-run-apply-night-analogue-rollback-r-b-of-plan-63) [A1.14](#a114-verify-the-rollback-result) [A1.15](#a115-restore-the-pre-etl-snapshot-and-check-night-analogue-case-2-restore).

## 1. What A1 is for

A1 runs the whole data path of the night once on the rehearsal DB, with the real shape and volume of `.cloud` data in the form of the AM-10 anonymised dump: load, stage copy, snapshot, profile, dry-run, apply, verify, rollback, restore. It answers three questions before A4:

1. Does the code at the release sha load the real-shaped data and pass `migrate:verify` (plan criteria 1 to 4 and 6)?
2. Do rollback and restore work and leave the database as it was (criterion 10 part)?
3. How long does each step take and what is the rate `r` in rows per second (input of P7)?

It does **not** prove: production mode (`NODE_ENV=production`; the rehearsal forces `development` and the ETL refuses anonymised data in production; the guards are exercised at A4), the `.cloud` freeze, the raw export, `slot.sh` or `restore-point.sh` (plan section 3.1), or the grants of the migration role: A1 runs the ETL as the rehearsal admin role, which owns every table, so a missing or too wide grant is not seen (the A4 Track S pass with the real P3 role is the check).

| Rehearsal (A1) | The night |
|---|---|
| `rehearsal-db.sh`; stage in a `<db>_staging` database on the same server | `slot.sh`; stage on a throwaway cluster |
| `NODE_ENV=development` (forced by `exec`) | `NODE_ENV=production` (set by `slot.sh etl`) |
| Anonymised data (dummy passwords) | Raw data |
| Snapshot = template database copy (and one `--dump` form) | Restore point = `pg_dump -Fc` (`restore-point.sh`) |
| `--as-of=2026-10-29`, the night's date (plan section 4), so rejects are comparable | Same |

## 2. Roles

| Role | Who | Does what in A1 |
|---|---|---|
| LEAD | The LEAD | Merges the PRs (P2), names the release sha, confirms the start, accepts the result, decides on red (section 9). Custodian of the dump copies. |
| Dump operator | The human who holds the read-only `.cloud` access | Runs the AM-10 sitting (`dump:produce`), encrypts, hands over, wipes the operator copy, sends the aggregates and the clock readings of section 3. |
| Half AZ DevOps | half AZ | Owns the rehearsal host: encrypted disk, free disk, rehearsal DB up, receives the hand-over and checks the checksum. |
| Half AM migration operator | half AM | Types the ETL commands of sections 6.8 to 6.17, reads the output, fills the tables, posts the evidence. |
| QA | half AZ | Not needed in A1. |

**Perlu pengesahan (LEAD):** who types the commands. The cutover plan section 2 gives "runs rehearsals" to the half AM migration operator; `mig07-real-data-pass.md` says "the dump operator, running ALONE". This sheet assumes the half AM migration operator types, with half AZ DevOps on the host, and the dump operator only does the sitting and the hand-over.

No Claude or other agent session runs these steps or sees the dump, the logs or the reports. Only the text of section 11 leaves the host.

## 3. Inputs and preconditions

All must be true before A1.0. A precondition with no evidence is not met.

| # | Input | Evidence (text, aggregates only) |
|---|---|---|
| I1 | **Release sha**: the merged tip after the LEAD merged #122, #160, #123, #125 and #166 (P2): `<sha>` (to be filled in by the LEAD; **Perlu pengesahan (LEAD):** that #160 is on the merge list). The verify matrix at that sha lists `question_sets` (an activity entity of #160, a row of the matrix of #123): without the row, `migrate:all --apply` and `migrate:verify` exit 1 with `question_sets ... mismatch` (found in the dress rehearsal). The checkout is clean and at that sha. | `git rev-parse HEAD` equals the LEAD's sha; the `question_sets` check of A1.0 prints 1. |
| I2 | **Dump**: the AM-10 anonymised dump, `pp-staging-dump/1`, made by `dump:produce` on the AM-10 sitting of 24 Oct (anonymised, leak-scanned; `manifest.json` carries `"anonymised": true`). The rehearsal environment refuses raw data. | The dump operator's step 9 report: date, exit code, tables, total rows, sha256 of the `.gpg`, offset `+08:00`, "free-text check passed", "raw wiped, key destroyed", "option file deleted" or "account locked" (AM-10 section 3 step 8 (c)), "local copies deleted". |
| I3 | **Encrypted hand-over**: `pp-staging-dump-<date>.tar.gz.gpg` (it holds the directory `anon`), received by `scp` into a restricted directory of the rehearsal host (`mkdir -m 700 <restricted dir>`, made under `umask 077`). The passphrase came by a different channel, never with the file, never in GitHub, chat or an AI session. | The sha256 of the received file equals the sender's value (A1.1). |
| I4 | **Files export for `--files-dir`** (AC9): normally **absent** in A1. AM-10 section 8.1 says files do not go with the anonymised dump by default unless the LEAD allows real banner images in a rehearsal. | If present: a directory `files` in the archive with `SHA256SUMS` at its root. If absent, A1 runs without `--files-dir`. `migrate:all` prints no files line (only the standalone `migrate:activity` prints `files: not migrated (no --files-dir) <n> references`), so the evidence is the command line without the flag. |
| I5 | **`--as-of`**: `2026-10-29` on every call that takes it: `migrate:all`, `migrate:delta` (required there) and the standalone `migrate:core` of O5. `migrate:verify` and `migrate:rollback` take no `--as-of`. | n/a |
| I6 | **Host**: full-disk encryption on every disk that holds the dump, the databases, the state dir and the reports (runbook rule 5; AM-10 section 2 item 1 has the check commands); free disk of at least 5 times the size of the dump; at least 4 GB RAM (recipe section 2); repo checkout, state dir and dump all on the encrypted disk, outside any cloud-sync folder; the dump and the state dir are outside the repo (the script refuses otherwise). | A confirmation line from half AZ DevOps; `df -h` free space as a number. |
| I7 | **Tools**: Node 22, `npm ci` done, `npm run db:generate -w @pp/api` done, PostgreSQL client 16 (`psql`, `pg_dump`, `pg_restore`), `gpg`, `tar`; docker mode also Docker with Compose v2; host mode a dedicated PostgreSQL 16 and a role with only CREATEDB and CREATEROLE (never a superuser). `deploy/rehearsal/.env.rehearsal` exists (docker mode) or `PP_REHEARSAL_ADMIN_URL` is in a 600 file (host mode). | Version lines. |
| I8 | **Retention.** Default (runbook section 0 rule 4, AM-10 section 4, `rehearsal-db.md` intro): the dump is deleted as soon as the load and the reconciliation succeed and kept 7 days at most. So the received `.gpg` and the passphrase note go as soon as A1.4 `load-dump` exits 0, and the extracted directory at the A1 close-out (section 10); A4 then loads a fresh hand-over (a new AM-10 sitting with a new key, AM-10 section 7). **DECISION NEEDED (LEAD) before A1.0:** the alternative is to keep the extracted directory until the end of A4 (plan sections 3.1 and 7), at the latest 31 Oct 2026. Costs of the default: (a) the `.gpg` stays until A1.4 exits 0, so a failure before that is retried from the same file, but a failure after the deletion needs a new sitting and a new key; (b) A4 needs a **second AM-10 sitting on 27 Oct**, which plan 4.1 does not schedule: a second read of `.cloud`, the `pp_dump_ro` unlock and lock, the option-file deletion (AM-10 section 3 step 8 (c)), a time-box, and the LEAD booking the slot. Hard rule for both: after a red integrity result (red rule 7 of section 9: `PII SCAN FAILED`, a manifest not anonymised, a checksum mismatch) every copy is wiped at the LEAD's written instruction, and by 31 Oct 2026 at the latest whatever the state; a moved date needs a new dump. The custodian is the LEAD. | The LEAD's decision line (default or alternative) and the LEAD's list of copies, A4 copies included (the receiver `.gpg` and `<extract dir 2>/anon` of the A4 sheet section 5.1, any `deleted-at-source-*.json`). |
| I9 | **Clock readings from the sitting** (for A4 rows T01 to T07): the dump operator writes down the clock time at: start of `dump:produce`; the line `Done: <n> tables, <rows> rows. This directory is RAW personal data...` (end of the export part, `cloud.ts:187` on #125); the line `Anonymised dump: ...` and the printed `Elapsed: <s> s`; start and end of encrypt (AM-10 step 6); end of the mandatory listing check; start and end of `scp`; the time the receiver confirmed the checksum; start and end of `dump:wipe`. Seconds only, no data. | A short text list. |

**Perlu pengesahan (dump operator, half AM):** `dump:produce` prints only one total (`Elapsed: <s> s`, `dump/cli.ts:229`) and no timestamps, so the `dump:cloud` part (the plan's `D_dump`) cannot be read from the output. The clock readings above are the way; a timestamping pipe on the command was not rehearsed and is not proposed.

**Perlu pengesahan (LEAD, dump operator, `.cloud` owner):** plan P6 says the file export of AC9 is timed with the 24 Oct sitting; AM-10 section 8.1 says rehearsals run without files unless the LEAD allows real banner images, and the export needs read-only shell access to the `.cloud` storage (P8). If it is not allowed, `D_dump` for files stays unmeasured until the night and the budget uses the plan's 25 min placeholder for the whole `D_dump`.

## 4. Rules for the whole run

- One terminal for the whole run. Close chat clients and any agent. No screen sharing.
- Output is copied into the tables of section 7 as numbers and fixed line names only. Do not paste whole logs. Do not paste the line `--apply target: database "<db>" on <host>` (it holds a host name), the `report files:` paths, or any error message text that the tool did not print as a fixed line. The same holds for the `--apply target:` line that `migrate:rollback --apply` and `migrate:core --apply` also print, and for the `ids <note>: ...` lines (lists of row ids) that the standalone `migrate:core` prints (`migrate:all` prints none).
- If a log is saved at all, it goes under the state dir (mode 700, outside the repo) and is deleted at the close (section 10).
- Never select `offending` or `legacy_id` from `etl_rejects` (mig07-real-data-pass section 3).
- A suspected PDPA incident (a dump or report in the wrong place, a copy on an unencrypted disk, a value in a post) is reported to the LEAD at once (runbook rule 8); do not clean up first.
- Order matters: a snapshot name can be used once (`rehearsal-db.sh snapshot` refuses an existing name and has no delete command). A repeat of the run starts with `reset --yes` (A1.2).

## 5. Setup: variables and two helpers

Run from the repo root of the release sha, in the one terminal.

```bash
umask 077                                # first: every file this run creates is private to the operator
RDB=deploy/rehearsal/rehearsal-db.sh
DB=${PP_REHEARSAL_DB:-pp_rehearsal}      # default name of the target database
ASOF=2026-10-29                          # --as-of, the night's date
DUMP=<extract dir>/anon                  # the extracted pp-staging-dump/1 directory, outside the repo
# docker mode: settings are read from deploy/rehearsal/.env.rehearsal (git-ignored)
# host mode:   export PP_REHEARSAL_MODE=host; set -a; . <600 file with PP_REHEARSAL_ADMIN_URL>; set +a
# only if I4 applies (files present):  FILES=<extract dir>/files   STORAGE=<empty absolute dir, outside the repo, not inside or around $FILES>

# prints one aggregate line per step: name, start, end (UTC), seconds, exit code
step() { local n=$1 s a=$SECONDS; shift; s=$(date -u +%FT%TZ); "$@"; local rc=$?
         printf 'STEP %s start=%s end=%s seconds=%s exit=%s\n' "$n" "$s" "$(date -u +%FT%TZ)" $((SECONDS - a)) "$rc"; return "$rc"; }

# one SQL statement on the target database; the URL and its password stay in the environment of the child, never in argv
q() { "$RDB" exec target -- node -e 'const u=new URL(process.env.DATABASE_URL);const r=require("child_process").spawnSync("psql",["-Atq","-c",process.argv[1]],{stdio:"inherit",env:{...process.env,DATABASE_URL:"",PGHOST:u.hostname.replace(/^\[|\]$/g,""),PGPORT:u.port||"5432",PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),...(u.searchParams.get("sslmode")?{PGSSLMODE:u.searchParams.get("sslmode")}:{})}});process.exit(r.status??1)' "$1"; }
```

Notes on the helpers: `step` only wraps a command; it adds no data. `q` takes the connection URL from the environment that `rehearsal-db.sh exec` gives the child and hands it to `psql` as `PG*` variables, so neither the URL nor the password is ever on a command line (runbook section 0 rule 7; checked with `ps` in the dress rehearsal: only the SQL text is in argv, so a query must never contain a value). It replaces the form of `mig07-rehearse.sh` (`psql "$DATABASE_URL"`), which does put the URL in argv.

## 6. Run sheet

Each step: command, what to expect, what to record. "Exit" means the exit code; every step expects 0 unless it says otherwise. Do not go to the next step on a red result (section 9).

### A1.0 Pre-flight (no data touched)

```bash
git rev-parse HEAD ; git status --short                   # sha = I1; second command prints nothing
ls -d apps/api/prisma/migrations/*/ | wc -l                # folder count F (plan A5 form)
grep -c '"migrate:all"\|"migrate:verify"\|"migrate:rollback"\|"migrate:delta"' apps/api/package.json   # 4: PR #123 is in this sha
grep -c '"dump:check"\|"dump:cloud"\|"dump:produce"\|"dump:wipe"' apps/api/package.json                # 4: PR #125 is in this sha
grep -c "'question_sets'" apps/api/src/migration/verify/entities.ts                                   # 1: the verify matrix knows question_sets (0: stop, see I1)
node --version ; psql --version ; pg_dump --version ; pg_restore --version
df -h <extract dir> ; free -m
```

Record: sha, F, tool versions, free disk (GB), RAM (MB). Host class (CPU count, RAM, disk type) without names.

### A1.1 Receive, check and extract the dump

Owner: half AZ DevOps (receiver). Mapping: night B3 (receiving part).

```bash
sha256sum <restricted dir>/pp-staging-dump-<date>.tar.gz.gpg      # must equal the sender's value from I2/I3
mkdir -m 700 <extract dir>
( set -o pipefail; gpg --decrypt <restricted dir>/pp-staging-dump-<date>.tar.gz.gpg | tar -xzf - -C <extract dir> ); echo "exit $?"
ls <extract dir>                                                   # anon (and files, only if I4)
du -sh "$DUMP"                                                      # size of the dump
node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1]+"/manifest.json","utf8"));let n=0,t=0;for(const v of Object.values(m.tables)){t++;n+=v.rows}console.log(t+" tables, "+n+" rows, anonymised="+m.anonymised)' "$DUMP"
```

Sources: extraction form = cutover plan section 4.6 B3; manifest shape `{format, source, anonymised, tables: {name: {rows, file}}}` from `anonymise/run.ts:187-193` (#125).

Expect: the two sha256 values are equal (a mismatch: do not decrypt; ask for one new hand-over; a second mismatch is red). Exit 0. The node line prints `<T> tables, <R> rows, anonymised=true`; `T` and `R` equal the dump operator's report (I2). Record `T` and `R` as **N_manifest** (the headline N of P7).

Then add the checksum file that the loader needs. `dump:produce` writes **no** checksum for the ndjson directory (`rehearsal-db.md` section 2), so the receiver adds one, after the `.gpg` checksum matched:

```bash
( cd "$DUMP" && find . -type f ! -name SHA256SUMS -print0 | LC_ALL=C sort -z | xargs -0 sha256sum >SHA256SUMS )
```

(command from `rehearsal-db.md` section 2). This protects the copy from here on only; the chain of trust is the `.gpg` checksum. **Perlu pengesahan (half AZ):** that the receiver, not the LEAD, creates this file.

The received `.gpg` and the passphrase note stay until A1.4 `load-dump` has exited 0 (I8): a failure before that is retried from the same file. Then (default of I8) the receiver deletes them: `shred -u -n 1 -z <restricted dir>/pp-staging-dump-<date>.tar.gz.gpg`, then `gpgconf --kill gpg-agent`; `ls <restricted dir>` shows it empty. If A1.4 fails after this deletion for a reason in the dump, a new sitting with a new key is needed.

If I4 applies: check `ls <extract dir>/files/SHA256SUMS` exists; create `STORAGE` (`mkdir -m 700`).

### A1.2 Rehearsal DB up (night analogue: B0)

```bash
step up "$RDB" up
step status0 "$RDB" status
```

Expect from `up`: `databases ready: <db>, <db>_staging; read-only role: pp_staging_reader`, then (host mode default, `psql`) `psql path: applied <n> new migration(s)` and `[time] migrate (all schema migrations, psql): <s>s` (docker mode: `prisma`; a `NOTICE: identifier ... will be truncated` line from migration 0018 is harmless), then `MIGRATION CHECK PASSED: <n> of <n> migrations applied in '<db>'`, then `[time] up: <s>s`. Exit 0.
Expect from `status`: no `WARNING: fsync / synchronous_commit / full_page_writes is off here` (if present, the write timings are **not** production-like: note it; the figures stay valid for correctness but are amber for P7); `applied: <n> of <n> in the folder`.

Record: `up` seconds; `n` = `F` (migration count equals the folder count); the settings printed by `status` (shared_buffers, work_mem, max_connections, wal_level, fsync); server version line.

A **repeat** of A1 (after a red) starts here with `step reset "$RDB" reset --yes` instead of `up` (it drops every rehearsal database and snapshot and runs `up` again).

### A1.3 Reference seed (the ETL needs the reference rows before `migrate:core`)

```bash
step seed "$RDB" exec target -- env NODE_ENV=production npm run db:seed -w @pp/api -- --profile=migration
q 'select count(*) from users'
```

Source: MIG-07 pass 2 (P2.1) and `mig07-rehearse.sh` (`seed_reference`, `assert_no_users`). It runs in `NODE_ENV=production` on purpose: only `kind: 'reference'` modules run and the demo modules are skipped (seed runner, `prisma/seed/index.ts`).
Expect: exit 0; a line `seed: profile=migration, <k> module(s): <names>` (MIG-07 saw 3 reference modules; record the number and names); the count of users is **0**. Any user means a demo seed ran: red.

### A1.4 Load the dump (night analogue: B4)

```bash
step load-dump "$RDB" load-dump "$DUMP"
```

`load-dump` for an ndjson directory does, in order (`rehearsal-db.sh:cmd_load_dump`): checks the format, the checksum, the attestation; runs `anonymise:scan` (patterns only); runs `staging:load --from` into `<db>_staging` with `PP_ALLOW_STAGING_RESET=1` and `NODE_ENV=development`.
Expect lines: `dump kind: ndjson`; `SHA256SUMS: OK`; `attestation: manifest is marked anonymised/synthetic`; the pattern scan `Scanned <r> rows, <c> cells.` and `Leak scan: clean (patterns only).`; one `Loaded staging_cloud.<table>: <n> rows.` per non-empty table (and `archive_cloud.<table>` lines); `Staging load finished: <t> tables, <r> rows.`; `Done: <t> tables (<k> absent from the input), <r> rows.`; `[time] load-dump (ndjson): <s>s`. Exit 0.
Failure lines that mean red: `SHA256 MISMATCH`, `no anonymisation attestation`, `PII SCAN FAILED: the dump holds personal-looking data. Nothing was loaded; tell the lead.`, `staging:load` exit 3 (source role can write) or 4 (reset guard refused). The loader itself fails (exit 1) when rows read differ from the manifest.

On exit 0 delete the received `.gpg` and the passphrase note as described in A1.1.

Record: seconds (this is the scan **plus** the load; the scan alone can be timed with `npm run anonymise:scan -w @pp/api -- --dir "$DUMP"` if the LEAD wants the split), `r` equal to `R` of A1.1, number of tables, the number of absent tables (`k`).

### A1.5 Stage copy (night analogue: B5 copy)

```bash
step stage "$RDB" stage
q "select table_schema, count(*) from information_schema.tables where table_schema in ('staging_cloud','archive_cloud') group by 1 order by 1"
step analyze q "ANALYZE"      # planner statistics for the staged tables (n_live_tup was 0 after the copy)
```

For the ndjson route `stage` only copies the two schemas (`pg_dump -Fc -n staging_cloud -n archive_cloud | pg_restore`) after dropping old copies in the target.
Expect: `STAGE COPY PASSED: <b> tables (staging_cloud + archive_cloud) now in <db>`; `[time] stage-copy: <s>s`. Exit 0. The query returns `archive_cloud|35` and `staging_cloud|83` (runbook 12 step 1; `slot.sh` expects the same). Any other number: red (the staging spec and the dump disagree).

Then `ANALYZE` (the `step analyze` line). The stage copy leaves no planner statistics (`n_live_tup` = 0 in the profile), so the ETL queries can pick unstable plans. `ANALYZE` of the whole database covers `staging_cloud`, `archive_cloud` and the v2 tables; it writes statistics only, no rows. It runs before the `pre_etl` snapshot, so the snapshot keeps them. Statistics of the v2 targets after the core apply would need a run between the stages of `migrate:all`, which the command does not offer (it runs core and activity back to back); that is a proposed code change, not an operator step. Night analogue: after B5 `S copy`, before B6.

Record: seconds; the two counts; the `ANALYZE` seconds.

### A1.6 Pre-ETL snapshot and the migration-count check (night analogue: A5 restore points)

No other session may be connected to the target (the template copy needs none).

```bash
"$RDB" status | grep 'applied:'                     # applied: <n> of <F> in the folder
step snap-pre_etl "$RDB" snapshot pre_etl
step snap-pre_etl_d "$RDB" snapshot pre_etl_d --dump     # the dump form: the realistic restore timing
```

Expect: `applied: <n> of <F> in the folder` with `n = F`. If `n` is smaller, the snapshot would fail the migration check on restore (MIG-07 pass 4: a 33-migration snapshot on a 36-migration tree gave `MIGRATION CHECK FAILED`): run `up` and take the snapshot again under another name, or `reset --yes` and start A1.2 again. Then `snapshot 'pre_etl' created as database <db>__snap_pre_etl`, `recorded row counts of <n> tables`, `[time] snapshot pre_etl: <s>s`; for the dump form `snapshot 'pre_etl_d' written as a dump (<size>)`, then the same two lines. Exit 0.

Record: `n` and `F` as text (this is the "migration count = folder count" evidence), seconds of both snapshots, the size of the dump snapshot.

### A1.7 Profile (night analogue: B6, first part)

```bash
step profile "$RDB" exec target -- npm run staging:profile -w @pp/api
```

Expect: `Profile written: <md path> and <json path>.`; exit 0. The profile holds aggregates only (the renderer states it). Read it on the host and record: the orphan, duplicate and enum counts that the runbook section 4 tells you to read. The files stay under `.migration-out/` (git-ignored); they are not posted.

### A1.8 Dry-run (night analogue: B6, second part)

```bash
step all-dry "$RDB" exec target -- npm run migrate:all -w @pp/api -- --dry-run --as-of="$ASOF"
# if I4 applies add:  --files-dir="$FILES"
```

Do not pass `--content-owner` here (the plan's B6 and B7 lines have none; see the note after A1.9). A dry-run writes no v2 data table, but it does write `etl_runs`, `etl_recon` and `etl_rejects` rows (runbook section 12).
Expect: exit 0; `migrate:all core dry-run: run <id> succeeded` followed by the table `entity | source | eligible | loaded | rejected | status`; then `migrate:all activity dry-run: skipped (needs migrate:core --apply first)` (this is expected on a first load: `orchestrate.ts`, `ACTIVITY_NEEDS_CORE`).

Record: seconds; for each entity of the core table: source, eligible, loaded, rejected (section 7 table); the run id.

### A1.9 Apply (night analogue: B7)

```bash
step all-apply "$RDB" exec target -- env PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:all -w @pp/api -- --apply --as-of="$ASOF"
# if I4 applies:  "$RDB" exec target -- env PP_ALLOW_MIGRATE_APPLY=1 FILE_STORAGE_DIR="$STORAGE" npm run migrate:all -w @pp/api -- --apply --as-of="$ASOF" --files-dir="$FILES"
# optional peak memory: put  /usr/bin/time -v  directly before  npm  and read "Maximum resident set size (kbytes)" from its stderr
```

`migrate:all --apply` runs, per stage (core then activity), a dry-run and then the apply with identical options; stops at the first failed stage; then runs the verify and exits 1 unless it passes (`orchestrate.ts` header).
Expect: exit 0; the lines `migrate:all core dry-run: run <id> succeeded`, `migrate:all core apply: run <id> succeeded`, `migrate:all activity dry-run: run <id> succeeded`, `migrate:all activity apply: run <id> succeeded` each followed by its entity table; then `migrate:all verify: succeeded` (`failed` on red), `verify pass: <n> entities, <m> checks, runs <ids>` and the verify table. The first line of the output, `--apply target: ...`, holds a host name: do not copy it.

Record: seconds (this is **B7**, including the verify at the end); the four run ids; exit; peak RSS if you used GNU time (**Perlu pengesahan (half AZ):** `/usr/bin/time` is installed on the host; the value is the largest single process, not the sum); `n` and `m` of the verify line; the non-`ok` check rows printed by name and status (ledger, correct-sum, drift: criterion 6; read them, do not "fix" them).

**Content owner (decision input).** Without `--content-owner`, content rows (articles, notes, videos) have no owner and are rejected `ORPHAN_PARENT` (MIG-07 pass 5). The owner must be an **active v2 admin**, and none exists before the load, so MIG-07 found one by a scout core apply and a restore of `pre_etl`; ids follow load order. The plan's B6 and B7 command lines have no `--content-owner`. **Perlu pengesahan (LEAD, half AM):** whether the night passes one and how its id is found. A1 runs as the plan is written and records the content-entity rejects; optional step O5 shows the scout. LEAD decision on #122 (item 2 A, item 3 A, "content tables empty"): content entities with 0 rows loaded are expected, not red.

### A1.10 Verify, stand-alone (night analogue: B8)

```bash
step verify "$RDB" exec target -- npm run migrate:verify -w @pp/api
```

Expect: exit 0 and a line `verify pass: <n> entities, <m> checks, runs <...>`. The gate is the exit code and the word `pass`, not the numbers (plan B8). For comparison only: the synthetic 20k-user runs of MIG-07 gave 37 entities and 16 checks on a full state; the dress rehearsal at a sha with `question_sets` gave 38 entities and 16 checks (a `question_sets ... mismatch` row means the matrix row is missing, I1).
Any other status (`verify fail`, a `check ... mismatch` line, exit 1): red.

Record: seconds, `n`, `m`, the list of non-`ok` check rows (name and status only). Open the verify `.md` named on the `report files:` line, on the host, and read the orphan scan row (criterion 4: must be 0) and the ledger / correct-sum / drift rows.

### A1.11 Evidence queries (read-only, aggregates only)

(a) Run durations and row counts per stage. A run row is one dry-run or apply of one stage. Stage `core` is recognised the way the code does it (`orchestrate.ts`, `assertFirstLoadExists`: the entity set contains `users` and `classrooms`).

```bash
q "select r.id, r.mode, case when r.entity_set @> array['users','classrooms']::text[] then 'core' else 'activity' end as stage, r.status, left(r.git_sha, 8) as git_sha, round(extract(epoch from r.finished_at - r.started_at)::numeric, 1) as seconds, (select sum(c.source_count) from etl_recon c where c.run_id = r.id) as rows_read, (select sum(c.loaded) from etl_recon c where c.run_id = r.id) as rows_loaded, (select sum(c.rejected) from etl_recon c where c.run_id = r.id) as rows_rejected from etl_runs r where 'cloud' = any(r.sources) order by r.id"
```

Columns used: `etl_runs.id, mode, entity_set, status, git_sha, started_at, finished_at, sources` and `etl_recon.run_id, source_count, loaded, rejected` (migration `0003_etl_control_tables`). `git_sha` is recorded for every run since `73c46763` (#123): `migrate:all` and `migrate:delta` pass `resolveGitSha(ctx.env)` to the run, as the standalone `migrate:core` and `migrate:activity` do. At or after that sha an empty value is red (a stale checkout), and the value must equal the short form of the `git rev-parse HEAD` of A1.0: this is the "git sha" evidence of the run (checklist item 4). `resolveGitSha` reads `PP_GIT_SHA` or `GIT_SHA` first, so neither may be set to anything else. This red rule holds for A1 in host mode, where the checkout has `.git`. In a container (`slot.sh etl`, the night) the image has no `.git`, so `git_sha` is empty unless `PP_GIT_SHA` is passed (#166); there an empty value means "not passed", not a stale checkout (runbook section 12).

(b) Rejects by reason and by entity, for the succeeded apply runs only (every run, dry-runs included, writes its reject rows again, MIG-07 problem 8). Never add `offending` or `legacy_id`.

```bash
q "select r.reason, count(*) from etl_rejects r join etl_runs u on u.id = r.run_id where u.mode = 'apply' and u.status = 'succeeded' group by 1 order by 2 desc"
q "select r.entity, r.reason, count(*) from etl_rejects r join etl_runs u on u.id = r.run_id where u.mode = 'apply' and u.status = 'succeeded' group by 1, 2 order by 1, 3 desc"
q "select r.entity, count(*) from etl_rejects r join etl_runs u on u.id = r.run_id where u.mode = 'apply' and u.status = 'succeeded' and r.reason = 'ORPHAN_PARENT' and r.entity in ('users','schools') group by 1"
```

The first query is the one in `mig07-real-data-pass.md` section 3. The third must return **no rows** (criterion 3).

(c) Reject percentage per entity against the thresholds of plan section 5 criterion 2 (0.1 % for `users` and `schools`, 0.5 % for every other entity):

```bash
q "select c.entity, c.source_count, c.rejected, round(100.0 * c.rejected / nullif(c.source_count, 0), 3) as reject_pct from etl_recon c join etl_runs r on r.id = c.run_id where r.mode = 'apply' and r.status = 'succeeded' order by c.entity"
```

(d) Size and WAL (optional, recipe section 11): run `"$RDB" status` after the apply and note the database sizes; take `q 'select pg_current_wal_lsn()'` before A1.9 and after A1.10, then `q "select pg_wal_lsn_diff('<after>','<before>')::bigint"`.

(e) Forced password change after migration (input to BUG AM2-A1 on #113; counts only, never ids):

```bash
q "select count(*) filter (where must_reset_password) as flagged, count(*) as migrated from public.users where legacy_source = 'cloud'"
```

The reasons come from `transform/secrets.ts` (`decidePassword`: `non_bcrypt`, `shared_default`, `roster_account`; one account can have several). `migrate:all` does not print them; the standalone `migrate:core` prints them as `note must_reset.<reason>: <n>` lines, so read them from the O5 scout if it runs (copy only those `note` lines, never the `ids <note>:` lists). Post line: `forced-change accounts: <flagged> of <migrated> (<pct> %), by reason non_bcrypt <n>, shared_default <n>, roster_account <n> (or "reasons: O5 not run")`. On the anonymised dump every password is a dummy hash, so `non_bcrypt` and the total may differ from the real night; `roster_account` (a username and no e-mail) carries over.

### A1.12 Snapshot of the migrated state

```bash
step snap-after_full "$RDB" snapshot after_full
```

Expect `snapshot 'after_full' created as database <db>__snap_after_full`; exit 0. It is the restore target of the optional steps O1 to O3.

### A1.13 Rollback: guard probes, dry-run, apply (night analogue: rollback R-b of plan 6.3)

The rollback needs, in every environment and also for the dry-run, `PP_ALLOW_MIGRATE_ROLLBACK=1`, `PP_ALLOW_MIGRATE_APPLY=1`, `PP_MIGRATE_TARGET_DB=<db>` and `--confirm <db>`; a missing or wrong value exits 2 and changes nothing (`verify/rollback.ts:rollbackLegacy`, runbook section 16). Set the three variables for one command only:

```bash
RB=(env PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 "PP_MIGRATE_TARGET_DB=$DB")
```

**Probes** (each must exit **2**; an exit 0 is a guard that accepts what it must refuse: red). They run on the migrated state and write nothing:

```bash
# a. no PP_ALLOW_MIGRATE_ROLLBACK
step probe-a env PP_ALLOW_MIGRATE_APPLY=1 "PP_MIGRATE_TARGET_DB=$DB" "$RDB" exec target -- env -u PP_ALLOW_MIGRATE_ROLLBACK npm run migrate:rollback -w @pp/api -- --confirm "$DB"
# b. no PP_MIGRATE_TARGET_DB (required in every environment, not only in production)
step probe-b env PP_ALLOW_MIGRATE_ROLLBACK=1 PP_ALLOW_MIGRATE_APPLY=1 "$RDB" exec target -- env -u PP_MIGRATE_TARGET_DB npm run migrate:rollback -w @pp/api -- --confirm "$DB"
# c. wrong --confirm
step probe-c "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api -- --confirm not_the_database
# d. no --confirm at all
step probe-d "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api
```

Expected refusal text (stderr, from `verify/rollback.ts` and `orchestrate.ts`):

| Probe | Expected line |
|---|---|
| a | `Refusing migrate:rollback (dry-run): set PP_ALLOW_MIGRATE_ROLLBACK=1 to allow it (never after go-live without a LEAD decision). Nothing was changed.` |
| b | `Refusing migrate:rollback (dry-run): PP_MIGRATE_TARGET_DB must equal the connected database name ("<db>") in every environment. Nothing was changed.` |
| c | `Refusing migrate:rollback (dry-run): the confirmed database name does not match the connected database "<db>". Nothing was changed.` |
| d | `--confirm=<database name> is required (it must equal the connected database).` |

**Dry-run, then apply.** The dry-run runs the deletes and rolls them back, so it takes row locks on the migrated tables: no other session may be connected, and never start a load during a rollback.

```bash
step rb-dry   "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api -- --confirm "$DB"
step rb-apply "${RB[@]}" "$RDB" exec target -- npm run migrate:rollback -w @pp/api -- --confirm "$DB" --apply
```

Expect for each: exit 0; `migrate:rollback dry-run on "<db>": succeeded` (apply: the `--apply target:` line first, do not copy it, then `migrate:rollback apply on "<db>": succeeded`); the table `table | deleted`; `etl_id_map | <n>`; possibly `released <table>: <n>` and `warning: ...` lines for reference tables (read them). MIG-07 measured the apply at 19 s (pass 3) and 31.7 s (pass 4), and the dry-run at 36.6 s (pass 4), on 20k synthetic users. Refusals that mean red here: `RollbackRefusedError` (exit 2) because a v2-born row references a migrated row, or because an apply run is still `running` in `etl_runs`.

Record: seconds and exit of the four probes, the dry-run and the apply; deleted rows per table (counts).

### A1.14 Verify the rollback result

Do **not** run `migrate:verify` here: it reads the loaded data and exits 1 by design after a rollback (runbook section 16, "Prove the result"; MIG-07 P3.5 note 3). The proof is by counts:

```bash
q "select 'users', count(*) from public.users union all select 'etl_id_map', count(*) from public.etl_id_map union all select 'schools', count(*) from public.schools union all select 'classrooms', count(*) from public.classrooms union all select 'enrolments', count(*) from public.enrolments union all select 'parent_links', count(*) from public.parent_links union all select 'practice_sessions', count(*) from public.practice_sessions union all select 'practice_answers', count(*) from public.practice_answers union all select 'coin_ledger', count(*) from public.coin_ledger union all select 'wallets', count(*) from public.wallets union all select 'referral_codes', count(*) from public.referral_codes"
q "select count(*) from etl_id_map where legacy_source = 'cloud'"
```

The first query is the list of migrated tables of `mig07-rehearse.sh` (`MIGRATED_TABLES`). On the rehearsal DB there is no v2-born row (the seed created no user, A1.3), so **every count must be 0**. If the rollback printed `released ...` or `warning:` lines, run the idempotent seed again (`step seed2 "$RDB" exec target -- env NODE_ENV=production npm run db:seed -w @pp/api -- --profile=migration`) and count again. `etl_runs`, `etl_recon`, `etl_rejects` and `_prisma_migrations` stay (audit trail): they are the only tables that may differ from the snapshot at this point.

Record: the eleven counts and the `etl_id_map` count as text. Any count above 0: red.

### A1.15 Restore the pre-ETL snapshot and check (night analogue: Case 2 restore)

```bash
step restore-pre_etl "$RDB" restore-snapshot pre_etl --yes
"$RDB" status | grep -E 'applied:|route'
q "select count(*) from etl_runs"
q "select table_schema, count(*) from information_schema.tables where table_schema in ('staging_cloud','archive_cloud') group by 1 order by 1"
```

Expect: exit 0; `ROLLBACK VERIFIED: every table of <db> has the snapshot's row count again (<c> table(s) differed before the rollback)`; `MIGRATION CHECK PASSED: <n> of <n> migrations applied in '<db>'`; `[time] restore-snapshot pre_etl: <s>s`. After the restore: `applied: <n> of <F>`, `etl_runs` count 0 (the snapshot had no run), and the stage still there (`archive_cloud|35`, `staging_cloud|83`), because the snapshot was taken after the stage copy.
Red: `ROLLBACK CHECK FAILED: row counts differ from the snapshot`, `MIGRATION CHECK FAILED: <a> applied, <f> in apps/api/prisma/migrations`, `snapshot dump checksum failed`, a missing `snapshot database ... is missing`.

Record: seconds (template copy: expect seconds, MIG-07 saw 3 to 6 s), `c`, `n` and `F`, the three counts above.
The dump-form snapshot is restored in O3 (the realistic timing).

### Optional block, in this order, if time allows (all are recorded the same way)

**O1. Restore a migrated state and verify it.**

```bash
step restore-after_full "$RDB" restore-snapshot after_full --yes
step verify-after-restore "$RDB" exec target -- npm run migrate:verify -w @pp/api
```

Expect: `ROLLBACK VERIFIED ...`, `MIGRATION CHECK PASSED ...`, then exit 0 and `verify pass: ...` (a restored migrated state verifies; MIG-07 P3.5 (b)). Record both durations. This is the timing of "restore of a migrated point" (plan P1, replan).

**O2. Idempotency run (plan section 4.7; runbook 13 item 16). Needs O1 first (restore `after_full`).** After A1.13 and A1.15 the database is at `pre_etl` with no migrated users, and `migrate:delta` then exits 2 ("No earlier succeeded migrate:core --apply run with loaded users: run migrate:all --apply first", `orchestrate.ts`, `assertFirstLoadExists`). The same stage, a delta dry-run and apply; every row must be `unchanged`. `--since` is the ISO time of the 24 Oct dump with a zone (from the dump operator's clock readings), for example `2026-10-24T09:00:00+08:00`; it only feeds the delta report.

```bash
step delta-dry "$RDB" exec target -- npm run migrate:delta -w @pp/api -- --since="<T-dump ISO with +08:00>" --as-of="$ASOF"
step delta-apply "$RDB" exec target -- env PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:delta -w @pp/api -- --apply --since="<T-dump ISO with +08:00>" --as-of="$ASOF"
step verify-after-delta "$RDB" exec target -- npm run migrate:verify -w @pp/api
```

(Add `--files-dir="$FILES"` and the `FILE_STORAGE_DIR` variable to both delta lines if I4 applied to A1.9.) Expect: exit 0; the delta table `stage | entity | read | inserted | updated | unchanged` with **inserted = 0 and updated = 0 on every row**; the warning line `warning: cannot verify --as-of against the first load; make sure it is the same value` (always printed); `delta report: <path>`; exit 0 for the verify. A delta apply takes about as long as the full apply (MIG-07: 515 s no-op against 527 s full), so this step gives the second measurement of `r`. Any inserted or updated row on an unchanged stage: red (runbook 14 item 7).

**O3. Restore from the migrated state to `pre_etl` (the night's Case 2 shape), then the dump-form snapshot.**

```bash
step restore-pre_etl-2 "$RDB" restore-snapshot pre_etl --yes
step restore-pre_etl_d "$RDB" restore-snapshot pre_etl_d --yes
```

Record both durations. The second is the realistic `pg_restore` timing (MIG-07 never timed a `--dump` restore); it checks the snapshot's sha256 first and rebuilds the database from the dump file.

**O4. The way forward after a rollback (runbook 13 item 21).** From the restored `pre_etl` state, `migrate:all --dry-run`, then `--apply` (as A1.8 and A1.9), then `migrate:verify`: it must give `verify pass` again. It costs one more full apply; do it only if the LEAD asks.

**O5. Content-owner scout (decision input for the open point of A1.9).** From the `pre_etl` state, as in MIG-07 pass 3 and pass 5:

```bash
step scout-core-dry "$RDB" exec target -- npm run migrate:core -w @pp/api -- --dry-run --as-of="$ASOF"
step scout-core-apply "$RDB" exec target -- env PP_ALLOW_MIGRATE_APPLY=1 npm run migrate:core -w @pp/api -- --apply --as-of="$ASOF"
q "select u.id from users u join user_roles r on r.user_id = u.id where r.role::text = 'admin' and u.is_active and not u.is_suspended order by u.id limit 1"
step scout-restore "$RDB" restore-snapshot pre_etl --yes
```

Record whether an active admin was found (yes/no) and the seconds, not the id in any shared post. The standalone `migrate:core` prints `note ...` and `ids <note>: ...` lines too (row ids): read them on the host, never post them. A full run with `--content-owner=<id>` is then A4's job if the LEAD decides to use one. (`migrate:core` is the standalone command: allowed on the rehearsal DB because nothing else runs; it takes the source lock since AM-08 and exits 2 if the lock is held. `slot.sh etl` refuses it at the night.)

**O6. Delta with changed rows.** Needs a second dump after known changes (recipe section 7). Only one dump is planned on 24 Oct, so this is **not** part of A1 unless the LEAD orders a second sitting. The idempotency run O2 is the delta timing for A1; plan P1 marks the delta "replan only".

## 7. Recording template

Copy the tables into the issue comment as text. Aggregates only.

**7.1 Steps.** One row per step. `Rows` = source rows read, loaded, rejected where the step has them.

| Step | Plan id | Start (UTC) | End (UTC) | Seconds | Exit | Rows (read / loaded / rejected) | Run ids | Git sha | Peak RSS | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| A1.2 up | B0 | | | | | n/a | n/a | | n/a | n = F? |
| A1.3 seed | | | | | | n/a | n/a | | n/a | modules, users = 0 |
| A1.4 load-dump | B4 | | | | | tables / rows | n/a | | | scan plus load |
| A1.5 stage | B5 | | | | | n/a | n/a | | n/a | 83 / 35 |
| A1.6 snapshot pre_etl | A5 | | | | | n/a | n/a | | n/a | n of F |
| A1.6 snapshot pre_etl_d (dump) | A5 | | | | | n/a | n/a | | n/a | size |
| A1.7 profile | B6 | | | | | n/a | n/a | | | |
| A1.8 migrate:all dry-run | B6 | | | | | core | | | | activity skipped |
| A1.9 migrate:all apply | B7 | | | | | core + activity | 4 ids | | | verify inside |
| A1.10 migrate:verify | B8 | | | | | n/a | | | | n entities, m checks |
| A1.12 snapshot after_full | | | | | | n/a | n/a | | n/a | |
| A1.13 probes a, b, c, d | | | | | 2, 2, 2, 2 | n/a | n/a | | n/a | |
| A1.13 rollback dry-run | R-b | | | | | deleted | | | | |
| A1.13 rollback apply | R-b | | | | | deleted | | | | |
| A1.15 restore-snapshot pre_etl | Case 2 | | | | | n/a | n/a | | n/a | c tables differed |
| O1 restore after_full, verify | | | | | | | | | | |
| O2 delta dry-run, apply, verify | 4.7 | | | | | | | | | all unchanged? |
| O3 restore pre_etl, pre_etl_d | | | | | | | | | | |

**7.2 Rows per entity** (from the output of A1.8 and A1.9, one row per entity, both stages). Source from the manifest = the `source` column.

| Stage | Entity | Source | Eligible | Loaded | Rejected | Reject % | Threshold % | Status |
|---|---|---|---|---|---|---|---|---|
| core | `<entity>` | | | | | | 0.1 or 0.5 | |
| activity | `<entity>` | | | | | | 0.5 | |

**7.3 Rejects by reason** (A1.11 b): `ORPHAN_PARENT`, `UNKNOWN_ENUM`, `INVALID_VALUE`, `DUPLICATE_KEY`, `UNSUPPORTED`, each with a count and the top entity and column (names only). Each reason needs an explanation for the LEAD (criterion 2).

**7.4 Non-`ok` verify rows** (ledger sums, correct-sum, drift, other): name, status, expected, actual (numbers only). The LEAD reads and accepts each at A4 (criterion 6); at A1 they only have to be listed.

## 8. Derived rates (for P7)

Computed from section 7 after A1.11 (a). `s(...)` is the `seconds` column of the run, `N(...)` its `rows_read`.

| Symbol | Formula | Meaning |
|---|---|---|
| `N_core` | `rows_read` of the core apply run | Rows read by the core stage in one pass |
| `N_act` | `rows_read` of the activity apply run | Rows read by the activity stage in one pass |
| `r_core_apply` | `N_core / s(core apply)` | rows per second, core |
| `r_act_apply` | `N_act / s(activity apply)` | rows per second, activity |
| `r_overall_apply` | `(N_core + N_act) / (s(core apply) + s(activity apply))` | rows per second, both stages |
| `r_core_dry` | `N_core / s(core dry-run of A1.9)` | dry-run rate |
| `r_B6` | `N_core / (s(profile) + s(first core dry-run, A1.8))` | plan's `D_profile_dry ~ N_core / r` |
| `r_B7` | `2 x (N_core + N_act) / s(A1.9 command)` | plan's `D_apply ~ 2 x N / r`; the A1.9 seconds include the dry-runs and the verify |
| `N_manifest` | A1.1 | Headline N (dump manifest = `dump:check` total of the same source) |
| `rho` | `(N_core + N_act) / N_manifest` | Rows read per manifest row; near 1 |

Compare each rate with the placeholder **3,611 rows/s** (AM-08 AC7). A rate below it is amber (section 9). **Perlu pengesahan (half AM):** the unit of the 3,611 figure ("1M rows"): rows read per stage or rows in the dump; if it is not rows read, the comparison is only indicative. The budget in the A4 sheet uses the same unit on both sides (measured and projected), so P7 does not depend on it.

## 9. Green and red

**A1 is green** only when every item of the green list holds and the evidence (section 11) is posted. **A1 is red** as soon as any item of the red list happens. Amber is reported, and the LEAD decides.

**Red (stop at the first one):**

1. A non-zero exit where 0 is expected. Expected exits: `up`, `status`, seed, `load-dump`, `stage`, both snapshots, profile, dry-run, apply, `migrate:verify`, rollback dry-run, rollback apply, `restore-snapshot`: **0**. The four probes: **2**.
2. `migrate:verify` (also the verify at the end of `migrate:all --apply`, and after a restore in O1) is not exit 0 with a `verify pass:` line.
3. A guard accepts what it must refuse: a probe in A1.13 that exits 0, or a rollback that runs without the three variables and `--confirm`. (The production-mode guards are tested at A4.)
4. A rollback that leaves rows: any of the eleven table counts above 0, or `etl_id_map` with `legacy_source = 'cloud'` above 0, or a rollback exit other than 0.
5. A restore that fails the check: `ROLLBACK CHECK FAILED`, `MIGRATION CHECK FAILED`, no `ROLLBACK VERIFIED` or no `MIGRATION CHECK PASSED`, or a migration count that was not equal to the folder count when the snapshot was taken (A1.6).
6. Plan section 5 criteria 2 to 4 not met: any entity above its threshold (0.1 % for `users` and `schools`, 0.5 % for every other entity), a reject reason without an explanation, `ORPHAN_PARENT` on `users` or `schools` above 0, or an orphan scan above 0. Content entities (articles, notes, videos, audio KBAT sets) with 0 rows loaded are expected under the LEAD decision on #122 ("content tables empty") and are not red; **Perlu pengesahan (LEAD):** whether their rejected source rows still count against the 0.5 % threshold. (Plan section 5 lets the LEAD waive a criterion in writing in daylight, but the night has no waiver, and B9 item 2 is the same threshold: a breach that the LEAD accepts for A1 still needs either a fix or a written change of the threshold in plan section 5 before G6. **Perlu pengesahan (LEAD).**)
7. Dump or load integrity: a checksum mismatch; `PII SCAN FAILED`; a manifest not marked anonymised; the stage not at 83 and 35 tables; rows loaded not equal to the manifest.
8. Idempotency (O2, if run): an inserted or updated row on an unchanged stage.
9. Any personal data in a report, a post, a log or a copy outside the custody list. This is also a PDPA incident (runbook rule 8): tell the LEAD at once, before anything else.
10. The code changed after the run. The evidence counts only for the sha it ran on (P2). A change to the ETL or the schema after A1 means A1 is repeated.

**Amber (reported; not red):** a rate below 3,611 rows/s; a `WARNING ... fsync` line in `status`; a projected window above the maximum (computed in the A4 sheet); ledger or drift rows to be accepted; content-entity rejects explained by the missing content owner; a step much slower than the MIG-07 synthetic runs. MIG-07 saw a spread of about 1.8 times between identical `migrate:all --apply` runs on one host (527, 718 and 964 s), so one slow run is not a finding by itself.

**What to do on red:**

1. **Stop.** Do not retry, do not patch the database, do not "fix forward" in the rehearsal DB. Keep the state as it is until the LEAD has read the aggregates (the evidence of the failing step may need it).
2. **Keep aggregates only:** the step id, the exit code, the fixed line names that were printed, the counts. No whole logs, no error text beyond the fixed lines.
3. **Tell, by role:** the LEAD at once; the half AM migration operator (owner of the repeat); and by cause: ETL, verify or rollback behaviour: the backend developer role of half AM (a developer task, below); the rehearsal script or host: half AZ DevOps; the dump (checksum, scan, quality): the dump operator, who asks for a new sitting with a new key (AM-10 section 6; the LEAD approves it), and every copy is wiped at the LEAD's written instruction (I8).
4. **Where:** a comment on the cutover issue (#109) with the section 11 block and `RED` plus the step id. Environment and host items also go to half AZ on the half AZ DevOps thread (#113). **Perlu pengesahan (LEAD):** that this routing of #109 and #113 is the one you want.
5. **Fix as a developer task on a PR** through the normal gates (G3 build, G4 review); nothing is edited in production or in the rehearsal DB. The LEAD merges and re-pins the sha.
6. **Repeat** A1 from A1.2 with `reset --yes`, on the new sha, with the same dump if it is still inside the 7 days and was not the cause, or with a new dump. Any ETL change after the code freeze of 25 Oct (A2) means the LEAD re-pins and A1 and A4 evidence must both be at the final sha (P2).
7. **Deadline:** A1 must be green before A4 starts. If it is not green by **27 Oct**, the LEAD moves the date (plan A1 abort rule, P7). A4 does not start on a red A1.

## 10. Close-out and deletion

Copy the figures out first: `"$RDB" status` prints `timings.log` (`up`, `migrate`, `load-dump`, `stage-copy`, `snapshot`, `restore-snapshot`), and `down` deletes the state dir (recipe section 9).

| Item | When | By | How |
|---|---|---|---|
| Rehearsal DB, snapshots, state dir, secrets | At the end of A1 (A4 starts again with `up` and a fresh load, so its timings are from scratch) | Half AM operator, half AZ DevOps | `step down "$RDB" down --yes` (docker mode removes the container, network and volume; host mode drops the databases and the role, and then the WAL, base backups and replicas of the server that held the data are deleted by hand, `rehearsal-db.md` section 9) |
| Operator PC copies | At the hand-over, by the dump operator | Dump operator | `dump:wipe --dir "$work"` and the `.gpg` there (AM-10 steps 8 and 9); "local copies deleted" in I2 |
| The received `.gpg` file and the passphrase | As soon as A1.4 `load-dump` exits 0; default of I8 | Half AZ DevOps | `shred -u -n 1 -z` the file, destroy the passphrase note, `gpgconf --kill gpg-agent`; the extracted directory is then the only working copy. |
| Extracted dump directory (and `files`) | Default (I8): at this close-out, after the evidence is posted; A4 loads a fresh hand-over. **DECISION NEEDED (LEAD) before A1.0**, alternative: kept until the end of A4 (plan sections 3.1 and 7), at the latest 31 Oct | Half AZ DevOps (host), the LEAD (custodian) | The pattern of `slot.sh wipe-dump`: overwrite each file with `shred -u -n 1 -z`, then remove the directory (`slot.sh` function `cmd_wipe_dump`), then `ls` of the parent to show it gone. `dump:wipe` refuses a directory outside a `.migration-out` folder, so it does not fit this directory. |
| `apps/api/.migration-out/` and `<repo>/.migration-out/` (profile, recon reports, delta report) | Aggregates only; kept in the LEAD's encrypted storage until both the rehearsal and the cutover sign-offs, at most 30 days; numbers go into the issue as text; never GitHub | Half AM operator, the LEAD | Move to the LEAD's storage or delete (runbook 17 item 1, 18) |
| `.migration-out/deleted-at-source-<stamp>-<rand>.json`, if a verify or delta produced one | It holds real legacy ids of minors (mode 600): at most 7 days after the LEAD read it; never moved into report storage, never in GitHub, chat or e-mail | The LEAD, half AM operator | `shred -u -n 1 -z`, as `slot.sh wipe-dump` does; listed in the custody list of I8 |
| Temp files, `/tmp` leftovers, `pg_restore` temp, shell history lines with a URL, the trash; the terminal window (it holds the scrollback) and the gpg agent | At the close | Half AM operator | Check and clear (runbook section 5 items 3 and 4); close the terminal and run `gpgconf --kill gpg-agent` |

Runbook rule 4 says real-data dumps are deleted as soon as the load and reconciliation succeed (7 days at most), while plan section 7 keeps the rehearsal dump until after A4. This sheet follows runbook rule 4 by default (delete after the A1 load and close-out, A4 loads a fresh hand-over); keeping the extracted directory until after A4 is the alternative of I8. The 7 days count from 24 Oct. **DECISION NEEDED (LEAD) before A1.0.**

**Perlu pengesahan (half AZ):** the exact wipe command on the rehearsal host (the `slot.sh` pattern above is the model; `slot.sh` itself needs the VPS compose environment).

After the close, the half AM operator posts one line to the LEAD: `A1 close <date>: rehearsal DB down <yes|no>; .gpg and passphrase destroyed <yes|no>; extracted dump <deleted|kept until A4 by LEAD decision>, custodian <role>; reports <kept in LEAD storage|deleted>; temp, history, terminal and gpg agent cleared <yes|no>`. The receiver also posts the deletion confirmation on #109 (date, "deleted", what was deleted, nothing else) and the LEAD signs it (AM-10 section 4).

## 11. Evidence to post (text, aggregates only)

Post on the cutover issue (#109) in one comment. No names, no host names, no paths, no ids, no values.

```
A1 real-data rehearsal <date>, host class <cpu / ram / disk type>
Release sha <short sha>; etl_runs.git_sha <short sha>; migrations applied <n> of folder <F>; --as-of 2026-10-29
Dump: AM-10 pp-staging-dump/1, <T> tables, <R> rows (manifest); .gpg checksum matched <yes|no>; anonymised <true>; files export <present|absent>
Steps (seconds / exit): up <>/<>, seed <>/<>, load-dump <>/<>, stage <>/<>, snapshot pre_etl <>/<>, snapshot pre_etl_d (dump, <size>) <>/<>,
  profile <>/<>, all dry-run <>/<>, all apply <>/<>, verify <>/<>, rollback dry-run <>/<>, rollback apply <>/<>, restore pre_etl <>/<>
Verify: exit <>, verify pass <yes|no>, <n> entities, <m> checks; non-ok rows by name: <name: status, ...>
Rows: core read <n>, activity read <n>, loaded <n>, rejected <n> (<pct> %); stage tables 83 / 35 <yes|no>
Rejects by reason: ORPHAN_PARENT <n>, UNKNOWN_ENUM <n>, INVALID_VALUE <n>, DUPLICATE_KEY <n>, UNSUPPORTED <n>
Entities above threshold: <entity pct, ... | none>; ORPHAN_PARENT on users / schools: <n>; orphan scan: <n>
Forced-change accounts: <flagged> of <migrated> (<pct> %), by reason non_bcrypt <n>, shared_default <n>, roster_account <n> (or: reasons O5 not run)
Rates (rows/s): core apply <>, activity apply <>, overall apply <>, r_B6 <>, r_B7 <>; placeholder 3,611
Guards: rollback probes a / b / c / d exit <2/2/2/2>
Rollback: dry-run exit <>, apply exit <>, migrated tables all 0 <yes|no>, etl_id_map cloud rows <n>
Restore: ROLLBACK VERIFIED <yes|no>, MIGRATION CHECK PASSED <n> of <n>, restore <s>; dump-form restore <s>
Optional: O1 <>, O2 inserted/updated <0/0 | n/n>, O3 <>, O5 admin found <yes|no>
Result: GREEN | RED (step <id>, reason <short>); amber items: <list | none>
```

## 12. Open points raised by this sheet

| # | Perlu pengesahan | Who confirms |
|---|---|---|
| 1 | Who types the commands (half AM operator or the dump operator alone). | LEAD |
| 2 | Files export at the 24 Oct anonymised sitting (AM-10 section 8.1 against plan P6) and the `.cloud` storage access. | LEAD, dump operator, `.cloud` owner |
| 3 | How the `dump:cloud` part is timed at the sitting (clock readings; no per-phase output). | Dump operator, half AM |
| 4 | Who creates `SHA256SUMS` in the extracted dump. | Half AZ |
| 5 | `--content-owner` at the night and how its id is found (plan B6 and B7 have none). | LEAD, half AM |
| 6 | `/usr/bin/time` for peak memory; the `q` helper and `ps` exposure on the host. | Half AZ |
| 7 | A reject breach that the LEAD accepts for A1 against the night's threshold without a waiver. | LEAD |
| 8 | **DECISION NEEDED (LEAD) before A1.0:** delete the extracted dump after A1 (default, runbook rule 4; A4 then needs a second AM-10 sitting on 27 Oct, costs in I8) or keep it until the end of A4 (plan section 7); the exact wipe command on the rehearsal host. | LEAD, half AZ |
| 9 | The unit of the 3,611 rows/s placeholder. | Half AM |
| 10 | Routing of red reports: #109 for the cutover, #113 for half AZ items. | LEAD |
