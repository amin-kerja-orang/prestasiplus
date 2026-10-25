# QLOAD proven on synthetic archive data (PC-2)

**Date:** 24 Oct 2026 · **Half:** AZ · **Lane issue:** #113 · **Cutover issue:** #109
**Subject:** `migrate:questions` (QLOAD), merged as #261 (migrations 0043, 0044)
**Branch under test:** `feature/v2-backend` at `9924a2f6`

## 1. Why this run exists

#261 was reviewed and its CI was green, but it had never been shown to load anything. On the
migration night it runs once, as step **B11**, after `migrate:all --apply`, with nobody awake to
debug it. If it loaded nothing the system would open on 30 Oct with an empty question bank and the
first person to notice would be a pupil. This run proves, end to end on a production-like rehearsal
database, that it loads questions and that the five LEAD decisions it was built to honour actually
hold in the data it writes.

**All data in this run is synthetic and invented for it.** No real dump, no `.cloud` access, no real
person. Values are all-zero or `.invalid` fakes. Counts and aggregates only below.

## 2. What was run

Postgres 16, `deploy/rehearsal/rehearsal-db.sh` in `host` mode (Docker Hub was unreachable from the
runner, so the script's own host mode was used instead of its container mode; every other step is the
documented recipe).

| # | Step | Result |
|---|---|---|
| 1 | `rehearsal-db.sh up` (`PP_REHEARSAL_MIGRATE=psql`) | 38 of 38 migrations applied, incl. **0043** and **0044** before any apply |
| 2 | Reference seed (`be:db:seed`, `NODE_ENV=production`) | 3 reference modules; demo modules refused. **Question bank: 0 rows** |
| 3 | `fixtures:generate --size tiny --seed 4242`, then the crafted archive rows | 30 synthetic questions, 120 options |
| 4 | `rehearsal-db.sh load-dump <dir> --no-sha-check --attest-anonymised` | 127 tables, 1 998 rows; PII scan passed |
| 5 | `rehearsal-db.sh stage` | STAGE COPY PASSED, 127 tables in the target |
| 6 | `migrate:all --dry-run` then `--apply` (`--as-of=2026-10-29`) | exit 0; `questions` row `not-run` (QLOAD is separate, as designed) |
| 7 | **`migrate:questions --dry-run`** | exit 0 |
| 8 | **`migrate:questions --apply`** | exit 0; `ANALYZE` on 7 tables |
| 9 | `migrate:questions --apply` again (no-op re-run) | exit 0, nothing re-inserted |
| 10 | `migrate:verify` | exit 0; `questions` reconciles `ok` |

### Deviation forced by the tooling

`load-dump` runs the anonymiser's own leak scan before loading, and it refuses any dump holding
IC- or phone-looking text — it cannot tell a synthetic fake from a real number. Proving the PII
detector needs exactly such text. The two questions carrying an IC-shaped and a phone-shaped string
therefore travelled **outside** the ndjson dump and were inserted straight into `archive_cloud` in
the target database after the stage copy and before `migrate:questions`. The e-mail and URL cases
passed the gate and went through the normal path. All 30 questions were read by one single QLOAD
run, so every count below comes from that one run.

## 3. Counts (one apply run, run id 7)

| Measure | Count |
|---|---|
| Questions read from the archive | **30** |
| Excluded (counted, not rejected) | **4** — status `diarkib` 1, status `draf` 1, type `struktur` 1, type `esei` 1 |
| Eligible | **26** |
| **Loaded** | **21** |
| &nbsp;&nbsp;of which held inactive | **6** |
| &nbsp;&nbsp;of which active and servable | **15** |
| **Rejected** | **5** |
| Held by the image rule | **2** (1 question image, 1 option image) |
| Held by the PII detector | **4** (one each: IC, phone, e-mail, URL) |

### Rejections, by reason

| Reason | Cause column | Count | The case that produced it |
|---|---|---|---|
| `INVALID_VALUE` | `options` | 3 | archive questions with **2**, **1** and **0** options |
| `INVALID_VALUE` | `options` | 1 | an archive question with **9** options (above `MAX_OPTIONS`) |
| `ORPHAN_PARENT` | `subject_id` | 1 | a subject id absent from the `migrate:core` id map |

### Resulting bank

| Table | Rows |
|---|---|
| `questions` (total, and all with `legacy_source='cloud'`) | 21 |
| &nbsp;&nbsp;`is_active = true` | 15 |
| &nbsp;&nbsp;`is_active = false` (held) | 6 |
| `question_versions`, status `published` | 21 |
| `question_parts` | 21 |
| `part_options` | 88 |
| `answer_keys` | 21 |
| `question_tags` (`pool`/`spm`) | 5 |
| `etl_id_map` (`questions`) | 21 |
| **Active, published, single MCQ leaf with ≥3 options (servable)** | **15** |

