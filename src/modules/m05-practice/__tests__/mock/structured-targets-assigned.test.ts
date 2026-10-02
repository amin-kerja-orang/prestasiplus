/**
 * M05-T2: SRS M05 v1.17 §7 #15–#21 — structured questions (list incl. the SPM variants, answer page,
 * attempt), SPM targets, remedial tests and today's missions. Booted with the real core, M01–M05,
 * M09, M10 (the remedial tests and missions) and M14 at the project clock 2026-09-25 15:40 MYT.
 * The file owns its runtime: its writes (targets of pelajar2, attempts, missions and remedial tests
 * created through the M10 repositories) are made in the order below and nothing else reads them.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock, toIsoMyt } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import { createTestHooks } from '@/mock/testing/hooks'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04, { questions, structured } from '@/modules/m04-question-bank/mock'
import m09 from '@/modules/m09-content/mock'
import m10, { missions, remedialTests } from '@/modules/m10-teacher-class/mock'
import m14 from '@/modules/m14-gamification/mock'

import type {
  MissionItem,
  RemedialTestItem,
  SpmTargets,
  StructuredAttemptResult,
  StructuredCard,
  StructuredDetail,
  StructuredListMeta,
} from '../../api/types'
import m05, { practice } from '../../mock'
import { MISSION_TYPE_LABELS } from '../../mock/handlers/assigned'
import { PREVIEW_LENGTH } from '../../mock/handlers/structured'
import {
  MARK_MIN_CHARS,
  SPM_GRADES,
  SPM_TARGET_SUBJECT_IDS,
  SUBJEKTIF_SUBJECT_IDS,
  band,
  markStructured,
  predictedGrade,
} from '../../mock/repository/structured-rules'
import {
  ADMIN,
  GURU,
  MemoryStorage,
  PELAJAR,
  PELAJAR2,
  type ErrorBody,
  type ListBody,
} from './boot-all'

type Method = 'GET' | 'POST' | 'PUT'
type StructuredList = ListBody<StructuredCard, StructuredListMeta>
type DetailBody = { data: StructuredDetail }

let runtime: MockRuntime
let hooks: Record<string, unknown>

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m09, m10, m14],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  hooks = createTestHooks(runtime, { mode: 'test', target: {} })
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

async function call<T>(userId: number, method: Method, url: string, body?: unknown) {
  const res = await runtime.transport.request({
    method,
    url,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${setUser(userId).token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}
const get = <T>(userId: number, url: string) => call<T>(userId, 'GET', url)
const listOf = (userId: number, url: string) => get<StructuredList>(userId, url)
const hook = <T = unknown>(name: string, ...args: unknown[]): Promise<T> =>
  (hooks[name] as (...a: unknown[]) => Promise<T>)(...args)

const code = (b: unknown) => (b as ErrorBody).error.code

/** The M04 order (created desc, then id asc), read through the public repository. */
const plainIds = (page: number) => structured.visible({ page, pageSize: 20 }).rows.map((q) => q.id)
const count = (subjectId?: number, kbatLevel?: number) =>
  structured.visible({
    ...(subjectId !== undefined ? { subjectId } : {}),
    ...(kbatLevel !== undefined ? { kbatLevel } : {}),
    pageSize: 1,
  }).total

// ---------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------

describe('access (FR-M05-130)', () => {
  it.each<[Method, string, unknown?]>([
    ['GET', '/api/practice/structured'],
    ['GET', '/api/practice/structured/4454'],
    ['POST', '/api/practice/structured/4454/attempts', { answers: [] }],
    ['GET', '/api/spm-targets'],
    ['PUT', '/api/spm-targets', { targets: {} }],
    ['GET', '/api/remedial-tests/mine'],
    ['GET', '/api/missions/today'],
  ])('%s %s answers 401 UNAUTHORIZED without a session', async (method, url, body) => {
    const res = await runtime.transport.request({
      method,
      url,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      ...(body !== undefined ? { body } : {}),
    })
    expect(res.status).toBe(401)
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHORIZED')
  })
})

// ---------------------------------------------------------------------------------------------
// #15 Structured list
// ---------------------------------------------------------------------------------------------

