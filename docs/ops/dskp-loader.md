# DSKP loader runbook (R1-B04)

Loads the DSKP curriculum tree (Tingkatan 4-5 today) into `curriculum_nodes` and `curriculum_tp_descriptors`. UAT has 0 nodes until this runs, so DSKP tagging in the Studio, blueprints and Jana Kertas cannot work there.

It is a script, not a migration: the data is large (600+ KB), editable by admins afterwards, and must not be re-applied by `migrate`. Nobody runs it from the repo on a server except DevOps, as part of a deploy. Plan: `docs/architecture/v2-admin-student-pipeline.md` 13.4 R1-B04, 13.7 item 2, 13.8a. Requirement: `docs/requirements/v3-bijak-spm-scope.md` R1-12.

## What it does and does not do

- Reads the 13 extracts packaged in the API image at `apps/api/src/modules/curriculum/dskp/data/*.json` (a copy of `docs/reference/dskp`; a test fails if the two drift).
- One transaction per subject: a subject loads fully or not at all. A failing subject does not stop the others; the exit code is then 1.
- Insert-only and idempotent. Nodes are matched by (subject, level, edition, kind, code). A second run inserts 0. An existing node is never updated or deleted, so an admin edit survives; a new edition (a changed `edition` text) adds nodes beside the old ones. The report column `update` is therefore always 0; `drift` counts existing nodes whose text differs from the file (left as they are).
- Loads Tingkatan 1-5 only. Any other level (Darjah) is ignored and listed. A TP row without a number (or a printed range such as `1-4`) is skipped, counted and listed with its reason. Printed text is stored as is. The edition is stored on every node.
- Does not touch chapters, topics, subtopics, questions, papers or any student-visible content (AC-R1-12.5). `curriculum_nodes` is a separate tree used for question tagging, blueprints and Jana Kertas.
- Needs the base rows: `education_levels` (T4, T5) and `subjects` (13 subject codes: BM, BI, MATH, ADDMATH, PHY, SCI, SEJ, PI, TI, PM, PSV, LNR, KNP). If a subject row is missing that subject fails with a clear message. LNR and KNP are not in the observed subject list; add `--create-missing-subjects` to create them (inactive, no level link), otherwise they fail.

## Prerequisites

1. Migrations applied (`curriculum_nodes` and `curriculum_tp_descriptors` exist: migration 0008).
2. `education_levels` has T4 and T5, and `subjects` has the codes above. Check with the SELECTs below.
3. `DATABASE_URL` set to the target database (the same variable the migrate image uses). The role needs INSERT and SELECT on `curriculum_nodes`, `curriculum_tp_descriptors`, and INSERT on `subjects` only when using `--create-missing-subjects`.
4. A recent database backup (see `db-backup.md`).

## Run

Inside the migrate image or any container with the API source and `DATABASE_URL`:

```
npm run dskp:load -w @pp/api -- --dry-run
npm run dskp:load -w @pp/api -- --dry-run --subject MATH      # one subject
npm run dskp:load -w @pp/api -- --create-missing-subjects     # real run
```

`npm run curriculum:load-dskp` is an alias of `dskp:load`.

| Flag | Meaning |
|---|---|
| `--dry-run` | Prints the same report, writes nothing. Always do it first. |
| `--subject <code or file>` | Only this subject (`MATH`, or `matematik`). Repeatable or comma separated. |
| `--data-dir <folder>` | Read extracts from another folder instead of the packaged data (for T1-T3 drop-in, see below). |
| `--create-missing-subjects` | Create LNR and KNP (inactive) when absent from `subjects`. |
| `--help` | Usage. |

Exit codes: 0 done; 1 at least one subject or file failed (nothing from a failed subject was written); 2 usage error or `DATABASE_URL` missing.

### Reading the report

One line per subject and level with `insert / update / same / drift` for nodes and `insert / same` for TP descriptors, a total, then the ignored (Darjah) units, the rejected TP rows with their reason, the known limits of the extracts, and a final `RESULT:` line. The header lists each source file with its sha256 (line endings normalised), which can be compared with the repo.

Expected on an empty UAT: the dry run and the real run print the same numbers, all in the `insert` columns (the `same` columns 0). The second run prints `insert 0` everywhere. Anything in `FAILED` or `RESULT: ... failed` needs a look before continuing; the other subjects are already committed and stay valid.

