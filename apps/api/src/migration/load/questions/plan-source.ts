/**
 * Read side of the rajah planner (T-B9-3): turns the staged archive into `RajahRow`s (one pass over `readQuestions`, one page at a time) and
 * the canonical stimulus links (signal S1). Read-only. The same queries run on the real dump (they use only spec columns).
 */
import type pg from 'pg'

import { ARCHIVE_SCHEMA, STAGING_SCHEMA } from '../../ddl/spec'
import { quoteIdent } from '../../kit/sql'
import { enumKey, text } from '../../transform/common'
import { exclusionOf, lifecycleOf, plainFromHtml, statusOf, transformQuestion, type Curriculum, type LegacyQuestion } from '../../transform/question-bank'
import { planRajah, type CanonicalLink, type RajahPlan, type RajahRow, type StimulusKind, type StimulusSpec } from './plan'
import { readQuestions } from './source'

const A = quoteIdent(ARCHIVE_SCHEMA)
const S = quoteIdent(STAGING_SCHEMA)

/** One planner row of a staged question, or null when the row is not a candidate (another loader's type, or an unknown status: both are counted elsewhere). */
export function rajahRowOf(row: LegacyQuestion, cur: Curriculum): RajahRow | null {
  if (exclusionOf(row) !== null) return null
  const status = statusOf(row.status)
  if (status === null) return null
  const subject = text(row.subject_id)
  const level = text(row.education_level_id)
  if (subject === null || level === null) return null
  const out = transformQuestion(row, cur)
  const loadable = out.ok
  const rawStem = text(row.body)
  const stem = out.ok ? out.value.stem : rawStem === null ? '' : plainFromHtml(rawStem).text
  const optionTexts = out.ok
    ? out.value.options.map((o) => o.body)
    : row.options.map((o) => text(o.body)).filter((b): b is string => b !== null).map((b) => plainFromHtml(b).text).filter((b) => b !== '')
  const created = Date.parse(text(row.created_at) ?? '')
  return {
    id: (row.id ?? '').trim(),
    n: Number((row.id ?? '').trim()),
    subject,
    level,
    cls: lifecycleOf(status),
    image: text(row.image_path),
    stem: stem.trim(),
    optionTexts,
    loadable,
    createdMs: Number.isNaN(created) ? null : created,
    externalRef: text(row.external_ref),
  }
}

export async function readRajahRows(pool: pg.Pool, cur: Curriculum, pageSize: number): Promise<RajahRow[]> {
  const rows: RajahRow[] = []
  for await (const q of readQuestions(pool, null, pageSize)) {
    const r = rajahRowOf(q, cur)
    if (r !== null) rows.push(r)
  }
  return rows
}

const KIND_MAP: Readonly<Record<string, StimulusKind>> = {
  passage: 'passage', text: 'passage', box: 'passage',
  image: 'image', figure: 'image', cartoon: 'image',
  diagram: 'diagram', table: 'table', graph: 'graph', chart: 'graph', map: 'map', infographic: 'infographic',
}

/** Plain text of a V2 json body: a string, `{ms}`, `{text}`, or the text nodes of a rich document. Null when it holds none. */
export function bodyTextOf(raw: string | null): string | null {
  const t = text(raw)
  if (t === null) return null
  let v: unknown = t
  try {
    v = JSON.parse(t)
  } catch {
    return t
  }
  const parts: string[] = []
  const walk = (x: unknown, depth: number): void => {
    if (depth > 8 || x === null || x === undefined) return
    if (typeof x === 'string') parts.push(x)
    else if (Array.isArray(x)) for (const i of x) walk(i, depth + 1)
    else if (typeof x === 'object') {
      const o = x as Record<string, unknown>
      if (typeof o.ms === 'string') parts.push(o.ms)
      else if (typeof o.text === 'string') parts.push(o.text)
      else for (const k of Object.keys(o).sort()) if (k !== 'en' && k !== 'type' && k !== 'attrs') walk(o[k], depth + 1)
    }
  }
  walk(v, 0)
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim()
  return joined === '' ? null : joined
}