describe('#15 GET /api/practice/structured', () => {
  it('plain S10: the M04 student-visible sets, newest first, 20 per page, 31 subject options', async () => {
    const r = await listOf(PELAJAR, '/api/practice/structured')
    expect(r.status).toBe(200)
    const { data, meta } = r.body
    // M04 FR-M04-115: 4,064 sets, 5 inactive -> 4,059 visible.
    expect(meta).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 4059,
      totalPages: 203,
      from: 1,
      to: 20,
      scope: null,
      track: null,
    })
    expect(data.map((c) => c.id)).toEqual(plainIds(1))
    expect(meta.subjectOptions).toHaveLength(31)
    const names = meta.subjectOptions.map((o) => o.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
  })

  it('card of the M04 anchor 4454 (Perniagaan T5 MOTS 3, 10m, Trial)', async () => {
    const { data } = (await listOf(PELAJAR, '/api/practice/structured?subjectId=23&kbatLevel=3'))
      .body
    expect(data.find((x) => x.id === 4454)).toEqual({
      id: 4454,
      subjectId: 23,
      subjectName: 'Perniagaan',
      kbatLevel: 3,
      estimatedMinutes: 10,
      isTrial: true,
      preview: expect.stringContaining('Baca situasi perniagaan berikut') as string,
      topic: 'Merancang Pengendalian Perniagaan',
      author: 'Guru Pakar',
      school: null,
      subQuestionCount: 1,
      levelName: 'Tingkatan 5',
      parts: 1,
      marks: 8,
    })
  })

  it('card figures are computed from the M04 row (sub-questions, parts, marks, level)', async () => {
    const { data } = (await listOf(PELAJAR, '/api/practice/structured')).body
    for (const c of data) {
      const q = structured.get(c.id)!
      expect(c.subQuestionCount).toBe(q.subQuestions.length)
      expect(c.parts).toBe(q.subQuestions.filter((s) => s.parentSubId === null).length)
      expect(c.marks).toBe(q.totalMarks)
      expect(c.kbatLevel).toBe(q.kbatLevel)
      expect(c.estimatedMinutes).toBe(q.estimatedMinutes)
      expect(c.isTrial).toBe(q.isTrial)
      expect(['Tingkatan 4', 'Tingkatan 5']).toContain(c.levelName)
      expect(c.preview.length).toBeLessThanOrEqual(PREVIEW_LENGTH + 3)
    }
  })

  it('filters subjectId and kbatLevel (AND); the totals are the M04 counts', async () => {
    const r = await listOf(ADMIN, '/api/practice/structured?subjectId=23&kbatLevel=3&page=2')
    expect(r.body.meta.totalItems).toBe(count(23, 3))
    expect(r.body.meta.page).toBe(2)
    expect(r.body.data.every((c) => c.subjectId === 23 && c.kbatLevel === 3)).toBe(true)
    const subjectOnly = await listOf(ADMIN, '/api/practice/structured?subjectId=2')
    expect(subjectOnly.body.meta.totalItems).toBe(count(2))
    const kbatOnly = await listOf(ADMIN, '/api/practice/structured?kbatLevel=6')
    expect(kbatOnly.body.meta.totalItems).toBe(count(undefined, 6))
    expect(kbatOnly.body.meta.totalItems).toBeGreaterThan(0)
  })

  it('empty filter values are kept by the form and mean "all"; unknown values match nothing', async () => {
    const all = await listOf(PELAJAR, '/api/practice/structured?subjectId=&kbatLevel=')
    expect(all.body.meta.totalItems).toBe(4059)
    for (const q of [
      'subjectId=999',
      'subjectId=abc',
      'kbatLevel=9',
      'kbatLevel=x',
      'kbatLevel=0',
    ]) {
      const r = await listOf(PELAJAR, `/api/practice/structured?${q}`)
      expect(r.status, q).toBe(200)
      expect(r.body.data, q).toEqual([])
      expect(r.body.meta, q).toMatchObject({ totalItems: 0, totalPages: 1, from: null, to: null })
    }
  })

  it('a page past the end is an empty page that keeps the requested number', async () => {
    const r = await listOf(PELAJAR, '/api/practice/structured?page=999')
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([])
    expect(r.body.meta).toMatchObject({ page: 999, totalItems: 4059, totalPages: 203 })
    expect((await listOf(PELAJAR, '/api/practice/structured?page=abc')).body.meta.page).toBe(1)
  })

  it('author and school: a teacher creator shows name and school, any other creator "Guru Pakar"', async () => {
    let teacherCards = 0
    for (let p = 1; p <= 30; p++) {
      const { data } = (await listOf(PELAJAR, `/api/practice/structured?page=${String(p)}`)).body
      for (const c of data) {
        const creator = users.get(structured.get(c.id)?.createdBy ?? -1)
        if (creator?.role === 'teacher') {
          teacherCards++
          expect(c.author).toBe(creator.name)
          expect(c.school === null || c.school.length > 0).toBe(true)
        } else {
          expect(c).toMatchObject({ author: 'Guru Pakar', school: null })
        }
      }
    }
    expect(teacherCards).toBeGreaterThan(0)
  })

  describe('scope=spm (Subjektif SPM, FR-M05-133..136)', () => {
    it('lists the 15 Subjektif subjects in the FR-M05-134 order', async () => {
      const r = await listOf(PELAJAR, '/api/practice/structured?scope=spm')
      expect(r.body.meta).toMatchObject({ scope: 'spm', track: null })
      expect(r.body.meta.subjectOptions.map((o) => o.id)).toEqual(SUBJEKTIF_SUBJECT_IDS)
      expect(r.body.meta.subjectOptions.slice(0, 3).map((o) => o.name)).toEqual([
        'Bahasa Melayu',
        'Bahasa Inggeris',
        'Matematik',
      ])
      expect(r.body.meta.totalItems).toBe(SUBJEKTIF_SUBJECT_IDS.reduce((a, id) => a + count(id), 0))
    })

    it('merges the subjects in the M04 order (newest first): pages equal the plain list', async () => {
      // 60 and 150 lie past the first 100-row chunk of every subject cursor (merged()).
      for (const page of [1, 2, 7, 60, 150, 203]) {
        const r = await listOf(PELAJAR, `/api/practice/structured?scope=spm&page=${String(page)}`)
        expect(
          r.body.data.map((c) => c.id),
          `page ${String(page)}`,
        ).toEqual(plainIds(page))
        expect(r.body.meta.from).toBe((page - 1) * 20 + 1)
      }
    })

    it('a subject of the list passes, a subject outside it matches nothing', async () => {
      const inList = await listOf(PELAJAR, '/api/practice/structured?scope=spm&subjectId=3')
      expect(inList.body.meta.totalItems).toBe(count(3))
      expect(inList.body.data.every((c) => c.subjectId === 3)).toBe(true)
      // 6 = Pendidikan Islam: an SPM subject of S15 but not of the Subjektif list.
      const outside = await listOf(PELAJAR, '/api/practice/structured?scope=spm&subjectId=6')
      expect(outside.body.data).toEqual([])
      expect(outside.body.meta.totalItems).toBe(0)
    })
  })

  describe('scope=spm&track=bahasa (Tracking A Bahasa)', () => {
    it('lists BM then BI only, with the two subject options', async () => {
      const r = await listOf(PELAJAR, '/api/practice/structured?scope=spm&track=bahasa')
      expect(r.body.meta).toMatchObject({ scope: 'spm', track: 'bahasa' })
      expect(r.body.meta.subjectOptions.map((o) => o.name)).toEqual([
        'Bahasa Melayu',
        'Bahasa Inggeris',
      ])
      expect(r.body.meta.totalItems).toBe(count(1) + count(2))
      expect(r.body.data.every((c) => c.subjectId === 1)).toBe(true)
    })

    it('BM sets precede BI sets across the page boundary', async () => {
      const bm = count(1)
      const page = Math.floor(bm / 20) + 1
      const r = await listOf(
        PELAJAR,
        `/api/practice/structured?scope=spm&track=bahasa&page=${String(page)}`,
      )
      const split = bm - (page - 1) * 20
      expect(r.body.data.slice(0, split).every((c) => c.subjectId === 1)).toBe(true)
      expect(r.body.data.slice(split).every((c) => c.subjectId === 2)).toBe(true)
      expect(r.body.data.slice(split).length).toBeGreaterThan(0)
      // Each subject keeps the M04 order.
      const bmIds = structured.visible({ subjectId: 1, page, pageSize: 20 }).rows.map((q) => q.id)
      expect(r.body.data.slice(0, split).map((c) => c.id)).toEqual(bmIds.slice(0, split))
      const biIds = structured
        .visible({ subjectId: 2, page: 1, pageSize: 20 })
        .rows.map((q) => q.id)
      expect(r.body.data.slice(split).map((c) => c.id)).toEqual(biIds.slice(0, 20 - split))
    })

    it('kbatLevel passes through (BM KBAT 6 = 3 sets) and a subject filter narrows it', async () => {
      const k6 = await listOf(
        PELAJAR,
        '/api/practice/structured?scope=spm&track=bahasa&kbatLevel=6',
      )
      expect(count(1, 6)).toBe(3)
      expect(k6.body.meta.totalItems).toBe(count(1, 6) + count(2, 6))
      const bi = await listOf(
        PELAJAR,
        '/api/practice/structured?scope=spm&track=bahasa&subjectId=2',
      )
      expect(bi.body.meta.totalItems).toBe(count(2))
      expect(bi.body.data.every((c) => c.subjectId === 2)).toBe(true)
      const other = await listOf(
        PELAJAR,
        '/api/practice/structured?scope=spm&track=bahasa&subjectId=3',
      )
      expect(other.body.data).toEqual([])
    })
  })

  it('an unknown scope is ignored and track needs scope=spm', async () => {
    const a = await listOf(PELAJAR, '/api/practice/structured?scope=foo&track=bahasa')
    expect(a.body.meta).toMatchObject({ scope: null, track: null, totalItems: 4059 })
    const b = await listOf(PELAJAR, '/api/practice/structured?track=bahasa')
    expect(b.body.meta).toMatchObject({ scope: null, track: null, totalItems: 4059 })
    const c = await listOf(PELAJAR, '/api/practice/structured?scope=spm&track=other')
    expect(c.body.meta).toMatchObject({ scope: 'spm', track: null })
  })

  it('every role with a session may read it (guru, admin)', async () => {
    expect((await listOf(GURU, '/api/practice/structured')).status).toBe(200)
    expect((await listOf(ADMIN, '/api/practice/structured')).status).toBe(200)
  })
})

