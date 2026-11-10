-- Terbit read-only check (rebuild-db.sh step 14, only when --terbit was given): did the V2-published papers come out published in V3?
-- Read-only: one SELECT. Rows 'id | description | value | expected | ok'; ok is PASS, FAIL or info. Counts only.
-- Needs staging_cloud (dropped at step 15, so it runs before that) and archive_cloud. The Terbit report with the gate's BM lines per refused
-- paper is papers-terbit-<run>.csv in PP_MIGRATION_OUT.
WITH v2 AS (
  SELECT p.status::text AS status, (h.new_id IS NOT NULL) AS held
    FROM etl_id_map m
    JOIN papers p ON p.id = m.new_id::bigint
    JOIN archive_cloud.exam_papers ep ON ep.id::text = m.legacy_id
    JOIN staging_cloud.paper_statuses ps ON ps.id = ep.status_id AND lower(btrim(ps.slug)) = 'published'
    LEFT JOIN etl_id_map h ON h.legacy_source = m.legacy_source AND h.entity = 'exam_paper_holds' AND h.legacy_id = m.legacy_id
   WHERE m.entity = 'exam_papers'
), c AS (
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE status = 'published')::int AS published,
         count(*) FILTER (WHERE status <> 'published' AND held)::int AS held,
         count(*) FILTER (WHERE status <> 'published' AND NOT held)::int AS refused
    FROM v2
)
SELECT 'T1' || ' | ' || 'V2-published papers loaded' || ' | ' || total || ' | ' || '> 0' || ' | ' || CASE WHEN total > 0 THEN 'info' ELSE 'FAIL' END FROM c
UNION ALL
SELECT 'T2 | published in V3 after Terbit | ' || published || ' | ' || (total - held) || ' | ' || CASE WHEN published = total - held THEN 'PASS' ELSE 'FAIL' END FROM c
UNION ALL
SELECT 'T3 | still draft: held at load (group_split, kertas_unknown) | ' || held || ' | - | info' FROM c
UNION ALL
SELECT 'T4 | still draft: refused by the Terbit gate | ' || refused || ' | 0 | ' || CASE WHEN refused = 0 THEN 'PASS' ELSE 'FAIL' END FROM c;
