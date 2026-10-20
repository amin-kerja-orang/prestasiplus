import type { Scenario, ScenarioContext } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError, listOf } from '../helpers'

/**
 * Audio KBAT (BE-24 part C) scenarios: the admin creates sets (JSON body, the multipart path is covered by the
 * integration specs), a student lists, plays and submits, and the answer key never appears on the wire.
 * API target only (cookie session with CSRF).
 */

const questions = (correct: string) =>
  Array.from({ length: 30 }, (_, i) => ({
    no: i + 1,
    questionText: `Soalan ${String(i + 1)}?`,
    optionA: 'A',
    optionB: 'B',
    optionC: 'C',
    optionD: 'D',
    correctAnswer: correct,
    marks: 2,
    explanation: 'Penjelasan rahsia',
  }))

const sections = [1, 2, 3, 4].map((n) => ({ no: n, title: `Bahagian ${String(n)}` }))

function setBody(title: string, status: string, levelId = '10', subjectId = '1') {
  return { title, educationLevelId: levelId, subjectId, status, sections, questions: questions('B') }
}

/** Every key name found anywhere in a JSON value. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysOf(v, into)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k)
      keysOf(v, into)
    }
  }
  return into
}

/** The first seeded education level and subject (BE-08 seed), as `{ id, name }`. */
async function curriculumRefs(ctx: ScenarioContext): Promise<{ levelId: string; subjectId: string }> {
  const student = await ctx.as('student')
  const levels = listOf(await student.request('GET', '/education-levels'))
  const subjects = listOf(await student.request('GET', '/subjects'))
  ctx.check(levels.length > 0 && subjects.length > 0, 'the conformance database must hold seeded levels and subjects')
  return { levelId: String(levels[0]?.id), subjectId: String(subjects[0]?.id) }
}

async function createSet(ctx: ScenarioContext, title: string, status: string): Promise<string> {
  const admin = await ctx.as('admin')
  const { levelId, subjectId } = await curriculumRefs(ctx)
  const res = await admin.request('POST', '/admin/audio-kbat-sets', { body: setBody(title, status, levelId, subjectId) })
  ctx.expectStatus(res, 201)
  return String(dataOf(res).id)
}

