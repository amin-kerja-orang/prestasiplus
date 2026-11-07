import { describe, expect, it } from 'vitest'

import type { AnswerKey, PartOption, QuestionPart as PartRow } from '../../src/db/generated/client'
import { partsFromRows, StoredKeyError } from '../../src/modules/questions/tree'

/** S4-T04: the duplicate-stem trim leaves prompt_ms = ''. Such a leaf must still parse, and a bad key must still fail closed. */
const row = (o: Partial<Record<string, unknown>> = {}): PartRow =>
  ({ id: 1n, questionVersionId: 1n, parentPartId: null, label: '1', position: 1, depth: 1, promptMs: '', promptEn: null, marks: 1, mode: 'mcq', blankCount: null, wordMin: null, wordMax: null, topics: null, stimulusId: null, reveal: 'after_submit', unitNodeId: null, formOrigin: null, difficultyTp: null, kbat: null, cognitiveLevel: null, ...o }) as unknown as PartRow
const opt = (label: string, position: number): PartOption => ({ id: BigInt(position), partId: 1n, label, bodyMs: `Pilihan ${label}`, bodyEn: null, imageFileId: null, position }) as unknown as PartOption
const options = [opt('A', 1), opt('B', 2), opt('C', 3)]
const key = (content: unknown): AnswerKey => ({ partId: 1n, kind: 'option', content }) as unknown as AnswerKey

describe('partsFromRows with an empty leaf prompt (S4-T04)', () => {
  it('returns the leaf with its empty prompt, for mcq and short_text', () => {
    const [mcq] = partsFromRows([row()], options, [key({ kind: 'option', correct: 'B' })])
    expect(mcq).toMatchObject({ mode: 'mcq', prompt: { ms: '' }, key: { correct: 'B' } })
    const [short] = partsFromRows([row({ mode: 'short_text' })], [], [key({ kind: 'accepted', values: ['KL'] })])
    expect(short).toMatchObject({ mode: 'short_text', prompt: { ms: '' } })
  })

  it('keeps the English prompt and a non-empty prompt untouched', () => {
    expect(partsFromRows([row({ promptEn: 'Q' })], options, [key({ kind: 'option', correct: 'A' })])[0]).toMatchObject({ prompt: { ms: '', en: 'Q' } })
    expect(partsFromRows([row({ promptMs: 'Soalan' })], options, [key({ kind: 'option', correct: 'A' })])[0]).toMatchObject({ prompt: { ms: 'Soalan' } })
  })

  it('still fails closed on a wrong key, a missing key or a key outside the options', () => {
    expect(() => partsFromRows([row()], options, [key({ kind: 'accepted', values: ['x'] })])).toThrow(StoredKeyError)
    expect(() => partsFromRows([row()], options, [])).toThrow(StoredKeyError)
    expect(() => partsFromRows([row()], options, [key({ kind: 'option', correct: 'D' })])).toThrow(StoredKeyError)
  })
})
