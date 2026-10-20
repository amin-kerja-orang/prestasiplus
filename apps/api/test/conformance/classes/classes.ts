import type { Scenario } from '@pp/contract-tests'

import { dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Classes and teacher basics (BE-17) scenarios: every served operation of M10 part A, the guards, and the
 * join / roster round trip between the demo teacher and the demo pupils (same school).
 */
export const classesScenarios: Scenario[] = [
  {
    id: 'classes-api/teacher: classes, qr, dashboard, roster tabs, chapters, topics, contributions, gallery',
    domain: 'classes',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const subjects = await teacher.request('GET', '/subjects')
      ctx.expectStatus(subjects, 200)
      const subjectId = String(listOf(subjects)[0]?.id)

      const created = await teacher.request('POST', '/guru/classes', {
        body: { name: 'Kelas Konformans', subjectId, educationLevel: 'tingkatan-4' },
      })
      ctx.expectStatus(created, 201)
      const cls = dataOf(created)
      ctx.check(typeof cls.joinCode === 'string' && cls.joinCode !== '', 'class has no join code')
      ctx.expectStatus(await teacher.request('GET', '/guru/classes'), 200)
      const qr = await teacher.request('GET', `/guru/classes/${String(cls.id)}/qr-data`)
      ctx.expectStatus(qr, 200)
      ctx.check(String((qr.body as { joinUrl?: unknown }).joinUrl).includes(String(cls.joinCode)), 'qr joinUrl lacks the code')
      expectError(ctx, await teacher.request('GET', '/guru/classes/987654321/qr-data'), 404, 'NOT_FOUND')

      ctx.expectStatus(await teacher.request('GET', '/guru/dashboard'), 200)
      ctx.expectStatus(await teacher.request('GET', '/guru/students'), 200)
      ctx.expectStatus(await teacher.request('GET', '/guru/students?tab=school&search=murid'), 200)
      ctx.expectStatus(await teacher.request('GET', '/guru/contributions'), 200)
      ctx.expectStatus(await teacher.request('GET', '/guru/galeri-rajah'), 200)

      const levelId = String(cls.levelId)
      const chapter = await teacher.request('POST', '/guru/chapters', {
        body: { name: 'Bab Konformans', chapterNumber: 5, subjectId, educationLevelId: levelId },
      })
      ctx.expectStatus(chapter, 201)
      const chapters = await teacher.request('GET', `/guru/chapters?subjectId=${subjectId}&educationLevelId=${levelId}`)
      ctx.expectStatus(chapters, 200)
      const chapterId = String((chapter.body as { id?: unknown }).id)
      ctx.expectStatus(await teacher.request('POST', '/guru/topics', { body: { name: 'Topik Konformans', chapterId } }), 201)
      ctx.expectStatus(await teacher.request('GET', `/guru/topics?chapterId=${chapterId}`), 200)
      const bad = await teacher.request('POST', '/guru/classes', { body: {} })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(bad).fields !== undefined, 'validation error without fields')
    },
  },
  {
    id: 'classes-api/join by code, roster add and remove round trip',
    domain: 'classes',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const student = await ctx.as('student')
      const subjects = await teacher.request('GET', '/subjects')
      const subjectId = String(listOf(subjects)[0]?.id)
      const cls = dataOf(
        await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas Sertai', subjectId, educationLevel: 'tingkatan-4' } }),
      )

      const joined = await student.request('POST', '/kelas-saya/join', { body: { classCode: String(cls.joinCode).toLowerCase() } })
      ctx.expectStatus(joined, 201)
      expectError(ctx, await student.request('POST', '/kelas-saya/join', { body: { classCode: String(cls.joinCode) } }), 409, 'CONFLICT')
      expectError(ctx, await student.request('POST', '/kelas-saya/join', { body: { classCode: '' } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await student.request('POST', '/kelas-saya/join', { body: { classCode: 'ZZZZZZ' } }), 404, 'NOT_FOUND')
      const mine = await student.request('GET', '/kelas-saya')
      ctx.expectStatus(mine, 200)
      ctx.check(listOf(mine).some((c) => c.id === cls.id), 'joined class missing from Kelas Saya')
      expectError(ctx, await teacher.request('POST', '/kelas-saya/join', { body: { classCode: String(cls.joinCode) } }), 403, 'FORBIDDEN')

      const roster = await teacher.request('GET', '/guru/students')
      ctx.expectStatus(roster, 200)
      const pupil = listOf(roster).find((s) => Array.isArray(s.classNames) && (s.classNames as unknown[]).includes('Kelas Sertai'))
      ctx.check(pupil !== undefined, 'joined pupil missing from the roster')
      const pupilId = String(pupil?.id)
      expectError(ctx, await teacher.request('PUT', `/guru/students/${pupilId}`, { body: { classroomId: String(cls.id) } }), 409, 'CONFLICT')
      ctx.expectStatus(await teacher.request('DELETE', `/guru/students/${pupilId}?classroomId=${String(cls.id)}`), 200)
      expectError(ctx, await teacher.request('DELETE', `/guru/students/${pupilId}?classroomId=${String(cls.id)}`), 404, 'NOT_FOUND')
      ctx.expectStatus(await teacher.request('PUT', `/guru/students/${pupilId}`, { body: { classroomId: String(cls.id) } }), 200)
    },
  },
  {
    id: 'classes-api/anonymous is 401 and a student is 403 on the teacher routes',
    domain: 'classes',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/guru/classes'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/guru/dashboard'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/kelas-saya'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/kelas-saya/join', { body: {} }), 401, 'UNAUTHORIZED')
      const student = await ctx.as('student')
      expectError(ctx, await student.request('GET', '/guru/classes'), 403, 'FORBIDDEN')
      expectError(ctx, await student.request('POST', '/guru/classes', { body: {} }), 403, 'FORBIDDEN')
      expectError(ctx, await student.request('GET', '/guru/students'), 403, 'FORBIDDEN')
    },
  },
]
