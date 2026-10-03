/**
 * SRS M10 v1.18 §7 #2–#10 `/api/guru/command-center/*` (S2 Command Center). All **T** (teacher or
 * admin; guest 401, other roles 403) and all scoped to the viewer's own students (BR-M10-04): a
 * request cannot name another teacher's student, class or test.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 2 | GET `live-data` | polled every 10 s by the page; BR-M10-08, BR-M10-10 |
 * | 3 | GET `drill?type=&filter=` | DV-M10-04 titles; unknown type / filter 422 |
 * | 4 | GET `remedial/scan` | BR-M10-11 (DV-M10-03: works, live answers 500) |
 * | 5 | POST `remedial/generate` | 201 `{quizId, totalQuestions}`; 403 not own student; 422 |
 * | 6 | POST `remedial/cancel` | `{success:true}`; 404 unknown or not own test; 409 not active |
 * | 7 | GET `predictive` | BR-M10-14 |
 * | 8 | GET `evaluate` | BR-M10-15, read-only (SEC-M10-08) |
 * | 9 | GET `achievements` | BR-M10-16, read-only |
 * | 10 | GET `badge-holders?badgeId=` | 422 bad id, 404 unknown badge |
 *
 * Bodies are the bare objects of the SRS (no `{data}` envelope, as live); the types are in
 * `api/command-center-types.ts`. Only #5 and #6 write, and only through M10's own `remedialTests`.
 */

import {
  fail,
  forbidden,
  notFound,
  queryString,
  raw,
  route,
  validationError,
  type RouteDef,
} from '@/mock/define'

import type {
  CcAchievements,
  CcBadgeHolders,
  CcEvaluation,
  CcLiveData,
  CcPredictive,
  CcRemedialScan,
} from '../../api/command-center-types'
import { remedialTestsRepo } from '../repository/remedial'
import { bodyOf, intOf, teacherOnly, textOf, viewerId } from './common'
import { buildContext } from './command-center-data'
import { loadPeers } from './command-center-peers'
import { generateRemedial, resolveSubject, scanRemedial } from './command-center-remedial'
import { DRILL_MSG, REMEDIAL_MSG } from './command-center-rules'
import {
  achievements,
  badgeHolders,
  drill,
  evaluate,
  liveData,
  predictive,
} from './command-center-views'

const BASE = '/api/guru/command-center'

const contextOf = async (req: Parameters<typeof viewerId>[0], now: number) =>
  buildContext(viewerId(req), now, await loadPeers())

export const commandCenterRoutes: RouteDef[] = [
  route('GET', `${BASE}/live-data`, [teacherOnly], async (req, ctx) => {
    const body: CcLiveData = liveData(await contextOf(req, ctx.clock.now()))
    return raw(200, body)
  }),

  route('GET', `${BASE}/drill`, [teacherOnly], async (req, ctx) => {
    const result = drill(
      await contextOf(req, ctx.clock.now()),
      queryString(req.query, 'type') ?? '',
      (queryString(req.query, 'filter') ?? '').trim(),
    )
    if (!result.ok) return validationError({ [result.field]: result.message })
    return raw(200, result.body)
  }),

  route('GET', `${BASE}/remedial/scan`, [teacherOnly], async (req, ctx) => {
    const body: CcRemedialScan = scanRemedial(await contextOf(req, ctx.clock.now()))
    return raw(200, body)
  }),

  route('POST', `${BASE}/remedial/generate`, [teacherOnly], async (req, ctx) => {
    const body = bodyOf(req)
    const studentId = intOf(body.studentId)
    const subjectText = textOf(body.subject)
    const fields: Record<string, string> = {}
    if (studentId === undefined || studentId < 1) fields.studentId = REMEDIAL_MSG.studentId
    if (subjectText === undefined || subjectText === '') fields.subject = REMEDIAL_MSG.subject
    if (Object.keys(fields).length > 0 || studentId === undefined || subjectText === undefined) {
      return validationError(fields)
    }
    const now = ctx.clock.now()
    const cc = await contextOf(req, now)
    // BR-M10-12: the student must be one of the viewer's own students.
    const student = cc.byId.get(studentId)
    if (!student) return forbidden(REMEDIAL_MSG.notYourStudent)
    const subject = resolveSubject(subjectText)
    if (!subject) return validationError({ subject: REMEDIAL_MSG.noSubject })
    // an async handler is not wrapped in a transaction: the write is grouped here
    const outcome = ctx.transaction(() => generateRemedial(cc, student, subject, now))
    if (!outcome.ok) {
      const message =
        outcome.reason === 'alreadyOpen' ? REMEDIAL_MSG.alreadyOpen : REMEDIAL_MSG.noQuestions
      return fail(422, 'VALIDATION_ERROR', message)
    }
    return raw(201, { quizId: outcome.test.id, totalQuestions: outcome.test.totalQuestions })
  }),

  route('POST', `${BASE}/remedial/cancel`, [teacherOnly], (req, ctx) => {
    const quizId = intOf(bodyOf(req).quizId)
    if (quizId === undefined || quizId < 1) return validationError({ quizId: REMEDIAL_MSG.quizId })
    const test = remedialTestsRepo.getRow(quizId)
    if (!test) return notFound(REMEDIAL_MSG.testNotFound)
    // a test of another teacher answers like an unknown id, so ids cannot be probed
    if (test.teacherId !== viewerId(req)) return notFound(REMEDIAL_MSG.testNotFound)
    if (!ctx.transaction(() => remedialTestsRepo.cancel(quizId))) {
      return fail(409, 'CONFLICT', REMEDIAL_MSG.testNotActive)
    }
    return raw(200, { success: true })
  }),

  route('GET', `${BASE}/predictive`, [teacherOnly], async (req, ctx) => {
    const body: CcPredictive = predictive(await contextOf(req, ctx.clock.now()))
    return raw(200, body)
  }),

  route('GET', `${BASE}/evaluate`, [teacherOnly], async (req, ctx) => {
    const body: CcEvaluation = evaluate(await contextOf(req, ctx.clock.now()))
    return raw(200, body)
  }),

  route('GET', `${BASE}/achievements`, [teacherOnly], async (req, ctx) => {
    const body: CcAchievements = achievements(await contextOf(req, ctx.clock.now()))
    return raw(200, body)
  }),

  route('GET', `${BASE}/badge-holders`, [teacherOnly], async (req, ctx) => {
    const badgeId = intOf(queryString(req.query, 'badgeId'))
    if (badgeId === undefined || badgeId < 1) return validationError({ badgeId: DRILL_MSG.badge })
    const body: CcBadgeHolders | null = badgeHolders(await contextOf(req, ctx.clock.now()), badgeId)
    return body ? raw(200, body) : notFound(DRILL_MSG.badgeNotFound)
  }),
]
