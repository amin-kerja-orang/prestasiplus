/**
 * Q-M27-DSKP (SRS §18.3; BR-M27-24, 25; FR-M27-58 to 65), screen S2.
 *
 * Structure from the M10 `dskp` repository (Bidang, SK, SP of a subject at T4 or T5); values from the M08
 * `spRecords` of the school's pupils, pooled over answers (Σ correct ÷ Σ answered, not the mean of pupil
 * percentages). G-8: every record origin (`anchor`, `log`) is summed; rows are unique per
 * `userId:subjectId:spId`, so nothing is counted twice.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { dskp } from '@/modules/m10-teacher-class/mock'
import { spRecords } from '@/modules/m08-student-performance/mock'

import type {
  DskpStatus,
  HeatmapBidang,
  HeatmapLevelCode,
  SchoolDskpHeatmap,
} from '../../api/school-admin'
import { peopleOf } from './school-people'
import { schoolRefOf } from './school-info'
import type { SchoolViewer } from './school-scope'

/** M10 BR-M10-03: `tingkatan-n` has level id 6 + n. */
const LEVEL: Readonly<
  Record<HeatmapLevelCode, { levelId: number; name: 'Tingkatan 4' | 'Tingkatan 5'; n: number }>
> = {
  t4: { levelId: 10, name: 'Tingkatan 4', n: 4 },
  t5: { levelId: 11, name: 'Tingkatan 5', n: 5 },
}

/** BR-M27-25: levels are T4 and T5; anything else is T4. */
export function parseLevel(raw: string | undefined): HeatmapLevelCode {
  return raw?.toUpperCase() === 'T5' ? 't5' : 't4'
}

/** BR-M27-24: percent half up, status on the shown integer. */
export function statusOf(pct: number | null): DskpStatus {
  if (pct === null) return 'belum'
  if (pct >= 75) return 'mahir'
  if (pct >= 50) return 'sederhana'
  return 'lemah'
}

export function buildSchoolDskpHeatmap(
  viewer: SchoolViewer,
  query: { subjectId?: string | undefined; tingkatan?: string | undefined },
): SchoolDskpHeatmap {
  const level = parseLevel(query.tingkatan)
  const { levelId, name, n } = LEVEL[level]

  // Bidang of the level with at least one SP, grouped by subject (BR-M27-25).
  const bidangRows = dskp.bidang({ educationLevelId: levelId })
  const withSp = bidangRows
    .map((b) => ({
      bidang: b,
      sp: dskp.sk(b.id).flatMap((k) => dskp.sp(k.id)),
    }))
    .filter((x) => x.sp.length > 0)

  const subjectIds = [...new Set(withSp.map((x) => x.bidang.subjectId))]
  const subjects = subjectIds
    .map((id) => ({ id, name: curriculum.subject(id)?.name ?? `Subjek ${String(id)}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms-MY') || a.id - b.id)

  // Σ answered and Σ correct over the school's pupils, per SP of the level (BR-M27-24).
  const subjectOfSp = new Map<number, number>()
  for (const x of withSp) for (const s of x.sp) subjectOfSp.set(s.id, x.bidang.subjectId)
  const totals = new Map<number, { answered: number; correct: number }>()
  for (const pupil of peopleOf(viewer.schoolId, 'student')) {
    for (const r of spRecords.forUser(pupil.id)) {
      if (!subjectOfSp.has(r.dskpSpId)) continue
      const t = totals.get(r.dskpSpId) ?? { answered: 0, correct: 0 }
      t.answered += r.answered
      t.correct += r.correct
      totals.set(r.dskpSpId, t)
    }
  }

  // Default subject: the first (by name) that has answers at this level, so the opening view is not an
  // all-"Belum Cuba" grid; the first subject when the school has none (UAT 2026-10-24, S-52).
  const withAnswers = new Set(
    [...totals.entries()].filter(([, t]) => t.answered > 0).map(([sp]) => subjectOfSp.get(sp)),
  )
  const asked =
    query.subjectId !== undefined && /^\d+$/.test(query.subjectId) ? Number(query.subjectId) : null
  const subject =
    subjects.find((s) => s.id === asked) ??
    subjects.find((s) => withAnswers.has(s.id)) ??
    subjects[0] ??
    null
  const school = schoolRefOf(viewer)
  if (!subject) {
    return {
      school,
      subjects,
      subject: null,
      level: { code: level, name },
      caption: null,
      bidang: [],
    }
  }

  const chosen = withSp.filter((x) => x.bidang.subjectId === subject.id)

  const bidang: HeatmapBidang[] = chosen.map(({ bidang: b, sp }) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    sp: sp.map((s) => {
      const t = totals.get(s.id) ?? { answered: 0, correct: 0 }
      const pct = t.answered > 0 ? Math.floor((100 * t.correct) / t.answered + 0.5) : null
      return {
        id: s.id,
        code: s.code,
        title: s.description,
        answered: t.answered,
        correct: t.correct,
        pct,
        status: statusOf(pct),
      }
    }),
  }))

  return {
    school,
    subjects,
    subject,
    level: { code: level, name },
    caption: `KSSM ${subject.name} Tingkatan ${String(n)}`,
    bidang,
  }
}
