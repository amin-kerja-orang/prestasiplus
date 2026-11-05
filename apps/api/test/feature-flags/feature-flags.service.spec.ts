import { ErrorBodySchema } from '@pp/contract'
import { describe, expect, it, vi } from 'vitest'

import { AUDIT_ACTIONS } from '../../src/common/audit/audit-actions'
import { ApiError } from '../../src/common/errors/api-error'
import { FeatureFlagsController } from '../../src/common/feature-flags/feature-flags.controller'
import { FEATURE_CACHE_TTL_MS, FeatureFlagsService, type FeatureActor } from '../../src/common/feature-flags/feature-flags.service'
import { FixedClock } from '../../src/db/clock'

/** S0-T10: the flag service and controller on an in-memory table (no database). The SQL side is in feature-flags.http.spec.ts. */
interface Row {
  key: string
  labelMs: string
  audience: string
  enabled: boolean
  locked: boolean
  sortOrder: number
  updatedBy?: bigint | null
}

const SEED = (): Row[] => [
  { key: 'latih-tubi', labelMs: 'Latih Tubi', audience: 'pelajar', enabled: true, locked: false, sortOrder: 200 },
  { key: 'permainan', labelMs: 'Zona Permainan', audience: 'pelajar', enabled: true, locked: false, sortOrder: 10 },
  { key: 'keluarga-angkat', labelMs: 'Mohon Keluarga Angkat', audience: 'pelajar', enabled: false, locked: true, sortOrder: 910 },
  { key: 'cikgu-alesa', labelMs: 'Cikgu Alesa', audience: 'pelajar', enabled: false, locked: true, sortOrder: 900 },
]

const ACTOR: FeatureActor = { userId: '7', role: 'admin', requestId: 'req-1', ip: '10.0.0.1', isTest: false }

function build(rows: Row[] = SEED()) {
  const findMany = vi.fn(async (args?: { orderBy?: unknown }) => {
    const out = rows.map((r) => ({ ...r }))
    return args?.orderBy ? out.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)) : out
  })
  const featureFlag = {
    findMany,
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
      const row = rows.find((r) => r.key === where.key)
      return row ? { ...row } : null
    }),
    update: vi.fn(async ({ where, data }: { where: { key: string }; data: Partial<Row> }) => {
      const row = rows.find((r) => r.key === where.key)!
      Object.assign(row, data)
      return { ...row }
    }),
  }
  const prisma = { client: { featureFlag }, transaction: async <T>(fn: (tx: { featureFlag: typeof featureFlag }) => Promise<T>) => fn({ featureFlag }) }
  const record = vi.fn(async () => undefined)
  const clock = new FixedClock('2026-11-05T08:00:00Z')
  const service = new FeatureFlagsService(prisma as never, { record } as never, clock)
  return { rows, service, featureFlag, findMany, record, clock, controller: new FeatureFlagsController(service) }
}

