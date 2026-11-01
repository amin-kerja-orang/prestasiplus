import { Prisma } from '../../db/generated/client'

/**
 * The ONE rule for "a paper still holds this version" (R1-delete-served-guard, B3 review of REQ-B-052). A paper holds the versions its
 * placements pin when pupils can still sit or read it: it is `published` (Terbit), or it was `withdrawn` while sittings exist (a withdrawn paper
 * keeps its attempts, AC-07.7, and they are served from the pinned versions, REQ-B-032). A draft or ready paper holds nothing: it re-pins at
 * Terbit. `alias` is the SQL alias of `papers` in the query (a fixed identifier chosen in code, never user input).
 *
 * `userId` narrows the withdrawn branch to the attempts of that one pupil: the `question_image` read rule (files) uses it so a withdrawn paper's
 * pictures are readable only by the pupils who sat it, not by every pupil.
 *
 * Cheap form: the attempts lookup runs only for a withdrawn paper (a draft paper cannot have attempts), and uses the `exam_attempts.paper_id` filter.
 * No index is added for it: a withdrawn paper that places the question is rare, and the lookup stops at the first row.
 */
export const paperHeld = (alias: 'p' | 'spp' | 'pp', userId?: bigint): Prisma.Sql => {
  const a = Prisma.raw(alias)
  const mine = userId === undefined ? Prisma.empty : Prisma.sql` AND hat.user_id = ${userId}`
  return Prisma.sql`(${a}.status = 'published' OR (${a}.status = 'withdrawn' AND EXISTS (SELECT 1 FROM exam_attempts hat WHERE hat.paper_id = ${a}.id${mine})))`
}

/**
 * A question is SHOWN TO PUPILS when (A) it is active and its live version is approved, or (B) a placement of a paper that is still held pins one
 * of its versions (approved or archived): the paper serves that version whether the question is active or not, as the attempt bridge and the
 * `question_image` read rule do (`files/question-image-access.ts`). Alias `q` is `questions`. This is the "served lock" predicate.
 */
export const QUESTION_SERVED = Prisma.sql`(
  (q.is_active AND EXISTS (SELECT 1 FROM question_versions sv WHERE sv.question_id = q.id AND sv.version_no = q.live_version_no AND sv.status = 'approved'))
  OR EXISTS (SELECT 1 FROM paper_placements spl
               JOIN paper_sections sps ON sps.id = spl.paper_section_id
               JOIN papers spp ON spp.id = sps.paper_id AND ${paperHeld('spp')}
               JOIN question_versions spv ON spv.question_id = q.id AND spv.version_no = spl.pinned_version_no AND spv.status IN ('approved', 'archived')
              WHERE spl.question_id = q.id)
)`

/** The same rule for one version `v` of question `q`: it is the live approved version of an active question, or a paper that is still held pins it. */
export const VERSION_SERVED = Prisma.sql`(
  (q.live_version_no = v.version_no AND q.is_active AND v.status = 'approved')
  OR (v.status IN ('approved', 'archived') AND EXISTS (SELECT 1 FROM paper_placements spl
               JOIN paper_sections sps ON sps.id = spl.paper_section_id
               JOIN papers spp ON spp.id = sps.paper_id AND ${paperHeld('spp')}
              WHERE spl.question_id = q.id AND spl.pinned_version_no = v.version_no))
)`
