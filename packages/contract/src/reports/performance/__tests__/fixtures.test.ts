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
  PerformanceTimelineDeleteResultSchema,
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

/** Fields added by a later card than the capture (the capture is never hand-edited): S10-T01 added `trend` to the pupil view. */
const AFTER_CAPTURE: Record<string, Record<string, unknown>> = {
  // S10-T08 added the automatic feed `entries` (sessions, badges, posts) to the own timeline.
  timeline: {
    entries: [
      { kind: 'session', id: 's:1', at: '2026-10-23T20:06:00+08:00', subjectName: 'Sains', correct: 0, answered: 40, accuracy: 0 },
      { kind: 'badge', id: 'b:1', at: '2026-10-23T19:00:00+08:00', name: 'Pemula', icon: '🏅' },
    ],
  },
  'performance-student': {
    trend: Array.from({ length: 12 }, (_, i) => ({
      week: new Date(Date.parse('2026-07-13T00:00:00Z') + i * 7 * 86_400_000).toISOString().slice(0, 10),
      label: `Mgg ${String(i + 1)}`,
      accuracy: null,
      sessions: 0,
    })),
  },
}

/** S10-T04 part 2 added `classes` (names of the pupil's classes, school admin only) to every class analytics row. */
const withRowClasses = (payload: object): object => {
  const rows = (payload as { rows?: object[] }).rows
  return rows ? { ...payload, rows: rows.map((r) => ({ classes: [], ...r })) } : payload
}

/** S10-T03 added `tingkatanOptions` and `questionsTested` to the school item analysis. */
AFTER_CAPTURE['item-analysis-school'] = { tingkatanOptions: ['T4', 'T5'], questionsTested: 2 }
/** Fields added by S10-T02 inside nested objects (the capture is never hand-edited): the same shapes the API now answers. */
const S10_T02: Record<string, (v: unknown) => unknown> = {
  headcounts: (row) => ({ ...(row as object), teacherName: 'Guru Contoh', entryStatus: 'active', statusReason: null }),
  'headcounts-dashboard': (v) => ({
    ...(v as { configs: object[] }),
    configs: (v as { configs: object[] }).configs.map((c) => ({ ...c, mode: 'auto', teacherName: 'Guru Contoh' })),
  }),
  'headcount-detail': (v) => {
    const d = v as { config: object; chips: object; rows: object[] }
    return {
      ...d,
      config: { ...d.config, mode: 'auto', defaultTov: null, defaultEtr: null },
      chips: { ...d.chips, onTrackPct: 0 },
      rows: d.rows.map((r) => ({ ...r, rs: null, rsRecordedAt: null, status: 'none', statusReason: null, entryStatus: 'active', projection: null })),
    }
  },
  'headcount-student': (v) => {
    const d = v as { sections: object[] }
    return {
      ...d,
      sections: d.sections.map((s) => ({ ...s, mode: 'auto', statusReason: null, entryStatus: 'active', jurang: null, unjuran: null, keyakinan: null })),
    }
  },
}
const afterCapture = (name: string, v: unknown): unknown => S10_T02[name]?.(v) ?? v

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
    const captured = (name === 'analytics-classes' ? withRowClasses(load(name) as object) : afterCapture(name, load(name))) as object
    const r = schema.safeParse({ ...captured, ...AFTER_CAPTURE[name] })
    expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok')
  })

  it.each(LISTS)('%s (array)', (name, schema) => {
    const rows = load(name) as unknown[]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const r = schema.safeParse(afterCapture(name, row))
      expect(r.success ? 'ok' : JSON.stringify(r.error.issues.slice(0, 5))).toBe('ok')
    }
  })

  it('Prestasi 360: trend is exactly 12 weeks with a DateOnly week; an empty week has null accuracy; heroAccuracy and stats.accuracy accept null (nothing answered)', () => {
    const base = { ...(load('performance-student') as { stats: object }), ...AFTER_CAPTURE['performance-student'] } as {
      stats: object
      trend: unknown[]
      heroAccuracy: unknown
    }
    expect(PerformanceStudentSchema.safeParse(base).success).toBe(true)
    expect(PerformanceStudentSchema.safeParse({ ...base, heroAccuracy: null }).success).toBe(true)
    expect(PerformanceStudentSchema.safeParse({ ...base, stats: { ...base.stats, accuracy: null } }).success).toBe(true)
    expect(PerformanceStudentSchema.safeParse({ ...base, heroAccuracy: 'x' }).success).toBe(false)
    expect(PerformanceStudentSchema.safeParse({ ...base, trend: base.trend.slice(1) }).success).toBe(false)
    expect(PerformanceStudentSchema.safeParse({ ...base, trend: [...base.trend, base.trend[0]] }).success).toBe(false)
    const bad = base.trend.map((w, i) => (i === 0 ? { ...(w as object), week: '2026/07/13' } : w))
    expect(PerformanceStudentSchema.safeParse({ ...base, trend: bad }).success).toBe(false)
  })

  it('timeline: entries are a session, badge or post row with a MYT time; a bad row or a fractional percent is refused', () => {
    const base = { ...(load('timeline') as { posts: unknown[] }), ...AFTER_CAPTURE['timeline'] } as { posts: { id: string }[]; entries: object[] }
    const post = base.posts[0]
    if (post) {
      const withPost = { ...base, entries: [...base.entries, { kind: 'post', id: post.id, at: '2026-10-23T18:00:00+08:00', post }] }
      expect(PerformanceTimelineSchema.safeParse(withPost).success).toBe(true)
    }
    expect(PerformanceTimelineSchema.safeParse({ ...base, entries: [{ kind: 'level', id: '1', at: '2026-10-23T18:00:00+08:00' }] }).success).toBe(false)
    expect(PerformanceTimelineSchema.safeParse({ ...base, entries: [{ ...base.entries[0], at: '2026-10-23T12:06:00Z' }] }).success).toBe(false)
    expect(PerformanceTimelineSchema.safeParse({ ...base, entries: [{ ...base.entries[0], accuracy: 12.5 }] }).success).toBe(false)
    expect(PerformanceTimelineDeleteResultSchema.safeParse({ deleted: 1 }).success).toBe(true)
    expect(PerformanceTimelineDeleteResultSchema.safeParse({ deleted: 2 }).success).toBe(false)
  })

  it('a drifted shape is rejected', () => {
    const detail = load('headcount-detail') as { rows: { tov: unknown }[] }
    detail.rows[0]!.tov = 'tinggi'
    expect(PerformanceHeadcountDetailSchema.safeParse(detail).success).toBe(false)
  })
})
