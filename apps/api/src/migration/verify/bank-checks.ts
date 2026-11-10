/**
 * Semantic checks of the question-bank and paper loaders (`migrate:questions`, `migrate:structured`, `migrate:papers`): the picture pass and the
 * rejects. Every expectation is computed from the staged and archived V2 tables (or from the loader's own reject rows for the picture files, which only
 * the file system can judge); no number is typed in. Aggregates only: no question text, path or id is selected into the report.
 */
import { readFileSync } from 'node:fs'

import type pg from 'pg'

import { ARCHIVE_SCHEMA, STAGING_SCHEMA } from '../ddl/spec'
import { quoteIdent } from '../kit/sql'
import { capped, entityOf, exists, reported, type CheckContext } from './check-kit'
import type { StatCheck } from './types'

const S = quoteIdent(STAGING_SCHEMA)
const A = quoteIdent(ARCHIVE_SCHEMA)

// ---------------------------------------------------------------- question pictures

/**
 * The distinct V2 picture paths the picture pass walks: the `image_path` of every archived question (any type or status), plus the path of every
 * media asset a canonical stimulus shows that no question row names (the same two queries and the same de-duplication as `files-step.ts`).
 */
export async function walkedPictureCount(pool: pg.Pool): Promise<number> {
  const media = (await exists(pool, ARCHIVE_SCHEMA, 'media_assets')) && (await exists(pool, ARCHIVE_SCHEMA, 'stimuli'))
  const mediaPaths = media
    ? `UNION SELECT ma.path FROM ${A}."media_assets" ma JOIN ${A}."stimuli" s ON s.asset_id = ma.id WHERE ma.path IS NOT NULL AND btrim(ma.path) <> ''`
    : ''
  const res = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM (
       SELECT q.image_path AS path FROM ${A}."questions" q WHERE q.image_path IS NOT NULL AND btrim(q.image_path) <> ''
       ${mediaPaths}
     ) u`,
  )
  return res.rows[0]?.n ?? 0
}

/**
 * Question pictures: the paths walked, and the questions that are still held for a picture. A held question is legitimate only when its picture is a
 * path the pass could not use (a `question_files` reject of the latest apply run: missing, unlisted, checksum, type or size); every other held
 * question is one the pass should have released, which is a mismatch.
 */
export async function questionFileChecks({ pool, source, entities }: CheckContext): Promise<StatCheck[]> {
  const f = entityOf(entities, 'question_files')
  if (f === undefined) {
    return [reported('question pictures: distinct V2 paths and held questions', 'counts', 'the files step has not run (migrate:questions without --files-dir, or no apply run); not compared')]
  }
  const out: StatCheck[] = []
  const hasQuestions = await exists(pool, ARCHIVE_SCHEMA, 'questions')
  if (hasQuestions) {
    const n = await walkedPictureCount(pool)
    out.push({
      name: 'question pictures: distinct V2 paths walked',
      kind: 'counts',
      expected: n,
      actual: f.sourceCount,
      status: n === f.sourceCount ? 'ok' : 'mismatch',
      detail: 'distinct image_path of the archived questions plus the media assets of the canonical stimuli (as the picture pass reads them)',
    })
  }
  const media = hasQuestions && (await exists(pool, ARCHIVE_SCHEMA, 'media_assets'))
  const failedPaths = !hasQuestions
    ? `SELECT NULL::text AS path WHERE false`
    : `SELECT q.image_path AS path FROM etl_rejects r JOIN latest l ON l.run_id = r.run_id
         JOIN ${A}."questions" q ON r.column_name = 'questions.image_path' AND q.id::text = r.legacy_id
        WHERE r.entity = 'question_files'
       ${
         media
           ? `UNION SELECT ma.path FROM etl_rejects r JOIN latest l ON l.run_id = r.run_id
         JOIN ${A}."media_assets" ma ON r.column_name = 'media_assets.path' AND ma.id::text = r.legacy_id
        WHERE r.entity = 'question_files'`
           : ''
       }`
  const held = await pool.query<{ questions: number; inactive: number; explained: number; failed_paths: number }>(
    `WITH latest AS (
        SELECT max(c.run_id) AS run_id FROM etl_recon c JOIN etl_runs u ON u.id = c.run_id
         WHERE c.entity = 'question_files' AND u.mode = 'apply' AND u.status = 'succeeded' AND $1 = ANY(u.sources)),
      failed AS (${failedPaths}),
      held AS (
        SELECT v.id, q.is_active, v.import_issues FROM question_versions v JOIN questions q ON q.id = v.question_id
         WHERE v.version_no = 1 AND jsonb_typeof(v.import_issues) = 'array' AND v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb)
     SELECT (SELECT count(*) FROM held)::int AS questions,
            (SELECT count(*) FROM held WHERE NOT is_active)::int AS inactive,
            (SELECT count(*) FROM held h WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(h.import_issues) i
                 WHERE i->>'code' = 'legacy_image_unresolved' AND NOT EXISTS (SELECT 1 FROM failed fp WHERE fp.path = i->>'path')))::int AS explained,
            (SELECT count(*) FROM failed)::int AS failed_paths`,
    [source],
  )
  const h = held.rows[0] ?? { questions: 0, inactive: 0, explained: 0, failed_paths: 0 }
  out.push({
    name: 'question pictures: questions held for a missing or unusable picture',
    kind: 'counts',
    expected: h.explained,
    actual: h.questions,
    status: h.explained === h.questions ? 'ok' : 'mismatch',
    detail: `${h.questions} questions are held (${h.inactive} inactive, never served); ${h.explained} of them wait for one of the ${h.failed_paths} picture path(s) the pass rejected (etl_rejects of question_files; the files-missing CSV lists each cause); the other ${h.questions - h.explained} should have been released`,
  })
  return out
}

// ---------------------------------------------------------------- rejects

/** Rejects of the standalone loaders by `entity|reason|column` of the latest succeeded apply run of each entity. */
async function rejectCounts(pool: pg.Pool, source: string, entities: readonly string[]): Promise<Map<string, number>> {
  const res = await pool.query<{ entity: string; reason: string; column_name: string | null; n: number }>(
    `SELECT r.entity, r.reason, r.column_name, count(*)::int AS n
       FROM etl_rejects r
      WHERE r.entity = ANY($2::text[])
        AND r.run_id = (SELECT max(c.run_id) FROM etl_recon c JOIN etl_runs u ON u.id = c.run_id
                         WHERE c.entity = r.entity AND u.mode = 'apply' AND u.status = 'succeeded' AND $1 = ANY(u.sources))
      GROUP BY 1, 2, 3`,
    [source, entities],
  )
  return new Map(res.rows.map((r) => [`${r.entity}|${r.reason}|${r.column_name ?? ''}`, r.n]))
}

const TRUE_WORDS = `('1', 'true', 't', 'yes', 'y', 'ya')`
const FALSE_WORDS = `('0', 'false', 'f', 'no', 'n', 'tidak')`

/** One row per archived MCQ question with its option facts (a carrier absorbed into a stimulus is not a question of this loader). */
const MCQ_OPTION_FACTS = `
  SELECT q.id, count(o.id) AS n,
         count(o.id) FILTER (WHERE o.body IS NULL OR btrim(o.body) = '') AS blank,
         count(o.id) FILTER (WHERE lower(btrim(coalesce(o.is_correct, ''))) IN ${TRUE_WORDS}) AS tr,
         count(o.id) FILTER (WHERE btrim(coalesce(o.is_correct, '')) <> '' AND lower(btrim(o.is_correct)) NOT IN ${TRUE_WORDS} AND lower(btrim(o.is_correct)) NOT IN ${FALSE_WORDS}) AS inv
    FROM ${A}."questions" q LEFT JOIN ${A}."question_options" o ON o.question_id = q.id
   WHERE lower(regexp_replace(btrim(q.type), '[\\s-]+', '_', 'g')) IN ('mcq', 'objektif', 'pilihan_berganda')
     AND NOT EXISTS (SELECT 1 FROM etl_id_map m WHERE m.legacy_source = $1 AND m.entity = 'question_stimuli' AND m.legacy_id = 'c:' || q.id::text)
   GROUP BY q.id`

interface Expectation {
  entity: string
  reason: string
  column: string
  label: string
  /** What V2 holds that the loader cannot use, in words: a reader can judge that the reject is legitimate. */
  cause: string
  sql: string
}

const questionExpectations: readonly Expectation[] = [
  {
    entity: 'questions',
    reason: 'INVALID_VALUE',
    column: 'options',
    label: 'questions: rejected for the option count',
    cause: 'an MCQ with fewer than 2 or more than 8 options',
    sql: `WITH f AS (${MCQ_OPTION_FACTS}) SELECT count(*)::int AS n FROM f WHERE n < 2 OR n > 8`,
  },
  {
    entity: 'questions',
    reason: 'INVALID_VALUE',
    column: 'options.body',
    label: 'questions: rejected for an empty option text',
    cause: 'an MCQ with an option that has no text (the contract needs a text on every option)',
    sql: `WITH f AS (${MCQ_OPTION_FACTS}) SELECT count(*)::int AS n FROM f WHERE n BETWEEN 2 AND 8 AND blank > 0`,
  },
  {
    entity: 'questions',
    reason: 'INVALID_VALUE',
    column: 'is_correct',
    label: 'questions: rejected for the answer key',
    cause: 'an MCQ with no option marked correct, an unreadable flag, or every option marked correct (an answer is never guessed)',
    sql: `WITH f AS (${MCQ_OPTION_FACTS}) SELECT count(*)::int AS n FROM f WHERE n BETWEEN 2 AND 8 AND blank = 0 AND (inv > 0 OR tr = 0 OR (tr > 1 AND tr > n - 1))`,
  },
]

/** The canonical-only questions (V2 `exam_questions` that are not a projection of an archived question) with an MCQ part the loader cannot key. */
const NOT_PROJECTED = `NOT EXISTS (SELECT 1 FROM ${A}."legacy_canonical_map" lm WHERE lm.canonical_type = 'exam_question' AND lm.canonical_id = p.exam_question_id)`
const examExpectations: readonly Expectation[] = [
  {
    entity: 'exam_questions',
    reason: 'INVALID_VALUE',
    column: 'is_correct',
    label: 'exam_questions: rejected for the answer key',
    cause: 'a question with an MCQ part whose options do not mark exactly one correct answer (or carry an unreadable flag)',
    sql: `WITH parts AS (
        SELECT p.exam_question_id, count(o.id) AS n,
               count(o.id) FILTER (WHERE lower(btrim(coalesce(o.is_correct, '0'))) IN ('1', 'true', 't', 'ya', 'yes')) AS tr,
               count(o.id) FILTER (WHERE lower(btrim(coalesce(o.is_correct, '0'))) NOT IN ('1', 'true', 't', 'ya', 'yes', '0', 'false', 'f', 'tidak', 'no', 'n')) AS inv
          FROM ${A}."question_parts" p JOIN ${S}."answer_modes" m ON m.id = p.answer_mode_id AND m.slug = 'mcq'
          LEFT JOIN ${A}."part_options" o ON o.question_part_id = p.id
         WHERE ${NOT_PROJECTED}
         GROUP BY p.id, p.exam_question_id)
      SELECT count(DISTINCT exam_question_id)::int AS n FROM parts WHERE n BETWEEN 2 AND 8 AND (inv > 0 OR tr <> 1)`,
  },
  {
    entity: 'exam_questions',
    reason: 'INVALID_VALUE',
    column: 'options',
    label: 'exam_questions: rejected for the option count',
    cause: 'a question with an MCQ part that has fewer than 2 or more than 8 options',
    sql: `WITH parts AS (
        SELECT p.exam_question_id, count(o.id) AS n
          FROM ${A}."question_parts" p JOIN ${S}."answer_modes" m ON m.id = p.answer_mode_id AND m.slug = 'mcq'
          LEFT JOIN ${A}."part_options" o ON o.question_part_id = p.id
         WHERE ${NOT_PROJECTED}
         GROUP BY p.id, p.exam_question_id)
      SELECT count(DISTINCT exam_question_id)::int AS n FROM parts WHERE n < 2 OR n > 8`,
  },
]

/** A blueprint is kept only with a duration of its own or one derived from the V2 papers of the same subject and kertas; with neither it is not guessed. */
const blueprintExpectations: readonly Expectation[] = [
  {
    entity: 'paper_blueprints',
    reason: 'INVALID_VALUE',
    column: 'duration_minutes',
    label: 'paper_blueprints: rejected for no duration',
    cause: 'a blueprint with no duration and no V2 paper of the same subject and kertas to take one from',
    sql: `SELECT count(*)::int AS n FROM ${A}."paper_blueprints" b
           WHERE b.kertas BETWEEN 1 AND 4 AND (b.duration_minutes IS NULL OR b.duration_minutes < 1)
             AND NOT EXISTS (SELECT 1 FROM ${A}."exam_papers" p
                              WHERE p.subject_id = b.subject_id AND substring(p.kertas::text FROM '[0-9]')::int = b.kertas AND p.duration_minutes >= 1)`,
  },
]

/** Reject reasons that only the text (a stem that parses to nothing) or the file system (a page image the content check refuses) can judge. */
const JUDGED_ELSEWHERE: ReadonlySet<string> = new Set(['exam_questions|INVALID_VALUE|stem', 'paper_document_pages|INVALID_VALUE|path'])
const judgedElsewhere = (key: string): boolean => JUDGED_ELSEWHERE.has(key) || key.startsWith('question_files|')

/**
 * Every reject key (`entity|reason|column`) that verify explains: the computed expectations plus the keys judged by the text or the file (`question_files|*`
 * stands for every reason of the picture pass). The single source for the checks above and for the list that `docs/ops/sql/smoke-readonly.sql` X3 mirrors.
 */
export const EXPLAINED_REJECT_KEYS: readonly string[] = [
  ...[...questionExpectations, ...examExpectations, ...blueprintExpectations].map((e) => `${e.entity}|${e.reason}|${e.column}`),
  ...JUDGED_ELSEWHERE,
  'question_files|*',
].sort()

/**
 * The per-run allowlist of reject reasons the operator accepts as explained, one item per reason: `entity|reason|column=maxN` (column may be
 * empty only when the reject has none; there is no wildcard). The item accepts at most N rejects of that kind: more than N is unexplained again,
 * so a new defect of the same kind cannot hide behind an old waiver. From `PP_VERIFY_ACCEPT_REJECTS` (comma separated) and/or the file named by
 * `PP_VERIFY_ACCEPT_REJECTS_FILE` (one per line, `#` comments). This is a ONE-RUN waiver for the operator's shell: never put it in a persisted
 * env file (prod.env, .env), or it silently applies to every later verify. The report prints every item outside the capped detail list.
 */
