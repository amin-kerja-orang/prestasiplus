# ADR-0027: Question lifecycle: `approved` is the only servable state

Status: Proposed (G2 `admin-student-pipeline`; user decision DEC-1/D80 already taken, data handling needs approval)
Date: 2026-10-30
Supersedes in part: D54a (five-state lifecycle `draft, review, approved, published, archived`).

## Context
v2 has two hops after review: `approved` and `published`. Students are served only from `published` (`learner-visibility`, practice `eligible`, Bijak candidates). .cloud has one gate: `approved` (DISC section 0.1). The extra hop causes "approved but invisible" questions and about 35 files each carry the literal `'published'`. DEC-1 (D80) dropped the hop. Papers keep `Terbit`.

## Decision
1. Question statuses become `draft`, `review`, `approved`, `archived`. A question is student-servable when its live version has `status = 'approved'`, `questions.is_active = true`, and the per-activity rules of ADR-0028 hold.
2. The literal is defined once (`SERVABLE_STATUS = 'approved'` in `questions/learner-visibility.ts`, SQL and Prisma forms). No module writes `'published'` for questions.
3. Transitions: draft->review, draft->archived, review->approved (Terbitkan, runs the merged gate), review->draft, approved->archived, archived->draft. `approved->draft` and the combined "Lulus & Terbit" are removed.
4. "Edit sebagai draf" keeps the existing mechanism: it creates version n+1 as `draft`; the live approved version keeps serving; approving n+1 sets `live_version_no = n+1` and archives n ("Diarkib (digantikan)") in one transaction.
5. The submit gate stays; the approve and publish gates merge into one approve gate (keys, marks, tags, DSKP completeness ADR-0031, rights, duplicates, media resolved).
6. `question_versions.published_at` keeps its column name and now means "approved at". Renaming the column is deferred (no behavioural value, high churn).

## Data migration (migration 0100)
Run in this order, one transaction:
1. `UPDATE question_versions SET status='review' WHERE status='approved'` (approved but never published were NOT visible to students; they must stay invisible until an admin presses Terbitkan).
2. `UPDATE question_versions SET status='approved' WHERE status='published'`.
3. Replace the status CHECK constraint with the four values.
4. Backfill `questions.live_version_no` is unchanged (already points at the formerly published version).
The down path is not supported (the information about "approved but unpublished" is not recoverable); take a pre-migration dump (runbook item).

## Consequences
- One definition of "visible"; AC-02.1, AC-05.6 become possible.
- Contract change: `QUESTION_STATUSES`, `QUESTION_WORKFLOW_STATUSES`, labels, transition table, bulk-action values. One release accepts `published` as an input alias for `approved` and answers with a deprecation header; then removed.
- All seeds, fixtures and tests that write `published` change (shared-data task BE-A1, isolated worktree).
- PKSK's own status (`pending/approved/rejected`) is unaffected; PKSK serving also reads `approved` of the bank version.
