# R1 release notes and runbook (V3 Bijak SPM)

Operator runbook for the **human** deploy of V3 R1 (Bijak SPM). Agents never deploy, migrate, seed or touch a server;
this file is documentation only. Every action on UAT or production needs the LEAD's explicit confirmation, given in
person at the moment of the deploy (G6).

Placeholders used below (never write the real values into this file, the repo is public):

| Placeholder | Meaning |
|---|---|
| `<RELEASE_SHA>` | the 40-character commit the LEAD tags for R1 (section 1.2) |
| `<RELEASE_TAG>` | the git tag on `<RELEASE_SHA>`; `deploy.sh` tags the images with `git rev-parse --short=12 HEAD` |
| `<IMAGE_TAG>` | the image tag of the release: `git rev-parse --short=12 HEAD` on the release checkout (what `deploy.sh` uses when no `--tag` is given). It is written to `$PP_STATE_DIR/deploying.tag` before step 5/9 and to `$PP_STATE_DIR/current.tag` at step 9/9. **These images exist only after `deploy.sh` step 3/9** (build or pull) |
| `<PREV_TAG>` | the image tag running before the deploy (`$PP_STATE_DIR/current.tag`) |
| `<target>` | the environment being deployed: UAT first, production only after UAT passed |
| `$PC` | the production compose command with `PP_IMAGE_TAG` set (shell setup below; run from the checkout, as `ppdeploy`) |
| `$PSQL` | a **read-only** `psql` session on the target database (shell setup below) |

`$PP_STATE_DIR` defaults to `/var/lib/pretasiplus-deploy` (`deploy.sh`).

Shell setup (once per operator shell, from the release checkout):

```
# Image tag of the release. Without it compose falls back to the `prod` tag
# (deploy/vps/compose.prod.yaml: pretasiplus-api-migrate:${PP_IMAGE_TAG:-prod}), which deploy.sh never builds:
# compose then fails, or runs a stale image (production-vps.md section 16 "Open self-registration" and
# section 21 "Admin Pusat bootstrap/reset command").
export PP_IMAGE_TAG="<IMAGE_TAG>"   # after a finished deploy: $(cat /var/lib/pretasiplus-deploy/current.tag)
PC="docker compose -f compose.yaml -f deploy/vps/compose.prod.yaml --env-file /etc/pretasiplus/prod.env"
# If PP_PROFILES is set in prod.env (comma-separated), append one --profile per entry, as deploy/vps/lib.sh does:
#   PC="$PC --profile tls --profile monitoring"
# Read-only psql in the db container. PGPASSWORD is taken from the container's own environment (single quotes: the
# host shell never sees the value); never type or paste a password here. default_transaction_read_only makes any
# write fail, so the checks below cannot change data by mistake.
PSQL_RO='PGPASSWORD="$POSTGRES_PASSWORD" PGOPTIONS="-c default_transaction_read_only=on" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"'
psql_ro() { $PC exec -T db sh -c "$PSQL_RO" sh "$@"; }
PSQL=psql_ro
# use:  $PSQL -c "SELECT ..."     or     $PSQL < checks.sql
```

`$PC exec ... db`, `ps`, `logs` and `stop` work at any time (the `db` image is not release-tagged). `$PC run ... migrate`
needs the release's migrate image, so it is only possible **after `deploy.sh` step 3/9**. Statements marked as a write
in this file do not use `$PSQL`; they spell out their own command.

Every SQL statement in this file is a SELECT of counts or schema/migration names only unless it is explicitly marked as a write. Run
every `sql` block with `$PSQL` (read-only session); a write fails there by design.
Never paste row contents (names, e-mails, IC numbers) into a ticket, chat or this file.

Status words: **verified** = checked against the repo at `14e4336c` (or `cf2aa784` for B01) while writing this file;
**unverified** = not run, not measured, or depends on a state this author could not see. A summary of the unverified
items is in section 8.

Related runbooks: [production-vps.md](production-vps.md) (sections 7 deploy, 8 rollback, 9 backups, 10 monitoring,
11 logs), [api-runbook.md](api-runbook.md) (sections 4 health, 6 migrations, 13 secrets), [db-backup.md](db-backup.md),
[dskp-loader.md](dskp-loader.md), and `docs/ops/r1-b01-question-lifecycle.md` (on branch `r1/b01-lifecycle` until it merges).

---

## 0. What R1 changes for an operator (summary)

| Change | Operator impact |
|---|---|
| Migration `0092_bijak_standards` | Blueprint standard model. **Every existing Disahkan (`verified`) blueprint becomes Spec**; `serves_students` defaults to `false`. Drops the empty column `blueprint_sections.topic_weights` (guarded). |
| Migration `0093_part_options_image_file_index` | One partial index, `IF NOT EXISTS`. Renamed from an earlier `0092_part_options_image_file_index`. |
| Migration `0100_question_lifecycle_approved` | Question status remap: `approved` -> `review`, then `published` -> `approved`. `published` is no longer a question status. **Not reversible.** |
| DSKP loader (script, not a migration) | Must run once per environment after the migrations: `curriculum_nodes` is empty on UAT today. |
| Blueprint verification | After 0092 nothing serves pupils. Jana Kertas answers 422 `NO_BLUEPRINT` until an Admin Pusat verifies one blueprint per subject and kertas (Kontrak, tab Pengesahan, `Sahkan`). |
| Config | No new environment variable (B01 notes; verified for 0092/0093/0100). `BIJAK_POC_QUESTIONS` must stay `false`. |

