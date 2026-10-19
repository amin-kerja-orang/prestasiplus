/** The CSV helpers through the M04 public mock entry (for M10 #57/#58, D12). */

import { beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { bootMock } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'

import m04, { IMPORT_TEMPLATE_CSV, parseCsv, planImport } from '../../mock'

beforeAll(async () => {
  await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04],
    clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
    latencyMs: 0,
    onWarn: null,
  })
}, 180_000)

describe('public CSV helpers', () => {
  it('IMPORT_TEMPLATE_CSV parses to the header and two sample rows', () => {
    const records = parseCsv(IMPORT_TEMPLATE_CSV)
    expect(records).toHaveLength(3)
    expect(records[0]?.cells[0]).toBe('question_text')
  })

  it('planImport without options: no defaults, M03 lookups', () => {
    const plan = planImport(IMPORT_TEMPLATE_CSV)
    expect(plan.missingColumns).toEqual([])
    expect(plan.rows).toHaveLength(2)
    const text = 'question_text,option_a,option_b,correct_answer\nSoalan contoh yang sah?,a,b,A'
    // no subject/level column and no defaults: the row fails
    expect(planImport(text).failures).toEqual([{ row: 2, message: 'Subjek tidak sah.' }])
    expect(planImport(text).rows).toHaveLength(0)
  })

  it('planImport with options: defaults fill the columns, lookups decide validity', () => {
    const text = 'question_text,option_a,option_b,correct_answer\nSoalan contoh yang sah?,a,b,A'
    const ok = planImport(
      text,
      { subjectId: 3, educationLevelId: 11, difficultyLevel: 2 },
      { subjectExists: () => true, levelExists: () => true },
    )
    expect(ok.rows).toHaveLength(1)
    expect(ok.rows[0]?.input).toMatchObject({
      subjectId: 3,
      educationLevelId: 11,
      difficultyLevel: 2,
    })
    const none = planImport(
      text,
      { subjectId: 3, educationLevelId: 11, difficultyLevel: 2 },
      { subjectExists: () => false, levelExists: () => true },
    )
    expect(none.failures).toHaveLength(1)
  })
})
