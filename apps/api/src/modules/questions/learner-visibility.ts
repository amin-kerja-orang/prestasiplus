import { Prisma } from '../../db/generated/client'

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

/**
 * DM-42 (S6-T16, migration 0127): a teacher's personal question (Soalan & Rujukan) is a `question_versions` row with
 * `visibility = 'teacher_private'`; it is served by the mission draw only. EVERY served or counted read of the bank (lists, counts,
 * draws, pickers, reports) adds this predicate (alias `v` = the version read). Reads by id (`get`, `getMany`, `hydrate`) do not:
 * a mission answer must still find its private question. The literal is inlined (no bound value) so the partial index and the
 * static-text specs keep working.
 */
export const BANK_VISIBILITY = 'bank' as const
export const BANK_VISIBLE_SQL = Prisma.sql`v.visibility = ${Prisma.raw(`'${BANK_VISIBILITY}'`)}`

/**
 * The JS twin of `BANK_VISIBLE_SQL`, the ONE definition for records already in memory (the practice source, the remedial pool, the by-id
 * `bankOnly` read). A version that does not carry the field (an older fixture) is a bank version.
 */
export const isBankVersion = (version: { visibility?: string | undefined }): boolean => version.visibility === undefined || version.visibility === BANK_VISIBILITY

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

/** SQL twin of `stimulusTableOf` for a stored grid (`s.table_data`): an array whose first row is a non-empty head, or an object with a non-empty `head`/`headers`/`columns` and a `rows` array. */
export const TABLE_GRID_READABLE_SQL = Prisma.sql`(CASE jsonb_typeof(s.table_data)
    WHEN 'array' THEN CASE WHEN jsonb_typeof(s.table_data -> 0) = 'array' THEN jsonb_array_length(s.table_data -> 0) > 0 ELSE false END
    WHEN 'object' THEN CASE
      WHEN jsonb_typeof(coalesce(s.table_data -> 'head', s.table_data -> 'headers', s.table_data -> 'columns')) = 'array'
        THEN jsonb_array_length(coalesce(s.table_data -> 'head', s.table_data -> 'headers', s.table_data -> 'columns')) > 0 AND jsonb_typeof(s.table_data -> 'rows') = 'array'
      ELSE false END
    ELSE false END)`

/**
 * A stimulus row `s` that cannot be shown: a picture kind without its file, a table with no grid, no file and no pipe table in the body, a passage with no text.
 * The ONE definition, used by `mediaResolvedSql` (any set of stimuli) and by `MEDIA_RESOLVED_SQL` (the pupil-serving form below).
 */
export const UNSHOWABLE_STIMULUS_SQL = Prisma.sql`((s.kind IN ('image', 'diagram', 'map', 'infographic', 'graph') AND s.asset_file_id IS NULL)
        OR (s.kind = 'table' AND s.asset_file_id IS NULL AND (s.body_ms IS NULL OR s.body_ms NOT LIKE '%|%') AND NOT coalesce(${TABLE_GRID_READABLE_SQL}, false))
        OR (s.kind = 'passage' AND btrim(coalesce(s.body_ms, '')) = '' AND btrim(coalesce(s.body_en, '')) = ''))`

/**
 * `true` when every stimulus the question shows can be shown: a picture kind has its file, a table has a grid, a file or a pipe table in the
 * body, a passage has text, and the version carries no `legacy_image_unresolved` import hold. `stimuli` is a statement selecting `sid`.
 */
export const mediaResolvedSql = (stimuli: Prisma.Sql, importIssues: Prisma.Sql): Prisma.Sql => Prisma.sql`(
  NOT EXISTS (
    SELECT 1 FROM (${stimuli}) l JOIN stimuli s ON s.id = l.sid
     WHERE ${UNSHOWABLE_STIMULUS_SQL}
  )
  AND NOT coalesce(jsonb_typeof(${importIssues}) = 'array' AND ${importIssues} @> '[{"code": "legacy_image_unresolved"}]'::jsonb, false)
)`

/** Every stimulus a version shows (own links, part links, its group's); aliases `v`, `q`. Selects `sid`. */
export const VERSION_STIMULI_SQL = Prisma.sql`SELECT vs.stimulus_id AS sid FROM question_version_stimuli vs WHERE vs.question_version_id = v.id
               UNION SELECT p.stimulus_id FROM question_parts p WHERE p.question_version_id = v.id AND p.stimulus_id IS NOT NULL
               UNION SELECT gs.stimulus_id FROM stimulus_group_stimuli gs WHERE gs.group_id = q.group_id`

