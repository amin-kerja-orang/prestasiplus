import { IntakeCostSchema, IntakeDashboardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, bootDashApp, getAs, login, type DashTestApp } from './helpers'

/**
 * Empty state and degrade rule. On the base today none of the BE-36/BE-38 tables exist (and BE-37's only with PR #57):
 * the dashboard must answer the empty aggregate, never a 500, and say which stores it read.
 */

describe('no intake or AI store at all (the base without BE-36/37/38 tables)', () => {
  let t: DashTestApp

  beforeAll(async () => {
    t = await bootDashApp({ AI_MONTHLY_BUDGET_SEN: undefined })
    // Private database: once BE-36/37/38 migrations are on the base, remove their tables here so this stays the "missing" case.
    await t.db.query(
      `DROP TABLE IF EXISTS duplicate_links, intake_item_events, intake_items, intake_figures, intake_pages, intake_files, intake_batches, ai_usage_logs, ai_settings CASCADE`,
    )
  })
  afterAll(async () => {
    await t?.close()
  })

  it('dashboard: zero counts, null rates and ages, no cap configured (source none, exhausted), every source false', async () => {
    const res = await getAs(await login(t, ADMIN), '/intake/dashboard')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = IntakeDashboardSchema.parse(res.body.data)
    expect(d.sources).toEqual({ batches: false, items: false, duplicates: false, usage: false, settings: false })
    expect(d.submissions.total).toBe(0)
    expect(d.submissions.byStatus.map((r) => r.count)).toEqual([0, 0, 0, 0, 0])
    expect(d.queue).toEqual({ items: 0, oldestItemAt: null, oldestItemAgeSeconds: null, pendingSubmissions: 0, oldestPendingSubmissionAt: null })
    expect(d.extraction).toEqual({ succeeded: 0, failed: 0, successRate: null })
    expect(d.tagAcceptance.acceptedItems).toBe(0)
    expect(d.tagAcceptance.fields.map((f) => f.ratePercent)).toEqual([null, null, null, null, null])
    expect(d.duplicates).toEqual({ items: 0, duplicates: 0, ratePercent: null })
    expect(d.aiCost).toEqual({
      costSen: 0,
      budgetSen: 0,
      budgetSource: 'none',
      remainingSen: 0,
      percentUsed: 0,
      budgetState: 'exhausted',
      warnReached: true,
      capReached: true,
    })
  })

  it('cost: every day at zero, no provider or batch rows', async () => {
    const res = await getAs(await login(t, ADMIN), '/intake/dashboard/cost?provider=anthropic')
    expect(res.status).toBe(200)
    const c = IntakeCostSchema.parse(res.body.data)
    expect(c.sources).toEqual({ usage: false, settings: false })
    expect(c.total).toEqual({ calls: 0, costSen: 0, pages: 0, tokensIn: 0, tokensOut: 0 })
    expect(c.byDay).toHaveLength(31)
    expect(c.byDay.every((d) => d.calls === 0 && d.costSen === 0)).toBe(true)
    expect(c.byProvider).toEqual([])
    expect(c.byBatch).toEqual([])
  })

  it('only intake_batches (BE-37 merged, BE-38 not): batch figures are read, item figures stay empty', async () => {
    await t.db.query(`CREATE TABLE intake_batches (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, status text NOT NULL,
      is_test boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL)`)
    await t.db.query(`INSERT INTO intake_batches (status, created_at) VALUES ('failed', '2026-10-02T10:00:00+08:00'), ('submitted', '2026-10-03T10:00:00+08:00')`)
    try {
      const d = IntakeDashboardSchema.parse((await getAs(await login(t, ADMIN), '/intake/dashboard')).body.data)
      expect(d.sources).toMatchObject({ batches: true, items: false, duplicates: false })
      expect(d.submissions.total).toBe(2)
      expect(d.extraction).toEqual({ succeeded: 0, failed: 1, successRate: 0 })
      expect(d.queue.pendingSubmissions).toBe(1)
      expect(d.queue.items).toBe(0)
    } finally {
      await t.db.query(`DROP TABLE intake_batches`)
    }
  })

  it('a store whose columns differ (missing is_test / cost_sen) degrades to empty with source false, not a 500', async () => {
    await t.db.query(`CREATE TABLE intake_batches (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, status text NOT NULL, created_at timestamptz NOT NULL)`)
    await t.db.query(`CREATE TABLE ai_usage_logs (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, provider text, created_at timestamptz NOT NULL)`)
    await t.db.query(`INSERT INTO ai_usage_logs (provider, created_at) VALUES ('anthropic', '2026-10-02T10:00:00+08:00')`)
    try {
      const admin = await login(t, ADMIN)
      const res = await getAs(admin, '/intake/dashboard')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const d = IntakeDashboardSchema.parse(res.body.data)
      expect(d.sources).toMatchObject({ batches: false, usage: false })
      expect(d.submissions.total).toBe(0)
      expect(d.aiCost.costSen).toBe(0)
      const c = await getAs(admin, '/intake/dashboard/cost')
      expect(c.status).toBe(200)
      expect(IntakeCostSchema.parse(c.body.data).sources.usage).toBe(false)
    } finally {
      await t.db.query(`DROP TABLE intake_batches; DROP TABLE ai_usage_logs`)
    }
  })
})

describe('rate limit (D57): the read bucket answers 429 RATE_LIMITED past the ceiling', () => {
  let t: DashTestApp

  beforeAll(async () => {
    t = await bootDashApp({ THROTTLE_INTAKE_DASHBOARD_READ_PER_MINUTE: '3', AI_MONTHLY_BUDGET_SEN: 'not-a-number' })
  })
  afterAll(async () => {
    await t?.close()
  })

  it('both routes share one bucket per user; the 4th read is 429 with Retry-After; a malformed env cap is ignored', async () => {
    const admin = await login(t, ADMIN)
    const first = await getAs(admin, '/intake/dashboard')
    expect(first.status).toBe(200)
    expect(IntakeDashboardSchema.parse(first.body.data).aiCost.budgetSource).toBe('none')
    expect((await getAs(admin, '/intake/dashboard/cost')).status).toBe(200)
    expect((await getAs(admin, '/intake/dashboard')).status).toBe(200)
    const limited = await getAs(admin, '/intake/dashboard/cost')
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0)
  })
})