### 0.1 Pending units (not merged when this file was written)

Checked against `origin` on 2026-10-31: none of the branches below is merged into `feature/v3-bijak-r1` (head
`14e4336c`; `git branch -r --merged origin/feature/v3-bijak-r1` lists no `r1/` branch). Do not tag `<RELEASE_TAG>`
until each one is merged, reviewed and green, or the LEAD has dropped it from R1 in writing. No counts or timings are
given for them here: none was measured.

| Unit | Branch at writing (head) | Operator impact | Status |
|---|---|---|---|
| T01 base merge | `r1/t01-base-merge` (`09d32822`) | Carries the migration folders `0092_bijak_standards` and `0093_part_options_image_file_index` (same names as already on `feature/v3-bijak-r1`; it does **not** carry the old `0092_part_options_image_file_index`, checked with `git ls-tree`). Re-run the folder check of 1.2 after the merge. | not merged |
| T06 Jana Kertas standard | `r1/t06-jana-standard` (`502280f5`, on top of T01) | Release note: Jana Kertas now composes "exact or refuse". PoC blueprints whose sections have a NULL `mark_budget` now **refuse** with a marks shortage (422 `SHORTAGE`, code verified in `apps/api/src/modules/bijak/papers/errors.ts` on that branch) instead of producing a paper. Expected behaviour, not a deploy failure; affects only environments that still hold PoC blueprints (UAT has 0 blueprints). Which seeded blueprints have NULL budgets is taken from the T06 note, not re-checked here. | not merged |
| 0100 `0100_question_lifecycle_approved` (T04) | `r1/b01-lifecycle` (`cf2aa784`, WIP) | Section 2.4; must ship together with the B01 API and FE code (1.1). | not merged |
| 0101 `0101_essay_choice` (T25) | `r1/t25-essay-choice-store` (`d398a576`) | Section 2.5 row. Additive (one nullable column, one widened CHECK, one new CHECK). | not merged |

---

## 1. Preconditions

Do not start the window until every box is ticked. Record each answer in the deploy log (time, operator initials, result).

### 1.1 Release gates

- [ ] G3 to G5 passed for the release commit (lint, type-check, tests with real output; code-reviewer Approve; QA Ready).
- [ ] `r1/b01-lifecycle` is finished, reviewed and merged into `feature/v3-bijak-r1`. At handoff it is **WIP** (`cf2aa784`):
      tsc, eslint, the FE m04 tests and the last spec batch were not run, and 4 code spots still name `'published'` as a
      question status. **0100 must ship in the same release as the B01 API and FE code** (an old API on the new CHECK
      fails to write `published`; a new API on old data serves nothing).
- [ ] The DB-backed specs listed as never run in the handoff (B06 `SPM_SERVABLE_SQL`, the bijak integration specs, B08
      bridge if merged) have been run green on the release commit.
- [ ] G6: the LEAD has confirmed this deploy, for this `<target>`, in writing, today.

### 1.2 Release commit and migration set

```
git fetch origin --tags
git checkout <RELEASE_TAG>
git rev-parse HEAD                                    # expect: <RELEASE_SHA>
git status --porcelain --untracked-files=no           # expect: no output (deploy.sh refuses a dirty tree)
ls apps/api/prisma/migrations | sed -n '/^009[2-9]_/p;/^01[0-9][0-9]_/p'   # 0092-0099 and 0100-0199 only
```

Expected migration folders after 0091 (exactly these, in this order; add rows to the table in section 2.5 for any
`0101`-`0119` the release adds):

```
0092_bijak_standards
0093_part_options_image_file_index
0100_question_lifecycle_approved
0101_essay_choice                      # only if T25 is merged into the release (section 0.1)
```

**Stop if `0092_part_options_image_file_index` is also present.** The shared-tree snapshot
`handoff/shared-tree-2026-10-31` still carries the old folder name (verified: its last migration is
`0092_part_options_image_file_index`). If the handoff task (a-1) merge brought it back next to `0093_...`, the API
would ship both names and `/api/ready` would demand both. The release branch must contain `0093_...` only.

### 1.3 Which base (what the target runs today)

Record the starting state; the rollback in section 6 returns to it.

| Item | UAT at handoff (2026-10-30, from CLOUD-HANDOFF section 3) | Check on the day |
|---|---|---|
| API image | built from `6d81162c` (`feature/v2-backend`, 2026-10-26) | `cat $PP_STATE_DIR/current.tag` (= `<PREV_TAG>`), `tail -n 3 $PP_STATE_DIR/history.log` |
| Frontend | built from `83d7bf0d` (2026-10-29) | the deployed bundle's build id (unverified how UAT records it) |
| Last migration | `0091_practice_answers_question_id_index` | SELECT below |
| Config | `AI_PROVIDER=mock`, `OCR_ENGINE=none`, `BIJAK_POC_QUESTIONS` unset | `grep -E '^(AI_PROVIDER|OCR_ENGINE|BIJAK_POC_QUESTIONS)=' /etc/pretasiplus/api.env` (names and these three non-secret values only) |
| Data | ~406k questions all `published`; `curriculum_nodes` 0; blueprints 0; papers 0 | section 2.1 SELECTs |

```sql
SELECT count(*) AS applied, max(migration_name) AS last
FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
-- expect on UAT: last = 0091_practice_answers_question_id_index

SELECT count(*) AS failed FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;
-- expect: 0 (prisma migrate deploy refuses to run past a failed migration)

SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '009%' OR migration_name LIKE '01%' ORDER BY 1;
-- expect on UAT: nothing after 0091. If 0092_part_options_image_file_index is listed, follow section 2.3.
```

