/**
 * `migrate:repair-stimuli` (feature slug `etl-stimulus-inline-img`): repairs the `stimuli` rows that an earlier `migrate:questions` left with V2 HTML as
 * text, in place, without re-running the migration. A row is a candidate while its `body_ms` / `body_en` still holds `<img src="/storage/stimuli/..">`
 * or a raw `<table`. It uses the same rule as the loader (`planInlineMedia`, stimulus-html.ts) and the same file path (`MigrationFiles`, purpose
 * `question_image`, manifest, checksum, magic bytes, sanitising, `files` row with a `public_id`):
 *
 *  - the row keeps the first picture (`asset_file_id`, kind image) or table (`table_data`, kind table) and loses the markup; the text, a second picture
 *    or a second table become extra stimuli, linked after it at the next free position of every version (at most 3), group (at most 3) that shows the row;
 *  - a part link (`question_parts.stimulus_id`) holds one stimulus only, so a question that shows the row there is held when the row has extras;
 *  - a body that cannot be used (picture not usable, other image source, unreadable table, markup that is left) is rejected with a fixed cause and its
 *    questions are held with `legacy_image_unresolved` (path = the picture, or `inline:<cause>`), exactly like the picture pass; a later run with the file
 *    present releases them again (the hold of the path is lifted, the question is re-activated when no other hold remains);
 *  - the run is a kit run (`etl_runs`, `etl_rejects`): a dry-run is ONE transaction that is rolled back (nothing written, no file copied), `--apply`
 *    needs a passing dry-run on the same input. A repaired row no longer matches, so a second run changes nothing.
 * Counts only: no text, no path, no name.
 */
import { createHash } from 'node:crypto'

import type pg from 'pg'

import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import type { MigrationFiles } from '../activity/files'
import { CoreNotes } from '../context'
import { hold, inlineHoldPath, SLOT_HOLD_PATH } from './canonical-stimuli'
import { liftHold, QUESTION_IMAGE_ETL_CAP } from './files-step'
import { hasInlineMedia, planInlineMedia, type MediaCause, type StimulusPiece } from './stimulus-html'
import { allocIds } from './steps'

export { QUESTION_IMAGE_ETL_CAP }

export const REPAIR_ENTITY = 'stimulus_repairs'
/** Bump when a rule of the repair changes what a run writes (part of the input hash). */
export const REPAIR_RULES_VERSION = 'repair-stimuli-1'
const MAX_SLOTS = 3
const CAUSES: readonly MediaCause[] = ['other_img', 'path', 'table', 'markup', 'bilingual']
const MARKUP_SQL = `~* '<(img|table)[ >/]'`

interface Candidate {
  id: string
  kind: string
  body_ms: string | null
  body_en: string | null
  asset: string | null
}

export interface RepairContext {
  pool: pg.Pool
  files: MigrationFiles
  notes: CoreNotes
}

/** The ids of the stimuli the repair would touch, in order, and the digest of what they hold (the input hash of the run). */
export async function candidatesDigest(pool: Pick<pg.Pool, 'query'>): Promise<{ count: number; digest: string }> {
  const rows = await readCandidates(pool, 0, 1_000_000)
  const h = createHash('sha256')
  for (const r of rows) h.update(`${r.id}:${createHash('sha256').update(`${r.body_ms ?? ''}\u0000${r.body_en ?? ''}`).digest('hex')}\n`)
  return { count: rows.length, digest: h.digest('hex') }
}

async function readCandidates(pool: Pick<pg.Pool, 'query'>, after: number, limit: number): Promise<Candidate[]> {
  const res = await pool.query<Candidate>(
    `SELECT s.id::text AS id, s.kind, s.body_ms, s.body_en, s.asset_file_id::text AS asset FROM stimuli s
      WHERE s.id > $1::bigint AND (s.body_ms ILIKE '%<table%' OR s.body_en ILIKE '%<table%' OR s.body_ms ILIKE '%<img%/storage/stimuli/%' OR s.body_en ILIKE '%<img%/storage/stimuli/%')
      ORDER BY s.id LIMIT $2`,
    [after, limit],
  )
  return res.rows.filter((r) => hasInlineMedia(r.body_ms) || hasInlineMedia(r.body_en))
}

