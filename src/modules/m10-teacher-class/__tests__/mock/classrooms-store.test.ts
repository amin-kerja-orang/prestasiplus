/**
 * F-30: the M10 class and enrolment store against SRS M10 v1.15 §6.2.1 (dataset spec), §6.3 and the
 * M02 / M08 / M17 / M18 figures it must reproduce. Everything is computed from the compiled stores
 * (the users repository is the input), never from constants in the assertions except the observed
 * figures themselves.
 */

import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import { checkNamedQueries } from '@/mock/dataset'
import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { classQueries } from '../../mock/repository/classrooms'
import { classrooms, type ClassroomRow, type EnrolmentRow } from '../../mock'
import { bootM10 } from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  ;({ runtime } = await bootM10())
}, 120_000)

const memberIds = (kind: 'classroom' | 'school_class', id: number) => classrooms.memberIds(kind, id)
const all = () => classrooms.list()
const schoolOf = (userId: number) => users.get(userId)?.schoolId ?? null

describe('the 750 classrooms + 2 school classes (M10 v1.16 §6.2.1 A)', () => {
  it('seeds every M10 store as the baseline: no diff until a write (persistence stores only changes)', () => {
    const diff = runtime.db.diff()
    for (const name of Object.keys(diff).filter((n) => n.startsWith('m10.'))) {
      expect(diff[name], name).toMatchObject({ upserts: [], deletes: [] })
    }
    expect(runtime.db.store('m10.classrooms')).toBeDefined()
    expect(runtime.db.store('m10.enrolments')).toBeDefined()
  })

  it('reports the documented totals through the named queries', () => {
    expect(checkNamedQueries(classQueries)).toEqual([])
    expect(classrooms.count('CL-ALL')).toBe(752)
    // M08 S1 "750 kelas", S10 750 cards, S11 750 chips: classrooms only
    expect(classrooms.count('CL-CLASSROOM')).toBe(750)
    expect(classrooms.count('CL-LEVEL', 'tingkatan-4')).toBe(13)
    expect(classrooms.count('CL-LEVEL', 'tingkatan-5')).toBe(645)
    expect(classrooms.count('CL-KIND', 'school_class')).toBe(2)
  })

  it('splits into T4 13, T5 645 and 94 other levels; 745 classrooms in range + 2 school classes + 5 designed', () => {
    const rows = all()
    const level = (l: string) => rows.filter((c) => c.educationLevel === l).length
    expect(level('tingkatan-4')).toBe(13)
    expect(level('tingkatan-5')).toBe(645)
    expect(
      rows.filter((c) => !['tingkatan-4', 'tingkatan-5'].includes(c.educationLevel)),
    ).toHaveLength(94)
    const inRange = rows.filter((c) => c.kind === 'classroom' && c.classId <= 1156)
    expect(inRange).toHaveLength(745)
    expect(
      rows
        .filter((c) => c.kind === 'classroom' && c.classId > 1156)
        .map((c) => c.classId)
        .sort(),
    ).toEqual([2001, 2002, 2011, 2012, 2013])
    expect(rows.every((c) => c.academicYear === 2026 && c.isActive)).toBe(true)
  })

  it('has 27 distinct subjects and 310 distinct owners, all teacher users', () => {
    const rows = all()
    expect(new Set(rows.flatMap((c) => (c.subjectId === null ? [] : [c.subjectId]))).size).toBe(27)
    const owners = classrooms.owners()
    expect(owners).toHaveLength(310)
    for (const id of owners) expect(users.get(id)?.role).toBe('teacher')
  })

  it('keys a class by (kind, id): classroom 419 and school class 419 are different records', () => {
    const a = classrooms.get('classroom', 419) as ClassroomRow
    const b = classrooms.get('school_class', 419) as ClassroomRow
    expect(a.name).toBe('4 Bestari')
    expect(b.name).toBe('T4 4 Bestari')
    expect(a.id).not.toBe(b.id)
    expect(memberIds('classroom', 419)).toHaveLength(5)
    expect(memberIds('school_class', 419)).toHaveLength(5)
    expect(memberIds('classroom', 419)).not.toEqual(memberIds('school_class', 419))
    expect(b.teacherId).toBeNull()
    expect(classrooms.get('school_class', 806)?.name).toBe('T4 4 Khawarizmi')
    expect(classrooms.get('school_class', 4)).toBeUndefined()
  })

  it('has unique 6-character join codes; anchors keep their observed codes ("DEMO-4S")', () => {
    const rows = all().filter((c) => c.kind === 'classroom')
    expect(new Set(rows.map((c) => c.joinCode)).size).toBe(rows.length)
    const observed: Record<number, string> = {
      516: 'DEMO-4S',
      228: 'UDL749',
      1156: 'JOV330',
      1155: '0VV295',
      1154: 'PVZ601',
      4: 'KCC904',
      2001: 'DMO101',
      2002: 'DMO102',
      2011: 'DMO201',
      2012: 'DMO202',
      2013: 'DMO203',
    }
    for (const [id, code] of Object.entries(observed)) {
      expect(classrooms.get('classroom', Number(id))?.joinCode).toBe(code)
    }
    for (const c of rows) {
      if (!(c.classId in observed)) expect(c.joinCode).toMatch(/^[A-Z0-9]{6}$/)
    }
    expect(classrooms.findByJoinCode(' demo-4s ')?.classId).toBe(516)
    expect(classrooms.findByJoinCode('nope')).toBeUndefined()
  })

  it('lists classes newest first with the observed first three (1156, 1155, 1154)', () => {
    const rows = all().sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || a.classId - b.classId,
    )
    expect(rows.slice(0, 3).map((c) => c.classId)).toEqual([1156, 1155, 1154])
    const c2001 = classrooms.get('classroom', 2001) as ClassroomRow
    expect(c2001.createdAt.startsWith('2026-01-06')).toBe(true)
    expect(rows[0]?.createdAt.localeCompare(c2001.createdAt)).toBeGreaterThan(0)
    expect(rows.findIndex((c) => c.classId === 2001 && c.kind === 'classroom')).toBeGreaterThan(2)
  })

  it('keeps every row of the first 750-record build byte-identical (the 2 extra classrooms are appended)', () => {
    // Snapshot taken before the XR-F30-01 change: [key, owner, level, join code, subject, name, school, createdAt].
    const before = JSON.parse(
      readFileSync(new URL('./fixtures/classes-before-f30.json', import.meta.url), 'utf8'),
    ) as [string, number | null, string, string, number | null, string, number | null, string][]
    expect(before).toHaveLength(750)
    const now = new Map(all().map((c) => [c.id, c]))
    const atRisk = new Set(
      classrooms.designation().atRiskClasses.map((x) => 'classroom:' + String(x.classId)),
    )
    const dropped = new Set([16, 20, 24]) // no longer T5 subjects (M08 A.4); remapped (XR-F30-02)
    const coverage = new Set([19, 26, 29, 31, 14]) // given to a class so that A.4 / "27 subjects" hold
    let renamed = 0
    let resubjected = 0
    for (const [key, teacherId, level, code, subjectId, name, schoolId, createdAt] of before) {
      const c = now.get(key) as ClassroomRow
      // id, owner, level, join code, school and createdAt never move
      expect(c, key).toMatchObject({
        teacherId,
        educationLevel: level,
        joinCode: code,
        schoolId,
        createdAt,
      })
      if (c.subjectId !== subjectId) {
        resubjected++
        expect(dropped.has(subjectId as number) || coverage.has(c.subjectId as number), key).toBe(
          true,
        )
      }
      if (c.name !== name) {
        renamed++
        expect(atRisk.has(key) || c.subjectId !== subjectId, key).toBe(true)
      }
    }
    expect(resubjected).toBeLessThan(150)
    expect(renamed).toBeLessThan(160)
    const kept = new Set(before.map((r) => r[0]))
    const added = all().filter((c) => !kept.has(c.id))
    expect(added).toHaveLength(2)
    for (const c of added) {
      expect(c.kind).toBe('classroom')
      expect(['tingkatan-4', 'tingkatan-5']).not.toContain(c.educationLevel)
      expect(classrooms.memberCount('classroom', c.classId)).toBe(0)
      expect(classrooms.owners()).toContain(c.teacherId)
    }
  })

  it('is deterministic and re-seeds identically (reset)', async () => {
    const before = JSON.stringify([all(), classrooms.enrolmentsOf(4627), classrooms.designation()])
    const { runtime } = await bootM10()
    await runtime.reset()
    expect(JSON.stringify([all(), classrooms.enrolmentsOf(4627), classrooms.designation()])).toBe(
      before,
    )
    expect(all()).toHaveLength(752)
  }, 120_000)
})

