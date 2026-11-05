-- Tag-integrity report (DM-19, S1-T02, 45 section 4.1 rule R-DSKP). READ-ONLY: only SELECTs inside a read-only transaction; nothing is changed.
-- Each section returns the offending rows; an empty result means the check is clean. Section (g) only reports counts of legacy untagged questions,
-- it never "fixes" them (D80 DEC-2: a legacy approved question is exempt from the gate).
-- "Approved after R1" = the version was published on or after :since (default below; pass -v since=YYYY-MM-DD to override).
-- Run (connection from the environment, never typed into this file):  psql "$DATABASE_URL" -v since=2026-11-01 -f apps/api/scripts/uat-ops/tag-integrity.sql
-- Rows checked are the latest version of each question (q.latest_version_no).
\if :{?since}
\else
  \set since '2026-11-01'
\endif
BEGIN READ ONLY;

\echo '(a) unit_node_id that is not a unit node, or has another subject or level than the version'
SELECT v.question_id, v.version_no, v.unit_node_id, n.kind, n.subject_id AS node_subject, v.subject_id, n.education_level_id AS node_level, v.education_level_id
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
JOIN curriculum_nodes n ON n.id = v.unit_node_id
WHERE n.kind <> 'unit' OR n.subject_id IS DISTINCT FROM v.subject_id OR n.education_level_id IS DISTINCT FROM v.education_level_id
ORDER BY v.question_id;

\echo '(b) SP nodes that are not kind sp, or have another subject or level than the version'
SELECT v.question_id, v.version_no, s.node_id, n.kind, n.subject_id AS node_subject, v.subject_id, n.education_level_id AS node_level, v.education_level_id
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
JOIN question_version_sp_nodes s ON s.question_version_id = v.id
JOIN curriculum_nodes n ON n.id = s.node_id
WHERE n.kind <> 'sp' OR n.subject_id IS DISTINCT FROM v.subject_id OR n.education_level_id IS DISTINCT FROM v.education_level_id
ORDER BY v.question_id;

\echo '(c) versions with more than 3 SP nodes'
SELECT v.question_id, v.version_no, count(*) AS sp_nodes
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
JOIN question_version_sp_nodes s ON s.question_version_id = v.id
GROUP BY v.question_id, v.version_no
HAVING count(*) > 3
ORDER BY v.question_id;

\echo '(d) approved after :since, Subjek + Tingkatan has DSKP nodes, but unit, SP or TP is missing'
SELECT v.question_id, v.version_no, v.subject_id, v.education_level_id,
       v.unit_node_id IS NULL AS no_unit,
       NOT EXISTS (SELECT 1 FROM question_version_sp_nodes s WHERE s.question_version_id = v.id) AS no_sp,
       v.difficulty_tp IS NULL AS no_tp
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
WHERE v.status = 'approved' AND v.published_at >= :'since'::date
  AND EXISTS (SELECT 1 FROM curriculum_nodes cn WHERE cn.subject_id = v.subject_id AND cn.education_level_id = v.education_level_id)
  AND (v.unit_node_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM question_version_sp_nodes s WHERE s.question_version_id = v.id)
       OR v.difficulty_tp IS NULL)
ORDER BY v.question_id;

\echo '(e) approved after :since, Subjek + Tingkatan has DSKP nodes, but a leaf has no cognitive level (a leaf TP falls back to the version TP, checked in (d))'
SELECT v.question_id, v.version_no, p.id AS part_id, p.label
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
JOIN question_parts p ON p.question_version_id = v.id
WHERE v.status = 'approved' AND v.published_at >= :'since'::date
  AND EXISTS (SELECT 1 FROM curriculum_nodes cn WHERE cn.subject_id = v.subject_id AND cn.education_level_id = v.education_level_id)
  AND NOT EXISTS (SELECT 1 FROM question_parts c WHERE c.parent_part_id = p.id) -- a leaf has no child part
  AND p.cognitive_level IS NULL
ORDER BY v.question_id, p.id;

\echo '(f) approved after :since: no Bab where the Subjek + Tingkatan has chapters; no kertas (paper code without a trailing digit) where it is an SPM paper subject at T4/T5'
SELECT v.question_id, v.version_no, v.subject_id, v.education_level_id,
       (v.chapter_id IS NULL AND EXISTS (SELECT 1 FROM chapters ch WHERE ch.subject_id = v.subject_id AND ch.education_level_id = v.education_level_id AND ch.is_active AND ch.in_tree)) AS no_chapter,
       (v.paper_code !~ '/[0-9]$' OR v.paper_code IS NULL) AND EXISTS (SELECT 1 FROM spm_subject_configs c JOIN education_levels l ON l.id = v.education_level_id AND l.code IN ('T4', 'T5') WHERE c.subject_id = v.subject_id) AS no_kertas
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
WHERE v.status = 'approved' AND v.published_at >= :'since'::date
  AND ((v.chapter_id IS NULL AND EXISTS (SELECT 1 FROM chapters ch WHERE ch.subject_id = v.subject_id AND ch.education_level_id = v.education_level_id AND ch.is_active AND ch.in_tree))
       OR ((v.paper_code !~ '/[0-9]$' OR v.paper_code IS NULL) AND EXISTS (SELECT 1 FROM spm_subject_configs c JOIN education_levels l ON l.id = v.education_level_id AND l.code IN ('T4', 'T5') WHERE c.subject_id = v.subject_id)))
ORDER BY v.question_id;

\echo '(g) REPORT ONLY: legacy approved questions (published before :since) without a unit, per subject and level'
SELECT v.subject_id, v.education_level_id, count(*) AS untagged_approved
FROM questions q
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
WHERE v.status = 'approved' AND (v.published_at IS NULL OR v.published_at < :'since'::date) AND v.unit_node_id IS NULL
GROUP BY v.subject_id, v.education_level_id
ORDER BY v.subject_id, v.education_level_id;

ROLLBACK;