/**
 * FR-X1-4f (S1-T06): the pupil-serving form of `mediaResolvedSql` over the LIVE version `v` of question `q`. A question whose own stimulus has no file is
 * not served; a question of a stimulus group is not served when ANY stimulus of the group lacks its file (the group's stimuli are in
 * `VERSION_STIMULI_SQL`, so every member of the group drops together: the complete-group rule). Written once, ANDed wherever `NOT_FLAGGED_SQL` is.
 *
 * Gives the same answer as `mediaResolvedSql(VERSION_STIMULI_SQL, v.import_issues)`, written as one NOT EXISTS per link kind (version link, part link,
 * group link). Each is a plain anti-join the planner runs as a hash anti-join over the few unshowable stimuli, where the UNION form could not be pulled up
 * and cost three index probes per candidate row (about 2 million buffers on the 330 thousand candidates of a bank-wide count, measured on UAT).
 */
export const MEDIA_RESOLVED_SQL = Prisma.sql`(
  NOT EXISTS (SELECT 1 FROM question_version_stimuli vs JOIN stimuli s ON s.id = vs.stimulus_id WHERE vs.question_version_id = v.id AND ${UNSHOWABLE_STIMULUS_SQL})
  AND NOT EXISTS (SELECT 1 FROM question_parts p JOIN stimuli s ON s.id = p.stimulus_id WHERE p.question_version_id = v.id AND ${UNSHOWABLE_STIMULUS_SQL})
  AND NOT EXISTS (SELECT 1 FROM stimulus_group_stimuli gs JOIN stimuli s ON s.id = gs.stimulus_id WHERE gs.group_id = q.group_id AND ${UNSHOWABLE_STIMULUS_SQL})
  AND NOT coalesce(jsonb_typeof(v.import_issues) = 'array' AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb, false)
)`

/**
 * S1-T09a (AC-PA-35, D-PA-6): an `mcq_multi` question (several correct options, ticks sent together) is not served in a drill that takes ONE option
 * (46:967: Latih Tubi, Chapter, Databank, Tracking A objective, Remedial, Misi, PKSK and games). Written once and applied by every read that sets
 * `spmPool` (true: `SPM_SERVABLE_SQL`; false: its complement with the flag, key and this condition, `QuestionsRepository.scope`). It is NOT part of
 * the learner scope: the Bijak sitting, Kuiz, Set Soalan Guru, Subjektif and Kertas Subjektif serve it. PKSK is a separate surface (M07):
 * `NOT_PKSK_SQL` keeps its questions out of `SPM_SERVABLE_SQL`, and M07 serves them as single-option items. Alias `v`. The JS twin is the type check
 * of `servableMcq` / `groupSurfaceShapeReasons` (serving/rules.ts), which reports `shape_unsupported`; no new reason code is needed.
 */
export const MCQ_MULTI_TYPE = 'mcq_multi' as const
export const NOT_MCQ_MULTI_SQL = Prisma.sql`v.type <> ${Prisma.raw(`'${MCQ_MULTI_TYPE}'`)}`

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
 * Pieces: learner-visible level (LEARNER_LEVEL_SQL), not flagged (NOT_FLAGGED_SQL, S1-T07), not PKSK (NOT_PKSK_SQL), the level is an offered level (active and not primary, T1 to T5: the SQL form of `offeredLevels` in
 * practice/rules.ts, S4-T06), of an active subject linked to that level (the same rule as the practice cards and the login count). The servable
 * status, active flag, subject and MCQ-leaf shape are applied by the callers (`QuestionsRepository.scope`, the overview SQL),
 * so the status constant stays in one place.
 */
/** R1-T08 follow-up (REQ-B-013): the question's subject is active (a deactivated subject offers no question to pupils or to the paper builder). */
export const ACTIVE_SUBJECT_SQL = Prisma.sql`EXISTS (SELECT 1 FROM subjects sj WHERE sj.id = v.subject_id AND sj.is_active)`

// DM-42: the bank predicate is part of the definition, so a caller of SPM_SERVABLE_SQL alone can never serve a personal question.
export const SPM_SERVABLE_SQL = Prisma.sql`(${BANK_VISIBLE_SQL} AND ${LEARNER_LEVEL_SQL} AND ${NOT_SOURCE_TAKEN_DOWN_SQL} AND ${NOT_FLAGGED_SQL} AND ${ALL_LEAVES_KEYED_SQL} AND ${NOT_MCQ_MULTI_SQL} AND ${MEDIA_RESOLVED_SQL} AND ${NOT_PKSK_SQL} AND EXISTS (SELECT 1 FROM education_levels ol WHERE ol.id = v.education_level_id AND ol.stage <> 'primary' AND ol.is_active) AND EXISTS (SELECT 1 FROM subjects sj WHERE sj.id = v.subject_id AND sj.is_active) AND EXISTS (SELECT 1 FROM subject_levels sl WHERE sl.subject_id = v.subject_id AND sl.education_level_id = v.education_level_id))`
