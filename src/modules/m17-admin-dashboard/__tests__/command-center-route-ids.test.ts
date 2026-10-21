import { describe, expect, it, vi } from 'vitest'

const mode = vi.hoisted(() => ({ http: false }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

import { commandCenterDrillRoutes } from '../routes/command-center'

const props = () => {
  const r = commandCenterDrillRoutes({ prefix: '/admin/command-center', namePrefix: 'x', roles: ['admin'] })
  const fn = r[0]!.props as (route: unknown) => Record<string, unknown>
  return fn({ params: { schoolId: '1042' } })
}

describe('drill route ids', () => {
  it('keeps numbers in mock mode', () => {
    mode.http = false
    expect(props().schoolId).toBe(1042)
  })
  it('keeps strings in http mode', () => {
    mode.http = true
    expect(props().schoolId).toBe('1042')
  })
})
