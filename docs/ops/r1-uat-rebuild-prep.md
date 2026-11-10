# UAT rebuild from empty: preparation evidence and notes (T-A3, T-A4 input, T-A5, T-A8)

Date: 10 Nov 2026. Decision KP-2: the UAT database is rebuilt from empty and filled from a fresh V2 dump by the ETL. Everything below was run locally in throwaway Docker containers (own network `pp-ta3-net`, own database container); the local stack `pp-v3` and the UAT server were not changed.

## 1. Fresh database path (T-A3)

Method: `postgres:16-alpine`, an empty database, the real migrate image (`docker build --target build -f docker/api/Dockerfile`), the same commands the production compose `migrate` service uses.

| Step | Command (inside the migrate image) | Result | Time |
|---|---|---|---|
| Migrations 0001 to HEAD | `npm run be:db:migrate` (`prisma migrate deploy`) | 111 migrations applied, 0 unfinished, 216 base tables (`0264_essay_review_proposals` last) | 120 s and 227 s (two runs; the host was under load, expect well under 60 s on a quiet one) |
| Reference seed | `NODE_ENV=production ALLOW_DEMO_SEED=false BIJAK_POC_QUESTIONS=false npm run be:db:seed` | 5 modules ran, 24 demo modules skipped | 76 s, second run 33 s (0 changes) |

### Finding 1 (fixed): the reference seed did not load the curriculum

Before the fix the production reference set had 4 modules (`core-school-packages`, `core-wallet-tiers`, `spm-subject-configs`, `core-marketplace-categories`) and left `education_levels`, `subjects`, `chapters`, `curriculum_nodes` and `curriculum_tp_descriptors` empty. `spm-subject-configs` silently loaded 0 rows because it resolves subjects by code. `npm run dskp:load` on that database fails for every subject ("subject code ... is not in the subjects table").

Fix: `curriculumSeed` in `apps/api/prisma/seed/curriculum.ts` is now `kind: 'reference'` (public curriculum snapshot plus the packaged DSKP extracts; no personal data, no accounts). Array order is unchanged, so it runs before `spm-subject-configs`. Tests pinned to the old reference list were updated (`test/subscriptions/seed-production.spec.ts`, `test/seed/poc-guard.spec.ts`). The ETL adopts these rows by natural key (`claimSeeded`, `load/reference-steps.ts`), so `migrate:core` ends with one row per level, subject and chapter.

### Counts after migrate + reference seed (production mode)

| Table | Rows | Note |
|---|---|---|
| `curriculum_nodes` | 3,652 | 2,844 Tingkatan 4-5 (T4: 41 grouping, 287 sk, 1,132 sp, 89 unit; T5: 42, 241, 930, 82) plus 808 Tingkatan 1-3 unit nodes (S4-T09). The 2,844 expected is the T4-T5 part. |
| `curriculum_tp_descriptors` | 1,394 | as expected |
| `education_levels` | 11 | |
| `subjects` | 33 | |
| `subject_levels` | 194 | |
| `chapters` / `topics` / `subtopics` | 1,311 / 2,423 / 234 | see finding 2 |
| `legacy_topics` / `legacy_subtopics` | 125 / 335 | learner catalogue |
| `spm_subject_configs` | 19 | now loaded |
| `school_packages` | 4 | |
| `tiers` | 4 | wallet tiers |
| `marketplace_categories` | 6 | |
| from migrations (not the seed) | `feature_flags` 32, `gamification_settings` 48, `pksk_domains` 15, `pksk_packages` 3, `spin_segments` 8, `mystery_boxes` 5, `mystery_box_prizes` 7, `reward_settings` 1, `game_settings` 1 | |
| `users`, `schools`, `questions`, every other table | 0 | |

Demo and test search over all seeded rows (pattern `QA-GAP`, `E2E`, `@demo.test`, `example.test`, `example.com`, `fixture`, `PoC`, `lorem`): 0 matches. Hits for `Demo`, `Contoh`, `UJI ` are real words of the curriculum text ("Nilai Demokrasi", "Uji Minda" textbook headers, `Contoh` in DSKP wording), not demo records. No seeded users or schools.

### Finding 2 (fixed, 10 Nov): 569 auto-created Tingkatan 1-3 chapters are seeded inactive

`chapters.json` holds 636 chapters whose description starts "Auto-created". 569 of them carry "Auto-created from textbook chapter extraction for Tingkatan 1-3 seeding." (T1 87, T2 238, T3 244); about a fifth of those are OCR debris (page headers, copyright lines, indexes) and 14 were already marked "Deactivated by Codex QA" on the live data. The other 67 (T4/T5 and D1/D2 coverage-audit chapters, nine T1 "import wave" chapters) are real chapter names and stay active. They were all `in_tree = true`, so a pupil's chapter picker would have listed them.

