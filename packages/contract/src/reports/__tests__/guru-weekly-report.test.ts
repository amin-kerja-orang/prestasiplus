import { describe, expect, it } from 'vitest'

import {
  GuruWeeklyReportQuerySchema,
  GuruWeeklyReportResponseSchema,
} from '../guru-weekly-report'

const sample = (acc = 66.7) => ({
  data: {
    classroom: { id: '12', name: '5 Bestari' },
    week: { from: '2026-11-02', to: '2026-11-08', label: '02 Nov 2026 — 08 Nov 2026' },
    summary: { answered: 30, activePupils: 3, improvedPupils: 1, attentionSubjects: 1 },
    topPerformers: [{ rank: 1, name: 'Murid A', answered: 10, accuracy: 100 }],
    mostImproved: [{ name: 'Murid B', previousAccuracy: 40, accuracy: acc, delta: 27 }],
    attentionSubjects: [{ subject: 'Matematik', accuracy: 45.5, answered: 11 }],
  },
})

describe('GuruWeeklyReportQuerySchema', () => {
  it('requires classroomId', () => {
    expect(GuruWeeklyReportQuerySchema.safeParse({}).success).toBe(false)
    expect(GuruWeeklyReportQuerySchema.safeParse({ classroomId: '1' }).success).toBe(true)
  })
  it.each(['2026-13-01', '2026-11-5', 'abc', '2026-02-30'])('rejects week %s', (week) => {
    expect(GuruWeeklyReportQuerySchema.safeParse({ classroomId: '1', week }).success).toBe(false)
  })
  it('accepts a valid week', () => {
    expect(GuruWeeklyReportQuerySchema.safeParse({ classroomId: '1', week: '2026-11-02' }).success).toBe(true)
  })
})

describe('GuruWeeklyReportResponseSchema', () => {
  it('accepts a valid sample (100 and 66.7)', () => {
    expect(GuruWeeklyReportResponseSchema.safeParse(sample()).success).toBe(true)
  })
  it('rejects 66.67', () => {
    expect(GuruWeeklyReportResponseSchema.safeParse(sample(66.67)).success).toBe(false)
  })
})
