/**
 * M08-T1 endpoint behaviour (SRS M08 v1.11 §7, §9): authentication, access by role, unknown ids
 * (404), the timeline write (#19) and the test hooks (§6.11). Anchor figures are in `anchors.test.ts`.
 * This file writes (a post, a school move), so it owns its runtime.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  ItemAnalysisMe,
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

describe('S9 / S10 / S11 access', () => {
  it('S9: parents and pelajar 403 (FR-MUR-6-2); own school for the school admin; another school by id is 403', async () => {
    expect((await getAs(runtime, PARENT, '/api/item-analysis/school')).status).toBe(403)
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/school/8880')).status).toBe(403)
    const own = await dataAs<SchoolItemAnalysis>(
      runtime,
      ADMIN_SEKOLAH,
      '/api/item-analysis/school',
    )
    expect(own.school.id).toBe(900001)
    expect(own.variant).toBe('own')
    // SMK DEMO: canonical 2 and 4 and 3001–3008 (10 pupils, D72), computed from the log (no observed summary).
    expect(own.students).toBe(10)
    expect(own.answers).toBeGreaterThan(80)
    expect(own.subjects.length).toBeGreaterThan(0)
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/school')).status).toBe(403)
    expect((await getAs(runtime, PELAJAR, '/api/item-analysis/school/900001')).status).toBe(403)
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

describe('S19 access (R1-MUR-18)', () => {
  it('only a pupil has a standing; every other role gets no scopes', async () => {
    for (const id of [ADMIN, GURU, ADMIN_SEKOLAH, PARENT]) {
      expect(await dataAs<Ranking>(runtime, id, '/api/rankings')).toEqual({ syiling: 0, scopes: [] })
    }
    const mine = await dataAs<Ranking>(runtime, PELAJAR, '/api/rankings')
    expect(mine.scopes.map((x) => x.scope)).toEqual(['sekolah', 'negeri', 'kebangsaan'])
    // the query string is ignored (no Skop / Subjek / Tingkatan)
    expect(await dataAs<Ranking>(runtime, PELAJAR, '/api/rankings?scope=negeri&tingkatan=T4')).toEqual(mine)
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
    setUserSchool(2008, 900001) // a Tingkatan 5 pupil of school 8080 (account 4 is already at SMK DEMO, D72)
    const after = await dataAs<SchoolPerformance>(runtime, ADMIN_SEKOLAH, '/api/performance/school')
    expect(after.stats.students).toBe(before.stats.students + 1)
    expect(after.header.studentCount).toBe(before.header.studentCount + 1)
  }, 120_000)
})

describe('Tingkatan view of a teacher (S10-T07, R1-GUR-4: own classes only)', () => {
  const codes = ['t1', 't2', 't3', 't4', 't5'] as const

  it('level detail lists only own classes and their pupils; the school admin still sees the rest', async () => {
    // Another teacher of the same school and level, with a pupil of her own (a pupil the teacher does not teach).
    const other = classrooms.create(
      { name: '4 Guru Lain', teacherId: GURU + 1000, schoolId: 900001, subjectId: null, educationLevel: 'tingkatan-4' },
      Date.parse('2026-09-25T15:40:00+08:00'),
    )
    classrooms.enrol(
      { kind: 'classroom', classId: other.classId, studentId: PELAJAR2, source: 'teacher' },
      Date.parse('2026-09-25T15:40:00+08:00'),
    )
    const own = new Set(
      classrooms
        .forTeacher(GURU)
        .filter((c) => c.kind === 'classroom' && c.isActive)
        .map((c) => c.classId),
    )
    const ownPupils = new Set(
      classrooms
        .forTeacher(GURU)
        .filter((c) => own.has(c.classId))
        .flatMap((c) => classrooms.memberIds(c.kind, c.classId)),
    )
    expect(own.has(other.classId)).toBe(false)
    let otherClassesSeenByAdmin = 0
    for (const code of codes) {
      const guru = await dataAs<LevelDetail>(runtime, GURU, `/api/performance/levels/${code}`)
      expect(
        guru.classRows.every((r) => own.has(r.classId)),
        `${code} class rows`,
      ).toBe(true)
      expect(guru.classes).toBe(guru.classRows.length)
      expect(guru.topStudents.every((t) => ownPupils.has(t.userId))).toBe(true)
      expect(guru.atRisk.every((t) => ownPupils.has(t.userId))).toBe(true)
      if (!ownPupils.has(PELAJAR2)) {
        expect([...guru.topStudents, ...guru.atRisk].some((t) => t.userId === PELAJAR2)).toBe(false)
      }
      const boss = await dataAs<LevelDetail>(runtime, ADMIN_SEKOLAH, `/api/performance/levels/${code}`)
      otherClassesSeenByAdmin += boss.classRows.filter((r) => !own.has(r.classId)).length
      expect(boss.classes).toBeGreaterThanOrEqual(guru.classes)
    }
    // Not vacuous: the school has classes the teacher does not teach, and the school admin sees them.
    expect(otherClassesSeenByAdmin).toBeGreaterThan(0)
  })

  it('the Tingkatan cards count the own classes only', async () => {
    const own = classrooms.forTeacher(GURU).filter((c) => c.kind === 'classroom' && c.isActive)
    const cards = await dataAs<{ code: string; classes: number }[]>(runtime, GURU, '/api/performance/levels')
    expect(cards.reduce((n, c) => n + c.classes, 0)).toBe(own.length)
  })
})

describe('GET /api/item-analysis/me (API-RPT-05, R1-MUR-6)', () => {
  it('answers the pupil own shape; every other role is 403', async () => {
    const me = await dataAs<ItemAnalysisMe>(runtime, PELAJAR, '/api/item-analysis/me')
    expect(Object.keys(me).sort()).toEqual(['counts', 'items', 'subjects', 'tiles'])
    expect(me.tiles.answered).toBeGreaterThan(0)
    expect(me.tiles.needRemedial).toBe(me.counts.pemulihan)
    expect(me.tiles.needStrengthen).toBe(me.counts.pengukuhan)
    const accuracies = me.subjects.map((s) => s.accuracy ?? 101)
    expect(accuracies).toEqual([...accuracies].sort((a, b) => a - b))
    for (const i of me.items) {
      expect(['isyarat_awal', 'pemulihan', 'pengukuhan']).toContain(i.category)
      if (i.category === 'isyarat_awal') expect([i.attempts, i.correct]).toEqual([1, 0])
      if (i.category === 'pemulihan') expect(i.correct === 0 && i.attempts >= 2).toBe(true)
      if (i.category === 'pengukuhan') expect(i.correct > 0 && i.correct < i.attempts).toBe(true)
      expect(i.wrongTimes).toBe(i.attempts - i.correct)
    }
    for (const who of [GURU, ADMIN_SEKOLAH, ADMIN, PARENT]) {
      expect((await getAs(runtime, who, '/api/item-analysis/me')).status).toBe(403)
    }
  })

  it('tapis filters the items only; tiles and counts do not change', async () => {
    const all = await dataAs<ItemAnalysisMe>(runtime, PELAJAR, '/api/item-analysis/me')
    const wrong = await dataAs<ItemAnalysisMe>(
      runtime,
      PELAJAR,
      '/api/item-analysis/me?tapis=selalu_salah',
    )
    const some = await dataAs<ItemAnalysisMe>(
      runtime,
      PELAJAR,
      '/api/item-analysis/me?tapis=ada_betul',
    )
    expect(wrong.tiles).toEqual(all.tiles)
    expect(wrong.counts).toEqual(all.counts)
    expect(wrong.items.every((i) => i.attempts >= 2 && i.correct === 0)).toBe(true)
    expect(some.items.every((i) => i.correct >= 1)).toBe(true)
    expect(wrong.items.length).toBe(all.counts.pemulihan)
  })
})

describe('S16 the feed `entries` and DELETE /api/timeline/:id (R1-MUR-39)', () => {
  const png = () => new File([new Uint8Array(64)], 'a.png', { type: 'image/png' })
  const create = async (userId: number, title: string): Promise<TimelinePost> => {
    const form = new FormData()
    form.append('title', title)
    form.append('category', 'cerita')
    form.append('photos[]', png())
    return (await send<{ data: TimelinePost }>(runtime, userId, 'POST', '/api/timeline', form)).body.data
  }

  it('lists own sessions, badges and posts newest first (at most 100), each with a +08:00 time', async () => {
    // 3001 is a designed pupil with a session history (the seeded pupils 2 and 3 have none).
    const mine = await create(3001, 'Dalam suapan')
    const t = await dataAs<Timeline>(runtime, 3001, '/api/timeline')
    const entries = t.entries ?? []
    expect(entries.length).toBeGreaterThan(1)
    expect(entries.length).toBeLessThanOrEqual(100)
    const ms = entries.map((e) => Date.parse(e.at))
    expect(ms).toEqual([...ms].sort((a, b) => b - a))
    expect(entries.every((e) => e.at.endsWith('+08:00'))).toBe(true)
    expect(entries.some((e) => e.kind === 'session')).toBe(true)
    const row = entries.find((e) => e.kind === 'post' && e.id === mine.id)
    expect(row).toBeDefined()
    for (const e of entries) {
      if (e.kind === 'session') {
        expect(e.answered).toBeGreaterThan(0)
        expect(e.accuracy).toBe(Math.round((e.correct / e.answered) * 100))
      }
      if (e.kind === 'post') expect(e.post.userId).toBe(3001)
    }
  })

  it('deletes an own post ({ deleted: 1 }); another user gets 404 and the post stays; an unknown id is 404', async () => {
    const mine = await create(PELAJAR2, 'Untuk dipadam')
    const other = await send(runtime, PELAJAR, 'DELETE', `/api/timeline/${String(mine.id)}`)
    expect(other.status).toBe(404)
    expect((await dataAs<Timeline>(runtime, PELAJAR2, '/api/timeline')).posts.map((p) => p.id)).toContain(mine.id)
    const gone = await send<{ data: { deleted: number } }>(runtime, PELAJAR2, 'DELETE', `/api/timeline/${String(mine.id)}`)
    expect(gone.status).toBe(200)
    expect(gone.body.data).toEqual({ deleted: 1 })
    const t = await dataAs<Timeline>(runtime, PELAJAR2, '/api/timeline')
    expect(t.posts.map((p) => p.id)).not.toContain(mine.id)
    expect((t.entries ?? []).some((e) => e.kind === 'post' && e.id === mine.id)).toBe(false)
    expect((await send(runtime, PELAJAR2, 'DELETE', '/api/timeline/999999')).status).toBe(404)
    expect((await send(runtime, null, 'DELETE', `/api/timeline/${String(mine.id)}`)).status).toBe(401)
  })

  it('the public profile carries posts only and no feed', async () => {
    const pub = await dataAs<Record<string, unknown>>(runtime, null, '/api/public/students/2')
    expect(pub).not.toHaveProperty('entries')
  })
})
