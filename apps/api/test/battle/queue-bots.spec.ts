import { describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import type { BattleStudent } from '../../src/modules/battle/battle.deps'
import { botAnswers, pickBot } from '../../src/modules/battle/engine'

const student = (id: number, grade: number | null, schoolId: string | null): BattleStudent => ({ id: String(id), name: `Murid Contoh ${String(id)}`, grade, schoolId, schoolName: schoolId === null ? null : `Sekolah ${schoolId}`, avatar: null })

const owner = { id: '1', grade: 10, schoolId: '1' }
const pool: BattleStudent[] = [
  student(1, 10, '1'),
  student(2, 10, '1'),
  student(3, 10, '2'),
  student(4, 11, '2'),
  student(5, 9, '3'),
  student(6, 10, null),
]

describe('bot pick and bot answers (AC 5, 11)', () => {
  it('the same stream picks the same opponent; the owner is never the opponent', () => {
    const first = pickBot(owner, 'quick_match', false, pool, prngStream('m16:battle:77'))
    for (let i = 0; i < 5; i++) expect(pickBot(owner, 'quick_match', false, pool, prngStream('m16:battle:77'))).toEqual(first)
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pickBot(owner, 'quick_match', false, pool, prngStream(`m16:battle:${i}`))?.id))
    expect(picks.has('1')).toBe(false)
    expect([...picks].every((id) => ['2', '3', '6'].includes(id as string))).toBe(true)
    expect(picks.size).toBeGreaterThan(1)
  })

  it('same grade first; open_to_all or an owner without a grade ignores the grade', () => {
    for (let i = 0; i < 40; i++) {
      expect(pickBot(owner, 'quick_match', false, pool, prngStream(`m16:battle:${i}`))?.grade).toBe(10)
    }
    const open = new Set(Array.from({ length: 80 }, (_, i) => pickBot(owner, 'quick_match', true, pool, prngStream(`m16:battle:${i}`))?.grade))
    expect(open.size).toBeGreaterThan(1)
    const noGrade = new Set(Array.from({ length: 80 }, (_, i) => pickBot({ ...owner, grade: null }, 'quick_match', false, pool, prngStream(`m16:battle:${i}`))?.grade))
    expect(noGrade.size).toBeGreaterThan(1)
  })

  it('school battle: another school only (a student without a school never qualifies), widened step by step', () => {
    for (let i = 0; i < 40; i++) {
      const bot = pickBot(owner, 'school_battle', false, pool, prngStream(`m16:battle:${i}`))
      expect(bot?.id).toBe('3') // the only grade-10 pupil of another school
    }
    // nobody of the grade in another school: the grade is dropped, the school rule stays
    const noGradeMatch = pool.filter((u) => u.id !== '3')
    for (let i = 0; i < 40; i++) expect(['4', '5']).toContain(pickBot(owner, 'school_battle', false, noGradeMatch, prngStream(`m16:battle:${i}`))?.id)
    // nobody in another school at all: any other pupil
    const sameSchool = [student(1, 10, '1'), student(2, 10, '1'), student(6, 10, null)]
    for (let i = 0; i < 40; i++) expect(['2', '6']).toContain(pickBot(owner, 'school_battle', false, sameSchool, prngStream(`m16:battle:${i}`))?.id)
  })

  it('nobody else at all: null', () => {
    expect(pickBot(owner, 'quick_match', false, [student(1, 10, '1')], prngStream('m16:battle:1'))).toBeNull()
    expect(pickBot(owner, 'quick_match', false, [], prngStream('m16:battle:1'))).toBeNull()
  })

  it('the ten answers come from m16:battle:<uuid>: 2-12 s, correct with probability p, points 1000 - round(500 s / 15)', () => {
    const uuid = '3f0c3a52-0000-4000-8000-000000000001'
    const answers = botAnswers(uuid, 0.5)
    expect(answers).toHaveLength(10)
    expect(botAnswers(uuid, 0.5)).toEqual(answers)
    expect(botAnswers('3f0c3a52-0000-4000-8000-000000000002', 0.5)).not.toEqual(answers)
    const rng = prngStream(`m16:battle:${uuid}`)
    for (const a of answers) {
      const seconds = Math.min(15, Math.floor(2 + 10 * rng.next()))
      const correct = rng.next() < 0.5
      expect(a).toEqual({ seconds, correct, points: correct ? 1000 - Math.round((500 * seconds) / 15) : 0 })
    }
    expect(botAnswers(uuid, 0).every((a) => !a.correct && a.points === 0)).toBe(true)
    expect(botAnswers(uuid, 1).every((a) => a.correct && a.points > 0)).toBe(true)
    expect(botAnswers(uuid, 0.5).map((a) => a.seconds)).toEqual(answers.map((a) => a.seconds))
  })
})
