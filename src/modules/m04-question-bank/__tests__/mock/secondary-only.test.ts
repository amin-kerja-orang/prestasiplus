/**
 * v2-secondary-only (D72, 2026-10-29): the admin question reads skip the questions of a hidden Darjah
 * level, before pagination, like the HTTP backend (`NOT_PRIMARY_LEVEL_SQL`): no row has a blank level and
 * no total includes Darjah. The rows stay stored; the switch restores them (reversible).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { QuestionRow, QuestionSummary } from '../../api/questions'
import { questions } from '../../mock'
import { showPrimaryLevels } from '../../mock/repository/visible-levels'
import { ADMIN, bootM04, callAs, type ErrorBody, type ListBody } from './helpers-questions'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>

beforeAll(async () => {
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

afterAll(async () => {
  showPrimaryLevels(false)
  await runtime.reset()
})

describe('Darjah questions are hidden from the admin reads (default)', () => {
  it('the list has no blank level and its total excludes the Darjah questions', async () => {
    const r = await call<ListBody<QuestionRow>>('GET', '/api/questions?page=1', ADMIN)
    expect(r.status).toBe(200)
    expect(r.body.data.every((q) => q.level !== null && q.level.name !== '')).toBe(true)
    expect(r.body.meta.totalItems).toBeLessThan(questions.count('Q-ALL'))
    // A hidden level filter matches nothing.
    const darjah = await call<ListBody<QuestionRow>>(
      'GET',
      '/api/questions?educationLevelId=1',
      ADMIN,
    )
    expect(darjah.body.data).toEqual([])
  })

  it('the summary total and tiles exclude the Darjah questions', async () => {
    const r = await call<{ data: QuestionSummary }>('GET', '/api/questions/summary', ADMIN)
    expect(r.body.data.total).toBe(questions.visibleCount('Q-ALL'))
    expect(r.body.data.total).toBeLessThan(questions.count('Q-ALL'))
    expect(r.body.data.subjects.reduce((n, s) => n + s.total, 0)).toBe(r.body.data.total)
  })

  it('the quality total excludes them too, and its level split adds up to the scored count', async () => {
    const r = await call<{
      data: { total: number; scoredCount: number; byLevel: { count: number }[] }
    }>('GET', '/api/question-quality', ADMIN)
    expect(r.body.data.total).toBe(questions.visibleCount('Q-ALL'))
    expect(r.body.data.total).toBeLessThan(questions.count('Q-ALL'))
    expect(r.body.data.scoredCount).toBeGreaterThan(0)
    expect(r.body.data.byLevel.reduce((n, l) => n + l.count, 0)).toBe(r.body.data.scoredCount)
  })
})

describe('a Darjah level is not accepted on write (D72)', () => {
  it('rejects a Darjah level id with 422 on educationLevelId, and accepts Tingkatan 4', async () => {
    const darjah = await call<ErrorBody>('POST', '/api/questions', ADMIN, { educationLevelId: 1 })
    expect(darjah.status).toBe(422)
    expect(darjah.body.error.fields?.educationLevelId).toBe('Sila pilih tahap pendidikan.')
    const t4 = await call<ErrorBody>('POST', '/api/questions', ADMIN, { educationLevelId: 10 })
    expect(t4.body.error.fields?.educationLevelId).toBeUndefined()
  })
})

describe('the M03 admin counts exclude the Darjah questions', () => {
  it('visibleActiveGroupCount by level has no Darjah entry and sums below the named Q-ACTIVE total', () => {
    const byLevel = questions.visibleActiveGroupCount('educationLevelId')
    for (const darjah of [1, 2, 3, 4, 5, 6]) expect(byLevel.get(darjah) ?? 0).toBe(0)
    expect(byLevel.get(10) ?? 0).toBeGreaterThan(0)
    const visible = [...questions.visibleActiveGroupCount('subjectId').values()].reduce(
      (a, b) => a + b,
      0,
    )
    expect(visible).toBeLessThan(questions.count('Q-ACTIVE'))
  })
})

describe('the other user-facing reads skip Darjah (D72)', () => {
  it('the diagram audit, the teacher databank and the SP availability count no Darjah question', () => {
    const flagged = questions.flagged().total
    const hiddenSp = questions.spAvailable(1, { levelId: 1 }) // a hidden Darjah level matches nothing
    const databank = questions.teacherDatabank(3).counts.total
    expect(hiddenSp).toBe(0)
    showPrimaryLevels()
    try {
      expect(questions.flagged().total).toBeGreaterThan(flagged)
      expect(questions.teacherDatabank(3).counts.total).toBeGreaterThanOrEqual(databank)
    } finally {
      showPrimaryLevels(false)
    }
  })
})

describe('the hiding is reversible', () => {
  it('shows the stored Darjah questions again when the switch is off', () => {
    const hidden = questions.visibleCount('Q-ALL')
    showPrimaryLevels()
    try {
      expect(questions.visibleCount('Q-ALL')).toBe(questions.count('Q-ALL'))
    } finally {
      showPrimaryLevels(false)
    }
    expect(questions.visibleCount('Q-ALL')).toBe(hidden)
  })
})
