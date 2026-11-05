import { describe, expect, it } from 'vitest'

import { INTAKE_BATCH_MESSAGES, IntakeBatchCreateSchema } from '../files'

/** S1-T03: the batch header fields of the create body (DM-09, DM-85, D2, D10a). */
const base = { paperType: 'trial', subject: 'MAT', kertas: 2, year: 2024, source: 'x', copyright: 'sendiri', declaration: true } as const

describe('IntakeBatchCreate header', () => {
  it('keeps working without the new fields', () => {
    expect(IntakeBatchCreateSchema.safeParse(base).success).toBe(true)
  })

  it('takes a level id, a paper code NNNN/N, an exam board and a Set up to 20', () => {
    expect(IntakeBatchCreateSchema.safeParse({ ...base, educationLevelId: '5', paperCode: '1449/2', examBoard: 'SPM (LP)', setLabel: 'Set 1' }).success).toBe(true)
    expect(IntakeBatchCreateSchema.safeParse({ ...base, paperCode: '', examBoard: '', setLabel: '' }).success).toBe(true) // blank = null (D10a)
  })

  it('refuses a malformed paper code with the U-09 copy and a Set over 20 with the U-08 copy', () => {
    for (const paperCode of ['1449', '144/2', '1449/22', 'K2']) {
      const r = IntakeBatchCreateSchema.safeParse({ ...base, paperCode })
      expect(r.success).toBe(false)
      expect(r.error?.issues[0]?.message).toBe(INTAKE_BATCH_MESSAGES.paperCodeInvalid)
    }
    const r = IntakeBatchCreateSchema.safeParse({ ...base, setLabel: 'x'.repeat(21) })
    expect(r.error?.issues[0]?.message).toBe('Set tidak boleh melebihi 20 aksara.')
    expect(IntakeBatchCreateSchema.safeParse({ ...base, examBoard: 'x'.repeat(101) }).success).toBe(false)
  })

  it('has the ruled copy for a paper code that does not match the Kertas', () => {
    expect(INTAKE_BATCH_MESSAGES.paperCodeKertas(3)).toBe('Kod kertas tidak sepadan dengan Kertas 3.')
  })
})
