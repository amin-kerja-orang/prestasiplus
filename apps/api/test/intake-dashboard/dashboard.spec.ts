import { ErrorBodySchema, IntakeCostSchema, IntakeDashboardSchema, type IntakeDashboard } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { LoggedIn } from '../auth/helpers'
import {
  ADMIN,
  bootDashApp,
  createStores,
  getAs,
  insertBatch,
  insertDuplicate,
  insertEvent,
  insertItem,
  insertUsage,
  login,
  SCHOOL_ADMIN,
  setBudget,
  STUDENT,
  TEACHER,
  type DashTestApp,
} from './helpers'

/**
 * Card BE-40 AC1, AC2, AC4, AC5 for GET /intake/dashboard. Clock: 2026-10-19T09:00+08:00 (START).
 *
 * Fixture (all times +08:00; "T" = an is_test batch, excluded everywhere):
 *  Batches, October: B1 ready_for_review 10-01 00:01 (boundary), B2 ready_for_review 10-05, B3 ready_for_review 10-10,
 *    B4 failed 10-12, B5 processing 10-18 09:00, B6 submitted 10-19 08:00, B7 cancelled 10-03.
 *  Batches, September: B0 failed 09-30 23:59 (boundary), B00 submitted 09-20 10:00. T: ready_for_review 10-02.
 *  Items of B1: I1 accepted (created 10-01 00:30, accepted 10-02, edited tag.unit), I2 accepted (10-02, accepted 10-03,
 *    edited tag.sp[0] and stem), I3 accepted (10-02, accepted 10-04, edited tag.levelNote = not a tag field, confirmed tag.subject
 *    = not an edit), I4 accepted (10-03, accepted 10-04, edited tag.unit and tag.tp).
 *  Items of B2: I5 needs_review 10-06 10:00, I6 generated 10-07, I7 duplicate 10-07, I8 rejected 10-08 with an exact pending
 *    finding, I9 generated 10-08 with a variant finding, I10 rejected 10-08 with a near finding dismissed (not_duplicate).
 *  Items of B0: I11 accepted (09-30 23:00, accepted 09-30 23:59), I12 accepted (09-29, accepted 10-01 00:01, edited tag.subject).
 *  Items of T: generated, accepted in October (edited nothing), duplicate.
 */

const A = (local: string) => `${local}+08:00`

