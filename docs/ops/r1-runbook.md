# R1 ops runbook (Bijak SPM release)

One page for the operator (DevOps / lead) who applies the R1 release to UAT or production, in order. It merges, and links to, the per-topic notes: [r1-release-notes.md](r1-release-notes.md), [r1-b01-question-lifecycle.md](r1-b01-question-lifecycle.md), [dskp-loader.md](dskp-loader.md), [e2e-seed.md](e2e-seed.md) (the local/E2E seed, T26) and [r1-k1-blueprint-evidence.md](r1-k1-blueprint-evidence.md) (the blueprint evidence list, T39). Where this page and a topic note differ, the topic note is the detail and this page is the order.

> **No AI session runs any of this on a server.** Agents write and test the code and these notes; a human with the deploy rights runs every command below, after the lead's explicit confirmation (see [api-runbook.md](api-runbook.md)). Every SQL block in this page is a read-only `SELECT` (plus one `VACUUM ANALYZE`, section 2.2) and is safe to run on a live database. The only things that change data are the migrations (applied by `prisma migrate deploy`), the DSKP loader script, and the admin's own actions in the app (Kontrak, Sahkan), all named below. This page contains environment variable **names** only, never values.

**Order and links.** This page is the order of work, the migration table, the SQL checks and the blueprint steps. Where it overlaps [r1-release-notes.md](r1-release-notes.md) (preconditions, the deploy run, smoke, rollback, DSKP commands, configuration), the release notes win and this page links to them instead of repeating them.

**What is in the base and what is not** (against `feature/v3-bijak-r1` at BASE-135, `b34f4cab`, re-read 2026-11-02; check `docs/team/MERGE-LOG.md` on the board branch for newer merges. The deploy, environment and migration claims on this page were first read at BASE-105 `7ea2208c` and re-checked for BASE-106 to BASE-135: `git diff --name-only 7ea2208c b34f4cab1` shows, outside `src/`, `e2e/`, `docs/`, `packages/`, `apps/api/src` and `apps/api/test`, only `.env.api.example` (the two `SERVABILITY_OVERVIEW_WARM` lines), the new migration folders `0105_gate_facts` (BASE-132) and `0110_reference_image_tokens` (BASE-131), `apps/api/prisma/schema/questions.prisma` (the two 0105 columns) and `apps/api/prisma/seed/e2e-k2.ts` (one line, the e2e seed; no deploy file). A row that says **pending** names the branch and its head from `git ls-remote`; such a head can move, re-check it before the release.

| Item | State | Where |
|---|---|---|
| Migrations 0092, 0093, 0100, 0101 | in base (0101 since BASE-15) | `apps/api/prisma/migrations/` |
| Migration 0102 `leaf_cognitive_level` (T33) | in base since BASE-27 | `apps/api/prisma/migrations/0102_leaf_cognitive_level` |
| Migration 0103 `question_report_context` (T42 part 1) | in base since BASE-41 | `apps/api/prisma/migrations/0103_question_report_context` |
| Migration 0104 `paper_section_admin_created` (T48) | **pending, `r1/t48-builder-parity` @ 6c5ae3a8** (READY, A3; **merge after H-A18**; B2 + B3; the 0104 folder is unchanged since 1dd07bc1, diff checked at 6c5ae3a8). Behaviour: "Padam soalan" only unplaces a question that was ever approved (it stays in the bank); a duplicate Bahagian label is refused with 422 | `r1/t48-builder-parity` |
| Migration 0105 `gate_facts` (H-A18) | **in base since BASE-132** (`259f4616`; `r1/ha18-gate-facts` @ a9ffe246, B2 cycle 23 approve with Minors, B3 cycle 45 Pass; merged alone, not as a pair; REQ-B-052 followed as BASE-134). A2: H-A18 + REQ-B-017/037 + D99. The origin head `f988b670` = a9ffe246 + minors (a 0105 comment, `not_duplicate` idempotent, `duplicateId` in the audit): the follow-up `r1/ha18-minors` @ 17450966 (READY, A2; no migration change, 0105 byte-for-byte). The 0105 folder in base is byte-identical to a9ffe246 (diff checked). The 0105 folder was identical at f29aeda9 and fc409ae1; **at a9ffe246 it differs: the two CHECKs are added `NOT VALID` and validated by `VALIDATE CONSTRAINT` after the backfill**. 0105 is **not online**: `ADD COLUMN` takes ACCESS EXCLUSIVE on `question_versions`, and in A4's measurement reads and writes both waited for the whole file; the file has a `DO` block, so Prisma 7.10.1 sends it whole and it is atomic: the lock is held to the end of the file (2.4); maintenance window only (section 2.3). T48 and the units stacked on it now follow | `r1/ha18-gate-facts` |
| REQ-B-032 and REQ-B-052 (pinned and archived versions, A2/A3) | **REQ-B-032 is in base since BASE-109 and REQ-B-052 since BASE-134**: `r1/reqb032-pinned-rule` @ a2cb5bb4 (merged; A2 + A3: spec title and the R1-limitation row: a takedown of a paper does not stop a running sitting, KIV R2; 6/6) and `r1/reqb052-archived-edit` @ f3a2448f (A3; contains REQ-B-032 and `r1/ha18-gate-facts` @ fc409ae1). All three of H-A18 (BASE-132), REQ-B-032 and REQ-B-052 are merged. No migration of its own (0105 comes from H-A18). Behaviour: editing an archived question, or a question pinned on a published paper or on a paper with attempts, branches a **new draft version** and never rewrites the pinned or archived one; a published paper serves its pinned version. Since f3a2448f the pinned test for a withdrawn paper asks the attempts probe only (`published OR (withdrawn AND EXISTS attempts)`), and the P1 pinned-clause spec bites. Known failure that is not from this stack: `draw-bounded.spec.ts` BR-16 failed on BASE-105; `r1/reqc021-followup` @ 948aa327 fixed it (in base since BASE-108) | `r1/reqb052-archived-edit` |
| Migrations 0106 `question_stem_trgm` and 0107 `question_paper_kertas_index` (admin list perf, A4) | **in base since BASE-137** (`dac398fa`; `r1/admin-list-perf` @ 69f465c8, B2 Approve w/ Minors, B3 Pass with Lows; the SQL of 0106 and 0107 is the same as at 2a8ab674, only the 0107 header comment differs (diff checked); the lead approved both numbers; B2 + B3 + DevOps). 0106 creates the extension `pg_trgm` and two GIN indexes: needs a maintenance window and `CREATE EXTENSION` rights | `r1/admin-list-perf` |
| Migration 0110 `reference_image_tokens` (T34-L1-residual, team C) | **in base since BASE-131** (`0f7269f0`; REQ-A-013, `r1/t34-l1-residual-c` @ a2acf754; data fix, not reversible) | `r1/t34-l1-residual-c` |
| Other pending team A units (code or specs, no migration, no variable) | listed with their heads in [r1-release-input-team-a.md](r1-release-input-team-a.md) section 3.2, and the **B1 merge order proven by A4's integration preview #3 with its conflict resolutions in section 3.5 of that page** (not repeated here): the T31 / REQ-A-008 pair (T31 `r1/t31-builder-wire` @ eb0346d2 merges right before team C's `r1/reqa008-group-stimulus` @ 29d24be9; never T31 alone), then T43 (@ 238eb6eb) and T51 (@ 7cb8d814, IN-PROGRESS under the REQ-B-068 restack, after T48, T31, REQ-A-008 and T43); T43b, builder search perf, REQ-A-018, the delete-served guard (`r1/delete-served-guard` @ fe7ef537; what it waited for is in base: H-A18 BASE-132, REQ-B-052 BASE-134, T49 BASE-121, D72 BASE-135); already in base and not pending any more: REQ-C-012 (BASE-133), the A4 servability chain (BASE-110), REQ-B-025c (BASE-114), the bridge table fix (BASE-123), T52 (BASE-117), REQ-B-049 (BASE-126), and the specs-only units | per unit |
| `THROTTLE_SERVABILITY_READ_PER_MINUTE`, `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` (T30) | in base since BASE-28 | `apps/api/src/common/config/env.schema.ts` |
| `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` | optional; default 6 when unset | In base since BASE-28 (T30). Per-user limit of the servability overview, which counts the whole bank and has its own bucket; above it a request answers 429. Integer, minimum 1. `apps/api/src/common/config/env.schema.ts`. Leave unset. |
| `THROTTLE_QUESTIONS_LIST_PER_MINUTE` (admin list rate limit, A4) | optional; default **240** when unset or blank (60 before BASE-137, when `r1/admin-list-perf` merged) | **in base since BASE-137** (`dac398fa`; `r1/admin-list-perf` @ 69f465c8; added after the A2 B3 pre-scan). Per-user limit on `GET /api/questions` (the admin question list): above it a request answers 429 `RATE_LIMITED` with `Retry-After`. Integer, minimum 1. `apps/api/src/common/config/env.schema.ts:149`, `.env.api.example:86` (`=240`) and `apps/api/src/modules/questions/http/admin.controller.ts:23-27` (comment) and `:29-34` (`default: 240` at :32) at that head. Leave unset. |
| `SERVABILITY_OVERVIEW_WARM` (REQ-B-022(a), REQ-B-053, A4) | optional; `true` or `false`; unset or empty = on in production, off elsewhere | **in base since BASE-110** (merged inside the A4 chain as `r1/a4chain-minors` @ 6f2fb793; the unit was `r1/req-b-022a-a4` @ d82c5256, B2 + B3 + DevOps). Warms the admin servability overview once per API instance at start (not awaited; a failure only logs). Leave unset; `false` turns it off. Detail in section 6 | `apps/api/src/common/config/env.schema.ts:154` at that head |
| `AI_PROVIDER` (extraction provider) | `mock` for this release | Decided at go-live; a real provider (`anthropic`, `openai`, `gemini`, `openai-compatible`) needs a lead decision (D85 U1) and `AI_MODEL`, `AI_API_KEY` in the server env file only. See [r1-release-notes.md](r1-release-notes.md) section 5. |
| `E2E_SEED` and `docs/ops/e2e-seed.md` (T26) | in base since BASE-24 | `apps/api/prisma/seed/e2e.ts` |
| Rollback of 0100 and the failed-migration steps | in base | [r1-release-notes.md](r1-release-notes.md) sections 6.2 and 6.3 |
| `docs/ops/r1-k1-blueprint-evidence.md` (T39) | not in base; `r1/t39-k1-evidence` @ 1a26f7a6 (A3, docs only, nothing changed since the board listed it) | `r1/t39-k1-evidence` |
| Decision D95 (no seed on UAT) | **not in base `docs/TRACKER.md`**: it is in PR amin-kerja-orang/prestasiplus#404 (unmerged) and on `r1/d91-decisions` | cite it as "D95, PR #404, not merged" until the PR lands |

## 0. Before you start

1. Take a full dump and test the restore ([db-backup.md](db-backup.md)). Migration 0100 cannot be undone in place (section 2.2).
2. Maintenance window. 0100 (and 0101, 0102, 0103, 0104, 0105, 0106, 0107, 0110 when included) go out together with the new API/FE build (section 2); a few seconds of mixed state is possible. **0106 and 0107 block writes to `question_versions` while their indexes build** (rehearsal 2.3, 408k questions: about 20 s and about 2 s; reads are not blocked by these two. 0105 is different and is **not online**: it holds an ACCESS EXCLUSIVE lock on `question_versions` for the whole file (the file has a `DO` block, so it is atomic under Prisma 7.10.1, 2.4), 578 ms cold and 353 ms warm for the current shape (ha18 a9ffe246, `NOT VALID` then `VALIDATE`; f988b670 differs in comments only) in the 2026-11-02 rehearsal at 408k (2.4), and reads AND writes wait; it belongs in the maintenance window only. The 2026-11-01 rehearsal of the older shape (ha18 fc409ae1, backfill matched no rows) took 6.2 s cold and 0.4 s warm; that is history. The 0107 header now gives both figures: about 0.9 s for the bare `CREATE INDEX` and about 2 s through `prisma migrate deploy`, which the rehearsal measured as 1.8 to 2.1 s), and 0106 needs a database role that may `CREATE EXTENSION pg_trgm`: plan them into the same window as 0100, with no admin writes and no ETL, and the lock timeout of 2.4.
3. Record the before-state with the SELECTs in section 3.1.
4. Environment (section 6) is set on the API service before it starts. `E2E_SEED` and `ALLOW_DEMO_SEED` are not set to true (section 6).
5. **No DEMO seed on UAT (D95); the reference seed IS required (item 6).** Do not run `be:db:seed` with demo data on UAT (the demo seed is the one D95 forbids); the reference seed (`deploy.sh --seed-reference`, reference modules only) is a separate step and is needed. Blueprints are created and verified by an Admin Pusat in the app (section 5).
6. **Wallet tiers precondition (reference data).** Run `select count(*) from tiers;` on the target database. It must be **4**. **If the count is not 4**, run `deploy/vps/deploy.sh --seed-reference` (reference modules only, `ALLOW_DEMO_SEED=false`; the reference seed is an upsert, so re-running it is safe and leaves an economy edit made in the admin screen as it is; the output lists `core-wallet-tiers` and "demo modules skipped") before the API takes traffic. This is NOT the demo seed that item 5 forbids.
   - *Why.* Tiers come only from the `core-wallet-tiers` reference seed; migration 0010 only creates the table, and a deploy never seeds (`deploy/vps/deploy.sh:16` "never a seed", `:24-26` reference data is loaded once, explicitly; the flag runs at `:273-277`; the reference set that includes the 4 wallet tiers is `apps/api/prisma/seed/index.ts:76-83` and `apps/api/prisma/seed/core/wallet-tiers.ts:1-16`. The comment at `deploy.sh:24-26` and `docs/ops/production-vps.md:410-414` still list only the `school_packages` catalogue and the SPM subject configs: they lag the seed, which also loads `core-wallet-tiers`). Without tiers the wallet summary throws "M14: no tier is defined", so `GET /api/dashboard` and the wallet answer 500, and **a practice or Kuiz submit that earns no coin (no correct answer) answers 500 and the session rolls back** (it stays in progress; the pupil cannot finish it), as does every token conversion.
   - *If it happens in production.* It is row M08 of the hypercare table (`docs/ops/hypercare-amin2-30oct.md:41`): check Q2 (`tiers` count above zero), then the seed fallback (`deploy.sh --seed-reference`, fix-forward, preferred).
   - *Readiness (`r1/ready-tiers-check` @ 9c80f08c: ON HOLD (REQ-A-028, B DevOps), do not count on `/api/ready` 503 for tiers).* The branch would make `/api/ready` answer 503 while `tiers` is empty, so that a deploy that skipped the reference seed fails its readiness check on purpose. It needs a CI and deploy change by B first and is not in the release order, so today `/api/ready` stays 200 with empty tiers: the `select count(*) from tiers;` check above is the only guard.
7. **Stimulus group layout of published papers (read-only SELECT, B4 and ops, before go-live).** Run the SELECT of section 3.7 on UAT. It lists published papers whose stimulus group is split across Bahagian (`GROUP_SPLIT`) or not in one run inside a Bahagian (`GROUP_NOT_CONSECUTIVE`). **Any row means that paper is re-composed in the builder before go-live**; 0 rows is the expected result.

## 1. Order of work

