-- Tracking A sibling-duplicate report (DM-24, S3-T05, D-6a). READ-ONLY: only SELECTs inside a read-only transaction; nothing is changed.
-- Run it BEFORE migration 0162_s3_tracking_sibling_unique. An empty result means the migration can run.
-- Each row is one question held by more than one set of the same subject and year. An admin keeps it in `keep_in_set_no` (the
-- earliest sibling) and removes it from every set in `remove_from_set_nos`, through the editor or by the designated UAT developer.
-- A duplicate left behind stops the migration at its unique index.
-- Run (connection from the environment, never typed into this file):  psql "$DATABASE_URL" -f apps/api/scripts/uat-ops/tracking-sibling-duplicates.sql
BEGIN READ ONLY;

\echo 'Questions held by more than one sibling set (same subject, same year)'
SELECT s.subject_id, s.year, q.question_id,
       min(s.set_no) AS keep_in_set_no,
       (array_agg(s.set_no ORDER BY s.set_no))[2:] AS remove_from_set_nos
FROM spm_tracking_set_questions q
JOIN spm_tracking_sets s ON s.id = q.set_id
GROUP BY s.subject_id, s.year, q.question_id
HAVING count(*) > 1
ORDER BY s.subject_id, s.year, q.question_id;

ROLLBACK;