describe('GET /intake/dashboard with every store present', () => {
  let t: DashTestApp
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootDashApp({ AI_MONTHLY_BUDGET_SEN: '300' })
    admin = await login(t, ADMIN)
    const db = t.db
    await createStores(db)
    const B1 = await insertBatch(db, 'ready_for_review', A('2026-10-01T00:01:00'))
    const B2 = await insertBatch(db, 'ready_for_review', A('2026-10-05T10:00:00'))
    await insertBatch(db, 'ready_for_review', A('2026-10-10T10:00:00'))
    await insertBatch(db, 'failed', A('2026-10-12T10:00:00'))
    await insertBatch(db, 'processing', A('2026-10-18T09:00:00'))
    await insertBatch(db, 'submitted', A('2026-10-19T08:00:00'))
    await insertBatch(db, 'cancelled', A('2026-10-03T10:00:00'))
    const B0 = await insertBatch(db, 'failed', A('2026-09-30T23:59:00'))
    await insertBatch(db, 'submitted', A('2026-09-20T10:00:00'))
    const T = await insertBatch(db, 'ready_for_review', A('2026-10-02T10:00:00'), true)

    const I1 = await insertItem(db, B1, 'accepted', A('2026-10-01T00:30:00'))
    await insertEvent(db, I1, 'edited', A('2026-10-01T12:00:00'), 'tag.unit')
    await insertEvent(db, I1, 'accepted', A('2026-10-02T12:00:00'))
    const I2 = await insertItem(db, B1, 'accepted', A('2026-10-02T09:00:00'))
    await insertEvent(db, I2, 'edited', A('2026-10-02T10:00:00'), 'tag.sp[0]')
    await insertEvent(db, I2, 'edited', A('2026-10-02T10:01:00'), 'stem')
    await insertEvent(db, I2, 'accepted', A('2026-10-03T12:00:00'))
    const I3 = await insertItem(db, B1, 'accepted', A('2026-10-02T09:30:00'))
    await insertEvent(db, I3, 'edited', A('2026-10-03T10:00:00'), 'tag.levelNote')
    await insertEvent(db, I3, 'confirmed', A('2026-10-03T10:01:00'), 'tag.subject')
    await insertEvent(db, I3, 'accepted', A('2026-10-04T12:00:00'))
    const I4 = await insertItem(db, B1, 'accepted', A('2026-10-03T09:00:00'))
    await insertEvent(db, I4, 'field_edited', A('2026-10-03T10:00:00'), 'tag.unit')
    await insertEvent(db, I4, 'edited', A('2026-10-03T10:01:00'), 'tag.tp')
    await insertEvent(db, I4, 'accepted', A('2026-10-04T13:00:00'))

    await insertItem(db, B2, 'needs_review', A('2026-10-06T10:00:00'))
    await insertItem(db, B2, 'generated', A('2026-10-07T10:00:00'))
    await insertItem(db, B2, 'duplicate', A('2026-10-07T11:00:00'))
    const I8 = await insertItem(db, B2, 'rejected', A('2026-10-08T10:00:00'))
    await insertDuplicate(db, I8, 'exact')
    const I9 = await insertItem(db, B2, 'generated', A('2026-10-08T11:00:00'))
    await insertDuplicate(db, I9, 'variant')
    const I10 = await insertItem(db, B2, 'rejected', A('2026-10-08T12:00:00'))
    await insertDuplicate(db, I10, 'near', 'not_duplicate')

    const I11 = await insertItem(db, B0, 'accepted', A('2026-09-30T23:00:00'))
    await insertEvent(db, I11, 'accepted', A('2026-09-30T23:59:00'))
    const I12 = await insertItem(db, B0, 'accepted', A('2026-09-29T10:00:00'))
    await insertEvent(db, I12, 'edited', A('2026-09-29T11:00:00'), 'tag.subject')
    await insertEvent(db, I12, 'edited', A('2026-09-29T11:30:00'), 'tag') // the whole tag object: every field changed
    await insertEvent(db, I12, 'accepted', A('2026-10-01T00:01:00'))

    await insertItem(db, T, 'generated', A('2026-10-02T11:00:00'))
    const TI = await insertItem(db, T, 'accepted', A('2026-10-02T11:00:00'))
    await insertEvent(db, TI, 'accepted', A('2026-10-05T11:00:00'))
    await insertItem(db, T, 'duplicate', A('2026-10-02T11:00:00'))

    // Usage: October anthropic 120 (10-01 00:01) + mock logged 999 (forced 0) + openai_compatible 80 + anthropic 50; September 300.
    await insertUsage(db, { provider: 'anthropic', batchId: B1, costSen: 120, at: A('2026-10-01T00:01:00') })
    await insertUsage(db, { provider: 'mock', batchId: B1, costSen: 999, at: A('2026-10-02T12:00:00') })
    await insertUsage(db, { provider: 'openai_compatible', batchId: B2, costSen: 80, at: A('2026-10-02T23:59:00') })
    await insertUsage(db, { provider: 'anthropic', batchId: null, costSen: 50, at: A('2026-10-19T08:00:00') })
    await insertUsage(db, { provider: 'anthropic', batchId: B0, costSen: 300, at: A('2026-09-30T23:59:00') })
  })
  afterAll(async () => {
    await t?.close()
  })

  async function dash(query = ''): Promise<IntakeDashboard> {
    const res = await getAs(admin, `/intake/dashboard${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    return IntakeDashboardSchema.parse(res.body.data)
  }

  it('defaults to the current Malaysia month with the +08:00 window', async () => {
    const d = await dash()
    expect(d.month).toBe('2026-10')
    expect(d.from).toBe('2026-10-01T00:00:00.000+08:00')
    expect(d.to).toBe('2026-11-01T00:00:00.000+08:00')
    expect(d.generatedAt).toBe('2026-10-19T09:00:00.000+08:00')
    expect(d.sources).toEqual({ batches: true, items: true, duplicates: true, usage: true, settings: true })
  })

  it('submissions by status (October: 7; the test batch and the 09-30 23:59 batch are out)', async () => {
    const d = await dash('?month=2026-10')
    expect(d.submissions.byStatus).toEqual([
      { status: 'submitted', count: 1 },
      { status: 'processing', count: 1 },
      { status: 'ready_for_review', count: 3 },
      { status: 'failed', count: 1 },
      { status: 'cancelled', count: 1 },
    ])
    expect(d.submissions.total).toBe(7)
  })

  it('queue size and oldest item age (snapshot at 10-19 09:00: I5, I6, I7, I9; oldest I5 at 10-06 10:00)', async () => {
    const d = await dash()
    expect(d.queue.items).toBe(4)
    expect(d.queue.oldestItemAt).toBe('2026-10-06T10:00:00.000+08:00')
    expect(d.queue.oldestItemAgeSeconds).toBe(12 * 86_400 + 23 * 3_600) // 1 119 600 s
    expect(d.queue.pendingSubmissions).toBe(3) // B00, B5, B6
    expect(d.queue.oldestPendingSubmissionAt).toBe('2026-09-20T10:00:00.000+08:00')
  })

  it('the queue is the same snapshot whichever month is asked', async () => {
    const sept = await dash('?month=2026-09')
    expect(sept.queue).toEqual((await dash()).queue)
  })

  it('extraction success rate: 3 ready / (3 + 1 failed) = 75.0 %', async () => {
    expect((await dash()).extraction).toEqual({ succeeded: 3, failed: 1, successRate: 75 })
  })

  it('tags accepted unchanged per field (5 accepted in October: I1, I2, I3, I4, I12)', async () => {
    const d = await dash()
    expect(d.tagAcceptance.acceptedItems).toBe(5)
    expect(d.tagAcceptance.fields).toEqual([
      { field: 'subject', path: 'tag.subject', unchanged: 4, ratePercent: 80 }, // I12 edited
      { field: 'level', path: 'tag.level', unchanged: 4, ratePercent: 80 }, // I12 (whole tag); tag.levelNote is another field
      { field: 'chapter', path: 'tag.unit', unchanged: 2, ratePercent: 40 }, // I1, I4, I12 (whole tag)
      { field: 'dskpTopic', path: 'tag.sp', unchanged: 3, ratePercent: 60 }, // I2 edited tag.sp[0], I12 (whole tag)
      { field: 'difficulty', path: 'tag.tp', unchanged: 3, ratePercent: 60 }, // I4, I12 (whole tag)
    ])
  })

  it('duplicate rate: 10 items created in October, 2 duplicates (I7 Pendua, I8 exact) = 20.0 %', async () => {
    expect((await dash()).duplicates).toEqual({ items: 10, duplicates: 2, ratePercent: 20 })
  })

  it('AI cost this month: 120 + 0 (mock) + 80 + 50 = 250 sen of the env cap 300 = 83.3 %, warning', async () => {
    await setBudget(t.db, null)
    expect((await dash()).aiCost).toEqual({
      costSen: 250,
      budgetSen: 300,
      budgetSource: 'env',
      remainingSen: 50,
      percentUsed: 83.3,
      budgetState: 'warning',
      warnReached: true,
      capReached: false,
    })
  })

  it('the ai_settings override wins over the env cap (AC5): 312 -> 80.1 % warning, 313 -> 79.9 % ok, 250 -> 100 % exhausted', async () => {
    try {
      await setBudget(t.db, 312)
      expect((await dash()).aiCost).toMatchObject({ budgetSen: 312, budgetSource: 'settings', percentUsed: 80.1, budgetState: 'warning', warnReached: true, capReached: false })
      await setBudget(t.db, 313)
      expect((await dash()).aiCost).toMatchObject({ percentUsed: 79.9, budgetState: 'ok', warnReached: false, capReached: false })
      await setBudget(t.db, 250)
      expect((await dash()).aiCost).toMatchObject({ percentUsed: 100, remainingSen: 0, budgetState: 'exhausted', warnReached: true, capReached: true })
    } finally {
      await setBudget(t.db, null)
    }
  })

  it('September (AC2 boundaries): B0 at 09-30 23:59 and B00 count, I11 accepted at 09-30 23:59 counts, I12 (accepted 10-01 00:01) does not', async () => {
    const d = await dash('?month=2026-09')
    expect(d.from).toBe('2026-09-01T00:00:00.000+08:00')
    expect(d.submissions.byStatus.filter((r) => r.count > 0)).toEqual([
      { status: 'submitted', count: 1 },
      { status: 'failed', count: 1 },
    ])
    expect(d.extraction).toEqual({ succeeded: 0, failed: 1, successRate: 0 })
    expect(d.tagAcceptance.acceptedItems).toBe(1)
    expect(d.tagAcceptance.fields.every((f) => f.unchanged === 1 && f.ratePercent === 100)).toBe(true)
    expect(d.duplicates).toEqual({ items: 2, duplicates: 0, ratePercent: 0 })
    expect(d.aiCost).toMatchObject({ costSen: 300, budgetSen: 300, percentUsed: 100, budgetState: 'exhausted' })
  })

  it('a month with nothing: zero counts, null rates (never 0 %), cost 0', async () => {
    const d = await dash('?month=2025-01')
    expect(d.submissions.total).toBe(0)
    expect(d.extraction.successRate).toBeNull()
    expect(d.tagAcceptance.acceptedItems).toBe(0)
    expect(d.tagAcceptance.fields.map((f) => f.ratePercent)).toEqual([null, null, null, null, null])
    expect(d.duplicates).toEqual({ items: 0, duplicates: 0, ratePercent: null })
    expect(d.aiCost).toMatchObject({ costSen: 0, percentUsed: 0, budgetState: 'ok' })
  })

  it('422 on a malformed month; 401 without a session; 403 for Guru, Admin Sekolah and Murid (AC4)', async () => {
    for (const bad of ['2026-13', '2026-1', 'oktober']) {
      const res = await getAs(admin, `/intake/dashboard?month=${bad}`)
      expect(res.status, bad).toBe(422)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('VALIDATION_ERROR')
    }
    for (const path of ['/api/intake/dashboard', '/api/intake/dashboard/cost']) {
      const res = await t.http().get(path)
      expect(res.status, path).toBe(401)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('UNAUTHORIZED')
    }
    for (const who of [TEACHER, SCHOOL_ADMIN, STUDENT]) {
      const session = await login(t, who)
      for (const path of ['/intake/dashboard', '/intake/dashboard/cost']) {
        const res = await getAs(session, path)
        expect(res.status, `${who} ${path}`).toBe(403)
        expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
      }
    }
  })

  it('the cost endpoint parses on the same fixture (detail in cost.spec.ts)', async () => {
    const res = await getAs(admin, '/intake/dashboard/cost')
    expect(res.status).toBe(200)
    expect(IntakeCostSchema.parse(res.body.data).total.costSen).toBe(250)
  })
})
