import { Prisma } from '../../db/generated/client'
import { LEARNER_LEVEL_SQL, NOT_PKSK_SQL, NOT_SOURCE_TAKEN_DOWN_SQL, SERVABLE_STATUS } from '../questions/learner-visibility'
import { paperHeld } from '../questions/served-rule'

/**
 * Pupil read rule for `question_image` files (R1-B20, pipeline R11). One SQL statement, driven from the FILE (so it uses
 * ix_part_options_image_file_id / ix_stimuli_asset_file_id and never scans the bank).
 *
 * A file is "on" a question version when it is
 *   - the image of an option of any part of the version (`part_options.image_file_id`),
 *   - the asset of a stimulus linked to the version (`question_version_stimuli`; a stem image is an image stimulus),
 *   - the asset of the stimulus of a part (`question_parts.stimulus_id`), or
 *   - the asset of a stimulus of the shared group of the question (`questions.group_id` -> `stimulus_group_stimuli`).
 *
 * A pupil may read it only while one of these holds (everything else is a uniform 404, decided by the caller):
 *   A. LIVE: the version is the live version of an active question whose status is servable (`approved` only, ADR-0027), and the question passes the learner filters (not PKSK, level visible).
 *   B. PAPER: the version is the version PINNED by a placement of a `published` paper the pupil can sit
 *      (a per-pupil `jana` paper only for the pupil it was generated for), or of a `withdrawn` paper this pupil has a sitting on (R1
 *      delete-served-guard: a withdrawal does not cut a running sitting, so it keeps its pictures; a pupil who never sat the withdrawn paper gets
 *      the uniform 404). The pinned version must be `approved` or `superseded` and its source not taken down; a taken-down pin (archived "withdrawn" /
 *      "source_takedown", or its source paper taken down) is readable only by a pupil who has ANY sitting on that paper (REQ-B-074: open, submitted or
 *      abandoned, as `paperHeld`; a sitting keeps its version, REQ-B-058 d, and result review needs the pictures; nobody else can start it, so nobody else gets the picture). The paper is the authority here, so a superseded pinned version or a
 *      hidden level does not hide it from a paper that is still held. A later-withdrawn question (archive "withdrawn") IS a taken-down pin: a pupil without a
 *      sitting on that paper no longer gets the picture (REQ-B-074); a pupil with a sitting still does (REQ-B-077).
 *   C. REFERENCE: a sittable paper (as in B) whose `reference_sheets` has a panel carrying the file as `imageFileId`
 *      (the PUBLIC token only: the internal decimal id never matches, so an unattached image cannot be read by guessing ids; B3 T34-L1-residual).
 */

/** Statuses of a question version a pupil can be served from (ADR-0027): `approved` only; `published` no longer exists for questions. */
export const SERVABLE_VERSION_STATUSES = [SERVABLE_STATUS] as const

/**
 * REQ-B-074: is the pinned version one a NEW sitting may be served (`pinServableForNewSitting`)? `approved`, or `archived` because a newer version
 * replaced it (`superseded`), and its source paper not taken down (`source_papers.takedown_at`: a takedown archives the latest and the live version of
 * each question, not the older ones). Any other archive reason (or none) is a takedown.
 */
const PINNED_SERVABLE = Prisma.sql`(
  (v.status = 'approved' OR (v.status = 'archived' AND v.archive_reason = 'superseded'))
  AND ${NOT_SOURCE_TAKEN_DOWN_SQL}
)`

const inList = (values: readonly string[]): Prisma.Sql => Prisma.join(values.map((v) => Prisma.sql`${v}`))

/** `st` (stimuli whose asset is the file) and `cand` (question versions the file is on), shared by the pupil and the author rule. */
const candidateVersionsCte = (fileId: bigint): Prisma.Sql => Prisma.sql`
    st AS (SELECT id FROM stimuli WHERE asset_file_id = ${fileId}),
    cand AS (
      SELECT p.question_version_id AS vid
        FROM part_options o JOIN question_parts p ON p.id = o.part_id
       WHERE o.image_file_id = ${fileId}
      UNION
      SELECT vs.question_version_id FROM question_version_stimuli vs WHERE vs.stimulus_id IN (SELECT id FROM st)
      UNION
      SELECT p.question_version_id FROM question_parts p WHERE p.stimulus_id IN (SELECT id FROM st)
      UNION
      SELECT v.id
        FROM stimulus_group_stimuli g
        JOIN questions gq ON gq.group_id = g.group_id
        JOIN question_versions v ON v.question_id = gq.id
       WHERE g.stimulus_id IN (SELECT id FROM st)
    )`

/**
 * REQ-B-008: SQL (one row when allowed) for: is file `fileId` on a question (any version, a draft included) that `userId` AUTHORED
 * (`questions.created_by_id`)? A teacher reads the images of their own questions, not those of another author. Admin is decided by
 * the caller (unchanged); the uploader of the file is decided by the caller too (`owns`).
 */
export function authorMayReadQuestionImageSql(fileId: bigint, userId: bigint): Prisma.Sql {
  return Prisma.sql`
    WITH ${candidateVersionsCte(fileId)}
    SELECT 1 AS one
      FROM cand c
      JOIN question_versions v ON v.id = c.vid
      JOIN questions q ON q.id = v.question_id
     WHERE q.created_by_id = ${userId}
     LIMIT 1`
}

/**
 * SQL (one row when allowed) for: may `userId` read file `fileId` (internal bigint id) as a question image?
 * `publicToken` is the file's public token (for reference-sheet panels).
 */
export function pupilMayReadQuestionImageSql(fileId: bigint, userId: bigint, publicToken: string): Prisma.Sql {
  return Prisma.sql`
    WITH ${candidateVersionsCte(fileId)},
    sittable AS (
      SELECT pp.id, pp.reference_sheets
        FROM papers pp
       WHERE ${paperHeld('pp', userId)} AND (pp.kind <> 'jana' OR pp.generated_for_user_id = ${userId})
    )
    SELECT 1 AS one
      FROM cand c
      JOIN question_versions v ON v.id = c.vid
      JOIN questions q ON q.id = v.question_id
     WHERE (q.live_version_no = v.version_no AND q.is_active
            AND v.status IN (${inList(SERVABLE_VERSION_STATUSES)})
            AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL} AND ${NOT_SOURCE_TAKEN_DOWN_SQL})
        OR (v.status IN ('approved', 'archived')
            AND EXISTS (SELECT 1
                          FROM paper_placements pl
                          JOIN paper_sections ps ON ps.id = pl.paper_section_id
                          JOIN sittable s ON s.id = ps.paper_id
                         WHERE pl.question_id = q.id AND pl.pinned_version_no = v.version_no
                           AND (${PINNED_SERVABLE}
                                OR EXISTS (SELECT 1 FROM exam_attempts sat WHERE sat.paper_id = s.id AND sat.user_id = ${userId}))))
    UNION ALL
    SELECT 1 AS one
      FROM sittable s
     WHERE jsonb_typeof(s.reference_sheets) = 'array'
       AND jsonb_path_exists(
             s.reference_sheets,
             '$[*] ? (@.imageFileId == $pub)',
             jsonb_build_object('pub', ${publicToken}::text))
    LIMIT 1`
}