Known limits (printed by the script, from `docs/reference/dskp/README.md` and the audit): formulas printed as images are missing from some Matematik, Matematik Tambahan and Fizik SP texts; Pendidikan Islam Jawi words are not independently verified; Sains T4 SP 4.3.1 is a reconstruction; Landskap dan Nurseri has some misaligned TP rows. Tagging must not rely on exact wording for those.

## Verification (SELECTs)

Nodes per subject and level (AC-R1-12.6: greater than 0 for each in-scope subject and level):

```sql
SELECT s.code AS subject, l.code AS level, n.kind, count(*) AS nodes
FROM curriculum_nodes n
JOIN subjects s ON s.id = n.subject_id
JOIN education_levels l ON l.id = n.education_level_id
GROUP BY s.code, l.code, n.kind
ORDER BY s.code, l.code, n.kind;

SELECT s.code AS subject, l.code AS level, count(*) AS nodes
FROM curriculum_nodes n
JOIN subjects s ON s.id = n.subject_id
JOIN education_levels l ON l.id = n.education_level_id
GROUP BY s.code, l.code
ORDER BY s.code, l.code;
```

TP descriptors per subject (`node_id` null = the subject's general levels):

```sql
SELECT s.code AS subject, count(*) FILTER (WHERE d.node_id IS NULL) AS general, count(*) FILTER (WHERE d.node_id IS NOT NULL) AS on_nodes
FROM curriculum_tp_descriptors d JOIN subjects s ON s.id = d.subject_id
GROUP BY s.code ORDER BY s.code;
```

Sanity checks (all expected 0):

```sql
SELECT count(*) FROM curriculum_nodes c WHERE parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM curriculum_nodes p WHERE p.id = c.parent_id);
SELECT count(*) FROM curriculum_nodes WHERE edition IS NULL OR edition = '';
SELECT count(*) FROM curriculum_tp_descriptors WHERE tp NOT BETWEEN 1 AND 6;
SELECT DISTINCT l.code FROM curriculum_nodes n JOIN education_levels l ON l.id = n.education_level_id;   -- expected: T4, T5 only
```

Also run the dry run again after the real run: every `insert` column must be 0.

## Rollback

The load only inserts, so it can be undone by deleting what it added. Nodes may be referenced by questions (`question_versions.unit_node_id`, `question_version_sp_nodes.node_id`, `ON DELETE RESTRICT`), so a delete fails once questions are tagged; do it before any tagging, or restore from backup instead.

- Whole load, before any question is tagged (the TP descriptors cascade with their nodes; the general TP rows have `node_id` null and are deleted separately):

```sql
BEGIN;
DELETE FROM curriculum_tp_descriptors;   -- includes the general (node_id null) rows
DELETE FROM curriculum_nodes;
-- check the counts, then COMMIT or ROLLBACK
```

- One subject: add `WHERE subject_id = (SELECT id FROM subjects WHERE code = 'MATH')` to both statements.
- One edition of a subject: `DELETE FROM curriculum_nodes WHERE subject_id = ... AND edition = '<text>'` (children go with their parent).
- A failed subject needs no rollback: its transaction was rolled back. Fix the cause (message in the report) and run again; finished subjects report `same`.
- If tagging already happened or admin edits must be kept, restore the pre-load backup instead of deleting.

## Tingkatan 1-3 later (no code change)

When T1-T3 extracts exist in the same format, add the file(s) to `apps/api/src/modules/curriculum/dskp/data/` and `docs/reference/dskp/` (the checksum test compares the two), rebuild the image, and run the same commands. The subject of an unknown file name is found by the extract's `subject` text (for example "Matematik"), levels `T1`-`T3` must exist in `education_levels` (they do), and each level needs an `edition` (a text, or a map per level). Untagged T1-T3 questions stay servable by the legacy rule until then (decision R1-U1). To try a file without rebuilding, use `--data-dir <folder>` with `--dry-run`.

## Open points in the extracts

A local dry run on an empty tree reports 2,844 nodes and 1,394 TP descriptors (42 of them general levels) over 13 subjects, and 4 rejected TP rows, all in Landskap dan Nurseri: no `tp` number on T4 units 1.0, 3.0 and 4.0, and a printed range `1-4` on T5 unit 7.0. These are skipped by design (tp must be 1-6) and listed by the script. The extracts have no Darjah rows, so the "ignored" list is empty today. The extracts carry no `subjectCode` (it is `null` in every file), so the file name to subject code map lives in `dskp-load.ts` (`DSKP_FILES`).