| Step | What | Section |
|---|---|---|
| 1 | Backup, window, before-state SELECTs | 0, 3.1 |
| 2 | `prisma migrate deploy`: 0092, 0093, 0100, then 0101, 0102, 0103, 0104, 0105, 0106, 0107 and 0110 if their builds are in the release, in that order, together with the new API/FE build | 2.1 |
| 2a | **0106 and 0107 are in base since BASE-137 (`r1/admin-list-perf`), so they go out with the release; same window as 0100.** **The full procedure (quiet window, `lock_timeout`, `pg_trgm` pre-check, `ANALYZE`) is 2.4.** Before the window: the `pg_trgm` pre-check (the first SELECT of 3.5e: one row means the extension is available; if the host refuses `CREATE EXTENSION`, the deploy stops at 0106 with nothing else changed). During the window: 0106 write-locks `question_versions` for about 20 s at 408k questions (reads are not blocked), 0107 for about 2 s (rehearsal 2.3; the 0107 header gives 0.9 s for the bare build and about 2 s through `migrate deploy`); both are plain `CREATE INDEX` (no `CONCURRENTLY`; the file headers say Prisma runs each file in one transaction, which is inaccurate for a file without a `DO` block: it is split into autocommit statements, 2.4). Right after both: `ANALYZE question_versions;` (no exclusive lock; the planner learns the new expression index; 0.8 s at 408k, rehearsal 2.3). Sources, on `r1/admin-list-perf` @ 6389cd54 (not on this branch): `docs/qa/r1-admin-list-perf.md:35` (build cost) and `:39-45` (deploy flags: window, `pg_trgm`, revert SQL, `ANALYZE`, order, drift), and the headers of `apps/api/prisma/migrations/0106_question_stem_trgm/migration.sql` (about 20 s, measured) and `0107_question_paper_kertas_index/migration.sql` (about 0.9 s for the bare build and about 2 s through `migrate deploy`; the rehearsal in 2.3 measured 1.8 to 2.1 s). The times are A4's local measures on a 408k-question copy; **not measured on the production table**. The drift note under 2.1 still applies | 2.1, 3.5e |
| 3 | `VACUUM ANALYZE question_versions` right after 0100 | 2.2 |
| 4 | After-state SELECTs for every migration applied | 3.2 to 3.6 |
| 5 | DSKP load: dry run, then real run, then verify | 4 |
| 6 | Blueprints: Admin Pusat creates each in Kontrak and presses Sahkan, in the order of section 5.2 | 5 |
| 7 | Smoke: login count, one Jana Kertas, one Latih Tubi SPM draw | 3.6, 5.5 |

## 2. Migrations and their order

`prisma migrate deploy` applies pending folders by number. UAT is at 0091, so a fresh deploy applies the folders below, in this order. Always check the list `prisma migrate status` shows against this table before you deploy.

### 2.1 The list

