/** The M10 contributed anchors registered by the M04 seed (M10 R-M04-03; E2E-M10-57…66, E2E-M04-67). */

import { beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { defineMockCore } from '@/mock/define'
import { bootMock } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'

import m04, { questions } from '../../mock'

beforeAll(async () => {
  await bootMock({
    mode: 'test',
    core: defineMockCore({}),
    plugins: [m01, m02, m03, m04],
    clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
    latencyMs: 0,
    onWarn: null,
  })
}, 180_000)

describe('M10 anchors in the default seed', () => {
  it('522425 is the observed Bahasa Melayu Darjah 6 question, difficulty 4, correct option C', () => {
    expect(questions.get(522425)).toMatchObject({
      subjectId: 1,
      educationLevelId: 6,
      difficultyLevel: 4,
      status: 'approved',
      isActive: true,
      dskpTagged: true,
      createdBy: 1,
      sourceSet: 'textbook_content_rebuild',
      createdAt: expect.stringMatching(/^2026-05-02/),
      correctAnswer: 2,
      questionText: 'Dalam tugasan pengukuhan, pilih ayat dialog yang betul dari segi tanda baca?',
    })
  })

  it('S21 page 1 is 522425–522444 and page 2 starts at 522445 of 16,817', () => {
    const p1 = questions.contributions(1, { page: 1 })
    const p2 = questions.contributions(1, { page: 2 })
    expect(p1.rows.map((r) => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => 522425 + i))
    expect(p2.rows.slice(0, 3).map((r) => r.id)).toEqual([522445, 522446, 522447])
    expect(p1.total).toBe(16_817)
    expect(questions.count('Q-CONTRIB', 1)).toBe(16_817)
  })

  it('700302 is the teacher (user 5) approved pending-free question', () => {
    expect(questions.get(700302)).toMatchObject({
      subjectId: 1,
      educationLevelId: 11,
      difficultyLevel: 2,
      status: 'approved',
      isActive: true,
      spmPool: false,
      createdBy: 5,
      questionText: 'Pilih ayat yang menggunakan kata sendi nama dengan betul.',
    })
    expect(questions.count('Q-CONTRIB', 5)).toBe(1)
  })
})