// ---------------------------------------------------------------------------------------------
// #16, #17 Structured answer page and attempt
// ---------------------------------------------------------------------------------------------

describe('#16 GET /api/practice/structured/:id', () => {
  it('returns the stimulus and the sub-questions with marks, and no model answer', async () => {
    const r = await get<DetailBody>(PELAJAR, '/api/practice/structured/3704')
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      id: 3704,
      subjectId: 2,
      subjectName: 'Bahasa Inggeris',
      levelName: 'Tingkatan 5',
      stimulusImage: null,
      backUrl: '/latihan-berstruktur',
    })
    expect(r.body.data.subQuestions.map((s) => [s.label, s.marks])).toEqual([
      ['a', 2],
      ['b', 2],
      ['c', 3],
      ['d', 3],
    ])
    expect(JSON.stringify(r.body)).not.toContain('modelAnswer')
  })

  it('backUrl follows scope and track (FR-M05-137)', async () => {
    const spm = await get<DetailBody>(PELAJAR, '/api/practice/structured/3704?scope=spm')
    expect(spm.body.data.backUrl).toBe('/latihan-berstruktur?subject_id=2&scope=spm')
    const bahasa = await get<DetailBody>(
      PELAJAR,
      '/api/practice/structured/3704?scope=spm&track=bahasa',
    )
    expect(bahasa.body.data.backUrl).toBe(
      '/latihan-berstruktur?subject_id=2&scope=spm&track=bahasa',
    )
    const loose = await get<DetailBody>(PELAJAR, '/api/practice/structured/3704?track=bahasa')
    expect(loose.body.data.backUrl).toBe('/latihan-berstruktur')
    // An unknown scope is ignored, like on #15.
    const foo = await get<DetailBody>(
      PELAJAR,
      '/api/practice/structured/3704?scope=foo&track=bahasa',
    )
    expect(foo.body.data.backUrl).toBe('/latihan-berstruktur')
  })

  it('404 for an unknown id, an inactive set (3699, 3703, 2509) and a non-numeric id', async () => {
    for (const id of ['1', '99999999', '3699', '3703', '2509', 'abc']) {
      const r = await get<ErrorBody>(PELAJAR, `/api/practice/structured/${id}`)
      expect(r.status, id).toBe(404)
      expect(code(r.body), id).toBe('NOT_FOUND')
    }
  })
})

