/**
 * M10-D1: the designed "{n} GURU" enrolments (SRS M10 §6.2.1 A; M17 BR-M17-11 Q-M17-SCH-TEACHERS).
 *
 * The plan pupils of `data/guru.ts` are designated ids: M10 cannot read M05 while it builds, so this test
 * asserts them against M05's own answering windows at the project clock (a drift fails here), then checks the
 * "{n} GURU" owner counts and the invariants the design must keep (T5 3,911, pinned classes, teacher cards).
 *
 * Known exception (reported to M17 / M02): school 8284 reads 1, the SRS D9 value is 0. Its only pupil (5994) is
 * a generated T5 member, and taking it out of T5 moves the M05 ladders that read the T5 set.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { users } from '@/modules/m01-authentication/mock'
import { practiceAnswers } from '@/modules/m05-practice/mock'

import { GURU_PLANS, type GuruPlan } from '../../mock/data/guru'
import { OBSERVED_SIZES, T5_DISTINCT } from '../../mock/data/spec'
import { classrooms } from '../../mock'
import { bootM10 } from './helpers'

beforeAll(async () => {
  await bootM10({ withPractice: true })
}, 180_000)

type Win = 'today' | 'week' | 'month'
const answering = (win: Win): Set<number> =>
  new Set(
    [...practiceAnswers.groupCount('Q-ANS-P', 'userId', win).keys()].filter(
      (k): k is number => typeof k === 'number',
    ),
  )

function ownersOf(pupils: readonly number[]): Set<number> {
  const out = new Set<number>()
  for (const id of pupils) {
    for (const e of classrooms.enrolmentsOf(id)) {
      if (e.status !== 'active' || e.classroomKind !== 'classroom') continue
      const owner = classrooms.get('classroom', e.classroomId)?.teacherId
      if (owner != null) out.add(owner)
    }
  }
  return out
}

const sorted = (xs: Iterable<number>) => [...xs].sort((a, b) => a - b)
const ofSchool = (set: ReadonlySet<number>, school: number) =>
  sorted([...set].filter((id) => users.get(id)?.schoolId === school))

describe('the plan pupils are the M05 answering pupils of the windows', () => {
  for (const plan of GURU_PLANS) {
    it(`school ${String(plan.school)}: today / week-only / month-only pupils`, () => {
      const today = answering('today')
      const week = answering('week')
      const month = answering('month')
      const minus = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
        new Set([...a].filter((x) => !b.has(x)))
      expect(ofSchool(today, plan.school)).toEqual(sorted(plan.today))
      expect(ofSchool(minus(week, today), plan.school)).toEqual(sorted(plan.week))
      expect(ofSchool(minus(month, week), plan.school)).toEqual(sorted(plan.month))
    })
  }
})

describe('"{n} GURU": distinct owners of the classes of the answering pupils (observed counts)', () => {
  const pupils = (plan: GuruPlan, win: Win) =>
    win === 'today'
      ? plan.today
      : win === 'week'
        ? [...plan.today, ...plan.week]
        : [...plan.today, ...plan.week, ...plan.month]
  for (const plan of GURU_PLANS) {
    for (const win of ['today', 'week', 'month'] as const) {
      it(`school ${String(plan.school)} ${win} = ${String(plan.targets[win])}`, () => {
        expect(ownersOf(pupils(plan, win)).size).toBe(plan.targets[win])
      })
    }
  }

  it('8106 / 8080 / 8082 today pupils: 2018 and 2019 one class each, 2022 in 370 and 2016 in 813 only', () => {
    const classesOf = (id: number) =>
      classrooms
        .enrolmentsOf(id)
        .filter((e) => e.status === 'active')
        .map((e) => e.classroomId)
    expect(classesOf(2016)).toEqual([813])
    expect(classesOf(2022)).toEqual([370])
    expect(classesOf(2018)).toHaveLength(1)
    expect(classesOf(2019)).toHaveLength(1)
  })

  it('every plan pupil keeps an active classroom (T5 membership is unchanged)', () => {
    for (const plan of GURU_PLANS) {
      for (const id of [...plan.today, ...plan.week, ...plan.month]) {
        const own = classrooms
          .enrolmentsOf(id)
          .filter((e) => e.status === 'active' && e.classroomKind === 'classroom')
        expect(own.length, String(id)).toBeGreaterThan(0)
      }
    }
  })
})

describe('invariants the design keeps', () => {
  it('T5 distinct 3,911 and the 750 classrooms + 2 school classes', () => {
    expect(classrooms.levelSummary('tingkatan-5').students).toBe(T5_DISTINCT)
    expect(classrooms.list({ kind: 'classroom' })).toHaveLength(750)
    expect(classrooms.list()).toHaveLength(752)
  })

  it('every pinned class size is unchanged', () => {
    for (const [key, n] of Object.entries(OBSERVED_SIZES)) {
      const [kind, id] = key.split(':') as ['classroom' | 'school_class', string]
      expect(classrooms.memberCount(kind, Number(id)), key).toBe(n)
    }
  })

  it('the teacher cards keep their classes and distinct pupils (1 / 0, 2 / 76, 3 / 89)', () => {
    for (const card of classrooms.designation().teacherCards) {
      const own = classrooms.forTeacher(card.teacherId)
      expect(own.length, String(card.teacherId)).toBe(card.classes)
      expect(classrooms.teacherStudentIds(card.teacherId).length, String(card.teacherId)).toBe(
        card.students,
      )
    }
  })

  it('no pupil sits in more than 12 classes (the 8082 week pupils need about 10)', () => {
    for (const plan of GURU_PLANS) {
      for (const id of [...plan.today, ...plan.week, ...plan.month]) {
        const n = classrooms.enrolmentsOf(id).filter((e) => e.status === 'active').length
        expect(n, String(id)).toBeLessThanOrEqual(12)
      }
    }
  })
})