Decision (T-A4 task, 10 Nov): the 569 are seeded `is_active = false` and stay `in_tree = true` (`apps/api/prisma/seed/curriculum-data/chapters.json`, new optional `isActive` column read by `curriculum.ts`). The learner catalogue reads active chapters only (`learnerChapters`: `in_tree` and `is_active`), so pupils never see them, as in V2 (V2 chapters are Tingkatan 5 only); the admin curriculum tree lists active and inactive chapters, so an admin can delete the debris or activate a real chapter. `in_tree = false` (option c of the first draft) was rejected: the admin tree never returns out-of-tree rows ("never returns out-of-tree chapters", `admin-tree.spec.ts`), so nobody could curate them, and the seed would have dropped their topics. DSKP nodes (`curriculum_nodes`, 808 T1-T3 unit nodes) are untouched, so tagging still works. Counts after the seed: 1,311 chapters, 569 inactive; learner-visible T1 96, T2 91, T3 52. Side effect to know: 17 subject-level pairs (for example BM T3, SCI T2, SCI T3) have no learner-visible chapter until an admin activates some. Existing databases keep their rows (a seed never updates); only a fresh or rebuilt database gets the inactive flag.

Still visible to T5 pupils next to the 686 V2 chapters: the observed T5 chapters of the snapshot (77 in tree, 29 auto-created coverage-audit chapters). Not changed here; ask the curriculum owner if V2 parity at T5 is wanted.

## 2. Notes for T-A4 (guarded rebuild) and T-A7 (runsheet)

What `deploy/vps/deploy.sh` does today (run on the VPS as `ppdeploy`): 1 preflight (env files, placeholders, fail-closed demo seed guard, `compose config -q`); 2 pre-deploy backup (`backup.sh --tag pre-deploy --no-files`); 3 build or pull images tagged with the git sha; 4 db up, `db-roles.sh apply`; 5 `migrate` one-shot (`prisma migrate deploy` only, as `pp_owner`), roles again, `db-roles.sh check`; 6 api and frontend up; 7 edge recreated; 8 health checks through the edge; 9 record tags for `rollback.sh`. `--seed-reference` runs only the reference seed (`be:db:seed`, `ALLOW_DEMO_SEED=false`) and exits. Migrations are forward only; there is no automatic rollback; one lock file serialises deploy, rollback, backup, drill and cert jobs. It asks the operator to type the domain.

What a rebuild must add (not written yet):
- Explicit opt-in flag (for example `--rebuild-db`) plus an exact-name confirmation of the database and domain, refused unless `PP_ALLOW_DB_REBUILD=yes` is in `prod.env` (so production can never carry it).
- A mandatory fresh backup first and `pg_restore --list` of it; refuse when the newest dump is older than a few minutes or its SHA-256 does not match.
- Stop `api` and the job worker (`JOBS_WORKER_ENABLED`), keep `db` up. Drop and recreate the database as the owner role, then `db-roles.sh apply` BEFORE migrate (roles and default privileges live per database) and again after, then `db-roles.sh check`.
- `migrate` -> `be:db:seed` (reference, now includes the curriculum) -> ETL (`migrate:all --apply`, needs `PP_RELEASE_SHA`) -> `migrate:verify` -> second `migrate:all` must report 0 changes -> post-load repairs (section 5) -> start `api`.
- The seed must be re-run after the ETL only if the ETL added subjects that `spm-subject-configs` has not seen (it skips unknown codes; it is idempotent).
- File storage: the `pretasiplus_apifiles` volume holds uploads that belong to the old database; decide per T-A9 whether it is wiped, archived or kept before the ETL copies V2 files in.
- Time each step and write it to a log in the state dir; stop on the first non-zero exit; print the rollback path (restore the backup taken in step 2 into a fresh database, then start the previous release).

## 3. OCR (T-A5)

Findings:
- `docker/api/Dockerfile` has a `tessdata` stage (msa + eng from `tessdata_fast` 4.1.0, SHA-256 checked at build) copied to `/opt/tessdata` in the runtime image. Built from the current tree on 10 Nov: both files present, checksums match the pinned values.
- The runtime image contains `tesseract.js` 7.0.0, `tesseract.js-core` and `@napi-rs/canvas` (linux x64 gnu and musl) for PDF page rendering.
- Probe (a script kept in the scratchpad, not in the repo) ran in that image with `--network none --read-only --tmpfs /tmp --user 1000:1000`, using the same `createWorker(['msa','eng'], 1, { langPath, cacheMethod: 'none', gzip: false })` options as `TesseractEngine`. It rendered a PNG with three lines (two Malay, one English, with options A to D) and recognised it correctly (confidence 85) in about 12 s after a 24 s worker start on a loaded host. No network was needed, so no CDN fetch happens.

Exact values:

```
OCR_ENGINE=tesseract
OCR_LANG_DIR=/opt/tessdata
```

Limits of this evidence: it proves tessdata, tesseract.js and the read-only container work together; it is the engine, not the PDF extractor. The real PDF extraction (pdfjs render, option splitting A to D) is T-C4. There is no existing automated test that runs real tesseract (`test/intake-files/ocr/engines.spec.ts` stubs it).

