/**
 * BE-30 / MIG-09 optional backfill: links migrated (historical) practice answers to questions of the new bank.
 * It runs only after the bank has been reloaded and never blocks cutover (v2-data-migration.md 3.3 item 3).
 *
 * WORKING ASSUMPTION for the BE-10 definitions (card Open question 1, to be confirmed in the BE-10 PR):
 *  - `source_papers.natural_key` is lower-case, trimmed parts joined with `|` (subject code, year, board, kertas,
 *    exam type). `practice_answers.source_natural_key` was copied from the .cloud paper by BE-29 in that same
 *    form. Both sides are compared as `lower(btrim(x))`, so a stray case or space difference does not matter. An
 *    empty value never matches (NULLIF).
 *  - `number_label` is compared the same way (`lower(btrim())`) against `question_versions.number_label`.
 *  - A v2 question is linked to its paper through its LIVE version's `question_versions.source_paper_id`
 *    (a soft pointer, no FK yet). A question has no paper column of its own.
 *  - `source_papers.file_hash` (.cloud and v2 alike) is a hash of a whole PAPER; it cannot match an answer. The answer's
 *    `legacy_content_hash` is a QUESTION-level hash (BE-29: SHA-256 of normalised stem plus sorted normalised
 *    option texts). The v2 side has no stored question-level hash, so it is computed here from the live version
 *    with the very same function (`snapshot-dims/content-hash.ts` `contentHash`): stem = `stem_ms` (else
 *    `stem_en`), options = `part_options.body_ms` (else `body_en`) of every part of that version. Only the
 *    digest is kept in memory (digest -> question ids); no text is logged or reported. This is reliable only when
 *    the OCR/typed text equals the old text, which the architecture doc itself calls unlikely, so the hash step
 *    is a best-effort second chance, used only when the natural key found no candidate at all.
 *
 * Candidate questions (documented default): `questions.is_active` AND the live version
 * (`question_versions.version_no = questions.live_version_no`) has `status = 'approved'`. Drafts, review,
 * approved-but-unpublished, archived (superseded, withdrawn, source_takedown) and deactivated questions are NOT
 * candidates: a historical answer must never be attached to a question learners cannot see.
 *
 * Scale: the hash index holds one 64-character digest plus one or two ids per live published question, roughly 20 MB
 * per 100,000 questions, and is built once per run (lazily, only if some answer needs the hash step). The text of a
 * question is read page by page (1,000 at a time) and dropped at once.
 *
 * Modes and locking: `apply` runs one transaction per batch and writes with the guarded UPDATE. `dry-run` runs NO
 * UPDATE at all: it is one READ ONLY, REPEATABLE READ transaction (a consistent snapshot, no row locks, rolled
 * back at the end) and counts what the guarded UPDATE would do. The guard cannot differ because the examined rows
 * were selected with `question_id IS NULL` in that same snapshot.
 *
 * Concurrency (apply only): the run holds two session advisory locks for its whole duration, released in `finally`:
 * `etl:link-questions:<source>` (a second backfill is refused) and the source-level `etl:source:<source>` (the key
 * the rollback holds too). OPEN POINT: the kit runner (`kit/runner.ts`) does not take `etl:source:<source>` yet (it
 * locks `etl:<mode>:<inputHash>`), and the kit is outside this card, so a loader that starts after the backfill is
 * only seen through `etl_runs`. For that, the start of the run AND the start of every batch transaction (before its
 * UPDATE) refuse while `etl_runs` has a `running` apply run for the source (`migrate:core`, `migrate:activity`,
 * delta). Stopping mid-way throws `LinkQuestionsBusyError` carrying `committedBatches` and `linked`: the batches
 * already committed stay (each is complete and correct on its own) and a re-run continues. The guarded UPDATE stays
 * the last line of defence.
 *
 * Rules: only `question_id` is ever written, only where it is still NULL (the UPDATE itself says
 * `WHERE question_id IS NULL`), only when exactly one candidate matches. Zero candidates -> unmatched, more than
 * one -> ambiguous; both stay NULL and are listed by surrogate id. Aggregates and ids only; no stems, names or
 * hashes are returned or printed. Database errors leave through `sanitizeDbError`.
 */
import type pg from 'pg'

import { assertApplyAllowed } from '../kit/apply-guard'
import { sanitizeDbError } from '../kit/errors'
import type { LegacySource, RunMode } from '../kit/types'
import { assertLegacySource } from '../kit/types'
import { contentHash } from '../snapshot-dims/content-hash'

