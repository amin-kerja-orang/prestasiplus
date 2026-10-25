/**
 * PoC profile (D45, `VITE_DATA_PROFILE=poc`): the questions dataset keeps `POC_CHAPTER_ROWS` eligible
 * questions in every Tingkatan 4/5 chapter (`pocScale` hook, D54), so a 5-20 question chapter quiz
 * and the murid heatmap still work on the small data. The chapters are read from the M03 store, not
 * from M04's own table.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createClock } from '@/lib/time'
import { defineMockCore } from '@/mock/define'
import { bootMock } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03, { curriculum } from '@/modules/m03-curriculum/mock'

import m04, { questions } from '../../mock'
import { POC_CHAPTER_ROWS } from '../../mock/datasets/questions-spec'

const MIN_CHAPTER_QUESTIONS = 20

beforeAll(async () => {
  vi.stubEnv('VITE_DATA_PROFILE', 'poc')
  await bootMock({
    mode: 'test',
    core: defineMockCore({}),
    plugins: [m01, m02, m03, m04],
    clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
    latencyMs: 0,
    onWarn: null,
  })
}, 180_000)

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('PoC profile: chapter questions of Tingkatan 4/5 (D54)', () => {
  it('keeps the chapter pool small but at least 20 questions per M03 Tingkatan 4/5 chapter', () => {
    expect(POC_CHAPTER_ROWS).toBeGreaterThanOrEqual(MIN_CHAPTER_QUESTIONS)
    const short: string[] = []
    let chapters = 0
    for (let subjectId = 1; subjectId <= 27; subjectId++) {
      for (const levelId of [10, 11]) {
        for (const ch of curriculum.chapters(subjectId, levelId)) {
          chapters++
          const n = questions.count('Q-CHAPTER', ch.id)
          if (n < MIN_CHAPTER_QUESTIONS) short.push(`${String(ch.id)} (${String(n)})`)
        }
      }
    }
    expect(chapters).toBeGreaterThan(100)
    expect(short).toEqual([])
  })

  it.each([91, 92, 220, 1173, 1174, 1175, 1176, 1177])(
    'chapter %i (Matematik Bab 1-3, Akaun) has at least 20 questions',
    (chapterId) => {
      expect(curriculum.chapter(chapterId)).toBeDefined()
      expect(questions.count('Q-CHAPTER', chapterId)).toBeGreaterThanOrEqual(MIN_CHAPTER_QUESTIONS)
    },
  )

  it('the profile really is poc: a chapter holds far fewer rows than in the full profile', () => {
    // Full profile: Matematik T4 holds hundreds of questions per chapter (Table A cell split).
    expect(questions.count('Q-CHAPTER', 91)).toBeLessThan(100)
  })
})
