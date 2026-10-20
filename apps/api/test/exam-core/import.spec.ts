import { gradePart, type GradeInput } from '@pp/exam-core'
import { describe, expect, it } from 'vitest'

describe('@pp/exam-core import (BE-14)', () => {
  const base: Omit<GradeInput, 'answer'> = {
    part: { id: 'q1a', label: '(a)', prompt: 'Hitung 2 + 3.', marks: 1, kind: 'numeric' },
    scheme: { kind: 'accepted', marks: 1, values: [{ v: '5' }] },
    ctx: { previousFinals: {} },
  }

  it('grades one fixture part on the server exactly like the UI engine', () => {
    const right = gradePart({ ...base, answer: { final: '5' } })
    expect(right.awarded).toBe(1)
    expect(right.status).toBe('betul')
    const wrong = gradePart({ ...base, answer: { final: '6' } })
    expect(wrong.awarded).toBe(0)
    expect(wrong.status).toBe('salah')
  })
})