export interface LinkQuestionsOptions {
  pool: pg.Pool
  env: Readonly<Record<string, string | undefined>>
  source: LegacySource
  /** Default `dry-run` (read-only snapshot, no write at all). */
  mode?: RunMode
  /** Answers per batch; each batch is its own transaction in `apply`. Default 1,000. */
  batchSize?: number
  /** Most surrogate ids listed per bucket in the report. Default 200. */
  listCap?: number
  /**
   * TEST SEAM, not for production use: called in `apply` after the candidates of a batch are decided and before its
   * guarded UPDATE, with the ids about to be written. Lets a test simulate another process linking a row meanwhile.
   */
  onBeforeUpdate?: (ids: readonly string[]) => Promise<void> | void
}

export interface LinkQuestionsReport {
  mode: RunMode
  /** Answers with `question_id IS NULL`, `legacy_source = source`, that were examined. */
  examined: number
  /** Set to the single matching question. */
  linked: number
  /** More than one candidate question: left NULL. */
  ambiguous: number
  /** No candidate: left NULL. */
  unmatched: number
  /** Already had a `question_id`: never touched. */
  alreadyLinked: number
  /** Surrogate ids (practice_answers.id) of ambiguous rows, capped for printing. */
  ambiguousIds: string[]
  unmatchedIds: string[]
  /** Of `linked`: found exactly through `etl_id_map` (`migrate:questions`: `legacy_question_ref` = the old question id). */
  linkedByExact?: number
  /** Of `linked`: found by natural key + number label. */
  linkedByNaturalKey?: number
  /** Of `linked`: found by content hash (natural key had no candidate). */
  linkedByHash?: number
  /** Matched, but another process had set `question_id` first, so the guarded UPDATE skipped it. */
  raced?: number
}

/** An apply of the backfill was refused because another writer is active (advisory lock or a running apply). */
export class LinkQuestionsBusyError extends Error {
  constructor(
    message: string,
    /** Batches already committed before the run stopped (they stay). 0 when refused at the start. */
    readonly committedBatches = 0,
    /** Answers linked by those batches. */
    readonly linked = 0,
  ) {
    super(message)
    this.name = 'LinkQuestionsBusyError'
  }
}

export const DEFAULT_BATCH_SIZE = 1_000
export const DEFAULT_LIST_CAP = 200
/** Questions read per page while the hash index is built. */
const HASH_PAGE = 1_000

/** Live, published, active questions only (the candidate rule above). Aliases: q = questions, v = live version. */
const CANDIDATE_FROM = `
  FROM questions q
  JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
  WHERE q.is_active AND v.status = 'approved'`

const NEXT_ANSWERS_SQL = `
SELECT id::text AS id,
       NULLIF(lower(btrim(source_natural_key)), '') AS nk,
       NULLIF(lower(btrim(number_label)), '') AS nl,
       NULLIF(lower(btrim(legacy_content_hash)), '') AS hash,
       NULLIF(btrim(legacy_question_ref), '') AS ref
FROM practice_answers
WHERE legacy_source = $1 AND question_id IS NULL AND id > $2::bigint
ORDER BY practice_answers.id
LIMIT $3`

/**
 * Step 0 (QLOAD): the exact link. `migrate:questions` registers `(source, 'questions', old question id) -> new question id`
 * in `etl_id_map`, and a migrated answer keeps the old id in `legacy_question_ref`. One match at most per answer (the map is
 * unique), so there is no ambiguity. Same candidate rule as everywhere: active and live-published (a question held for a
 * missing image is not linked).
 */
const EXACT_MATCH_SQL = `
SELECT pa.id::text AS id, q.id::text AS question_id
FROM practice_answers pa
JOIN etl_id_map m ON m.legacy_source = $2 AND m.entity = 'questions' AND m.legacy_id = NULLIF(btrim(pa.legacy_question_ref), '')
JOIN questions q ON q.id = m.new_id::bigint AND q.is_active
JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
WHERE pa.id = ANY($1::bigint[])`

/** Up to two distinct candidate question ids per answer by natural key + number label (two is enough to call it ambiguous). */
const KEY_MATCH_SQL = `
WITH a AS (
  SELECT id, NULLIF(lower(btrim(source_natural_key)), '') AS nk, NULLIF(lower(btrim(number_label)), '') AS nl
  FROM practice_answers WHERE id = ANY($1::bigint[])
)
SELECT a.id::text AS id, (array_agg(DISTINCT q.id ORDER BY q.id))[1:2]::text[] AS question_ids
FROM a
JOIN source_papers sp ON NULLIF(lower(btrim(sp.natural_key)), '') = a.nk
JOIN question_versions v ON v.source_paper_id = sp.id AND NULLIF(lower(btrim(v.number_label)), '') = a.nl
JOIN questions q ON q.id = v.question_id AND q.live_version_no = v.version_no
WHERE a.nk IS NOT NULL AND a.nl IS NOT NULL AND q.is_active AND v.status = 'approved'
GROUP BY a.id`