describe('#17 POST /api/practice/structured/:id/attempts', () => {
  const subs = () => structured.get(3704)!.subQuestions
  const long = 'Jawapan yang cukup panjang untuk markah penuh.'
  const post = (userId: number, body: unknown, id = 3704) =>
    call<{ data?: StructuredAttemptResult } & Partial<ErrorBody>>(
      userId,
      'POST',
      `/api/practice/structured/${String(id)}/attempts`,
      body,
    )

  it('marks with the placeholder rule, stores the attempt and returns the model answers', async () => {
    const [a, b, c, d] = subs()
    const r = await post(PELAJAR, {
      answers: [
        { subQuestionId: a!.id, text: long },
        { subQuestionId: b!.id, text: 'terlalu pendek' },
        { subQuestionId: c!.id, text: 'x'.repeat(MARK_MIN_CHARS) },
        { subQuestionId: d!.id, text: '   ' + 'y'.repeat(MARK_MIN_CHARS - 1) + '   ' },
      ],
      scope: 'spm',
      track: null,
    })
    expect(r.status).toBe(201)
    const out = r.body.data!
    expect(out).toMatchObject({
      userId: PELAJAR,
      structuredQuestionId: 3704,
      scope: 'spm',
      track: null,
      totalAwarded: 2 + 3,
      totalMax: 10,
    })
    expect(out.id).toMatch(/^sa_/)
    expect(out.submittedAt).toBe(toIsoMyt(runtime.clock.now()))
    expect(out.marks).toEqual([
      { subQuestionId: a!.id, awarded: 2, max: 2 },
      { subQuestionId: b!.id, awarded: 0, max: 2 },
      { subQuestionId: c!.id, awarded: 3, max: 3 },
      { subQuestionId: d!.id, awarded: 0, max: 3 },
    ])
    expect(out.modelAnswers.map((m) => m.subQuestionId)).toEqual(subs().map((s) => s.id))
    expect(out.modelAnswers.every((m) => m.text.length > 0)).toBe(true)
    expect(practice.structuredAttempts(PELAJAR).map((x) => x.id)).toContain(out.id)
  })

  it('stores scope spm + track bahasa; missing answers score 0; attempts are per user', async () => {
    const before = practice.structuredAttempts(ADMIN).length
    const r = await post(ADMIN, { answers: [], scope: 'spm', track: 'bahasa' })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({
      scope: 'spm',
      track: 'bahasa',
      totalAwarded: 0,
      totalMax: 10,
    })
    expect(practice.structuredAttempts(ADMIN)).toHaveLength(before + 1)
    expect(practice.structuredAttempts(PELAJAR).every((x) => x.userId === PELAJAR)).toBe(true)
  })

  it('scope and track default to null', async () => {
    const r = await post(PELAJAR2, { answers: [] })
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({ scope: null, track: null })
  })

  it('422 VALIDATION_ERROR for a malformed body, and nothing is stored', async () => {
    const before = practice.structuredAttempts(GURU).length
    const sub = subs()[0]!.id
    const cases: [string, unknown, string][] = [
      ['no answers', {}, 'answers'],
      ['answers not an array', { answers: 'x' }, 'answers'],
      ['unknown sub-question', { answers: [{ subQuestionId: 1, text: 'abc' }] }, 'answers.0'],
      ['text not a string', { answers: [{ subQuestionId: sub, text: 5 }] }, 'answers.0'],
      ['entry not an object', { answers: ['x'] }, 'answers.0'],
      [
        'duplicate sub-question',
        {
          answers: [
            { subQuestionId: sub, text: 'a' },
            { subQuestionId: sub, text: 'b' },
          ],
        },
        'answers.1',
      ],
      ['too long', { answers: [{ subQuestionId: sub, text: 'x'.repeat(5001) }] }, 'answers.0'],
      ['unknown scope', { answers: [], scope: 'x' }, 'scope'],
      ['track without scope', { answers: [], track: 'bahasa' }, 'track'],
      ['unknown track', { answers: [], scope: 'spm', track: 'x' }, 'track'],
    ]
    for (const [name, body, field] of cases) {
      const r = await post(GURU, body)
      expect(r.status, name).toBe(422)
      expect(code(r.body), name).toBe('VALIDATION_ERROR')
      const fields = (r.body as { error: { fields?: Record<string, string> } }).error.fields ?? {}
      expect(Object.keys(fields), name).toContain(field)
    }
    expect(practice.structuredAttempts(GURU)).toHaveLength(before)
  })

  it('404 for an unknown or inactive set', async () => {
    for (const id of [1, 3699, 99999999]) {
      const r = await post(PELAJAR, { answers: [] }, id)
      expect(r.status, String(id)).toBe(404)
    }
  })
})