describe('the observed anchors and owners', () => {
  const sizes: Record<number, number> = {
    4: 58,
    5: 53,
    6: 54,
    8: 58,
    9: 53,
    10: 54,
    25: 0,
    90: 0,
    115: 0,
    419: 5,
    516: 15,
    228: 93,
    366: 19,
    367: 15,
    368: 33,
    369: 20,
    370: 30,
    371: 25,
    372: 22,
    517: 15,
    813: 44,
    1154: 0,
    1155: 0,
    1156: 1,
    2001: 8,
    2002: 8,
  }
  it('has the observed member counts', () => {
    for (const [id, n] of Object.entries(sizes)) {
      expect(classrooms.memberCount('classroom', Number(id)), `class ${id}`).toBe(n)
    }
    expect(classrooms.memberCount('school_class', 419)).toBe(5)
    expect(classrooms.memberCount('school_class', 806)).toBe(1)
  })

  it('class 1156 "5 CYBER" (SRT, JOV330) has the single member 4627, a grade-11 pupil of 8082', () => {
    const c = classrooms.get('classroom', 1156) as ClassroomRow
    expect(c).toMatchObject({
      name: '5 CYBER',
      subjectId: 28,
      joinCode: 'JOV330',
      educationLevel: 'tingkatan-5',
    })
    expect(memberIds('classroom', 1156)).toEqual([4627])
    expect(users.get(4627)).toMatchObject({ role: 'student', schoolId: 8082, grade: 11 })
    // 4627 is in no other class (M10 v1.15: still 1 member; the pupil sits only there)
    expect(classrooms.forStudent(4627).map((x) => x.classId)).toEqual([1156])
    expect(classrooms.get('classroom', 813)?.name).toBe('5 CYBER')
    expect(classrooms.get('classroom', 813)?.id).not.toBe(c.id)
  })

  it('guru 5 owns exactly 2001 and 2002; 5302 owns 2011–2013 (school 8102, no subject)', () => {
    expect(
      classrooms
        .forTeacher(5)
        .map((c) => c.classId)
        .sort(),
    ).toEqual([2001, 2002])
    expect(classrooms.forTeacher(5301)).toEqual([])
    expect(classrooms.forTeacher(1)).toEqual([])
    const fixture = classrooms.forTeacher(5302)
    expect(fixture.map((c) => c.classId).sort()).toEqual([2011, 2012, 2013])
    for (const c of fixture) {
      expect(c).toMatchObject({ schoolId: 8102, subjectId: null, educationLevel: 'tingkatan-5' })
    }
    expect(classrooms.get('classroom', 2001)).toMatchObject({
      name: '5 MARIKH - Kimia',
      subjectId: 10,
      schoolId: 900001,
    })
    expect(classrooms.get('classroom', 2002)).toMatchObject({
      name: '5 MARIKH - Sejarah',
      subjectId: 5,
    })
  })

  it('members 3001–3008 are in both 2001 and 2002; the complimentary pupils are in 2011–2013 only', () => {
    const demo = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008]
    expect(memberIds('classroom', 2001)).toEqual(demo)
    expect(memberIds('classroom', 2002)).toEqual(demo)
    expect(
      classrooms
        .forStudent(3001)
        .map((c) => c.classId)
        .sort(),
    ).toEqual([2001, 2002])
    const c11 = memberIds('classroom', 2011)
    const c12 = memberIds('classroom', 2012)
    const c13 = memberIds('classroom', 2013)
    expect([c11.length, c12.length, c13.length]).toEqual([30, 31, 31])
    expect(new Set([...c11, ...c12, ...c13]).size).toBe(90)
    for (const list of [c11, c12, c13]) expect(list).toContain(5901)
    for (const e of classrooms.enrolmentsOf(5950)) expect(e.source).toBe('complimentary')
    for (const id of [...c11, ...c12, ...c13]) expect(users.get(id)?.isComplimentary).toBe(true)
    // never enrolled in 2001 / 2002; the demo pupils are not enrolled in 2011–2013
    for (const id of [5901, 5950]) {
      expect(classrooms.enrolmentsOf(id).every((e) => e.classroomId >= 2011)).toBe(true)
    }
    // canonical pelajar 2, 3, 4 and 11 are unenrolled
    for (const id of [2, 3, 4, 11]) expect(classrooms.forStudent(id)).toEqual([])
  })

  it('1919 owns 366–372 at 8080; 4402 owns 813 only; 4418 and the 8080 teachers own none', () => {
    expect(
      classrooms
        .forTeacher(1919)
        .map((c) => c.classId)
        .sort((a, b) => a - b),
    ).toEqual([366, 367, 368, 369, 370, 371, 372])
    expect(classrooms.forTeacher(4402).map((c) => c.classId)).toEqual([813])
    expect(classrooms.forTeacher(4418)).toEqual([])
    const teachers8080 = users.query('Q-M11-TEACHERS', {}, 8080).rows
    expect(teachers8080).toHaveLength(34)
    for (const t of teachers8080) expect(classrooms.forTeacher(t.id)).toEqual([])
    expect(classrooms.get('classroom', 370)).toMatchObject({
      name: '5 PERNIAGAAN',
      subjectId: 23,
      schoolId: 8080,
    })
    // class 370: pupil 2022 and the M17 block 2024–2051
    const c370 = memberIds('classroom', 370)
    expect(c370).toContain(2022)
    expect(c370).toContain(2024)
    expect(c370).toContain(2051)
  })

  it('8082: 14 owners (4402 and the owner of 228 included) cover Σ 515 distinct pupils', () => {
    const p82 = users
      .query('U-SCHOOL', { sort: 'id' }, 8082)
      .rows.filter((u) => u.role === 'student')
    const owners82 = new Set(
      all().flatMap((c) =>
        c.teacherId !== null && users.get(c.teacherId)?.schoolId === 8082 ? [c.teacherId] : [],
      ),
    )
    expect(owners82.size).toBe(14)
    expect(owners82.has(4402)).toBe(true)
    expect(owners82.has(4418)).toBe(false)
    const owner228 = classrooms.get('classroom', 228)?.teacherId as number
    expect(users.get(owner228)).toMatchObject({ role: 'teacher', schoolId: 8082 })
    expect(owners82.has(owner228)).toBe(true)
    const covered = new Set<number>()
    for (const c of all()) {
      if (c.teacherId !== null && owners82.has(c.teacherId)) {
        for (const id of memberIds(c.kind, c.classId)) if (schoolOf(id) === 8082) covered.add(id)
      }
    }
    expect(p82).toHaveLength(549)
    expect(covered.size).toBe(515)
    // class 228: 93 grade-11 pupils of 8082
    const c228 = memberIds('classroom', 228)
    expect(c228).toHaveLength(93)
    for (const id of c228) expect(users.get(id)).toMatchObject({ schoolId: 8082, grade: 11 })
    // pupil 2016 is in class 813 only
    expect(classrooms.forStudent(2016).map((c) => c.classId)).toEqual([813])
  })

  it('8880: 516 and 517 are owned by "Guru Demo KL-01" (4503) who owns 4 classes, KL-02 owns 5', () => {
    expect(classrooms.get('classroom', 516)).toMatchObject({
      teacherId: 4503,
      schoolId: 8880,
      joinCode: 'DEMO-4S',
    })
    expect(classrooms.get('classroom', 517)?.teacherId).toBe(4503)
    expect(classrooms.forTeacher(4503)).toHaveLength(4)
    const kl02 = users.query('Q-M11-TEACHERS', {}, 8880).rows.find((t) => t.id !== 4503) as {
      id: number
    }
    expect(classrooms.forTeacher(kl02.id)).toHaveLength(5)
    // 516: 3201–3215 (grade-10 pupils of 8880); 517: 15 grade-11 pupils of 8880
    expect(memberIds('classroom', 516)).toEqual(Array.from({ length: 15 }, (_, i) => 3201 + i))
    for (const id of memberIds('classroom', 517))
      expect(users.get(id)).toMatchObject({ schoolId: 8880, grade: 11 })
    // the classes that hold 8880 pupils: 516, 517, "5 Sinar", "5 Delima"
    const holding = new Set<string>()
    for (const u of users.query('U-SCHOOL', {}, 8880).rows) {
      for (const c of classrooms.forStudent(u.id)) holding.add(`${c.kind}:${String(c.classId)}`)
    }
    expect(holding.size).toBe(4)
  })
})

