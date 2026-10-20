import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { slugOfGrade } from '../../src/modules/classes/level-slug'
import { PerformanceClassesReadAdapter } from '../../src/modules/classes/performance-classes-read.adapter'
import { PerformancePorts } from '../../src/modules/reports/performance'
import {
  describeClassesReadPort,
  type ClassesHarness,
  type ClassesSeed,
} from '../reports/performance/port-contract/classes-read.contract'
import { bootClassesApp, firstSubject, schoolOfCode, type ClassesTestApp } from './helpers'

/**
 * The real `ClassesReadPort` of BE-19 over BE-17 classes, on a seeded database: the same contract suite the in-memory
 * fake passes (test/reports/performance/port-contract), plus the binding in `ClassesModule.onModuleInit`.
 */
let t: ClassesTestApp
let round = 0

async function build(seed: ClassesSeed): Promise<ClassesHarness> {
  round += 1
  const q = t.db.query.bind(t.db)
  const one = async (sql: string, params: unknown[] = []): Promise<string> => ((await q<{ id: string }>(sql, params))[0] as { id: string }).id

  // A clean roster per scenario; users and classes of earlier scenarios stay out of the way.
  await q(`delete from enrolments`)
  await q(`delete from classrooms`)

  const schoolCodes = ['DEMO001', 'DEMO002']
  const schools = new Map(await Promise.all(seed.schools.map(async (k, i) => [k, await schoolOfCode(t, schoolCodes[i] as string)] as const)))
  const users = new Map<string, string>()
  for (const tc of seed.teachers) {
    const id = await one(`insert into users (name, school_id) values ($1, $2) returning id::text`, [tc.name, schools.get(tc.school)])
    await q(`insert into user_roles (user_id, role) values ($1, 'teacher')`, [id])
    users.set(tc.key, id)
  }
  for (const p of seed.pupils) {
    const id = await one(`insert into users (name) values ($1) returning id::text`, [`Murid Kontrak ${round} ${p}`])
    users.set(p, id)
  }

  const subject = await firstSubject(t)
  const levels = new Map<number, string>()
  for (const grade of [10, 11]) levels.set(grade, (await q<{ id: string; code: string }>(`select id::text, code from education_levels where grade = $1 order by sort_order, id limit 1`, [grade]))[0]?.id as string)
  const levelCode = async (grade: number): Promise<string> =>
    ((await q<{ code: string }>(`select code from education_levels where id = $1`, [levels.get(grade)]))[0] as { code: string }).code.toLowerCase()
  const slugs = new Map<number, string>([
    [10, await levelCode(10)],
    [11, await levelCode(11)],
  ])

  const classes = new Map<string, string>()
  for (const c of seed.classes) {
    const kind = c.kind ?? 'classroom'
    const id = await one(
      `insert into classrooms (kind, name, teacher_id, school_id, subject_id, education_level_id, academic_year, join_code, is_active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id::text`,
      [kind, c.name, c.teacher === null ? null : users.get(c.teacher), schools.get(c.school), c.subject === null ? null : subject.id, levels.get(c.grade), c.year, kind === 'classroom' ? `K${round}${c.key}` : null, c.active],
    )
    classes.set(c.key, id)
    for (const [list, status] of [
      [c.members, 'active'],
      [c.removed ?? [], 'removed'],
    ] as const) {
      for (const p of list) await q(`insert into enrolments (classroom_id, student_id, status, source) values ($1, $2, $3, 'code')`, [id, users.get(p), status])
    }
  }

  const need = (m: Map<string, string>, k: string): string => m.get(k) ?? k
  return {
    port: t.get(PerformanceClassesReadAdapter),
    classId: (k) => need(classes, k),
    userId: (k) => need(users, k),
    schoolId: (k) => need(schools, k),
    subject: () => subject,
    levelSlug: (g) => slugs.get(g) as string,
    classLevelSlug: (g) => slugOfGrade(g) as string,
  }
}

beforeAll(async () => {
  t = await bootClassesApp()
}, 120_000)
afterAll(async () => {
  await t.close()
})

describeClassesReadPort('PerformanceClassesReadAdapter (BE-17 classes)', (seed) => build(seed))

describe('ClassesModule binds the port for BE-19', () => {
  it('PerformancePorts.classes is the real adapter, set once at module init', () => {
    expect(t.get(PerformancePorts).classes).toBeInstanceOf(PerformanceClassesReadAdapter)
  })

  it('ignores Mod Pelajar enrolments in counts and members', async () => {
    const h = await build({
      schools: ['S1'],
      teachers: [{ key: 'T1', name: 'Cikgu Ujian Mod', school: 'S1' }],
      pupils: ['P1', 'P2'],
      classes: [{ key: 'C1', name: 'Kelas Mod', school: 'S1', teacher: 'T1', subject: null, grade: 10, year: 2026, active: true, members: ['P1'] }],
    })
    await t.db.query(`insert into enrolments (classroom_id, student_id, status, source, is_test) values ($1, $2, 'active', 'code', true)`, [h.classId('C1'), h.userId('P2')])
    expect((await h.port.classById(h.classId('C1')))?.studentCount).toBe(1)
    expect(await h.port.memberIds(h.classId('C1'))).toEqual([h.userId('P1')])
    expect(await h.port.isMemberOfTeacher(h.userId('T1'), h.userId('P2'))).toBe(false)
    expect((await h.port.classIdsOfStudents([h.userId('P2')])).get(h.userId('P2'))).toEqual([])
  })
})
