-- R1 perf (T54 report F4): expression index for the Kertas filter of the admin question list.
-- Additive only (one partial expression index, no data change).
--
-- Why: `GET /api/questions?kertas=2` filters `substring(v.paper_code from '/([1-3])[[:space:]]*$') = '2'`. Without an index Postgres runs the
-- regular expression on every row of question_versions (EXPLAIN on 408k questions: Seq Scan, 2.4 s of the 2.7 s of the status-count query).
-- With the index the same query reads only the matching rows (157 ms). The expression text MUST stay identical to the one in
-- `QuestionsRepository.adminConds` (questions.repository.ts): Postgres matches an expression index by its text.
-- The index is partial (paper_code IS NOT NULL): the equality is strict, so the planner proves the predicate from the query.
--
-- Plain CREATE INDEX, not CONCURRENTLY: Prisma runs each migration file in one transaction and CONCURRENTLY cannot run there (as 0011, 0044 and
-- 0106). It takes a SHARE lock on question_versions, so writes to that table wait while it builds (about 1.2 s on 408k rows, 552 kB):
-- deploy in the same maintenance window as 0106.
--
-- Reversible:
--   DROP INDEX "ix_question_versions_paper_kertas";

CREATE INDEX "ix_question_versions_paper_kertas" ON "question_versions" ((substring("paper_code" from '/([1-3])[[:space:]]*$'))) WHERE "paper_code" IS NOT NULL;