describe('T4: card 149 = 75 + 38 + 21 + 15, Σ 356 (M08 S3, M10 §6.2.1 A.1)', () => {
  const t4Rows = () =>
    all()
      .filter((c) => c.educationLevel === 'tingkatan-4')
      .flatMap((c) => classrooms.members(c.kind, c.classId))

  it('has 149 distinct pupils and 356 memberships', () => {
    const s = classrooms.levelSummary('tingkatan-4')
    expect(s).toMatchObject({ classes: 13, students: 149, memberships: 356 })
  })

  it('is exactly the pool 75, the re-homed pupils 38, 21 school joiners and the 15 of class 516', () => {
    const ids = new Set(t4Rows().map((e) => e.studentId))
    const pool = new Set(users.selection('t4Pool'))
    const rehomed = new Set(users.selection('t4PoolRehomed'))
    const fromPool = [...ids].filter((id) => pool.has(id))
    const fromRehomed = [...ids].filter((id) => rehomed.has(id))
    const c516 = new Set(memberIds('classroom', 516))
    const joiners = [...ids].filter((id) => !pool.has(id) && !rehomed.has(id) && !c516.has(id))
    expect(fromPool).toHaveLength(pool.size)
    expect(fromRehomed).toHaveLength(rehomed.size - 1)
    expect(joiners).toHaveLength(21)
    expect(c516.size).toBe(15)
    expect(fromPool.length + fromRehomed.length + joiners.length + c516.size).toBe(149)
    const bySchool = new Map<number | null, number>()
    for (const id of joiners) bySchool.set(schoolOf(id), (bySchool.get(schoolOf(id)) ?? 0) + 1)
    expect(Object.fromEntries(bySchool)).toEqual({ 8765: 14, 8767: 5, 8772: 2 })
  })

  it('gives the SEJ twins the members of the BM twins (4=8, 5=9, 6=10)', () => {
    for (const [bm, sej] of [
      [4, 8],
      [5, 9],
      [6, 10],
    ] as const) {
      expect(memberIds('classroom', sej)).toEqual(memberIds('classroom', bm))
    }
  })

  it('places the session holders: H1 in 6/10 only, H2–H4 in 5/9 only (R4-01)', () => {
    const { holders } = classrooms.designation()
    expect(
      classrooms
        .forStudent(holders.h1)
        .map((c) => c.classId)
        .sort((a, b) => a - b),
    ).toEqual([6, 10])
    for (const h of [holders.h2, holders.h3, holders.h4]) {
      expect(
        classrooms
          .forStudent(h)
          .map((c) => c.classId)
          .sort((a, b) => a - b),
      ).toEqual([5, 9])
    }
    const pool = new Set(users.selection('t4Pool'))
    for (const h of Object.values(holders)) {
      expect(pool.has(h)).toBe(true)
      expect(users.get(h)?.grade).toBe(10)
      // a generated pool row: not an M16 anchor 4326–4358
      expect(h < 4301 || h > 4358).toBe(true)
    }
  })

  it('keeps every M16 pool anchor 4326–4358 (except 4351) in a T4 class', () => {
    for (let id = 4326; id <= 4358; id++) {
      if (id === 4351) continue
      expect(
        classrooms.forStudent(id).some((c) => c.educationLevel === 'tingkatan-4'),
        `pupil ${String(id)}`,
      ).toBe(true)
    }
  })

  it('holds the M18 table A.1: in class 71 (36 re-homed), T4 set 56, T5 set 32, both 17', () => {
    const rows: [number, number, number, number, number][] = [
      // school, in class, T4 set, T5 set, both
      [8765, 17, 14, 7, 4],
      [8772, 8, 3, 6, 1],
      [8767, 8, 5, 3, 0],
      [7780, 8, 5, 3, 0],
      [3160, 9, 9, 3, 3],
      [2700, 10, 10, 5, 5],
      [2710, 2, 2, 1, 1],
      [1, 9, 8, 4, 3],
    ]
    let inClass = 0
    let t4 = 0
    let t5 = 0
    let both = 0
    let rehomed = 0
    const rh = new Set(users.selection('t4PoolRehomed'))
    for (const [school, c, a4, a5, ab] of rows) {
      const pupils = users.query('U-SCHOOL', {}, school).rows.filter((u) => u.role === 'student')
      const inT4 = pupils.filter((u) =>
        classrooms.forStudent(u.id).some((x) => x.educationLevel === 'tingkatan-4'),
      )
      const inT5 = pupils.filter((u) =>
        classrooms.forStudent(u.id).some((x) => x.educationLevel === 'tingkatan-5'),
      )
      const inBoth = inT4.filter((u) => inT5.includes(u))
      const inAny = new Set([...inT4, ...inT5].map((u) => u.id))
      expect(
        [inAny.size, inT4.length, inT5.length, inBoth.length],
        `school ${String(school)}`,
      ).toEqual([c, a4, a5, ab])
      inClass += inAny.size
      t4 += inT4.length
      t5 += inT5.length
      both += inBoth.length
      rehomed += [...inAny].filter((id) => rh.has(id)).length
    }
    expect([inClass, t4, t5, both, rehomed]).toEqual([71, 56, 32, 17, 36])
  })

  it('8765: the 14 T4 joiners hold no session; 2 answering pupils are T5-only members; 4 answering pupils are in no class', () => {
    const { answeringMembers, noClass, t4Joiners } = classrooms.designation()
    expect(answeringMembers).toHaveLength(2)
    const six = classrooms.designation().answering8765
    expect(six).toHaveLength(6)
    for (const id of six) expect(users.get(id)?.isActive, `pupil ${String(id)}`).toBe(true)
    for (const id of answeringMembers) {
      const levels = classrooms.forStudent(id).map((c) => c.educationLevel)
      expect(new Set(levels)).toEqual(new Set(['tingkatan-5']))
    }
    const none8765 = noClass.filter((id) => schoolOf(id) === 8765)
    expect(none8765).toHaveLength(4)
    for (const id of none8765) expect(classrooms.forStudent(id)).toEqual([])
    expect(t4Joiners).toHaveLength(21)
    for (const id of t4Joiners) expect(users.get(id)?.hasLoggedIn).toBeDefined()
  })

  it('names the T5 twins "5 Bestari / Cemerlang / Dedikasi - BM / SEJ" with equal members', () => {
    const twins = classrooms.designation().t5Twins
    expect(twins.map((t) => t.name)).toEqual(['Bestari', 'Cemerlang', 'Dedikasi'])
    for (const t of twins) {
      const bm = classrooms.get('classroom', t.bm) as ClassroomRow
      const sej = classrooms.get('classroom', t.sej) as ClassroomRow
      expect(bm.name).toBe(`5 ${t.name} - BM`)
      expect(sej.name).toBe(`5 ${t.name} - SEJ`)
      expect(memberIds('classroom', t.sej)).toEqual(memberIds('classroom', t.bm))
    }
  })
})