const HASH_PAGE_SQL = `
SELECT q.id::text AS id,
       coalesce(v.stem_ms, v.stem_en) AS stem,
       coalesce((SELECT array_agg(coalesce(o.body_ms, o.body_en) ORDER BY p.id, o.position)
                 FROM question_parts p JOIN part_options o ON o.part_id = p.id
                 WHERE p.question_version_id = v.id), ARRAY[]::text[]) AS options
${CANDIDATE_FROM} AND q.id > $1::bigint
ORDER BY q.id
LIMIT $2`

interface AnswerRow {
  id: string
  ref: string | null
  nk: string | null
  nl: string | null
  hash: string | null
}

/** digest -> up to two question ids (two is enough to call it ambiguous). */
type HashIndex = Map<string, string[]>

async function buildHashIndex(db: Pick<pg.PoolClient, 'query'>): Promise<HashIndex> {
  const index: HashIndex = new Map()
  let after = '0'
  for (;;) {
    const res = await db.query<{ id: string; stem: string | null; options: (string | null)[] | null }>(HASH_PAGE_SQL, [
      after,
      HASH_PAGE,
    ])
    for (const r of res.rows) {
      // The text goes in, only the digest is kept.
      const h = contentHash(r.stem, r.options ?? [])
      if (h === null) continue
      const ids = index.get(h)
      if (ids === undefined) index.set(h, [r.id])
      else if (ids.length < 2) ids.push(r.id)
    }
    if (res.rows.length < HASH_PAGE) return index
    after = (res.rows[res.rows.length - 1] as { id: string }).id
  }
}

type Outcome = { kind: 'linked'; questionId: string; by: 'exact' | 'key' | 'hash' } | { kind: 'ambiguous' } | { kind: 'unmatched' }

