/**
 * SRS M08 v1.11 §7 #1 school performance (S1), #2 levels (S2), #3 level detail (S3), #4 own classes
 * (S4). Any session (A). Scope (FR-M08-13): the admin sees every school; the school admin the own
 * school; every other role the own school (INFERRED, OQ-M08-04). An unknown level code is a 404.
 */

import { ok, requireAuth, route, str, notFound, type RouteDef } from '@/mock/define'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type { ClassCard, ClassesAggregate, LevelCard } from '../../api/types'
import {
  LEVEL_NAME,
  classCard,
  levelDetail,
  schoolPerformance,
  type Scope,
} from '../repository/performance'
import { LEVEL_CODES, LEVEL_SLUG, PRACTICE_MODE_SET, answerTotalsOf, type LevelCode } from '../repository/reads'
import { users } from '@/modules/m01-authentication/mock'
import { practice } from '@/modules/m05-practice/mock'
import { ownClasses, subjectColorOf, subjectNameOf, viewerOf, type Viewer } from './common'

/** The data scope of a viewer (INFERRED for non-admin roles); no school → an empty school scope. */
export function scopeOf(viewer: Viewer): Scope {
  if (viewer.role === 'admin') return { kind: 'platform' }
  return { kind: 'school', schoolId: viewer.schoolId ?? -1 }
}

const isLevel = (v: string | number | undefined): v is LevelCode =>
  typeof v === 'string' && (LEVEL_CODES as readonly string[]).includes(v)

/** A teacher gets the own classes, a school admin the active classrooms of the own school (R1-AS-4). */
function ownClassList(viewer: Viewer) {
  if (viewer.role !== 'school_admin') return ownClasses(viewer)
  return viewer.schoolId === null ? [] : classrooms.list({ kind: 'classroom', schoolId: viewer.schoolId }).filter((c) => c.isActive)
}

export const performanceRoutes: RouteDef[] = [
  route('GET', '/api/performance/school', [requireAuth()], (req, ctx) => {
    const year = new Date(ctx.clock.now() + 8 * 3_600_000).getUTCFullYear()
    const scope = scopeOf(viewerOf(req))
    return ok(schoolPerformance(scope, year))
  }),

  route('GET', '/api/performance/levels', [requireAuth()], (req) => {
    const scope = scopeOf(viewerOf(req))
    // t4 and t5 are always listed (zeros when empty); t1 to t3 only when the scope has classes or pupils (R1-AS-4).
    const cards: LevelCard[] = LEVEL_CODES.flatMap((code) => {
      const slug = LEVEL_SLUG[code]
      let card: LevelCard
      if (scope.kind === 'platform') {
        const s = classrooms.levelSummary(slug)
        card = { code, name: LEVEL_NAME[code], classes: s.classes, students: s.students }
      } else {
        const cls = classrooms.list({ educationLevel: slug, schoolId: scope.schoolId })
        const ids = new Set(cls.flatMap((c) => classrooms.memberIds(c.kind, c.classId)))
        card = { code, name: LEVEL_NAME[code], classes: cls.length, students: ids.size }
      }
      return code === 't4' || code === 't5' || card.classes > 0 || card.students > 0 ? [card] : []
    })
    return ok(cards)
  }),

  route(
    'GET',
    '/api/performance/levels/:code',
    [requireAuth()],
    (req, ctx) => {
      const code = req.params.code
      if (!isLevel(code)) return notFound()
      const scope = scopeOf(viewerOf(req))
      return ok(levelDetail(code, scope, ctx.clock.now()))
    },
    { params: { code: str() } },
  ),

  route('GET', '/api/performance/classes', [requireAuth()], (req) => {
    const cards: ClassCard[] = ownClassList(viewerOf(req)).map((c) =>
      classCard(c, subjectNameOf(c.subjectId), subjectColorOf(c.subjectId)),
    )
    return ok(cards)
  }),

  route('GET', '/api/performance/classes/aggregate', [requireAuth()], (req) => {
    const list = ownClassList(viewerOf(req))
    const cards: ClassCard[] = list.map((c) =>
      classCard(c, subjectNameOf(c.subjectId), subjectColorOf(c.subjectId)),
    )
    // The additive block of `/prestasi/kelas` (R1-GUR-4): Pelajar Terbaik (≥ 5 answers) and Prestasi Mengikut Subjek over the pupils of those classes.
    const pupils = [...new Set(list.flatMap((c) => classrooms.memberIds(c.kind, c.classId)))].sort((a, b) => a - b)
    const totals = pupils.map((id) => ({ id, ...answerTotalsOf(id) }))
    const topStudents = totals
      .filter((t) => t.answered >= 5)
      .map((t) => ({ ...t, raw: t.correct / t.answered }))
      .sort((a, b) => b.raw - a.raw || b.answered - a.answered || a.id - b.id)
      .slice(0, 10)
      .map((t) => ({
        userId: t.id,
        name: users.get(t.id)?.name ?? `Murid ${String(t.id)}`,
        answered: t.answered,
        accuracy: Math.round(Math.min(t.raw * 100, 100) * 10) / 10,
      }))
    const bySubject = new Map<number, { answered: number; correct: number }>()
    // The mock keeps no per-answer subject, so the subject rows are the pupils' practice sessions (question and correct counts).
    for (const id of pupils)
      for (const h of practice.history(id)) {
        if (!PRACTICE_MODE_SET.has(h.mode)) continue
        if (h.subjectId === null) continue
        const t = bySubject.get(h.subjectId) ?? { answered: 0, correct: 0 }
        t.answered += h.questionCount
        t.correct += h.correctCount
        bySubject.set(h.subjectId, t)
      }
    const subjects = [...bySubject]
      .map(([subjectId, t]) => ({
        subjectId,
        name: subjectNameOf(subjectId) ?? `Subjek ${String(subjectId)}`,
        answered: t.answered,
        raw: t.correct / t.answered,
      }))
      .sort((a, b) => b.raw - a.raw || b.answered - a.answered || a.name.localeCompare(b.name) || a.subjectId - b.subjectId)
      .map(({ raw, ...s }) => ({ ...s, accuracy: Math.round(Math.min(raw * 100, 100) * 10) / 10 }))
    const out: ClassesAggregate = { classes: cards, topStudents, subjects }
    return ok(out)
  }),
]
