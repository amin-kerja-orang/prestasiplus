-- =====================================================================================================================
-- a1fix-confirm-readonly.sql: read-only SQL that answers the LEAD confirmations of card A1FIX-CONFIRM-SQL (the A1-FIX
-- change, PR #319, branch be/AM-A1-FIX) on the A4 rehearsal DB. Companion of smoke-readonly.sql (same style, same rules).
--
-- WHAT IT IS
--   One transaction, BEGIN TRANSACTION READ ONLY ... ROLLBACK, holding nine SELECTs (sections A to F). Postgres refuses any
--   write inside a READ ONLY transaction, so the file fails closed. No DDL, no DML, no temp table. The only function that
--   runs SQL text is query_to_xml(), and only on SELECT text that is fixed in this file.
--
-- OUTPUT (counts and aggregates only, safe to paste as text; PDPA: no minor's data leaves the database)
--   Every row starts with the section id in column `q`. The file never prints a row, an id, a name, an e-mail, a title or
--   any free text of the data. The only data values shown are code values of an enum-like column (a ledger `source`
--   code and `type`, a banner type, a challenge type, an education stage), each next to its count, and the run id and the
--   names of the counters of etl_runs. A rare code can be a rare row: if a code looks like text, do not paste it.
--
-- HOW TO RUN (psql 16; the file has no psql meta-commands)
--   Run on the A4 rehearsal DB, which is the v2 target and still holds the staging_cloud schema (the stage copy):
--     PGOPTIONS='-c statement_timeout=120000' psql -X -v ON_ERROR_STOP=1 -f docs/ops/sql/a1fix-confirm-readonly.sql
--   It prints nine result sets. The `q` helper of the A1 sheet prints only one statement, so use psql.
--
-- WORKS BEFORE AND AFTER #319 IS MERGED
--   Only columns that exist on both are read. The "alias" and "mapped" columns are computed in this file from the
--   maps of #319 (transform/wallet.ts LEDGER_SOURCE_MAP, transform/content.ts BANNER_TYPE_MAP, transform/enums.ts
--   STAGE_MAP); they say what #319 does, whichever build was applied. Section E needs a build that has applied
--   `migrate:all --apply`; on a build without #319 it shows `none` for the exclusion notes (the notes are new in #319).
--
-- STAGING-DEPENDENT SECTIONS: A, B, C and F1 (read staging_cloud)
--   Each is guarded: when the staged table or one of its columns is absent (staging_cloud dropped, or a different spec)
--   the section prints ONE row whose `code` starts with 'n/a' and the file goes on, so ON_ERROR_STOP never trips.
--   Sections B2, D1, D2, E and F2 read public.* and etl_runs only; they never need staging_cloud.
--
-- SECTIONS (one comment line above each query names the LEAD confirmation it answers)
--   A    staged coin_transactions: ledger source aliases of #319 and the positive amounts that a debit-only alias rejects
--   B1   staged banners.type against the BANNER_TYPE_MAP of #319;  B2 the same on v2 (banners.banner_type)
--   C    staged challenges: challenge_type with min and max target_value (OQ5, #318)
--   D1   v2 users flagged must_reset_password that still hold a bcrypt hash;  D2 users with a NULL hash
--   E    exclusion counters of the latest succeeded apply run of the core stage and of the activity stage
--        In an activity run counters -> 'notes' is the counter of the content entity `notes` (it has the key `batches`), not
--        the report notes; the file tells the two apart and lists that entity's `excluded` total as kind 'counter'.
--        kind 'counter' rows are the runner's per-entity `excluded` totals above 0 (also other documented exclusions
--        of the tip, for example streaks); a zero is not listed. kind 'none' = no note name contains "excluded".
--   F1   staged education_levels.stage against the STAGE_MAP of #319;  F2 the v2 education_levels.stage values
-- =====================================================================================================================

BEGIN TRANSACTION READ ONLY;

-- A: LEAD confirms how many ledger rows of token_convert / tukar-token / cabaran-harian / kotak-misteri carry a positive amount; #319 maps token_convert and tukar-token (tukar_token) to the debit-only alias token_conversion (positive amount, type not refund -> INVALID_VALUE amount), cabaran-harian to daily_challenge and kotak-misteri to mystery_box (not debit-only).
WITH g AS (
  SELECT CASE WHEN to_regclass('staging_cloud.coin_transactions') IS NOT NULL
               AND (SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = 'staging_cloud' AND table_name = 'coin_transactions'
                      AND column_name IN ('source', 'type', 'amount')) = 3
              THEN query_to_xml($q$
    SELECT lower(btrim(source)) AS code, lower(btrim(type)) AS type, sign(amount)::int AS sign, count(*) AS n
    FROM staging_cloud.coin_transactions
    WHERE lower(btrim(source)) IN ('token_convert', 'tukar-token', 'cabaran-harian', 'kotak-misteri',
                                   'tukar_token', 'cabaran_harian', 'kotak_misteri')
    GROUP BY 1, 2, 3
  $q$, false, false, '') END AS x
),
r AS (
  SELECT (xpath('/row/code/text()', e))[1]::text AS code,
         (xpath('/row/type/text()', e))[1]::text AS type,
         (xpath('/row/sign/text()', e))[1]::text::int AS sign,
         (xpath('/row/n/text()', e))[1]::text::bigint AS n
  FROM g, unnest(xpath('/table/row', g.x)) AS e
),
m AS (
  SELECT r.*,
         CASE WHEN regexp_replace(code, '[\s-]+', '_', 'g') IN ('token_convert', 'tukar_token') THEN 'token_conversion'
              WHEN regexp_replace(code, '[\s-]+', '_', 'g') = 'cabaran_harian' THEN 'daily_challenge'
              WHEN regexp_replace(code, '[\s-]+', '_', 'g') = 'kotak_misteri' THEN 'mystery_box' END AS alias_319
  FROM r
)
SELECT 'A' AS q, code, type, sign, n, alias_319,
       CASE WHEN alias_319 = 'token_conversion' AND coalesce(regexp_replace(type, '[\s-]+', '_', 'g'), '') <> 'refund' AND sign > 0
            THEN n ELSE 0 END AS rejected_by_319
FROM m
UNION ALL
SELECT 'A', 'n/a: staging_cloud.coin_transactions not present', NULL, NULL, NULL, NULL, NULL FROM g WHERE x IS NULL
ORDER BY 2, 3, 4;

-- B1: LEAD confirms the legacy banner types and that #319 maps FEATURE -> PROMO (PROMOTIONAL -> PROMO too; the alternative for FEATURE was ANNOUNCEMENT).
WITH g AS (
  SELECT CASE WHEN to_regclass('staging_cloud.banners') IS NOT NULL
               AND (SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = 'staging_cloud' AND table_name = 'banners' AND column_name = 'type') = 1
              THEN query_to_xml($q$
    SELECT lower(btrim(type)) AS code, count(*) AS n FROM staging_cloud.banners GROUP BY 1
  $q$, false, false, '') END AS x
),
r AS (
  SELECT (xpath('/row/code/text()', e))[1]::text AS code,
         (xpath('/row/n/text()', e))[1]::text::bigint AS n
  FROM g, unnest(xpath('/table/row', g.x)) AS e
)
SELECT 'B1' AS q, code, n,
       CASE regexp_replace(code, '[\s-]+', '_', 'g')
         WHEN 'hero' THEN 'HERO' WHEN 'promo' THEN 'PROMO' WHEN 'announcement' THEN 'ANNOUNCEMENT' WHEN 'event' THEN 'EVENT'
         WHEN 'promotional' THEN 'PROMO' WHEN 'feature' THEN 'PROMO'
         ELSE 'UNMAPPED' END AS maps_to_319
FROM r
UNION ALL
SELECT 'B1', 'n/a: staging_cloud.banners.type not present', NULL, NULL FROM g WHERE x IS NULL
ORDER BY 2;

-- B2: LEAD confirms what the migrated banners hold in v2 (only the four codes of ck_banners_banner_type can be stored; PROMO should include the FEATURE and PROMOTIONAL rows after #319).
SELECT 'B2' AS q, banner_type, count(*) AS n
FROM banners WHERE legacy_source = 'cloud' GROUP BY banner_type ORDER BY banner_type;

-- C: LEAD confirms the legacy challenge types and their target range for OQ5 (#318).
WITH g AS (
  SELECT CASE WHEN to_regclass('staging_cloud.challenges') IS NOT NULL
               AND (SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = 'staging_cloud' AND table_name = 'challenges'
                      AND column_name IN ('challenge_type', 'target_value')) = 2
              THEN query_to_xml($q$
    SELECT lower(btrim(challenge_type)) AS code, count(*) AS n, min(target_value) AS min_target, max(target_value) AS max_target
    FROM staging_cloud.challenges GROUP BY 1 ORDER BY 1
  $q$, false, false, '') END AS x
),
r AS (
  SELECT (xpath('/row/code/text()', e))[1]::text AS code,
         (xpath('/row/n/text()', e))[1]::text::bigint AS n,
         (xpath('/row/min_target/text()', e))[1]::text::numeric AS min_target,
         (xpath('/row/max_target/text()', e))[1]::text::numeric AS max_target
  FROM g, unnest(xpath('/table/row', g.x)) AS e
)
SELECT 'C' AS q, code, n, min_target, max_target FROM r
UNION ALL
SELECT 'C', 'n/a: staging_cloud.challenges not present', NULL, NULL, NULL FROM g WHERE x IS NULL
ORDER BY 2;

-- D1: LEAD confirms R39 (#319 body): of the migrated .cloud users flagged must_reset_password that still hold a bcrypt ($2) hash, how many are roster accounts (username, no e-mail) and how many have an e-mail.
SELECT 'D1' AS q,
       (email IS NULL AND username IS NOT NULL) AS roster,
       (email IS NOT NULL) AS has_email,
       count(*) AS n
FROM users
WHERE legacy_source = 'cloud' AND must_reset_password AND password_hash LIKE '$2%'
GROUP BY 2, 3 ORDER BY 2, 3;

-- D2: LEAD confirms R39 (#319 body): migrated .cloud users with a NULL password hash (cannot log in), and how many of them also have no e-mail.
SELECT 'D2' AS q,
       count(*) FILTER (WHERE email IS NULL) AS no_email,
       count(*) AS null_hash
FROM users
WHERE legacy_source = 'cloud' AND password_hash IS NULL;

-- E: LEAD confirms the A1-FIX exclusion notes after migrate:all --apply: every counter whose name contains "excluded" in the latest succeeded apply run of the core stage and of the activity stage (classrooms.excluded.teacher_absent_from_source and enrolments.excluded.class_teacher_absent_from_source are saved in etl_runs.counters -> 'notes' of the core run by #319; the exam_attempts.excluded.* notes are NOT saved there, so the per-entity `excluded` totals of the runner, counters -> <entity> -> excluded, are listed too, kind 'counter').
WITH stages(stage) AS (VALUES ('core'), ('activity')),
runs AS (
  SELECT DISTINCT ON (t.stage) t.stage, t.id, t.counters
  FROM (SELECT r.id, r.counters,
               CASE WHEN r.entity_set @> ARRAY['users', 'classrooms']::text[] THEN 'core'
                    WHEN r.entity_set = ARRAY['questions']::text[] THEN 'questions'
                    ELSE 'activity' END AS stage
        FROM etl_runs r
        WHERE 'cloud' = ANY (r.sources) AND r.mode = 'apply' AND r.status = 'succeeded') t
  WHERE t.stage IN ('core', 'activity')
  ORDER BY t.stage, t.id DESC
),
notes AS (
  SELECT r.stage, r.id, 'note' AS kind, n.key AS name,
         CASE WHEN n.value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN n.value::numeric END AS value
  FROM runs r
  CROSS JOIN LATERAL jsonb_each_text(CASE WHEN jsonb_typeof(r.counters -> 'notes') = 'object' THEN r.counters -> 'notes' ELSE '{}'::jsonb END) AS n
  WHERE n.key LIKE '%excluded%' AND NOT (r.counters -> 'notes') ? 'batches'
),
ent AS (
  SELECT r.stage, r.id, 'counter' AS kind, c.key || '.excluded' AS name,
         CASE WHEN jsonb_typeof(c.value) = 'object' AND (c.value ->> 'excluded') ~ '^[0-9]+$' THEN (c.value ->> 'excluded')::numeric END AS value
  FROM runs r
  CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(r.counters) = 'object' THEN r.counters ELSE '{}'::jsonb END) AS c
  WHERE c.key <> 'notes' OR (c.value ? 'batches')
)
SELECT 'E' AS q, stage, id AS run_id, kind, name, value FROM notes
UNION ALL SELECT 'E', stage, id, kind, name, value FROM ent WHERE value > 0
UNION ALL SELECT 'E', s.stage, r.id, 'none', 'no note name contains excluded', NULL
          FROM stages s JOIN runs r ON r.stage = s.stage WHERE NOT EXISTS (SELECT 1 FROM notes n WHERE n.stage = s.stage)
UNION ALL SELECT 'E', s.stage, NULL, 'n/a', 'no succeeded apply run of this stage', NULL
          FROM stages s WHERE NOT EXISTS (SELECT 1 FROM runs r WHERE r.stage = s.stage)
ORDER BY 2, 4, 5;

-- F1: LEAD confirms the complete set of staged education stage values (no fourth value) and that #319 maps Rendah, Menengah Rendah and Menengah Atas (STAGE_MAP; the tip maps only the three v2 codes).
WITH g AS (
  SELECT CASE WHEN to_regclass('staging_cloud.education_levels') IS NOT NULL
               AND (SELECT count(*) FROM information_schema.columns
                    WHERE table_schema = 'staging_cloud' AND table_name = 'education_levels' AND column_name = 'stage') = 1
              THEN query_to_xml($q$
    SELECT lower(btrim(stage)) AS code, count(*) AS n FROM staging_cloud.education_levels GROUP BY 1
  $q$, false, false, '') END AS x
),
r AS (
  SELECT (xpath('/row/code/text()', e))[1]::text AS code,
         (xpath('/row/n/text()', e))[1]::text::bigint AS n
  FROM g, unnest(xpath('/table/row', g.x)) AS e
)
SELECT 'F1' AS q, code, n,
       (regexp_replace(code, '[\s-]+', '_', 'g') IN ('primary', 'lower_secondary', 'upper_secondary')) AS mapped_tip,
       (regexp_replace(code, '[\s-]+', '_', 'g') IN ('primary', 'lower_secondary', 'upper_secondary',
                                                      'rendah', 'menengah_rendah', 'menengah_atas')) AS mapped_319
FROM r
UNION ALL
SELECT 'F1', 'n/a: staging_cloud.education_levels.stage not present', NULL, NULL, NULL FROM g WHERE x IS NULL
ORDER BY 2;

-- F2: LEAD confirms the stage values the migrated education levels hold in v2 (the check constraint allows only primary, lower_secondary, upper_secondary).
SELECT 'F2' AS q, stage, count(*) AS n
FROM education_levels WHERE legacy_source = 'cloud' GROUP BY stage ORDER BY stage;

ROLLBACK;
