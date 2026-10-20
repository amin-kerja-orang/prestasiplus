import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import {
  INTAKE_DASHBOARD_BATCH_STATUSES,
  INTAKE_DASHBOARD_TAG_FIELDS,
  INTAKE_DASHBOARD_TAG_PATHS,
  IntakeCostSchema,
  IntakeDashboardCostQuerySchema,
  IntakeDashboardQuerySchema,
  IntakeDashboardSchema,
} from '../dashboard'

const budget = {
  costSen: 0,
  budgetSen: 0,
  budgetSource: 'none',
  remainingSen: 0,
  percentUsed: 0,
  budgetState: 'exhausted',
  warnReached: true,
  capReached: true,
} as const

describe('BE-40 intake dashboard contract', () => {
  it('the empty dashboard parses; rates are nullable, never negative', () => {
    const empty = {
      month: '2026-10',
      from: '2026-10-01T00:00:00.000+08:00',
      to: '2026-11-01T00:00:00.000+08:00',
      generatedAt: '2026-10-19T09:00:00.000+08:00',
      submissions: { total: 0, byStatus: INTAKE_DASHBOARD_BATCH_STATUSES.map((status) => ({ status, count: 0 })) },
      queue: { items: 0, oldestItemAt: null, oldestItemAgeSeconds: null, pendingSubmissions: 0, oldestPendingSubmissionAt: null },
      extraction: { succeeded: 0, failed: 0, successRate: null },
      tagAcceptance: {
        acceptedItems: 0,
        fields: INTAKE_DASHBOARD_TAG_FIELDS.map((field) => ({ field, path: INTAKE_DASHBOARD_TAG_PATHS[field], unchanged: 0, ratePercent: null })),
      },
      duplicates: { items: 0, duplicates: 0, ratePercent: null },
      aiCost: budget,
      sources: { batches: false, items: false, duplicates: false, usage: false, settings: false },
    }
    expect(IntakeDashboardSchema.parse(empty)).toEqual(empty)
    expect(IntakeDashboardSchema.safeParse({ ...empty, extraction: { succeeded: 0, failed: 0, successRate: -1 } }).success).toBe(false)
    expect(IntakeDashboardSchema.safeParse({ ...empty, extra: 1 }).success).toBe(false)
  })

  it('the cost answer parses, with a null provider row and a null batch row', () => {
    const totals = { calls: 1, costSen: 0, pages: 0, tokensIn: 0, tokensOut: 0 }
    const cost = {
      month: '2026-09',
      from: '2026-09-01T00:00:00.000+08:00',
      to: '2026-10-01T00:00:00.000+08:00',
      generatedAt: '2026-10-19T09:00:00.000+08:00',
      provider: null,
      total: totals,
      byDay: [{ day: '2026-09-30', calls: 1, costSen: 0 }],
      byProvider: [{ provider: null, ...totals }],
      byBatch: [{ batchId: null, ...totals }],
      byBatchTruncated: false,
      budget,
      sources: { usage: true, settings: false },
    }
    expect(IntakeCostSchema.parse(cost)).toEqual(cost)
  })

  it('queries: month is YYYY-MM, provider is an AI provider id', () => {
    expect(IntakeDashboardQuerySchema.parse({})).toEqual({})
    expect(IntakeDashboardQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false)
    expect(IntakeDashboardCostQuerySchema.parse({ month: '2026-10', provider: 'mock' })).toEqual({ month: '2026-10', provider: 'mock' })
    expect(IntakeDashboardCostQuerySchema.safeParse({ provider: 'chatgpt' }).success).toBe(false)
  })

  it('both routes are GET, documented 401/403/422/429 and no-store', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, unknown> }> }>> }
    for (const path of ['/intake/dashboard', '/intake/dashboard/cost']) {
      const op = doc.paths[path]?.get
      expect(op, path).toBeDefined()
      expect(Object.keys(op?.responses ?? {}).sort()).toEqual(['200', '401', '403', '422', '429'])
      expect(op?.responses['200']?.headers?.['Cache-Control']).toBeDefined()
    }
  })
})
