/**
 * SRS M05 v1.16 §7 #4–#6 and #23 — the session endpoints M05 and M06 pages share (overview §6.8):
 *
 * | # | Route | Repository call |
 * |---|---|---|
 * | 4 | `POST /api/practice/sessions` | `practice.startSession` (BR-07, BR-13–BR-17, BR-32; M06 BR-M06-13) |
 * | 5 | `POST /api/practice/sessions/:id/check-answer` | `practice.checkAnswer` (BR-30, BR-07) |
 * | 6 | `POST /api/practice/sessions/:id/submit` | `practice.completeSession` (BR-31) |
 * | 23 | `GET /api/practice/sessions?modes=…&type=&page=&pageSize=` | `practice.historyPage` |
 *
 * Any session (A). Errors carry the §8.3 mock messages. The handlers only shape requests and
 * responses; every rule lives in the repository.
 */

import { API_ERROR_CODES } from '@/api/errors'
import {
  created,
  fail,
  ok,
  queryInt,
  queryString,
  requireAuth,
  route,
  unpaged,
  type MockRequest,
  type RouteDef,
} from '@/mock/define'
import { paginate } from '@/mock/server/paginate'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import type { Question } from '@/modules/m04-question-bank/mock'

import type { PracticeMode } from '../datasets/types'
import { practiceRepo } from '../repository/practice'
import { LETTERS, PracticeError, isMode } from '../repository/rules'
import type { StartRequest } from '../repository/start'

function userIdOf(req: MockRequest): number {
  if (!req.session) throw new Error('requireAuth() must run first')
  return req.session.userId
}

function answer(err: unknown) {
  if (err instanceof PracticeError) {
    return fail(err.status, err.code, err.message, err.fields ? { ...err.fields } : undefined)
  }
  throw err
}

const obj = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}

const intOrUndefined = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) ? v : undefined
const intOrNull = (v: unknown): number | null | undefined => (v === null ? null : intOrUndefined(v))

/** #4 question item (keys never leave the mock). */
function questionItem(q: Question, wrongTimes: number) {
  const creator = q.createdBy > 0 ? users.get(q.createdBy) : undefined
  return {
    id: q.id,
    questionText: q.questionText,
    textDirection: q.textDirection,
    scriptType: q.scriptType,
    wrongTimes,
    // FR-M05-77: "Mengikut DSKP" from the DSKP chapter link (§6.15, INFERRED).
    hasDskp: q.curriculumChapterId !== null,
    // "Soalan oleh:" for teacher contributions (INFERRED: a teacher creator; no profile link).
    contributor:
      creator && creator.role === 'teacher' ? { name: creator.name, profileUrl: null } : null,
    options: (q.options ?? []).map((text, i) => ({ id: i, label: LETTERS[i] ?? String(i), text })),
  }
}