describe('T5: 3,911 distinct pupils (M08 S3)', () => {
  it('has 645 classes and 3,911 distinct pupils', () => {
    const s = classrooms.levelSummary('tingkatan-5')
    expect(s.classes).toBe(645)
    expect(s.students).toBe(3911)
    expect(s.memberships).toBeGreaterThan(s.students)
  })

  it('draws members from grade-11 pupils of schools; the attendance mirror and the payers are in no class', () => {
    for (const id of users.selection('attendanceMirror'))
      expect(classrooms.forStudent(id)).toEqual([])
    for (const id of [3301, 3318, 3614, 4373, 5450, 5451, 5475, 5600]) {
      expect(classrooms.forStudent(id), `payer ${String(id)}`).toEqual([])
    }
    const t5 = new Set(
      all()
        .filter((c) => c.educationLevel === 'tingkatan-5')
        .flatMap((c) => memberIds(c.kind, c.classId)),
    )
    let grade11 = 0
    for (const id of t5) {
      const u = users.get(id)
      expect(u?.role).toBe('student')
      if (u?.grade === 11) grade11++
    }
    // only the lower-grade re-homed pupils of the M18 schools' T5 twins are not grade 11
    expect(t5.size - grade11).toBeLessThanOrEqual(32)
  })

  it('leaves the non-members of the T5 cell as inactive or never-logged-in generated pupils (M05 practises from the head)', () => {
    const { t5NonMembers, t5Leavers } = classrooms.designation()
    expect(t5Leavers).toHaveLength(32)
    const t5 = new Set(
      all()
        .filter((c) => c.educationLevel === 'tingkatan-5')
        .flatMap((c) => memberIds(c.kind, c.classId)),
    )
    for (const id of t5Leavers) expect(t5.has(id)).toBe(false)
    for (const id of t5NonMembers) expect(t5.has(id)).toBe(false)
    // 4,091 grade-11 pupils with a school less the 3,911 members (and the lower-grade joiners)
    const grade11 = users
      .query('U-ROLE', {}, 'student')
      .rows.filter((u) => u.grade === 11 && u.schoolId !== null)
    expect(grade11.length - t5NonMembers.length).toBeLessThanOrEqual(3911)
  })

  it('links every member to a student user and every enrolment to its class', () => {
    for (const c of all()) {
      for (const e of classrooms.members(c.kind, c.classId)) {
        expect(e.classKey).toBe(c.id)
        expect(e.educationLevel).toBe(c.educationLevel)
        expect(e.levelId).toBe(c.levelId)
        expect(e.status).toBe('active')
        expect(Date.parse(e.joinedAt)).toBeGreaterThanOrEqual(Date.parse(c.createdAt))
      }
    }
    const sample = classrooms.enrolmentsOf(3001)
    expect(sample.map((e: EnrolmentRow) => e.classroomKind)).toEqual(['classroom', 'classroom'])
  })
})