**Unverified:** whether UAT is deployed with the `deploy/vps` stack (`deploy.sh`, `compose.prod.yaml`). This runbook
uses that stack because it is how a release is deployed on the VPS today. If UAT runs elsewhere, map each step to that
platform's equivalent and keep the order: backup, migrate, API+FE together, loader, verify, smoke.

### 1.4 Backup and restore point

`deploy.sh` takes a pre-deploy dump itself (step 2/9). Take one more **by hand before the window** so the restore point
exists even if the deploy is aborted early, and prove it reads:

```
sudo -u ppdeploy deploy/vps/backup/backup.sh --tag pre-deploy --no-files
```

Expected (last lines):

```
... dump ok: pp-backup-<UTC>-pre-deploy.dump  <bytes> bytes  sha256 <hex>  (<n> tables with data; schemas left out: staging_cloud)
... backup done: pp-backup-<UTC>-pre-deploy.dump
```

Then:

```
(cd /var/backups/pretasiplus && sha256sum -c pp-backup-<UTC>-pre-deploy.dump.sha256)   # expect: OK
$PC exec -T db pg_restore --list < /var/backups/pretasiplus/pp-backup-<UTC>-pre-deploy.dump | head   # expect: a table of contents
```

Write the dump file name into the deploy log: it is the **only** way back after 0100 (section 6).
Also confirm the last restore drill passed (`<PP_BACKUP_DIR>/drill-evidence/latest.txt` ends with `result: PASS`);
a failed drill blocks releases (production-vps.md section 9).

**Recommended, unverified need:** rehearse the three migrations on a scratch copy restored from this dump first
(`scripts/db-restore-check.mjs` pattern, or any throw-away database) to time 0100 on ~406k rows (section 2.4).

### 1.5 Maintenance window

- Announce a maintenance window to UAT testers / users. 0100 rewrites the status of every question version and rebuilds
  five indexes in one transaction; pupils' question draws are wrong (old API) or empty (new API, old data) for the
  seconds in between.
- No automated e2e or manual UAT may run during the window (shared login throttle; go-live-bijak-spm.md).

---

## 2. Migrations

They run inside `deploy.sh` step 5/9 (`prisma migrate deploy`, as the schema owner `pp_owner`, one-shot `migrate`
service, never a seed). Do not run them by hand on a server. Order is by folder name and fixed:

`0092_bijak_standards` -> `0093_part_options_image_file_index` -> `0100_question_lifecycle_approved` (-> `0101`..`0119` if any).

### 2.1 Pre-flight counts (before the deploy; save the output)

```sql
-- 0092: blueprints (UAT at handoff: 0 rows)
SELECT source, count(*) FROM blueprints GROUP BY source ORDER BY source;
SELECT count(*) AS sections_with_topic_weights FROM blueprint_sections WHERE topic_weights IS NOT NULL;
-- expect 0; anything else makes 0092 abort on purpose (see 2.2)

-- 0092: KBAT backfill size (question_versions with cognitive_level 3..6 get kbat)
SELECT cognitive_level, count(*) FROM question_versions GROUP BY cognitive_level ORDER BY 1;

-- 0100: question version statuses (expect only draft, review, approved, published, archived)
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;
SELECT count(*) AS approved_to_review    FROM question_versions WHERE status = 'approved';
SELECT count(*) AS published_to_approved FROM question_versions WHERE status = 'published';
SELECT count(*) AS live_questions        FROM questions WHERE live_version_no IS NOT NULL;

-- 0100 sanity: a live pointer must point at a published version (expect 0)
SELECT count(*) AS live_not_published FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'published';

-- served today (compare with 2.4 check 6 afterwards)
SELECT count(*) AS served_before FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'published'
 WHERE q.is_active;
```

**Stop** if `live_not_published` is not 0 or `sections_with_topic_weights` is not 0: report to the backend developer
before migrating.

### 2.2 `0092_bijak_standards` (verified by reading the SQL)

Effects on existing data:

| Step | Effect | UAT expectation |
|---|---|---|
| `question_parts` + 4 nullable columns; `question_versions` + `kbat`, `tag_review` (default false), `catalogue_version` | additive | - |
| `UPDATE question_versions SET kbat = ...  WHERE cognitive_level >= 3` | backfill: 3 mengaplikasi, 4 menganalisis, 5 menilai, 6 mencipta; 1-2 stay NULL. `cognitive_level` is kept | rows = sum of cognitive_level 3..6 from 2.1 |
| `UPDATE blueprints SET source = 'spec' WHERE source = 'verified'` | **every Disahkan blueprint becomes Spec** (the old value had no verifier or evidence; D76) | 0 rows (UAT has 0 blueprints) |
| `blueprints` + `serves_students` (default **false**), `structure_hash` (backfilled, then NOT NULL), `verification_id`, `notes`, `sub_part_ramp`, `kbat_marks`, `level_share` | after the upgrade **no blueprint serves pupils** | - |
| guard, then `DROP COLUMN blueprint_sections.topic_weights` | destructive, aborts if any row holds a value | 0 rows |
| new tables `blueprint_evidence`, `blueprint_verifications` (insert-only trigger) | additive | - |
| `papers` + `standard_report` | additive | - |
| CHECKs incl. `ck_blueprints_serves_students` (`true` only when `source = 'verified'`), `uq_blueprints_serving` (one serving row per subject and kertas) | constraints | - |

