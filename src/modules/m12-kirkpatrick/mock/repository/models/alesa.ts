/**
 * The ALESA list of a scope (SRS M12 v1.6 BR-M12-22, FN-M12-6.7.2-6.7.4).
 *
 * - platform scope: the 50 stored rows; the school `8080`: its 50 stored rows;
 * - any other school: generated from its active students (at most 50, `observed: false`; the choice of the 50 is
 *   a deterministic hash order, INFERRED);
 * - a stored row names its student by `rank` + `schoolId`: the accuracy of the row at `rank` of the scope's
 *   prediction table gives the accuracy group, and the student is the not yet used student of that school in
 *   the group (user id ascending); with none in the group, the school's unused student nearest to `rank`
 *   (the 26-Sep ranks of the top-up differ slightly from the 25-Sep model, e.g. school 8880's one row). That
 *   keeps the observed school of every row whatever the (unobservable) tie order of the table is.
 * - rows are ordered by grade (best first), then user id ascending (observed); tiles and footer are computed
 *   from the listed rows: Lulus A+ ... D, Gagal E + G, Intervensi D + E.
 */

import type { AlesaRow, SpmGrade } from '../../../api/types'
import { SPM_GRADES } from '../../data/rules-data'
import { bandOfGrade, isFail, isPass, needsIntervention } from '../rules'
import { alesaRepo } from '../alesa'
import type { Scope } from '../scope'
import type { PredictionRow } from './predictions'

export interface AlesaList {
  lulus: number
  gagal: number
  intervensi: number
  rows: AlesaRow[]
}

const MAX_ROWS = 50
const gradeIndex = (g: string): number => SPM_GRADES.indexOf(g as SpmGrade)

const hashOf = (userId: number): number => Math.imul(userId ^ 0x85ebca6b, 2246822519) >>> 0

function confidenceOf(answers: number): AlesaRow['confidence'] {
  if (answers >= 150) return 'tinggi'
  if (answers >= 30) return 'sederhana'
  return 'rendah'
}

function row(
  p: PredictionRow,
  extra: Pick<AlesaRow, 'confidence' | 'cadanganBand' | 'observed'> & { grade: string },
): AlesaRow {
  return {
    userId: p.userId,
    name: p.name,
    schoolName: p.schoolName,
    accuracy: p.tenths / 10,
    grade: extra.grade as SpmGrade,
    confidence: extra.confidence,
    cadanganBand: extra.cadanganBand,
    observed: extra.observed,
  }
}

function resolveStored(
  scopeKey: 'platform' | number,
  predictions: readonly PredictionRow[],
): AlesaRow[] {
  const used = new Set<number>()
  const out: AlesaRow[] = []
  const position = new Map(predictions.map((p, i) => [p.userId, i] as const))
  for (const s of alesaRepo.stored(scopeKey)) {
    const at = predictions[s.rank - 1]
    const target = at?.tenths
    // The school's unused students: same accuracy as the row at `rank` first, then the nearest rank.
    const candidates = predictions
      .filter((p) => !used.has(p.userId) && p.schoolId === s.schoolId)
      .sort(
        (a, b) =>
          Number(a.tenths !== target) - Number(b.tenths !== target) ||
          Math.abs((position.get(a.userId) as number) - (s.rank - 1)) -
            Math.abs((position.get(b.userId) as number) - (s.rank - 1)) ||
          a.userId - b.userId,
      )
    const pick = candidates[0] ?? (at && !used.has(at.userId) ? at : undefined)
    if (!pick) {
      throw new Error(
        `M12 ALESA: stored row ${String(s.seq)} of scope ${String(scopeKey)} (rank ${String(s.rank)}, school ${String(s.schoolId)}) has no student to resolve to`,
      )
    }
    // `observed` only when the student is an exact match (the school and the accuracy of the row at `rank`);
    // a substitute (nearest rank of the school) is a model value, not the observed student.
    const exact = pick.schoolId === s.schoolId && pick.tenths === target
    used.add(pick.userId)
    out.push(row(pick, { ...s, observed: s.observed && exact }))
  }
  return out
}

function generated(predictions: readonly PredictionRow[]): AlesaRow[] {
  const chosen =
    predictions.length <= MAX_ROWS
      ? [...predictions]
      : [...predictions].sort((a, b) => hashOf(a.userId) - hashOf(b.userId)).slice(0, MAX_ROWS)
  return chosen.map((p) =>
    row(p, {
      grade: p.grade,
      confidence: confidenceOf(p.answers),
      cadanganBand: bandOfGrade(p.grade),
      observed: false,
    }),
  )
}

/** The ALESA list of a scope; `predictions` is the prediction table of the same scope. */
export function alesaOf(scope: Scope, predictions: readonly PredictionRow[]): AlesaList {
  const only = scope.schoolIds?.length === 1 ? scope.schoolIds[0] : undefined
  let rows: AlesaRow[]
  if (scope.schoolIds === null) rows = resolveStored('platform', predictions)
  else if (only !== undefined && alesaRepo.stored(only).length > 0) {
    rows = resolveStored(only, predictions)
  } else rows = generated(predictions)
  rows.sort((a, b) => gradeIndex(a.grade) - gradeIndex(b.grade) || a.userId - b.userId)
  return {
    lulus: rows.filter((r) => isPass(r.grade)).length,
    gagal: rows.filter((r) => isFail(r.grade)).length,
    intervensi: rows.filter((r) => needsIntervention(r.grade)).length,
    rows,
  }
}