export function acceptedRejectKeys(env: NodeJS.ProcessEnv): Map<string, number> {
  const items: string[] = (env.PP_VERIFY_ACCEPT_REJECTS ?? '').split(',')
  const file = env.PP_VERIFY_ACCEPT_REJECTS_FILE
  if (file !== undefined && file.trim() !== '') items.push(...readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*$/, '')))
  const out = new Map<string, number>()
  for (const raw of items.map((x) => x.trim()).filter((x) => x !== '')) {
    const m = /^([a-z_]+)\|([A-Z_]+)\|([A-Za-z_.]*)=(\d+)$/.exec(raw)
    if (m === null) throw new RangeError(`PP_VERIFY_ACCEPT_REJECTS: "${raw}" is not entity|reason|column=maxN`)
    out.set(`${m[1]}|${m[2]}|${m[3]}`, Number(m[4]))
  }
  return out
}

export const STANDALONE_ENTITIES = [
  'questions', 'question_stimuli', 'stimulus_groups', 'question_files', 'structured_questions', 'subjective_questions', 'exam_questions', 'pksk_questions',
  'spm_sets', 'paper_blueprints', 'exam_papers', 'paper_documents', 'paper_document_pages',
]

/**
 * Rejects of the standalone loaders (latest apply run of each), by reason. Each reason that V2 data alone explains has its own check: the expected
 * count is computed from the archive (the rows V2 holds that the loader must refuse) and compared with the reject rows. The rest (a stem that
 * parses to nothing, a page image the content check refuses, and the picture files of `question_files`) is added to the expectation as counted:
 * those are judged by the text or the file system, and every such reject carries its reason and column in `etl_rejects`. A reject with any other
 * reason (an unknown subject, level or status) has no expectation: it is listed as unexplained and the total is only reported, never passed.
 */
