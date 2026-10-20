import { PerformanceRankingSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { levelCodeOf, parseScope, rankingAccuracy, shortName } from '../../../../src/modules/reports/performance/domain'
import { ctxOf } from '../fakes/fixtures'
import { addPupil, socialWorld, type SocialWorld } from '../fakes/social-world'

let w: SocialWorld
const teacher = ctxOf('teacher', 't1')

beforeEach(() => {
  w = socialWorld()
  addPupil(w, '1', 'Aina Binti Hassan', 's1')
  addPupil(w, '2', 'Bakar Bin Ismail', 's1')
  addPupil(w, '3', 'Chong Wei Ming', 's1')
  addPupil(w, '4', 'Devi Nair', 's2')
  addPupil(w, '5', 'Emir Danial', 's2')
  addPupil(w, '6', 'Farah Lee', 's2')
  w.directory.addPupil({ id: 't1', name: 'Cikgu Ujian', schoolId: 's1', isStudent: false })
  // correct / answered: 1 = 9/10, 2 = 9/12, 3 = 8/8, 4 = 5/5, 5 = 5/6, 6 = 2/2 (below the 3-answer floor)
  w.practice.addAnswers('1', 10, 9).addAnswers('2', 12, 9).addAnswers('3', 8, 8).addAnswers('4', 5, 5).addAnswers('5', 6, 5).addAnswers('6', 2, 2)
  w.gamification.add('1', { level: 4 }).add('3', { level: 2 })
})

describe('Rankings: rules', () => {
  it('orders by correct DESC, then accuracy DESC, then id; pupils below 3 answers are not ranked', async () => {
    const r = await w.ranking.rankings(teacher, {})
    expect(r.rows.map((x) => [x.rank, x.userId, x.correct])).toEqual([
      [1, '1', 9],
      [2, '2', 9],
      [3, '3', 8],
      [4, '4', 5],
      [5, '5', 5],
    ])
    expect(r.total).toBe(5)
    PerformanceRankingSchema.parse(r)
  })

  it('accuracy has 2 decimals and tahap is the wallet level (1 when there is no wallet)', async () => {
    const r = await w.ranking.rankings(teacher, {})
    expect(r.rows[1]).toMatchObject({ accuracy: 75, tahap: 1 })
    expect(r.rows[4]).toMatchObject({ accuracy: 83.33 })
    expect(r.rows[0]?.tahap).toBe(4)
    expect(rankingAccuracy(1, 3)).toBe(33.33)
    expect(rankingAccuracy(0, 0)).toBe(0)
  })

  it('scope: default nasional with footer and title; negeri needs a state; unknown scope is null and unfiltered', async () => {
    const nas = await w.ranking.rankings(teacher, {})
    expect(nas).toMatchObject({ scope: 'nasional', title: 'Kedudukan Nasional', showFooter: true })
    const none = await w.ranking.rankings(teacher, { scope: 'negeri' })
    expect(none).toMatchObject({ scope: 'negeri', title: 'Kedudukan Negeri', showFooter: false, rows: [], total: 0 })
    const neg = await w.ranking.rankings(teacher, { scope: 'negeri', negeri: 'Negeri A' })
    expect(neg.title).toBe('Kedudukan Negeri A')
    expect(neg.total).toBe(5)
    const odd = await w.ranking.rankings(teacher, { scope: 'dunia' })
    expect(odd).toMatchObject({ scope: null, title: 'Kedudukan Nasional', total: 5 })
  })

  it('sekolah and daerah use the viewer school and show the school name', async () => {
    w.directory.addPupil({ id: 'v', name: 'Viewer Ujian', schoolId: 's2' })
    const sek = await w.ranking.rankings(ctxOf('student', 'v'), { scope: 'sekolah' })
    expect(sek.rows).toEqual([])
    const asTeacher = await w.ranking.rankings({ ...teacher, userId: 'v' }, { scope: 'sekolah' })
    expect(asTeacher.rows.map((x) => x.userId)).toEqual(['4', '5'])
    expect(asTeacher.rows[0]?.schoolName).toBe('Sekolah Dua')
    const dae = await w.ranking.rankings({ ...teacher, userId: 'v' }, { scope: 'daerah' })
    expect(dae.rows.map((x) => x.userId)).toEqual(['4', '5'])
    const nobody = await w.ranking.rankings({ ...teacher, userId: 'unknown' }, { scope: 'sekolah' })
    expect(nobody.rows).toEqual([])
  })

  it('subject and tingkatan filters narrow the rows; rows are capped at 100 while total is not', async () => {
    w.practice.addAnswers('4', 4, 4, { subjectId: '2', levelCode: 't5' })
    expect((await w.ranking.rankings(teacher, { subjectId: '2' })).rows.map((x) => x.userId)).toEqual(['4'])
    expect((await w.ranking.rankings(teacher, { tingkatan: 'T5' })).total).toBe(1)
    expect((await w.ranking.rankings(teacher, { tingkatan: 'T9' })).total).toBe(5)
    for (let i = 0; i < 110; i++) {
      addPupil(w, `9${i}`, `Murid Ramai ${i}`, 's1')
      w.practice.addAnswers(`9${i}`, 3, 3)
    }
    const big = await w.ranking.rankings(teacher, {})
    expect(big.rows).toHaveLength(100)
    expect(big.total).toBe(115)
    expect(big.rows[99]?.rank).toBe(100)
  })

  it('pure helpers', () => {
    expect(parseScope(undefined)).toBe('nasional')
    expect(parseScope('daerah')).toBe('daerah')
    expect(parseScope('x')).toBeNull()
    expect(levelCodeOf('T4')).toBe('t4')
    expect(levelCodeOf('t4')).toBeUndefined()
    expect(shortName('Aina Binti Hassan')).toBe('Aina H.')
    expect(shortName('Devi')).toBe('Devi')
    expect(shortName('  ')).toBe('')
  })
})
