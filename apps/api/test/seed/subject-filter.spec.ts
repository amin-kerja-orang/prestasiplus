import { describe, expect, it } from 'vitest'

import { withSubjectCode } from '../../src/modules/bijak/integration/performance-bijak-aggregate'

const curriculum = {
  async subject(id: bigint) {
    return id === 7n ? { code: 'MATH' } : id === 8n ? { code: 'SCI' } : id === 9n ? { code: 'BM' } : null
  },
}

describe('Bijak aggregate subject filter (class subject id to Bijak code)', () => {
  it('translates a curriculum subject id to the Bijak code stored on the sitting', async () => {
    expect((await withSubjectCode({ subjectId: '7', userIds: ['1'] }, curriculum)).subjectId).toBe('MAT')
    expect((await withSubjectCode({ subjectId: '8' }, curriculum)).subjectId).toBe('SN')
    expect((await withSubjectCode({ subjectId: '9' }, curriculum)).subjectId).toBe('BM')
  })

  it('keeps the other fields, leaves a code or no subject as it is, and matches nothing for an unknown id', async () => {
    expect(await withSubjectCode({ subjectId: 'MAT', userIds: ['1'] }, curriculum)).toEqual({ subjectId: 'MAT', userIds: ['1'] })
    expect(await withSubjectCode<{ subjectId?: string; userIds: string[] }>({ userIds: ['1'] }, curriculum)).toEqual({ userIds: ['1'] })
    expect((await withSubjectCode({ subjectId: '999' }, curriculum)).subjectId).toBe('')
  })
})
