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
  HeatmapLevelName,
  SchoolDskpHeatmap,
} from '../../api/school-admin'
import { peopleOf } from './school-people'
import { schoolRefOf } from './school-info'
import type { SchoolViewer } from './school-scope'

/** M10 BR-M10-03: `tingkatan-n` has level id 6 + n. */
const CODES: readonly HeatmapLevelCode[] = ['t1', 't2', 't3', 't4', 't5']
const levelOf = (code: HeatmapLevelCode): { levelId: number; name: HeatmapLevelName; n: number } => {
  const n = CODES.indexOf(code) + 1
  return { levelId: 6 + n, name: `Tingkatan ${String(n)}` as HeatmapLevelName, n }
}

/** FR-AS-47-1: T1 to T5, case-insensitive; anything else is null (the highest level with content is then used). */
export function parseLevel(raw: string | undefined): HeatmapLevelCode | null {
  const v = raw?.trim().toLowerCase()
  return CODES.find((c) => c === v) ?? null
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
  const hasContent = (levelId: number): boolean =>
    dskp.bidang({ educationLevelId: levelId }).some((b) => dskp.sk(b.id).some((k) => dskp.sp(k.id).length > 0))
  // FR-AS-47-1: only the levels with content are offered; the default is the highest of them (T4 when none has any).
  const offered = CODES.filter((c) => hasContent(levelOf(c).levelId))
  const wanted = parseLevel(query.tingkatan)
  const level: HeatmapLevelCode = wanted !== null && offered.includes(wanted) ? wanted : (offered.at(-1) ?? 't4')
  const levels = offered.map((c) => ({ code: c, name: levelOf(c).name }))
  const { levelId, name, n } = levelOf(level)

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

  const asked =
    query.subjectId !== undefined && /^\d+$/.test(query.subjectId) ? Number(query.subjectId) : null
  const subject = subjects.find((s) => s.id === asked) ?? subjects[0] ?? null
  const school = schoolRefOf(viewer)
  if (!subject) {
    return {
      school,
      subjects,
      subject: null,
      level: { code: level, name },
      levels,
      caption: null,
      bidang: [],
    }
  }

  const chosen = withSp.filter((x) => x.bidang.subjectId === subject.id)
  const spIds = new Set(chosen.flatMap((x) => x.sp.map((s) => s.id)))

  // Σ answered and Σ correct over the school's pupils, only for the SPs shown.
  const totals = new Map<number, { answered: number; correct: number }>()
  for (const pupil of peopleOf(viewer.schoolId, 'student')) {
    for (const r of spRecords.forUser(pupil.id)) {
      if (!spIds.has(r.dskpSpId)) continue
      const t = totals.get(r.dskpSpId) ?? { answered: 0, correct: 0 }
      t.answered += r.answered
      t.correct += r.correct
      totals.set(r.dskpSpId, t)
    }
  }

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
    levels,
    caption: `KSSM ${subject.name} Tingkatan ${String(n)}`,
    bidang,
  }
}