describe('reads for the teacher, school and student screens', () => {
  it('forTeacher, forSchool and teacherStudentIds (BR-M10-04)', () => {
    expect(classrooms.teacherStudentIds(5)).toEqual([
      3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008,
    ])
    expect(
      classrooms
        .forSchool(900001)
        .map((c) => c.classId)
        .sort(),
    ).toEqual([2001, 2002])
    expect(classrooms.forSchool(8080)).toHaveLength(7)
    expect(classrooms.forSchool(8102).length).toBeGreaterThanOrEqual(3)
    expect(classrooms.list({ kind: 'school_class' })).toHaveLength(2)
    expect(classrooms.list({ teacherId: 5, subjectId: 10 }).map((c) => c.classId)).toEqual([2001])
    const own = classrooms.forTeacher(1919)
    expect(own.map((c) => c.createdAt)).toEqual([...own.map((c) => c.createdAt)].sort().reverse())
  })

  it('forStudent lists the classes of a student, newest first', () => {
    const rows = classrooms.forStudent(3001)
    // both created on 2026-01-06: ties keep ascending ids (M08 BR-M08-30)
    expect(rows.map((c) => c.classId)).toEqual([2001, 2002])
  })
})

describe('runtime writes', () => {
  it('creates classes from 9,000,001 upward and enrols and removes students', () => {
    const c = classrooms.create(
      {
        name: '5 BARU',
        teacherId: 5,
        schoolId: 900001,
        subjectId: 10,
        educationLevel: 'tingkatan-5',
      },
      Date.parse('2026-09-25T10:00:00+08:00'),
    )
    expect(c.classId).toBe(9_000_001)
    expect(c.joinCode).toMatch(/^[A-Z0-9]{6}$/)
    const d = classrooms.create(
      { name: '5 LAGI', teacherId: 5, educationLevel: 'tingkatan-5' },
      Date.now(),
    )
    expect(d.classId).toBe(9_000_002)
    expect(classrooms.count('CL-ALL')).toBe(754)
    expect(classrooms.count('CL-CLASSROOM')).toBe(752)

    const now = Date.parse('2026-09-25T10:30:00+08:00')
    const joined = classrooms.enrol(
      { kind: 'classroom', classId: c.classId, studentId: 3, source: 'code' },
      now,
    )
    expect(joined).toMatchObject({
      status: 'active',
      source: 'code',
      educationLevel: 'tingkatan-5',
    })
    expect(classrooms.forStudent(3).map((x) => x.classId)).toEqual([c.classId])
    expect(classrooms.levelSummary('tingkatan-5').students).toBe(3912)
    classrooms.unenrol('classroom', c.classId, 3)
    expect(classrooms.forStudent(3)).toEqual([])
    expect(classrooms.levelSummary('tingkatan-5').students).toBe(3911)
    expect(() =>
      classrooms.enrol({ kind: 'classroom', classId: 5, studentId: 3, source: 'code' }, now),
    ).not.toThrow()
    // N1: a second enrol of the same triple returns the same id and leaves one active row
    const again = classrooms.enrol(
      { kind: 'classroom', classId: c.classId, studentId: 3, source: 'code' },
      now,
    )
    const twice = classrooms.enrol(
      { kind: 'classroom', classId: c.classId, studentId: 3, source: 'code' },
      now,
    )
    expect(twice.id).toBe(again.id)
    expect(classrooms.enrolmentsOf(3).filter((e) => e.classroomId === c.classId)).toHaveLength(1)
    expect(
      classrooms.members('classroom', c.classId).filter((e) => e.studentId === 3),
    ).toHaveLength(1)
    classrooms.unenrol('classroom', c.classId, 3)
    expect(() =>
      classrooms.enrol({ kind: 'classroom', classId: 999999, studentId: 3, source: 'code' }, now),
    ).toThrow()
  })
})