describe('markStructured (section 6.13 placeholder)', () => {
  const s = [
    { id: 1, marks: 2 },
    { id: 2, marks: 3 },
  ]
  it('gives full marks from 20 characters (trimmed), else 0', () => {
    const m = markStructured(
      s,
      new Map([
        [1, 'a'.repeat(19)],
        [2, 'a'.repeat(20)],
      ]),
    )
    expect(m).toEqual([
      { subQuestionId: 1, awarded: 0, max: 2 },
      { subQuestionId: 2, awarded: 3, max: 3 },
    ])
    expect(markStructured(s, new Map())).toEqual([
      { subQuestionId: 1, awarded: 0, max: 2 },
      { subQuestionId: 2, awarded: 0, max: 3 },
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// #18, #19 SPM targets
// ---------------------------------------------------------------------------------------------

describe('#18 GET /api/spm-targets', () => {
  it('lists the 20 SPM subjects of BR-22 in order, all "Belum mula" for the admin (observed)', async () => {
    const r = await get<{ data: SpmTargets }>(ADMIN, '/api/spm-targets')
    expect(r.status).toBe(200)
    const rows = r.body.data.subjects
    expect(rows.map((x) => x.id)).toEqual(SPM_TARGET_SUBJECT_IDS)
    expect(rows).toHaveLength(20)
    expect(rows[0]).toEqual({
      id: 18,
      name: 'Bahasa Arab',
      target: null,
      answered: 0,
      accuracyPct: null,
      band: null,
      predictedGrade: null,
    })
    expect(rows[19]).toMatchObject({ id: 25, name: 'Tasawwur Islam' })
    // Observed: the admin's 84 SPM answers start no row and the admin has no target.
    expect(rows.every((x) => x.target === null && x.accuracyPct === null && x.answered === 0)).toBe(
      true,
    )
  })

  it('shows the seeded targets of pelajar (BM A, MATH B+, SEJ A-)', async () => {
    const rows = (await get<{ data: SpmTargets }>(PELAJAR, '/api/spm-targets')).body.data.subjects
    const set = Object.fromEntries(rows.filter((x) => x.target).map((x) => [x.id, x.target]))
    expect(set).toEqual({ 1: 'A', 3: 'B+', 5: 'A-' })
  })

  it('shows progress only from the setSpmProgress fixture (BR-27, LS-10)', async () => {
    await hook('setSpmProgress', PELAJAR2, 1, { answered: 12, correct: 9 })
    await hook('setSpmProgress', PELAJAR2, 3, { answered: 10, correct: 5 })
    await hook('setSpmProgress', PELAJAR2, 4, { answered: 10, correct: 3 })
    await hook('setSpmProgress', PELAJAR2, 5, { answered: 0, correct: 0 })
    const rows = (await get<{ data: SpmTargets }>(PELAJAR2, '/api/spm-targets')).body.data.subjects
    const by = (id: number) => rows.find((x) => x.id === id)!
    expect(by(1)).toMatchObject({
      answered: 12,
      accuracyPct: 75,
      band: 'green',
      predictedGrade: 'A-',
    })
    expect(by(3)).toMatchObject({
      answered: 10,
      accuracyPct: 50,
      band: 'amber',
      predictedGrade: 'C',
    })
    expect(by(4)).toMatchObject({ answered: 10, accuracyPct: 30, band: 'red', predictedGrade: 'G' })
    // answered 0 is still "Belum mula".
    expect(by(5)).toMatchObject({
      answered: 0,
      accuracyPct: null,
      band: null,
      predictedGrade: null,
    })
    // Other users are unaffected.
    const other = (await get<{ data: SpmTargets }>(PELAJAR, '/api/spm-targets')).body.data.subjects
    expect(other.find((x) => x.id === 1)!.accuracyPct).toBeNull()
  })

  it('band and grade use the unrounded accuracy, only the shown figure is rounded (BR-27)', async () => {
    await hook('setSpmProgress', PELAJAR2, 18, { answered: 10000, correct: 6996 })
    await hook('setSpmProgress', PELAJAR2, 2, { answered: 10000, correct: 8996 })
    const rows = (await get<{ data: SpmTargets }>(PELAJAR2, '/api/spm-targets')).body.data.subjects
    expect(rows.find((x) => x.id === 18)).toMatchObject({
      accuracyPct: 70,
      band: 'amber',
      predictedGrade: 'B+',
    })
    expect(rows.find((x) => x.id === 2)).toMatchObject({
      accuracyPct: 90,
      band: 'green',
      predictedGrade: 'A',
    })
  })

  it('the BR-27 scale and bands', () => {
    expect([95, 90, 89.9, 80, 70, 65, 60, 55, 50, 45, 40, 39.9].map(predictedGrade)).toEqual([
      'A+',
      'A+',
      'A',
      'A',
      'A-',
      'B+',
      'B',
      'C+',
      'C',
      'D',
      'E',
      'G',
    ])
    expect([100, 70, 69.9, 50, 49.9].map(band)).toEqual(['green', 'green', 'amber', 'amber', 'red'])
  })
})

describe('#19 PUT /api/spm-targets', () => {
  const put = (userId: number, body: unknown) =>
    call<{ data?: { saved: number }; status?: string } & Partial<ErrorBody>>(
      userId,
      'PUT',
      '/api/spm-targets',
      body,
    )
  const targetsOf = async (userId: number) =>
    Object.fromEntries(
      (await get<{ data: SpmTargets }>(userId, '/api/spm-targets')).body.data.subjects
        .filter((x) => x.target !== null)
        .map((x) => [x.id, x.target]),
    )

  it('saves, answers {data:{saved:20}, status} and replaces all 20 values (BR-26)', async () => {
    const r = await put(PELAJAR2, { targets: { 1: 'A', 3: 'B+', 18: '', 5: 'E' } })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ data: { saved: 20 }, status: 'Target berjaya disimpan.' })
    expect(await targetsOf(PELAJAR2)).toEqual({ 1: 'A', 3: 'B+', 5: 'E' })
    // The second save replaces everything: an empty value clears, a missing subject clears.
    const r2 = await put(PELAJAR2, { targets: { 1: '', 3: 'C', 25: 'A+' } })
    expect(r2.status).toBe(200)
    expect(await targetsOf(PELAJAR2)).toEqual({ 3: 'C', 25: 'A+' })
  })

  it('accepts all nine grades', async () => {
    const all = Object.fromEntries(SPM_GRADES.map((g, i) => [SPM_TARGET_SUBJECT_IDS[i], g]))
    expect((await put(PELAJAR2, { targets: all })).status).toBe(200)
    expect(await targetsOf(PELAJAR2)).toEqual(all)
  })

  it('an empty targets object clears every target', async () => {
    expect((await put(PELAJAR2, { targets: {} })).status).toBe(200)
    expect(await targetsOf(PELAJAR2)).toEqual({})
  })

  it('422 VALIDATION_ERROR "Gred target tidak sah." for a bad grade, subject or body; nothing saved', async () => {
    await put(PELAJAR2, { targets: { 1: 'A' } })
    const bad: [string, unknown][] = [
      ['grade F', { targets: { 1: 'F' } }],
      ['grade lower case', { targets: { 1: 'a' } }],
      ['grade not a string', { targets: { 1: 5 } }],
      ['null grade', { targets: { 1: null } }],
      ['subject outside the 20 (17)', { targets: { 17: 'A' } }],
      ['subject not a number', { targets: { abc: 'A' } }],
      ['non-canonical subject key "01"', { targets: { '01': 'A' } }],
      ['no targets', {}],
      ['targets an array', { targets: ['A'] }],
    ]
    for (const [name, body] of bad) {
      const r = await put(PELAJAR2, body)
      expect(r.status, name).toBe(422)
      expect(code(r.body), name).toBe('VALIDATION_ERROR')
      expect((r.body as ErrorBody).error.message, name).toBe('Gred target tidak sah.')
    }
    // One bad value among good ones saves none of them.
    expect((await put(PELAJAR2, { targets: { 3: 'B', 1: 'Z' } })).status).toBe(422)
    expect(await targetsOf(PELAJAR2)).toEqual({ 1: 'A' })
  })

  it('targets are the viewer’s own: saving as pelajar2 leaves pelajar untouched', async () => {
    expect(await targetsOf(PELAJAR)).toEqual({ 1: 'A', 3: 'B+', 5: 'A-' })
    expect(practice.spmTargets(PELAJAR2).every((t) => t.userId === PELAJAR2)).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
// #20 Remedial tests, #21 missions
// ---------------------------------------------------------------------------------------------

const remedialOf = (userId: number) =>
  get<ListBody<RemedialTestItem>>(userId, '/api/remedial-tests/mine')
const missionsOf = (userId: number) => get<ListBody<MissionItem>>(userId, '/api/missions/today')

/** Starts a teacher-assigned session, checks every question correctly and submits it. */
async function runSession(userId: number, start: unknown) {
  const s = await call<{ data: { sessionId: string; questions: { id: number }[] } }>(
    userId,
    'POST',
    '/api/practice/sessions',
    start,
  )
  expect(s.status).toBe(201)
  return {
    sessionId: s.body.data.sessionId,
    complete: async () => {
      for (const q of s.body.data.questions) {
        await call(userId, 'POST', `/api/practice/sessions/${s.body.data.sessionId}/check-answer`, {
          questionId: q.id,
          selectedOptionId: questions.get(q.id)?.correctAnswer ?? 0,
        })
      }
      return call(userId, 'POST', `/api/practice/sessions/${s.body.data.sessionId}/submit`, {
        timeSpent: 30,
      })
    },
  }
}

describe('#20 GET /api/remedial-tests/mine', () => {
  it('lists the F-30 seeds: 7601 active for 3008, 7602 completed for 3007', async () => {
    const a = await remedialOf(3008)
    expect(a.status).toBe(200)
    expect(a.body.data).toEqual([
      {
        id: 7601,
        subjectName: 'Kimia',
        totalQuestions: 5,
        status: 'active',
        createdAt: '2026-09-23T10:00:00+08:00',
        teacherName: users.get(5)!.name,
      },
    ])
    expect(a.body.meta).toMatchObject({ totalItems: 1, page: 1, totalPages: 1 })
    const b = await remedialOf(3007)
    expect(b.body.data).toMatchObject([{ id: 7602, status: 'completed', totalQuestions: 5 }])
  })

  it('is empty for the canonical accounts (the S13 empty state)', async () => {
    for (const u of [ADMIN, PELAJAR, PELAJAR2, 4]) {
      const r = await remedialOf(u)
      expect(r.status, String(u)).toBe(200)
      expect(r.body.data, String(u)).toEqual([])
      expect(r.body.meta.totalItems).toBe(0)
    }
  })

  it('lists account 2’s tests newest first and drops cancelled ones (BR-32)', async () => {
    const input = (n: number) => ({
      teacherId: 5,
      studentId: PELAJAR,
      subjectId: 10,
      subjectCode: 'CHEM',
      subjectName: 'Kimia',
      questionIds: [700001, 700002, 700003].slice(0, n),
      beforeAccuracy: 20,
    })
    const older = remedialTests.create(input(2), '2026-09-20T09:00:00+08:00')
    const newer = remedialTests.create(input(3), '2026-09-24T09:00:00+08:00')
    const gone = remedialTests.create(input(1), '2026-09-25T09:00:00+08:00')
    remedialTests.cancel(gone.id)
    const r = await remedialOf(PELAJAR)
    expect(r.body.data.map((t) => t.id)).toEqual([newer.id, older.id])
    expect(r.body.data[0]).toEqual({
      id: newer.id,
      subjectName: 'Kimia',
      totalQuestions: 3,
      status: 'active',
      createdAt: '2026-09-24T09:00:00+08:00',
      teacherName: users.get(5)!.name,
    })
    // Another student never sees them.
    expect((await remedialOf(PELAJAR2)).body.data).toEqual([])
  })

  it('a test completed through the session flow turns "completed" (BR-31 step 8)', async () => {
    const t = (await remedialOf(PELAJAR)).body.data.find((x) => x.totalQuestions === 3)!
    expect(t.status).toBe('active')
    const run = await runSession(PELAJAR, { mode: 'remedial', remedialTestId: t.id })
    expect((await run.complete()).status).toBe(200)
    const after = (await remedialOf(PELAJAR)).body.data.find((x) => x.id === t.id)!
    expect(after.status).toBe('completed')
  })
})

describe('#21 GET /api/missions/today', () => {
  const today = '2026-09-25'
  const mission = (over: Partial<Parameters<typeof missions.create>[0]> = {}) => ({
    teacherId: 5,
    title: 'Misi Uji',
    missionType: 'latih_tubi' as const,
    missionDate: today,
    subjectId: 3,
    questionCount: 5,
    recipientIds: [PELAJAR],
    ...over,
  })

  it('is empty for the canonical accounts: the seeded missions are not dated today', async () => {
    for (const u of [ADMIN, PELAJAR, PELAJAR2, 4, 3001]) {
      const r = await missionsOf(u)
      expect(r.status, String(u)).toBe(200)
      expect(r.body.data, String(u)).toEqual([])
    }
  })

  it('lists today’s missions of the viewer oldest first, with type label and resource', async () => {
    const second = missions.create(
      mission({
        title: 'Misi Kedua',
        missionType: 'tracking_a',
        subjectId: 1,
        resourceTitle: 'Video Bab 1',
        resourceUrl: 'https://example.test/video',
        resourceNote: 'Tonton dahulu',
      }),
      '2026-09-25T09:00:00+08:00',
    )
    const first = missions.create(mission({ title: 'Misi Pertama' }), '2026-09-25T07:00:00+08:00')
    // Not listed: another day, another recipient.
    missions.create(mission({ missionDate: '2026-09-24' }), '2026-09-24T07:00:00+08:00')
    missions.create(mission({ recipientIds: [PELAJAR2] }), '2026-09-25T08:00:00+08:00')
    const r = await missionsOf(PELAJAR)
    expect(r.body.data.map((m) => m.id)).toEqual([first.id, second.id])
    expect(r.body.data[0]).toEqual({
      id: first.id,
      title: 'Misi Pertama',
      typeLabel: 'Latih Tubi SPM',
      subjectName: 'Matematik',
      questionCount: 5,
      coinsPerCorrect: 3,
      resourceTitle: null,
      resourceUrl: null,
      resourceNote: null,
      status: 'new',
    })
    expect(r.body.data[1]).toMatchObject({
      typeLabel: MISSION_TYPE_LABELS.tracking_a,
      subjectName: 'Bahasa Melayu',
      resourceTitle: 'Video Bab 1',
      resourceUrl: 'https://example.test/video',
      resourceNote: 'Tonton dahulu',
    })
    expect(r.body.meta.totalItems).toBe(2)
    // The recipient of the last mission sees only that one.
    expect((await missionsOf(PELAJAR2)).body.data).toHaveLength(1)
  })

  it('status follows Q-SESS-LINK: new, in_progress, completed', async () => {
    const m = (await missionsOf(PELAJAR)).body.data[0]!
    expect(m.status).toBe('new')
    const run = await runSession(PELAJAR, { mode: 'mission', missionId: m.id })
    expect((await missionsOf(PELAJAR)).body.data.find((x) => x.id === m.id)!.status).toBe(
      'in_progress',
    )
    expect((await run.complete()).status).toBe(200)
    const after = (await missionsOf(PELAJAR)).body.data
    expect(after.find((x) => x.id === m.id)!.status).toBe('completed')
    // The other mission is untouched.
    expect(after.find((x) => x.id !== m.id)!.status).toBe('new')
  })
})

describe('#20b GET /api/remedial-tests/:id (Q4 preview, FR-M05-141)', () => {
  type Preview = {
    data: {
      id: number
      subjectName: string
      status: string
      totalQuestions: number
      teacherName: string
      questions: { id: number; options: { label: string }[]; correctOptionId: number | null }[]
    }
  }

  it('gives the owning teacher the test with its questions and the correct option', async () => {
    const r = await get<Preview>(GURU, '/api/remedial-tests/7601')
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      id: 7601,
      subjectName: 'Kimia',
      status: 'active',
      totalQuestions: 5,
      teacherName: users.get(5)!.name,
    })
    expect(r.body.data.questions).toHaveLength(5)
    for (const q of r.body.data.questions) {
      expect(q.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
      expect(q.correctOptionId).toBe(questions.get(q.id)?.correctAnswer ?? null)
    }
  })

  it('gives an admin the preview too, and writes nothing', async () => {
    const before = practice.history(ADMIN).length
    const r = await get<Preview>(ADMIN, '/api/remedial-tests/7602')
    expect(r.status).toBe(200)
    expect(r.body.data.status).toBe('completed')
    expect(practice.history(ADMIN)).toHaveLength(before)
  })

  it('404 for the assigned student, another teacher, an unknown id; 401 without a session', async () => {
    for (const [u, id] of [
      [3008, 7601],
      [4402, 7601],
      [PELAJAR, 7601],
      [GURU, 99999],
    ] as const) {
      const r = await get<ErrorBody>(u, `/api/remedial-tests/${String(id)}`)
      expect(r.status, `${String(u)}/${String(id)}`).toBe(404)
    }
    const res = await runtime.transport.request({
      method: 'GET',
      url: '/api/remedial-tests/7601',
      headers: { accept: 'application/json' },
    })
    expect(res.status).toBe(401)
  })
})
