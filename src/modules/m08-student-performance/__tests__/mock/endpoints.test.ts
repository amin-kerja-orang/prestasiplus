/**
 * M08-T1 endpoint behaviour (SRS M08 v1.11 §7, §9): authentication, access by role, unknown ids
 * (404), the timeline write (#19) and the test hooks (§6.11). Anchor figures are in `anchors.test.ts`.
 * This file writes (a post, a school move), so it owns its runtime.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  LevelDetail,
  Ranking,
  SchoolItemAnalysis,
  SchoolPerformance,
  Timeline,
  TimelinePost,
} from '../../api/types'
import {
  clipboard,
  recordClipboard,
  setUserSchool,
  shareStubbed,
  stubShare,
} from '../../mock/hooks'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  MemoryStorage,
  PELAJAR,
  PELAJAR2,
  bootM08,
  dataAs,
  getAs,
  send,
} from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const PARENT = 6
const PPD = 9

describe('authentication', () => {
  it('every protected route answers 401 without a session; the public profile does not', async () => {
    for (const url of [
      '/api/performance/school',
      '/api/performance/levels',
      '/api/performance/levels/t4',
      '/api/performance/classes',
      '/api/performance/students/1',
      '/api/analytics/me',
      '/api/item-analysis/school',
      '/api/item-analysis/school/8880',
      '/api/item-analysis/classes',
      '/api/item-analysis/classes/2001',
      '/api/timeline',
      '/api/rankings',
      '/api/leaderboard',
      '/api/weekly-report',
    ]) {
      expect((await getAs(runtime, null, url)).status, url).toBe(401)
    }
    expect((await getAs(runtime, null, '/api/public/students/1')).status).toBe(200)
  })
})

describe('unknown ids are 404', () => {
  it('level, student, school and public profile', async () => {
    expect((await getAs(runtime, ADMIN, '/api/performance/levels/t6')).status).toBe(404)
    expect((await getAs(runtime, ADMIN, '/api/performance/students/99999999')).status).toBe(404)
    // FR-M08-143: an unknown school id is the empty by-id state, not a 404.
    const unknown = await getAs<{ data: SchoolItemAnalysis }>(
      runtime,
      ADMIN,
      '/api/item-analysis/school/99999999',
    )
    expect(unknown.status).toBe(200)
    expect(unknown.body.data).toMatchObject({ variant: 'byId', students: 0, questions: [] })
    expect(unknown.body.data.school.name).toBe('')
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/school/99999999')).status).toBe(403)
    expect((await getAs(runtime, null, '/api/public/students/99999999')).status).toBe(404)
    // A non-numeric id does not match the route at all.
    expect((await getAs(runtime, ADMIN, '/api/performance/students/abc')).status).toBe(404)
  })

  it('an unknown class on #11 is the observed 403 page (FR-M08-08), not a 404', async () => {
    expect((await getAs(runtime, ADMIN, '/api/item-analysis/classes/99999999')).status).toBe(403)
  })
})

describe('S6 access (§9)', () => {
  it('admin any pupil; pelajar self only; teacher pupils of own classes; school admin own school', async () => {
    expect((await getAs(runtime, ADMIN, '/api/performance/students/3')).status).toBe(200)
    expect((await getAs(runtime, PELAJAR, '/api/performance/students/2')).status).toBe(200)
    expect((await getAs(runtime, PELAJAR, '/api/performance/students/3')).status).toBe(403)
    expect((await getAs(runtime, GURU, '/api/performance/students/3001')).status).toBe(200)
    expect((await getAs(runtime, GURU, '/api/performance/students/3')).status).toBe(403)
    expect((await getAs(runtime, ADMIN_SEKOLAH, '/api/performance/students/3001')).status).toBe(200)
    expect((await getAs(runtime, ADMIN_SEKOLAH, '/api/performance/students/3201')).status).toBe(403)
    expect((await getAs(runtime, PARENT, '/api/performance/students/2')).status).toBe(403)
  })
})

describe('S1 / S2 / S3 access (UAT M-09)', () => {
  it('the school-level boards are 403 for a pelajar and open for the other roles', async () => {
    for (const url of [
      '/api/performance/school',
      '/api/performance/levels',
      '/api/performance/levels/t4',
    ]) {
      expect((await getAs(runtime, PELAJAR, url)).status, `pelajar ${url}`).toBe(403)
      for (const id of [ADMIN, GURU, ADMIN_SEKOLAH]) {
        expect((await getAs(runtime, id, url)).status, `${String(id)} ${url}`).toBe(200)
      }
    }
  })
})

describe('S9 / S10 / S11 access', () => {
  it('S9: parents and pelajar 403; own school for the school admin; another school by id is 403', async () => {
    expect((await getAs(runtime, PARENT, '/api/item-analysis/school')).status).toBe(403)
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/school/8880')).status).toBe(403)
    const own = await dataAs<SchoolItemAnalysis>(
      runtime,
      ADMIN_SEKOLAH,
      '/api/item-analysis/school',
    )
    expect(own.school.id).toBe(900001)
    expect(own.variant).toBe('own')
    // SMK DEMO: canonical 2 and 4 (D54) and 3001–3008 (10 pupils), computed from the log (no observed summary).
    expect(own.students).toBe(10)
    expect(own.answers).toBeGreaterThan(80)
    expect(own.subjects.length).toBeGreaterThan(0)
    // UAT M-09: the school-level boards are not for the pelajar, not even the own school.
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/school/900001')).status).toBe(403)
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/school')).status).toBe(403)
    const officer = (await getAs(runtime, PPD, '/api/item-analysis/school/8880')).status
    expect([200, 403]).toContain(officer)
  })

  it('S10: the teacher lists the own classes; pelajar and the school admin get 403', async () => {
    const own = await dataAs<{ id: number }[]>(runtime, GURU, '/api/item-analysis/classes')
    expect(own.map((c) => c.id)).toEqual([2001, 2002])
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/classes')).status).toBe(403)
    expect((await getAs(runtime, ADMIN_SEKOLAH, '/api/item-analysis/classes')).status).toBe(403)
  })

  it('S11: own class 200; a class of another teacher, pelajar and school admin 403', async () => {
    expect((await getAs(runtime, GURU, '/api/item-analysis/classes/2001')).status).toBe(200)
    expect((await getAs(runtime, GURU, '/api/item-analysis/classes/6')).status).toBe(403)
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/classes/2001')).status).toBe(403)
    expect((await getAs(runtime, ADMIN_SEKOLAH, '/api/item-analysis/classes/2001')).status).toBe(
      403,
    )
    expect((await getAs(runtime, ADMIN, '/api/item-analysis/classes/2001')).status).toBe(200)
  })
})

describe('S21 weekly report', () => {
  it('is 403 for the admin (observed) and for every other role (blocked, OQ-M08-01)', async () => {
    for (const id of [ADMIN, GURU, PELAJAR, ADMIN_SEKOLAH, PARENT]) {
      expect((await getAs(runtime, id, '/api/weekly-report')).status).toBe(403)
    }
  })
})

describe('S17 create a timeline post (#19)', () => {
  const png = (name: string, bytes = 64) =>
    new File([new Uint8Array(bytes)], name, { type: 'image/png' })

  it('creates a post with a photo and caption, listed newest event date first', async () => {
    const form = new FormData()
    form.append('title', 'Kejohanan Catur')
    form.append('category', 'pencapaian')
    form.append('eventDate', '2026-09-20')
    form.append('story', 'Naib juara.')
    form.append('photos[]', png('a.png'))
    form.append('captions[0]', 'Pingat')
    const r = await send<{ data: TimelinePost }>(runtime, PELAJAR2, 'POST', '/api/timeline', form)
    expect(r.status).toBe(201)
    expect(r.body.data).toMatchObject({
      userId: 3,
      title: 'Kejohanan Catur',
      category: 'pencapaian',
      eventDate: '2026-09-20',
      story: 'Naib juara.',
    })
    expect(r.body.data.photos).toHaveLength(1)
    expect(r.body.data.photos[0]?.url.startsWith('data:image/png;base64,')).toBe(true)
    expect(r.body.data.photos[0]?.caption).toBe('Pingat')
    const t = await dataAs<Timeline>(runtime, PELAJAR2, '/api/timeline')
    expect(t.posts.map((p) => p.title)).toEqual(['Kejohanan Catur'])
    // Another user does not see it.
    expect((await dataAs<Timeline>(runtime, ADMIN, '/api/timeline')).posts).toEqual([])
    // The public profile shows the posts.
    const pub = await dataAs<{ posts: TimelinePost[] }>(runtime, null, '/api/public/students/3')
    expect(pub.posts).toHaveLength(1)
  })

  it('422 without a photo (PROPOSED COPY), with a bad category, an over-long title or too many photos', async () => {
    const base = () => {
      const f = new FormData()
      f.append('title', 'Tajuk')
      f.append('category', 'cerita')
      return f
    }
    const none = await send<{ error: { fields: Record<string, string> } }>(
      runtime,
      PELAJAR,
      'POST',
      '/api/timeline',
      base(),
    )
    expect(none.status).toBe(422)
    expect(none.body.error.fields.photos).toBe('Sila muat naik sekurang-kurangnya 1 gambar.')

    const bad = base()
    bad.set('category', 'lain-lain')
    bad.append('photos[]', png('a.png'))
    const r2 = await send<{ error: { fields: Record<string, string> } }>(
      runtime,
      PELAJAR,
      'POST',
      '/api/timeline',
      bad,
    )
    expect(r2.status).toBe(422)
    expect(Object.keys(r2.body.error.fields)).toEqual(['category'])

    const long = base()
    long.set('title', 'x'.repeat(151))
    long.append('photos[]', png('a.png'))
    expect((await send(runtime, PELAJAR, 'POST', '/api/timeline', long)).status).toBe(422)

    const many = base()
    for (let i = 0; i < 6; i++) many.append('photos[]', png(`p${String(i)}.png`))
    expect((await send(runtime, PELAJAR, 'POST', '/api/timeline', many)).status).toBe(422)

    const wrongType = base()
    wrongType.append('photos[]', new File([new Uint8Array(8)], 'x.gif', { type: 'image/gif' }))
    expect((await send(runtime, PELAJAR, 'POST', '/api/timeline', wrongType)).status).toBe(422)

    const big = base()
    big.append('photos[]', png('big.png', 2 * 1024 * 1024 + 1))
    expect((await send(runtime, PELAJAR, 'POST', '/api/timeline', big)).status).toBe(422)
  })
})

describe('test hooks (§6.11)', () => {
  it('setUserSchool moves a pupil to another school (S9 own-school view in tests)', async () => {
    const before = await dataAs<SchoolItemAnalysis>(
      runtime,
      ADMIN_SEKOLAH,
      '/api/item-analysis/school',
    )
    setUserSchool(3, 900001)
    const after = await dataAs<SchoolItemAnalysis>(
      runtime,
      ADMIN_SEKOLAH,
      '/api/item-analysis/school',
    )
    expect(after.students).toBe(before.students + 1)
    expect(() => setUserSchool(99999999, 900001)).toThrow(RangeError)
    expect(() => setUserSchool(3, 99999999)).toThrow(RangeError)
  })

  it('stubShare and clipboard hold the state the page tasks read', () => {
    expect(shareStubbed()).toBe(false)
    stubShare(true)
    expect(shareStubbed()).toBe(true)
    expect(() => stubShare('yes' as unknown as boolean)).toThrow(TypeError)
    expect(clipboard()).toBeNull()
    recordClipboard('/pelajar/1')
    expect(clipboard()).toBe('/pelajar/1')
  })
})

describe('S19 access', () => {
  it('any role may view the ranking (INFERRED for the roles other than the admin)', async () => {
    for (const id of [ADMIN, GURU, PELAJAR, ADMIN_SEKOLAH, PARENT]) {
      const r = await dataAs<Ranking>(runtime, id, '/api/rankings')
      expect(r.total).toBe(3)
    }
    // Scope sekolah / daerah use the viewer's school; the ranked students are SMK DEMO (INFERRED).
    const sekolah = await dataAs<Ranking>(runtime, PELAJAR, '/api/rankings?scope=sekolah')
    expect(sekolah.total).toBe(3)
    const other = await dataAs<Ranking>(runtime, ADMIN, '/api/rankings?scope=sekolah')
    expect(other.total).toBe(0)
  })
})

describe('S1 / S3 follow writes of other modules (no stale memo)', () => {
  const now = Date.parse('2026-09-25T15:40:00+08:00')

  it('enrol changes the cached S3 student count; create class changes the class count', async () => {
    const before = await dataAs<LevelDetail>(runtime, ADMIN, '/api/performance/levels/t4')
    // A repeat is identical.
    expect(await dataAs<LevelDetail>(runtime, ADMIN, '/api/performance/levels/t4')).toEqual(before)
    classrooms.enrol(
      { kind: 'classroom', classId: 516, studentId: PELAJAR, source: 'teacher' },
      now,
    )
    const enrolled = await dataAs<LevelDetail>(runtime, ADMIN, '/api/performance/levels/t4')
    expect(enrolled.students).toBe(before.students + 1)
    classrooms.create(
      {
        name: '4 Baharu',
        teacherId: GURU,
        schoolId: 900001,
        subjectId: null,
        educationLevel: 'tingkatan-4',
      },
      now,
    )
    const created = await dataAs<LevelDetail>(runtime, ADMIN, '/api/performance/levels/t4')
    expect(created.classes).toBe(before.classes + 1)
    expect(created.classRows).toHaveLength(before.classRows.length + 1)
  }, 120_000)

  it('setUserSchool changes the cached S1 scope of the school admin', async () => {
    const before = await dataAs<SchoolPerformance>(
      runtime,
      ADMIN_SEKOLAH,
      '/api/performance/school',
    )
    expect(
      await dataAs<SchoolPerformance>(runtime, ADMIN_SEKOLAH, '/api/performance/school'),
    ).toEqual(before)
    // Account 4 already lives at SMK DEMO since D54; a Tingkatan 4 pupil of another school joins it.
    setUserSchool(3201, 900001)
    const after = await dataAs<SchoolPerformance>(runtime, ADMIN_SEKOLAH, '/api/performance/school')
    expect(after.stats.students).toBe(before.stats.students + 1)
    expect(after.header.studentCount).toBe(before.header.studentCount + 1)
  }, 120_000)
})
