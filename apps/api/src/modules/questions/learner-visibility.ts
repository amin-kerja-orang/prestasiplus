import { Prisma } from '../../db/generated/client'
import { OFFERED_LEVEL_CODES } from '../practice/rules'

/**
 * SQL predicates (aliases `q` = questions, `v` = the question version) that decide what a learner may be served. One definition
 * for the question reads (`QuestionsRepository.scope` with `learnerVisible`) and for the file read rule (a pupil may read a
 * question image only for a question that passes the same filters).
 */

/**
 * The one servable question status (ADR-0027, R1-B01): a question is served to pupils when its LIVE version has this status, the
 * question is active and the learner filters below hold. No module writes or reads `'published'` for a question any more
 * (papers keep their own `published` status). The SQL form is inlined as a literal so the partial indexes
 * (`WHERE status = 'approved'`, migration 0100) stay usable; never bind it as a parameter.
 */
export const SERVABLE_STATUS = 'approved' as const
export const SERVABLE_VERSION_SQL = Prisma.sql`v.status = ${Prisma.raw(`'${SERVABLE_STATUS}'`)}`

/** M07 PKSK questions are served by M07 only. */
export const NOT_PKSK_SQL = Prisma.sql`NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')`

/**
 * Secondary-only (D72, OQ-06): a question of a primary-stage level (Darjah) is hidden from everyone, admin included. Apply it to
 * every list AND count over the same rows, before pagination, so `data` and `meta.totalItems` always agree.
 */
export const NOT_PRIMARY_LEVEL_SQL = Prisma.sql`(v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND el.stage = 'primary'))`

/** Not a primary-stage level (Darjah) and not an inactive level (secondary-only, 2026-10-29); no level at all is visible. */
export const LEARNER_LEVEL_SQL = Prisma.sql`(v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND (el.stage = 'primary' OR NOT el.is_active)))`

/**
 * REQ-B-076 (live path): the question's LIVE version does not come from a source paper that is taken down (`source_papers.takedown_at`). `addVersion`
 * carries `source_paper_id` to the next version, and no approve gate reads `takedown_at`, so a re-approved version of a taken-down source would otherwise
 * be drawn again and its pictures served. Alias `v` = the version served. The same fact `pinServableForNewSitting` and the image rule B read for pins.
 */
export const NOT_SOURCE_TAKEN_DOWN_SQL = Prisma.sql`NOT EXISTS (SELECT 1 FROM source_papers tsp WHERE tsp.id = v.source_paper_id AND tsp.takedown_at IS NOT NULL)`

/**
 * S1-T07 (DM-05, FR-ADM-G7.3): the ONE exclusion of a flagged question, written once. A question whose LIVE version carries the stored flag
 * `stimulus_missing` or `figure_only` (it names a figure that is not there, or is a bare figure) is not served on any pupil surface, unless an
 * admin dismissed the flag ("Bukan masalah", `flag_dismissed_at`). `stem_duplicated` is shown once and is NOT an exclusion (OD-3). Alias `v` = the
 * version served. ANDed into `SPM_SERVABLE_SQL` and every learner read (`QuestionsRepository.scope` with `learnerVisible`, the Jana and Bijak pools);
 * its JS twin is `flagReasons` in serving/rules.ts (the indicator), so card, details and draw counts agree (D91).
 */
export const NOT_FLAGGED_SQL = Prisma.sql`(v.stimulus_flag IS NULL OR v.stimulus_flag = 'stem_duplicated' OR v.flag_dismissed_at IS NOT NULL)`

/**
 * `true` when every stimulus the question shows can be shown: a picture kind has its file, a table has a grid, a file or a pipe table in the
 * body, a passage has text, and the version carries no `legacy_image_unresolved` import hold. `stimuli` is a statement selecting `sid`.
 */
export const mediaResolvedSql = (stimuli: Prisma.Sql, importIssues: Prisma.Sql): Prisma.Sql => Prisma.sql`(
  NOT EXISTS (
    SELECT 1 FROM (${stimuli}) l JOIN stimuli s ON s.id = l.sid
     WHERE (s.kind IN ('image', 'diagram', 'map', 'infographic', 'graph') AND s.asset_file_id IS NULL)
        OR (s.kind = 'table' AND s.table_data IS NULL AND s.asset_file_id IS NULL AND (s.body_ms IS NULL OR s.body_ms NOT LIKE '%|%'))
        OR (s.kind = 'passage' AND btrim(coalesce(s.body_ms, '')) = '' AND btrim(coalesce(s.body_en, '')) = '')
  )
  AND NOT (coalesce(${importIssues}, '[]'::jsonb) @> '[{"code": "legacy_image_unresolved"}]'::jsonb)
)`

