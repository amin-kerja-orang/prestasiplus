import { describe, expect, it } from 'vitest'

import { gradePart, isBlank } from '../src'
import type { PartAnswer, SchemeDef } from '../src/types'

/**
 * REQ-B-021b: an `essay_choice` answer that only picked a topic (a `choice`, no essay) is blank. It must not be sent to the teacher
 * review or self-mark as if an essay had been written. For every other mode a `choice` is the answer (MCQ, match_letter).
 */
const rubric: SchemeDef = { kind: 'rubric', marks: 30, bands: [{ name: 'Cemerlang', range: [25, 30], descriptor: '' }], criteria: [] } as never
const part = { id: 'q1.1', label: '', prompt: 'Pilih satu tajuk.', marks: 30, kind: 'essay_choice' as const }
const grade = (answer: PartAnswer | undefined, kind: 'essay_choice' | 'essay' = 'essay_choice') =>
  gradePart({ part: { ...part, kind }, scheme: rubric, answer, ctx: { finals: {} } as never })

describe('essay_choice blank answer (REQ-B-021b)', () => {
  it('a topic alone is blank: status kosong, nothing to review', () => {
    expect(isBlank({ choice: 'a' }, 'essay_choice')).toBe(true)
    const r = grade({ choice: 'a' })
    expect(r.status).toBe('kosong')
    expect(r.confidence).toBe('high')
  })

  it('a topic with an essay is not blank and waits for a person', () => {
    expect(isBlank({ choice: 'a', text: 'Karangan saya tentang membaca.' }, 'essay_choice')).toBe(false)
    expect(grade({ choice: 'a', text: 'Karangan saya tentang membaca.' }).status).toBe('belum_dimarkah')
    expect(isBlank({ choice: 'a', text: '   ' }, 'essay_choice')).toBe(true) // spaces are no essay
    expect(isBlank({ text: 'Karangan tanpa pilihan.' }, 'essay_choice')).toBe(false)
  })

  it('no answer at all is still blank, and a choice is still an answer for the other modes', () => {
    expect(isBlank(undefined, 'essay_choice')).toBe(true)
    expect(isBlank({ choice: 'B' })).toBe(false)
    expect(isBlank({ choice: 'B' }, 'essay')).toBe(false)
  })
})