export const audioScenarios: Scenario[] = [
  {
    id: 'audio-kbat-api/play: list shows approved sets only, detail has no answer key, the attempt is marked on the server',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const approved = await createSet(ctx, 'Set Konformans Lulus', 'approved')
      const draft = await createSet(ctx, 'Set Konformans Draf', 'draft')
      const student = await ctx.as('student')

      const { levelId, subjectId } = await curriculumRefs(ctx)
      const list = await student.request('GET', `/audio-kbat-sets?educationLevelId=${levelId}&subjectId=${subjectId}`)
      ctx.expectStatus(list, 200)
      const ids = listOf(list).map((r) => String(r.id))
      ctx.check(ids.includes(approved) && !ids.includes(draft), 'the list must hold the approved set and not the draft')
      ctx.check(listOf(list).every((r) => typeof (r.subject as { name?: string }).name === 'string' && (r.subject as { name: string }).name !== ''), 'the subject name must be resolved')

      const detail = await student.request('GET', `/audio-kbat-sets/${approved}`)
      ctx.expectStatus(detail, 200)
      const keys = keysOf(detail.body)
      for (const secret of ['correctAnswer', 'explanation', 'kbatLevel', 'dskpSpId']) ctx.check(!keys.has(secret), `the player data leaks ${secret}`)
      ctx.check(!JSON.stringify(detail.body).includes('Penjelasan rahsia'), 'the player data leaks an explanation')

      expectError(ctx, await student.request('GET', `/audio-kbat-sets/${draft}`), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('POST', `/audio-kbat-sets/${draft}/attempts`, { body: { answers: [{ no: 1, choice: 'B' }] } }), 404, 'NOT_FOUND')

      // 10 answers right ("B"), 5 wrong: score = 10 x 2 marks of 60.
      const answers = Array.from({ length: 15 }, (_, i) => ({ no: i + 1, choice: i < 10 ? 'B' : 'C' }))
      const attempt = await student.request('POST', `/audio-kbat-sets/${approved}/attempts`, { body: { answers } })
      ctx.expectStatus(attempt, 201)
      ctx.check(dataOf(attempt).score === 20 && dataOf(attempt).totalMarks === 60, `unexpected result ${JSON.stringify(dataOf(attempt))}`)
    },
  },
  {
    id: 'audio-kbat-api/attempt validation: missing answers is required, bad shapes are invalid',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const id = await createSet(ctx, 'Set Konformans Soalan', 'approved')
      const student = await ctx.as('student')
      const missing = await student.request('POST', `/audio-kbat-sets/${id}/attempts`, { body: {} })
      expectError(ctx, missing, 422, 'VALIDATION_ERROR')
      ctx.check((missing.body as { error?: { fields?: Record<string, string> } }).error?.fields?.answers === 'Medan ini diperlukan.', 'answers missing must be "Medan ini diperlukan."')
      for (const answers of ['A', [{ no: 31, choice: 'A' }], [{ no: 1, choice: 'A' }, { no: 1, choice: 'B' }], [{ no: 1, choice: 'E' }]]) {
        const res = await student.request('POST', `/audio-kbat-sets/${id}/attempts`, { body: { answers } })
        expectError(ctx, res, 422, 'VALIDATION_ERROR')
        ctx.check((res.body as { error?: { fields?: Record<string, string> } }).error?.fields?.answers === 'Medan ini tidak sah.', 'a bad answers value must be "Medan ini tidak sah."')
      }
    },
  },
  {
    id: 'audio-kbat-api/admin: list with stats, template downloads, create validation',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      await createSet(ctx, 'Set Konformans Admin', 'pending_review')
      const list = await admin.request('GET', '/admin/audio-kbat-sets?search=Set%20Konformans%20Admin')
      ctx.expectStatus(list, 200)
      ctx.check(listOf(list).length === 1, 'the search must return the one set')
      ctx.check(listOf(list)[0]?.statusLabel === 'Pending Review', 'statusLabel of pending_review must be "Pending Review"')
      const stats = (list.body as { meta?: { stats?: { sets?: number; draftPending?: number } } }).meta?.stats
      ctx.check((stats?.sets ?? 0) >= 1 && (stats?.draftPending ?? 0) >= 1, 'meta.stats must count every set')

      ctx.expectStatus(await admin.request('GET', '/admin/audio-kbat-sets/template'), 200)
      ctx.expectStatus(await admin.request('GET', '/admin/audio-kbat-sets/template?format=docx'), 200)
      expectError(ctx, await admin.request('GET', '/admin/audio-kbat-sets/template?format=pdf'), 422, 'VALIDATION_ERROR')

      const { levelId, subjectId } = await curriculumRefs(ctx)
      const unknown = await admin.request('POST', '/admin/audio-kbat-sets', { body: setBody('Tahap tiada', 'draft', '999999999', subjectId) })
      expectError(ctx, unknown, 422, 'VALIDATION_ERROR')
      ctx.check((unknown.body as { error?: { fields?: Record<string, string> } }).error?.fields?.educationLevelId === 'Medan ini tidak sah.', 'an unknown level must be "Medan ini tidak sah."')
      const invalid = await admin.request('POST', '/admin/audio-kbat-sets', { body: { title: 'Tanpa soalan', educationLevelId: levelId, subjectId } })
      expectError(ctx, invalid, 422, 'VALIDATION_ERROR')
      const fields = (invalid.body as { error?: { fields?: Record<string, string> } }).error?.fields ?? {}
      ctx.check(fields['questions.1.questionText'] === 'Medan ini diperlukan.', 'a missing question must be reported under questions.1.questionText')
    },
  },
  {
    id: 'audio-kbat-api/stream: session required, approved sets only, a section without audio is 404',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const approved = await createSet(ctx, 'Set Konformans Strim', 'approved')
      const draft = await createSet(ctx, 'Set Konformans Strim Draf', 'draft')
      expectError(ctx, await ctx.anonymous().request('GET', `/audio-kbat-sets/${approved}/sections/1/audio`), 401, 'UNAUTHORIZED')
      const student = await ctx.as('student')
      // the JSON create stores no audio, so every section is without audio (the audio bytes are covered by the integration spec)
      expectError(ctx, await student.request('GET', `/audio-kbat-sets/${approved}/sections/1/audio`), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('GET', `/audio-kbat-sets/${draft}/sections/1/audio`), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('GET', `/audio-kbat-sets/${approved}/sections/9/audio`), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('GET', '/audio-kbat-sets/999999999/sections/1/audio'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'audio-kbat-api/roles: anonymous is 401, a student and a teacher are 403 on the admin routes, a missing CSRF token is 403',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/audio-kbat-sets'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/audio-kbat-sets/1'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/audio-kbat-sets/1/attempts', { body: {} }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/admin/audio-kbat-sets'), 401, 'UNAUTHORIZED')
      for (const role of ['student', 'teacher'] as const) {
        const who = await ctx.as(role)
        expectError(ctx, await who.request('GET', '/admin/audio-kbat-sets'), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('GET', '/admin/audio-kbat-sets/template'), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('POST', '/admin/audio-kbat-sets', { body: {} }), 403, 'FORBIDDEN')
      }
      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/audio-kbat-sets/1/attempts', { body: { answers: [{ no: 1, choice: 'A' }] } }), 403, 'CSRF_INVALID')
      const adminNoCsrf = await ctx.as('admin', { csrf: false })
      expectError(ctx, await adminNoCsrf.request('POST', '/admin/audio-kbat-sets', { body: {} }), 403, 'CSRF_INVALID')
    },
  },
]