export function repairStimuliStep(rc: RepairContext): AnyEntityStep {
  /** One copy per picture path in the run (two stimuli may show the same file). */
  const copied = new Map<string, { ok: true; fileId: string | null } | { ok: false; cause: string }>()
  return {
    entity: REPAIR_ENTITY,
    source: 'cloud',
    extract: async function* (after: string | null) {
      let last = after === null ? 0 : Number(after)
      for (;;) {
        const page = await readCandidates(rc.pool, last, 500)
        if (page.length === 0) return
        for (const r of page) yield r
        last = Number(page[page.length - 1]?.id)
      }
    },
    keyOf: (r: Candidate) => r.id,
    async load(rows: Candidate[], ctx: BatchContext): Promise<BatchResult> {
      let fixed = 0
      for (const r of rows) {
        if (await repairOne(rc, ctx, r, copied)) fixed += 1
      }
      return { updated: fixed, unchanged: 0 }
    },
  }
}

async function affectedQuestions(ctx: BatchContext, stimulusId: string): Promise<string[]> {
  const res = await ctx.db.query<{ id: string }>(
    `SELECT v.question_id::text AS id FROM question_version_stimuli vs JOIN question_versions v ON v.id = vs.question_version_id WHERE vs.stimulus_id = $1::bigint
     UNION SELECT v.question_id::text FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id WHERE p.stimulus_id = $1::bigint
     UNION SELECT q.id::text FROM stimulus_group_stimuli gs JOIN questions q ON q.group_id = gs.group_id WHERE gs.stimulus_id = $1::bigint`,
    [stimulusId],
  )
  return res.rows.map((x) => x.id)
}

/** Rejects the stimulus with `cause` and holds its questions on `path` (the picture, or `inline:<cause>`). */
async function fail(rc: RepairContext, ctx: BatchContext, r: Candidate, cause: string, path: string): Promise<false> {
  ctx.rejects.add({ entity: REPAIR_ENTITY, legacyId: r.id, reason: 'INVALID_VALUE', column: 'stimuli.body', enumValue: cause })
  rc.notes.count(`failed.${cause}`)
  const ids = await affectedQuestions(ctx, r.id)
  if (ids.length > 0) {
    const before = await activeCount(ctx, ids)
    await hold(ctx, ids, path)
    rc.notes.count('questions.held', before - (await activeCount(ctx, ids)))
  }
  return false
}

const activeCount = async (ctx: BatchContext, ids: readonly string[]): Promise<number> =>
  Number((await ctx.db.query<{ n: string }>(`SELECT count(*)::text AS n FROM questions WHERE id = ANY($1::bigint[]) AND is_active`, [ids])).rows[0]?.n)

async function legacyKey(ctx: BatchContext, v3: string, index: number): Promise<{ column: string; legacyId: string }> {
  // The V2 stimulus id when the id map has it (the same key a fresh `migrate:questions` run gives the file), else the V3 id under its own column.
  const m = await ctx.db.query<{ legacy_id: string }>(`SELECT legacy_id FROM etl_id_map WHERE legacy_source = 'cloud' AND entity = 'canonical_stimuli' AND new_id = $1::text LIMIT 1`, [v3])
  const suffix = index === 0 ? '' : `.${index + 1}`
  const v2 = m.rows[0]?.legacy_id
  return v2 !== undefined && /^[0-9]{1,18}$/.test(v2) ? { column: `body${suffix}`, legacyId: v2 } : { column: `body_ms${suffix}`, legacyId: v3 }
}

