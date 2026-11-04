-- Group-integrity report (U-OP-18, DM-02(c), S1-T01). READ-ONLY: only SELECTs inside a read-only transaction; nothing is changed.
-- Each section returns the offending rows; an empty result (or count 0) means the check is clean.
-- Section (e) is the OD-13 duplicate-stimulus count: the partial unique index on stimulus_group_stimuli(stimulus_id) is applied only when it is 0.
-- Run (connection from the environment, never typed into this file):  psql "$DATABASE_URL" -f apps/api/scripts/uat-ops/group-integrity.sql
-- Subject of a member = subject_id of its latest question version.
BEGIN READ ONLY;

\echo '(a) empty groups (no member question)'
SELECT g.id AS group_id, g.label
FROM stimulus_groups g
WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.group_id = g.id)
ORDER BY g.id;

\echo '(b) groups whose group_position values are not exactly 1..n'
SELECT q.group_id, count(*) AS members, min(q.group_position) AS min_position, max(q.group_position) AS max_position,
       count(DISTINCT q.group_position) AS distinct_positions
FROM questions q
WHERE q.group_id IS NOT NULL
GROUP BY q.group_id
HAVING min(q.group_position) IS DISTINCT FROM 1
    OR max(q.group_position) IS DISTINCT FROM count(*)
    OR count(DISTINCT q.group_position) <> count(*)
ORDER BY q.group_id;

\echo '(c) groups whose members have different subjects'
SELECT q.group_id, count(DISTINCT v.subject_id) AS subjects, array_agg(DISTINCT v.subject_id ORDER BY v.subject_id) AS subject_ids
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
WHERE q.group_id IS NOT NULL
GROUP BY q.group_id
HAVING count(DISTINCT v.subject_id) > 1
ORDER BY q.group_id;

\echo '(d) groups without a stimulus'
SELECT g.id AS group_id, g.label
FROM stimulus_groups g
WHERE NOT EXISTS (SELECT 1 FROM stimulus_group_stimuli s WHERE s.group_id = g.id)
ORDER BY g.id;

\echo '(e) stimuli linked to more than one group (OD-13; the count below must be 0)'
SELECT s.stimulus_id, count(*) AS groups, array_agg(s.group_id ORDER BY s.group_id) AS group_ids
FROM stimulus_group_stimuli s
GROUP BY s.stimulus_id
HAVING count(*) > 1
ORDER BY s.stimulus_id;
SELECT count(*) AS stimuli_in_more_than_one_group
FROM (SELECT stimulus_id FROM stimulus_group_stimuli GROUP BY stimulus_id HAVING count(*) > 1) d;

ROLLBACK;