| Migration | In base? | What it does | Reversible? |
|---|---|---|---|
| `0092_bijak_standards` | yes (BASE-6) | Blueprint standard model: profile, quota, KBAT, evidence, verification tables, `blueprints.serves_students`, per-part TP / KBAT / unit / form columns, `papers.standard_report`. **Downgrades every blueprint with `source = 'verified'` to `'spec'`.** Drops `blueprint_sections.topic_weights`; a guard aborts the migration if any row holds a value. | Manually; the reverse SQL is in the file header. The verified-to-spec downgrade is not undone. |
| `0093_part_options_image_file_index` | yes (BASE-6) | One partial index `ix_part_options_image_file_id` for the pupil image read rule. Idempotent (`IF NOT EXISTS`). | `DROP INDEX "ix_part_options_image_file_id"` |
| `0100_question_lifecycle_approved` | yes (BASE-4) | "Approved = servable". Old `approved` becomes `review`; old `published` becomes `approved`; the status CHECK allows `draft, review, approved, archived`; the partial indexes on `status = 'published'` are rebuilt on `'approved'`. The file has a `DO` block, so under Prisma 7.10.1 it is sent whole and is atomic (A4's model, 2.4; not tested on 0100 itself). | **No.** Restore the dump (section 2.2). |
| `0101_essay_choice` (T25) | yes, BASE-15 | Adds `essay_choice` to the `question_parts.mode` CHECK, a nullable `question_parts.topics` jsonb and `ck_question_parts_topics` (2 to 6 topics, only on an `essay_choice` leaf). Additive; reads no status value. | Yes, after deleting `essay_choice` parts (reverse SQL in the file header). |
| `0102_leaf_cognitive_level` (T33) | yes (BASE-27) | Adds nullable `question_parts.cognitive_level` with `ck_question_parts_cognitive_level` (mengingat, memahami, mengaplikasi, menganalisis, menilai, mencipta) and `ck_question_parts_cognitive_level_leaf_only` (a part without a mode has none). Additive; no backfill (NULL = not set). | Yes (reverse SQL in the file header: drop the two CHECKs, then the column). |
| `0103_question_report_context` (T42 part 1) | yes (BASE-41) | Adds nullable `question_reports.paper_id` (bigint) and `paper_label` (text, CHECK at most 200 characters), FK `fk_question_reports_paper_id` to `papers` (ON DELETE SET NULL), FK `fk_question_reports_attempt_id` to `exam_attempts` (**NOT VALID**: rows written before the migration are not checked, new and updated rows are) and index `ix_question_reports_paper_id`. Existing rows keep NULL. | Yes (reverse SQL in the file header: drop the index, the two FKs, the CHECK, then the two columns). |
| `0104_paper_section_admin_created` (T48) | **pending**: `r1/t48-builder-parity` @ 6c5ae3a8 (READY; merge after H-A18; the 0104 folder is unchanged since 1dd07bc1, diff checked at 6c5ae3a8) | Adds `paper_sections.admin_created boolean NOT NULL DEFAULT false`. The flag tells a Bahagian that comes from the Kontrak (false, every existing row) from one an admin added in Semak Kertas (true); only an admin-added Bahagian takes "Tambah soalan". Additive; a constant default (`ADD COLUMN ... BOOLEAN NOT NULL DEFAULT false`, so no table rewrite). **Lock: ACCESS EXCLUSIVE on `paper_sections` for milliseconds** (about 8 ms in the rehearsal, 2.3): reads and writes of that small table wait. | Yes (reverse SQL in the file header: `ALTER TABLE "paper_sections" DROP COLUMN "admin_created"`). |
| `0105_gate_facts` (H-A18) | **in base since BASE-132** (`259f4616`, @ a9ffe246, merged alone; the SQL in base is byte-identical to a9ffe246; `f988b670` adds comments only, as `r1/ha18-minors` @ 17450966) | Adds `question_versions.last_editor` (text, NOT NULL, default `person`, CHECK `person` or `ai`) and `question_versions.declared_marks` (smallint, nullable, CHECK at least 0). One DO block backfills: `last_editor = 'ai'` only for a draft or review version of an `ai_variant` question with no status event made by a person; `declared_marks` from `intake_items.payload->>'marks'` only when the intake item has NO parts and the value is a whole number 1 to 999 (a parted item's total is 0 in the intake payload, so nothing is declared for it; since H-A18 @ f29aeda9; the 0105 folder was identical at f29aeda9 and fc409ae1, and since a9ffe246 the two CHECKs are added `NOT VALID` and validated by `VALIDATE CONSTRAINT` after the backfill (a9ffe246); 9c5e6375 and f988b670 change only comments in the SQL (diff checked)). It prints both counts as a NOTICE (`0105 backfill: last_editor=ai on N versions, declared_marks set on M versions`). Approved and archived rows stay `person`. The approve gate then reads real facts, and only a new approval is checked. **Not online:** reads and writes of `question_versions` wait for the whole file (ACCESS EXCLUSIVE from `ADD COLUMN`; atomic, the file has a `DO` block, 2.4; the `NOT VALID` split gives no online benefit here, confirmed by A4), so run it in the maintenance window. | Yes (reverse SQL in the file header: drop the two CHECKs, then the two columns). |
| `0106_question_stem_trgm` (admin list perf, A4) | **in base since BASE-137** (`dac398fa`, `r1/admin-list-perf` @ 69f465c8; lead approved; the SQL is the same as at 2a8ab674, diff checked) | `CREATE EXTENSION IF NOT EXISTS pg_trgm` and two partial GIN indexes `ix_question_versions_stem_ms_trgm` and `ix_question_versions_stem_en_trgm` (`gin_trgm_ops`, `WHERE column IS NOT NULL`) on `question_versions`, for the admin question list text search. No data change. Plain `CREATE INDEX` (the SQL has no `CONCURRENTLY`; the 0106 header says Prisma runs the file in one transaction, which is inaccurate: the file has no `DO` block, so it is split into autocommit statements, 2.4): writes to `question_versions` wait while each index builds (A4, 408k questions: about 20 s, the `stem_ms` index is 55 MB; the file header now says the same, about 20 s; reads are not blocked). Pre-check before the window: `SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';` must return a row. If `CREATE EXTENSION` is refused the migration stops there with nothing else changed. | Yes (reverse SQL in the file header: drop the two indexes, then `DROP EXTENSION "pg_trgm"` only if nothing else uses it). Run in a rolled-back transaction: ok (section 9). |
| `0107_question_paper_kertas_index` (admin list perf, A4) | **pending**: same branch and head as 0106 | One partial expression index `ix_question_versions_paper_kertas` on `substring("paper_code" from '/([1-3])[[:space:]]*$')`, for the Kertas filter of the admin list. A SHARE lock on `question_versions` while it builds (writes wait, reads do not): about 0.9 s at 408k (A4); the file header now says the same, about 0.9 s. The expression text must stay identical to `QuestionsRepository.adminConds` (`apps/api/src/modules/questions/questions.repository.ts:632` at `2a8ab674`, checked), and **the REQ-B-050 regex fix and 0107 ship together** (the fix alone makes the Kertas filter slower, 2.7 s at 408k, A4). | Yes (reverse SQL in the file header: `DROP INDEX "ix_question_versions_paper_kertas"`). |
| `0110_reference_image_tokens` (T34-L1-residual, team C) | **in base since BASE-131** (`0f7269f0`; `r1/t34-l1-residual-c` @ a2acf754) | Two UPDATEs: a reference-sheet `imageFileId` that is a decimal id naming a `question_image` file becomes that file's public token, in `papers.reference_sheets` and `blueprints.reference_sheets`. An id naming no file is left as it is. No schema change. | **No** (the ids are not kept). Restore the dump, or accept the tokens. |

**Drift and order (A4's doc `docs/qa/r1-admin-list-perf.md` @ 69f465c8):** the GIN trigram indexes (0106) and the expression index (0107) cannot be expressed in `schema.prisma`, so `prisma migrate diff` or `migrate dev` may report them as drift (same precedent as 0011 and 0044): **keep them, and never let a generated migration drop them.** `prisma migrate deploy` applies pending migrations in number order; 0106 and 0107 depend on no other team A migration, so it is harmless if they land in the same deploy as 0104 and 0105. **Behaviour change with the REQ-B-050 regex fix (same branch):** the admin list Kertas filter now needs `/` plus a digit 1 to 3 at the end of the paper code (as `kertasOfPaperCode`); the old pattern matched any trailing digit, so a code like `MATH 2` (no slash) no longer matches the filter (recorded as a deviation row in `docs/architecture/v2-backend-deviations.md` on the branch).

Notes:

- 0101 and 0102 touch different columns of `question_parts` and do not depend on each other or on a status value; 0103 touches `question_reports` only, 0104 `paper_sections` only, 0105 `question_versions` only (two new columns; it does not touch the status column or its CHECK), 0106 and 0107 add indexes to `question_versions` only, and 0110 rewrites reference sheets only. They still apply in number order. If only some of T25, T33, T42, T48, H-A18, admin list perf and T34-L1-residual are in the release, apply only those. Numbers (lead decision): team A 0100 to 0109, none of 0106 to 0109 is free: 0106 and 0107 are `r1/admin-list-perf`, 0108 is reserved for `feature_flags` and 0109 for `drop_pool_tag` (R1-B06), neither of which is in this runbook until its branch is READY; any optional B12 or B20 migration goes to 0120 or above (team A overflow); team C 0110 to 0119.
- **0103: do NOT run `VALIDATE CONSTRAINT fk_question_reports_attempt_id` in the release.** The constraint is created NOT VALID on purpose. `attempt_id` has existed since migration 0017 with no foreign key and nothing ever wrote it, so old rows may hold values that point nowhere; validating would scan and could fail the release. New and updated rows are checked without it. A later number must never be applied before an earlier pending one is accounted for.
- The planned table in `docs/architecture/v2-admin-student-pipeline.md` section 2 names 0101 and 0102 differently (`dskp_leaf_tags_and_facts`, `stimulus_kinds_wide`). The migration folders in the repository are the authority; read the `migration.sql` header of any folder before you apply it.
- Deploy order for 0100: the migration and the API/FE build of the same release together. An old API against the new CHECK fails to write `published`; a new API against old data serves nothing.
- Code that still names `'published'` for a **question** status breaks (nothing served, or a CHECK failure). Paper `published` (Terbit) is unchanged. Details: [r1-b01-question-lifecycle.md](r1-b01-question-lifecycle.md).
- Consequence of 0092: after the upgrade **no blueprint serves students**. `POST /api/bijak/papers/generate` answers 422 `NO_BLUEPRINT` for a pupil until the blueprint is verified (section 5).

### 2.2 After 0100: statistics and the rollback path

**Statistics.** 0100 rewrites `question_versions` with two bulk UPDATEs and recreates five indexes, so the planner has stale statistics until the table is analysed. Run once, right after the migration finishes, outside any transaction (it takes no exclusive lock, so it is safe on a live database):

```sql
VACUUM ANALYZE question_versions;
```

(Source: [r1-release-notes.md](r1-release-notes.md) section 2.4, which has the `psql` wrapper (`VACUUM (ANALYZE) question_versions`, in base); `docs/ops/r1-b01-question-lifecycle.md` on `r1/t04-minors` @ aff6df8f (pending, READY) carries the same statement. The run time on the production-size table has not been measured.)

**Rollback path (database).** The authoritative steps are [r1-release-notes.md](r1-release-notes.md) section 6.2 (rollback; migrations are forward-only) and 6.3 (a migration failed during the deploy). In short:

- 0100 cannot be reversed in place. After a failed or unwanted release, restore the pre-deploy dump together with the previous API/FE build (release notes 6.2 "Full rollback", steps 1 to 6). **After a dump restore do not run `prisma migrate resolve`**: the restored `_prisma_migrations` has no row for the migration, so Prisma answers P3011, and the old schema is simply what the dump holds.
- A **failed** migration (a `_prisma_migrations` row with `finished_at` NULL, found with the SELECT of release notes 6.3 step 2): if nothing changed (the "clean" checks of 6.3 step 3), `prisma migrate resolve --rolled-back <folder>` is the right command, and only for that case. If it left partial changes, restore the dump as above.
- A **finished** migration that you undo by hand with the reverse SQL of its file header (0101, 0102, 0103, 0104, 0105, 0106 and 0107 are additive and have one; 0110 has none): `--rolled-back` does not apply (Prisma answers P3012 because the row is finished). Run the reverse SQL, then delete that migration's history row (a write; use the pattern of release notes 2.3, with the lead's confirmation): `DELETE FROM _prisma_migrations WHERE migration_name = '<folder>'`. Do this only on a database that will not be rolled back to an image that ships the folder (`/api/ready` answers 503 while a shipped name has no applied row).
- Rolling back the code after the first new approval is possible only together with a restore.

### 2.3 Migration rehearsal 0104 to 0107 (apply, revert, re-apply; local throwaway databases)

Rehearsed 2026-11-01 by A4 on two local Postgres 16 containers (no server touched, no real credentials). **Tree:** `feature/v3-bijak-r1` at BASE-105 `7ea2208c` (folders 0001 to 0103), then the four folders copied in from their branches (not merged): 0104 from `r1/t48-builder-parity` @ 6c5ae3a8, 0105 from `r1/ha18-gate-facts` @ fc409ae1 (**the older shape of 0105**: its two CHECKs were added in one step; the current shape on a9ffe246 (f988b670 differs in comments only) adds them `NOT VALID` and runs `VALIDATE CONSTRAINT` after the backfill, and was re-timed in the 2026-11-02 rehearsal (2.4): 578 ms cold, 353 ms warm), 0106 and 0107 from `r1/admin-list-perf` @ 2cd7889a (the 0106 and 0107 SQL is unchanged at 6389cd54). `npm run lint:migration` passes on that tree (passed, 123 existing warnings). The applied tool is `prisma migrate deploy` (the same command `deploy/vps/deploy.sh` step 5 runs in the one-shot migrate container).

**Apply order** (by number, one `migrate deploy` applies all four): 0104, 0105, 0106, 0107. 0104 is `paper_sections` only; 0105, 0106 and 0107 are `question_versions`.

**Prerequisite for 0106 (check before the window).** `SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';` returns one row (3.5e). Availability is not the same as permission: the migration role needs the `CREATE` privilege on the database (a trusted extension, Postgres 13+). Rehearsed with a role without it: 0106 failed with `permission denied to create extension "pg_trgm"` (SQLSTATE 42501), see "If 0106 is refused" below. The schema owner role also needs `CREATE` on schema `public` for the index builds (true for the owner of a normal database; only a hand-built restricted role hits it).

**Revert procedure, reverse order, by hand, as the schema owner role (`migrate.env`, `pp_owner`; the API and ETL roles have read-only access to `_prisma_migrations` and do not own the tables, `deploy.sh` step 5):**

```sql
\set ON_ERROR_STOP on
-- 0107
DROP INDEX "ix_question_versions_paper_kertas";
DELETE FROM _prisma_migrations WHERE migration_name = '0107_question_paper_kertas_index';
-- 0106 (first: nothing else may use pg_trgm; expect 0 rows)
SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%gin_trgm_ops%' AND indexname NOT IN ('ix_question_versions_stem_en_trgm', 'ix_question_versions_stem_ms_trgm');
DROP INDEX "ix_question_versions_stem_en_trgm";
DROP INDEX "ix_question_versions_stem_ms_trgm";
DROP EXTENSION "pg_trgm";
DELETE FROM _prisma_migrations WHERE migration_name = '0106_question_stem_trgm';
-- 0105 (drops the backfilled last_editor and declared_marks values with the columns)
ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_declared_marks", DROP CONSTRAINT "ck_question_versions_last_editor",
  DROP COLUMN "declared_marks", DROP COLUMN "last_editor";
DELETE FROM _prisma_migrations WHERE migration_name = '0105_gate_facts';
-- 0104
ALTER TABLE "paper_sections" DROP COLUMN "admin_created";
DELETE FROM _prisma_migrations WHERE migration_name = '0104_paper_section_admin_created';
```

The SQL after each folder comes from that folder's header. `prisma migrate resolve --rolled-back` is **not** part of the revert: on a finished migration it answers `P3012 ... cannot be rolled back because it is not in a failed state` (verified on 0107). The `DELETE` is the documented way (2.2). Afterwards `prisma migrate status` lists the four folders as not yet applied. Only revert on a database whose code is also back on the old release (`/api/ready` answers 503 while a shipped name has no applied row). If `pg_trgm` was created by someone else before 0106 ran (the `IF NOT EXISTS` makes 0106 skip it), do not `DROP EXTENSION` it: leave it and keep the rest.

**After the apply (or a re-apply):** `ANALYZE question_versions;` (no exclusive lock; 0.8 s at 408k). A whole-database `ANALYZE` is not needed (these migrations touch only `question_versions` and `paper_sections`; it took 13 s at 408k and also takes no exclusive lock). Nothing else is required: the added columns and indexes carry no statistics until analysed, and the planner picks the trigram and the Kertas indexes after the `ANALYZE` (EXPLAIN on the 408k copy: BitmapOr of `ix_question_versions_stem_ms_trgm` and `ix_question_versions_stem_en_trgm`).

**Context of every figure below:** A4 rehearsal 2026-11-01, local Postgres 16 in Docker (4 CPU sandbox container, no server touched), 408,273 question_versions (401 MB with indexes), BASE-105 7ea2208c + 0104–0107 copied in; prisma migrate deploy; not measured on the production table.

**Measured timings** (`finished_at - started_at` in `_prisma_migrations`; one run each unless said):

| Step | A: small seeded DB (1,271 question versions, 9 sections, 4 cpu) | B: 408,273 question versions (table with indexes 401 MB, 1,308 sections), run 1 (cold, just after container start) | B, run 2 (warm) |
|---|---|---|---|
| 0104 add `admin_created` | 10 ms (re-apply 5) | 8 ms | 8 ms |
| 0105 gate facts | 11 ms (re-apply 8) | **6,173 ms** | 427 ms |
| 0106 `pg_trgm` and two GIN indexes | 33 ms (re-apply 26) | **20,558 ms** | 20,106 ms |
| 0107 Kertas index | 12 ms (re-apply 4) | **2,057 ms** | 1,841 ms |
| Whole `migrate deploy` (wall) | 1.8 s | 31.0 s | 25.0 s |
| Whole revert (all four, by hand) | under 50 ms | under 100 ms | |
| `ANALYZE question_versions` / whole-DB `ANALYZE` | 11 ms / 255 ms | 833 ms / 13.2 s | |

Index sizes at 408k: `ix_question_versions_stem_ms_trgm` 55 MB, `ix_question_versions_stem_en_trgm` 16 kB (no English stems in that bank), `ix_question_versions_paper_kertas` 552 kB. The 0105 backfill matched no rows in either database (no `ai_variant` question, no intake item), so its cost with real backfill rows is **not** measured here (A3 exercised the logic on a copy with synthetic rows, section 9). Base apply of the 46 earlier folders on an empty database: 4 s.

**Lock behaviour and the maintenance window** (B; `pg_locks`, `pg_stat_activity`, and a timed `SELECT` and `UPDATE` fired while the migration ran):

| Migration | Lock on | Writes to the table | Reads of the table | How long (408k) |
|---|---|---|---|---|
| 0104 | `paper_sections`, ACCESS EXCLUSIVE | wait | wait | 8 ms |
| 0105 | `question_versions`, ACCESS EXCLUSIVE from `ADD COLUMN` until the end of the file (the file has a `DO` block, so it is atomic, 2.4; in the rehearsed older shape `ADD CONSTRAINT ... CHECK` also scanned the table; in the current shape the scan is the later `VALIDATE`, which runs under the same lock, so nothing here is online) | **wait** | **wait** (a `SELECT` with `lock_timeout = 1.5 s` was cancelled while the statements ran) | current shape (2026-11-02, 2.4): 578 ms cold, 353 ms warm; older shape (2026-11-01): 6.2 s cold, 0.4 s warm, the DDL alone 0.35 s; the backfill matched 0 rows in both |
| 0106 | `question_versions`, SHARE (plain `CREATE INDEX`; the file has no `DO` block: autocommit statements, 2.4) | **wait**: a one-row `UPDATE` waited 19.2 s and 20.0 s (until the commit; `wait_event_type = Lock`, the `RowExclusiveLock` not granted) | not blocked: a primary-key `SELECT` took 0.16 s (idle baseline 0.17 s) | about 20 s |
| 0107 | `question_versions`, SHARE | wait | not blocked | about 2 s |

So the window is about 21 s of write unavailability on `question_versions` at 408k in the 2026-11-02 rehearsal (18.4 s from 0106, about 1 s from 0107, 0.58 s cold and 0.35 s warm from 0105; the whole `migrate deploy` 0104 to 0110 took 21.3 s cold and 21.0 s warm); the 2026-11-01 rehearsal with the older 0105 gave about 30 s (31.0 s cold, 25.0 s warm, 0105 up to 6.2 s cold). Reads AND writes stall during 0105 (238 ms / 228 ms measured with traffic, 2.4), which is **not online**: the lock is held for the whole file, so 0105 runs in the maintenance window like the others. The lock is released between the migrations, so a blocked write may wait for 0106 and then, briefly, for 0107. An API instance that times out its writes during this time returns errors for the duration: run it inside the window (section 1, step 2). The numbers are from a 4-cpu local container; production-size timing has not been measured.

**If 0106 is refused (rehearsed on a role without `CREATE` on the database).** `migrate deploy` stops with `Database error code: 42501 ... permission denied to create extension "pg_trgm"`. The statement is the first of the file and the failed migration left nothing: no extension, no trigram index, no Kertas index (checked), and 0104 and 0105 stay applied. The history row of 0106 has `finished_at` NULL. **Running `prisma migrate deploy` again fails with P3009** (failed migrations in the target database), even after the extension exists. The sequence that works: (1) a privileged role runs `CREATE EXTENSION pg_trgm;` (or allow it for the migration role); (2) `prisma migrate resolve --rolled-back 0106_question_stem_trgm` (the right command here, because the row is failed; the row stays with `rolled_back_at` set, which `/api/ready` ignores); (3) `prisma migrate deploy` applies 0106 and 0107; (4) `prisma migrate status` ends with "Database schema is up to date". If the extension was created by hand in step 1, the later revert must not `DROP EXTENSION` it unless the lead agrees. Release notes 6.3 step 3 lists "clean" checks only up to 0101; for these folders clean means: 0104 no `paper_sections.admin_created`; 0105 neither `last_editor` nor `declared_marks` on `question_versions`; 0106 none of the two trigram indexes (and `pg_trgm` present only if it existed before); 0107 no `ix_question_versions_paper_kertas`. A failure of a statement later in a file was not rehearsed.

**Do not apply 0106 or 0107 by hand and then deploy.** The earlier perf database had both indexes created by `psql` (no history row). `migrate deploy` then runs the files, and 0106 stops with `relation "ix_question_versions_stem_ms_trgm" already exists` (SQLSTATE 42P07; `CREATE INDEX` has no `IF NOT EXISTS`, only the extension does; verified). If it happens, drop the hand-made indexes or treat the failed row as in the paragraph above.

**Result: verified, clean revert, nothing left behind.** Schema snapshots (`pg_dump --schema-only`, the `_prisma_migrations` projection name, checksum, finished, rolled back, steps, the extension list, `pg_indexes`, `pg_constraint` with `convalidated`, `information_schema.columns`, relations and public functions):

| Comparison (database A) | Result |
|---|---|
| S0 (BASE-105, 46 folders applied, demo seed) against S1 (after apply 0104 to 0107, then the revert above) | identical in every file except the two random `\restrict` token lines that `pg_dump` writes (not schema) |
| S2 (re-applied 0104 to 0107 and `ANALYZE`) against the first apply | identical |
| S0 against S2 | exactly the expected additions: `paper_sections.admin_created`, `question_versions.last_editor` and `declared_marks`, the two CHECKs, the three indexes, extension `pg_trgm` 1.6 |

On database B the same revert (0107, 0106, 0104; 0105 was not applied there) gave a state with only the expected objects removed, and re-applying through `migrate deploy` gave the expected objects again. Database B was left by this run with all four applied through Prisma (it had 0104, 0106 and 0107 applied before, the last two without history rows). `psql` and `prisma` ran from `apps/api`; the throwaway containers and passwords were local only and the passwords are not recorded here. Commands: `docker run --rm -d --name pp-migrehearsal -e POSTGRES_PASSWORD=<throwaway> -p 55440:5432 postgres:16`, `npx prisma migrate deploy`, `NODE_ENV=development npx tsx prisma/seed/index.ts`, `psql -f` for the revert SQL, `pg_dump --schema-only --no-owner`.

**Doc corrections made by this rehearsal:** (1) 0107 was "about 0.9 s": measured 1.8 to 2.1 s through `prisma migrate deploy` (the 0107 header was then rewritten, 6389cd54, to give both: about 0.9 s for the bare build and about 2 s through `migrate deploy`). (2) "Reads are not blocked" is true for 0106 and 0107 only; 0105 and 0104 take an ACCESS EXCLUSIVE lock. (3) The reverse of 0106 and 0107 was listed 0106 first; it is now 0107 first. (4) Row 8 "0106 stops at CREATE EXTENSION": "then run `prisma migrate deploy` again" is not enough (P3009), `migrate resolve --rolled-back` is needed in between. (5) Section 2.2 and release notes 6.3 describe `--rolled-back` for failed migrations only; unchanged and confirmed (P3012 on a finished one).

### 2.4 The 0106 and 0107 window: lock timeout, quiet window, `pg_trgm` pre-check, `ANALYZE` (REQ-B-066)

Applies to 0106 and 0107 (in base since BASE-137). It blocks deploy sign-off, not the merge. Everything here is run by a human with the deploy rights; no AI session runs it.

**Rehearsal behind the figures in this section (A4).** Rehearsed 2026-11-02 by A4 on local Postgres 16.15 in Docker (4-CPU sandbox, no server touched), on a 408,273-row question_versions copy. Tree: BASE-131 0f7269f0 (to 0103, plus 0110) with 0104 from r1/t48-builder-parity @ 6c5ae3a8, 0105 from r1/ha18-gate-facts @ a9ffe246 (NOT VALID then VALIDATE), 0106/0107 from r1/admin-list-perf @ 69f465c8 copied in. Prisma 7.10.1, migrated as a dedicated pp_owner role. Not measured on the production table.

Run with `lock_timeout = 5s` and no competing writer (`finished_at - started_at` in `_prisma_migrations`):

| Step | Cold | Warm |
|---|---|---|
| 0104 add `admin_created` | 7 ms | 9 ms |
| 0105 gate facts (the current shape, `NOT VALID` then `VALIDATE`) | 578 ms | 353 ms |
| 0106 `pg_trgm` and two GIN indexes | 18.4 s | 18.4 s |
| 0107 Kertas index | 1.03 s | 0.90 s |
| 0110 reference image tokens (in base, the fifth "Applying") | 15 ms | 8 ms |
| Whole `migrate deploy` (wall) | 21.3 s | 21.0 s |

The schemas were identical cold and warm. 0106 was **not killed** at 18.4 s: `lock_timeout` limits the wait for a lock, not the statement time. The older shape of 0105 (2026-11-01, fc409ae1) took 6.2 s cold and 0.4 s warm; the figure stays in 2.3 as history. Timing source: `SELECT migration_name, finished_at - started_at AS dur, rolled_back_at IS NOT NULL AS rb FROM _prisma_migrations WHERE migration_name >= '0104' ORDER BY 1, started_at;`

**1. Window rule: no admin writes and no ETL while 0106 and 0107 run.** Both take a SHARE lock on `question_versions`: writes to that table wait, reads do not (2.3, lock table). At 408k questions that is about 18 s for 0106 and about 1 to 2 s for 0107 (A4 rehearsals; **not measured on the production table**). So during the window nobody saves, approves, imports, accepts or bulk-actions questions in Studio or Pentadbiran (any admin write to a question), and no ETL job runs (the `slot.sh etl` / `pp_etl` path). Pupils can keep reading; a pupil write that touches `question_versions` waits like the others (2.3). Measured stalls during a normal deploy with traffic (reader / writer): 0105 238 ms / 228 ms; 0106 not blocked / 17.2 s; 0107 not blocked / 0.86 s.

**2. `lock_timeout`: how to set it so that Prisma's sessions get it.** `prisma migrate deploy` opens its own sessions as the migrate role (on the VPS `pp_owner`, `DATABASE_URL` from `migrate.env`, `deploy/vps/compose.prod.yaml` service `migrate`). A `SET lock_timeout` typed in your own `psql` session does not reach them, and a `SET LOCAL` inside the migration files would be a code change: **not done, not proposed**.

- **Preferred (rehearsed): a per-session option in the migrate `DATABASE_URL`.** Nothing to reset afterwards. Shape (placeholders only; never paste or print the real value):

```
DATABASE_URL="postgresql://<role>:<password>@<host>:<port>/<db>?schema=public&options=-c%20lock_timeout%3D5s" prisma migrate deploy
```

  On the VPS the migrate job reads `DATABASE_URL` from `/etc/pretasiplus/migrate.env`. For the window, **edit the migrate env value**: add `options=-c%20lock_timeout%3D5s` to the query string of the existing `DATABASE_URL` (after `?`, or after `&` if the URL already has a query), do not retype the credential, run the deploy, then remove the option again so the file is as `db-roles.sh secrets` wrote it. The deploy preflight accepts a query string (`deploy/vps/lib.sh:62`, `pp_parse_db_url`: `(\?.*)?`). Same behaviour as the role default below: 55P03 after about 5 s with a blocker; a clean run passes (0106 18.7 s, not killed); `prisma migrate resolve` works with the same URL.
- **Do NOT use `PGOPTIONS='-c lock_timeout=5s'`.** Prisma ignores it, so nothing times out and the deploy waits forever behind the blocker. This is a silent trap: the command runs without any error.
- **Fallback (rehearsed): a role default.** As the database superuser, before the window: `ALTER ROLE <migrate role> SET lock_timeout = '5s';` and, after the window **and after any failure**: `ALTER ROLE <migrate role> RESET lock_timeout;`. Side effects, all verified: it applies to **new** sessions only; a session opened during the window keeps 5 s even after the `RESET`, so the `RESET` is mandatory; pooled app connections on the same role keep 5 s until they reconnect, so confirm on the day that the app role and the ETL role are not the migrate role (by design `pp_app`, `pp_etl` and `pp_owner` are three roles, `deploy/vps/db-roles.sh`). Check from a new session of that role: `SHOW lock_timeout;`.

**Value: 5 s.** It is above the short application transactions and bounds the freeze; a failure is the recovery below. Do not go above about 10 s; 1 to 2 s fails on ordinary transactions. Other values were not tested. Why a bound matters: with a long application transaction open, the queued `ACCESS EXCLUSIVE` request of 0105 blocks even reads (a primary-key `SELECT` stalled 4.93 s), so for 0105 the value is the longest freeze of reads **and** writes. While 0106 or 0107 wait for their SHARE lock, reads are not stalled (`count(*)` 0.14 s) but writes to **other** rows are (about 2.7 s, until the migration timed out), so for 0106 and 0107 the value is the longest freeze of writes (dev-1 rehearsal 2026-11-02). It applies to every statement of that deploy under the role, also the waits of 0104 and 0105 (and 0100 if it is in the release). It bounds the wait for a lock, not a build that is already running.

**Check before the window** (a session that holds a lock will make a file fail): `SELECT pid, usename, state, xact_start, left(query, 80) FROM pg_stat_activity WHERE state <> 'idle' ORDER BY xact_start;`

**Transactions in Prisma 7.10.1 (A4 and dev-1, by experiment; re-test on a Prisma upgrade).** Prisma never sends `BEGIN` or `COMMIT`.
- A file **with a `DO` block** is sent whole as one simple-query message, so it runs as one implicit transaction: **atomic**. A probe left nothing whether the `DO` block was first, in the middle or last. **0105 is this kind.**
- A file **without a `DO` block** is split (quote-aware) into autocommit statements: **not atomic**. dev-1's probe (`CREATE TABLE; CREATE EXTENSION; SELECT 1/0`) left both objects behind, and it is why `pg_trgm` survived a failed 0106. **0106 and 0107 are this kind** (no `DO`). 0110 has no `DO` either (two `UPDATE`s, each its own statement). 0104 is one statement. 0100 has a `DO` block (not tested on 0100 itself).
- A hand-written `BEGIN` / `COMMIT` in a file without `DO` is fragile: on a failure the session is left aborted.

The header comments of 0106 and 0107 ("Prisma runs the file in one transaction") are therefore inaccurate, and so is the 0105 header sentence that its `VALIDATE` "takes only SHARE UPDATE EXCLUSIVE (reads and writes continue)": inside 0105's `DO`-block file the `ADD COLUMN` lock (ACCESS EXCLUSIVE) is held to the end of the file, so the `NOT VALID` / `VALIDATE` split gives **no online benefit** (A4 confirmed). Both are recorded as rows in `docs/architecture/v2-backend-deviations.md` (owner: admin-list-perf for 0106/0107; the 0105 file is merged and frozen; the files are not edited). A benefit exists only when the `VALIDATE` is in a separate file without a `DO` block: a throwaway test cut the ACCESS EXCLUSIVE window to 43 ms. That is not applicable to 0105 (merged as BASE-132, and about 0.4 s at 408k in the maintenance window is acceptable); the pattern is KIV R2.

**0105 under real `prisma migrate deploy` (A4, separate run from the table above; Prisma 7.10.1, local Postgres 16, 408k rows, evidence from `log_statement = all` server logs).** Prisma 7.10.1: a migration file containing a `DO` block is sent whole and is atomic. A file without one is split into autocommit statements, so a mid-file failure leaves earlier statements committed (0106/0107: `pg_trgm` can survive). 0105 is the atomic kind: ACCESS EXCLUSIVE on `question_versions` is taken at the first `ADD COLUMN` and held to the end of the file, so reads and writes of `question_versions` wait for the whole file (about 0.3 to 0.45 s at 408k; longer with real backfill rows and a bigger table).

| 0105 measure (cold / warm) | Value |
|---|---|
| File time | 427 ms / 331 ms |
| Reader stall (probe every 50 ms) | 413 ms / 302 ms |
| Writer stall | 408 ms / 302 ms |
| `ADD COLUMN` | 4 + 1 ms |
| each `NOT VALID` | 1.5 ms |
| `DO` backfill (0 rows) | 41 ms |
| `VALIDATE` (the two CHECKs) | 162 ms + 140 ms |

The stall is about the file time: reads and writes wait for the whole file. The backfill and the two `VALIDATE`s are full scans, so the time grows with the table. These figures are a different run from the 578 ms / 353 ms of the table above (also a `migrate deploy` timing); both are kept.

**If it times out (rehearsed).** Common to every case: the `_prisma_migrations` row of the folder is left unfinished (`finished_at` NULL, the error in `logs`), `prisma migrate deploy` again answers **P3009**, and `/api/ready` answers 503 while the row is failed, so recover promptly.
- **0106 (dev-1, 2026-11-02).** Context: local Postgres 16 in Docker (own throwaway container, no server touched); base `feature/v3-bijak-r1` ef987d27 (BASE-134) plus 0106/0107 from `r1/admin-list-perf` @ 69f465c8 (blob hashes match); `pp_owner` a non-superuser database owner; 5,000 `question_versions` rows; the URL option `options=-c%20lock_timeout%3D5s`; `prisma migrate deploy`; an idle-in-transaction writer holding one `question_versions` row. Result: `P3018` / `55P03 canceling statement due to lock timeout` on the first `CREATE INDEX` after 5 s of waiting (6.6 s wall); `applied_steps_count` 0; no 0106 index existed afterwards and every existing `question_versions` index was valid and ready.
- **0107.** The same pattern: `ix_question_versions_paper_kertas` was absent after the failure, and valid and ready after the same recovery.
- **0105 (A4, under real `prisma migrate deploy`).** 0105 is atomic, so a failure anywhere leaves **only a failed history row** (`finished_at` NULL, `applied_steps_count` 0): (i) a `1/0` before the `VALIDATE`s: full rollback; (ii) a lock timeout inside the `DO` block (a blocker on `questions`): `55P03` after 5 s, with ACCESS EXCLUSIVE on `question_versions` held the whole time, so **reads and writes stall for about 5.0 s**, then a full rollback. `lock_timeout` bounds the stall but does not remove it. A blocker on `question_versions` that starts after the `ADD COLUMN` just queues; it cannot fail 0105. Earlier, with an idle-in-transaction writer on `question_versions`, 0104 applied and 0105 failed after about 5 s with `P3018 ... 55P03`.
- **A short blocker (about 3.5 s) is waited out** and the deploy passes with no recovery.

**Recovery (verified for the clean-failure cases above):**
1. `SELECT pg_terminate_backend(<pid>);` on the blocker (the `pg_stat_activity` query above).
2. **For 0106 and 0107 (files without a `DO` block), before `resolve --rolled-back`, check what the failed file left behind:**
   ```sql
   SELECT indexrelid::regclass, indisvalid, indisready FROM pg_index WHERE indrelid = 'question_versions'::regclass;
   \dx
   ```
   Drop any stray `ix_question_versions_stem_ms_trgm`, `ix_question_versions_stem_en_trgm` or `ix_question_versions_paper_kertas` that the failed file created. Why: if the timeout hits the **second** `CREATE INDEX` of 0106, the first index stays, and `resolve --rolled-back` followed by `deploy` then fails with `E42P07 ... already exists`; after the `DROP INDEX` of the stray index, resolve and deploy work (simulated by hand; a real mid-file timeout was not triggered). A `pg_trgm` left behind is harmless (`CREATE EXTENSION IF NOT EXISTS`). **For 0105 no object check is needed**: it is atomic. Only if someone hand-split or edited the file can a partial state exist; then `resolve` plus `deploy` fails with `42701 column "last_editor" already exists`, and the guarded, idempotent revert goes first (tested on clean and partial tables):
   ```sql
   ALTER TABLE "question_versions" DROP CONSTRAINT IF EXISTS "ck_question_versions_declared_marks", DROP CONSTRAINT IF EXISTS "ck_question_versions_last_editor", DROP COLUMN IF EXISTS "declared_marks", DROP COLUMN IF EXISTS "last_editor";
   ```
3. `prisma migrate resolve --rolled-back <folder>`.
4. `prisma migrate deploy` (after a 0106 failure it applied 0106, 0107 and 0110; after a 0105 failure, 0105 to 0110). The end state is identical to a clean apply, plus one rolled-back audit row (verified for 0105).
5. `prisma migrate status` ("Database schema is up to date!"). The final schema equalled the clean run, plus one rolled-back history row.

**3. `pg_trgm` pre-check (before the window).**

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';                                 -- 0 rows before 0106; 1 row after
SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';    -- 1 row: the contrib module is available; installed_version NULL before 0106
```

0106 itself runs `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (`0106_question_stem_trgm/migration.sql:22` on `r1/admin-list-perf` @ 69f465c8). If the extension is already installed that statement does nothing. If not, the migrate role needs the **`CREATE` privilege on the database**. **No superuser is needed**: `pg_trgm` is a trusted extension on Postgres 13+, and the database owner can run `CREATE EXTENSION` (dev-1 rehearsal 2026-11-02, `pp_owner` as a non-superuser database owner); a managed host must allow it. Verified on Postgres 16 with a role without that privilege: `ERROR: permission denied to create extension "pg_trgm"`, `HINT: Must have CREATE privilege on current database to create this extension.` If the first query returns 0 rows and the role lacks the privilege, have a privileged role run `CREATE EXTENSION IF NOT EXISTS pg_trgm;` before the window, so that 0106 does not stop at its first statement (a later revert then must not `DROP EXTENSION` it, 2.3). If the second query returns no row, the contrib package is missing on the host: do not start the window.

**4. `ANALYZE` after the window.** Right after 0106 and 0107 have both applied: `ANALYZE question_versions;`. It is the only table the two indexes sit on, so it is the only one to analyse for them; it takes no exclusive lock and took 0.83 s at 408k (A4, 2.3). It is separate from the `VACUUM ANALYZE question_versions;` that follows 0100 (2.2).

## 3. Verification SQL (read-only SELECTs)

Run with a read-only role or `psql -c` inside a read-only transaction (`BEGIN READ ONLY; ... ROLLBACK;`). Record every "before" result; the "after" blocks say what to expect.

### 3.1 Before the migrations (record these)

```sql
-- 0092: blueprints by source (UAT at handoff: 0 rows) and the guard value (expect 0, else 0092 aborts on purpose)
SELECT source, count(*) FROM blueprints GROUP BY source ORDER BY source;
SELECT count(*) AS sections_with_topic_weights FROM blueprint_sections WHERE topic_weights IS NOT NULL;
SELECT code, version, status, source FROM blueprints WHERE status = 'active' ORDER BY code;

-- 0100: version counts by status (expect only draft, review, approved, published, archived)
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;

-- becomes review (approved but never published)
SELECT count(*) AS approved_to_review FROM question_versions WHERE status = 'approved';

-- becomes approved (served today)
SELECT count(*) AS published_to_approved FROM question_versions WHERE status = 'published';

-- questions live today
SELECT count(*) AS live_questions FROM questions WHERE live_version_no IS NOT NULL;

-- a live pointer must be on a published version (expect 0 rows)
SELECT q.id FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'published' LIMIT 20;

-- 0100 (T04): published papers whose placements are pinned to an 'approved' version; those versions become 'review'.
-- Record the number; not 0 holds the window until the lead decides (r1-release-notes.md section 2.1).
SELECT count(*) AS placements_pinned_to_approved
  FROM paper_placements pp
  JOIN paper_sections ps ON ps.id = pp.paper_section_id
  JOIN papers p ON p.id = ps.paper_id AND p.status = 'published'
  JOIN question_versions v ON v.question_id = pp.question_id AND v.version_no = pp.pinned_version_no
 WHERE v.status = 'approved';

-- 0101 / 0102: question_parts shape before (neither column exists yet; the mode CHECK has no essay_choice)
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'question_parts' AND column_name IN ('topics', 'cognitive_level');          -- expect 0 rows
SELECT mode, count(*) FROM question_parts GROUP BY mode ORDER BY mode;                          -- record
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'question_parts'::regclass AND conname = 'ck_question_parts_mode';           -- record

-- 0104: paper_sections before (no admin_created column yet)
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'paper_sections' AND column_name = 'admin_created';                               -- expect 0 rows
SELECT count(*) AS sections FROM paper_sections;                                                        -- record

-- 0105: question_versions before (neither column exists yet)
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'question_versions' AND column_name IN ('last_editor', 'declared_marks');            -- expect 0 rows
-- 0105 prediction 1: versions the backfill will mark 'ai' (compare with the NOTICE and with 3.5d)
SELECT count(*) AS will_be_ai FROM question_versions v
 WHERE v.status IN ('draft', 'review')
   AND EXISTS (SELECT 1 FROM questions q WHERE q.id = v.question_id AND q.source_type = 'ai_variant')
   AND NOT EXISTS (SELECT 1 FROM question_status_events e
                    WHERE e.question_id = v.question_id AND e.version_no = v.version_no
                      AND e.from_status IS NOT NULL AND e.actor_user_id IS NOT NULL);                    -- record
-- 0105 prediction 2: versions that will get declared_marks (an intake item with NO parts and a whole total 1..999)
SELECT count(*) AS will_have_declared_marks FROM question_versions v
  JOIN intake_items i ON v.intake_item_id = i.id
 WHERE jsonb_typeof(i.payload->'marks') = 'number' AND (i.payload->>'marks') ~ '^[1-9][0-9]{0,2}$'
   AND jsonb_array_length(CASE WHEN jsonb_typeof(i.payload->'parts') = 'array' THEN i.payload->'parts' ELSE '[]'::jsonb END) = 0;           -- record
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;                         -- record (same as 3.1 above)

-- 0103: the report table before (nothing wrote attempt_id, so with_attempt is normally 0)
SELECT count(*) AS reports, count(attempt_id) AS with_attempt FROM question_reports;                  -- record
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'question_reports' AND column_name IN ('paper_id', 'paper_label');                -- expect 0 rows
```

### 3.2 After 0092 and 0093

```sql
-- the new blueprint columns and tables exist
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'blueprints' AND column_name IN ('serves_students', 'structure_hash', 'verification_id', 'kbat_marks', 'level_share');  -- 5 rows
SELECT table_name FROM information_schema.tables WHERE table_name IN ('blueprint_evidence', 'blueprint_verifications');                      -- 2 rows
SELECT column_name FROM information_schema.columns WHERE table_name = 'blueprint_sections' AND column_name = 'topic_weights';                -- 0 rows

-- no blueprint serves students and none is verified (0092 downgraded every 'verified' row); expect source <> 'verified' everywhere
SELECT code, version, status, source, serves_students FROM blueprints WHERE status = 'active' ORDER BY code;

-- 0093: the index exists
SELECT indexname FROM pg_indexes WHERE indexname = 'ix_part_options_image_file_id';             -- 1 row
```

### 3.3 After 0100 and the new API (counts by status)

Run `VACUUM ANALYZE question_versions;` first (section 2.2).

```sql
-- no 'published' remains; approved = old published; review = old review + old approved
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;

-- every live pointer is on an approved version (expect 0 rows)
SELECT q.id FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'approved' LIMIT 20;

-- at most one approved version per question (expect 0 rows)
SELECT question_id FROM question_versions WHERE status = 'approved' GROUP BY 1 HAVING count(*) > 1;

-- every predicate reads status = 'approved'; none mentions 'published'
SELECT indexname, indexdef FROM pg_indexes
 WHERE tablename = 'question_versions' AND indexdef LIKE '%WHERE%' ORDER BY indexname;

-- the status CHECK lists the four statuses
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'ck_question_versions_status';
```

Check by hand: `approved_after = published_before` and `review_after = review_before + approved_before` (from 3.1). The migration also prints `0100 pre-flight` and `0100 post` NOTICE lines with these counts in the migrate log.

### 3.4 After 0101 (T25 essay_choice; only when applied)

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'question_parts' AND column_name = 'topics';   -- 1 row, jsonb
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'question_parts'::regclass AND conname = 'ck_question_parts_mode';    -- now lists essay_choice
SELECT conname FROM pg_constraint WHERE conrelid = 'question_parts'::regclass AND conname = 'ck_question_parts_topics';                   -- 1 row

-- the migration is additive: the mode counts equal the 3.1 record, and nothing has topics yet
SELECT mode, count(*) FROM question_parts GROUP BY mode ORDER BY mode;
SELECT count(*) AS with_topics FROM question_parts WHERE topics IS NOT NULL;                                                              -- 0 right after the migration

-- invariant afterwards: topics only on an essay_choice leaf, 2 to 6 of them (expect 0 rows)
SELECT id FROM question_parts
 WHERE (mode IS DISTINCT FROM 'essay_choice' AND topics IS NOT NULL)
    OR (mode = 'essay_choice' AND (topics IS NULL OR jsonb_array_length(topics) NOT BETWEEN 2 AND 6)) LIMIT 20;
```

### 3.5 After 0102 (T33 leaf cognitive level; only when applied)

```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'question_parts' AND column_name = 'cognitive_level';  -- 1 row, text
SELECT conname FROM pg_constraint WHERE conrelid = 'question_parts'::regclass
   AND conname IN ('ck_question_parts_cognitive_level', 'ck_question_parts_cognitive_level_leaf_only');                                  -- 2 rows

-- no backfill: right after the migration every part is NULL
SELECT cognitive_level, count(*) FROM question_parts GROUP BY cognitive_level ORDER BY 1;                                                -- one row, NULL, = total parts

-- invariant afterwards (expect 0 rows): a part without a mode has no level
SELECT id FROM question_parts WHERE mode IS NULL AND cognitive_level IS NOT NULL LIMIT 20;
```

### 3.5b After 0103 (T42 report context; only when applied)

```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'question_reports' AND column_name IN ('paper_id', 'paper_label');                 -- 2 rows

-- 3 constraints; the attempt FK must stay NOT VALID (convalidated = false). Do not validate it in the release.
SELECT conname, convalidated FROM pg_constraint
 WHERE conrelid = 'question_reports'::regclass
   AND conname IN ('ck_question_reports_paper_label', 'fk_question_reports_paper_id', 'fk_question_reports_attempt_id');

SELECT indexname FROM pg_indexes WHERE indexname = 'ix_question_reports_paper_id';                       -- 1 row

-- nothing changed in the data: same total as 3.1, no paper yet
SELECT count(*) AS reports, count(paper_id) AS with_paper FROM question_reports;                         -- with_paper 0

-- later, once pupils report from a sitting: every report that names an attempt also names its paper (expect 0 rows)
SELECT id FROM question_reports WHERE attempt_id IS NOT NULL AND paper_id IS NULL LIMIT 20;
```

### 3.5c After 0104 (T48 admin-added Bahagian; only when applied)

```sql
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
 WHERE table_name = 'paper_sections' AND column_name = 'admin_created';                                -- boolean, NO, false

-- every existing section comes from a Kontrak: one row, false, count = the 3.1 record
SELECT admin_created, count(*) FROM paper_sections GROUP BY admin_created ORDER BY admin_created;

-- nothing is admin-added right after the migration (expect 0)
SELECT count(*) AS admin_added FROM paper_sections WHERE admin_created;
```

### 3.5d After 0105 (H-A18 gate facts; only when applied)

```sql
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
 WHERE table_name = 'question_versions' AND column_name IN ('last_editor', 'declared_marks')
 ORDER BY column_name;                                                  -- declared_marks smallint YES null; last_editor text NO 'person'::text

SELECT conname, convalidated FROM pg_constraint
 WHERE conrelid = 'question_versions'::regclass
   AND conname IN ('ck_question_versions_last_editor', 'ck_question_versions_declared_marks')
 ORDER BY conname;                                                      -- 2 rows, both validated

-- the backfill NOTICE check: the counts must equal the two predictions of 3.1
SELECT last_editor, count(*) FROM question_versions GROUP BY last_editor ORDER BY last_editor;          -- 'ai' = will_be_ai
SELECT count(*) AS with_declared_marks FROM question_versions WHERE declared_marks IS NOT NULL;         -- = will_have_declared_marks

-- approved and archived rows are never marked 'ai' (expect 0)
SELECT count(*) AS approved_or_archived_ai FROM question_versions
 WHERE status IN ('approved', 'archived') AND last_editor = 'ai';

-- the status counts did not move (same as 3.1)
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;
```

**The NOTICE.** `prisma migrate deploy` may not show server notices. If it does not, the two SELECTs above are the check; to see the NOTICE itself, run the same SQL on a copy of the database with `psql -f` (not on the live database). **Rollback of 0105** (header SQL, then the history row; no `--rolled-back`, release notes 6.3):

```sql
ALTER TABLE "question_versions" DROP CONSTRAINT "ck_question_versions_declared_marks", DROP CONSTRAINT "ck_question_versions_last_editor",
  DROP COLUMN "declared_marks", DROP COLUMN "last_editor";
```

Then `DELETE FROM _prisma_migrations WHERE migration_name = '0105_gate_facts';` (a write; the operator runs it by hand after the reverse SQL, release notes 6.3). Reverse SQL drops the backfilled values.

The migration history, after all of them:

```sql
SELECT migration_name, finished_at FROM _prisma_migrations
 WHERE migration_name IN ('0092_bijak_standards', '0093_part_options_image_file_index', '0100_question_lifecycle_approved',
                          '0101_essay_choice', '0102_leaf_cognitive_level', '0103_question_report_context',
                          '0104_paper_section_admin_created', '0105_gate_facts', '0106_question_stem_trgm',
                          '0107_question_paper_kertas_index', '0110_reference_image_tokens')
 ORDER BY started_at;
```

### 3.5e Before and after 0106, 0107 and 0110 (admin list perf, T34-L1-residual; only when applied)

Before (record; none of these exist yet; the first statement is the 0106 pre-check, run it before the window):

```sql
SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name = 'pg_trgm';                              -- 1 row, installed_version NULL until 0106
SELECT count(*) AS versions, count(stem_ms) AS with_stem_ms, count(stem_en) AS with_stem_en FROM question_versions;
SELECT count(*) AS pg_trgm_installed FROM pg_extension WHERE extname = 'pg_trgm';                                              -- 0
SELECT count(*) AS stem_trgm_indexes FROM pg_indexes WHERE indexname IN ('ix_question_versions_stem_ms_trgm', 'ix_question_versions_stem_en_trgm');   -- 0
SELECT count(*) AS kertas_index FROM pg_indexes WHERE indexname = 'ix_question_versions_paper_kertas';                          -- 0

-- 0110: reference-sheet pictures that are still a decimal id (the migration rewrites those that name a stored image)
SELECT 'papers' AS t, count(*) AS decimal_ids
  FROM papers p, jsonb_array_elements(CASE WHEN jsonb_typeof(p.reference_sheets) = 'array' THEN p.reference_sheets ELSE '[]'::jsonb END) e
 WHERE jsonb_typeof(e -> 'imageFileId') = 'string' AND e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$'
UNION ALL
SELECT 'blueprints', count(*)
  FROM blueprints b, jsonb_array_elements(CASE WHEN jsonb_typeof(b.reference_sheets) = 'array' THEN b.reference_sheets ELSE '[]'::jsonb END) e
 WHERE jsonb_typeof(e -> 'imageFileId') = 'string' AND e ->> 'imageFileId' ~ '^[1-9][0-9]{0,17}$';
```

After:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';                                                                     -- 1 row
SELECT c.relname, i.indisvalid, i.indpred IS NOT NULL AS partial, pg_get_indexdef(c.oid) LIKE '%gin_trgm_ops%' AS trigram
  FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
 WHERE c.relname IN ('ix_question_versions_stem_ms_trgm', 'ix_question_versions_stem_en_trgm') ORDER BY c.relname;               -- 2 rows: t t t

-- the planner can use them (read-only; a small table prefers a sequential scan, so switch that off inside a transaction that is rolled back)
BEGIN; SET LOCAL enable_seqscan = off;
EXPLAIN (COSTS OFF) SELECT 1 FROM question_versions WHERE stem_ms ILIKE '%segi%' ESCAPE '\' OR stem_en ILIKE '%segi%' ESCAPE '\';   -- BitmapOr of the two indexes
ROLLBACK;

SELECT c.relname, i.indisvalid, i.indpred IS NOT NULL AS partial FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
 WHERE c.relname = 'ix_question_versions_paper_kertas';                                                                         -- 1 row: t t

ANALYZE question_versions;                                                                                                       -- once, after 0106 and 0107 (no exclusive lock)

-- 0110: re-run the "decimal_ids" SELECT of the before block. What remains are ids that name no stored image (the Terbit check reports those).
SELECT count(*) AS versions, count(stem_ms) AS with_stem_ms, count(stem_en) AS with_stem_en FROM question_versions;               -- same as before
```

Reverse of 0107 and 0106, **in this order** (run by hand, then delete their `_prisma_migrations` rows as in 2.2; the full procedure for 0104 to 0107 is in 2.3): `DROP INDEX "ix_question_versions_paper_kertas";` (0107), then `DROP INDEX "ix_question_versions_stem_en_trgm"; DROP INDEX "ix_question_versions_stem_ms_trgm"; DROP EXTENSION "pg_trgm";` (0106; `DROP EXTENSION` only if nothing else uses `pg_trgm`). 0110 has no reverse.

**Ops recommendation, not in the code (A4):** `ALTER DATABASE <db> SET jit = off` (408k questions, unfiltered admin list p50/p95 661/878 ms to 445/618 ms; optional, the operator's call; local default `jit = on`). Admin list timings at 408k p50/p95 (A4, not re-measured here): text search 1575/1912 to 57/79 ms; Kertas filter 1716/2023 to 172/202 ms; unfiltered 739/898 to 661/878 ms.

### 3.6 The servable count and the login count

The login page count ("N+ Soalan") and the per-subject practice cards use one definition (live version, approved, active, MCQ, not PKSK, a learner-visible Tingkatan 4 or 5 level, an active subject linked to that level). It must equal the sum of the subject cards and must not change by accident across 0100:

```sql
-- the login count (QUESTION_COUNT_SQL + SPM_SERVABLE_SQL)
SELECT count(*) AS login_count
  FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE q.is_active AND v.status = 'approved' AND v.type = 'mcq'
   AND (v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND (el.stage = 'primary' OR NOT el.is_active)))
   AND NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')
   AND EXISTS (SELECT 1 FROM education_levels ol WHERE ol.id = v.education_level_id AND ol.code IN ('T4', 'T5'))
   AND EXISTS (SELECT 1 FROM subjects sj WHERE sj.id = v.subject_id AND sj.is_active)
   AND EXISTS (SELECT 1 FROM subject_levels sl WHERE sl.subject_id = v.subject_id AND sl.education_level_id = v.education_level_id);

-- served today, any type and level (the wider "approved = servable" count: should equal the old live count)
SELECT count(*) AS servable FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
 WHERE q.is_active;

-- the login count by subject (compare with the practice cards): the same filters as the login count above
SELECT sj.code, count(*) AS n
  FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
  JOIN subjects sj ON sj.id = v.subject_id AND sj.is_active
 WHERE q.is_active AND v.status = 'approved' AND v.type = 'mcq'
   AND (v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND (el.stage = 'primary' OR NOT el.is_active)))
   AND NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')
   AND EXISTS (SELECT 1 FROM education_levels ol WHERE ol.id = v.education_level_id AND ol.code IN ('T4', 'T5'))
   AND EXISTS (SELECT 1 FROM subject_levels sl WHERE sl.subject_id = v.subject_id AND sl.education_level_id = v.education_level_id)
 GROUP BY sj.code ORDER BY sj.code;
```

Note (D91): the practice **card** counts ungrouped questions only; the login count still counts group members, so on the demo seed the card is lower than the login count by the group MCQs. That difference is intended.

### 3.6b R1-11.4: the legacy questions that qualified before still appear; image-held items stay excluded

Read-only. Run the first SELECT **before** the migrations (record it with 3.1) and again after 0100 and after the legacy loader. The identity to check is `live_questions = servable + live_approved_inactive + live_not_approved`, and `servable` after must be at least the `servable`-equivalent you recorded before (nothing that was served before may drop out, apart from questions an admin switched off or archived on purpose). `live_approved_inactive` are live questions switched off (the loader holds a legacy question inactive when its image was not copied); the second and third SELECT must show that every held-image question is excluded and none is served.

```sql
-- (1) the identity
SELECT (SELECT count(*) FROM questions WHERE live_version_no IS NOT NULL) AS live_questions,
       (SELECT count(*) FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved' WHERE q.is_active) AS servable,
       (SELECT count(*) FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved' WHERE NOT q.is_active) AS live_approved_inactive,
       (SELECT count(*) FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status <> 'approved') AS live_not_approved;
-- (2) image-held questions (live, inactive, loader issue legacy_image_unresolved): expected = the number the loader report listed
SELECT count(*) AS held_image_inactive
  FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE NOT q.is_active AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb;
-- (3) held-image questions that are served anywhere: must be 0
SELECT count(*) AS held_image_but_served
  FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
 WHERE q.is_active AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb;
```

The login count and the per-subject cards are the SELECTs of 3.6 above (the same text, copied here only for the run below): `login_count` must equal the sum of the card `n`.

Real output from the testcontainer database seeded the way the specs seed it (`bootQuestionsApp`: identity, curriculum, questions seed; one held-image question made as in `test/questions/held-image.spec.ts`; run on 2026-11-01 under `apps/api/test/questions`, output copied as printed):

| SELECT | Output |
|---|---|
| (1) on the seed alone | `live_questions 16, servable 16, live_approved_inactive 0, live_not_approved 0` |
| (1) after one held-image question was added | `live_questions 17, servable 16, live_approved_inactive 1, live_not_approved 0` |
| (2) | `held_image_inactive 1` |
| (3) | `held_image_but_served 0` |
| login count (3.6) | `login_count 9` |
| cards (3.6) | `BM 5`, `MATH 2`, `SCI 2` (sum 9 = login count) |

On UAT the numbers differ (about 406,396 legacy questions); only the shape is expected to match: the identity holds, (3) is 0, and `servable` after is not below the `servable` recorded before. The UAT before and after counts themselves are ops evidence; this note only fixes the queries.

Pinned by `apps/api/test/questions/legacy-no-regression-select.spec.ts` ("R1-11.4: the runbook no-regression SELECTs (3.6b) on a seeded bank", 3 tests, the SELECT text copied from here) on `r1/partial-acs-a3` @ e6ceece1. **Note on SELECT 2:** it reads the import issues of the LIVE version, so "expected = the number the loader report listed" holds only before any edit. An admin edit published without the missing image leaves the question inactive and unserved (SELECT 3 stays 0, `servable` unchanged) but moves it out of SELECT 2.

### 3.7 Before go-live: stimulus groups in published papers (GROUP_SPLIT, GROUP_NOT_CONSECUTIVE)

B4 and ops run this on UAT before go-live (read-only). The builder's check refuses a group that is split or broken up, but a paper that reached `published` by another route (a seed, a migration, an older builder) is not re-checked by it. Any row means **that paper is re-composed in the builder before go-live** (open it, put the group back as one run in one Bahagian, Terbit again). 0 rows is the expected result.

The logic follows `checkPaperDetailed` in `apps/api/src/modules/exam/builder/paper-check.ts` (BASE-105 `7ea2208c`, lines 192-199 and 222-227; the same file on the T48, T31 and T43 branches) and the schema: a placement is a row of `paper_placements` (`paper_section_id` -> `paper_sections.paper_id` -> `papers`, ordered by `position`), and its group is `questions.group_id` (the link the builder reads as `groupId`). A **run** is a stretch of placements of one group with nothing else between them (`unitsOf`). `GROUP_SPLIT` = the group's placements are in more than one `paper_sections` row of the paper. `GROUP_NOT_CONSECUTIVE` = inside one Bahagian the group has more than one run, so another placement sits between two members. Only `papers.status = 'published'` is read; every `kind` is included.

```sql
BEGIN READ ONLY;
-- Published papers whose stimulus groups break the builder's rules (paper-check.ts):
--   GROUP_SPLIT           the group's questions sit in more than one Bahagian
--   GROUP_NOT_CONSECUTIVE inside one Bahagian, another placement sits between two members of the group
WITH pl AS (
  SELECT p.id AS paper_id, p.paper_code, p.status, p.kind,
         s.id AS section_id, pp.position AS pos, q.group_id
    FROM papers p
    JOIN paper_sections s     ON s.paper_id = p.id
    JOIN paper_placements pp  ON pp.paper_section_id = s.id
    JOIN questions q          ON q.id = pp.question_id
   WHERE p.status = 'published'
),
runs AS (  -- a run starts where the previous placement of the Bahagian has another group (or none)
  SELECT pl.*,
         (group_id IS NOT NULL
          AND group_id IS DISTINCT FROM LAG(group_id) OVER (PARTITION BY section_id ORDER BY pos)) AS run_start
    FROM pl
)
SELECT paper_id, paper_code, status, group_id, reason
  FROM (
    SELECT paper_id, paper_code, status, group_id, 'GROUP_SPLIT' AS reason
      FROM runs WHERE group_id IS NOT NULL
     GROUP BY paper_id, paper_code, status, group_id
    HAVING count(DISTINCT section_id) > 1
    UNION ALL
    SELECT paper_id, paper_code, status, group_id, 'GROUP_NOT_CONSECUTIVE'
      FROM runs WHERE group_id IS NOT NULL
     GROUP BY paper_id, paper_code, status, group_id, section_id
    HAVING count(*) FILTER (WHERE run_start) > 1
  ) hits
 ORDER BY paper_id, group_id, reason;
ROLLBACK;
```

Output: paper id, paper code, status, the group id (`stimulus_groups.id`) and the reason. A group is reported once per reason.

Not covered on purpose: a group that is complete or in the wrong member order (`GROUP_INCOMPLETE`, `GROUP_OUT_OF_ORDER`) is a separate builder line and is not selected here. A question whose group has no servable member counts as a plain question in the builder; this SELECT still sees its `group_id` (a rare extra row, which is safe to re-compose). A hit on a `jana` (generated) paper cannot be re-composed in the builder: report it to team A.

**Run (2026-11-02, A3).** Throwaway Postgres 16 on a scratch port (no server, removed afterwards): the 46 base folders, 0001 to 0103, of BASE-105 `7ea2208c` applied with `prisma migrate deploy`, then the full demo seed (`NODE_ENV=development ALLOW_DEMO_SEED=1 tsx prisma/seed/index.ts`, 28 modules; 1 published paper, 4 withdrawn; 2 stimulus groups, 7 grouped questions). Inside `BEGIN READ ONLY ... ROLLBACK`, on the seeded database:

```
 paper_id | paper_code | status | group_id | reason
----------+------------+--------+----------+--------
(0 rows)
```

**It bites.** In a second transaction (read-write, rolled back; the paper count was 5 before and 5 after) two published papers were inserted on the demo subject: `BAD/1`, Bahagian A = question 10 (group 1), 20 (plain), 11, 12 (group 1), 13 (group 2), Bahagian B = 14, 15, 16 (group 2); and `OK/1`, Bahagian A = 10, 11, 12, 13, 14, 15, 16, Bahagian B = 20. The same SELECT then returned:

```
 paper_id | paper_code |  status   | group_id |        reason
----------+------------+-----------+----------+-----------------------
        6 | BAD/1      | published |        1 | GROUP_NOT_CONSECUTIVE
        6 | BAD/1      | published |        2 | GROUP_SPLIT
(2 rows)
```

`OK/1` (every group in one run, one Bahagian) is not listed. The builder's own `checkPaperDetailed` on the same two layouts returns `GROUP_NOT_CONSECUTIVE` and `GROUP_SPLIT` (plus `GROUP_INCOMPLETE` for the split group) for `BAD/1` and no line for `OK/1`.

## 4. DSKP load

UAT has 0 curriculum nodes until this runs, so DSKP tagging, blueprints and Jana Kertas cannot work there. The loader is a script, not a migration: insert-only, idempotent, one transaction per subject, Tingkatan 1-5 only. Full detail, flags and rollback: [dskp-loader.md](dskp-loader.md).

Run it as in [r1-release-notes.md](r1-release-notes.md) sections 3.2 (dry run) and 3.3 (real run, after the lead's confirmation): from the release checkout on the VPS, with `PP_IMAGE_TAG` set to the release tag so that `$PC` uses `pretasiplus-api-migrate:$PP_IMAGE_TAG` (not the stale `:prod` image):

```
$PC run --rm --no-deps migrate npm run dskp:load -w @pp/api -- --dry-run --create-missing-subjects     # always first; writes nothing
$PC run --rm --no-deps migrate npm run dskp:load -w @pp/api -- --create-missing-subjects               # the real run
$PC run --rm --no-deps migrate npm run dskp:load -w @pp/api -- --dry-run --create-missing-subjects     # again: every insert column must now be 0
```

`$PC`, `PP_IMAGE_TAG` and the image check are defined at the top of the release notes. On a local stack without compose the same loader is `npm run dskp:load -w @pp/api -- ...`.

Expected on an empty tree: 2,844 nodes and 1,394 TP descriptors over 13 subjects, 4 rejected TP rows (Landskap dan Nurseri), the dry run and the real run printing the same numbers. Exit code 0 is done; 1 means a subject failed (its transaction was rolled back; fix and re-run).

Verify with read-only SELECTs:

```sql
SELECT s.code AS subject, l.code AS level, count(*) AS nodes
  FROM curriculum_nodes n
  JOIN subjects s ON s.id = n.subject_id
  JOIN education_levels l ON l.id = n.education_level_id
 GROUP BY s.code, l.code ORDER BY s.code, l.code;

SELECT DISTINCT l.code FROM curriculum_nodes n JOIN education_levels l ON l.id = n.education_level_id ORDER BY 1;  -- T4, T5 only
SELECT count(*) FROM curriculum_nodes c WHERE parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM curriculum_nodes p WHERE p.id = c.parent_id);  -- 0
SELECT count(*) FROM curriculum_tp_descriptors WHERE tp NOT BETWEEN 1 AND 6;  -- 0
```

**R1-12.6 read-only check (curriculum nodes per in-scope subject).** The in-scope subjects are the 13 codes the loader loads (BM, BI, MATH, ADDMATH, PHY, SCI, SEJ, PI, TI, PM, PSV, LNR, KNP). Expected after a real load: every subject has `nodes > 0`, the second SELECT returns **0 rows**, the total is **2,844** (the loader's own report) and the levels are T4 and T5 only. Before the load every subject shows 0 (and 13 rows come back from the second SELECT).

```sql
-- nodes per in-scope subject (a subject that is missing from `subjects` also shows 0)
SELECT in_scope.code AS subject, count(n.id) AS nodes
  FROM (VALUES ('BM'),('BI'),('MATH'),('ADDMATH'),('PHY'),('SCI'),('SEJ'),('PI'),('TI'),('PM'),('PSV'),('LNR'),('KNP')) AS in_scope(code)
  LEFT JOIN subjects s ON s.code = in_scope.code
  LEFT JOIN curriculum_nodes n ON n.subject_id = s.id
 GROUP BY in_scope.code ORDER BY in_scope.code;
-- in-scope subjects without a node: expected 0 rows after the load
SELECT in_scope.code AS subject_without_nodes
  FROM (VALUES ('BM'),('BI'),('MATH'),('ADDMATH'),('PHY'),('SCI'),('SEJ'),('PI'),('TI'),('PM'),('PSV'),('LNR'),('KNP')) AS in_scope(code)
  LEFT JOIN subjects s ON s.code = in_scope.code
 WHERE NOT EXISTS (SELECT 1 FROM curriculum_nodes n WHERE n.subject_id = s.id)
 ORDER BY in_scope.code;
SELECT count(*) AS nodes FROM curriculum_nodes;
SELECT DISTINCT l.code FROM curriculum_nodes n JOIN education_levels l ON l.id = n.education_level_id ORDER BY 1;  -- T4, T5 only
```

Real output from the testcontainer database seeded the way the specs seed it (identity, curriculum and questions seeds, which load the DSKP tree; 2026-11-01, copied as printed): `nodes` per subject ADDMATH 257, BI 122, BM 162, KNP 281, LNR 168, MATH 188, PHY 281, PI 309, PM 198, PSV 216, SCI 306, SEJ 230, TI 126; the second SELECT returned no rows; total `nodes 2844`; levels `T4`, `T5`. UAT must show the same shape after `dskp:load`; the UAT run itself is ops evidence.

Pinned by `apps/api/test/curriculum/nodes-per-in-scope-subject.spec.ts` ("R1-12.6: curriculum nodes per in-scope subject (runbook section 4 SELECTs)", 4 tests, the SELECT text copied from here; identity and curriculum seeds) on `r1/partial-acs-a3` @ e6ceece1. The UAT run after `dskp:load` is still owed.

Rollback is by deleting what the load added, only before any question is tagged (nodes are referenced `ON DELETE RESTRICT`); after tagging, restore the backup. Steps are in [dskp-loader.md](dskp-loader.md).

## 5. Blueprints on UAT: created and verified by an Admin Pusat (D95), no seed

**Decision D95** (product owner via the user, 2026-10-31; PR amin-kerja-orang/prestasiplus#404, **not merged**, so the row is not yet in `docs/TRACKER.md` on `feature/v3-bijak-r1`; it is on branch `r1/d91-decisions`; it supersedes the earlier "seed on UAT" answer and the "Option B" of [r1-release-notes.md](r1-release-notes.md) section 4.1): on UAT an Admin Pusat creates each blueprint by hand in Kontrak, through the real flow, and presses **Sahkan**. Demo seeds, the launch-blueprint seed (`examLaunchBlueprintsSeed`) and the E2E seed are **local / E2E only**. No AI session acts on any server.

After 0092 every blueprint is Spec and serves no pupil, so a pupil's Jana Kertas answers 422 `NO_BLUEPRINT` for a subject until its blueprint is verified. Announce Jana Kertas to pupils only for the subject and kertas pairs verified here.

### 5.1 The rule for Sahkan

- **Only Admin Pusat** can verify (403 for any other role). Sahkan runs the blueprint gate (AC-39.1) and the evidence comparison (AC-39.7) and lists **every** failure at once; the verification row is insert-only and records the verifier.
- **Two-body evidence rule:** D76(4) in `docs/TRACKER.md`, AC-39.2 and AC-39.7 in `docs/requirements/v2-bijak-spm.md`. The record cites trial papers **and their skema** from at least two bodies, or an LPM format / JSU document. In the code (`packages/exam-core/src/evidence.ts:checkEvidence`): at least two distinct bodies that each have a `trial_paper` item and a `skema` item, unless an `lpm_format` item exists; and every compared value (duration, total marks, and per section mark budget, rule, question count) must be supported by two bodies and contradicted by none. (TRACKER row D95 calls this rule "D77"; the rule itself is D76(4), AC-39.2 and AC-39.7. D77 is an unrelated decision.) Topic quota and KBAT are not compared; they must be filled, and any value marked "Belum disemak" must be reviewed.
- **Evidence entered by hand only, and a note (H-A15 / T44, in base since BASE-67).** Evidence rows seeded from the study (`origin = 'study'`) are listed in the record but do not count: only `origin = 'admin'` rows reach the body rule and the comparison (`apps/api/src/modules/exam/blueprints/blueprint-verification.service.ts:238`). Sahkan needs a non-blank note: the body `{ note }` answers 422 `fields.note` "Isi nota pengesahan dahulu." without one (`packages/contract/src/bijak/standards/schema.ts:29`). A blueprint verified before this may fail a new Sahkan until evidence is entered by hand. Enter the evidence and the note as an Admin Pusat in the app.
- Every check Sahkan runs, with the code path and what is missing for each blueprint: [r1-k1-blueprint-evidence.md](r1-k1-blueprint-evidence.md) (T39; lives on branch `r1/t39-k1-evidence` until merged).
- Do not edit a Disahkan blueprint: a structural edit makes a new Spec version; the older Disahkan version keeps serving pupils until the new one is verified.
- Admin Pusat in Mod Pelajar may generate from a Spec head (test data); Admin Sekolah and pupils need Disahkan. The test is the role the session returns to (`mode.returnRole === 'admin'`, `apps/api/src/modules/bijak/papers/spec-access.ts:9`), not the roles the account holds.

### 5.2 Order

| # | Blueprint | State of evidence (see the evidence list for detail) |
|---|---|---|
| 1 | **3472/2** Matematik Tambahan K2, the worked example (step by step in the evidence list, section 2) | Repo data is sufficient except the duration line, which may have only one real supporting body (unconfirmed). |
| 2 | **1449/1** Matematik K1 | Not ready: KBAT marks undetermined and only one body has paper + skema. |
| 3 | **1249/1** Sejarah K1 | Not ready: one body only; no profile, quota or KBAT in the repo. |
| 4 | **4531/1** Fizik K1 | Not ready: one body has a paper; no profile or KBAT in the repo. |
| 5 | **Sains K1** (paper code to be read from a cover; unconfirmed) | Not ready: no paper evidence in the repo. |

Do 2 to 5 only when the evidence list shows the evidence from two or more bodies is in hand for that paper. A blueprint with a single evidence body, or with an empty KBAT field, cannot pass; do not work around the check.

### 5.3 Steps (Admin Pusat, in Pentadbiran)

1. Prerequisite: the DSKP load (section 4) has run, so "Tambah unit" lists the subject's units. Without units the quota cannot be filled.
2. Kontrak (`/admin/spm/kontrak`) > `Tambah Kontrak` > subject and kertas > fill the paper, the sections, the difficulty profile, the topic quota and the KBAT marks until the panel shows no problem > `Simpan`. If the contract already exists (for example a PoC contract on a database that ran the old seeds), open it and edit; each save is a new version.
3. Tab **Pengesahan** > `Tambah Bukti` for each trial paper and skema > `Semak Bukti` until every line reads "Sepadan".
4. Fill `Nota pengesahan` (required by the screen), press `Sahkan`, confirm. Success message: "Kontrak berjaya disahkan."

### 5.4 Read-only SELECTs: blueprint state before and after Sahkan

Tables and columns are those of `apps/api/prisma/schema/exam.prisma` (`blueprints`, `blueprint_sections`, `blueprint_evidence`, `blueprint_verifications`). Replace the code list as needed.

**Before Sahkan** (per blueprint; the gate fails until each of these is satisfied):

```sql
-- the head: status, source, serving flag, duration and totals
SELECT b.code, b.version, s.code AS subject, b.kertas, b.status, b.source, b.serves_students,
       b.duration_min, b.total_marks, b.kbat_marks, b.verification_id
  FROM blueprints b JOIN subjects s ON s.id = b.subject_id
 WHERE b.status = 'active' AND b.code IN ('3472/2', '1449/1', '1249/1', '4531/1') ORDER BY b.code;

-- sections: structure, profile, quota size, KBAT and whether the KBAT value is still "Belum disemak"
SELECT b.code, bs.position, bs.label, bs.rule_type, bs.rule_n, bs.question_count, bs.mark_budget, bs.allowed_modes,
       (bs.profile IS NOT NULL) AS has_profile,
       jsonb_array_length(COALESCE(bs.quota -> 'lines', '[]'::jsonb)) AS quota_lines,
       bs.kbat_marks, bs.kbat_reviewed
  FROM blueprints b JOIN blueprint_sections bs ON bs.blueprint_id = b.id
 WHERE b.status = 'active' AND b.code IN ('3472/2', '1449/1', '1249/1', '4531/1') ORDER BY b.code, bs.position;

-- quota lines still "Belum disemak" (a line the admin saved has no 'reviewed' key; a seeded unreviewed one has false)
SELECT b.code, bs.position, count(*) AS unreviewed_lines
  FROM blueprints b JOIN blueprint_sections bs ON bs.blueprint_id = b.id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bs.quota -> 'lines', '[]'::jsonb)) l
 WHERE b.status = 'active' AND (l ->> 'reviewed') = 'false' GROUP BY b.code, bs.position ORDER BY b.code, bs.position;

-- evidence rows on the head
SELECT b.code, e.kind, e.body, e.year, e.paper_code, e.origin
  FROM blueprints b JOIN blueprint_evidence e ON e.blueprint_id = b.id
 WHERE b.status = 'active' ORDER BY b.code, e.body, e.kind;

-- the body rule: bodies that have BOTH a trial paper and a skema (needs >= 2), and any LPM format item
SELECT b.code,
       (SELECT count(*) FROM (SELECT e.body FROM blueprint_evidence e WHERE e.blueprint_id = b.id
                               GROUP BY e.body HAVING bool_or(e.kind = 'trial_paper') AND bool_or(e.kind = 'skema')) x) AS bodies_with_paper_and_skema,
       (SELECT count(*) FROM blueprint_evidence e WHERE e.blueprint_id = b.id AND e.kind = 'lpm_format') AS lpm_items
  FROM blueprints b WHERE b.status = 'active' ORDER BY b.code;
```

These SELECTs show the inputs of the gate. They do not replace the `Semak Bukti` panel, which is the live check (`GET /api/admin/blueprints/:subject/:kertas/verification`).

**After Sahkan:**

```sql
-- verified, serving, with the verifier and the frozen check
SELECT b.code, b.version, b.source, b.serves_students, v.id AS verification_id, v.verified_at, v.verified_by_id,
       v.verifier_role, (v.structure_hash = b.structure_hash) AS hash_matches,
       jsonb_array_length(v.evidence_snapshot) AS evidence_rows, (v.check_result ->> 'passes') AS check_passed
  FROM blueprints b JOIN blueprint_verifications v ON v.id = b.verification_id
 WHERE b.status = 'active' ORDER BY b.code;
-- expect for each verified pair: source = verified, serves_students = true, hash_matches = true, check_passed = true

-- at most one serving version per subject and kertas (expect 0 rows)
SELECT subject_id, kertas, count(*) FROM blueprints WHERE serves_students GROUP BY 1, 2 HAVING count(*) > 1;

-- the pairs that now serve pupils (announce Jana Kertas for these only)
SELECT s.code AS subject, b.kertas, b.code, b.version
  FROM blueprints b JOIN subjects s ON s.id = b.subject_id WHERE b.serves_students ORDER BY s.code, b.kertas;
```

**No seed ran on UAT (D95):** both of these must return 0 on UAT. The launch-blueprint seed marks its rows `provenance = 'paper'` and its evidence `origin = 'study'`; admin-created rows have neither.

```sql
SELECT count(*) AS seeded_launch_blueprints FROM blueprints WHERE provenance = 'paper';
SELECT count(*) AS seeded_study_evidence FROM blueprint_evidence WHERE origin = 'study';
```

### 5.5 Smoke

A pupil of the verified subject calls Jana Kertas (`POST /api/bijak/papers/generate`): 201, or 422 `SHORTAGE` if the question pool of that subject is short (that is a pool answer, not a blueprint one). 422 `NO_BLUEPRINT` means the blueprint is not serving yet.

## 6. Environment

Set on the API service before it starts (examples in `.env.api.example`; no secret goes in the repo, and this page gives names only).

| Variable | Value for R1 | Meaning |
|---|---|---|
| `BIJAK_POC_QUESTIONS` | `false` or removed on every environment | **Deprecated no-op since T36 (BASE-99, `apps/api/src/common/config/env.schema.ts:110`).** The API serves the question bank only whatever it says; `true` only logs one warning at start. Remove it from the Render service by hand (`render.yaml` no longer sets it). The seeded PoC papers are withdrawn by the seed step `exam-retire-poc`, see [r1-release-input-team-a.md](r1-release-input-team-a.md) section 2.2 for the demo-host steps (the demo database needs at least one published bank paper). |
| `OCR_ENGINE` | `none` (default) or `tesseract` | `none`: scanned pages end as `OCR_UNAVAILABLE`. `tesseract`: tesseract.js with local language data, never downloads; then `OCR_LANG_DIR` must be an absolute folder holding `msa.traineddata` and `eng.traineddata`. |
| `OCR_LANG_DIR` | empty, or the folder above | Required only with `OCR_ENGINE=tesseract`. |
| `THROTTLE_SERVABILITY_READ_PER_MINUTE` | optional; default 120 when unset | In base since BASE-28 (T30). Per-user rate limit of the admin servability reads ("Dilihat murid di", the hub, the lanes); a request above the limit answers 429. Integer, minimum 1. Cited from `apps/api/src/common/config/env.schema.ts`, `apps/api/src/modules/questions/http/servability.controller.ts` and `.env.api.example` on that branch. A normal admin session needs no change. |
| `THROTTLE_QUESTIONS_LIST_PER_MINUTE` | optional; default **240** when unset or blank (60 before BASE-137, when `r1/admin-list-perf` merged) | **In base since BASE-137** (`dac398fa`, `r1/admin-list-perf` @ 69f465c8). Per-user rate limit of the admin question list `GET /api/questions`, which has its own bucket because a 1 to 2 character or punctuation-only search term cannot use the trigram index (migration 0106) and scans the bank. Above the limit the list answers 429 `RATE_LIMITED` with `Retry-After`; another user is not affected. Integer, minimum 1. The default was 60 until REQ-B-061 (60 was reached by normal use, since the admin screens call the list on every filter change and the Bank several times per view); a QA session that pages very fast can still see a 429, which is expected. The question writes have their own `THROTTLE_QUESTIONS_WRITE_PER_MINUTE` (60). `apps/api/src/common/config/env.schema.ts:149`, `.env.api.example:86` (`=240`), `admin.controller.ts:23-27` (comment) and `:29-34` (`default: 240` at :32) at that head (the same lines in base at BASE-146 are :24-28 and :30-35, `default: 240` at :33). Leave unset. |
| `SERVABILITY_OVERVIEW_WARM` | **in base since BASE-110** (A4: REQ-B-022(a), REQ-B-053 and the pre-review rows; merged inside the A4 chain as `r1/a4chain-minors` @ 6f2fb793; the unit `r1/req-b-022a-a4` @ d82c5256 was inside `r1/req-c-020`, `r1/req-b-033`, `r1/overview-mcq-shape-once` and the chain tip `r1/overview-getmany-parallel` @ 0ba236ef; B2 + B3 + DevOps) | optional; unset or empty = on when `NODE_ENV=production`, off otherwise. What it does: on API start it computes the admin "Kandungan SPM" servability overview once in the background and fills the 5-minute in-process cache (H-A21, `OVERVIEW_TTL_MS = 5 * 60 * 1000`), so the first Admin Pusat to open the hub does not wait for the cold compute (A4's figures through the lead: about 6 s at 408k after the perf work, 34 s before; the code comment says about 30 s; not re-measured here). Non-blocking: `onApplicationBootstrap` does not await it, so the API serves at once; a failed warm-up only logs a warning (`servability overview warm-up failed: ...`) and the route computes on the first request as before. Values: `true` = warm on start; `false` = do not; unset or empty (`SERVABILITY_OVERVIEW_WARM=` as `.env.api.example` ships it) = default: on when `NODE_ENV=production`, off otherwise (tests and local runs never warm); any other value stops the API at start (zod). Turning it off: set `SERVABILITY_OVERVIEW_WARM=false` and restart the API (for example to cut database load during a busy start or a migration window). Cost: one cold overview compute per API instance per start; read-only queries the hub would run anyway; at most 4 in parallel (`OVERVIEW_PARALLEL = 4` in `servability-reads.service.ts`) against a database pool of 10 connections by default (the code's own comment). **Per instance:** it runs once PER API INSTANCE at boot, with no jitter or lock (A4 decision; the code comment says R1 runs a single API instance, so one warm-up per deploy); if the API is ever scaled out, every instance starts the bank-wide read at the same time. Related: `THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE` (default 6) limits on-demand overview calls per admin. Read in the code at `r1/req-b-022a-a4` @ d82c5256 (the same schema line is at the tip 0ba236ef): `env.schema.ts:154`, `overview-warmer.ts`, `servability-reads.service.ts`, `.env.api.example:89`. |
| `INTAKE_TEACHER_ENABLED` | optional; `false` (default; unset is the same as `false`). **Keep it unset or `false` in R1** until ClamAV scans uploads (#78) | AZ-35. Off: the intake files and workflow routes are Admin Pusat only; a teacher gets 403 `FORBIDDEN` on every one of them, before any body is read or any row is touched. `true` re-opens them to the teacher role; the schema accepts `true` or `false` only. Admin is never affected. `apps/api/src/common/config/env.schema.ts:187`, `apps/api/src/modules/intake/intake-teacher.gate.ts:14`, `.env.api.example:143` (`=false`), `docs/ops/api-runbook.md:55`, all at BASE-131. |
| `ALLOW_DEMO_SEED` | unset / `false` | Never `true` on UAT or production. Demo seeds (the demo data, the PoC blueprints, the launch blueprints and the E2E seed are all demo modules) are skipped in production; `.env.api.example` states that only the dev/e2e compose file sets `true`. |
| `E2E_SEED` | **must be unset (OFF) on every server, production above all** | In base since BASE-24 (T26). Read only by the seed script `apps/api/prisma/seed/e2e.ts` (`E2E_FLAG`): the E2E seed runs only with `--profile=e2e` and `E2E_SEED=1` (or `true`). It creates a pupil, an Admin Pusat and verifies a blueprint by seed. Local / E2E only (section 7). |

**Merge note for B1 (SERVABILITY_OVERVIEW_WARM rows):** the A4 chain is in base since BASE-110 and base carried A4's `SERVABILITY_OVERVIEW_WARM` rows into this file (the header table and section 6). `r1/ac-gaps-a1b` merged the base (BASE-115) with a conflict at exactly those rows and kept ours: the resolved runbook was identical to the pre-merge one, and the facts in the two rows are the same, checked against `r1/req-b-022a-a4` @ d82c5256. If a later base change brings A4's rows again, **keep our side** and do not keep both. The same applies to `r1/ha24-release-input`.

## 7. Local / E2E seed (never on a server)

For local stacks and the E2E suite only (in base since BASE-24), behind two keys (`--profile=e2e` and `E2E_SEED=1`), default off. It creates a Tingkatan 4 pupil, an Admin Pusat and moves one launch blueprint to Disahkan through the same checks as Sahkan. It is not a UAT step: on UAT the same result is reached by hand (section 5). Command, accounts and the blueprint it picks: [e2e-seed.md](e2e-seed.md) (file lands with T26).

```
E2E_SEED=1 npm run be:db:seed -- --profile=e2e
```

## 8. If something goes wrong

| Symptom | Likely cause | Action |
|---|---|---|
| After deploy nothing is served in practice, login count 0 | API/FE build older than 0100 (still reads `published`) | Deploy the matching build; run 3.3 and 3.6. |
| A write fails with a CHECK violation on `ck_question_versions_status` | An old API instance still running | Stop old instances. |
| Pupil Jana Kertas answers 422 `NO_BLUEPRINT` | The blueprint is still Spec after 0092 (or not created) | Section 5. |
| Sahkan answers 422 `VERIFICATION_FAILED` | A gate or evidence line fails | Read the listed failures; fix the contract or add the missing evidence (evidence list). Do not seed around it. |
| `seeded_launch_blueprints` or `seeded_study_evidence` is not 0 on UAT | A demo seed ran | Stop; report to the lead (D95 says no seed on UAT). |
| DSKP load exit code 1 | One subject failed; its transaction rolled back | Read the report, fix, re-run (finished subjects report `same`). |
| 0092 aborts on `topic_weights` | A row holds a value | Take the value out first (the guard prevents silent loss); see the migration header. |
| Need to go back past 0100 | 0100 is not reversible | Restore the dump with the previous API/FE build ([r1-release-notes.md](r1-release-notes.md) section 6.2); do not run `migrate resolve` after a restore (P3011). |
| 429 on the servability reads of the admin | `THROTTLE_SERVABILITY_READ_PER_MINUTE` too low for the load | Raise it; default is 120 per user per minute. |
| 0106 stops at `CREATE EXTENSION` (permission denied) | The migration role may not create `pg_trgm` (a trusted extension on Postgres 13+; a managed host must allow it) | Nothing else in that migration ran (rehearsal 2.3: no extension, no index afterwards). Prisma now holds a failed row for 0106, so **`prisma migrate deploy` alone answers P3009** (verified). Have the extension created by a privileged role (`CREATE EXTENSION pg_trgm;`), or allow it for the role; then `prisma migrate resolve --rolled-back 0106_question_stem_trgm`; then `prisma migrate deploy`. Steps in 2.3. |
| A migration stops with `P3018 ... 55P03 ERROR: canceling statement due to lock timeout` | The `lock_timeout` set for the window (2.4) ran out while another session held a conflicting lock. Rehearsed: 0106 and 0107 (dev-1; an open write on `question_versions`) and 0105 (A4; a blocker on `questions` inside the `DO` block, which holds ACCESS EXCLUSIVE on `question_versions` for the full 5 s, so reads and writes stall about 5 s before the rollback) | The `_prisma_migrations` row is unfinished, so **`prisma migrate deploy` alone answers P3009**, and `/api/ready` answers 503 until it is fixed: recover promptly. **0105 is atomic** (a file with a `DO` block): only the failed history row remains. **0106 and 0107 are not** (no `DO` block: autocommit statements): first check what the file left: `SELECT indexrelid::regclass, indisvalid, indisready FROM pg_index WHERE indrelid = 'question_versions'::regclass;`, `\dx`, and drop any stray `ix_question_versions_stem_ms_trgm`, `ix_question_versions_stem_en_trgm` or `ix_question_versions_paper_kertas`. Then `SELECT pg_terminate_backend(<pid>);` on the blocker (the `pg_stat_activity` query in 2.4), `prisma migrate resolve --rolled-back <folder>` (here `0105_gate_facts`), `prisma migrate deploy`, `prisma migrate status` ("Database schema is up to date!"). If a partial 0105 is ever suspected (a hand-split or edited file; `resolve` + `deploy` then fails with 42701 `column "last_editor" already exists`), run the guarded revert of 2.4 first. With the role default, `ALTER ROLE <role> RESET lock_timeout;` now; with the URL option there is nothing to reset. |
| API writes to `question_versions` wait or time out during the deploy | 0106 / 0107 hold a SHARE lock while their indexes build (about 20 s and about 2 s at 408k, rehearsal 2.3; reads are not blocked); 0105 holds an ACCESS EXCLUSIVE lock for the whole file, 0.58 s cold and 0.35 s warm in the 2026-11-02 rehearsal (the older shape took 6.2 s on a cold cache and 0.4 s warm), reads and writes wait then, and it is not online | Expected inside the window; if it is outside the window, wait for the migration to finish. Do not kill it halfway: a file with a `DO` block (0105) rolls back as a unit, while 0106 and 0107 do not, so a half-applied 0106 or 0107 needs the object check of 2.4 before `resolve`. |

## 9. Verification status of this page

**Latest run (2026-11-02, A3 release-readiness): the statements new in this version (3.5e) ran, 27/27 ok.** Throwaway Postgres 16 container (own container, removed afterwards; no server): the 46 base folders (0001 to 0103, BASE-105 `7ea2208c`) applied with `prisma migrate deploy`, the demo seed (`ALLOW_DEMO_SEED=1`, profile `poc`, 28 modules, exit 0; 1271 question versions), two synthetic reference sheets (a decimal file id on one paper and on one blueprint, plus a token and an id naming no file), then a second `prisma migrate deploy` that applied 0104 (T48 @ 1dd07bc1), 0105 (H-A18 @ f29aeda9), 0106 and 0107 (`r1/admin-list-perf` @ 04dce9fa at the time of the run; the SQL is identical at 2a8ab674) and 0110 (`r1/t34-l1-residual-c` @ eb9ad806 at the time of the run; the 0110 folder is identical at the restacked a2acf754, diff checked), copied into a scratch migrations folder and not committed (1.4 s on this size). The 13 SELECTs of 3.5e, the EXPLAIN and the reverse SQL of 0106 and 0107 in rolled-back transactions (4 DDL, 6 SELECT), and the pre-check, `SHOW jit` and `ANALYZE question_versions` (3) all returned what the comments say: `pg_trgm` installed, both trigram indexes and the kertas index valid and partial, the planner uses a BitmapOr of the two trigram indexes with sequential scans off, the decimal ids that name a stored image became the file's token on the paper and the blueprint (the id naming no file stayed), the history rows finished, the reverse SQL dropped the objects and the rollback restored them. Build and lock times on a production-size table were NOT measured (the 20 s and 0.9 s are A4's figures at 408k and, since `r1/admin-list-perf` @ 2a8ab674, also what the migration headers say; the SQL of 0106 and 0107 is identical between 04dce9fa, where the 27/27 run was made, and 2a8ab674 (header comments changed at 8183b2c5; `git diff 8183b2c5 2a8ab674 -- apps/api/prisma/migrations` is empty), diff checked). The T36 demo-host check ran on the same database: `exam-retire-poc` withdrew the 4 seeded PoC papers, the bank demo paper stayed `published`, and the redeploy script's `playable` query returned 1.
- **Re-run for 0105 after H-A18 changed its SQL (2026-11-02, `r1/ha18-gate-facts` @ fc409ae1).** The 0105 file changed since the run above: `declared_marks` is now set only for an intake item with NO parts and a whole total 1 to 999 (it was any whole 0 to 999). The prediction SELECT of 3.1 was changed to match. Throwaway Postgres 16 container (own container, removed afterwards): BASE-105 folders plus 0104 (T48) migrated with `prisma migrate deploy`, demo seed, then 0105 applied in a second `migrate deploy`. The 0105 statements ran 18/18 ok: 3 before-SELECTs on the seeded database (0 and 0), 3 before and 5 after on a copy with synthetic rows (a draft `ai_variant` without a human event, a review `ai_variant` with one, and five intake items: total 4 without parts, total 4 with a part, total 0, total "5" as text, total 1000), 6 after on the migrated seeded database, and the reverse SQL in a rolled-back transaction (columns gone inside, back after the rollback). On the copy the predictions were 1 and 1, the file's NOTICE read `last_editor=ai on 1 versions, declared_marks set on 1 versions`, and the after-counts were `ai` 1, `person` 1270, `declared_marks` 1, `approved_or_archived_ai` 0: prediction, NOTICE and result agree, and only the no-parts item with total 4 was declared. The seeded data gives 0 and 0, as before. The other statements of this page were not re-run (their SQL is unchanged).

**Previous run (H-A25, 2026-11-01): ran on local migrated DB (BASE-62 `17797f48` + 0104 @ `2cbe7d28` (T48) + 0105 @ `3a2ac810` (H-A18), demo seed), 74/74 ok.** Every statement in the SQL blocks of this page (72 SELECTs, the one `VACUUM ANALYZE` and the 0105 reverse SQL) was run one by one with `psql` against a throwaway local Postgres 16 container (no server, no shared database; the container was removed afterwards). Statements that errored: none; no statement was changed by the run. 0104 and 0105 are read from the T48 and H-A18 branches, not from base.

- **Staged databases (before-state):** one migrated to 0091 for the three 0092 pre-flight SELECTs of 3.1 (3/3); one migrated to 0093 for the other 17 "before" SELECTs of 3.1, including the 0103, 0104 and 0105 ones (17/17). They return zero rows or zero counts (empty tables): this proves syntax and column names, not counts.
- **Full database:** the 48 migration folders (the base's 0001 to 0103, plus 0104 and 0105 copied from their branches into a scratch migrations folder, not committed), applied with `prisma migrate deploy` (0105 in a second `migrate deploy`, as on a release that adds it last), then the demo seed with `ALLOW_DEMO_SEED=1` (profile `poc`, 27 modules, exit 0). The other 53 statements (2.2, 3.2 to 3.6, 3.5b, 3.5c, 3.5d, 4, 5.4; 52 SELECTs and the `VACUUM ANALYZE`) ran there, 53/53.
- **Notable results:** `approved` 1268, `archived` 1, `draft` 1, no `published`; servable 1268, login count 493; `question_parts.cognitive_level` NULL on all 1277 parts; `question_reports` empty, `fk_question_reports_attempt_id` `convalidated = f` as designed; 9 paper sections, all `admin_created = false`. After 0105 the seeded data gives `last_editor = person` on all 1271 versions and `declared_marks` NULL on all (the demo seed has no `ai_variant` question and no intake item), so the two predictions of 3.1 are 0 and 0 and the 3.5d counts agree.
- **0105 backfill exercised on a copy** (`CREATE DATABASE ... TEMPLATE` of the seeded database, with synthetic rows added before the migration): one draft `ai_variant` version with no human status event, one review `ai_variant` version with a human status event, one approved `ai_variant`, and three intake items with `marks` 4 (number), `"5"` (string) and 1000 (number out of range). The 3.1 predictions returned 1 and 1; the file's own NOTICE (`psql -f`) read `0105 backfill: last_editor=ai on 1 versions, declared_marks set on 1 versions`; the 3.5d SELECTs returned `ai` 1, `person` 1270, `declared_marks` 1, `approved_or_archived_ai` 0, both CHECKs validated. The prediction SELECTs and the NOTICE agree.
- **Rollback of 0105, run as a procedure:** on a copy, the header reverse SQL (both CHECKs, both columns), then `DELETE FROM _prisma_migrations WHERE migration_name = '0105_gate_facts'`: `prisma migrate status` then lists `0105_gate_facts` as not yet applied and `prisma migrate deploy` applies it again, both columns back. The same reverse SQL inside a transaction that was rolled back removed the columns and was undone. `prisma migrate resolve --rolled-back` was not used (finished migration, P3012).
- **NOTICE under `prisma migrate deploy`:** the output tail shown by the run listed only the applied folder and "All migrations have been successfully applied." (the NOTICE was not seen there; whether Prisma prints server notices at a longer log level is unconfirmed). That is why 3.5d checks the counts instead.
- **0104 over existing rows** (previous pass, T48 @ 1b76778f; the 0104 file changed only a comment since, 2cbe7d28): inside a transaction that was rolled back, the column was dropped and the 0104 statement re-applied to the 9 seeded sections: one result row, `false`, count 9.
- Not run: `prisma migrate resolve`, `npm run dskp:load`, the API, and the 5.4 after-Sahkan state (no blueprint is verified on the seeded database).

**Previous run (H-A25, 2026-10-31):** BASE-21 + 0102, 0103, 0104 from their branches, 63/63 ok, same method.

**Earlier run (T37, BASE-6 + 0101 + 0102, 51/51 ok)** and its method are kept below for the record.

**SQL: ran on a local migrated database, 51/51 statements ok.** Every statement in the SQL blocks of this page (50 SELECTs and the one `VACUUM ANALYZE`) was executed one by one with `psql` against a throwaway local Postgres 16 container (no server, no shared database). Statements that errored: none; no statement was changed by the run.

- **Database A (staged), empty tables:** migrated with `prisma migrate deploy` to 0091 and the 0092 pre-flight SELECTs of 3.1 were run (3 statements); then migrated to 0093 and the remaining "before" SELECTs of 3.1 were run (9 statements). They returned zero rows or zero counts because the tables were empty; this proves the syntax and the column names, not the counts. The "before" SELECTs cannot run on a fully migrated database (for example `blueprint_sections.topic_weights` is gone after 0092).
- **Database B (full):** BASE-6 migrations (0092, 0093, 0100) plus `0101_essay_choice` (from commit `d398a576`, branch `r1/t25-essay-choice-store`) and `0102_leaf_cognitive_level` (from commit `76f53e6c`, branch `r1/t33-leaf-tags`), copied into a scratch migrations folder and not committed; then the demo seed (`tsx prisma/seed/index.ts`, profile `poc`, 27 modules, exit 0). The remaining 39 statements (2.2, 3.2 to 3.6, 4, 5.4) ran here, all ok.
- **Notable results on the seeded database:** `servable` equals the count of `approved` versions (1268) and the login count is 493 (the figure the D91 note in 3.6 and the T05 servable-counts spec pin for the demo seed); no `published` status remains; the status CHECK lists `draft, review, approved, archived`; `question_parts.topics` and `.cognitive_level` exist with their CHECKs; every `cognitive_level` is NULL right after the migration; the 4 DSKP checks of section 4 returned T4/T5 only, 0 orphans, 0 bad TP. The two "no seed ran" checks of 5.4 return **6** and **16** on this database, which proves they detect the launch-blueprint seed (on UAT, per D95, both must be 0).
- **After-Sahkan SELECTs:** on the seeded database no blueprint is verified, so they return no rows. They were also run once inside a transaction that was rolled back, after inserting one verification row for `3472/2` and flipping it to verified and serving: they returned the expected row (`hash_matches` true, `check_passed` true, 0 duplicate serving pairs, the pair listed). This only exercises the SQL; it is not a real Sahkan.
- Not run: the shell commands (`npm run dskp:load`, `prisma migrate resolve`, `be:db:seed`), the DSKP loader report numbers (2,844 nodes) and the API endpoints. The DSKP counts of this run came from the seed's curriculum module, not from the loader script.

**Still not verified**

- 0104, 0105, 0106, 0107 and 0110 are read from the T48 (read at 1dd07bc1; the 0104 folder is identical at the current 6c5ae3a8), H-A18 (read at f29aeda9, 0105 identical at the current fc409ae1), `r1/admin-list-perf` (read at 04dce9fa, SQL identical at 8183b2c5 and the current 2a8ab674) and `r1/t34-l1-residual-c` (read at eb9ad806, 0110 identical at the current a2acf754) branches, not from base; their final content may change in review. `\d paper_sections`, `\d question_versions` and the 3.5e SELECTs after a deploy are the check. 0102 and 0103 are in base.
- `VACUUM ANALYZE question_versions`: run time on the production-size table was not measured.
- `THROTTLE_SERVABILITY_READ_PER_MINUTE` and `E2E_SEED` are read from branches `r1/t30-servability-reads` and `r1/t26-e2e-seed`, not from BASE-6.
- Whether UAT already holds PoC blueprints, DSKP nodes or demo data is unknown; sections 3.1 and 5.4 record it.
- D95 is cited from PR #404 (`origin/pr404`, `r1/d91-decisions`); it is not in `docs/TRACKER.md` on `feature/v3-bijak-r1` until that PR merges.
