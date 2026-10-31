import { describe, expect, it } from 'vitest'

import {
  QUESTION_COGNITIVE_LEVELS,
  QuestionCognitiveLevelSchema,
  QuestionGateCheckSchema,
  QuestionGateIssueSchema,
  QuestionLeafPartSchema,
  QuestionPublicPartSchema,
  QuestionStatusRequestSchema,
} from '../../index'

const leaf = (over: Record<string, unknown> = {}) => ({ label: 'a', prompt: { ms: 'Soalan' }, marks: 1, mode: 'short_text', key: { kind: 'accepted', values: ['x'] }, ...over })

describe('R1-B05 cognitive level and gate schemas', () => {
  it('the six cognitive levels, in Bloom order', () => {
    expect([...QUESTION_COGNITIVE_LEVELS]).toEqual(['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta'])
    for (const l of QUESTION_COGNITIVE_LEVELS) expect(QuestionCognitiveLevelSchema.safeParse(l).success).toBe(true)
    expect(QuestionCognitiveLevelSchema.safeParse('kreatif').success).toBe(false)
  })

  it('a leaf takes an optional or null cognitive level and its own TP; a bad value is refused', () => {
    expect(QuestionLeafPartSchema.safeParse(leaf()).success).toBe(true)
    expect(QuestionLeafPartSchema.safeParse(leaf({ cognitiveLevel: 'menilai', difficultyTp: 5 })).success).toBe(true)
    expect(QuestionLeafPartSchema.safeParse(leaf({ cognitiveLevel: null })).success).toBe(true)
    expect(QuestionLeafPartSchema.safeParse(leaf({ cognitiveLevel: 'kreatif' })).success).toBe(false)
    expect(QuestionLeafPartSchema.safeParse(leaf({ difficultyTp: 7 })).success).toBe(false)
  })

  it('the pupil projection of a leaf never carries the level (an admin-side tag)', () => {
    const parsed = QuestionPublicPartSchema.parse({ label: 'a', prompt: { ms: 'Soalan' }, marks: 1, mode: 'short_text', cognitiveLevel: 'menilai' })
    expect(parsed).not.toHaveProperty('cognitiveLevel')
  })

  it('a gate issue has a path, code, BM message and a wizard step 1 to 4', () => {
    const issue = { path: 'parts.b.cognitiveLevel', code: 'LEAF_COGNITIVE_LEVEL_MISSING', message: 'Bahagian (b) belum ada aras pemikiran.', step: 3 }
    expect(QuestionGateIssueSchema.safeParse(issue).success).toBe(true)
    expect(QuestionGateIssueSchema.safeParse({ ...issue, step: 5 }).success).toBe(false)
    expect(QuestionGateCheckSchema.safeParse({ gate: 'approve', ok: false, issues: [issue] }).success).toBe(true)
    expect(QuestionGateCheckSchema.safeParse({ gate: 'publish', ok: true, issues: [] }).success).toBe(false)
  })

  it('the status request takes the four lifecycle codes only; `published` is gone (ADR-0027)', () => {
    for (const to of ['draft', 'review', 'approved', 'archived']) expect(QuestionStatusRequestSchema.safeParse({ to }).success).toBe(true)
    for (const to of ['published', 'pending_review', 'rejected']) expect(QuestionStatusRequestSchema.safeParse({ to }).success).toBe(false)
    expect(QuestionStatusRequestSchema.safeParse({ to: 'draft', reason: 'Jawapan tidak jelas.' }).success).toBe(true)
    expect(QuestionStatusRequestSchema.safeParse({ to: 'draft', extra: 1 }).success).toBe(false)
  })
})
