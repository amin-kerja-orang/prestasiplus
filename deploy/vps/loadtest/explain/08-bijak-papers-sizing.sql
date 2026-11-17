-- READ-ONLY. Literal text is the exact statement the code sends (bind parameters inlined; whitespace collapsed, SQL comments removed).
-- Placeholders: subject PSV = (SELECT id FROM subjects WHERE code = 'PSV'); change the code to try another subject (SCI, PM, MATH ...).
-- ENDPOINT: GET /api/bijak/papers -- sizing only: how many papers/placements/distinct questions one list request has to hydrate (twice: live + pinned).
-- Cheap. Run it first; the numbers explain the 6.4 s baseline.
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT count(DISTINCT p.id) AS papers, count(*) AS placements, count(DISTINCT pl.question_id) AS distinct_questions, count(DISTINCT (pl.question_id, pl.pinned_version_no)) AS distinct_pins FROM papers p JOIN paper_sections ps ON ps.paper_id = p.id JOIN paper_placements pl ON pl.paper_section_id = ps.id WHERE p.kind = 'pilihan' AND p.status = 'published' AND p.surface = 'simulasi';