## 4. UAT backup and restore drill evidence (T-A8, read-only on 10 Nov)

| Item | Observation |
|---|---|
| Nightly backup | `pp-backup.timer` enabled, 02:15 local, last run 10 Nov 02:19 (exit 0, `pp-backup-20261109T181915Z.dump`, 165,754,389 bytes, SHA-256 `.sha256` file next to it). 9 dailies kept from 3 Nov, 2 weeklies, 2 `pre-deploy` dumps of 3 Nov. Disk 12 % used, 170 GB free. |
| Files archive | `PP_BACKUP_FILES=weekly`: `pp-files-20261108T181625Z.tar.gz` (129 KB) last. |
| Restore drill timer | `pp-restore-drill.timer` is installed but DISABLED and inactive (the unit says to enable it only after manual drills passed). `journalctl -u pp-restore-drill` has no entries. |
| Drill evidence files | `/var/backups/pretasiplus/drill-evidence/`: 27 Oct (527 bytes) and 2 Nov `restore-drill-20261102T143716Z.txt`: result PASS, 197 tables restored, 3,851,634 rows, 0 mismatches, 123 s, Postgres 16.15, 40 migrations; `writers_quiesced: NO`; operator "Team B lead (Claude)". |
| Currency | The newest drill is 8 days old and predates release `e34e0a52d515` (deployed 3 Nov 02:17 UTC). No drill has run against a dump of the current schema, and none has been run by a named human operator on the evidence file (the unit file says the manual drill with a named operator is the record of authority for BE-33 AC7). |
| Other | `PP_OFFSITE_KIND=none` (no off-host copy). Raw `.cloud` retention is overdue (`PP_RAW_PURGE_BY=2026-11-06`); see `r1-uat-env-changes.md` section 3. |

Conclusion: backups are healthy and recent; the drill evidence is not current enough to rely on for a replace-all cutover. Recommendation for the PO: approve ONE manual restore drill immediately before T-R4 (it stops the api for 1-3 minutes) and an off-host copy of the final backup. No drill was run in this task.

## 5. Post-ETL repair and verification scripts (for T-A7)

All live in `apps/api/scripts/uat-ops/`, run as `DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/<file>` (npm aliases exist for most: `uat:*` in `apps/api/package.json`). Default is a dry run, `--apply` writes. Reports are written under `<repo root>/.evidence/uat-ops/` (counts only, no personal data); on a workstation point the root away from the repo. The order below is the proposed one, judged from each script's header; the dependencies were not exercised against migrated data yet (T-B11 must confirm).

| Order | Script | Writes | What it does |
|---|---|---|---|
| 1 | `migrate:verify` (ETL) | no | Reconciliation after `migrate:all --apply`. |
| 2 | `u-op-01-dskp-dry-run.ts` (`uat:dskp-dry-run`) | no | DSKP counts per subject and level plus integrity SELECTs. After the seed it should show `same`, 0 inserts. If a subject shows `belum dimuatkan`, run `npm run dskp:load -w @pp/api` (idempotent). |
| 3 | `difficulty-level-backfill.ts` (`uat:difficulty-level-backfill`) | `--apply` | Sets `question_versions.difficulty_level = least(5, difficulty_tp)` where NULL and TP is 1-6. Idempotent. |
| 4 | `flag-stimulus.ts` (`uat:flag-stimulus`) | `--apply` | Backfills `stimulus_flag*` on approved live versions with the same detector as the write path; feeds the Regroup work-list. A dismissed flag survives re-runs. Needs the dry-run report approved first. |
| 5 | `challenge-metrics.ts` (`uat:challenge-metrics`) | `--apply` | Gives migrated platform challenges their `metric` by exact title; moves "Kombo 10" to type `combo`. Needs migration 0232 (in HEAD). |
| 6 | `backfill-bijak-answers.ts` (`uat:backfill-bijak-answers`) | `--apply` | Copies past Bijak sittings into `practice_answers`. A separate run with `--legacy-mode` (runs alone) sets `practice_answers.mode` on rows written before migration 0181. |
| 7 | `trim-duplicate-stem.ts` | `--apply`, creates `_bk_r1_trim_duplicate_stem` | Trims a leaf prompt that repeats the stem. Run only after the PO approves its dry-run report. |
| 8 | Read-only verification, any order: `regroup-report.ts`, `bulk-chapter-dry-run.ts`, `check-levels.ts` (levels T1-T5 only active), `u-op-15-chapters-t1-t3.ts`, `u-op-12-accounts-check.ts --school-id <id>`, `u-op-14-uji-leftovers.ts`, `u-op-16-support-contact.ts`, `u-op-02-intake-env-check.ts`, `terbit-papers.ts` | no | Counts and PASS/FAIL lines; each exits 1 on a failed check. |
| SQL | `group-integrity.sql`, `paper-group-integrity.sql`, `tag-integrity.sql`, `tracking-sibling-duplicates.sql` | no | Integrity queries to run with `psql` after the load. |
