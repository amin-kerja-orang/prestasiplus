// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setRouteOutcome } from '@/app/router/outcome'

import type { InterventionList } from '../../../api/types'
import KirkpatrickInterventionsPage from '../../../pages/KirkpatrickInterventionsPage.vue'
import { mountPage, select } from '../fixtures'

const api = vi.hoisted(() => ({
  fetchKirkpatrickInterventions: vi.fn(),
  createKirkpatrickIntervention: vi.fn(),
  reviewKirkpatrickIntervention: vi.fn(),
}))
vi.mock('../../../api', () => api)

const empty = (): InterventionList => ({ kpi: { total: 0, pending: 0, up: 0, down: 0 }, rows: [] })

let wrapper: VueWrapper | undefined

/** `basePath` is the mount prop; `urlPrefix` is the route path (defaults to the same mount). */
async function typeItems(prefix: string, role?: string, urlPrefix = prefix) {
  const m = await mountPage(
    KirkpatrickInterventionsPage,
    { basePath: prefix },
    `${urlPrefix}/interventions`,
    `${urlPrefix}/interventions`,
    null,
    role,
  )
  wrapper = m.wrapper
  return select(m.wrapper, 'alert_type').props('items')
}

beforeEach(() => {
  vi.clearAllMocks()
  setRouteOutcome(null)
  api.fetchKirkpatrickInterventions.mockResolvedValue(empty())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const THREE = [
  { value: 'mood', label: 'Mood / Kesejahteraan' },
  { value: 'inactive', label: 'Tidak Aktif' },
  { value: 'declining', label: 'Prestasi Menurun' },
]
const FOUR = [...THREE, { value: 'other', label: 'Lain-lain' }]

describe('S7 "Jenis Amaran" options by mount (C-57)', () => {
  it('offers the three V2 types on the Admin Pusat mount (no "Lain-lain")', async () => {
    expect(await typeItems('/admin/kirkpatrick')).toEqual(THREE)
  })

  it('keeps "Lain-lain" on the guru mount', async () => {
    expect(await typeItems('/guru/kirkpatrick')).toEqual(FOUR)
  })

  it('keeps "Lain-lain" on the school-admin mount', async () => {
    expect(await typeItems('/admin-sekolah/kirkpatrick', 'school_admin')).toEqual(FOUR)
  })

  it('follows the basePath prop, not the route path (guru basePath under an /admin route gives 4)', async () => {
    expect(await typeItems('/guru/kirkpatrick', undefined, '/admin/kirkpatrick')).toEqual(FOUR)
  })

  it('defaults the form to the admin set when the page gets no basePath', async () => {
    const m = await mountPage(
      KirkpatrickInterventionsPage,
      {},
      '/guru/kirkpatrick/interventions',
      '/guru/kirkpatrick/interventions',
    )
    wrapper = m.wrapper
    expect(select(m.wrapper, 'alert_type').props('items')).toEqual(THREE)
  })
})
