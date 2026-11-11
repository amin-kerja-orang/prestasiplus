/**
 * Rajah completeness versus V2 (review item G-5, core DSKP rule: a question with a rajah must show it). Every V2 `exam_questions` row that V2 links
 * to a stimulus (`question_stimulus`, or a part's `stimulus_id`) and that was loaded must show a stimulus in V3: a group (shared stimulus) or an own
 * stimulus (`question_version_stimuli`, or a part's `stimulus_id`). Any miss is a mismatch.
 *
 * `readCanonicalFindings` only compares questions whose V2 stimulus reached the id map, so a stimulus that was never loaded would hide there; this
 * check starts from the V2 links instead. A question whose every V2 stimulus is empty by the loader's own rule (no text, no caption, no picture:
 * nothing to show) is not a miss; it is counted apart. Aggregates and ids only: no question text.
 */
import type pg from 'pg'

import type { LegacySource } from '../kit/types'
import { stimulusText } from '../load/questions/canonical-stimuli'
import { text } from '../transform/common'
import { capped } from './check-kit'

export interface StimulusLinkFindings {
  /** Loaded V2 questions that have at least one V2 stimulus link. */
  questions: number
  /** V2 questions with a link that were not loaded (rejected or not migrated): reported, compared by the reject checks. */
  notLoaded: number
  /** Loaded questions with a link whose every V2 stimulus is empty (nothing to show). */
  emptyStimulus: number
  /** Loaded questions with a non-empty V2 stimulus that show no group and no own stimulus (V2 ids). */
  missing: string[]
}

export const stimulusLinkTotal = (f: StimulusLinkFindings): number => f.missing.length

export const stimulusLinkDetail = (f: StimulusLinkFindings): string =>
  `${f.questions} loaded V2 questions with a stimulus link: ${f.missing.length} show no group and no own stimulus` +
  `${f.missing.length > 0 ? ` (V2 ids ${capped(f.missing)})` : ''}; ${f.emptyStimulus} link only empty stimuli; ${f.notLoaded} linked questions are not loaded`

interface StimulusBody {
  body: string | null
  caption: string | null
  path: string | null
}

/** The loader's rule (`ensureStimuli`): a stimulus with no text, no caption and no picture is not created. */
export const isEmptyStimulus = (s: StimulusBody): boolean => stimulusText(s.body) === null && text(s.caption) === null && text(s.path) === null

export async function readStimulusLinkFindings(pool: pg.Pool, source: LegacySource): Promise<StimulusLinkFindings> {
  const res = await pool.query<{ eq: string; loaded: boolean; shown: boolean; sid: string; body: string | null; caption: string | null; path: string | null }>(
    `WITH v2links AS (
        SELECT DISTINCT u.exam_question_id AS eq, u.stimulus_id AS sid FROM (
          SELECT exam_question_id, stimulus_id FROM archive_cloud.question_stimulus
          UNION ALL SELECT exam_question_id, stimulus_id FROM archive_cloud.question_parts WHERE stimulus_id IS NOT NULL) u),
      per AS (SELECT l.eq, l.sid, m.new_id::bigint AS qid FROM v2links l
                LEFT JOIN etl_id_map m ON m.legacy_source = $1 AND m.entity = 'exam_questions' AND m.legacy_id = l.eq::text)
      SELECT p.eq::text AS eq, (p.qid IS NOT NULL AND q.id IS NOT NULL) AS loaded,
             (q.group_id IS NOT NULL
              OR EXISTS (SELECT 1 FROM question_versions v JOIN question_version_stimuli s ON s.question_version_id = v.id WHERE v.question_id = q.id)
              OR EXISTS (SELECT 1 FROM question_versions v JOIN question_parts pt ON pt.question_version_id = v.id WHERE v.question_id = q.id AND pt.stimulus_id IS NOT NULL)) AS shown,
             p.sid::text AS sid, st.body::text AS body, st.caption::text AS caption, ma.path::text AS path
        FROM per p LEFT JOIN questions q ON q.id = p.qid
        LEFT JOIN archive_cloud.stimuli st ON st.id = p.sid LEFT JOIN archive_cloud.media_assets ma ON ma.id = st.asset_id
       ORDER BY p.eq, p.sid`,
    [source],
  )
  const by = new Map<string, { loaded: boolean; shown: boolean; empties: boolean[] }>()
  for (const r of res.rows) {
    const e = by.get(r.eq) ?? { loaded: r.loaded, shown: r.shown, empties: [] }
    e.empties.push(isEmptyStimulus(r))
    by.set(r.eq, e)
  }
  const out: StimulusLinkFindings = { questions: 0, notLoaded: 0, emptyStimulus: 0, missing: [] }
  for (const [eq, e] of by) {
    if (!e.loaded) out.notLoaded += 1
    else {
      out.questions += 1
      if (e.shown) continue
      if (e.empties.every(Boolean)) out.emptyStimulus += 1
      else out.missing.push(eq)
    }
  }
  return out
}
