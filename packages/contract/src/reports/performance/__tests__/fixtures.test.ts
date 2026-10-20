import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import type { z } from 'zod'

import {
  PerformanceAnalyticsSchema,
  PerformanceClassAnalyticsSchema,
  PerformanceClassCardSchema,
  PerformanceClassDashboardSchema,
  PerformanceClassItemAnalysisSchema,
  PerformanceHeadcountDashboardSchema,
  PerformanceHeadcountDetailSchema,
  PerformanceHeadcountFormOptionsSchema,
  PerformanceHeadcountListItemSchema,
  PerformanceHeadcountStudentSchema,
  PerformanceHeadcountSummarySchema,
  PerformanceLeaderboardSchema,
  PerformanceLevelCardSchema,
  PerformanceLevelDetailSchema,
  PerformancePublicProfileSchema,
  PerformanceRankingSchema,
  PerformanceSchoolItemAnalysisSchema,
  PerformanceSchoolSchema,
  PerformanceStudentSchema,
  PerformanceTimelinePostSchema,
  PerformanceTimelineSchema,
} from '../schema'

/**
 * Payloads captured from the real m08 mock (handlers + repositories) booted with the project clock:
 * `fixtures/*.json` are the `data` of the mock responses, written by a one-off capture run (a vitest
 * file in the m08 mock test folder using `bootM08`, deleted after the run) and never hand-edited.
 * The mock uses numeric ids and `Z` instants; the wire contract uses string ids and `+08:00`
 * (ADR-0018 item 6). `toWire` applies exactly that documented difference and nothing else.
 */
const DIR = resolve(__dirname, 'fixtures')
const TIMESTAMP_KEYS = new Set(['createdAt', 'joinedAt', 'lastActiveAt', 'recordedAt'])

function toMyt(iso: string): string {
  const d = new Date(Date.parse(iso) + 8 * 3_600_000)
  return `${d.toISOString().slice(0, 19)}+08:00`
}

function toWire(value: unknown, key = '', parent = ''): unknown {
  if (Array.isArray(value)) return value.map((v) => toWire(v, key, parent))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toWire(v, k, key)]))
  }
  if (
    typeof value === 'number' &&
    (key === 'id' || (key === 'level' && parent !== 'tier') || key.endsWith('Id'))
  )
    return String(value)
  if (typeof value === 'string' && TIMESTAMP_KEYS.has(key)) return toMyt(value)
  return value
}

const load = (name: string): unknown =>
  toWire(JSON.parse(readFileSync(resolve(DIR, `${name}.json`), 'utf8')))

const CASES: [string, z.ZodType][] = [
  ['analytics-me', PerformanceAnalyticsSchema],
  ['analytics-classes', PerformanceClassAnalyticsSchema],
  ['performance-class-dashboard', PerformanceClassDashboardSchema],
  ['performance-student', PerformanceStudentSchema],
  ['performance-school-platform', PerformanceSchoolSchema],
  ['performance-school-own', PerformanceSchoolSchema],
  ['performance-level-detail', PerformanceLevelDetailSchema],
  ['item-analysis-class', PerformanceClassItemAnalysisSchema],
  ['item-analysis-school', PerformanceSchoolItemAnalysisSchema],
  ['rankings', PerformanceRankingSchema],
  ['leaderboard', PerformanceLeaderboardSchema],
  ['timeline', PerformanceTimelineSchema],
  ['timeline-created', PerformanceTimelinePostSchema],
  ['public-profile', PerformancePublicProfileSchema],
  ['headcounts-dashboard', PerformanceHeadcountDashboardSchema],
  ['headcounts-form-options', PerformanceHeadcountFormOptionsSchema],
  ['headcount-detail', PerformanceHeadcountDetailSchema],
  ['headcount-summary', PerformanceHeadcountSummarySchema],
  ['headcount-student', PerformanceHeadcountStudentSchema],
]
const LISTS: [string, z.ZodType][] = [
  ['performance-classes', PerformanceClassCardSchema],
  ['item-analysis-classes', PerformanceClassCardSchema],
  ['performance-levels', PerformanceLevelCardSchema],
  ['headcounts', PerformanceHeadcountListItemSchema],
]

describe('BE-19 contract parses payloads captured from the m08 mock', () => {
  it.each(CASES)('%s', (name, schema) => {
    const r = schema.safeParse(load(name))
    expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok')
  })

  it.each(LISTS)('%s (array)', (name, schema) => {
    const rows = load(name) as unknown[]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const r = schema.safeParse(row)
      expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok')
    }
  })

  it('a drifted shape is rejected', () => {
    const detail = load('headcount-detail') as { rows: { tov: unknown }[] }
    detail.rows[0]!.tov = 'tinggi'
    expect(PerformanceHeadcountDetailSchema.safeParse(detail).success).toBe(false)
  })
})
