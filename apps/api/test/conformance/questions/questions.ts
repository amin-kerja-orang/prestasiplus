import { sessionLogin, type HttpClient, type Scenario, type ScenarioContext } from '@pp/contract-tests'

import { DEMO_PASSWORD, DUAL_ROLE_ACCOUNT } from '../accounts'
import { API_ONLY, dataOf, errorOf, expectError, listOf, nextTag } from '../helpers'

/**
 * Question bank (BE-09) scenarios. They need a cookie session with CSRF, two teachers and seeded
 * data, so they run on the API target only. Every body is parsed against the contract by the runner.
 *
 * Seed facts used (prisma/seed/questions): published single MCQ rows owned by the seeded admin with
 * the full curriculum tag, and one `review` row owned by the seeded teacher (`guru@demo.test`).
 * Questions created here are deleted at the end of the scenario that creates them.
 */

type Json = Record<string, unknown>

const FLASH = { added: 'Soalan berjaya ditambah.', updated: 'Soalan berjaya dikemaskini.', deleted: 'Soalan berjaya dipadam.' }

function flashOf(res: { body: unknown }): unknown {
  return (res.body as { status?: unknown } | null)?.status
}

/** Subject, level and curriculum tag of a seeded published question, to clone into a taggable body. */
async function seededTag(ctx: ScenarioContext, admin: HttpClient): Promise<{ subjectId: string; educationLevelId: string; tag: Json }> {
  const list = await admin.request('GET', '/questions?status=published&pageSize=5')
  ctx.expectStatus(list, 200)
  const id = String(listOf(list)[0]?.id)
  const detail = await admin.request('GET', `/questions/${id}`)
  ctx.expectStatus(detail, 200)
  const d = dataOf(detail)
  const tag = d.tag as Json | undefined
  ctx.check(tag !== undefined && tag.unitId != null, 'a seeded published question has no curriculum tag in its detail')
  return { subjectId: String(d.subjectId), educationLevelId: String(d.educationLevelId), tag: tag ?? {} }
}

function mcq(tag: string, extra: Json = {}): Json {
  return {
    questionType: 'mcq',
    difficultyLevel: 3,
    questionText: `Soalan konformans ${tag}: yang manakah benar?`,
    options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
    correctAnswer: 1,
    ...extra,
  }
}

/** The teacher client of the second teacher account (`guruadmin@demo.test`), switched to the teacher role. */
async function otherTeacher(ctx: ScenarioContext): Promise<HttpClient> {
  const me = await sessionLogin(ctx.anonymous(), { identifier: DUAL_ROLE_ACCOUNT, password: DEMO_PASSWORD })
  const session = await me.request('GET', '/session')
  const role = (dataOf(session).active as { role?: string } | undefined)?.role
  if (role !== 'teacher') ctx.expectStatus(await me.request('POST', '/session/role', { body: { role: 'teacher' } }), 200)
  return me
}

const ADMIN_ROUTES: Array<[string, string]> = [
  ['GET', '/questions'],
  ['GET', '/questions/summary'],
  ['GET', '/questions/1'],
  ['GET', '/structured-questions'],
  ['GET', '/structured-questions/1'],
  ['POST', '/questions'],
  ['PUT', '/questions/1'],
  ['DELETE', '/questions/1'],
  ['POST', '/questions/bulk-action'],
]
const GURU_ROUTES: Array<[string, string]> = [
  ['GET', '/guru/questions'],
  ['GET', '/guru/questions/1'],
  ['POST', '/guru/questions'],
  ['PUT', '/guru/questions/1'],
  ['DELETE', '/guru/questions/1'],
]

