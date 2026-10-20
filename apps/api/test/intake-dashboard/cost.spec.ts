import { ErrorBodySchema, IntakeCostSchema, type IntakeCost } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { LoggedIn } from '../auth/helpers'
import { ADMIN, bootDashApp, createStores, getAs, insertBatch, insertUsage, login, setBudget, type DashTestApp } from './helpers'

/**
 * Card BE-40 AC2, AC3, AC5 for GET /intake/dashboard/cost. Clock 2026-10-19T09:00+08:00. Usage rows (+08:00):
 *  U1 anthropic, batch B1, 120 sen, 4 pages, 1000/500 tokens, 10-01 00:01 (October boundary)
 *  U2 mock, batch B1, logged 999 sen -> costs 0 (AC3), 10-02 12:00
 *  U3 openai_compatible (data-model spelling), batch B2, 80 sen, 10-02 23:59 (still 10-02 in Malaysia, 15:59Z)
 *  U4 anthropic, no batch, 50 sen, 10-19 08:00
 *  U0 anthropic, batch B0, 300 sen, 09-30 23:59 (September boundary)
 * Env cap AI_MONTHLY_BUDGET_SEN = 1000.
 */

const A = (local: string) => `${local}+08:00`

describe('GET /intake/dashboard/cost', () => {
  let t: DashTestApp
  let admin: LoggedIn
  let B1: string
  let B2: string

  beforeAll(async () => {
    t = await bootDashApp({ AI_MONTHLY_BUDGET_SEN: '1000' })
    admin = await login(t, ADMIN)
    await createStores(t.db)
    B1 = await insertBatch(t.db, 'ready_for_review', A('2026-10-01T00:00:00'))
    B2 = await insertBatch(t.db, 'ready_for_review', A('2026-10-02T00:00:00'))
    const B0 = await insertBatch(t.db, 'failed', A('2026-09-30T00:00:00'))
    await insertUsage(t.db, { provider: 'anthropic', batchId: B1, costSen: 120, pages: 4, tokensIn: 1000, tokensOut: 500, at: A('2026-10-01T00:01:00') })
    await insertUsage(t.db, { provider: 'mock', batchId: B1, costSen: 999, pages: 2, tokensIn: 20, tokensOut: 10, at: A('2026-10-02T12:00:00') })
    await insertUsage(t.db, { provider: 'openai_compatible', batchId: B2, costSen: 80, pages: 3, tokensIn: 300, tokensOut: 100, at: A('2026-10-02T23:59:00') })
    await insertUsage(t.db, { provider: 'anthropic', batchId: null, costSen: 50, pages: 0, tokensIn: 40, tokensOut: 60, at: A('2026-10-19T08:00:00') })
    await insertUsage(t.db, { provider: 'anthropic', batchId: B0, costSen: 300, at: A('2026-09-30T23:59:00') })
  })
  afterAll(async () => {
    await t?.close()
  })

  async function cost(query = ''): Promise<IntakeCost> {
    const res = await getAs(admin, `/intake/dashboard/cost${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    return IntakeCostSchema.parse(res.body.data)
  }

  it('October, all providers: totals, by provider (mock labelled and 0), by batch', async () => {
    const c = await cost()
    expect(c.month).toBe('2026-10')
    expect(c.provider).toBeNull()
    expect(c.total).toEqual({ calls: 4, costSen: 250, pages: 9, tokensIn: 1360, tokensOut: 670 })
    expect(c.byProvider).toEqual([
      { provider: 'anthropic', calls: 2, costSen: 170, pages: 4, tokensIn: 1040, tokensOut: 560 },
      { provider: 'openai-compatible', calls: 1, costSen: 80, pages: 3, tokensIn: 300, tokensOut: 100 },
      { provider: 'mock', calls: 1, costSen: 0, pages: 2, tokensIn: 20, tokensOut: 10 },
    ])
    expect(c.byBatch).toEqual([
      { batchId: B1, calls: 2, costSen: 120, pages: 6, tokensIn: 1020, tokensOut: 510 },
      { batchId: B2, calls: 1, costSen: 80, pages: 3, tokensIn: 300, tokensOut: 100 },
      { batchId: null, calls: 1, costSen: 50, pages: 0, tokensIn: 40, tokensOut: 60 },
    ])
    expect(c.byBatchTruncated).toBe(false)
    expect(c.sources).toEqual({ usage: true, settings: true })
  })

  it('by day: every Malaysia day of October, 10-01 120, 10-02 80 (mock 0 + 23:59 row), 10-19 50', async () => {
    const c = await cost('?month=2026-10')
    expect(c.byDay).toHaveLength(31)
    expect(c.byDay[0]).toEqual({ day: '2026-10-01', calls: 1, costSen: 120 })
    expect(c.byDay[1]).toEqual({ day: '2026-10-02', calls: 2, costSen: 80 })
    expect(c.byDay[18]).toEqual({ day: '2026-10-19', calls: 1, costSen: 50 })
    expect(c.byDay.filter((d) => d.calls > 0)).toHaveLength(3)
    expect(c.byDay.reduce((s, d) => s + d.costSen, 0)).toBe(c.total.costSen)
  })

  it('provider filter (AC3): anthropic only; mock only is 0; the budget block is never filtered', async () => {
    const real = await cost('?provider=anthropic')
    expect(real.provider).toBe('anthropic')
    expect(real.total).toMatchObject({ calls: 2, costSen: 170 })
    expect(real.byProvider.map((p) => p.provider)).toEqual(['anthropic'])
    expect(real.byBatch.map((b) => [b.batchId, b.costSen])).toEqual([
      [B1, 120],
      [null, 50],
    ])
    expect(real.budget.costSen).toBe(250)

    const mock = await cost('?provider=mock')
    expect(mock.total).toEqual({ calls: 1, costSen: 0, pages: 2, tokensIn: 20, tokensOut: 10 })
    expect(mock.budget.costSen).toBe(250)

    const compat = await cost('?provider=openai-compatible')
    expect(compat.total).toMatchObject({ calls: 1, costSen: 80 })
  })

  it('budget (AC5): 250 of the env cap 1000 = 25.0 % ok; an ai_settings override of 300 = 83.3 % warning', async () => {
    expect((await cost()).budget).toEqual({
      costSen: 250,
      budgetSen: 1000,
      budgetSource: 'env',
      remainingSen: 750,
      percentUsed: 25,
      budgetState: 'ok',
      warnReached: false,
      capReached: false,
    })
    try {
      await setBudget(t.db, 300)
      expect((await cost()).budget).toMatchObject({ budgetSen: 300, budgetSource: 'settings', percentUsed: 83.3, budgetState: 'warning', warnReached: true })
    } finally {
      await setBudget(t.db, null)
    }
  })

  it('September (AC2): only the 09-30 23:59 row, 300 sen = 30.0 %', async () => {
    const c = await cost('?month=2026-09')
    expect(c.from).toBe('2026-09-01T00:00:00.000+08:00')
    expect(c.to).toBe('2026-10-01T00:00:00.000+08:00')
    expect(c.byDay).toHaveLength(30)
    expect(c.byDay[29]).toEqual({ day: '2026-09-30', calls: 1, costSen: 300 })
    expect(c.total.costSen).toBe(300)
    expect(c.budget).toMatchObject({ costSen: 300, percentUsed: 30, budgetState: 'ok' })
  })

  it('422 on an unknown provider or a malformed month', async () => {
    for (const q of ['?provider=chatgpt', '?provider=openai_compatible', '?month=2026-00']) {
      const res = await getAs(admin, `/intake/dashboard/cost${q}`)
      expect(res.status, q).toBe(422)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('VALIDATION_ERROR')
    }
  })
})
