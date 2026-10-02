import { describe, expect, it, vi } from 'vitest'

import { entryTarget, subjectParamCode, topicParamId } from '../../components/quiz/entry-params'

const CODES = ['BM', 'BI', 'MATH', 'ADDMATH']

describe('S2 entry parameters (FR-M05-33/34, BR-28)', () => {
  it('names a known subject case-insensitively and ignores unknown ones', () => {
    expect(subjectParamCode({ subject: 'BM' }, CODES)).toBe('BM')
    expect(subjectParamCode({ subject: 'math' }, CODES)).toBe('MATH')
    expect(subjectParamCode({ subject: 'XYZ' }, CODES)).toBeNull()
    expect(subjectParamCode({}, CODES)).toBeNull()
  })

  it('accepts a topic id of digits only', () => {
    expect(topicParamId({ topic_id: '7' })).toBe(7)
    expect(topicParamId({ topic_id: '7x' })).toBeNull()
    expect(topicParamId({ topic_id: '' })).toBeNull()
  })

  it('redirects ?subject= to S3 and never calls the topic lookup', async () => {
    const lookup = vi.fn()
    expect(await entryTarget({ subject: 'BM' }, CODES, lookup)).toBe('/practice/BM')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('redirects ?topic_id= through the topic practice code', async () => {
    const lookup = vi.fn().mockResolvedValue('MATH')
    expect(await entryTarget({ topic_id: '7' }, CODES, lookup)).toBe('/practice/MATH')
    expect(lookup).toHaveBeenCalledWith(7)
  })

  it('keeps the plain list for unknown values, an unknown topic or a practice code that is not offered', async () => {
    expect(await entryTarget({ subject: 'XYZ' }, CODES, vi.fn())).toBeNull()
    expect(
      await entryTarget({ topic_id: '99999' }, CODES, vi.fn().mockResolvedValue(null)),
    ).toBeNull()
    expect(await entryTarget({ topic_id: '3' }, CODES, vi.fn().mockResolvedValue('GEO'))).toBeNull()
    // ?level= is ignored as live.
    expect(await entryTarget({ level: 'D3' } as never, CODES, vi.fn())).toBeNull()
  })

  it('prefers subject over topic_id (BR-28)', async () => {
    const lookup = vi.fn().mockResolvedValue('MATH')
    expect(await entryTarget({ subject: 'BI', topic_id: '7' }, CODES, lookup)).toBe('/practice/BI')
  })
})