export async function standaloneRejects({ pool, source, entities }: CheckContext): Promise<StatCheck[]> {
  const counts = await rejectCounts(pool, source, STANDALONE_ENTITIES)
  const out: StatCheck[] = []
  let expectedTotal = 0
  const computed = new Set<string>()
  // An expectation is about a loader that has a succeeded apply run: the archive holds rows the others have not loaded yet.
  const all = [...questionExpectations, ...examExpectations, ...blueprintExpectations].filter((e) => entityOf(entities, e.entity) !== undefined)
  if (all.length === 0 && counts.size === 0) {
    return [reported('rejects of the question and paper loaders (latest apply run of each)', 'counts', 'no question or paper loader has a succeeded apply run; not compared')]
  }
  for (const e of all) {
    const key = `${e.entity}|${e.reason}|${e.column}`
    const actual = counts.get(key) ?? 0
    const needsSource = e.sql.includes('$1')
    let expected: number | null = null
    try {
      expected = (await pool.query<{ n: number }>(e.sql, needsSource ? [source] : [])).rows[0]?.n ?? 0
    } catch (err) {
      // A staged table the expectation needs is not there (a partial stage): the reject is shown, not compared. Other failures surface as a failed check.
      const code = (err as { code?: string }).code
      if (code !== '42P01') throw err
    }
    if (expected === null) {
      out.push(reported(`rejects: ${e.label}`, 'counts', `${actual} rejected; a staged table needed to compute the expectation is not available`))
      continue
    }
    computed.add(key)
    expectedTotal += expected
    out.push({ name: `rejects: ${e.label}`, kind: 'counts', expected, actual, status: expected === actual ? 'ok' : 'mismatch', detail: `V2 holds ${expected} with ${e.cause}` })
  }
  let counted = 0
  let unexplained = 0
  const rest: string[] = []
  const accepted = acceptedRejectKeys(process.env)
  for (const [key, n] of [...counts].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (computed.has(key)) continue
    const [entity, reason, column] = key.split('|')
    const label = `${entity} ${reason}${column ? `/${column}` : ''}: ${n}`
    if (judgedElsewhere(key)) {
      counted += n
      rest.push(`${label} (judged by the text or the file, counted as is)`)
    } else if ((accepted.get(key) ?? -1) >= n) {
      counted += n
      rest.push(`${label} (ACCEPTED by the run allowlist, max ${accepted.get(key)})`)
    } else {
      unexplained += n
      rest.push(`${label} (UNEXPLAINED)`)
    }
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0)
  const expected = expectedTotal + counted
  out.push({
    name: 'rejects of the question and paper loaders (latest apply run of each)',
    kind: 'counts',
    expected,
    actual: total,
    // An unexplained reject reason fails the verify unless the run explicitly accepts it (PP_VERIFY_ACCEPT_REJECTS / _FILE).
    status: unexplained === 0 && expected === total ? 'ok' : 'mismatch',
    detail: (total === 0 ? 'no reject' : capped([...all.map((e) => `${e.entity} ${e.reason}/${e.column}: ${counts.get(`${e.entity}|${e.reason}|${e.column}`) ?? 0}`), ...rest])) +
      (accepted.size > 0 ? ` | allowlist in force: ${[...accepted].map(([k, v]) => `${k}=${v}`).sort().join(', ')}` : ''),
  })
  return out
}