export const questionsScenarios: Scenario[] = [
  {
    id: 'questions-api/admin lifecycle: create, read, update, bulk review/approve, delete',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const base = await seededTag(ctx, admin)
      const tag = nextTag('q')
      const created = await admin.request('POST', '/questions', {
        body: mcq(tag, { subjectId: base.subjectId, educationLevelId: base.educationLevelId }),
      })
      ctx.expectStatus(created, 201)
      ctx.check(flashOf(created) === FLASH.added, `create flash was ${String(flashOf(created))}`)
      const id = String(dataOf(created).id)
      ctx.check(dataOf(created).status === 'draft', 'a new question is not a draft')

      const detail = await admin.request('GET', `/questions/${id}`)
      ctx.expectStatus(detail, 200)
      ctx.check(dataOf(detail).correctAnswer === 1, 'the admin detail lost the MCQ key')

      const updated = await admin.request('PUT', `/questions/${id}`, {
        body: {
          subjectId: base.subjectId,
          educationLevelId: base.educationLevelId,
          difficultyLevel: 4,
          questionText: `Soalan konformans ${tag} yang telah dikemaskini.`,
        },
      })
      ctx.expectStatus(updated, 200)
      ctx.check(flashOf(updated) === FLASH.updated, `update flash was ${String(flashOf(updated))}`)

      // Duplicate and unknown ids are counted once / skipped.
      const review = await admin.request('POST', '/questions/bulk-action', { body: { action: 'review', ids: [id, id, '999999999'] } })
      ctx.expectStatus(review, 200)
      ctx.check((dataOf(review).affected as number) === 1, `bulk review affected ${String(dataOf(review).affected)}, expected 1`)
      ctx.check(flashOf(review) === '1 soalan berjaya dikemaskini.', `bulk flash was ${String(flashOf(review))}`)
      const approved = await admin.request('POST', '/questions/bulk-action', { body: { action: 'approved', ids: [id] } })
      ctx.check((dataOf(approved).affected as number) === 1, 'bulk approved did not affect the question')
      // approved -> review is not a transition: nothing is affected and the status is unchanged.
      const skipped = await admin.request('POST', '/questions/bulk-action', { body: { action: 'review', ids: [id] } })
      ctx.expectStatus(skipped, 200)
      ctx.check((dataOf(skipped).affected as number) === 0, 'approved -> review was applied')
      ctx.check(listOf(await admin.request('GET', `/questions?status=approved&search=${tag}`)).length === 1, 'the question is not listed as approved')

      const removed = await admin.request('DELETE', `/questions/${id}`)
      ctx.expectStatus(removed, 200)
      ctx.check(dataOf(removed).deleted === 1, 'DELETE did not answer { deleted: 1 }')
      ctx.check(flashOf(removed) === FLASH.deleted, `delete flash was ${String(flashOf(removed))}`)
      expectError(ctx, await admin.request('GET', `/questions/${id}`), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('DELETE', `/questions/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'questions-api/publish gate: no tags is 422, tagged publishes, editing a published question makes a draft',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const base = await seededTag(ctx, admin)
      const tag = nextTag('q')

      const untagged = await admin.request('POST', '/questions', {
        body: mcq(tag, { subjectId: base.subjectId, educationLevelId: base.educationLevelId, status: 'published' }),
      })
      expectError(ctx, untagged, 422, 'VALIDATION_ERROR')
      const fields = errorOf(untagged).fields as Json | undefined
      ctx.check(fields !== undefined && Object.keys(fields).length > 0, 'the publish gate 422 has no fields')

      const published = await admin.request('POST', '/questions', {
        body: mcq(`${tag}b`, { subjectId: base.subjectId, educationLevelId: base.educationLevelId, tag: base.tag, status: 'published' }),
      })
      ctx.expectStatus(published, 201)
      const id = String(dataOf(published).id)
      ctx.check(dataOf(published).status === 'published', 'a tagged question created as published is not published')

      // Q-5: PUT on a published question makes version n+1 as a draft; the list shows the latest version.
      const edited = await admin.request('PUT', `/questions/${id}`, {
        body: {
          subjectId: base.subjectId,
          educationLevelId: base.educationLevelId,
          difficultyLevel: 2,
          questionText: `Soalan konformans ${tag}b selepas suntingan.`,
        },
      })
      ctx.expectStatus(edited, 200)
      ctx.check(dataOf(edited).status === 'draft', `PUT on a published question answered status ${String(dataOf(edited).status)}, expected draft`)

      // Taking it down: draft cannot be published directly, so the bulk publish touches nothing.
      const direct = await admin.request('POST', '/questions/bulk-action', { body: { action: 'published', ids: [id] } })
      ctx.expectStatus(direct, 200)
      ctx.check((dataOf(direct).affected as number) === 0, 'draft -> published was applied')
      ctx.expectStatus(await admin.request('DELETE', `/questions/${id}`), 200)
    },
  },
  {
    id: 'questions-api/status codes: pending_review, rejected and the mock verbs are 422',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const base = await seededTag(ctx, admin)
      const bad = await admin.request('POST', '/questions', {
        body: mcq(nextTag('q'), { subjectId: base.subjectId, educationLevelId: base.educationLevelId, status: 'pending_review' }),
      })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(bad).fields as Json | undefined)?.status !== undefined, 'POST status pending_review has no fields.status')
      for (const status of ['pending_review', 'rejected', 'nonsense']) {
        const res = await admin.request('GET', `/questions?status=${status}`)
        expectError(ctx, res, 422, 'VALIDATION_ERROR')
        ctx.check((errorOf(res).fields as Json | undefined)?.status !== undefined, `GET ?status=${status} has no fields.status`)
      }
      for (const action of ['approve', 'reject', 'pending_review']) {
        expectError(ctx, await admin.request('POST', '/questions/bulk-action', { body: { action, ids: ['1'] } }), 422, 'VALIDATION_ERROR')
      }
      // The list never carries a mock status.
      const all = await admin.request('GET', '/questions?pageSize=100')
      const allowed = new Set(['draft', 'review', 'approved', 'published', 'archived'])
      ctx.check(listOf(all).every((q) => allowed.has(String(q.status))), 'a list row carries a status outside the v2 codes')
    },
  },
  {
    id: 'questions-api/input is validated: BM messages keyed by field',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const none = await admin.request('POST', '/questions', { body: { questionType: 'mcq' } })
      expectError(ctx, none, 422, 'VALIDATION_ERROR')
      const fields = errorOf(none).fields as Json | undefined
      for (const key of ['subjectId', 'educationLevelId', 'difficultyLevel', 'questionText']) {
        ctx.check(fields?.[key] !== undefined, `missing ${key} has no fields.${key}`)
      }
      const base = await seededTag(ctx, admin)
      const three = await admin.request('POST', '/questions', {
        body: mcq(nextTag('q'), { subjectId: base.subjectId, educationLevelId: base.educationLevelId, options: ['a', 'b', 'c'] }),
      })
      expectError(ctx, three, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(three).fields as Json | undefined)?.options !== undefined, 'a bad option list is not reported under fields.options')
      // A bulk action needs ids.
      expectError(ctx, await admin.request('POST', '/questions/bulk-action', { body: { action: 'review', ids: [] } }), 422, 'VALIDATION_ERROR')
    },
  },
  {
    id: 'questions-api/list, summary and structured reads answer the contract',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const list = await admin.request('GET', '/questions')
      ctx.expectStatus(list, 200)
      const meta = (list.body as { meta?: Json }).meta ?? {}
      ctx.check(meta.pageSize === 20, `default page size is ${String(meta.pageSize)}, expected 20`)
      ctx.check(listOf(list).length <= 20, 'the first page has more than 20 rows')
      const first = listOf(list)[0]
      ctx.check(first !== undefined && !('correctAnswer' in first), 'a list row carries the answer key')
      // Unknown filter values match nothing (not an error).
      const none = await admin.request('GET', '/questions?subjectId=999999999')
      ctx.expectStatus(none, 200)
      ctx.check(listOf(none).length === 0, 'an unknown subject filter matched rows')

      const summary = await admin.request('GET', '/questions/summary')
      ctx.expectStatus(summary, 200)
      const total = dataOf(summary).total as number
      ctx.check(total === ((list.body as { meta?: { totalItems?: number } }).meta?.totalItems ?? -1), 'summary.total differs from the list total')

      const structured = await admin.request('GET', '/structured-questions')
      ctx.expectStatus(structured, 200)
      const stats = ((structured.body as { meta?: { stats?: Json } }).meta?.stats ?? {}) as Json
      ctx.check(typeof stats.total === 'number' && typeof stats.published === 'number', 'structured meta.stats is incomplete')
      const row = listOf(structured)[0]
      ctx.check(row !== undefined, 'no seeded structured question')
      ctx.expectStatus(await admin.request('GET', `/structured-questions/${String(row?.id)}`), 200)
      expectError(ctx, await admin.request('GET', '/structured-questions/999999999'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'questions-api/Guru contribution: saved as review, own rows only, another teacher gets 404',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const admin = await ctx.as('admin')
      const other = await otherTeacher(ctx)
      const base = await seededTag(ctx, admin)
      const tag = nextTag('g')

      const created = await teacher.request('POST', '/guru/questions', {
        body: mcq(tag, { subjectId: base.subjectId, educationLevelId: base.educationLevelId }),
      })
      ctx.expectStatus(created, 201)
      const id = String(dataOf(created).id)
      ctx.check(dataOf(created).status === 'review', `a Guru submission is ${String(dataOf(created).status)}, expected review`)

      const mine = await teacher.request('GET', '/guru/questions')
      ctx.expectStatus(mine, 200)
      ctx.check(listOf(mine).some((q) => q.id === id), 'the Guru list does not show the own question')
      ctx.expectStatus(await teacher.request('GET', `/guru/questions/${id}`), 200)

      // Another teacher and the admin do not see it on the Guru routes; ids cannot be probed.
      for (const who of [other, admin]) {
        ctx.check(!listOf(await who.request('GET', '/guru/questions')).some((q) => q.id === id), 'another account lists a foreign Guru question')
        expectError(ctx, await who.request('GET', `/guru/questions/${id}`), 404, 'NOT_FOUND')
        expectError(ctx, await who.request('PUT', `/guru/questions/${id}`, { body: { questionText: 'Teks pengganti yang sah.' } }), 404, 'NOT_FOUND')
        expectError(ctx, await who.request('DELETE', `/guru/questions/${id}`), 404, 'NOT_FOUND')
      }

      const edited = await teacher.request('PUT', `/guru/questions/${id}`, { body: { questionText: `Soalan Guru ${tag} yang disunting.` } })
      ctx.expectStatus(edited, 200)
      const removed = await teacher.request('DELETE', `/guru/questions/${id}`)
      ctx.expectStatus(removed, 200)
      ctx.check(dataOf(removed).removed === 1, 'DELETE did not answer { removed: 1 }')
      expectError(ctx, await teacher.request('GET', `/guru/questions/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'questions-api/Guru input is validated with the mock BM copy',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const empty = await teacher.request('POST', '/guru/questions', { body: { questionType: 'mcq' } })
      expectError(ctx, empty, 422, 'VALIDATION_ERROR')
      const fields = (errorOf(empty).fields ?? {}) as Json
      const text = (key: string): string => JSON.stringify(fields[key] ?? '')
      ctx.check(text('educationLevelId').includes('Sila pilih tahap pendidikan.'), 'educationLevelId message is not the mock copy')
      ctx.check(text('subjectId').includes('Sila pilih subjek.'), 'subjectId message is not the mock copy')
      ctx.check(text('questionText').includes('Sila isi soalan.'), 'questionText message is not the mock copy')
    },
  },
  {
    id: 'questions-api/roles: student, school admin and teacher are 403 on admin routes, anonymous is 401',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const [method, path] of [...ADMIN_ROUTES, ...GURU_ROUTES]) {
        expectError(ctx, await anon.request(method as 'GET', path), 401, 'UNAUTHORIZED')
      }
      for (const role of ['student', 'school_admin'] as const) {
        const who = await ctx.as(role)
        for (const [method, path] of [...ADMIN_ROUTES, ...GURU_ROUTES]) {
          const res = await who.request(method as 'GET', path)
          ctx.check(res.status === 403, `${role} ${method} ${path} answered ${String(res.status)}, expected 403`)
          // No key, scheme or source reaches a forbidden caller.
          const raw = JSON.stringify(res.body ?? {})
          ctx.check(!/correctAnswer|tfAnswer|modelAnswer|sourceFile|"key"/.test(raw), `${role} ${method} ${path} body leaks answer material`)
        }
      }
      const teacher = await ctx.as('teacher')
      for (const [method, path] of ADMIN_ROUTES) {
        const res = await teacher.request(method as 'GET', path)
        ctx.check(res.status === 403, `teacher ${method} ${path} answered ${String(res.status)}, expected 403`)
      }
    },
  },
  {
    id: 'questions-api/a write without the CSRF token is 403 CSRF_INVALID',
    domain: 'questions',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin', { csrf: false })
      const teacher = await ctx.as('teacher', { csrf: false })
      expectError(ctx, await admin.request('POST', '/questions', { body: {} }), 403, 'CSRF_INVALID')
      expectError(ctx, await admin.request('POST', '/questions/bulk-action', { body: { action: 'review', ids: ['1'] } }), 403, 'CSRF_INVALID')
      expectError(ctx, await admin.request('DELETE', '/questions/1'), 403, 'CSRF_INVALID')
      expectError(ctx, await teacher.request('POST', '/guru/questions', { body: {} }), 403, 'CSRF_INVALID')
      expectError(ctx, await teacher.request('DELETE', '/guru/questions/1'), 403, 'CSRF_INVALID')
    },
  },
]