describe('FeatureFlagsController (API-ADM-09)', () => {
  it('GET lists every toggle ordered by sort_order in the contract shape', async () => {
    const { controller } = build()
    const res = await controller.list()
    expect(res.data.map((t) => t.key)).toEqual(['permainan', 'latih-tubi', 'cikgu-alesa', 'keluarga-angkat'])
    expect(res.data[0]).toEqual({ key: 'permainan', labelMs: 'Zona Permainan', audience: 'pelajar', enabled: true, locked: false })
    expect(res.data[2]).toEqual({ key: 'cikgu-alesa', labelMs: 'Cikgu Alesa', audience: 'pelajar', enabled: false, locked: true })
  })

  it('PUT switches a toggle off and on and answers { data }', async () => {
    const { controller } = build()
    expect(await controller.toggle(ACTOR, 'permainan', { enabled: false })).toEqual({
      data: { key: 'permainan', labelMs: 'Zona Permainan', audience: 'pelajar', enabled: false, locked: false },
    })
    expect((await controller.toggle(ACTOR, 'permainan', { enabled: true })).data.enabled).toBe(true)
  })

  it('PUT {enabled:true} on a locked key is 409 CONFLICT and changes nothing', async () => {
    const { controller, rows, record } = build()
    const err = await controller.toggle(ACTOR, 'cikgu-alesa', { enabled: true }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('CONFLICT')
    expect((err as ApiError).getStatus()).toBe(409)
    expect((err as ApiError).message).toBe('Ciri ini dikunci dan tidak boleh diaktifkan.')
    expect(rows.find((r) => r.key === 'cikgu-alesa')!.enabled).toBe(false)
    expect(record).not.toHaveBeenCalled()
  })

  it('PUT {enabled:false} on a locked key is accepted (idempotent, not audited)', async () => {
    const { controller, record } = build()
    expect((await controller.toggle(ACTOR, 'keluarga-angkat', { enabled: false })).data).toMatchObject({ enabled: false, locked: true })
    expect(record).not.toHaveBeenCalled()
  })

  it('PUT on an unknown key is 404 NOT_FOUND', async () => {
    const { controller } = build()
    const err = (await controller.toggle(ACTOR, 'tiada', { enabled: true }).catch((e: unknown) => e)) as ApiError
    expect(err.code).toBe('NOT_FOUND')
    expect(err.getStatus()).toBe(404)
  })

  it('error bodies fit the standard envelope', () => {
    expect(ErrorBodySchema.safeParse({ error: { code: 'CONFLICT', message: 'x', requestId: 'r' } }).success).toBe(true)
  })
})

describe('FeatureFlagsService audit', () => {
  it('each PUT writes one audit_events row with actor, key, old and new', async () => {
    const { service, record, featureFlag } = build()
    await service.setEnabled(ACTOR, 'permainan', false)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.FEATURE_FLAG_TOGGLED,
        actorUserId: '7',
        actorRole: 'admin',
        requestId: 'req-1',
        targetType: 'feature_flag',
        details: { key: 'permainan', old: true, new: false },
        tx: expect.anything(),
      }),
    )
    expect(featureFlag.update).toHaveBeenCalledWith({ where: { key: 'permainan' }, data: { enabled: false, updatedBy: 7n } })
  })

  it('a PUT that sets the value already stored is a no-op: no update, no audit row', async () => {
    const { service, record, featureFlag } = build()
    expect((await service.setEnabled(ACTOR, 'latih-tubi', true)).enabled).toBe(true)
    expect((await service.setEnabled(ACTOR, 'cikgu-alesa', false)).enabled).toBe(false) // locked and already OFF
    expect(featureFlag.update).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
  })
})

describe('FeatureFlagsService reads (cache, fail-open)', () => {
  it('a key with no row is ON; a locked key is OFF whatever enabled says', async () => {
    const { service, rows } = build()
    expect(await service.isEnabled('misi-harian')).toBe(true)
    expect(await service.isEnabled('permainan')).toBe(true)
    expect(await service.isEnabled('cikgu-alesa')).toBe(false)
    rows.find((r) => r.key === 'cikgu-alesa')!.enabled = true // corrupt row that the CHECK would refuse
    service.invalidate()
    expect(await service.isEnabled('cikgu-alesa')).toBe(false)
  })

  it('featureMap lists every stored key with its effective state', async () => {
    const { service } = build()
    expect(await service.featureMap()).toEqual({ permainan: true, 'latih-tubi': true, 'cikgu-alesa': false, 'keluarga-angkat': false })
  })

  it('reads once per 5 s: a direct DB change shows after the TTL, not before', async () => {
    const { service, rows, findMany, clock } = build()
    expect(await service.isEnabled('permainan')).toBe(true)
    rows.find((r) => r.key === 'permainan')!.enabled = false
    expect(await service.isEnabled('permainan')).toBe(true)
    expect(findMany).toHaveBeenCalledTimes(1)
    clock.advance(FEATURE_CACHE_TTL_MS - 1)
    expect(await service.isEnabled('permainan')).toBe(true)
    clock.advance(1)
    expect(await service.isEnabled('permainan')).toBe(false)
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('a PUT invalidates the cache at once', async () => {
    const { service } = build()
    expect(await service.isEnabled('permainan')).toBe(true)
    await service.setEnabled(ACTOR, 'permainan', false)
    expect(await service.isEnabled('permainan')).toBe(false)
  })

  it('when the table cannot be read the last map stays in use, and with none every key is ON (fail-open)', async () => {
    const { service, findMany, clock } = build()
    expect(await service.isEnabled('permainan')).toBe(true)
    findMany.mockRejectedValue(new Error('db down'))
    clock.advance(FEATURE_CACHE_TTL_MS + 1)
    expect(await service.isEnabled('cikgu-alesa')).toBe(false)
    const cold = build()
    cold.findMany.mockRejectedValue(new Error('db down'))
    expect(await cold.service.isEnabled('cikgu-alesa')).toBe(true)
  })
})