The bank held **0** questions before the run and **21** after it, 15 of them servable.

### Idempotence

The second `--apply` on unchanged input reported the same reconciliation (`30 / 26 / 21 / 5 / ok`)
and left every table at the same row count: 21 questions, 21 versions, 21 parts, 88 options,
21 keys, 21 id-map entries. Nothing was duplicated.

## 4. The five LEAD decisions, each verified against the written rows

| # | Decision | Held? | Evidence in the database | Enforced at |
|---|---|---|---|---|
| 1 | Image questions are loaded but held **inactive** | **Yes** | 2 questions carry `legacy_image_unresolved` in `import_issues` (one question image, one option image) and both have `is_active = false`. The partition is exact: every row with issues is inactive (6) and every row without is active (15); no row is both. | `transform/question-bank.ts:291-300` (issue pushed) and `:332` `is_active: issues.length === 0` |
| 2 | A PII detector holds any question whose text matches (IC, phone, e-mail, URL) | **Yes** | 4 questions held, with `pii_suspect` kinds `ic`, `phone`, `email`, `url` — one each, all four kinds detected, all 4 `is_active = false`. The stem, every option body and the explanation are all screened. | `transform/question-bank.ts:185-195` (`piiKindsOf`), applied over all texts at `:302-321`, held via `:332` |
| 3 | A question with **fewer than 3 options is rejected** | **Yes** | The 2-, 1- and 0-option questions were all rejected `INVALID_VALUE` / `options` and none reached `questions`. (The same guard also rejected a 9-option question at the upper bound.) | `transform/question-bank.ts:215` with `MIN_OPTIONS = 3` at `:23` |
| 4 | **Difficulty is the identity mapping** into the target | **Yes** | Archive `difficulty_level` → loaded `difficulty_tp`: 1→1, 2→2, 3→3, 4→4, 5→5, with **0 mismatches** across all 21 loaded rows. Out-of-range (`0`, `7`) and blank became `NULL` and were counted as `difficulty_missing: 3`. | `snapshot-dims/dims.ts:59-62` (`parseDifficulty`, `/^[1-5]$/`, `Number(t)`), used at `transform/question-bank.ts:276` and written at `load/questions/steps.ts:83` |
| 5 | **Owner is NULL** | **Yes** | `created_by_id IS NOT NULL` counted **0** of 21 loaded questions. The owner column is simply not in the insert column list, and it is nullable with no default (`0011_question_bank`), so it cannot be filled by accident. | `load/questions/steps.ts:67` (insert column list omits `created_by_id`); column nullable, no default, in `prisma/migrations/0011_question_bank/migration.sql` |

## 5. Answer for the cutover

**The bank would be non-empty at go-live.** On a database whose question bank started empty, QLOAD
loaded every eligible archive MCQ, published and live, and left 15 of 21 immediately servable — the
6 held rows are exactly the ones the LEAD asked to be held (2 image, 4 PII), not a loader failure.
A re-run changes nothing. `migrate:verify` reconciles the entity `ok`.

## 6. Observations for the LEAD (none is a QLOAD defect)

1. **The committed fixture generator does not exercise difficulty.** `fixtures/generate.ts:354`
   writes `questions.difficulty_level` as the BM words `mudah` / `sederhana` / `sukar`, while the
   loader (and `v2-exam-schema.md` §7 item 7, "legacy `difficulty_level` 1-5 is filled on 100%")
   expects `1`-`5`. Against the stock fixture every loaded question gets `difficulty_tp = NULL`,
   which reads like a loader bug and is not one. This run used crafted `1`-`5` rows instead.
   Worth aligning the generator before A4 so the timed rehearsal exercises the real path.
2. **The PII detector is one kind broader than the decision.** Besides IC, phone, e-mail and URL it
   also holds on an `@handle` (`transform/question-bank.ts:191`). That holds more, never fewer —
   conservative, and already listed in #261's description — but the decision text names four kinds.
3. **A synthetic PII case cannot travel through `load-dump`** (section 2). If A4 is to exercise the
   PII hold through the full documented path, the rehearsal script needs a synthetic-dump escape
   hatch for the IC and phone patterns, in the same spirit as
   `PP_REHEARSAL_ALLOW_EMAIL_DOMAINS`.

## 7. Reproducing

All of it is synthetic and regenerable: `fixtures:generate --size tiny --seed 4242`, then the
crafted archive rows described in section 3 (five difficulty values 1-5; three out-of-range or blank
difficulties; one question image; one option image; one IC, one phone, one e-mail and one URL case;
2-, 1-, 0- and 9-option questions; one unmapped subject; one 8-option question; and ordinary valid
questions). No fixture file, dump or credential from this run is committed.