async function repairOne(rc: RepairContext, ctx: BatchContext, r: Candidate, copied: Map<string, { ok: true; fileId: string | null } | { ok: false; cause: string }>): Promise<boolean> {
  const plan = planInlineMedia({ kind: r.kind, ms: r.body_ms, en: r.body_en, hasAsset: r.asset !== null })
  if (plan === null) return false
  if (!plan.ok) return fail(rc, ctx, r, plan.cause, inlineHoldPath(plan.cause))
  const pieces = [plan.primary, ...plan.extras]

  // 1. the pictures, through MigrationFiles (a copy per path and run)
  const fileOf = new Map<string, string | null>()
  for (const p of pieces) {
    if (p.image === null) continue
    let got = copied.get(p.image.path)
    if (got === undefined) {
      const key = await legacyKey(ctx, r.id, p.image.index)
      const out = await rc.files.migrate(ctx, { table: 'stimuli', column: key.column, legacyId: key.legacyId, rawPath: p.image.path, purpose: 'question_image' })
      got = out.ok ? { ok: true, fileId: out.fileId } : { ok: false, cause: out.cause }
      copied.set(p.image.path, got)
      rc.notes.count(out.ok ? `files.${out.outcome}` : `files.cause.${out.cause}`)
    }
    if (!got.ok) return fail(rc, ctx, r, got.cause, p.image.path)
    fileOf.set(p.image.path, got.fileId)
  }
  const assetOf = (p: StimulusPiece): string | null => (p.image === null ? null : (fileOf.get(p.image.path) ?? null))

  // 2. the row keeps the first picture or table
  const prim = plan.primary
  await ctx.db.query(
    `UPDATE stimuli SET kind = $2, body_ms = $3, body_en = $4, table_data = $5::jsonb, asset_file_id = coalesce($6::bigint, asset_file_id),
            alt_text = coalesce(alt_text, $7), updated_at = now() WHERE id = $1::bigint`,
    [r.id, prim.kind, prim.bodyMs, prim.bodyEn, prim.tableData === null ? null : JSON.stringify(prim.tableData), assetOf(prim), prim.altText],
  )
  rc.notes.count(prim.kind === 'table' ? 'fixed.table' : prim.image !== null ? 'fixed.image' : 'fixed.text_kept')
  if (plan.extras.length > 0) rc.notes.count('fixed.with_extras')

  // 3. the extra stimuli, linked after the row wherever it is shown
  if (plan.extras.length > 0) {
    const ids = await allocIds(ctx.db, 'stimuli', plan.extras.length)
    await ctx.db.query(
      `INSERT INTO stimuli (id, kind, body_ms, body_en, alt_text, table_data, asset_file_id, reusable) OVERRIDING SYSTEM VALUE
       SELECT x.id, x.kind, x.body_ms, x.body_en, x.alt_text, x.table_data, x.asset_file_id, true
         FROM jsonb_to_recordset($1::jsonb) AS x(id bigint, kind text, body_ms text, body_en text, alt_text text, table_data jsonb, asset_file_id bigint)`,
      [JSON.stringify(plan.extras.map((p, i) => ({ id: ids[i], kind: p.kind, body_ms: p.bodyMs, body_en: p.bodyEn, alt_text: p.altText, table_data: p.tableData, asset_file_id: assetOf(p) })))],
    )
    rc.notes.count('stimuli.extras_created', plan.extras.length)
    const noRoom = new Set<string>()
    const versions = await ctx.db.query<{ v: string; q: string; m: number }>(
      `SELECT vs.question_version_id::text AS v, v.question_id::text AS q, (SELECT max(x.position) FROM question_version_stimuli x WHERE x.question_version_id = vs.question_version_id)::int AS m
         FROM question_version_stimuli vs JOIN question_versions v ON v.id = vs.question_version_id WHERE vs.stimulus_id = $1::bigint`,
      [r.id],
    )
    for (const l of versions.rows) {
      for (const [i, id] of ids.entries()) {
        if (l.m + i + 1 > MAX_SLOTS) noRoom.add(l.q)
        else await ctx.db.query(`INSERT INTO question_version_stimuli (question_version_id, stimulus_id, position) VALUES ($1::bigint, $2::bigint, $3::smallint)`, [l.v, id, l.m + i + 1])
      }
    }
    const groups = await ctx.db.query<{ g: string; m: number }>(
      `SELECT gs.group_id::text AS g, (SELECT max(x.position) FROM stimulus_group_stimuli x WHERE x.group_id = gs.group_id)::int AS m FROM stimulus_group_stimuli gs WHERE gs.stimulus_id = $1::bigint`,
      [r.id],
    )
    for (const l of groups.rows) {
      for (const [i, id] of ids.entries()) {
        if (l.m + i + 1 > MAX_SLOTS) {
          for (const q of (await ctx.db.query<{ id: string }>(`SELECT id::text AS id FROM questions WHERE group_id = $1::bigint`, [l.g])).rows) noRoom.add(q.id)
        } else await ctx.db.query(`INSERT INTO stimulus_group_stimuli (group_id, stimulus_id, position) VALUES ($1::bigint, $2::bigint, $3::smallint)`, [l.g, id, l.m + i + 1])
      }
    }
    // A part holds one stimulus only: its extras cannot be shown there.
    for (const q of (await ctx.db.query<{ id: string }>(`SELECT v.question_id::text AS id FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id WHERE p.stimulus_id = $1::bigint`, [r.id])).rows) noRoom.add(q.id)
    if (noRoom.size > 0) {
      const list = [...noRoom]
      const before = await activeCount(ctx, list)
      await hold(ctx, list, SLOT_HOLD_PATH)
      rc.notes.count('questions.held', before - (await activeCount(ctx, list)))
      rc.notes.count('failed.no_slot_questions', list.length)
    }
  }

  // 4. release: the holds of this row's pictures, and the `inline:*` holds of a question that has no unrepaired markup left
  const affected = await affectedQuestions(ctx, r.id)
  rc.notes.count('questions.affected', affected.length)
  if (affected.length > 0) {
    const before = await ctx.db.query<{ id: string }>(`SELECT id::text AS id FROM questions WHERE id = ANY($1::bigint[]) AND NOT is_active`, [affected])
    const heldWith = async (ids: readonly string[], path: string): Promise<string[]> =>
      (await ctx.db.query<{ id: string }>(
        `SELECT v.question_id::text AS id FROM question_versions v, jsonb_array_elements(CASE WHEN jsonb_typeof(v.import_issues) = 'array' THEN v.import_issues ELSE '[]'::jsonb END) i
          WHERE v.version_no = 1 AND v.question_id = ANY($1::bigint[]) AND i->>'code' = 'legacy_image_unresolved' AND i->>'target' = 'question' AND i->>'path' = $2`,
        [ids, path],
      )).rows.map((x) => x.id)
    for (const path of new Set(pieces.flatMap((p) => (p.image === null ? [] : [p.image.path])))) {
      const ids = await heldWith(affected, path)
      if (ids.length > 0) await liftHold(ctx.db, ids, path)
    }
    const clean = (await ctx.db.query<{ id: string }>(
      `SELECT q.id::text AS id FROM questions q WHERE q.id = ANY($1::bigint[]) AND NOT EXISTS (
         SELECT 1 FROM stimuli s WHERE (s.body_ms ${MARKUP_SQL} OR s.body_en ${MARKUP_SQL}) AND s.id IN (
           SELECT vs.stimulus_id FROM question_version_stimuli vs JOIN question_versions v ON v.id = vs.question_version_id WHERE v.question_id = q.id
           UNION SELECT p.stimulus_id FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id WHERE v.question_id = q.id AND p.stimulus_id IS NOT NULL
           UNION SELECT gs.stimulus_id FROM stimulus_group_stimuli gs WHERE gs.group_id = q.group_id))`,
      [affected],
    )).rows.map((x) => x.id)
    for (const cause of CAUSES) {
      const ids = await heldWith(clean, inlineHoldPath(cause))
      if (ids.length > 0) await liftHold(ctx.db, ids, inlineHoldPath(cause))
    }
    const now = await ctx.db.query<{ id: string }>(`SELECT id::text AS id FROM questions WHERE id = ANY($1::bigint[]) AND is_active`, [before.rows.map((x) => x.id)])
    rc.notes.count('questions.released', now.rows.length)
  }
  return true
}
