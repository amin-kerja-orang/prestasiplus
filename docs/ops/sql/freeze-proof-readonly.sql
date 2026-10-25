-- =====================================================================================================================
-- freeze-proof-readonly.sql: OPTIONAL read-only SQL form of the freeze proof of step B4 of the cutover plan
-- (docs/ops/v2-cutover-plan.md, step B4: "for every staged table with updated_at, max(updated_at) <= T-freeze";
-- go/no-go criterion 13). It is a tool, not a procedure: the B4 steps and owner (half AZ) are unchanged.
--
-- ENGINE AND SCOPE
--   PostgreSQL 16 only. It reads the two STAGE schemas, staging_cloud and archive_cloud, that hold the copy of the .cloud
--   dump: in the database <db>_staging after the load (Track R: rehearsal-db.sh load-dump; the night: slot.sh load) and in
--   the target after the stage copy. It is NOT the .cloud MariaDB source and it never connects to it.
--
-- WHAT IT IS
--   One transaction, BEGIN TRANSACTION READ ONLY ... ROLLBACK, holding ONE SELECT. Postgres refuses any write inside a
--   READ ONLY transaction, so the file fails closed. No DDL, no DML, no temp table. The only function that runs SQL text
--   is query_to_xml(), and only on SELECT text built from catalog names and the T-freeze value of this run.
--
-- HOW TO RUN (psql 16; T-freeze is a psql variable, never a default and never written in this file)
--   PGOPTIONS='-c statement_timeout=120000' psql -X -v ON_ERROR_STOP=1 -v tfreeze='<T-freeze>' \
--     -f docs/ops/sql/freeze-proof-readonly.sql
--   <T-freeze> is the ISO 8601 time WITH its offset that the dump operator recorded at B1 (the plan's reference clock is
--   29 Oct 2026 01:00 MYT, written 2026-10-29T01:00:00+08:00; the value of the night is the B1 confirmation line, not this
--   example). A run WITHOUT -v tfreeze=... stops with a syntax error at the variable (ON_ERROR_STOP=1), it does not run;
--   a value that is not a timestamp stops with "invalid input syntax for type timestamp with time zone". Always give the
--   offset: without it psql's session time zone is used.
--   Run it against the staging database (<db>_staging on Track R and at the night), or the target while the stage copy
--   is still there.
--
-- OUTPUT (counts, table names and timestamps only, safe to paste as text; PDPA: no row, id, name or text of the data)
--   One result set over both schemas, columns: schema | table_name | max_updated_at | rows_after_freeze | result
--     result = 'ok'    the table has updated_at and no row is after T-freeze (rows_after_freeze = 0)
--              'FAIL'  rows_after_freeze > 0: a write reached .cloud after the freeze: STOP (criterion 13, plan B4)
--              'info'  no machine rule (see below)
--   Rows, in this order: (1) the T-freeze the run used, parsed (so the paste shows it); (2) one row per staged table that
--   has an updated_at column, with max(updated_at) and the count of rows with updated_at > T-freeze; (3) INFO rows:
--   an absent schema is ONE row 'n/a: schema not present', and each staged table WITHOUT an updated_at column is a row
--   'info: no updated_at' (listed so the operator sees which tables the proof cannot cover; they are NOT part of the
--   gate, and no created_at check is made); (4) the summary rows. The gate is ONE number: the last row,
--   table_name = 'tables_after_freeze', rows_after_freeze = the number of tables with rows_after_freeze > 0. It must
--   be 0 (result 'ok'); any other number is 'FAIL'. If the schema list is empty (both n/a) the summary row says 'info':
--   nothing was proven, do not read it as a pass.
--   The comparison casts updated_at to timestamptz, so a timestamp without time zone is read in the session time zone;
--   a NULL updated_at is not after the freeze and is not counted.
--
-- Validated on a local PostgreSQL 16, 25 Oct 2026, with synthetic fixtures only (cloud-tiny and `fixtures:generate --size
-- small --seed 7`, both staged into staging_cloud and archive_cloud): a far-future T-freeze gives tables_after_freeze 0;
-- a T-freeze one day before max(updated_at) of mood_checkins gives mood_checkins FAIL and tables_after_freeze 1; no -v
-- tfreeze or a non-timestamp value stops with an error (exit 3); with a schema dropped the file prints the n/a row and
-- exits 0. Time: a catalog read plus one max() and one count(*) per table (117 tables on the small fixture).
-- =====================================================================================================================

BEGIN TRANSACTION READ ONLY;

WITH
-- The T-freeze of this run. psql replaces :'tfreeze' by a quoted literal; an unset variable is an error, not a default.
tf AS (SELECT (:'tfreeze')::timestamptz AS t),
sch(schema_name) AS (VALUES ('staging_cloud'), ('archive_cloud')),
-- Staged base tables of the two schemas and whether each has an updated_at column.
tbl AS (
  SELECT t.table_schema AS schema_name, t.table_name,
         EXISTS (SELECT 1 FROM information_schema.columns c
                 WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name = 'updated_at') AS has_updated_at
  FROM information_schema.tables t
  WHERE t.table_schema IN (SELECT schema_name FROM sch) AND t.table_type = 'BASE TABLE'
),
chk AS (
  SELECT schema_name, table_name,
         (xpath('/row/m/text()', query_to_xml(
            format('SELECT max(updated_at)::timestamptz::text AS m FROM %I.%I', schema_name, table_name), false, true, '')))[1]::text AS max_updated_at,
         (xpath('/row/n/text()', query_to_xml(
            format('SELECT count(*) AS n FROM %I.%I WHERE updated_at::timestamptz > %L::timestamptz',
                   schema_name, table_name, (SELECT t::text FROM tf)), false, true, '')))[1]::text::bigint AS rows_after_freeze
  FROM tbl WHERE has_updated_at
),
res AS (
  SELECT 0 AS ord, '-' AS schema_name, 'T-freeze used' AS table_name, (SELECT t::text FROM tf) AS max_updated_at, NULL::bigint AS rows_after_freeze, 'info' AS result
  UNION ALL
  SELECT 1, schema_name, table_name, max_updated_at, rows_after_freeze, CASE WHEN rows_after_freeze = 0 THEN 'ok' ELSE 'FAIL' END FROM chk
  UNION ALL
  SELECT 2, schema_name, table_name, 'info: no updated_at', NULL, 'info' FROM tbl WHERE NOT has_updated_at
  UNION ALL
  SELECT 2, s.schema_name, '-', 'n/a: schema not present', NULL, 'info'
  FROM sch s WHERE NOT EXISTS (SELECT 1 FROM information_schema.schemata x WHERE x.schema_name = s.schema_name)
  UNION ALL
  SELECT 3, 'summary', 'tables_checked', NULL, count(*), 'info' FROM chk
  UNION ALL
  SELECT 4, 'summary', 'tables_after_freeze', NULL, count(*) FILTER (WHERE rows_after_freeze > 0),
         CASE WHEN count(*) = 0 THEN 'info' WHEN count(*) FILTER (WHERE rows_after_freeze > 0) = 0 THEN 'ok' ELSE 'FAIL' END
  FROM chk
)
SELECT schema_name AS "schema", table_name, max_updated_at, rows_after_freeze, result
FROM res ORDER BY ord, schema_name, table_name;

ROLLBACK;