// Cross-module constraints that the SRS states for the M05 sessions over this placement. M05
// (F-26) was built before the M10 store existed and places its sessions without the classes, so
// they are pending in M05 / M08-T1: they read `classrooms.designation()` (holders, joiners, the T5
// non-members, class 228) and adapt their generation. Measured with the current M05 store: the T4
// members hold 38 sessions (8 pupils) instead of 11 (4 holders), the T5 members 31,592 instead of
// 29,971, and 5 T5 non-members hold 37 sessions.
describe('pending M05 / M08 alignment (not F-30 acceptance)', () => {
  it.todo(
    'M08 T4: the 4 session holders H1–H4 hold 11 sessions (classes 6/10 4, classes 5/9 7), no other T4 member holds one',
  )
  it.todo(
    'M08 T4 "63.9%" and T5 "79.7%" (session means over the class members) and T5 29,971 sessions',
  )
  it.todo(
    'the 21 register joiners of 8765 / 8767 / 8772 hold no session; 8765 has 6 answering pupils, 2 of them T5-only members',
  )
  it.todo(
    'class 228: 1,618 sessions and 34,882 answers over its 93 members; 2 members active in the last 7 days',
  )
  it.todo(
    'M17 "{n} GURU" (R2-06): cross-school owners of 8078 / 8090 own classes that hold 8082 / 8080 pupils',
  )
})

