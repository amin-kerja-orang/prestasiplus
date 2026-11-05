import type { CommandCenterMoodCounts } from '@pp/contract'
import { KirkpatrickReactionSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MoodReadPort, MoodWindow } from '../../src/modules/command-center/shared/ports'
import { LogCapture } from '../support/app'
import { treatDemoAsSecondary } from '../support/secondary'
import {
  ADMIN,
  SCHOOL_ADMIN_A,
  SCHOOL_ADMIN_B,
  STUDENT_1,
  TEACHER_A,
  TEACHER_C,
  type Client,
  type KirkpatrickTestApp,
  type World,
  bootKirkpatrickApp,
  buildWorld,
  client,
  errorIs,
} from './helpers'

const MARKER = 'Komen-Sulit-Qw41'

/** A recording mood adapter: answers from fixed counts and remembers what it was asked. */
class FakeMood implements MoodReadPort {
  calls: { ids: string[] | null; window: MoodWindow | undefined }[] = []
  latestFor: string[] = []
  all: CommandCenterMoodCounts = { happy: 3, okay: 1, sad: 1, stressed: 0 }
  week: CommandCenterMoodCounts = { happy: 1, okay: 0, sad: 1, stressed: 0 }
  async counts(ids: string[] | null, window?: MoodWindow): Promise<CommandCenterMoodCounts> {
    this.calls.push({ ids, window })
    return window ? this.week : this.all
  }
  async latest(ids: string[]) {
    this.latestFor = ids
    return new Map([[ids[0] as string, 'happy' as const]])
  }
  async trend() {
    return []
  }
  async rows() {
    return []
  }
}

