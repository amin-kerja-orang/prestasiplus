import { describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_MS, MINUTE_MS } from '@/lib/time'

import type { MockRequest } from '../../server/types'
import { coreRoutes } from '../routes'
import { serverStatusRoute } from '../server-status'
import { SERVER_STATUS_STEP_MS, serverStatusAt, serverStatusGuard } from '../server-status'

const req = (role: string | null) =>
  ({ session: role ? { userId: 1, role } : null }) as unknown as MockRequest

describe('GET /api/admin/server-status (mock)', () => {
  it('is registered with the core routes', () => {
    expect(
      coreRoutes.some((r) => r.method === 'GET' && r.pattern === '/api/admin/server-status'),
    ).toBe(true)
  })

  it('answers the overview §10 contract plus the inferred disk GB fields', () => {
    const s = serverStatusAt(CLOCK_ANCHOR_MS)
    expect(Object.keys(s).sort()).toEqual(
      [
        'cores',
        'cpuPct',
        'diskPct',
        'diskTotalGb',
        'diskUsedGb',
        'load',
        'ramPct',
        'ramTotalGb',
        'ramUsedGb',
        'uptime',
      ].sort(),
    )
    expect(s.uptime).toMatch(/^\d+d \d+h$/)
    expect(s.cores).toBe(8)
  })

  it('is deterministic and steps every 30 s through ok, warn and bad readings', () => {
    const at = (n: number) =>
      serverStatusAt(
        Math.floor(CLOCK_ANCHOR_MS / SERVER_STATUS_STEP_MS) * SERVER_STATUS_STEP_MS +
          n * SERVER_STATUS_STEP_MS,
      )
    expect(serverStatusAt(CLOCK_ANCHOR_MS)).toEqual(serverStatusAt(CLOCK_ANCHOR_MS))
    const cpu = [0, 1, 2, 3].map((n) => at(n).cpuPct)
    expect(Math.max(...cpu)).toBeGreaterThan(80)
    expect(cpu.some((v) => v > 50 && v <= 80)).toBe(true)
    expect(Math.min(...cpu)).toBeLessThanOrEqual(50)
    const disk = [0, 1, 2, 3].map((n) => at(n).diskPct)
    expect(Math.max(...disk)).toBeGreaterThan(90)
  })

  it('admin only: 401 without a session, 403 for every other role', () => {
    expect(serverStatusGuard(req(null), {} as never)?.status).toBe(401)
    for (const role of [
      'student',
      'teacher',
      'school_admin',
      'parent',
      'sponsor',
      'ppd_officer',
      'jpn_officer',
    ]) {
      expect(serverStatusGuard(req(role), {} as never)?.status, role).toBe(403)
    }
    expect(serverStatusGuard(req('admin'), {} as never)).toBeUndefined()
  })

  it('the first sample is the observed live reading (disk 199.3GB / 398.7GB)', () => {
    const first = [0, 1, 2, 3]
      .map((n) => serverStatusAt(CLOCK_ANCHOR_MS + n * SERVER_STATUS_STEP_MS))
      .find((r) => r.cpuPct === 6)
    expect(first).toMatchObject({
      cpuPct: 6,
      ramPct: 52,
      diskPct: 50,
      diskUsedGb: 199.3,
      diskTotalGb: 398.7,
      ramUsedGb: 16.2,
      ramTotalGb: 31.1,
      cores: 8,
      load: 0.15,
      uptime: expect.stringMatching(/^204d /),
    })
  })

  it('the data differs between two clock times and uptime grows with the clock', () => {
    const a = serverStatusAt(CLOCK_ANCHOR_MS)
    const b = serverStatusAt(CLOCK_ANCHOR_MS + SERVER_STATUS_STEP_MS)
    expect(b).not.toEqual(a)
    expect(serverStatusAt(CLOCK_ANCHOR_MS + 30 * 60 * MINUTE_MS).uptime).not.toBe(a.uptime)
  })

  it('the route handler answers 200 with the ok() envelope {data}', async () => {
    const res = await serverStatusRoute.handler(req('admin'), {} as never)
    expect(res.status).toBe(200)
    const body = res.body as { data: ReturnType<typeof serverStatusAt> }
    expect(Object.keys(body)).toContain('data')
    expect(body.data).toMatchObject({ cores: 8, diskTotalGb: 398.7 })
    expect(typeof body.data.uptime).toBe('string')
  })
})