/** Every stimulus a version shows (own links, part links, its group's); aliases `v`, `q`. Selects `sid`. */
export const VERSION_STIMULI_SQL = Prisma.sql`SELECT vs.stimulus_id AS sid FROM question_version_stimuli vs WHERE vs.question_version_id = v.id
               UNION SELECT p.stimulus_id FROM question_parts p WHERE p.question_version_id = v.id AND p.stimulus_id IS NOT NULL
               UNION SELECT gs.stimulus_id FROM stimulus_group_stimuli gs WHERE gs.group_id = q.group_id`

/**
 * FR-X1-4f (S1-T06): the pupil-serving form of `mediaResolvedSql` over the LIVE version `v` of question `q`. A question whose own stimulus has no file is
 * not served; a question of a stimulus group is not served when ANY stimulus of the group lacks its file (the group's stimuli are in
 * `VERSION_STIMULI_SQL`, so every member of the group drops together: the complete-group rule). Written once, ANDed wherever `NOT_FLAGGED_SQL` is.
 */
export const MEDIA_RESOLVED_SQL = mediaResolvedSql(VERSION_STIMULI_SQL, Prisma.sql`v.import_issues`)

/**
 * S1-T07 (lead decision on #424): a question is served only when every LEAF of its live version has an `answer_keys` row (a key for an MCQ, a scheme for any
 * other mode). Without it the leaf cannot be marked and the stored part tree does not parse (`StoredKeyError`). Alias `v`. JS twin: `keyReasons` in
 * serving/rules.ts (`no_key` for an MCQ leaf, `no_scheme` for any other), so the indicator and the draw agree (D91).
 */
export const ALL_LEAVES_KEYED_SQL = Prisma.sql`NOT EXISTS (SELECT 1 FROM question_parts kp WHERE kp.question_version_id = v.id AND kp.mode IS NOT NULL AND NOT EXISTS (SELECT 1 FROM answer_keys ak WHERE ak.part_id = kp.id))`

/**
 * R1-B06 (D85/D87): the ONE definition of "SPM-servable" for the SPM activities (Databank Soalan SPM, Latih Tubi SPM, Mock K1,
 * the Misi fallback, Battle SPM mode). It replaces the legacy `pool:spm` tag (`spmPool`): a question qualifies by what it IS,
 * not by a tag only the QLOAD import wrote, so admin-created questions reach the same activities. Aliases: `q`, `v`.
 *
 * Pieces: learner-visible level (LEARNER_LEVEL_SQL), not flagged (NOT_FLAGGED_SQL, S1-T07), not PKSK (NOT_PKSK_SQL), the level is one of OFFERED_LEVEL_CODES
 * (T4, T5), of an active subject linked to that level (the same rule as the practice cards and the login count). The servable
 * status, active flag, subject and MCQ-leaf shape are applied by the callers (`QuestionsRepository.scope`, the overview SQL),
 * so the status constant stays in one place.
 */
const OFFERED_LIST = OFFERED_LEVEL_CODES.map((c) => `'${c.replaceAll("'", '')}'`).join(', ')
/** R1-T08 follow-up (REQ-B-013): the question's subject is active (a deactivated subject offers no question to pupils or to the paper builder). */
export const ACTIVE_SUBJECT_SQL = Prisma.sql`EXISTS (SELECT 1 FROM subjects sj WHERE sj.id = v.subject_id AND sj.is_active)`

export const SPM_SERVABLE_SQL = Prisma.sql`(${LEARNER_LEVEL_SQL} AND ${NOT_SOURCE_TAKEN_DOWN_SQL} AND ${NOT_FLAGGED_SQL} AND ${ALL_LEAVES_KEYED_SQL} AND ${MEDIA_RESOLVED_SQL} AND ${NOT_PKSK_SQL} AND EXISTS (SELECT 1 FROM education_levels ol WHERE ol.id = v.education_level_id AND ol.code IN (${Prisma.raw(OFFERED_LIST)})) AND EXISTS (SELECT 1 FROM subjects sj WHERE sj.id = v.subject_id AND sj.is_active) AND EXISTS (SELECT 1 FROM subject_levels sl WHERE sl.subject_id = v.subject_id AND sl.education_level_id = v.education_level_id))`
