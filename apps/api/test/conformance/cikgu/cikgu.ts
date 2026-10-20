import type { Scenario, ScenarioContext } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Cikgu Alesa (BE-43) API-only scenarios: all ten operations of M13 (the raw chat turn and the nine teacher tools),
 * the guards and the CSRF check. Deep rules (quota, routing, roll-up maths, CSV content) are in `apps/api/test/cikgu`.
 */

const body = (res: { body: unknown }): Record<string, unknown> => (res.body !== null && typeof res.body === 'object' ? (res.body as Record<string, unknown>) : {})

const handoffMessage = (): string =>
  'Tolong mark karangan ini menggunakan rubric PT3 Bahasa Melayu — Karangan (30 markah). Subjek: Bahasa Melayu. Level: T3. Pelajar: Murid Konformans. Tajuk: Hari Sukan. Karangan: Pada hari sukan kami bermain dengan jujur.'

function expectEmptyObject(ctx: ScenarioContext, res: { body: unknown }, what: string): void {
  ctx.check(JSON.stringify(res.body) === '{}', `${what}: body must be exactly {}`)
}

export const cikguScenarios: Scenario[] = [
  {
    id: 'cikgu-api/chat: a guest is 401 {}, a missing CSRF header is 403, a blank message is 422 {}',
    domain: 'cikgu',
    targets: API_ONLY,
    async run(ctx) {
      const guest = await ctx.anonymous().request('POST', '/cikgu/send', { body: { message: 'hai' } })
      ctx.expectStatus(guest, 401)
      expectEmptyObject(ctx, guest, 'guest')
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('POST', '/cikgu/send', { body: { message: 'hai' } }), 403, 'CSRF_INVALID')
      const blank = await (await ctx.as('student')).request('POST', '/cikgu/send', { body: { message: '   ', thread_id: null } })
      ctx.expectStatus(blank, 422)
      expectEmptyObject(ctx, blank, 'blank message')
      const tooLong = await (await ctx.as('student')).request('POST', '/cikgu/send', { body: { message: 'a'.repeat(2001) } })
      ctx.expectStatus(tooLong, 422)
      ctx.check(body(tooLong).code === 'VALIDATION_ERROR' && typeof body(tooLong).error === 'string', 'over-long message must be the raw VALIDATION_ERROR body')
    },
  },
  {
    id: 'cikgu-api/chat: the raw turn for a student and a teacher, thread continuation, practice, RPH and essay tools',
    domain: 'cikgu',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const first = await student.request('POST', '/cikgu/send', { body: { message: 'Terangkan konsep mol', thread_id: null } })
      ctx.expectStatus(first, 200)
      ctx.check(first.headers['cache-control'] === 'no-store', 'the chat answer must be no-store')
      ctx.check(body(first).data === undefined && body(first).tier === 'pelajar' && body(first).tool_hops === 0, 'raw body of a student turn differs')
      ctx.check(typeof body(first).thread_id === 'string' && /^[1-9]\d*$/.test(String(body(first).thread_id)), 'thread_id must be a decimal string')

      const teacher = await ctx.as('teacher')
      const turn = await teacher.request('POST', '/cikgu/send', { body: { message: 'Terangkan konsep mol' } })
      ctx.expectStatus(turn, 200)
      ctx.check(body(turn).tier === 'guru', 'a teacher turn is tier guru')
      const threadId = String(body(turn).thread_id)
      const practice = await teacher.request('POST', '/cikgu/send', { body: { message: 'Minta latihan soalan', thread_id: threadId } })
      ctx.check(body(practice).thread_id === threadId && body(practice).tool_hops === 1, 'practice turn must continue the thread with one hop')
      const follow = await teacher.request('POST', '/cikgu/send', { body: { message: 'Tolong jana RPH untuk esok' } })
      ctx.check(body(follow).tool_hops === 0, 'an RPH request without subject and level asks a follow-up')
      const rph = await teacher.request('POST', '/cikgu/send', { body: { message: 'Tolong jana RPH untuk Matematik T4 Bab 3 esok' } })
      ctx.check(body(rph).tool_hops === 1 && String(body(rph).reply).includes('"Bab 3" (Matematik, Tingkatan 4)'), 'a complete RPH request must save a plan')
      const mark = await teacher.request('POST', '/cikgu/send', { body: { message: handoffMessage() } })
      ctx.expectStatus(mark, 200)
      ctx.check(body(mark).tool_hops === 1 && String(body(mark).reply).startsWith('Markah: 21/30\n'), 'the hand-off must be marked 21/30')
    },
  },
  {
    id: 'cikgu-api/teacher tools: RPH create, list and detail, validation and 404',
    domain: 'cikgu',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const created = await teacher.request('POST', '/cikgu/rph', { body: { subjectName: 'Kimia', level: 'T5', tajuk: 'Elektrolisis', durationMinutes: 90, className: '5 Contoh' } })
      ctx.expectStatus(created, 201)
      const rph = dataOf(created)
      ctx.check(rph.source === 'form' && rph.status === 'generated' && rph.threadId === null && rph.durationMinutes === 90, 'created RPH differs')
      const list = await teacher.request('GET', '/cikgu/rph')
      ctx.expectStatus(list, 200)
      ctx.check(list.headers['cache-control'] === 'no-store', 'the RPH list must be no-store')
      ctx.check(listOf(list).some((x) => x.id === rph.id), 'created RPH missing from the list')
      const detail = await teacher.request('GET', `/cikgu/rph/${String(rph.id)}`)
      ctx.expectStatus(detail, 200)
      ctx.check(String(dataOf(detail).content).includes('Set Induksi (9 minit)'), 'the 90 minute plan splits 9/22/22/23/14')
      const bad = await teacher.request('POST', '/cikgu/rph', { body: { level: 'T9' } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check(Object.keys((errorOf(bad).fields as Record<string, string>) ?? {}).join(',') === 'subjectName,level,tajuk', 'validation fields differ')
      expectError(ctx, await teacher.request('GET', '/cikgu/rph/987654321'), 404, 'NOT_FOUND')
      expectError(ctx, await teacher.request('GET', '/cikgu/rph/abc'), 404, 'NOT_FOUND')
      // Another teacher-role user (the admin) does not see the teacher's plan.
      const admin = await ctx.as('admin')
      expectError(ctx, await admin.request('GET', `/cikgu/rph/${String(rph.id)}`), 404, 'NOT_FOUND')
      ctx.check(listOf(await admin.request('GET', '/cikgu/rph')).every((x) => x.id !== rph.id), 'the admin must not see the teacher plan')
    },
  },
  {
    id: 'cikgu-api/teacher tools: essay markings, PBD queue, roll-up, bulk approve and CSV export',
    domain: 'cikgu',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      ctx.expectStatus(await teacher.request('POST', '/cikgu/send', { body: { message: handoffMessage() } }), 200)
      const essays = await teacher.request('GET', '/cikgu/essays')
      ctx.expectStatus(essays, 200)
      const first = listOf(essays)[0]
      ctx.check(first !== undefined && first.marks === 21 && first.maxMarks === 30 && first.rubricKey === 'pt3_bm_karangan', 'the newest marking differs')
      const one = await teacher.request('GET', `/cikgu/essays/${String(first?.id)}`)
      ctx.expectStatus(one, 200)
      ctx.check(dataOf(one).essayText === 'Pada hari sukan kami bermain dengan jujur.' && dataOf(one).studentName === 'Murid Konformans', 'the marking detail differs')
      expectError(ctx, await teacher.request('GET', '/cikgu/essays/987654321'), 404, 'NOT_FOUND')
      expectError(ctx, await (await ctx.as('admin')).request('GET', `/cikgu/essays/${String(first?.id)}`), 404, 'NOT_FOUND')

      ctx.expectStatus(await teacher.request('GET', '/cikgu/pbd'), 200)
      const subjects = await teacher.request('GET', '/subjects')
      const subjectId = String(listOf(subjects)[0]?.id)
      const cls = dataOf(await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas Cikgu Konformans', subjectId, educationLevel: 'tingkatan-4' } }))
      const rolled = await teacher.request('POST', '/cikgu/pbd/rollup', { body: { classroomId: String(cls.id) } })
      ctx.expectStatus(rolled, 200)
      ctx.check(JSON.stringify(dataOf(rolled)) === '{"created":0,"updated":0,"skipped":0}', 'a class without answers rolls up to zeros')
      const foreign = await (await ctx.as('admin')).request('POST', '/cikgu/pbd/rollup', { body: { classroomId: String(cls.id) } })
      ctx.check(JSON.stringify(dataOf(foreign)) === '{"created":0,"updated":0,"skipped":0}', 'a foreign class rolls up to zeros')
      const approve = await teacher.request('POST', '/cikgu/pbd/bulk-approve', { body: { ids: ['987654321', 'x'] } })
      ctx.expectStatus(approve, 200)
      ctx.check(dataOf(approve).approved === 0, 'unknown ids approve nothing')
      expectError(ctx, await teacher.request('POST', '/cikgu/pbd/bulk-approve', { body: { ids: Array.from({ length: 101 }, (_, i) => String(i + 1)) } }), 422, 'VALIDATION_ERROR')

      const csv = await teacher.request('GET', '/cikgu/pbd/export.csv')
      ctx.expectStatus(csv, 200)
      ctx.check((csv.headers['content-type'] ?? '').startsWith('text/csv'), 'the export is text/csv')
      ctx.check(csv.headers['content-disposition'] === 'attachment; filename="pbd-approved.csv"', 'the export is an attachment')
      ctx.check(csv.headers['cache-control'] === 'no-store', 'the export is no-store')
    },
  },
  {
    id: 'cikgu-api/teacher tools: a guest is 401, a student 403, a write without CSRF is 403 CSRF_INVALID',
    domain: 'cikgu',
    targets: API_ONLY,
    async run(ctx) {
      const routes: ['GET' | 'POST', string, unknown?][] = [
        ['GET', '/cikgu/rph'],
        ['POST', '/cikgu/rph', {}],
        ['GET', '/cikgu/rph/1'],
        ['GET', '/cikgu/essays'],
        ['GET', '/cikgu/essays/1'],
        ['GET', '/cikgu/pbd'],
        ['POST', '/cikgu/pbd/rollup', {}],
        ['POST', '/cikgu/pbd/bulk-approve', {}],
        ['GET', '/cikgu/pbd/export.csv'],
      ]
      const anon = ctx.anonymous()
      const student = await ctx.as('student')
      for (const [method, path, payload] of routes) {
        const init = payload === undefined ? {} : { body: payload }
        expectError(ctx, await anon.request(method, path, init), 401, 'UNAUTHORIZED')
        expectError(ctx, await student.request(method, path, init), 403, 'FORBIDDEN')
      }
      const noCsrf = await ctx.as('teacher', { csrf: false })
      for (const [method, path, payload] of routes.filter((r) => r[0] === 'POST')) expectError(ctx, await noCsrf.request(method, path, { body: payload }), 403, 'CSRF_INVALID')
    },
  },
]
