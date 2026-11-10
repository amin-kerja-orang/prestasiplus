/**
 * Post-load of `migrate:questions --apply` (T-B9-8). Two steps, both idempotent, both after the last batch has committed:
 *
 *  1. the stimulus flag check. The loader writes `stimulus_flag` itself with the detector the Studio runs (`flagOfLoaded` ->
 *     `detectStimulusFlag`), for EVERY class (approved, draft, archived: the detector is a pure function of the content, so a question that is
 *     revived later is already flagged; only an approved live version is ever excluded, `NOT_FLAGGED_SQL`). This step re-runs the detector over
 *     the loaded versions and counts the differences: on a fresh load it must be 0 (check C-10, V-8), and `scripts/uat-ops/flag-stimulus.ts` then
 *     reports 0 changes on the approved live versions. `fix` writes the differences the way that script does (a "Bukan masalah" dismissal survives).
 *  2. the typed Kesukaran backfill, the U-OP-19 function itself (`least(5, difficulty_tp)` where `difficulty_level` is empty).
 */
import type pg from 'pg'

import { backfillDifficultyLevel } from '../../../../scripts/uat-ops/difficulty-level-backfill'
import { detectStimulusFlag, type FlagInput } from '../../../modules/questions/effective-leaf'

interface FlagRow {
  id: string
  stem_ms: string | null
  stem_en: string | null
  stimulus_flag: string | null
  stimulus_flag_ref: string | null
  has_group: boolean
  has_stem_stimulus: boolean
  parts: { leaf: boolean; prompt_ms: string | null; prompt_en: string | null; has_stimulus: boolean; opts_ms: (string | null)[]; opts_en: (string | null)[]; opt_img: boolean }[]
}

const SELECT = `
  SELECT v.id::text AS id, v.stem_ms, v.stem_en, v.stimulus_flag, v.stimulus_flag_ref, (q.group_id IS NOT NULL) AS has_group,
         EXISTS (SELECT 1 FROM question_version_stimuli s WHERE s.question_version_id = v.id) AS has_stem_stimulus,
         coalesce((SELECT json_agg(json_build_object(
              'leaf', p.mode IS NOT NULL, 'prompt_ms', p.prompt_ms, 'prompt_en', p.prompt_en, 'has_stimulus', p.stimulus_id IS NOT NULL,
              'opts_ms', (SELECT coalesce(json_agg(o.body_ms ORDER BY o.position), '[]'::json) FROM part_options o WHERE o.part_id = p.id),
              'opts_en', (SELECT coalesce(json_agg(o.body_en ORDER BY o.position), '[]'::json) FROM part_options o WHERE o.part_id = p.id),
              'opt_img', EXISTS (SELECT 1 FROM part_options o WHERE o.part_id = p.id AND o.image_file_id IS NOT NULL)) ORDER BY p.id)
            FROM question_parts p WHERE p.question_version_id = v.id), '[]'::json) AS parts
    FROM question_versions v JOIN questions q ON q.id = v.question_id
   WHERE q.legacy_source = $1 AND v.id > $2::bigint ORDER BY v.id LIMIT $3`

const inputOf = (r: FlagRow): FlagInput => ({
  stemMs: r.stem_ms,
  stemEn: r.stem_en,
  hasGroup: r.has_group,
  hasStemStimulus: r.has_stem_stimulus,
  parts: r.parts.map((p) => ({ isLeaf: p.leaf, promptMs: p.prompt_ms, promptEn: p.prompt_en, optionTexts: [...p.opts_ms, ...p.opts_en], hasStimulus: p.has_stimulus, hasOptionImage: p.opt_img })),
})

export interface FlagCheck {
  seen: number
  /** Versions whose stored flag differs from the detector's verdict. */
  changed: number
  /** Open flags found by the detector, by flag. */
  byFlag: Record<string, number>
}

/** Re-runs the detector over the versions of `source`; with `fix`, writes the differences. */
export async function reconcileFlags(pool: pg.Pool, source: string, options: { fix: boolean; batch?: number }): Promise<FlagCheck> {
  const batch = options.batch ?? 2000
  const out: FlagCheck = { seen: 0, changed: 0, byFlag: {} }
  let after = '0'
  for (;;) {
    const res = await pool.query<FlagRow>(SELECT, [source, after, batch])
    if (res.rows.length === 0) break
    after = (res.rows[res.rows.length - 1] as FlagRow).id
    for (const r of res.rows) {
      out.seen += 1
      const found = detectStimulusFlag(inputOf(r))
      const flag = found?.flag ?? null
      const ref = found?.ref ?? null
      if (flag !== null) out.byFlag[flag] = (out.byFlag[flag] ?? 0) + 1
      if (flag === r.stimulus_flag && ref === r.stimulus_flag_ref) continue
      out.changed += 1
      if (!options.fix) continue
      if (flag !== null && flag === r.stimulus_flag) await pool.query(`UPDATE question_versions SET stimulus_flag_ref = $2 WHERE id = $1::bigint`, [r.id, ref])
      else {
        await pool.query(
          `UPDATE question_versions SET stimulus_flag = $2, stimulus_flag_ref = $3, stimulus_flag_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END,
                  flag_dismissed_at = NULL, flag_dismissed_by = NULL WHERE id = $1::bigint`,
          [r.id, flag, ref],
        )
      }
    }
  }
  return out
}

export interface PostLoadResult {
  flags: FlagCheck
  difficultyWritten: number
}

export async function runPostLoad(pool: pg.Pool, source: string, out?: (line: string) => void): Promise<PostLoadResult> {
  const flags = await reconcileFlags(pool, source, { fix: true })
  out?.(`post-load flags: ${flags.seen} versions checked, ${flags.changed} corrected (0 expected: the loader writes the flag itself), open ${JSON.stringify(flags.byFlag)}`)
  const diff = await backfillDifficultyLevel(pool, { dryRun: false })
  out?.(`post-load difficulty_level: ${diff.rows} version(s) written`)
  return { flags, difficultyWritten: diff.rows }
}