export async function linkQuestions(options: LinkQuestionsOptions): Promise<LinkQuestionsReport> {
  const { pool, env, source } = options
  const mode: RunMode = options.mode ?? 'dry-run'
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  const listCap = options.listCap ?? DEFAULT_LIST_CAP
  assertLegacySource(source)
  if (mode !== 'dry-run' && mode !== 'apply') throw new RangeError(`Unknown mode "${String(mode)}".`)
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new RangeError('Batch size must be a positive integer.')
  if (!Number.isInteger(listCap) || listCap < 0) throw new RangeError('List cap must be a non-negative integer.')
  if (mode === 'apply') await assertApplyAllowed(pool, env)

  const report: LinkQuestionsReport = {
    mode,
    examined: 0,
    linked: 0,
    ambiguous: 0,
    unmatched: 0,
    alreadyLinked: 0,
    ambiguousIds: [],
    unmatchedIds: [],
    linkedByExact: 0,
    linkedByNaturalKey: 0,
    linkedByHash: 0,
    raced: 0,
  }

  let hashIndex: HashIndex | undefined
  try {
    const already = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM practice_answers WHERE legacy_source = $1 AND question_id IS NOT NULL`,
      [source],
    )
    report.alreadyLinked = already.rows[0]?.n ?? 0

    const client = await pool.connect()
    const lockKeys = [`etl:link-questions:${source}`, `etl:source:${source}`]
    const held: string[] = []
    let committedBatches = 0
    const assertNoRunningApply = async (): Promise<void> => {
      const running = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM etl_runs WHERE status = 'running' AND mode = 'apply' AND $1 = ANY(sources)`,
        [source],
      )
      if ((running.rows[0]?.n ?? 0) > 0) {
        throw new LinkQuestionsBusyError(
          committedBatches === 0
            ? `Refusing --apply: a migration apply run for source "${source}" is still running (etl_runs).`
            : `Stopped: a migration apply run for source "${source}" started (etl_runs) after ${committedBatches} committed batch(es); ${report.linked} answer(s) linked so far stay linked.`,
          committedBatches,
          report.linked,
        )
      }
    }
    try {
      if (mode === 'apply') {
        for (const key of lockKeys) {
          const got = await client.query<{ ok: boolean }>(`SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok`, [key])
          if (!got.rows[0]?.ok) {
            throw new LinkQuestionsBusyError(`Refusing --apply: another writer holds the lock "${key}" for source "${source}".`)
          }
          held.push(key)
        }
        await assertNoRunningApply()
      }
      // dry-run: one READ ONLY snapshot around everything, rolled back, no UPDATE. apply: one transaction per batch.
      if (mode === 'dry-run') await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      let after = '0'
      for (;;) {
        if (mode === 'apply') {
          await client.query('BEGIN')
          await assertNoRunningApply().catch(async (err: unknown) => {
            await client.query('ROLLBACK').catch(() => undefined)
            throw err
          })
        }
        try {
          const page = await client.query<AnswerRow>(NEXT_ANSWERS_SQL, [source, after, batchSize])
          const rows = page.rows
          if (rows.length === 0) {
            if (mode === 'apply') await client.query('ROLLBACK')
            break
          }
          after = (rows[rows.length - 1] as AnswerRow).id

          const byExact = new Map<string, string>()
          const referenced = rows.filter((r) => r.ref !== null).map((r) => r.id)
          if (referenced.length > 0) {
            const res = await client.query<{ id: string; question_id: string }>(EXACT_MATCH_SQL, [referenced, source])
            for (const r of res.rows) byExact.set(r.id, r.question_id)
          }
          const byKey = new Map<string, string[]>()
          const keyed = rows.filter((r) => !byExact.has(r.id) && r.nk !== null && r.nl !== null).map((r) => r.id)
          if (keyed.length > 0) {
            const res = await client.query<{ id: string; question_ids: string[] }>(KEY_MATCH_SQL, [keyed])
            for (const r of res.rows) byKey.set(r.id, r.question_ids)
          }
          if (hashIndex === undefined && rows.some((r) => r.hash !== null && !byExact.has(r.id) && !byKey.has(r.id))) {
            hashIndex = await buildHashIndex(client)
          }

          const links: { id: string; questionId: string; by: 'exact' | 'key' | 'hash' }[] = []
          for (const r of rows) {
            report.examined += 1
            const outcome = decide(r, byExact, byKey, hashIndex)
            if (outcome.kind === 'linked') links.push({ id: r.id, questionId: outcome.questionId, by: outcome.by })
            else if (outcome.kind === 'ambiguous') {
              report.ambiguous += 1
              if (report.ambiguousIds.length < listCap) report.ambiguousIds.push(r.id)
            } else {
              report.unmatched += 1
              if (report.unmatchedIds.length < listCap) report.unmatchedIds.push(r.id)
            }
          }

          if (mode === 'dry-run') {
            // Simulation of the guarded UPDATE: these rows were read with `question_id IS NULL` in this snapshot.
            for (const l of links) {
              report.linked += 1
              bumpBy(report, l.by)
            }
          } else if (links.length > 0) {
            await options.onBeforeUpdate?.(links.map((l) => l.id))
            // The only write of this module. `question_id IS NULL` keeps a concurrently linked row untouched.
            const upd = await client.query<{ id: string }>(
              `UPDATE practice_answers pa SET question_id = m.qid
               FROM unnest($1::bigint[], $2::bigint[]) AS m(id, qid)
               WHERE pa.id = m.id AND pa.question_id IS NULL AND pa.legacy_source = $3
               RETURNING pa.id::text AS id`,
              [links.map((l) => l.id), links.map((l) => l.questionId), source],
            )
            const written = new Set(upd.rows.map((r) => r.id))
            for (const l of links) {
              if (!written.has(l.id)) {
                report.raced = (report.raced ?? 0) + 1
                continue
              }
              report.linked += 1
              bumpBy(report, l.by)
            }
          }
          if (mode === 'apply') {
            await client.query('COMMIT')
            committedBatches += 1
          }
        } catch (err) {
          if (mode === 'apply') await client.query('ROLLBACK').catch(() => undefined)
          throw err
        }
      }
    } finally {
      if (mode === 'dry-run') await client.query('ROLLBACK').catch(() => undefined)
      for (const key of held) await client.query(`SELECT pg_advisory_unlock(hashtextextended($1, 0))`, [key]).catch(() => undefined)
      client.release()
    }
  } catch (err) {
    throw sanitizeDbError(err, 'practice_answers')
  }
  return report
}

function bumpBy(report: LinkQuestionsReport, by: 'exact' | 'key' | 'hash'): void {
  if (by === 'exact') report.linkedByExact = (report.linkedByExact ?? 0) + 1
  else if (by === 'key') report.linkedByNaturalKey = (report.linkedByNaturalKey ?? 0) + 1
  else report.linkedByHash = (report.linkedByHash ?? 0) + 1
}

function decide(row: AnswerRow, byExact: Map<string, string>, byKey: Map<string, string[]>, hashIndex: HashIndex | undefined): Outcome {
  const exact = byExact.get(row.id)
  if (exact !== undefined) return { kind: 'linked', questionId: exact, by: 'exact' }
  const keyIds = byKey.get(row.id)
  if (keyIds !== undefined && keyIds.length > 0) {
    return keyIds.length === 1 ? { kind: 'linked', questionId: keyIds[0] as string, by: 'key' } : { kind: 'ambiguous' }
  }
  if (row.hash !== null && hashIndex !== undefined) {
    const ids = hashIndex.get(row.hash)
    if (ids !== undefined && ids.length > 0) {
      return ids.length === 1 ? { kind: 'linked', questionId: ids[0] as string, by: 'hash' } : { kind: 'ambiguous' }
    }
  }
  return { kind: 'unmatched' }
}