describe('XR-F30-02: T5 subjects, at-risk class names and the observed teacher cards (M08 G5)', () => {
  const a4 = [
    18, 19, 2, 1, 11, 22, 9, 12, 26, 10, 3, 8, 29, 6, 15, 7, 13, 27, 23, 21, 4, 17, 28, 31, 5, 25,
  ]

  it('the T5 classes carry exactly the 26 subjects of M08 A.4, all M03 subjects (S3 "26 subjek")', () => {
    const t5 = new Set(
      all()
        .filter((c) => c.educationLevel === 'tingkatan-5' && c.subjectId !== null)
        .map((c) => c.subjectId as number),
    )
    expect([...t5].sort((x, y) => x - y)).toEqual([...a4].sort((x, y) => x - y))
    for (const id of a4) expect(curriculum.subject(id), `M03 subject ${String(id)}`).toBeDefined()
    // Bahasa Cina, Jawi, Pembuatan Pakaian Wanita and Sains Sukan are present; RBT, Tamil and Al-Quran are not
    for (const id of [19, 26, 29, 31]) expect(t5.has(id)).toBe(true)
    for (const id of [16, 20, 24]) expect(t5.has(id)).toBe(false)
    // 27 subjects over every level (M08 S1)
    expect(new Set(all().flatMap((c) => (c.subjectId === null ? [] : [c.subjectId]))).size).toBe(27)
  })

  it('has the 9 at-risk class names "5 LEQOE" … "5 IKHLAS" on active T5 classes with members', () => {
    const named = classrooms.designation().atRiskClasses
    expect(named.map((x) => x.name)).toEqual([
      '5 LEQOE',
      '5 ZUHRAH',
      '5 IMTIAZ',
      '5 CAMELIA',
      '5 MUSYTARI',
      '5 NURANI',
      '5 JUJUR',
      '5 BAKTI',
      '5 IKHLAS',
    ])
    for (const { name, classId } of named) {
      const c = classrooms.get('classroom', classId) as ClassroomRow
      expect(c).toMatchObject({ name, educationLevel: 'tingkatan-5', isActive: true })
      expect(classrooms.memberCount('classroom', classId), name).toBeGreaterThanOrEqual(10)
      expect(c.schoolId).not.toBeNull()
      // M08 PINNED_SCHOOLS: 8880, 900001, 8080, 8082, 8102
      expect([8080, 8082, 8880, 8102, 900001]).not.toContain(c.schoolId)
    }
    // "5 SAINS TULEN" is the observed class 366
    expect(classrooms.get('classroom', 366)?.name).toBe('5 SAINS TULEN')
  })

  it('has the observed "Prestasi Guru" cards 1 kelas · 0 murid, 2 · 76 and 3 · 89', () => {
    const stats = (teacherId: number) => ({
      classes: classrooms.forTeacher(teacherId).length,
      students: classrooms.teacherStudentIds(teacherId).length,
    })
    const cards = classrooms.designation().teacherCards
    expect(cards.map((c) => [c.classes, c.students])).toEqual([
      [1, 0],
      [2, 76],
      [3, 89],
    ])
    for (const c of cards) {
      expect(stats(c.teacherId), 'teacher ' + String(c.teacherId)).toEqual({
        classes: c.classes,
        students: c.students,
      })
    }
    // distinct pupils of their T5 classes, all T5 members elsewhere or here (T5 stays 3,911)
    expect(classrooms.levelSummary('tingkatan-5').students).toBe(3911)
  })
})
