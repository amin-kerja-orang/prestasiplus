-- Paper and stimulus-group integrity report (DM-26, INV-14, S3-T02). READ-ONLY: only SELECTs inside a read-only transaction; nothing is changed.
-- Each section returns the offending rows; an empty result means the check is clean. Service check: `exam/builder/paper-check.ts`; the database cannot express "whole group".
-- PO decision 2026-11-05 (item 7): `paper_sections.stimulus_policy` is not a predicate here. A group is known by questions.group_id and group_position alone.
-- Run (connection from the environment, never typed into this file):  psql "$DATABASE_URL" -f apps/api/scripts/uat-ops/paper-group-integrity.sql
BEGIN READ ONLY;

\echo '(a) groups with a member on a paper but not all its members in that one section'
SELECT s.paper_id, pl.paper_section_id, q.group_id,
       count(*) AS placed,
       (SELECT count(*) FROM questions m WHERE m.group_id = q.group_id) AS members
FROM paper_placements pl
JOIN paper_sections s ON s.id = pl.paper_section_id
JOIN questions q ON q.id = pl.question_id
WHERE q.group_id IS NOT NULL
GROUP BY s.paper_id, pl.paper_section_id, q.group_id
HAVING count(*) <> (SELECT count(*) FROM questions m WHERE m.group_id = q.group_id)
ORDER BY s.paper_id, pl.paper_section_id, q.group_id;

\echo '(b) groups placed in more than one section of a paper'
SELECT s.paper_id, q.group_id, array_agg(DISTINCT pl.paper_section_id ORDER BY pl.paper_section_id) AS section_ids
FROM paper_placements pl
JOIN paper_sections s ON s.id = pl.paper_section_id
JOIN questions q ON q.id = pl.question_id
WHERE q.group_id IS NOT NULL
GROUP BY s.paper_id, q.group_id
HAVING count(DISTINCT pl.paper_section_id) > 1
ORDER BY s.paper_id, q.group_id;

\echo '(c) groups that are not contiguous in their section (another question sits between two members)'
SELECT pl.paper_section_id, q.group_id, min(pl.position) AS first_position, max(pl.position) AS last_position, count(*) AS placed
FROM paper_placements pl
JOIN questions q ON q.id = pl.question_id
WHERE q.group_id IS NOT NULL
GROUP BY pl.paper_section_id, q.group_id
HAVING max(pl.position) - min(pl.position) + 1 <> count(*)
ORDER BY pl.paper_section_id, q.group_id;

\echo '(d) group members that are not in group_position order'
SELECT o.paper_section_id, o.group_id, o.question_id, o.position, o.group_position
FROM (
  SELECT pl.paper_section_id, q.group_id, pl.question_id, pl.position, q.group_position,
         lag(q.group_position) OVER (PARTITION BY pl.paper_section_id, q.group_id ORDER BY pl.position) AS previous
  FROM paper_placements pl
  JOIN questions q ON q.id = pl.question_id
  WHERE q.group_id IS NOT NULL
) o
WHERE o.previous IS NOT NULL AND o.group_position < o.previous
ORDER BY o.paper_section_id, o.group_id, o.position;

\echo '(e) sections whose question_count differs from the questions placed, a group counted by all its questions (published papers only: a draft is still being filled)'
SELECT s.paper_id, s.id AS section_id, s.label, s.question_count, count(pl.id) AS placed
FROM paper_sections s
JOIN papers p ON p.id = s.paper_id AND p.status = 'published'
LEFT JOIN paper_placements pl ON pl.paper_section_id = s.id
GROUP BY s.paper_id, s.id, s.label, s.question_count
HAVING s.question_count <> count(pl.id)
ORDER BY s.paper_id, s.id;

\echo '(f) placements whose question has no row (the orphan report of migration 0160: reserved PoC ids get an empty row there, any other id stops it)'
SELECT pl.id AS placement_id, pl.paper_section_id, pl.question_id,
       (pl.question_id >= 9000000000 AND pl.question_id < 10000000000) AS reserved_poc_id
FROM paper_placements pl
LEFT JOIN questions q ON q.id = pl.question_id
WHERE q.id IS NULL
ORDER BY pl.id;

ROLLBACK;
