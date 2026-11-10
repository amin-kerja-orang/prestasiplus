/**
 * Picture pass of `migrate:questions` (T-B9-5, design section 8): copies the V2 question pictures named by `archive_cloud.questions.image_path`
 * (the question's own picture, a rajah owner, or a carrier row that became a stimulus) through `MigrationFiles` (manifest, checksum, magic bytes,
 * sanitising, `files` row with a `public_id` so the picture is served by token), then
 *   1. sets `stimuli.asset_file_id` on every stimulus that shows the path: the planned stimuli (carrier, owner, shared image) and the own
 *      stem stimulus or group stimulus of every question held for that path;
 *   2. removes the question's `legacy_image_unresolved` entry for the path and re-activates the question when no other hold remains.
 * A group is held as a whole and released as a whole: every member carries the same entry and the same stimulus.
 *
 * A picture that cannot be used (cause `path`, `unlisted`, `missing`, `unsafe`, `size`, `checksum`, `type`) never drops a question: it stays held
 * with its path and is counted by cause (`QuestionsContext.fileFailures`, `files-missing-<run>.csv`). The pass is the resume path too: it reads
 * the archive paths and the held state, so a re-run after new files arrived repairs exactly the held rows, and a second run changes nothing.
 * Option pictures: V2 has none (`question_options.image_path` is NULL on every row of the full dump), so there is no option step.
 */
import { createHash } from 'node:crypto'

import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import type { MigrationFiles } from '../activity/files'
import type { QuestionsContext } from './context'

const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

interface PathUnit {
  /** Resume key: a digest of the path (a path is not written to the run tables). */
  key: string
  path: string
  /** Lowest V2 question id that carries the path: the stable legacy id of the `files` row. */
  firstId: string
  /** How many V2 question rows carry the path. */
  count: number
  /** The V2 table and column the path is read from (the key of the `files` row). */
  table: string
  column: string
}

/** ETL-only cap for question pictures: V2 diagrams exceed the 2 MB upload rule (design 8.2, OC-5). */
export const QUESTION_IMAGE_ETL_CAP = 8 * 1024 * 1024

/** `files-missing-<run>.csv`: V2 path, fixed cause word, count of V2 question rows (no text, no row content). */
export function filesMissingCsv(list: readonly { path: string; cause: string; questions: number }[]): string {
  const clean = (v: string): string => v.replace(/[,\r\n]/g, '_')
  return ['v2_path,cause,v2_question_rows', ...list.map((f) => [clean(f.path), f.cause, String(f.questions)].join(','))].join('\n') + '\n'
}

const HELD =(pathParam: string): string =>
  `jsonb_build_array(jsonb_build_object('code', 'legacy_image_unresolved', 'target', 'question', 'path', ${pathParam}::text))`

