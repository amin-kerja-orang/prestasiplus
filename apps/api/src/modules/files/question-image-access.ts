import { Prisma } from '../../db/generated/client'
import { LEARNER_LEVEL_SQL, NOT_PKSK_SQL, SERVABLE_STATUS } from '../questions/learner-visibility'

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
 *      (a per-pupil `jana` paper only for the pupil it was generated for). The pinned version must have left draft/review.
 *      The paper is the authority here, so an archived (superseded) pinned version, a later-withdrawn question or a hidden
 *      level do not hide it from a paper that is still published.
 *   C. REFERENCE: a published, sittable paper whose `reference_sheets` has a panel carrying the file as `imageFileId`
 *      (the public token or the internal decimal id).
 */

/** Statuses of a question version a pupil can be served from (ADR-0027): `approved` only; `published` no longer exists for questions. */
export const SERVABLE_VERSION_STATUSES = [SERVABLE_STATUS] as const

/** A pinned paper version must be past the authoring stages. `archived` stays readable: a published paper pins it. */
const PAPER_PINNED_STATUSES = ['approved', 'archived'] as const

const inList = (values: readonly string[]): Prisma.Sql => Prisma.join(values.map((v) => Prisma.sql`${v}`))

/**
 * SQL (one row when allowed) for: may `userId` read file `fileId` (internal bigint id) as a question image?
 * `publicToken` is the file's public token (for reference-sheet panels).
 */
export function pupilMayReadQuestionImageSql(fileId: bigint, userId: bigint, publicToken: string): Prisma.Sql {
  return Prisma.sql`
    WITH st AS (SELECT id FROM stimuli WHERE asset_file_id = ${fileId}),
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
    ),
    sittable AS (
      SELECT pp.id, pp.reference_sheets
        FROM papers pp
       WHERE pp.status = 'published' AND (pp.kind <> 'jana' OR pp.generated_for_user_id = ${userId})
    )
    SELECT 1 AS one
      FROM cand c
      JOIN question_versions v ON v.id = c.vid
      JOIN questions q ON q.id = v.question_id
     WHERE (q.live_version_no = v.version_no AND q.is_active
            AND v.status IN (${inList(SERVABLE_VERSION_STATUSES)})
            AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL})
        OR (v.status IN (${inList(PAPER_PINNED_STATUSES)})
            AND EXISTS (SELECT 1
                          FROM paper_placements pl
                          JOIN paper_sections ps ON ps.id = pl.paper_section_id
                          JOIN sittable s ON s.id = ps.paper_id
                         WHERE pl.question_id = q.id AND pl.pinned_version_no = v.version_no))
    UNION ALL
    SELECT 1 AS one
      FROM sittable s
     WHERE jsonb_typeof(s.reference_sheets) = 'array'
       AND jsonb_path_exists(
             s.reference_sheets,
             '$[*] ? (@.imageFileId == $pub || @.imageFileId == $dec)',
             jsonb_build_object('pub', ${publicToken}::text, 'dec', ${fileId.toString()}::text))
    LIMIT 1`
}