async function tablesHave(pool: pg.Pool, wanted: Record<string, readonly string[]>): Promise<boolean> {
  for (const [table, cols] of Object.entries(wanted)) {
    const res = await pool.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`, [ARCHIVE_SCHEMA, table])
    const have = new Set(res.rows.map((r) => r.column_name))
    if (!cols.every((c) => have.has(c))) return false
  }
  return true
}

export interface CanonicalSignals {
  stimuli: Map<string, StimulusSpec>
  links: CanonicalLink[]
  /** Canonical stimuli linked by two or more exam questions whose kind has no V3 kind (not grouped; counted). */
  unsupportedKinds: number
}

/** S1: legacy questions whose canonical projection shares a stimulus with another exam question. Empty when the canonical tables are not staged. */
export async function readCanonicalSignals(pool: pg.Pool): Promise<CanonicalSignals> {
  const empty: CanonicalSignals = { stimuli: new Map(), links: [], unsupportedKinds: 0 }
  const ok = await tablesHave(pool, {
    legacy_canonical_map: ['source', 'legacy_id', 'canonical_type', 'canonical_id'],
    question_stimulus: ['exam_question_id', 'stimulus_id', 'position'],
    stimuli: ['stimulus_kind_id', 'body', 'asset_id', 'caption'],
    media_assets: ['path'],
  })
  if (!ok) return empty
  const linked = await pool.query<{ legacy_id: string; stimulus_id: string; position: string | null; n: string }>(
    `SELECT DISTINCT ON (m.legacy_id) m.legacy_id::text AS legacy_id, qs.stimulus_id::text AS stimulus_id, qs.position::text AS position,
            (SELECT count(*) FROM ${A}."question_stimulus" q2 WHERE q2."stimulus_id" = qs."stimulus_id")::text AS n
       FROM ${A}."legacy_canonical_map" m JOIN ${A}."question_stimulus" qs ON qs."exam_question_id" = m."canonical_id"
      WHERE m."source" = 'questions' AND m."canonical_type" = 'exam_question' AND m."legacy_id" ~ '^[0-9]{1,18}$'
      ORDER BY m.legacy_id, qs."position", qs."id"`,
  )
  const multi = linked.rows.filter((r) => Number(r.n) >= 2)
  if (multi.length === 0) return empty
  const ids = [...new Set(multi.map((r) => r.stimulus_id))]
  const res = await pool.query<{ id: string; kind: string | null; body: string | null; caption: string | null; path: string | null }>(
    `SELECT s."id"::text AS id, k."slug" AS kind, s."body"::text AS body, s."caption" AS caption, ma."path" AS path
       FROM ${A}."stimuli" s LEFT JOIN ${S}."stimulus_kinds" k ON k."id" = s."stimulus_kind_id" LEFT JOIN ${A}."media_assets" ma ON ma."id" = s."asset_id"
      WHERE s."id" = ANY($1::bigint[])`,
    [ids],
  )
  const stimuli = new Map<string, StimulusSpec>()
  let unsupportedKinds = 0
  for (const r of res.rows) {
    const kind = KIND_MAP[enumKey(r.kind) ?? '']
    if (kind === undefined) {
      unsupportedKinds += 1
      continue
    }
    const caption = text(r.caption)
    stimuli.set(`s:${r.id}`, { key: `s:${r.id}`, kind, label: null, caption, bodyText: bodyTextOf(r.body), altText: caption, imagePath: text(r.path) })
  }
  return {
    stimuli,
    unsupportedKinds,
    links: multi.map((r) => ({ stimulusKey: `s:${r.stimulus_id}`, legacyId: r.legacy_id, position: r.position === null ? 0 : Number(r.position), examQuestionCount: Number(r.n) })),
  }
}

export interface BuiltPlan {
  plan: RajahPlan
  rows: number
  canonical: CanonicalSignals
}

/** The whole plan of the staged archive (read-only). */
export async function buildPlan(pool: pg.Pool, cur: Curriculum, pageSize: number): Promise<BuiltPlan> {
  const rows = await readRajahRows(pool, cur, pageSize)
  const canonical = await readCanonicalSignals(pool)
  const plan = planRajah({ rows, canonicalStimuli: canonical.stimuli, canonicalLinks: canonical.links })
  return { plan, rows: rows.length, canonical }
}
