/**
 * SRS M05 v1.17 §7 #20 `GET /api/remedial-tests/mine` (S13) and #21 `GET /api/missions/today`
 * (S14), BR-32, XL2-08. Any session (A). M10 owns the records; M05 reads them through the seams
 * (`missions.forStudent`, `remedialTests.forStudent`; F-30) and adds the viewer's session status
 * (Q-SESS-LINK). Without the M10 plugin both lists are empty.
 */

import {
  int as intParam,
  notFound,
  ok,
  requireAuth,
  route,
  unpaged,
  type RouteDef,
} from '@/mock/define'
import { questions } from '@/modules/m04-question-bank/mock'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { mytDateKey } from '../datasets/calendar'
import { scanSessions } from '../repository/reads'
import { seams } from '../repository/seams'
import { userIdOf } from './common'

/** INFERRED labels of the M10 mission types (M10 S12: "Latih Tubi SPM", "Tracking A", "Soalan & Rujukan"). */
export const MISSION_TYPE_LABELS: Readonly<Record<string, string>> = {
  latih_tubi: 'Latih Tubi SPM',
  tracking_a: 'Tracking A',
  youtube: 'Soalan & Rujukan',
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const int = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d)

export const assignedRoutes: RouteDef[] = [
  route('GET', '/api/remedial-tests/mine', [requireAuth()], (req) => {
    const rows = seams()
      .remedialTestsForStudent(userIdOf(req))
      // BR-32: the viewer's tests with status ≠ cancelled, newest first.
      .filter((t) => t.status === 'active' || t.status === 'completed')
      .sort((a, b) => (str(b.createdAt) ?? '').localeCompare(str(a.createdAt) ?? '') || b.id - a.id)
    return unpaged(
      rows.map((t) => ({
        id: t.id,
        subjectName:
          str(t.subjectName) ??
          (t.subjectId !== null ? (curriculum.subject(t.subjectId)?.name ?? '') : ''),
        totalQuestions: int(t.totalQuestions, t.questionIds.length),
        status: t.status as 'active' | 'completed',
        createdAt: str(t.createdAt) ?? '',
        teacherName: users.get(int(t.teacherId, -1))?.name ?? '',
      })),
    )
  }),

  route('GET', '/api/missions/today', [requireAuth()], (req, ctx) => {
    const userId = userIdOf(req)
    const today = mytDateKey(ctx.clock.now())
    const missions = seams().missionsForStudent(userId, today)
    if (missions.length === 0) return unpaged([])
    // Q-SESS-LINK: the viewer's sessions linked to a mission, completed beats in progress.
    const status = new Map<number, 'in_progress' | 'completed'>()
    for (const s of scanSessions({ userId }, (x) => x.missionId !== null)) {
      const id = s.missionId as number
      if (s.status === 'completed') status.set(id, 'completed')
      else if (!status.has(id)) status.set(id, 'in_progress')
    }
    return unpaged(
      missions
        .sort(
          (a, b) => (str(a.createdAt) ?? '').localeCompare(str(b.createdAt) ?? '') || a.id - b.id,
        )
        .map((m) => ({
          id: m.id,
          title: str(m.title) ?? '',
          typeLabel: MISSION_TYPE_LABELS[String(m.missionType)] ?? '',
          subjectName: m.subjectId !== null ? (curriculum.subject(m.subjectId)?.name ?? '') : '',
          questionCount: int(m.questionCount),
          coinsPerCorrect: m.coinsPerCorrect,
          resourceTitle: str(m.resourceTitle),
          resourceUrl: str(m.resourceUrl),
          resourceNote: str(m.resourceNote),
          status: status.get(m.id) ?? 'new',
        })),
    )
  }),
]

const LETTERS = ['A', 'B', 'C', 'D'] as const

/**
 * #20b `GET /api/remedial-tests/:id` — the Q4 read-only preview (FR-M05-141, BR-32, XL2-40;
 * PROPOSED, provisional). Only the test's own teacher and an admin get it (M10 `remedialTests.get`);
 * every other viewer, including the assigned student (who starts a session instead), and an
 * unknown id get 404. Nothing is written. Questions come from M04 in the stored order, with the
 * correct option marked.
 */
export const remedialPreviewRoutes: RouteDef[] = [
  route(
    'GET',
    '/api/remedial-tests/:id',
    [requireAuth()],
    (req) => {
      const session = req.session
      if (!session) throw new Error('requireAuth() must run first')
      const t = seams().remedialPreview(req.params.id as number, {
        id: session.userId,
        role: session.role,
      })
      if (!t) return notFound()
      const items = t.questionIds.flatMap((qid) => {
        const q = questions.get(qid)
        if (!q) return []
        return [
          {
            id: q.id,
            questionText: q.questionText,
            textDirection: q.textDirection,
            scriptType: q.scriptType,
            options: (q.options ?? []).map((text, i) => ({
              id: i,
              label: LETTERS[i] ?? String(i),
              text,
            })),
            correctOptionId: q.correctAnswer,
          },
        ]
      })
      return ok({
        id: t.id,
        subjectName: str(t.subjectName) ?? '',
        status: t.status,
        totalQuestions: int(t.totalQuestions, t.questionIds.length),
        createdAt: str(t.createdAt) ?? '',
        teacherName: users.get(int(t.teacherId, -1))?.name ?? '',
        studentName: users.get(t.studentId)?.name ?? '',
        questions: items,
      })
    },
    { params: { id: intParam() } },
  ),
]
