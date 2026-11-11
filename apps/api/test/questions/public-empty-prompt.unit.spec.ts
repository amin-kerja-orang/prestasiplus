import { describe, expect, it } from 'vitest'

import { partsFromFlat, toPublic } from '../../src/modules/questions/projection'
import type { QuestionRecord } from '../../src/modules/questions/types'

/** A migrated V2 MCQ: the text lives in the stem, the leaf prompt is stored EMPTY (S4-T04). */
function migratedRecord(prompt: string): QuestionRecord {
  const parts = partsFromFlat({ questionType: 'mcq', questionText: 'x', options: ['a', 'b', 'c', 'd'], correctAnswer: 0 }).map((p) => ({ ...p, prompt: { ms: prompt } }))
  return {
    id: '7',
    isActive: true,
    version: { stemMs: 'Apakah ibu negara Malaysia?', stemEn: null, language: 'ms', parts, marks: 1 },
  } as unknown as QuestionRecord
}

const promptOf = (pub: ReturnType<typeof toPublic>): string => (pub.parts?.[0] as { prompt: { ms: string } }).prompt.ms

describe('toPublic with a migrated V2 question that has an empty leaf prompt', () => {
  it('does not throw (it was a ZodError, a 500 on /api/item-analysis/school) and keeps the prompt empty', () => {
    const pub = toPublic(migratedRecord(''))
    expect(pub.questionText).toBe('Apakah ibu negara Malaysia?')
    expect(promptOf(pub)).toBe('')
  })

  it('still strips the key and keeps a typed prompt unchanged', () => {
    const pub = toPublic(migratedRecord('Pilih jawapan.'))
    expect(promptOf(pub)).toBe('Pilih jawapan.')
    expect(JSON.stringify(pub)).not.toContain('"key"')
  })
})

describe('toPublic with an empty option body (an image-only V2 option)', () => {
  it('does not throw, keeps the option body empty and still strips the key', () => {
    const rec = migratedRecord('Pilih jawapan.')
    const leaf = (rec.version.parts as unknown as { options: { label: string; body: { ms: string } }[] }[])[0]!
    leaf.options[1]!.body = { ms: '' }
    const pub = toPublic(rec)
    const options = (pub.parts?.[0] as unknown as { options: { label: string; body: { ms: string } }[] }).options
    expect(options.map((o) => o.body.ms)).toEqual(['a', '', 'c', 'd'])
    expect(JSON.stringify(pub)).not.toContain('"key"')
  })
})
