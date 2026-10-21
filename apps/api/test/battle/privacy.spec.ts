import { BattleSchoolDetailSchema, BattleStudentStandingSchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { curriculumSeed } from '../../prisma/seed/curriculum'
import { displayName } from '../../src/modules/battle/privacy'
import type { LoggedIn } from '../auth/helpers'
import { addBattle, bootStandings, getAs, S, schoolIdOf, userIdOf, type StandingsApp } from './standings-helpers'

// Children's names rule (LEAD 2026-10-21, issue #76): full name + id only inside the viewer's scope.
const NOW = '2026-10-21T10:00:00+08:00'
const Students = z.object({ data: z.array(BattleStudentStandingSchema) })
const School = z.object({ data: BattleSchoolDetailSchema })
const History = z.object({ data: z.array(z.object({ uuid: z.string(), playerA: z.object({ id: z.string().nullable(), name: z.string() }), playerB: z.object({ id: z.string().nullable(), name: z.string() }) })) })

/** Fictitious names; the score of each pupil is unique so a row can be told apart without the id. */
const PEOPLE = {
  aina: { email: S.D1(1), name: 'Aina Zulkifli', masked: 'Aina Z.', skor: 90 },
  bilal: { email: S.D1(2), name: 'Bilal Hashim', masked: 'Bilal H.', skor: 70 },
  dewi: { email: S.D1(3), name: 'Dewi Anggraini', masked: 'Dewi A.', skor: 30 },
  cheng: { email: S.D2(1), name: 'Cheng Wei Lim', masked: 'Cheng L.', skor: 10 },
} as const
type Key = keyof typeof PEOPLE

describe('children names in battle surfaces (issue #76)', () => {
  let t: StandingsApp
  const id = {} as Record<Key, string>
  const who = {} as Record<'admin' | 'schoolAdmin' | 'teacher' | 'aina' | 'parent' | 'ppd', LoggedIn>
  let d1: string
  let d2: string
  let battle1: string
  let battle2: string

  beforeAll(async () => {
    t = await bootStandings(NOW, [curriculumSeed])
    for (const [k, p] of Object.entries(PEOPLE)) {
      await t.db.query(`update users set name = $1 where email = $2`, [p.name, p.email])
      id[k as Key] = await userIdOf(t.db, p.email)
    }
    d1 = await schoolIdOf(t.db, 'DEMO001')
    d2 = await schoolIdOf(t.db, 'DEMO002')
    const at = '2026-10-20T10:00:00+08:00'
    battle1 = await addBattle(t.db, { a: S.D1(1), b: S.D2(1), scoreA: 9000, scoreB: 1000, at })
    battle2 = await addBattle(t.db, { a: S.D1(2), b: S.D1(3), scoreA: 7000, scoreB: 3000, at: '2026-10-20T09:00:00+08:00' })
    // The teacher owns one class holding only Aina.
    const teacher = await userIdOf(t.db, S.TEACHER)
    const level = (await t.db.query<{ id: string }>(`select id::text from education_levels order by id limit 1`))[0]!.id
    const cls = (await t.db.query<{ id: string }>(`insert into classrooms (name, teacher_id, education_level_id, academic_year) values ('K', $1, $2, 2026) returning id::text`, [teacher, level]))[0]!.id
    await t.db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, 'active', 'teacher')`, [cls, id.aina])
    who.admin = await t.login(S.ADMIN)
    who.schoolAdmin = await t.login('adminsekolah@demo.test')
    who.teacher = await t.login(S.TEACHER)
    who.aina = await t.login(S.D1(1))
    who.parent = await t.login('ibubapa@demo.test')
    who.ppd = await t.login('ppd@demo.test')
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  const bySkor = <T extends { skor: number }>(rows: T[], k: Key): T | undefined => rows.find((r) => r.skor === PEOPLE[k].skor)
  /** Expect row `r` to show `k` in full (name and id) or masked (initial form, null id). */
  const shows = (r: { userId: string | null; name: string } | undefined, k: Key, full: boolean) => {
    expect(r, k).toBeDefined()
    expect(r!.name, k).toBe(full ? PEOPLE[k].name : PEOPLE[k].masked)
    expect(r!.userId, k).toBe(full ? id[k] : null)
  }
  const students = async (v: LoggedIn) => {
    const res = await getAs(v, '/battle/standings/students')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Students.parse(res.body).data
  }
  const page = async (v: LoggedIn, school: string) => {
    const res = await getAs(v, `/battle/schools/${school}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return School.parse(res.body).data
  }

  it('displayName: first name + initial of the last word; one word stays; empty stays empty', () => {
    expect(displayName('Aina Zulkifli')).toBe('Aina Z.')
    expect(displayName('  Cheng   Wei Lim ')).toBe('Cheng L.')
    expect(displayName('Aina')).toBe('Aina')
    expect(displayName('aina zulkifli')).toBe('aina Z.')
    expect(displayName('Aina Élis')).toBe('Aina É.')
    expect(displayName('')).toBe('')
    expect(displayName('   ')).toBe('')
  })

  describe('GET /battle/standings/students', () => {
    it('admin sees every pupil in full', async () => {
      const rows = await students(who.admin)
      for (const k of Object.keys(PEOPLE) as Key[]) shows(bySkor(rows, k), k, true)
    })
    it('school admin: full for the own school (DEMO001), masked with a null id for another school', async () => {
      const rows = await students(who.schoolAdmin)
      shows(bySkor(rows, 'aina'), 'aina', true)
      shows(bySkor(rows, 'bilal'), 'bilal', true)
      shows(bySkor(rows, 'dewi'), 'dewi', true)
      shows(bySkor(rows, 'cheng'), 'cheng', false)
    })
    it('teacher: full for pupils of the own classes only', async () => {
      const rows = await students(who.teacher)
      shows(bySkor(rows, 'aina'), 'aina', true)
      for (const k of ['bilal', 'dewi', 'cheng'] as const) shows(bySkor(rows, k), k, false)
    })
    it('student: full for the own row only', async () => {
      const rows = await students(who.aina)
      shows(bySkor(rows, 'aina'), 'aina', true)
      for (const k of ['bilal', 'dewi', 'cheng'] as const) shows(bySkor(rows, k), k, false)
      // another student sees nobody in full
      const other = await students(await t.login(S.D1(2)))
      shows(bySkor(other, 'bilal'), 'bilal', true)
      shows(bySkor(other, 'aina'), 'aina', false)
    })
    it('parent and PPD officer see everybody masked', async () => {
      for (const v of [who.parent, who.ppd]) {
        const rows = await students(v)
        expect(rows).toHaveLength(4)
        for (const k of Object.keys(PEOPLE) as Key[]) shows(bySkor(rows, k), k, false)
      }
    })
  })

  describe('GET /battle/schools/:id', () => {
    it('admin: fighters and recent in full', async () => {
      const p = await page(who.admin, d1)
      shows(bySkor(p.fighters, 'aina'), 'aina', true)
      const r1 = p.recent.find((r) => r.uuid === battle1)!
      expect([r1.playerA.id, r1.playerA.name, r1.playerB.id, r1.playerB.name]).toEqual([id.aina, PEOPLE.aina.name, id.cheng, PEOPLE.cheng.name])
    })
    it('school admin of DEMO001: own pupils full, the DEMO002 opponent masked (fighters and recent)', async () => {
      const own = await page(who.schoolAdmin, d1)
      for (const k of ['aina', 'bilal', 'dewi'] as const) shows(bySkor(own.fighters, k), k, true)
      const r1 = own.recent.find((r) => r.uuid === battle1)!
      expect([r1.playerA.id, r1.playerA.name, r1.playerB.id, r1.playerB.name]).toEqual([id.aina, PEOPLE.aina.name, null, PEOPLE.cheng.masked])
      expect(r1.playerA.homeHere).toBe(true)
      const other = await page(who.schoolAdmin, d2)
      shows(bySkor(other.fighters, 'cheng'), 'cheng', false)
      const r2 = other.recent.find((r) => r.uuid === battle1)!
      expect([r2.playerA.id, r2.playerB.id]).toEqual([id.aina, null])
    })
    it('teacher: only the own-class pupil is full', async () => {
      const p = await page(who.teacher, d1)
      shows(bySkor(p.fighters, 'aina'), 'aina', true)
      shows(bySkor(p.fighters, 'bilal'), 'bilal', false)
      const r2 = p.recent.find((r) => r.uuid === battle2)!
      expect([r2.playerA.id, r2.playerA.name, r2.playerB.id, r2.playerB.name]).toEqual([null, PEOPLE.bilal.masked, null, PEOPLE.dewi.masked])
    })
    it('student: own row full; own match full on both sides; a match of others masked', async () => {
      const p = await page(who.aina, d1)
      shows(bySkor(p.fighters, 'aina'), 'aina', true)
      shows(bySkor(p.fighters, 'bilal'), 'bilal', false)
      const r1 = p.recent.find((r) => r.uuid === battle1)!
      expect([r1.playerA.id, r1.playerA.name, r1.playerB.id, r1.playerB.name]).toEqual([id.aina, PEOPLE.aina.name, id.cheng, PEOPLE.cheng.name])
      const r2 = p.recent.find((r) => r.uuid === battle2)!
      expect([r2.playerA.id, r2.playerB.id]).toEqual([null, null])
    })
    it('parent: everything masked', async () => {
      const p = await page(who.parent, d1)
      expect(p.fighters.every((f) => f.userId === null)).toBe(true)
      expect(p.recent.every((r) => r.playerA.id === null && r.playerB.id === null)).toBe(true)
      expect(JSON.stringify(p)).not.toMatch(/Zulkifli|Hashim|Anggraini|Wei Lim/)
    })
  })

  it('GET /battle/history: the caller own battles keep full names and ids on both sides', async () => {
    const res = await getAs(who.aina, '/battle/history')
    const rows = History.parse(res.body).data
    expect(rows.map((r) => r.uuid)).toEqual([battle1])
    expect([rows[0]!.playerA.id, rows[0]!.playerA.name, rows[0]!.playerB.id, rows[0]!.playerB.name]).toEqual([id.aina, PEOPLE.aina.name, id.cheng, PEOPLE.cheng.name])
  })
})