export function filesStep(q: QuestionsContext, files: MigrationFiles): AnyEntityStep {
  const entity = 'question_files'
  let list: PathUnit[] | null = null
  const load = async (): Promise<PathUnit[]> => {
    if (list === null) {
      const res = await q.pool.query<{ path: string; first_id: string; n: number }>(
        `SELECT image_path AS path, min(id)::text AS first_id, count(*)::int AS n
           FROM archive_cloud.questions WHERE image_path IS NOT NULL AND btrim(image_path) <> '' GROUP BY image_path`,
      )
      // The pictures of the canonical stimuli (media_assets behind `stimuli.asset_id`, T-B9-7): the questions that show them were loaded held with
      // the same `legacy_image_unresolved` path (canonical-stimuli.ts), so the held pass below releases them. A path that a question row also
      // names is one unit (the file is the same).
      const hasMedia = (await q.pool.query<{ ok: boolean }>(`SELECT to_regclass('archive_cloud.media_assets') IS NOT NULL AND to_regclass('archive_cloud.stimuli') IS NOT NULL AS ok`)).rows[0]?.ok === true
      const media = !hasMedia ? { rows: [] as { path: string; first_id: string; n: number }[] } : await q.pool.query<{ path: string; first_id: string; n: number }>(
        `SELECT ma.path AS path, min(ma.id)::text AS first_id, count(DISTINCT s.id)::int AS n
           FROM archive_cloud.media_assets ma JOIN archive_cloud.stimuli s ON s.asset_id = ma.id
          WHERE ma.path IS NOT NULL AND btrim(ma.path) <> '' GROUP BY ma.path`,
      )
      const have = new Set(res.rows.map((r) => r.path))
      const units = [...res.rows.map((r) => ({ path: r.path, firstId: r.first_id, count: r.n, table: 'questions', column: 'image_path' })), ...media.rows.filter((r) => !have.has(r.path)).map((r) => ({ path: r.path, firstId: r.first_id, count: r.n, table: 'media_assets', column: 'path' }))]
      list = units.map((r) => ({ key: createHash('sha256').update(r.path).digest('hex').slice(0, 24), path: r.path, firstId: r.firstId, count: r.count, table: r.table, column: r.column })).sort((a, b) => byKey(a.key, b.key))
    }
    return list
  }
  return {
    entity,
    source: q.source,
    extract: async function* (after: string | null) {
      for (const u of await load()) if (after === null || byKey(u.key, after) > 0) yield u
    },
    keyOf: (u: PathUnit) => u.key,
    async load(rows: PathUnit[], ctx: BatchContext): Promise<BatchResult> {
      const { plan } = await q.plan()
      let copied = 0
      let unchanged = 0
      for (const u of rows) {
        const out = await files.migrate(ctx, { table: u.table, column: u.column, legacyId: u.firstId, rawPath: u.path, purpose: 'question_image' })
        if (!out.ok) {
          q.fileFailures.push({ path: u.path, cause: out.cause, questions: u.count })
          q.notes.count(`files.cause.${out.cause}`)
          unchanged += 1
          continue
        }
        q.notes.count(`files.${out.outcome}`)
        if (out.outcome === 'copied') copied += 1
        else unchanged += 1
        if (out.fileId === null) continue // dry-run: verified, nothing written

        // 1. the planned stimuli that show this path (carrier, owner, shared image)
        const planned: string[] = []
        for (const s of plan.stimuli.values()) {
          if (s.imagePath !== u.path) continue
          const id = await ctx.idMap.resolve('question_stimuli', s.key)
          if (id !== null) planned.push(id)
        }
        if (planned.length > 0) {
          await ctx.db.query(`UPDATE stimuli SET asset_file_id = $2::bigint, updated_at = now() WHERE id = ANY($1::bigint[]) AND asset_file_id IS NULL`, [planned, out.fileId])
        }
        // 2. the held questions of this path: their own stem stimulus or their group stimulus take the file, then the hold is lifted
        const held = await ctx.db.query<{ question_id: string }>(
          `SELECT v.question_id::text AS question_id FROM question_versions v
            WHERE v.version_no = 1 AND v.import_issues @> ${HELD('$1')}`,
          [u.path],
        )
        const ids = held.rows.map((r) => r.question_id)
        if (ids.length === 0) continue
        await ctx.db.query(
          `UPDATE stimuli s SET asset_file_id = $2::bigint, updated_at = now()
            WHERE s.asset_file_id IS NULL AND s.id IN (
              SELECT qvs.stimulus_id FROM question_version_stimuli qvs JOIN question_versions v ON v.id = qvs.question_version_id
               WHERE v.version_no = 1 AND v.question_id = ANY($1::bigint[])
              UNION
              SELECT gs.stimulus_id FROM stimulus_group_stimuli gs JOIN questions qq ON qq.group_id = gs.group_id WHERE qq.id = ANY($1::bigint[]))`,
          [ids, out.fileId],
        )
        await ctx.db.query(
          `UPDATE question_versions v SET import_issues = NULLIF(coalesce((
               SELECT jsonb_agg(i) FROM jsonb_array_elements(v.import_issues) i
                WHERE NOT (i->>'code' = 'legacy_image_unresolved' AND i->>'target' = 'question' AND i->>'path' = $2)), '[]'::jsonb), '[]'::jsonb)
            WHERE v.version_no = 1 AND v.question_id = ANY($1::bigint[])`,
          [ids, u.path],
        )
        // Re-activate when no hold remains (a question that is also held for markup, personal data or another picture stays inactive).
        await ctx.db.query(
          `UPDATE questions qq SET is_active = true
            WHERE qq.id = ANY($1::bigint[]) AND NOT EXISTS (
              SELECT 1 FROM question_versions v, jsonb_array_elements(coalesce(v.import_issues, '[]'::jsonb)) i
               WHERE v.question_id = qq.id AND v.version_no = 1
                 AND i->>'code' IN ('legacy_image_unresolved', 'html_image', 'html_math', 'html_residual', 'pii_suspect'))`,
          [ids],
        )
        q.notes.count('files.questions_released', ids.length)
      }
      return { inserted: copied, unchanged }
    },
  }
}
