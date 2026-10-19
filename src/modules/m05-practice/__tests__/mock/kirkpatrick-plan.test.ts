/**
 * F-26c: the KirkpatrickSessionAggregate plan (SRS M05 v1.17 §6.14.4; M12 v1.5 §6.5, §6.9). Pure: no
 * boot. Every figure is the 25-Sep value the SRS pins; the D9 deviations are asserted as built.
 */

import { describe, expect, it } from 'vitest'

import {
  KA_PREDICTIONS,
  KA_SCHOOLS,
  KA_SUBJECTS_8080,
  KA_SUBJECTS_PLATFORM,
} from '../../mock/datasets/kirkpatrick-observed'
import { KA_CELLS } from '../../mock/datasets/kirkpatrick-cells'
import { kaHeat } from '../../mock/datasets/kirkpatrick-heat'
import { accuracyWindow, kirkpatrickPlan, monthOfMs } from '../../mock/datasets/kirkpatrick-plan'

const plan = kirkpatrickPlan()
const school = (i: number) =>
  (plan.students[plan.student[i] as number] as { school: number }).school
const tenths = (c: number, n: number) => (n === 0 ? 0 : Math.floor((1000 * c) / n + 0.5))

interface Agg {
  sessions: number
  answered: number
  correct: number
  served: number
}
const by = <K>(key: (i: number) => K) => {
  const m = new Map<K, Agg>()
  for (let i = 0; i < plan.count; i++) {
    const a = m.get(key(i)) ?? { sessions: 0, answered: 0, correct: 0, served: 0 }
    a.sessions++
    a.answered += plan.answered[i] as number
    a.correct += plan.correct[i] as number
    a.served += plan.served[i] as number
    m.set(key(i), a)
  }
  return m
}

