import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { defineMockCore } from '@/mock/define'
import { bootMock, type MockRuntime } from '@/mock/index'

import {
  curriculum,
  curriculumSubjectLevels,
  curriculumSubtopics,
  curriculumTopics,
} from '../../mock'

const NOW = '2026-09-25T15:40:00+08:00'

let runtime: MockRuntime

function boot() {
  return bootMock({
    mode: 'test',
    core: defineMockCore({
      resolveSession: (token) => {
        if (token === 'tok-admin') return { token, userId: 1, role: 'admin' }
        if (token === 'tok-student') return { token, userId: 2, role: 'student' }
        if (token === 'tok-teacher') return { token, userId: 5, role: 'teacher' }
        return null
      },
    }),
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Answer<T = any> {
  status: number
  body: T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  as: 'admin' | 'student' | 'teacher' | null = 'admin',
  body?: unknown,
  query?: Record<string, string>,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as) headers.authorization = `Bearer tok-${as}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(query ? { query } : {}),
    ...(body !== undefined ? { body } : {}),
  })
  if (method !== 'GET' && res.status < 400) dirty = true
  return { status: res.status, body: res.body as T }
}

/** No topic without its chapter, no subtopic without its topic (BR-10 cascade). */
function expectNoOrphans(): void {
  const topics = curriculumTopics.query('TP-ALL', {}).rows
  const subtopics = curriculumSubtopics.query('ST-ALL', {}).rows
  expect(topics.filter((t) => !curriculum.chapter(t.chapterId))).toEqual([])
  expect(subtopics.filter((x) => !curriculum.topic(x.topicId))).toEqual([])
}

beforeAll(async () => {
  runtime = await boot()
}, 60_000)

// Re-seeding recompiles every registry store (~2 s): only after a call that wrote data.
let dirty = false
afterEach(async () => {
  if (dirty) await runtime.reset()
  dirty = false
}, 30_000)

describe('guards (every route: guest 401, student 403, teacher 403)', () => {
  const routes: [string, string][] = [
    ['GET', '/api/admin/subjects'],
    ['GET', '/api/admin/subjects/3'],
    ['POST', '/api/admin/subjects'],
    ['PUT', '/api/admin/subjects/3'],
    ['PATCH', '/api/admin/subjects/3/active'],
    ['DELETE', '/api/admin/subjects/3'],
    ['GET', '/api/admin/education-levels'],
    ['GET', '/api/admin/education-levels/1'],
    ['POST', '/api/admin/education-levels'],
    ['PUT', '/api/admin/education-levels/1'],
    ['PATCH', '/api/admin/education-levels/1/active'],
    ['DELETE', '/api/admin/education-levels/1'],
    ['GET', '/api/admin/curriculum'],
    ['GET', '/api/admin/curriculum/chapters/35'],
    ['POST', '/api/admin/curriculum/chapters'],
    ['PUT', '/api/admin/curriculum/chapters/35'],
    ['DELETE', '/api/admin/curriculum/chapters/35'],
    ['GET', '/api/admin/curriculum/topics/59'],
    ['POST', '/api/admin/curriculum/topics'],
    ['PUT', '/api/admin/curriculum/topics/59'],
    ['DELETE', '/api/admin/curriculum/topics/59'],
    ['POST', '/api/admin/curriculum/subtopics'],
    ['PUT', '/api/admin/curriculum/subtopics/132'],
    ['DELETE', '/api/admin/curriculum/subtopics/132'],
  ]
  it.each(routes)('%s %s', async (method, url) => {
    const m = method as 'GET'
    expect((await call(m, url, null, {})).status).toBe(401)
    expect((await call(m, url, 'student', {})).status).toBe(403)
    expect((await call(m, url, 'teacher', {})).status).toBe(403)
  })
})

describe('subjects #1-#6', () => {
  it('#1 lists every subject with questionCount and level names (anchors)', async () => {
    const res = await call('GET', '/api/admin/subjects')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(31)
    expect(res.body.meta).toMatchObject({ totalItems: 31, page: 1, totalPages: 1 })
    const math = res.body.data.find((s: { id: number }) => s.id === 3)
    expect(math.questionCount).toBe(13872)
    expect(math.levels).toHaveLength(11)
    expect(math.levels[0]).toEqual({ id: 1, name: 'Darjah 1' })
    expect(math.educationLevelIds).toHaveLength(11)
    const empty = res.body.data.find((s: { id: number }) => s.id === 31)
    expect(empty.levels).toEqual([])
    expect(typeof empty.questionCount).toBe('number')
  })

  it('#2 returns one subject; unknown id is 404 with the BR-18 flash copy', async () => {
    const ok = await call('GET', '/api/admin/subjects/3')
    expect(ok.status).toBe(200)
    expect(ok.body.data).toMatchObject({ id: 3, order: 3 })
    const missing = await call('GET', '/api/admin/subjects/9999')
    expect(missing.status).toBe(404)
    expect(missing.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Subjek tidak dijumpai.',
    })
  })

  it('#3 creates a subject (upper-case code, active, links) and persists it', async () => {
    const res = await call('POST', '/api/admin/subjects', 'admin', {
      name: ' Subjek Ujian ',
      nameEn: 'Test Subject',
      code: 'tst1',
      color: '#0f766e',
      isCore: true,
      order: 40,
      educationLevelIds: [1, 2, 2],
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Subjek berjaya ditambah.')
    expect(res.body.data).toMatchObject({
      name: 'Subjek Ujian',
      code: 'TST1',
      isActive: true,
      isCore: true,
      icon: 'fas fa-book',
      educationLevelIds: [1, 2],
    })
    const id = res.body.data.id as number
    expect(id).toBeGreaterThan(31)
    expect((await call('GET', `/api/admin/subjects/${String(id)}`)).status).toBe(200)
    const list = await call('GET', '/api/admin/subjects')
    expect(list.body.data).toHaveLength(32)
    expect(list.body.data.find((s: { id: number }) => s.id === id).questionCount).toBe(0)
    expect(curriculumSubjectLevels.count('LINK-SUBJECT', id)).toBe(2)
  })

  it('#3 an empty icon is stored as null (no glyph)', async () => {
    const res = await call('POST', '/api/admin/subjects', 'admin', {
      name: 'A',
      nameEn: 'B',
      code: 'ICO1',
      icon: '',
    })
    expect(res.body.data.icon).toBeNull()
  })

  it('#4 keeps omitted educationLevelIds, color, isCore, order and icon', async () => {
    const before = curriculum.subject(3)!
    const res = await call('PUT', '/api/admin/subjects/3', 'admin', {
      name: 'Matematik',
      nameEn: 'Mathematics',
      code: 'MATH',
    })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      color: before.color,
      isCore: before.isCore,
      order: before.order,
      icon: before.icon,
      educationLevelIds: before.educationLevelIds,
    })
    expect(curriculumSubjectLevels.count('LINK-SUBJECT', 3)).toBe(11)
    const cleared = await call('PUT', '/api/admin/subjects/3', 'admin', {
      name: 'Matematik',
      nameEn: 'Mathematics',
      code: 'MATH',
      educationLevelIds: [],
      icon: '',
    })
    expect(cleared.body.data).toMatchObject({ educationLevelIds: [], icon: null })
  })

  it('#3 applies defaults (color #4f46e5, isCore false, order 0)', async () => {
    const res = await call('POST', '/api/admin/subjects', 'admin', {
      name: 'A',
      nameEn: 'B',
      code: 'DEF1',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ color: '#4f46e5', isCore: false, order: 0 })
  })

  it('#3/#4 validate (required, duplicate code, length, colour, order, unknown level)', async () => {
    const empty = await call('POST', '/api/admin/subjects', 'admin', {})
    expect(empty.status).toBe(422)
    expect(empty.body.error.code).toBe('VALIDATION_ERROR')
    expect(empty.body.error.fields).toEqual({
      name: 'The name field is required.',
      nameEn: 'The name en field is required.',
      code: 'The code field is required.',
    })
    const dup = await call('POST', '/api/admin/subjects', 'admin', {
      name: 'x',
      nameEn: 'y',
      code: 'math',
    })
    expect(dup.body.error.fields.code).toBe('The code has already been taken.')
    const long = await call('POST', '/api/admin/subjects', 'admin', {
      name: 'x',
      nameEn: 'y',
      code: 'A'.repeat(21),
    })
    expect(long.body.error.fields.code).toBe(
      'The code field must not be greater than 20 characters.',
    )
    const bad = await call('POST', '/api/admin/subjects', 'admin', {
      name: 'x',
      nameEn: 'y',
      code: 'OK1',
      color: 'red',
      order: -1,
      educationLevelIds: [1, 999],
    })
    expect(bad.body.error.fields).toMatchObject({
      color: 'The color field format is invalid.',
      order: 'The order field must be at least 0.',
      educationLevelIds: 'The selected education level ids is invalid.',
    })
    expect(curriculum.subjects()).toHaveLength(31)
  })

  it('#4 updates, replaces links, allows keeping its own code, 404s unknown', async () => {
    const before = await call('GET', '/api/admin/subjects/3')
    const res = await call('PUT', '/api/admin/subjects/3', 'admin', {
      name: 'Matematik X',
      nameEn: 'Mathematics',
      code: 'math',
      color: '#123456',
      isCore: false,
      order: 3,
      educationLevelIds: [1],
    })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Subjek berjaya dikemaskini.')
    expect(res.body.data).toMatchObject({
      id: 3,
      name: 'Matematik X',
      code: 'MATH',
      isCore: false,
      educationLevelIds: [1],
      isActive: before.body.data.isActive,
    })
    expect(curriculumSubjectLevels.count('LINK-SUBJECT', 3)).toBe(1)
    const clash = await call('PUT', '/api/admin/subjects/3', 'admin', {
      name: 'a',
      nameEn: 'b',
      code: 'BM',
    })
    expect(clash.status).toBe(422)
    const missing = await call('PUT', '/api/admin/subjects/9999', 'admin', {})
    expect(missing.status).toBe(404)
  })

  it('#5 toggles active, leaves the lookups, and rejects bad input / unknown id', async () => {
    const off = await call('PATCH', '/api/admin/subjects/3/active', 'admin', { isActive: false })
    expect(off.status).toBe(200)
    expect(off.body.data).toEqual({ id: 3, isActive: false })
    expect(curriculum.subject(3)?.isActive).toBe(false)
    const lookup = await call('GET', '/api/subjects', 'student')
    expect(lookup.body.data.map((s: { id: number }) => s.id)).not.toContain(3)
    // still in the admin list (BR-11)
    expect((await call('GET', '/api/admin/subjects')).body.data).toHaveLength(31)
    const on = await call('PATCH', '/api/admin/subjects/3/active', 'admin', { isActive: true })
    expect(on.body.data.isActive).toBe(true)
    expect((await call('PATCH', '/api/admin/subjects/3/active', 'admin', {})).status).toBe(422)
    expect(
      (await call('PATCH', '/api/admin/subjects/9999/active', 'admin', { isActive: true })).status,
    ).toBe(404)
  })

  it('#5 honours injected faults (500 then a network error)', async () => {
    runtime.faults.failNext('/api/admin/subjects/3/active', 500)
    const res = await call('PATCH', '/api/admin/subjects/3/active', 'admin', { isActive: false })
    expect(res.status).toBe(500)
    expect(curriculum.subject(3)?.isActive).toBe(true)
  })

  it('#6 deletes with the cascade (links and chapters); 404 afterwards', async () => {
    const chaptersBefore = curriculum.count('CH-ALL')
    const matChapters = curriculum.count('CH-SUBJECT', 3)
    const res = await call('DELETE', '/api/admin/subjects/3')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Subjek berjaya dipadam.' })
    expect(curriculum.subject(3)).toBeUndefined()
    expect(curriculumSubjectLevels.count('LINK-SUBJECT', 3)).toBe(0)
    expect(curriculum.count('CH-ALL')).toBe(chaptersBefore - matChapters)
    expect((await call('DELETE', '/api/admin/subjects/3')).status).toBe(404)
    expect((await call('GET', '/api/admin/subjects')).body.data).toHaveLength(30)
    expectNoOrphans()
  })
})

describe('education levels #7-#12', () => {
  it('#7 lists 11 levels with questionCount and subjectCount (anchors)', async () => {
    const res = await call('GET', '/api/admin/education-levels')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(11)
    const [d1] = res.body.data
    expect(d1).toMatchObject({ id: 1, code: 'D1', stage: 'primary', questionCount: 11396 })
    const counts = res.body.data.map((l: { subjectCount: number }) => l.subjectCount)
    expect(counts).toEqual([16, 16, 16, 17, 17, 17, 15, 15, 15, 25, 25])
  })

  it('#8 returns one level; unknown id 404 with the flash copy', async () => {
    expect((await call('GET', '/api/admin/education-levels/10')).body.data).toMatchObject({
      code: 'T4',
      stage: 'upper_secondary',
      curriculum: 'KSSM',
    })
    const missing = await call('GET', '/api/admin/education-levels/9999')
    expect(missing.status).toBe(404)
    expect(missing.body.error.message).toBe('Tahap Pendidikan tidak dijumpai.')
  })

  it('#9 creates a level (upper-case code, active, grade null) and lists it with 0 counts', async () => {
    const res = await call('POST', '/api/admin/education-levels', 'admin', {
      name: 'Tahap Ujian',
      nameEn: 'Test Level',
      code: 'tu1',
      stage: 'primary',
      curriculum: 'KSSR',
      order: 12,
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Tahap Pendidikan berjaya ditambah.')
    expect(res.body.data).toMatchObject({ code: 'TU1', isActive: true, grade: null, order: 12 })
    const list = await call('GET', '/api/admin/education-levels')
    expect(list.body.data).toHaveLength(12)
    expect(list.body.data[11]).toMatchObject({ code: 'TU1', questionCount: 0, subjectCount: 0 })
  })

  it('#9/#10 validate (required, stage enum, code length/duplicate, order)', async () => {
    const empty = await call('POST', '/api/admin/education-levels', 'admin', {})
    expect(empty.status).toBe(422)
    expect(Object.keys(empty.body.error.fields).sort()).toEqual(
      ['code', 'curriculum', 'name', 'nameEn', 'stage'].sort(),
    )
    const bad = await call('POST', '/api/admin/education-levels', 'admin', {
      name: 'x',
      nameEn: 'y',
      code: 'd1',
      stage: 'nope',
      curriculum: 'KSSR',
      order: -3,
    })
    expect(bad.body.error.fields).toEqual({
      code: 'The code has already been taken.',
      stage: 'The selected stage is invalid.',
      order: 'The order field must be at least 0.',
    })
    const long = await call('POST', '/api/admin/education-levels', 'admin', {
      name: 'x',
      nameEn: 'y',
      code: 'ABCDEFGHIJK',
      stage: 'primary',
      curriculum: 'KSSR',
    })
    expect(long.body.error.fields.code).toBe(
      'The code field must not be greater than 10 characters.',
    )
  })

  it('#10 updates (own code allowed) and 404s unknown', async () => {
    const res = await call('PUT', '/api/admin/education-levels/1', 'admin', {
      name: 'Tahun 1',
      nameEn: 'Year 1',
      code: 'd1',
      stage: 'primary',
      curriculum: 'KSSR',
      order: 1,
    })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Tahap Pendidikan berjaya dikemaskini.')
    expect(res.body.data).toMatchObject({ id: 1, name: 'Tahun 1', code: 'D1', grade: 1 })
    expect((await call('PUT', '/api/admin/education-levels/9999', 'admin', {})).status).toBe(404)
  })

  it('#10 a code clash with another level is 422', async () => {
    const res = await call('PUT', '/api/admin/education-levels/1', 'admin', {
      name: 'x',
      nameEn: 'y',
      code: 'd2',
      stage: 'primary',
      curriculum: 'KSSR',
    })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.code).toBe('The code has already been taken.')
  })

  it('#11 toggles active; the lookup drops it, the admin list keeps it', async () => {
    const res = await call('PATCH', '/api/admin/education-levels/11/active', 'admin', {
      isActive: false,
    })
    expect(res.body.data).toEqual({ id: 11, isActive: false })
    expect((await call('GET', '/api/education-levels', 'student')).body.data).toHaveLength(10)
    expect((await call('GET', '/api/admin/education-levels')).body.data).toHaveLength(11)
    expect((await call('PATCH', '/api/admin/education-levels/11/active', 'admin', {})).status).toBe(
      422,
    )
    expect(
      (await call('PATCH', '/api/admin/education-levels/9999/active', 'admin', { isActive: true }))
        .status,
    ).toBe(404)
  })

  it('#12 deletes with the cascade (links and chapters); 404 afterwards', async () => {
    const d1Chapters = curriculum.count('CH-LEVEL', 1)
    expect(d1Chapters).toBe(41)
    const total = curriculum.count('CH-ALL')
    const res = await call('DELETE', '/api/admin/education-levels/1')
    expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Tahap Pendidikan berjaya dipadam.' })
    expect(curriculum.count('CH-ALL')).toBe(total - 41)
    expect(curriculumSubjectLevels.count('LINK-LEVEL', 1)).toBe(0)
    expect((await call('DELETE', '/api/admin/education-levels/1')).status).toBe(404)
    expectNoOrphans()
  })
})

describe('curriculum tree #13-#24', () => {
  it('#13 returns the pair tree and stats (Matematik T4 anchors)', async () => {
    const res = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '3',
      educationLevelId: '10',
    })
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.subject).toEqual({ id: 3, name: 'Matematik' })
    expect(d.level).toEqual({ id: 10, name: 'Tingkatan 4' })
    expect(d.stats).toEqual({ chapters: 10, topics: 24, subtopics: 0 })
    expect(d.chapters).toHaveLength(10)
    expect(d.chapters[0]).toMatchObject({
      id: 91,
      chapterNumber: 1,
      nameEn: 'Functions and Quadratic Equations',
    })
    expect(d.chapters[0].topics.map((t: { id: number }) => t.id).slice(0, 3)).toEqual([
      126, 380, 127,
    ])
  })

  it('#13 BM Darjah 1 stats (7 subtopics) and an empty pair', async () => {
    const bm = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '1',
      educationLevelId: '1',
    })
    expect(bm.body.data.stats.subtopics).toBe(7)
    const empty = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '3',
      educationLevelId: '1',
    })
    expect(empty.status).toBe(200)
    expect(empty.body.data.stats.chapters).toBe(curriculum.count('CH-PAIR', 3, 1))
    const tambahan = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '2',
      educationLevelId: '9',
    })
    expect(tambahan.status).toBe(200)
  })

  it('#13 422 for a missing/invalid parameter, 404 for unknown subject/level', async () => {
    const none = await call('GET', '/api/admin/curriculum')
    expect(none.status).toBe(422)
    expect(Object.keys(none.body.error.fields)).toEqual(['subjectId', 'educationLevelId'])
    const one = await call('GET', '/api/admin/curriculum', 'admin', undefined, { subjectId: '3' })
    expect(Object.keys(one.body.error.fields)).toEqual(['educationLevelId'])
    const nan = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: 'x',
      educationLevelId: '1',
    })
    expect(nan.status).toBe(422)
    const s = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '999',
      educationLevelId: '1',
    })
    expect(s.status).toBe(404)
    expect(s.body.error.message).toBe('Subjek tidak dijumpai.')
    const l = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '3',
      educationLevelId: '999',
    })
    expect(l.body.error.message).toBe('Tahap Pendidikan tidak dijumpai.')
  })

  it('#14 returns a chapter with subject and level; unknown 404 "Bab tidak dijumpai."', async () => {
    const res = await call('GET', '/api/admin/curriculum/chapters/91')
    expect(res.body.data).toMatchObject({
      id: 91,
      subjectId: 3,
      educationLevelId: 10,
      subject: { id: 3, name: 'Matematik' },
      level: { id: 10, name: 'Tingkatan 4' },
    })
    const missing = await call('GET', '/api/admin/curriculum/chapters/99999')
    expect(missing.status).toBe(404)
    expect(missing.body.error.message).toBe('Bab tidak dijumpai.')
    // an out-of-tree chapter (id 1282+) is not reachable
    expect((await call('GET', '/api/admin/curriculum/chapters/1290')).status).toBe(404)
  })

  it('#15 creates a chapter (active, appended) and it appears in the tree', async () => {
    const res = await call('POST', '/api/admin/curriculum/chapters', 'admin', {
      subjectId: 3,
      educationLevelId: '10',
      name: ' Bab Baharu ',
      nameEn: '',
      chapterNumber: '11',
      description: 'Keterangan',
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Bab berjaya ditambah.')
    expect(res.body.data).toMatchObject({
      subjectId: 3,
      educationLevelId: 10,
      name: 'Bab Baharu',
      nameEn: null,
      chapterNumber: 11,
      isActive: true,
      inTree: true,
    })
    const tree = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '3',
      educationLevelId: '10',
    })
    expect(tree.body.data.stats.chapters).toBe(11)
    expect(tree.body.data.chapters.at(-1).name).toBe('Bab Baharu')
  })

  it('#15 allows an unlinked pair (BR-04) and a null chapter number', async () => {
    const res = await call('POST', '/api/admin/curriculum/chapters', 'admin', {
      subjectId: 31,
      educationLevelId: 1,
      name: 'Tanpa nombor',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.chapterNumber).toBeNull()
  })

  it('#15/#16 validate (required, min 1, unknown subject/level)', async () => {
    const empty = await call('POST', '/api/admin/curriculum/chapters', 'admin', {})
    expect(empty.body.error.fields).toEqual({
      subjectId: 'The subject id field is required.',
      educationLevelId: 'The education level id field is required.',
      name: 'The name field is required.',
    })
    const bad = await call('POST', '/api/admin/curriculum/chapters', 'admin', {
      subjectId: 999,
      educationLevelId: 999,
      name: 'x',
      chapterNumber: 0,
    })
    expect(bad.body.error.fields).toEqual({
      subjectId: 'The selected subject id is invalid.',
      educationLevelId: 'The selected education level id is invalid.',
      chapterNumber: 'The chapter number field must be at least 1.',
    })
    const put = await call('PUT', '/api/admin/curriculum/chapters/91', 'admin', {
      subjectId: 3,
      educationLevelId: 10,
      chapterNumber: -2,
    })
    expect(put.status).toBe(422)
    expect(put.body.error.fields.name).toBe('The name field is required.')
    expect(curriculum.chapter(91)?.chapterNumber).toBe(1)
  })

  it('#16 updates a chapter, may move it to another pair keeping its topics, and toggles active', async () => {
    const res = await call('PUT', '/api/admin/curriculum/chapters/91', 'admin', {
      subjectId: 3,
      educationLevelId: 9,
      name: 'Fungsi',
      nameEn: 'Functions',
      chapterNumber: 1,
      description: null,
      isActive: false,
    })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Bab berjaya dikemaskini.')
    expect(res.body.data).toMatchObject({ id: 91, educationLevelId: 9, isActive: false })
    expect(curriculum.topics(91)).toHaveLength(3)
    const t4 = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '3',
      educationLevelId: '10',
    })
    expect(t4.body.data.stats.chapters).toBe(9)
    // an absent isActive keeps the stored value (INFERRED)
    const keep = await call('PUT', '/api/admin/curriculum/chapters/91', 'admin', {
      subjectId: 3,
      educationLevelId: 9,
      name: 'Fungsi',
    })
    expect(keep.body.data.isActive).toBe(false)
    expect((await call('PUT', '/api/admin/curriculum/chapters/99999', 'admin', {})).status).toBe(
      404,
    )
  })

  it('#17 deletes a chapter with its topics and subtopics (BM D1 chapter 35)', async () => {
    const res = await call('DELETE', '/api/admin/curriculum/chapters/35')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: { deleted: { chapters: 1, topics: 1, subtopics: 2 } },
      status: 'Bab berjaya dipadam.',
    })
    expect(curriculum.topic(59)).toBeUndefined()
    expect(curriculum.subtopic(132)).toBeUndefined()
    const missing = await call('DELETE', '/api/admin/curriculum/chapters/35')
    expect(missing.status).toBe(404)
    expect(missing.body.error.message).toBe('Bab tidak dijumpai.')
  })

  it('#18 returns a topic with its chapter, subject and level; unknown 404 "Topik tidak dijumpai."', async () => {
    const res = await call('GET', '/api/admin/curriculum/topics/126')
    expect(res.body.data).toMatchObject({
      id: 126,
      name: 'Fungsi',
      nameEn: 'Functions',
      chapterId: 91,
      chapter: { id: 91, subject: { id: 3, name: 'Matematik' }, level: { id: 10 } },
    })
    const missing = await call('GET', '/api/admin/curriculum/topics/99999')
    expect(missing.status).toBe(404)
    expect(missing.body.error.message).toBe('Topik tidak dijumpai.')
  })

  it('#19 creates a topic (active; number as text) and 422s unknown or missing chapter', async () => {
    const res = await call('POST', '/api/admin/curriculum/topics', 'admin', {
      chapterId: 91,
      name: 'Topik Baharu',
      topicNumber: 1.5,
      learningStandard: 'LS',
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Topik berjaya ditambah.')
    expect(res.body.data).toMatchObject({
      chapterId: 91,
      topicNumber: '1.5',
      learningStandard: 'LS',
      nameEn: null,
      isActive: true,
    })
    expect(curriculum.topics(91)).toHaveLength(4)
    const bad = await call('POST', '/api/admin/curriculum/topics', 'admin', {
      chapterId: 99999,
      name: '',
      topicNumber: 'x'.repeat(21),
    })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields).toEqual({
      chapterId: 'The selected chapter id is invalid.',
      name: 'The name field is required.',
      topicNumber: 'The topic number field must not be greater than 20 characters.',
    })
    const none = await call('POST', '/api/admin/curriculum/topics', 'admin', { name: 'x' })
    expect(none.body.error.fields.chapterId).toBe('The chapter id field is required.')
  })

  it('#20 updates a topic (chapter fixed), toggles active, 404 and 422', async () => {
    const res = await call('PUT', '/api/admin/curriculum/topics/126', 'admin', {
      chapterId: 92,
      name: 'Fungsi (kemas kini)',
      topicNumber: '1',
      isActive: false,
    })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Topik berjaya dikemaskini.')
    expect(res.body.data).toMatchObject({
      chapterId: 91,
      name: 'Fungsi (kemas kini)',
      isActive: false,
    })
    const bad = await call('PUT', '/api/admin/curriculum/topics/126', 'admin', {})
    expect(bad.status).toBe(422)
    expect(
      (await call('PUT', '/api/admin/curriculum/topics/99999', 'admin', { name: 'x' })).status,
    ).toBe(404)
  })

  it('#20 an omitted isActive keeps the stored value', async () => {
    await call('PUT', '/api/admin/curriculum/topics/126', 'admin', {
      name: 'Fungsi',
      isActive: false,
    })
    const res = await call('PUT', '/api/admin/curriculum/topics/126', 'admin', { name: 'Fungsi 2' })
    expect(res.body.data).toMatchObject({ name: 'Fungsi 2', isActive: false })
  })

  it('#21 deletes a topic with its subtopics', async () => {
    const res = await call('DELETE', '/api/admin/curriculum/topics/59')
    expect(res.body).toEqual({
      data: { deleted: { topics: 1, subtopics: 2 } },
      status: 'Topik berjaya dipadam.',
    })
    expect(curriculum.subtopic(132)).toBeUndefined()
    expect((await call('DELETE', '/api/admin/curriculum/topics/59')).status).toBe(404)
  })

  it('#22 adds a subtopic appended last; 422 for missing name / unknown topic', async () => {
    const before = curriculum.subtopics(59).length
    const res = await call('POST', '/api/admin/curriculum/subtopics', 'admin', {
      topicId: 59,
      name: 'Subtopik Baharu',
      learningObjective: 'Objektif',
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Subtopik berjaya ditambah.')
    expect(res.body.data).toMatchObject({
      topicId: 59,
      nameEn: null,
      learningObjective: 'Objektif',
    })
    const subs = curriculum.subtopics(59)
    expect(subs).toHaveLength(before + 1)
    expect(subs.at(-1)?.name).toBe('Subtopik Baharu')
    const bad = await call('POST', '/api/admin/curriculum/subtopics', 'admin', { topicId: 99999 })
    expect(bad.body.error.fields).toEqual({
      topicId: 'The selected topic id is invalid.',
      name: 'The name field is required.',
    })
  })

  it('#23 updates a subtopic; 404 and 422', async () => {
    const res = await call('PUT', '/api/admin/curriculum/subtopics/132', 'admin', {
      name: 'Mendengar (baharu)',
      nameEn: 'Listening',
      learningObjective: '',
    })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Subtopik berjaya dikemaskini.')
    expect(res.body.data).toMatchObject({
      id: 132,
      name: 'Mendengar (baharu)',
      nameEn: 'Listening',
      learningObjective: null,
    })
    expect((await call('PUT', '/api/admin/curriculum/subtopics/132', 'admin', {})).status).toBe(422)
    expect(
      (await call('PUT', '/api/admin/curriculum/subtopics/99999', 'admin', { name: 'x' })).status,
    ).toBe(404)
  })

  it('#24 deletes a subtopic; 404 afterwards', async () => {
    const res = await call('DELETE', '/api/admin/curriculum/subtopics/133')
    expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Subtopik berjaya dipadam.' })
    expect(curriculum.subtopic(133)).toBeUndefined()
    expect((await call('DELETE', '/api/admin/curriculum/subtopics/133')).status).toBe(404)
  })

  it('counts after mutations follow the data (BR-06: inactive records counted)', async () => {
    await call('PUT', '/api/admin/curriculum/topics/126', 'admin', {
      name: 'Fungsi',
      isActive: false,
    })
    const tree = await call('GET', '/api/admin/curriculum', 'admin', undefined, {
      subjectId: '3',
      educationLevelId: '10',
    })
    expect(tree.body.data.stats.topics).toBe(24)
    const topic = tree.body.data.chapters[0].topics.find((t: { id: number }) => t.id === 126)
    expect(topic.isActive).toBe(false)
  })
})