export const sessionRoutes: RouteDef[] = [
  route('POST', '/api/practice/sessions', [requireAuth()], (req, ctx) => {
    const userId = userIdOf(req)
    const b = obj(req.body)
    const request: StartRequest = {
      mode: b.mode as PracticeMode,
      ...(typeof b.subjectCode === 'string' ? { subjectCode: b.subjectCode } : {}),
      ...(intOrNull(b.levelId) !== undefined ? { levelId: intOrNull(b.levelId) } : {}),
      ...(intOrNull(b.difficulty) !== undefined ? { difficulty: intOrNull(b.difficulty) } : {}),
      ...(b.count !== undefined ? { count: b.count as number } : {}),
      ...(intOrUndefined(b.chapterId) !== undefined
        ? { chapterId: intOrUndefined(b.chapterId) }
        : {}),
      ...(intOrUndefined(b.year) !== undefined ? { year: intOrUndefined(b.year) } : {}),
      ...(intOrUndefined(b.setNo) !== undefined ? { setNo: intOrUndefined(b.setNo) } : {}),
      ...(intOrNull(b.targetQuestionId) !== undefined
        ? { targetQuestionId: intOrNull(b.targetQuestionId) }
        : {}),
      ...(intOrUndefined(b.missionId) !== undefined
        ? { missionId: intOrUndefined(b.missionId) }
        : {}),
      ...(intOrUndefined(b.remedialTestId) !== undefined
        ? { remedialTestId: intOrUndefined(b.remedialTestId) }
        : {}),
      ...(intOrUndefined(b.questionSetId) !== undefined
        ? { questionSetId: intOrUndefined(b.questionSetId) }
        : {}),
    }
    try {
      const r = practiceRepo.startSession(
        userId,
        request,
        ctx.clock.now(),
        ctx.prng.stream(`practice:start:${String(userId)}`),
      )
      const s = r.session
      const subject = s.subjectId !== null ? curriculum.subject(s.subjectId) : undefined
      const chapter = s.chapterId !== null ? curriculum.chapter(s.chapterId) : undefined
      const wrong = new Map(practiceRepo.queueAll(userId).map((q) => [q.questionId, q.wrongTimes]))
      const byId = new Map(r.questions.map((q) => [q.id, q]))
      return created({
        sessionId: s.id,
        mode: s.mode,
        subject: subject ? { code: subject.code, name: subject.name, color: subject.color } : null,
        ...(chapter
          ? { chapter: { id: chapter.id, number: chapter.chapterNumber, name: chapter.name } }
          : {}),
        questions: s.questionIds
          .map((id) => byId.get(id))
          .filter((q): q is Question => q !== undefined)
          .map((q) => questionItem(q, wrong.get(q.id) ?? 0)),
        ...(r.revisionMeta ? { revisionMeta: r.revisionMeta } : {}),
        ...(s.mode === 'question_set' ? { timeLimitSec: s.timeLimitSec } : {}),
      })
    } catch (err) {
      return answer(err)
    }
  }),

  route('POST', '/api/practice/sessions/:id/check-answer', [requireAuth()], (req, ctx) => {
    const b = obj(req.body)
    const questionId = intOrUndefined(b.questionId)
    const selected = intOrUndefined(b.selectedOptionId)
    if (questionId === undefined || selected === undefined) {
      return fail(422, API_ERROR_CODES.VALIDATION_ERROR, 'Jawapan tidak sah.')
    }
    try {
      return ok(
        practiceRepo.checkAnswer(
          userIdOf(req),
          String(req.params.id),
          questionId,
          selected,
          ctx.clock.now(),
        ),
      )
    } catch (err) {
      return answer(err)
    }
  }),

  route('POST', '/api/practice/sessions/:id/submit', [requireAuth()], (req, ctx) => {
    const b = obj(req.body)
    try {
      const r = practiceRepo.completeSession({
        sessionId: String(req.params.id),
        userId: userIdOf(req),
        timeSpent: typeof b.timeSpent === 'number' ? b.timeSpent : 0,
        now: ctx.clock.now(),
      })
      return ok({
        results: {
          score: r.score,
          total: r.total,
          gamification: {
            coinsEarned: r.gamification.coinsEarned,
            streakCount: r.gamification.streakCount,
            pointsEarned: r.gamification.pointsEarned,
            totalBalance: r.gamification.totalBalance,
          },
        },
      })
    } catch (err) {
      return answer(err)
    }
  }),

  route('GET', '/api/practice/sessions', [requireAuth()], (req) => {
    const raw = queryString(req.query, 'modes') ?? ''
    const modes = raw
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m !== '')
    if (modes.length === 0 || !modes.every(isMode)) {
      return fail(422, API_ERROR_CODES.VALIDATION_ERROR, 'Mod tidak sah.', {
        modes: 'Mod tidak sah.',
      })
    }
    const page = queryInt(req.query, 'page')
    const pageSize = queryInt(req.query, 'pageSize')
    const result = practiceRepo.historyPage(userIdOf(req), {
      modes,
      type: queryString(req.query, 'type') ?? null,
    })
    const items = result.rows.map((s) => ({
      id: s.id,
      mode: s.mode,
      subjectId: s.subjectId,
      // `UMUM` for mixed free practice (subject null, M17 XR-M17-04).
      subjectCode: s.subjectId !== null ? (curriculum.subject(s.subjectId)?.code ?? null) : 'UMUM',
      questionCount: s.questionCount,
      correctCount: s.correctCount,
      percent: s.questionCount === 0 ? 0 : Math.round((s.correctCount / s.questionCount) * 100),
      coinsEarned: s.coinsEarned,
      timeSpent: s.timeSpent,
      completedAt: s.completedAt,
    }))
    const extraMeta = { activeType: result.activeType, stats: result.stats }
    if (page === undefined && pageSize === undefined) return unpaged(items, extraMeta)
    return paginate(
      items,
      {
        page: page !== undefined && page >= 1 ? page : 1,
        pageSize: pageSize !== undefined && pageSize >= 1 ? pageSize : 15,
      },
      extraMeta,
    )
  }),
]