describe('KirkpatrickSessionAggregate plan', () => {
  it('the committed cell table (compile-time distribution) equals the plan', () => {
    const m = new Map<string, number>()
    for (let i = 0; i < plan.count; i++) {
      const k = `${String(school(i))}|${String(plan.subject[i])}|${String(monthOfMs(plan.ms[i] as number) + 1)}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    const committed = new Map(
      KA_CELLS.map(([s, j, mo, n]) => [`${String(s)}|${String(j)}|${String(mo)}`, n]),
    )
    expect(committed).toEqual(m)
  })

  it('totals: 20,991 sessions, 306,133 answered, 253,478 correct (82.8 %)', () => {
    const t = [...by(() => 0).values()][0] as Agg
    expect(plan.count).toBe(20_991)
    expect(t.answered).toBe(306_133)
    expect(t.correct).toBe(253_478)
    expect(tenths(t.correct, t.answered)).toBe(828)
  })

  it('per school: answers, served, accuracy and sessions as observed (deviations: 8107, 8228, 8880)', () => {
    const per = by((i) => school(i))
    const off: number[] = []
    for (const [id, , , answered, served, sessions, acc] of KA_SCHOOLS) {
      const a = per.get(id) ?? { sessions: 0, answered: 0, correct: 0, served: 0 }
      if (id === 8880) {
        expect(a.answered).toBe(answered - 70)
        expect(a.served).toBe(served - 70)
        expect(a.sessions).toBe(sessions - 12)
        // Delivery Lead decision: 8880's 25-Sep accuracy (90.1 %) is INFERRED (that date was never observed);
        // the 26-Sep 89.9 % is not reproduced because the drift model cannot reach both it and the
        // observed platform total 253,478 (a strict window is infeasible by 11).
        expect(tenths(a.correct, a.answered)).toBe(901)
        continue
      }
      expect(a.answered).toBe(answered)
      expect(a.served).toBe(served)
      if (a.sessions !== sessions) off.push(id)
      expect(tenths(a.correct, a.answered)).toBe(acc)
    }
    expect(off.sort()).toEqual([8107, 8228])
    expect(per.get(8107)?.sessions).toBe(5)
    expect(per.get(8228)?.sessions).toBe(4)
  })

  it('subjects: the 26 platform rows and the 24 rows of 8080 (answers and displayed accuracy)', () => {
    const all = by((i) => plan.subject[i] as number)
    const s80 = by((i) => (school(i) === 8080 ? (plan.subject[i] as number) : -1))
    for (const [id, acc, n] of KA_SUBJECTS_PLATFORM) {
      const a = all.get(id) as Agg
      expect(a.answered).toBe(id === 5 ? n - 70 : n)
      const [lo, hi] = accuracyWindow(a.answered, acc)
      expect(a.correct).toBeGreaterThanOrEqual(lo)
      expect(a.correct).toBeLessThanOrEqual(hi)
    }
    for (const [id, acc, n] of KA_SUBJECTS_8080) {
      const a = s80.get(id) as Agg
      expect(a.answered).toBe(n)
      expect(tenths(a.correct, a.answered)).toBe(acc)
    }
  })

  it('students: 946 answering with the observed answered counts, bands 513 / 259 / 169 / 5, 5 served-only, 1 question-less', () => {
    const per = by((i) => plan.student[i] as number)
    const answering = [...per].filter(([g]) => plan.students[g]?.kind === 'answering')
    expect(answering.length).toBe(946)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    for (const [, a] of answering) {
      if (a.answered >= 50) b0++
      else if (a.answered >= 20) b1++
      else if (a.answered >= 5) b2++
      else b3++
    }
    const bands = [b0, b1, b2, b3]
    expect(bands).toEqual([513, 259, 169, 5])
    expect(plan.students.filter((s) => s.kind === 'unanswered').length).toBe(5)
    expect(plan.students.filter((s) => s.kind === 'questionless').length).toBe(1)
    // S5: every observed prediction row (answered, accuracy) is a student of its school; only the two
    // 8880 students whose 26-Sep sessions were removed differ.
    const rows = new Map<string, number>()
    for (const [g, a] of answering) {
      const st = plan.students[g] as { school: number }
      const key = `${String(st.school)}:${String(a.answered)}:${String(tenths(a.correct, a.answered))}`
      rows.set(key, (rows.get(key) ?? 0) + 1)
    }
    let missing = 0
    for (const [id, list] of Object.entries(KA_PREDICTIONS)) {
      for (const [q, acc] of list) {
        const key = `${id}:${String(q)}:${String(acc)}`
        const n = rows.get(key) ?? 0
        if (n === 0) missing++
        else rows.set(key, n - 1)
      }
    }
    expect(missing).toBe(2)
  })

  it('months: January 2 / 3 / 1 / 0, September 58 / 13,968 / 12,152 / 28; 8080 April 12 / 511 / 366 / 3, September 1 / 60 / 33', () => {
    const month = (m: number, only8080: boolean) => {
      const per = new Map<number, number>()
      let n = 0
      let c = 0
      for (let i = 0; i < plan.count; i++) {
        if (monthOfMs(plan.ms[i] as number) !== m) continue
        if (only8080 && school(i) !== 8080) continue
        n += plan.answered[i] as number
        c += plan.correct[i] as number
        const g = plan.student[i] as number
        per.set(g, (per.get(g) ?? 0) + (plan.answered[i] as number))
      }
      const v = [...per.values()].filter((x) => x > 0)
      return { n, c, active: v.length, champions: v.filter((x) => x >= 50).length }
    }
    expect(month(0, false)).toEqual({ n: 3, c: 1, active: 2, champions: 0 })
    expect(month(8, false)).toEqual({ n: 13_968, c: 12_152, active: 58, champions: 28 })
    expect(month(3, true)).toEqual({ n: 511, c: 366, active: 12, champions: 3 })
    expect(month(8, true)).toEqual({ n: 60, c: 33, active: 1, champions: 1 })
    // 8080's first month with an answer is April.
    let first = 99
    for (let i = 0; i < plan.count; i++) {
      if (school(i) === 8080 && (plan.answered[i] as number) > 0) {
        first = Math.min(first, monthOfMs(plan.ms[i] as number))
      }
    }
    expect(first).toBe(3)
  })

  it('mean session score: 80.3 % platform, 73.3 % at 8080, as displayed per school', () => {
    let sum = 0
    let n = 0
    let s80 = 0
    let n80 = 0
    for (let i = 0; i < plan.count; i++) {
      if ((plan.answered[i] as number) < 1) continue
      sum += plan.score[i] as number
      n++
      if (school(i) === 8080) {
        s80 += plan.score[i] as number
        n80++
      }
    }
    expect(Math.round(sum / n)).toBe(803)
    expect(Math.round(s80 / n80)).toBe(733)
  })

  it('Students A and B of 8080: subject rows, 4 and 3 distinct days, streak 1', () => {
    for (const [special, q, c, days] of [
      ['A', 219, 160, 4],
      ['B', 70, 27, 3],
    ] as const) {
      const g = plan.students.findIndex((s) => s.special === special)
      let n = 0
      let cor = 0
      const d = new Set<string>()
      for (let i = 0; i < plan.count; i++) {
        if (plan.student[i] !== g) continue
        n += plan.answered[i] as number
        cor += plan.correct[i] as number
        d.add(new Date((plan.ms[i] as number) + 8 * 3_600_000).toISOString().slice(0, 10))
      }
      expect([n, cor, d.size]).toEqual([q, c, days])
    }
  })

  it('nothing is after the M12 clock (2026-09-25 15:40 MYT)', () => {
    const clock = Date.parse('2026-09-25T15:40:00+08:00')
    for (let i = 0; i < plan.count; i++) expect(plan.ms[i] as number).toBeLessThanOrEqual(clock)
  })

  it('heat grids: platform Σ 218,000 (25 Sep), 8080 Σ 12,008, the schools add up to the platform', () => {
    const sum = (g: number[][]) => g.flat().reduce((a, b) => a + b, 0)
    expect(sum(kaHeat(null))).toBe(218_000)
    expect(sum(kaHeat([8080]))).toBe(12_008)
    expect(sum(kaHeat([9167]))).toBe(116)
    const ids = KA_SCHOOLS.map((s) => s[0])
    expect(sum(kaHeat(ids))).toBe(218_000)
    expect((kaHeat(null)[1] as number[])[8]).toBe(6_253)
  })
})