describe('GET /api/kirkpatrick/reaction (S2, API-RPT-11, FR-GUR-11-3) and the school_admin role rows', () => {
  let t: KirkpatrickTestApp
  let w: World
  const logs = new LogCapture()
  const mood = new FakeMood()
  let admin: Client
  let teacherA: Client
  let teacherC: Client
  let adminA: Client
  let adminB: Client
  let student: Client

  const addFeedback = (
    userId: string,
    schoolId: string,
    role: string,
    month: string,
    f: { nps: number | null; sat: number; usability?: number | null; relevance?: number | null; comment?: string | null; at: string; isTest?: boolean },
  ) =>
    t.db.query(
      `insert into feedback (user_id, role, school_id, month, nps, satisfaction, usability, relevance, comment, is_test, created_at, updated_at)
       values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11::timestamptz, $11::timestamptz)`,
      [userId, role, schoolId, month, f.nps, f.sat, f.usability ?? null, f.relevance ?? null, f.comment ?? null, f.isTest ?? false, f.at],
    )

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'debug'
    t = await bootKirkpatrickApp({ logStream: logs, env: { LOG_LEVEL: 'debug' }, moodPort: mood })
    await treatDemoAsSecondary(t.db, false)
    w = await buildWorld(t)
    admin = await client(t, ADMIN)
    teacherA = await client(t, TEACHER_A)
    teacherC = await client(t, TEACHER_C)
    adminA = await client(t, SCHOOL_ADMIN_A)
    adminB = await client(t, SCHOOL_ADMIN_B)
    student = await client(t, STUDENT_1)
  }, 180_000)
  afterAll(async () => {
    process.env.LOG_LEVEL = 'silent'
    await t.close()
  })

  const reaction = async (who: Client) => {
    const res = await who.get('/kirkpatrick/reaction')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return envelopeOf(KirkpatrickReactionSchema).parse(res.body).data
  }

  it('no feedback: counts are 0, usability and relevance null, no comments, mood percentages null', async () => {
    mood.all = { happy: 0, okay: 0, sad: 0, stressed: 0 }
    mood.week = { happy: 0, okay: 0, sad: 0, stressed: 0 }
    for (const who of [admin, teacherA, adminA, adminB]) {
      const data = await reaction(who)
      expect(data).toMatchObject({
        npsStudent: 0,
        npsTeacher: 0,
        npsAdmin: 0,
        satisfaction: 0,
        responses: 0,
        usability: null,
        relevance: null,
        promoters: 0,
        detractors: 0,
        writtenComments: 0,
        latestComments: [],
      })
      expect(data.mood.positivePct).toBeNull()
      expect(data.mood.checkIns).toBe(0)
      expect(data.mood.rows).toEqual([
        { mood: 'Gembira', count: 0, pct: null },
        { mood: 'Okay', count: 0, pct: null },
        { mood: 'Sedih', count: 0, pct: null },
        { mood: 'Tertekan', count: 0, pct: null },
      ])
    }
  })

  describe('with responses', () => {
    let baseA: Awaited<ReturnType<typeof reaction>>
    let baseAdmin: Awaited<ReturnType<typeof reaction>>
    let baseB: Awaited<ReturnType<typeof reaction>>
    beforeAll(async () => {
      baseA = await reaction(adminA)
      baseAdmin = await reaction(admin)
      baseB = await reaction(adminB)
      const { p1, p2, maju, pb, teacherA: tA, teacherB: tB } = w.ids
      await addFeedback(p1, w.schoolA, 'student', '2026-10-01', { nps: 10, sat: 5, usability: 4, relevance: 5, comment: `Bagus ${MARKER}`, at: '2026-10-10T10:00:00+08:00' })
      await addFeedback(p2, w.schoolA, 'student', '2026-10-01', { nps: 6, sat: 3, usability: 3, comment: '   ', at: '2026-10-11T10:00:00+08:00' })
      await addFeedback(maju, w.schoolA, 'student', '2026-10-01', { nps: 9, sat: 4, usability: 5, relevance: 4, comment: 'Baik', at: '2026-10-12T10:00:00+08:00' })
      await addFeedback(tA, w.schoolA, 'teacher', '2026-10-01', { nps: 7, sat: 4, at: '2026-10-09T10:00:00+08:00' })
      // Migrated rows (no NPS) with a comment each, one per older month: 12 of them, to prove the limit of 10.
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0')
        await addFeedback(tB, w.schoolA, 'teacher', `2025-${mm}-01`, { nps: null, sat: 3, comment: `Lama ${mm}`, at: `2025-${mm}-15T10:00:00+08:00` })
      }
      // Never counted: a Mod Pelajar row.
      await addFeedback(p1, w.schoolA, 'student', '2026-10-01', { nps: 0, sat: 1, comment: 'Ujian', at: '2026-10-18T10:00:00+08:00', isTest: true })
      // Another school.
      await addFeedback(pb, w.schoolB, 'student', '2026-10-01', { nps: 2, sat: 2, usability: 2, comment: 'LainSekolah', at: '2026-10-13T10:00:00+08:00' })
    })

    it('school scope: counts, means to one decimal, NPS bands, comment count, test rows left out', async () => {
      for (const who of [adminA, teacherA]) {
        const data = await reaction(who)
        expect(data.responses - baseA.responses).toBe(16)
        expect(data.usability).toBe(4) // (4 + 3 + 5) / 3
        expect(data.relevance).toBe(4.5) // (5 + 4) / 2
        expect(data.promoters - baseA.promoters).toBe(2) // nps 10 and 9
        expect(data.detractors - baseA.detractors).toBe(1) // nps 6; the migrated rows without NPS are not detractors; 7 is a passive
        expect(data.writtenComments - baseA.writtenComments).toBe(14) // a blank comment does not count
        expect(data.npsStudent).toBe(8.3) // (10 + 6 + 9) / 3
        expect(data.npsTeacher).toBe(7) // the 12 migrated rows have no NPS
      }
    })

    it('latestComments: newest first, at most 10, MYT day, shape of the comment row', async () => {
      const data = await reaction(adminA)
      expect(data.latestComments).toHaveLength(10)
      expect(data.latestComments.slice(0, 3)).toEqual([
        { comment: 'Baik', nps: 9, satisfaction: 4, date: '2026-10-12' },
        { comment: `Bagus ${MARKER}`, nps: 10, satisfaction: 5, date: '2026-10-10' },
        { comment: 'Lama 12', nps: null, satisfaction: 3, date: '2025-12-15' },
      ])
      expect(data.latestComments[9]?.comment).toBe('Lama 05')
      const dates = data.latestComments.map((c) => c.date)
      expect([...dates].sort().reverse()).toEqual(dates)
      expect(data.latestComments.some((c) => c.comment === 'Ujian' || c.comment === 'LainSekolah')).toBe(false)
    })

    it('admin sees the platform, school_admin B only the own school', async () => {
      const platform = await reaction(admin)
      expect(platform.responses - baseAdmin.responses).toBe(17)
      expect(platform.latestComments[0]?.comment).toBe('LainSekolah')
      const own = await reaction(adminB)
      expect(own.responses - baseB.responses).toBe(1)
      expect(own.detractors - baseB.detractors).toBe(1)
      expect(own.writtenComments - baseB.writtenComments).toBe(1)
      expect(own.latestComments[0]).toEqual({ comment: 'LainSekolah', nps: 2, satisfaction: 2, date: '2026-10-13' })
      expect((await reaction(teacherC)).responses).toBe(own.responses)
    })

    it('comment text is never written to the log', async () => {
      await reaction(adminA)
      await reaction(teacherA)
      expect(logs.lines.length).toBeGreaterThan(0)
      expect(logs.lines.join('\n')).not.toContain(MARKER)
    })
  })

  describe('mood block (Command Center port)', () => {
    it('maps the port counts to the BM labels, rounds the percentages and passes the pupils in scope', async () => {
      mood.calls = []
      mood.all = { happy: 3, okay: 1, sad: 1, stressed: 0 }
      mood.week = { happy: 1, okay: 0, sad: 1, stressed: 0 }
      const data = await reaction(adminA)
      expect(data.mood).toEqual({
        positivePct: 80,
        checkIns: 5,
        engaged: 1,
        pupils: 4,
        last7Days: 2,
        rows: [
          { mood: 'Gembira', count: 3, pct: 60 },
          { mood: 'Okay', count: 1, pct: 20 },
          { mood: 'Sedih', count: 1, pct: 20 },
          { mood: 'Tertekan', count: 0, pct: 0 },
        ],
      })
      // All time and the last 7 days, both for the pupils in scope (never null).
      expect(mood.calls).toHaveLength(2)
      expect(mood.calls.every((c) => Array.isArray(c.ids) && c.ids.length === 4)).toBe(true)
      const windowed = mood.calls.find((c) => c.window !== undefined)
      // Clock is 2026-10-19 09:00 MYT: the window starts at 00:00 MYT of 2026-10-13 (today minus 6) and ends now.
      expect(windowed?.window?.from.toISOString()).toBe('2026-10-12T16:00:00.000Z')
      expect(windowed?.window?.to.toISOString()).toBe('2026-10-19T01:00:00.000Z')
    })

    it('a teacher passes the pupils of the own classes only', async () => {
      mood.calls = []
      const data = await reaction(teacherA)
      expect(data.mood.pupils).toBe(2)
      expect([...(mood.calls[0]?.ids ?? [])].sort()).toEqual([w.ids.p1, w.ids.p2].sort())
    })

    it('admin passes the active pupils of every school', async () => {
      mood.calls = []
      const data = await reaction(admin)
      const n = (await t.db.query<{ n: number }>(`select count(*)::int as n from users u where u.is_active and u.school_id is not null and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student')`))[0]?.n
      expect(data.mood.pupils).toBe(n)
      expect(mood.calls[0]?.ids).not.toBeNull()
    })
  })

  describe('role rows: school_admin reads every staff endpoint, the own school only', () => {
    it('answers 200 on every level route, the filter, the pupil view, the list and the PDF', async () => {
      const paths = [
        '/kirkpatrick/overview',
        '/kirkpatrick/reaction',
        '/kirkpatrick/learning',
        '/kirkpatrick/behavior',
        '/kirkpatrick/results',
        '/kirkpatrick/chain',
        '/kirkpatrick/filter-options',
        '/kirkpatrick/interventions',
        '/kirkpatrick/export-pdf',
        `/kirkpatrick/students/${w.ids.p1}`,
      ]
      for (const who of [adminA, adminB]) for (const path of paths) expect((await who.get(path)).status, path).toBe(200)
      const own = (await adminA.get('/kirkpatrick/filter-options')).body.data
      expect(own.schools).toEqual([{ id: w.schoolA, name: expect.any(String) }])
    })

    it('the pupil view of another school (or an unknown id) is 404 for school_admin and teacher, not 403', async () => {
      errorIs(await adminA.get(`/kirkpatrick/students/${w.ids.pb}`), 404, 'NOT_FOUND')
      errorIs(await adminB.get(`/kirkpatrick/students/${w.ids.p1}`), 404, 'NOT_FOUND')
      errorIs(await adminA.get('/kirkpatrick/students/987654321'), 404, 'NOT_FOUND')
      errorIs(await teacherA.get(`/kirkpatrick/students/${w.ids.maju}`), 404, 'NOT_FOUND')
    })

    it('a student is 403 on the reaction route', async () => {
      errorIs(await student.get('/kirkpatrick/reaction'), 403, 'FORBIDDEN')
    })
  })
})
