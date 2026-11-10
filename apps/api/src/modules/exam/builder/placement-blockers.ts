/**
 * M2: the ONE rule for "may this question be put on a NEW paper" beyond status and subject. It reads `unservableReasonsOf` (questions repository, the
 * draw's own SQL macros, D91): this file only maps its answer to a refusal code, it holds no predicate of its own.
 *
 * A plain function over a database handle (a Prisma client or the open transaction client), no Nest DI, so the builder, the paper repository and the
 * `migrate:papers` recompute all call it. It reads the LIVE version of each question and answers per id:
 *
 * - `held`, `media_unresolved`  a picture that cannot be shown (the `legacy_image_unresolved` import hold, or an unresolved stimulus / option picture).
 *                               Always refused for a new placement.
 * - `inactive`, `taken_down`, `flagged`  a withdrawn question, a taken-down source, an open `stimulus_missing` / `figure_only` flag. Refused unless a
 *                               published paper already pins the question (decision 56).
 *
 * KP-15: this is for NEW placements and new papers only. A paper that already holds such a question keeps it (a published paper is a fixed set): the
 * pupil sees a placeholder instead of the picture, see `be09-practice-question-source` and the Bijak bridge.
 *
 * A question this function does not find (no row, or no live version) is not answered: the callers' own status checks decide that.
 */
import { unservableReasonsOf, type UnservableDb } from '../../questions/questions.repository'

export type PlacementBlockCode = 'held' | 'media_unresolved' | 'inactive' | 'taken_down' | 'flagged'

/** Phrases that complete "Soalan N tidak boleh diletakkan dalam kertas: ...". */
export const PLACEMENT_BLOCK_TEXT: Readonly<Record<PlacementBlockCode, string>> = {
  held: 'gambar belum diselesaikan (import)',
  media_unresolved: 'gambar atau rangsangan belum lengkap',
  inactive: 'soalan tidak aktif',
  taken_down: 'sumber soalan telah ditarik balik',
  flagged: 'rangsangan soalan bertanda belum disemak',
}

/** Question id -> why it cannot be placed on a new paper. Ids with no blocker are absent from the map. */
export async function placementBlockers(db: UnservableDb, ids: readonly string[]): Promise<Map<string, PlacementBlockCode>> {
  const out = new Map<string, PlacementBlockCode>()
  for (const [id, r] of await unservableReasonsOf(db, ids)) {
    const code: PlacementBlockCode | null = r.held
      ? 'held'
      : r.mediaUnresolved
        ? 'media_unresolved'
        : r.pinned
          ? null
          : r.inactive
            ? 'inactive'
            : r.takenDown
              ? 'taken_down'
              : r.flagged
                ? 'flagged'
                : null
    if (code !== null) out.set(id, code)
  }
  return out
}

/**
 * KP-15: who is asking. `'new'` = a NEW placement or a NEW paper (addPlacement, replace-placements, import, the Terbit gate): the blockers REFUSE.
 * `'fixedSet'` = a set a person already chose (a V2-published paper recompute, group_split completion, `publishLegacyV2`, a teacher's mission, an assigned
 * remedial test, a question set): nothing is refused; the held and unresolved-picture questions are only REPORTED, so the caller places them and the pupil is shown the placeholder.
 */
export type PlacementMode = 'new' | 'fixedSet'

export interface PlacementVerdict {
  /** Questions that must not be placed (mode `'new'`; always empty for `'fixedSet'`). */
  refused: Map<string, PlacementBlockCode>
  /** Questions to place but show with a placeholder: a held or unresolved picture (mode `'fixedSet'`; empty for `'new'`). */
  placeholder: Map<string, 'held' | 'media_unresolved'>
}

/** The ONE shared servability entry point of the placement rule, with the explicit mode. A plain function over a database handle (no Nest DI). */
export async function placementVerdict(db: UnservableDb, ids: readonly string[], mode: PlacementMode): Promise<PlacementVerdict> {
  const blocked = await placementBlockers(db, ids)
  if (mode === 'new') return { refused: blocked, placeholder: new Map() }
  const placeholder = new Map<string, 'held' | 'media_unresolved'>()
  for (const [id, code] of blocked) if (code === 'held' || code === 'media_unresolved') placeholder.set(id, code)
  return { refused: new Map(), placeholder }
}
