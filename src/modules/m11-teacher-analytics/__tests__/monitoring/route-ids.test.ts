/**
 * M11 monitoring route props (SWZ S11-5): in http mode the API ids are strings (contract `IdSchema =
 * z.string()`, never parsed) and reach the page props as-is; mock mode keeps numbers.
 */
import { describe, expect, it, vi } from 'vitest'

const mode = vi.hoisted(() => ({ http: false }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

import { monitoringRoutes } from '../../routes/monitoring'

type PropsFn = (route: unknown) => Record<string, unknown>

const routes = monitoringRoutes({
  name: 'x-monitoring',
  prefix: '/guru/monitoring',
  layout: 'admin',
  roles: ['teacher'],
})
const propsOf = (name: string, params: Record<string, string>) => {
  const route = routes.find((r) => r.name === name)
  return (route?.props as PropsFn)({ params })
}
const params = { schoolId: '1042', userId: '77' }

describe('monitoring route ids', () => {
  it('keeps numbers in mock mode (school, student and teacher routes)', () => {
    mode.http = false
    expect(propsOf('x-monitoring-sekolah', params)).toMatchObject({ schoolId: 1042 })
    expect(propsOf('x-monitoring-pelajar', params)).toMatchObject({ schoolId: 1042, userId: 77 })
    expect(propsOf('x-monitoring-guru', params)).toMatchObject({ schoolId: 1042, userId: 77 })
  })

  it('passes string ids through in http mode (school, student and teacher routes)', () => {
    mode.http = true
    expect(propsOf('x-monitoring-sekolah', params)).toMatchObject({ schoolId: '1042' })
    expect(propsOf('x-monitoring-pelajar', params)).toMatchObject({
      schoolId: '1042',
      userId: '77',
    })
    expect(propsOf('x-monitoring-guru', params)).toMatchObject({ schoolId: '1042', userId: '77' })
  })

  it('does not strip a leading zero from a string id in http mode', () => {
    mode.http = true
    expect(propsOf('x-monitoring-sekolah', { schoolId: '0042' })).toMatchObject({
      schoolId: '0042',
    })
  })
})
