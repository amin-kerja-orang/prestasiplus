import type { Scenario } from '@pp/contract-tests'

import { registerStudent } from '../account/account'
import { dataOf, errorOf, expectError, listOf } from '../helpers'

const SCAN = '/guru/command-center/remedial/scan'
const GENERATE = '/guru/command-center/remedial/generate'
const CANCEL = '/guru/command-center/remedial/cancel'

/**
 * BE-18 missions and remedial scenarios (api target): the student reads, the teacher progress and the Command
 * Center trio. The conformance database has no classes, missions, answers or remedial tests, and the practice
 * question source is not bound there, so data is set up through the API (a class and a joined pupil) and the
 * paths that need weak topics end in their documented refusals. The deep cases (generation, cancel, determinism,
 * scan scoring) are in `apps/api/test/missions`.
 */
export const missionsScenarios: Scenario[] = [
  {
    id: 'missions-api/anonymous is 401 on every route',
    domain: 'missions',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ['/missions/today', '/remedial-tests/mine', '/remedial-tests/1', '/guru/remedial-progress', SCAN]) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
      expectError(ctx, await anon.request('POST', GENERATE, { body: {} }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', CANCEL, { body: {} }), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'missions-api/student reads: today and mine are empty lists, the preview is 404 for anyone but the owner',
    domain: 'missions',
    targets: ['api'],
    async run(ctx) {
      for (const role of ['student', 'teacher', 'admin'] as const) {
        const who = await ctx.as(role)
        const today = await who.request('GET', '/missions/today')
        ctx.expectStatus(today, 200)
        ctx.check(listOf(today).length === 0, `${role}: unexpected missions`)
        ctx.check(today.headers['cache-control']?.includes('no-store') === true, 'missions/today is cacheable')
        const mine = await who.request('GET', '/remedial-tests/mine')
        ctx.expectStatus(mine, 200)
        ctx.check(listOf(mine).length === 0, `${role}: unexpected remedial tests`)
        const preview = await who.request('GET', '/remedial-tests/987654321')
        expectError(ctx, preview, 404, 'NOT_FOUND')
        ctx.check(errorOf(preview).message === 'Not Found.', 'preview 404 message differs')
      }
      const student = await ctx.as('student')
      expectError(ctx, await student.request('GET', '/remedial-tests/abc'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'missions-api/teacher reads: progress and scan are bare, empty bodies; a pupil and a school admin are 403',
    domain: 'missions',
    targets: ['api'],
    async run(ctx) {
      for (const role of ['teacher', 'admin'] as const) {
        const who = await ctx.as(role)
        const progress = await who.request('GET', '/guru/remedial-progress')
        ctx.expectStatus(progress, 200)
        const body = progress.body as { stats?: Record<string, unknown>; rows?: unknown[]; data?: unknown }
        ctx.check(body.data === undefined && body.rows?.length === 0, `${role}: progress is not a bare empty body`)
        ctx.check(JSON.stringify(body.stats) === JSON.stringify({ total: 0, completed: 0, students: 0, avgImprovement: 0 }), `${role}: progress stats differ`)
        const scan = await who.request('GET', SCAN)
        ctx.expectStatus(scan, 200)
        ctx.check(JSON.stringify(scan.body) === JSON.stringify({ weakStudents: [], existingRemedials: [] }), `${role}: scan differs`)
        ctx.check(scan.headers['cache-control']?.includes('no-store') === true, 'scan is cacheable')
      }
      for (const role of ['student', 'school_admin'] as const) {
        const who = await ctx.as(role)
        expectError(ctx, await who.request('GET', '/guru/remedial-progress'), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('GET', SCAN), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('POST', GENERATE, { body: {} }), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('POST', CANCEL, { body: {} }), 403, 'FORBIDDEN')
      }
    },
  },
  {
    id: 'missions-api/generate and cancel: CSRF, body fields, own pupils only, refusals, 404 and 422 of cancel',
    domain: 'missions',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const noCsrf = await ctx.as('teacher', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', GENERATE, { body: { studentId: '1', subject: 'x' } }), 403, 'CSRF_INVALID')
      expectError(ctx, await noCsrf.request('POST', CANCEL, { body: { quizId: '1' } }), 403, 'CSRF_INVALID')

      const empty = await teacher.request('POST', GENERATE, { body: {} })
      expectError(ctx, empty, 422, 'VALIDATION_ERROR')
      const fields = errorOf(empty).fields as Record<string, string> | undefined
      ctx.check(fields?.studentId === 'ID pelajar tidak sah.' && fields?.subject === 'Sila pilih subjek.', 'generate fields differ')

      // A pupil that is not the caller's: 403 with the BM text, also for an unknown subject (checked first).
      // A freshly registered pupil: no earlier scenario has put it in the demo teacher's classes.
      const { client: student } = await registerStudent(ctx)
      const me = (await student.request('GET', '/session')).body as { data?: { user?: { id?: unknown } } }
      const studentId = String(me.data?.user?.id ?? '')
      const notYours = await teacher.request('POST', GENERATE, { body: { studentId, subject: 'Tiada Subjek' } })
      expectError(ctx, notYours, 403, 'FORBIDDEN')
      ctx.check(errorOf(notYours).message === 'Pelajar ini bukan murid anda.', 'not-your-student message differs')

      // Once the pupil joins the teacher's class: an unknown subject is the second 422, no weak topic is a refusal.
      const subjects = await teacher.request('GET', '/subjects')
      const subject = listOf(subjects)[0]
      const subjectId = String(subject?.id)
      const cls = dataOf(await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas Remedial', subjectId, educationLevel: 'tingkatan-4' } }))
      ctx.expectStatus(await student.request('POST', '/kelas-saya/join', { body: { classCode: String(cls.joinCode) } }), 201)
      const unknownSubject = await teacher.request('POST', GENERATE, { body: { studentId, subject: 'Tiada Subjek' } })
      expectError(ctx, unknownSubject, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(unknownSubject).fields as Record<string, string> | undefined)?.subject === 'Subjek tidak sah.', 'unknown subject field differs')
      const none = await teacher.request('POST', GENERATE, { body: { studentId: Number(studentId), subject: String(subject?.name) } })
      expectError(ctx, none, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(none).message === 'Tiada soalan untuk topik lemah' && errorOf(none).fields === undefined, 'no-weak-topic refusal differs')
      const scan = await teacher.request('GET', SCAN)
      ctx.expectStatus(scan, 200)
      ctx.check((scan.body as { weakStudents?: unknown[] }).weakStudents?.length === 0, 'a pupil without answers is weak')

      const bad = await teacher.request('POST', CANCEL, { body: {} })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(bad).fields as Record<string, string> | undefined)?.quizId === 'ID ujian tidak sah.', 'cancel field differs')
      const unknown = await teacher.request('POST', CANCEL, { body: { quizId: '987654321' } })
      expectError(ctx, unknown, 404, 'NOT_FOUND')
      ctx.check(errorOf(unknown).message === 'Ujian remedial tidak dijumpai.', 'cancel 404 message differs')
    },
  },
  {
    id: 'missions-api/assigned work starts: an unknown mission, remedial test or question set is 404 (the BE-18 source is bound)',
    domain: 'missions',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      for (const body of [
        { mode: 'mission', missionId: '987654321' },
        { mode: 'remedial', remedialTestId: '987654321' },
        { mode: 'question_set', questionSetId: '987654321' },
      ]) {
        expectError(ctx, await student.request('POST', '/practice/sessions', { body }), 404, 'NOT_FOUND')
      }
    },
  },
]