Consequences: `POST /api/bijak/papers/generate` answers 422 `NO_BLUEPRINT` ("Belum ada kontrak untuk subjek dan kertas
ini") for a pupil until section 4 is done. Admin Pusat in Mod Pelajar may still generate from a Spec head (`is_test`);
Admin Sekolah follows the pupil rule. Curated Kertas Pilihan papers are not affected.

After:

```sql
SELECT source, serves_students, count(*) FROM blueprints GROUP BY 1, 2 ORDER BY 1, 2;
-- expect: no row with source = 'verified'; serves_students false everywhere
SELECT count(*) FROM question_versions WHERE kbat IS NOT NULL;
-- expect: = sum of cognitive_level 3..6 from 2.1
SELECT count(*) FROM information_schema.columns WHERE table_name = 'blueprint_sections' AND column_name = 'topic_weights';
-- expect: 0
```

### 2.3 `0093_part_options_image_file_index` (verified by reading the SQL)

`CREATE INDEX IF NOT EXISTS "ix_part_options_image_file_id" ON part_options(image_file_id) WHERE image_file_id IS NOT NULL`.
Additive, no data change. Supports the pupil read rule of question images.

A database that applied the file under its **old** name (`0092_part_options_image_file_index`; local and dev databases
only, UAT is at 0091) sees `0093_...` as new. Two options, both safe:

- Do nothing: `migrate deploy` applies `0093_...`, which is a no-op because of `IF NOT EXISTS`. The old row stays in
  `_prisma_migrations`; `/api/ready` ignores extra rows (verified in `ready.service.ts`: it checks that every **shipped**
  name is applied and none is unfinished).
- Tidy the history once, **after** a finished deploy (step 5/9 has then recorded `0093_...` as applied, as a no-op),
  with the LEAD's confirmation (this is a write, so it does not use the read-only `$PSQL`):

```
# write: removes one history row, the index itself stays. No `prisma migrate resolve` is needed.
$PC exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DELETE FROM _prisma_migrations WHERE migration_name = '\''0092_part_options_image_file_index'\''"'
```

  Not **before** the deploy: the image running then ships the old folder name, and `/api/ready` answers 503 as soon as a
  shipped name has no applied row (`ready.service.ts`, "shipped migration(s) not applied"). The release's migrate image
  does not exist before step 3/9 either. For the same reason, after the tidy an image rollback to a build that ships
  the old name answers 503 on `/api/ready` until the row is back; prefer "do nothing" on any database that may be
  rolled back.

After:

```sql
SELECT count(*) FROM pg_indexes WHERE indexname = 'ix_part_options_image_file_id';   -- expect 1
```

### 2.4 `0100_question_lifecycle_approved` (verified by reading the SQL on `r1/b01-lifecycle`)

One transaction, in this order: drop the five partial indexes on `status = 'published'`; drop
`ck_question_versions_status`; `approved` -> `review`; `published` -> `approved`; add the CHECK
(`draft`, `review`, `approved`, `archived`); recreate the indexes on `status = 'approved'`
(`uq_question_versions_one_approved`, `ix_question_versions_approved_subject_level`, `ix_qv_pub_subject_level_tp`,
`ix_qv_pub_chapter`, `ix_qv_pub_level_tp`).

Effects on existing data:

- Approved-but-never-published versions (invisible to pupils today) become `review`: they stay invisible until an admin
  presses `Terbitkan`.
- Published versions (served today) become `approved` and keep serving.
- `question_status_events` history keeps `published`; `question_versions.published_at` keeps its name and now means
  "approved at"; `questions.live_version_no` and `papers.status` are untouched.
- **Not reversible**: after the first UPDATE, "was approved" cannot be told apart from "was review".

The migration raises `NOTICE` lines `0100 pre-flight: question_versions total=..., published=..., approved=...` and
`0100 post: approved=..., review=...`. **Unverified:** whether `prisma migrate deploy` prints NOTICEs into the
`migrate` log; rely on the SELECTs, not on the log.

**Unverified (timing):** on UAT the remap rewrites every one of ~406k published versions and rebuilds five indexes in a
single transaction. Not measured. Time it on the scratch copy (1.4) and size the window from that; check free disk
for the WAL and the new indexes first (`df -h` on the Docker data volume).

After (with the new API running):

```sql
-- 1. four statuses only; no 'published'
SELECT status, count(*) FROM question_versions GROUP BY status ORDER BY status;
-- 2. approved_after = published_to_approved (2.1); review_after = review_before + approved_to_review (2.1)
-- 3. every live pointer on an approved version (expect 0)
SELECT count(*) FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
 WHERE v.status <> 'approved';
-- 4. at most one approved version per question (expect 0)
SELECT count(*) FROM (SELECT question_id FROM question_versions WHERE status = 'approved' GROUP BY 1 HAVING count(*) > 1) d;
-- 5. partial index predicates: every row must read status = 'approved', none may mention 'published'
SELECT count(*) FILTER (WHERE indexdef LIKE '%published%') AS still_published,
       count(*) FILTER (WHERE indexdef LIKE '%''approved''%') AS on_approved
FROM pg_indexes WHERE tablename = 'question_versions' AND indexdef LIKE '%WHERE%';
-- expect: still_published 0, on_approved 5
-- 6. served count unchanged (expect = served_before from 2.1)
SELECT count(*) AS served_after FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
 WHERE q.is_active;
```

### 2.5 Later migrations (placeholder)

Fill one row per migration added to the release after this file was written. Leave the table empty if none.

| Folder | Additive? | Data change | Pre-flight SELECT | Post SELECT | Reversible? | Runbook |
|---|---|---|---|---|---|---|
| `0101_essay_choice` (T25, **not merged**, section 0.1; read from the SQL on `r1/t25-essay-choice-store`) | yes: `question_parts.topics` JSONB nullable; `ck_question_parts_mode` dropped and re-added with `essay_choice`; new `ck_question_parts_topics` | none (every existing row has `topics` NULL and no `essay_choice` mode) | none needed | `SELECT count(*) FROM information_schema.columns WHERE table_name = 'question_parts' AND column_name = 'topics';` (expect 1) | yes, per the SQL header, after deleting `essay_choice` parts | this file |
| `...` | | | | | | |
| `0119_...` | | | | | | |

A row with "Additive? no" changes the rollback answer in section 6.

### 2.6 Running the deploy

From the checkout of `<RELEASE_TAG>` on the VPS, as `ppdeploy` (production-vps.md section 7):

```
deploy/vps/deploy.sh --dry-run     # every check for real, nothing changed
deploy/vps/deploy.sh               # asks you to type the domain: that is the LEAD-confirmed go
```

Expected at the end of the dry run: `preflight passed`, then `DRY-RUN would run: ...` for steps 2-9. The preflight
**refuses** `BIJAK_POC_QUESTIONS=true|1` in any env file or the shell (verified in `deploy.sh`).

Expected at the end of the real run:

```
---- 5/9 migrate (prisma migrate deploy only, as pp_owner), then the roles again and the role check ----
... (Prisma lists 0092_bijak_standards, 0093_part_options_image_file_index, 0100_question_lifecycle_approved
     [and 0101_essay_choice if merged] as applied)
... DB ROLES CHECK PASSED
---- 8/9 health checks through the edge ----
...
deploy complete: <tag>. Roll back the images with: deploy/vps/rollback.sh <PREV_TAG>
```

The exact Prisma lines are **unverified** (not run). A failure at any step prints `DEPLOY FAILED at: ...`, raises the
alert and prints the rollback command; nothing rolls back automatically. Go to section 6; a failure **in step 5/9**
(a migration failed) goes to section 6.3, not to `rollback.sh`.

Then run the "After" SELECTs of 2.2, 2.3 and 2.4.

---

## 3. DSKP loader (dry run, then real run)

Full reference: [dskp-loader.md](dskp-loader.md). It is a script, not a migration; insert-only and idempotent; one
transaction per subject. It runs **after** the migrations (needs `curriculum_nodes`, migration 0008) and **before**
section 4 (the blueprint check needs DSKP units for both T4 and T5).

### 3.1 Prerequisite SELECTs

```sql
SELECT count(*) FROM curriculum_nodes;              -- UAT at handoff: 0
SELECT code FROM education_levels WHERE code IN ('T4', 'T5') ORDER BY 1;   -- expect T4, T5
SELECT count(*) AS present FROM subjects
 WHERE code IN ('BM','BI','MATH','ADDMATH','PHY','SCI','SEJ','PI','TI','PM','PSV','LNR','KNP');
-- expect 11 (LNR and KNP are not in the observed subject list) or 13
```

### 3.2 Dry run

The migrate image of the release contains the API source and the packaged extracts (`apps/api/src/...` is copied in
the `build` stage; working dir `/app`). Its `DATABASE_URL` is the schema owner's (`migrate.env`), which has the needed
INSERT and SELECT rights.

`$PC` must carry the release tag (shell setup at the top): without `PP_IMAGE_TAG` compose looks for
`pretasiplus-api-migrate:prod`, which `deploy.sh` never builds, and either fails or runs a stale image that lacks the
loader or the R1 schema. Check first that the tag is the release that just finished:

```
cat /var/lib/pretasiplus-deploy/current.tag      # expect: <IMAGE_TAG> (written at deploy step 9/9)
echo "$PP_IMAGE_TAG"                             # expect: the same value
docker image inspect --format '{{.Id}}' "pretasiplus-api-migrate:$PP_IMAGE_TAG" >/dev/null && echo image-present
$PC run --rm --no-deps migrate npm run dskp:load -w @pp/api -- --dry-run --create-missing-subjects
```

(If `PP_IMAGE_PREFIX` is set in `prod.env`, prefix the image name in the `inspect` line with it.)

Expected (from the local dry run on an empty tree, dskp-loader.md "Open points"):

- first line `DSKP load: DRY RUN (nothing is written)`, then `Source files: 13` with one sha256 per file;
- one line per subject and level with every count in the `insert` columns and `same` 0;
- `TOTAL` about **2,844** nodes inserted and **1,394** TP descriptors inserted (42 of them general levels);
- `Ignored (not Tingkatan 1-5): 0`;
- `Rejected rows (skipped, counted): 4`, all Landskap dan Nurseri (no `tp` on T4 units 1.0, 3.0, 4.0; range `1-4` on T5 unit 7.0);
- if LNR/KNP are absent: `(subject row would be created, inactive)` for each;
- last line `RESULT: ok (13 subjects).`, exit code 0.

**Unverified:** the dry run has not been run against UAT; numbers above come from a local empty tree. Any `FAILED` line
or `RESULT: ... failed` (exit 1): stop and report; do not run the real load.

### 3.3 Real run

Only after the dry run printed `RESULT: ok` and the LEAD confirmed (this writes):

```
$PC run --rm --no-deps migrate npm run dskp:load -w @pp/api -- --create-missing-subjects
```

Expected: first line `DSKP load: REAL RUN`, the same numbers as the dry run, `RESULT: ok (13 subjects).`

Then run the dry run again: every `insert` column must be 0 and `same` must hold the totals. Then the verification
SELECTs of dskp-loader.md section "Verification" (nodes per subject and level > 0; the four sanity checks = 0;
`DISTINCT level` = T4, T5 only).

Rollback of the load: dskp-loader.md section "Rollback" (delete is only possible before any question or blueprint unit
is tagged, because of `ON DELETE RESTRICT`; otherwise restore the backup).

---

## 4. One Disahkan blueprint before pupils use Jana Kertas

After 0092 no blueprint serves pupils. For each subject and kertas that pupils will use, an **Admin Pusat** must verify
one blueprint. On UAT there are **0 blueprints** today, so a blueprint must first exist (see question Q1 in section 8).

### 4.1 Get a blueprint (Spec) to verify

- **Option A (by hand, no seed):** Pentadbiran -> `/admin/spm/kontrak` -> `Tambah Kontrak` -> fill the subject, kertas
  and sections until the panel shows `Tiada ralat. Kontrak boleh disimpan.` -> save. It is saved as Draf/Spec.
- **Option B (seed):** the six launch blueprints (1449/1, 1449/2, 3472/1, 3472/2, 4531/2, 1249/2, as Spec, with study
  evidence) come from the seed module `exam-launch-blueprints`. It is a **demo-kind** module (verified: no
  `kind: 'reference'`), so a `NODE_ENV=production` seed skips it, and `deploy.sh` refuses `ALLOW_DEMO_SEED=true`.
  It also needs the DSKP unit nodes from section 3. Using it on UAT needs a LEAD decision (Q1). Do not use it in
  production without that decision and a security review.

### 4.2 Verify (UI path, Admin Pusat)

1. Pentadbiran -> `/admin/spm/kontrak` -> open the subject and kertas -> tab **Pengesahan**.
2. Add evidence with `Tambah Bukti` until the meter `Badan berbeza dengan skema:` reaches its target (2 different
   bodies), unless the seeded study evidence is already there.
3. Press `Semak Bukti`; every line must pass. A failure shows `Kontrak belum boleh disahkan.` with the list.
4. Fill `Nota pengesahan` (required), press `Sahkan`, confirm the dialog `Sahkan kontrak ini?` -> `Sahkan`.

API equivalent (admin session, for reference only): `POST /api/admin/blueprints/:subject/:kertas/verify`. A failed check
answers 422 `VERIFICATION_FAILED`; a second verify answers 409 `Kontrak ini sudah Disahkan.`

### 4.3 Check

```sql
SELECT b.source, b.serves_students, count(*) FROM blueprints b GROUP BY 1, 2 ORDER BY 1, 2;
-- expect at least one row: verified | true
SELECT count(*) AS verifications FROM blueprint_verifications;          -- expect >= 1
SELECT count(*) AS serving_pairs FROM blueprints WHERE serves_students;  -- = number of subject/kertas pairs verified
```

Announce Jana Kertas to pupils only for the pairs counted here.

---

## 5. Configuration

| Key | Value for R1 | Why / where |
|---|---|---|
| `BIJAK_POC_QUESTIONS` | **`false`** (or unset) | PoC questions are staging/dev/e2e only. `compose.prod.yaml` forces `'false'` on `api` and `migrate`; `deploy.sh` refuses `true`/`1`. Note: `render.yaml` (the old demo API) sets `true`: never use that blueprint for UAT or production. There is no FE flag for it (`src/app/features.ts` has only `VITE_ALESA_AI` and `VITE_KELUARGA_ANGKAT`). |
| `ALLOW_DEMO_SEED` | `false` | unchanged; forced by `compose.prod.yaml` |
| `OCR_ENGINE` | `none` for this release | `api.env.example`: OFF at go-live (AZ-29 item 4). A real PDF intake (AC-R1-14.2 sign-off) needs `OCR_ENGINE=tesseract` **plus** `OCR_LANG_DIR` with `msa.traineddata` and `eng.traineddata`, a timed run of 20 real scans on the server, and a new LEAD decision. |
| `AI_PROVIDER` (extraction provider) | `mock` | Decided mock at go-live (AZ-29 item 1). A real provider (`anthropic`, `openai`, `gemini`, `openai-compatible`) needs a LEAD decision (D85 U1, undecided), `AI_MODEL`, `AI_API_KEY` **in the server env file only**, `AI_MONTHLY_BUDGET_SEN` and `AI_PRICE_TABLE_JSON`; see ai-intake-production-decisions.md. |
| New keys | none | B01 notes; no new key found in 0092/0093/0100 or the loader (verified by reading). |

Check (names and these non-secret values only; never print the file):

```
grep -E '^(BIJAK_POC_QUESTIONS|ALLOW_DEMO_SEED|OCR_ENGINE|AI_PROVIDER)=' /etc/pretasiplus/api.env
```

---

## 6. Post-deploy smoke and rollback

### 6.1 Smoke (admin first, then pupil)

Use dedicated test accounts (the LEAD holds them; never in the repo). One run at a time; a 429 is a rerun, not a fail.

| # | Who | Step | Expected |
|---|---|---|---|
| 1 | ops | `GET /api/health`, `GET /api/ready` (deploy step 8 does it) | 200; ready body `{"data":{"status":"ready","db":"up","migrations":"applied","time":...}}` (fields inside `data`; `ready.controller.ts`) |
| 2 | ops | `$PC ps api` | exactly one api container, healthy |
| 3 | ops | SELECTs of 2.2, 2.3, 2.4 (After), 3.3, 4.3 | as stated there |
| 4 | Admin Pusat | log in, open Pentadbiran -> `/admin/spm/kontrak` | list loads; the verified pair shows Disahkan |
| 5 | Admin Pusat | question bank: open a question in `review` | button `Terbitkan` shown; no `published` label anywhere |
| 6 | Admin Pusat | press `Terbitkan` on one test question | status `approved`; it appears in practice at once (no second step) |
| 7 | Admin Pusat | Studio: DSKP unit picker for a T4/T5 subject | units listed (loader ran) |
| 8 | Pupil (T4/T5) | open `/spm/bijak`, Jana Kertas for the verified pair | paper generated; no 422 `NO_BLUEPRINT` |
| 9 | Pupil | Jana Kertas for a pair **not** verified | refused with "Belum ada kontrak untuk subjek dan kertas ini" (expected) |
| 10 | Pupil | answer and submit the generated paper, open the result and Semakan | marks shown; self-mark stepper with `Simpan markah` works |
| 11 | Pupil | Databank / Latih Tubi SPM practice | questions are served (count not zero) |
| 12 | Pupil | a question with an option image | image loads (0093 + B20 read rule) |
| 13 | ops | `$PC logs --since 15m api` | structured lines, no stack traces, no `CHECK constraint` / `ck_question_versions_status` errors |

Any fail in rows 1-3, 8, 11 or 13 is a NO-GO: decide with the LEAD between fix-forward and rollback (6.2).
Logs, alerts and uptime: production-vps.md sections 10 and 11.

### 6.2 Rollback (migrations are forward-only)

There is no down migration. `deploy/vps/rollback.sh` only swaps the **images** back; it never runs `migrate` and never
touches the database (verified). What "rollback" means depends on how far the deploy got:

| Where it stopped | Database | What to do |
|---|---|---|
| Before step 5 (migrate) | unchanged | nothing to roll back; the old release still runs |
| A migration failed in step 5/9 (0092, e.g. the `topic_weights` guard; or 0093, 0100, 0101) | **not** clean: Prisma records the failed migration as a row in `_prisma_migrations` with `finished_at` NULL. Earlier migrations of the same run stay applied. Whether the failed migration's own statements were undone is **unverified** (check in 6.3) | Section 6.3. Do **not** simply re-run `deploy.sh`: `prisma migrate deploy` stops with P3009 (failed migrations in the target database) while that row exists. The old API keeps serving (step 6 never ran), but its `/api/ready` now answers 503 (it counts the unfinished row: `ready.service.ts`, `finished_at === null && rolled_back_at === null`), so the uptime probe alerts |
| Migrations applied, API not switched or switched | **schema is R1** | image rollback alone is **not enough** (below) -> restore |
| After pupils/admins wrote data | R1 schema + new data | restore loses those writes; prefer fix-forward unless the LEAD decides otherwise |

Why image rollback alone does not work after these migrations:

- After 0100 the old API (`<PREV_TAG>`) filters questions on `status = 'published'`, which no longer exists: it serves
  **no questions**, and any old write of `published` violates the new CHECK (B01 notes; verified in the SQL).
- After 0092 the old API's blueprint queries may select `blueprint_sections.topic_weights`, which was dropped
  (**unverified**; likely, because the old Prisma client selects every scalar column).
- `/api/ready` would still answer 200 on the old image (it only checks the old image's shipped names), so the health
  checks do not catch this.

Full rollback (LEAD confirmation and a maintenance notice required; production-vps.md section 8 "Database", steps 1-6):

1. `$PC stop api frontend` (keep `db`). Take a safety dump of the current state:
   `deploy/vps/backup/backup.sh --tag drill --no-offsite --no-files`.
2. Prove the pre-deploy dump from 1.4 reads (`sha256sum -c`, `pg_restore --list | head`).
3. Drop and recreate the database, `pg_restore` the dump, then `deploy/vps/db-roles.sh apply` and
   `deploy/vps/db-roles.sh check` (must end with `DB ROLES CHECK PASSED` before the api starts).
4. `deploy/vps/rollback.sh --checkout <PREV_TAG>` (images and the compose/nginx files of the old release), then check
   `/api/ready` and a login.
5. Check: `SELECT max(migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL` = `0091_...`;
   `SELECT status, count(*) FROM question_versions GROUP BY 1` equals the 2.1 pre-flight output.
6. Record the incident: what, when, which dump, the data-loss window; tell the LEAD.

Partial undo without a restore (only before anyone used the feature):

- DSKP load only: dskp-loader.md "Rollback".
- A wrongly verified blueprint: `blueprint_verifications` is insert-only by trigger and cannot be deleted. **Unverified**
  how to stop a pair serving without a restore (`Padam Kontrak` retires the head; a new version is saved as Spec, but
  whether that moves `serves_students` off the old Disahkan version is not confirmed). Ask the backend developer.

### 6.3 A migration failed in deploy step 5/9

`deploy.sh` printed `DEPLOY FAILED at: ...` during step 5. Images of the release exist (step 3 finished), the old
API and frontend still run, and `$PP_STATE_DIR/deploying.tag` names the release (`current.tag` is still `<PREV_TAG>`).
Every step here needs the LEAD's confirmation; steps 4 and 6 are writes.

1. Set the release tag for `$PC` (the failed release, not the running one):
   `export PP_IMAGE_TAG="$(cat /var/lib/pretasiplus-deploy/deploying.tag)"`.
2. Find the failed row (names and timestamps only):

   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
   FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;
   -- expect exactly one row: the migration named in the deploy output
   ```

   Keep the `deploy.sh` output (the Prisma error text is there; the one-shot `migrate` container is removed by `--rm`).
3. Decide whether the failed migration left partial changes. Run its "After" SELECTs, read as "did anything change":
   - `0092_bijak_standards`: `SELECT count(*) FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name IN ('kbat', 'tag_review', 'catalogue_version');`
     and the `topic_weights` column count of 2.2. Clean = `0` and `1`.
   - `0093_part_options_image_file_index`: the `pg_indexes` count of 2.3. Clean = `0` (or `1` on a database that had
     the old-name migration, where the index already existed).
   - `0100_question_lifecycle_approved`: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'ck_question_versions_status';`
     still lists `published`, and the status counts equal the 2.1 output. Clean = both true.
   - `0101_essay_choice` (if merged): the column count of its 2.5 row. Clean = `0`.

   **Partial changes found** (anything not "clean"): do **not** mark it rolled back. Restore the pre-deploy dump
   (section 6.2 "Full rollback", steps 1-3, then start the old images with `deploy/vps/rollback.sh --checkout <PREV_TAG>`)
   and report to the backend developer. For 0100 this is the only way back (not reversible).
4. **Clean:** fix the cause first (for the 0092 guard: the `topic_weights` rows need a backup and a decision by the
   backend developer and the LEAD; never edit data ad hoc). Then mark the failed migration as rolled back (write; run
   inside `apps/api`, where `prisma.config.ts` is):

   ```
   $PC run --rm --no-deps -w /app/apps/api migrate npx prisma migrate resolve --rolled-back 0092_bijak_standards
   # same pattern for the others:
   #   ... migrate resolve --rolled-back 0093_part_options_image_file_index
   #   ... migrate resolve --rolled-back 0100_question_lifecycle_approved
   #   ... migrate resolve --rolled-back 0101_essay_choice
   ```

5. Check: the `failed` SELECT of 1.3 returns 0; the old API's `/api/ready` answers 200 again (a row with
   `rolled_back_at` set is ignored by `ready.service.ts`; every name the old image ships is still applied).
6. Re-run `deploy/vps/deploy.sh --dry-run`, then `deploy/vps/deploy.sh`. `migrate deploy` applies the migration again
   from the start.

**Unverified:** whether Prisma 7 undoes the statements of a failed PostgreSQL migration (the 0100 SQL comment says it
"runs in the migration transaction"; 0092 has no explicit `BEGIN`/`COMMIT`), hence the check in step 3; the exact
`migrate resolve` output; and that `npx prisma` resolves in the migrate image from `/app/apps/api` (`be:db:migrate`
runs `node scripts/db.mjs migrate` from that workspace).

---

## 7. Migration numbering note

`0092_bijak_standards` took the number 0092; the image index moved to `0093_part_options_image_file_index` with
`IF NOT EXISTS` (deviation log `docs/architecture/v2-backend-deviations.md`, 2026-10-31, LEAD G4). UAT is at 0091, so a
fresh `migrate deploy` applies both in order. Databases that recorded the old folder name: section 2.3.

---

## 8. Unverified items and open questions

Unverified (nothing here was run against any server):

1. Whether UAT is deployed with the `deploy/vps` stack (1.3).
2. Timing, lock duration and WAL/disk use of 0100 (and the 0092 KBAT backfill) on ~406k versions (2.4).
3. Whether `prisma migrate deploy` shows the 0100 `NOTICE` lines; the exact Prisma output lines (2.4, 2.6).
4. Whether Prisma 7 undoes a failed migration's own statements on PostgreSQL; the exact `prisma migrate resolve
   --rolled-back` output and its invocation in the migrate image (6.3).
5. DSKP dry-run numbers on UAT (local numbers quoted) (3.2).
6. Old API behaviour on the post-0092 schema (`topic_weights`) (6.2).
7. How to stop a verified pair serving without a restore (6.2).
8. How the UAT frontend build id is recorded (1.3).
9. The pending units of section 0.1 (T01, T06, 0100/T04, 0101/T25): not merged; their effects are described from
   their branches and notes, not from a release build.

Open questions for the team:

- **Q1 (LEAD):** on UAT, are the launch blueprints created by hand in Kontrak, or may the demo-kind
  `exam-launch-blueprints` seed run there (it is blocked under `NODE_ENV=production` by design)? Which subject/kertas
  pairs must be Disahkan before pupils are told about Jana Kertas?
- **Q2 (backend):** confirm 0100 timing on a restored UAT copy and whether it needs a longer window or batching.
- **Q3 (backend):** answer items 6 and 7 above.
- **Q4 (LEAD):** OCR/extraction provider for AC-R1-14.2 (D85 U1) is still open; R1 ships with `OCR_ENGINE=none`,
  `AI_PROVIDER=mock`.
- **Q5 (lead integrating (a-1)):** make sure the merge of the shared-tree snapshot does not re-add
  `0092_part_options_image_file_index` (1.2).
