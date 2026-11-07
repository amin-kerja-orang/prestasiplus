/**
 * FR-GM-00.1, FR-MUR-21-1, AC-MUR-21-1, #497 ruling 14: Pertandingan, Uji Minda and Sambung Kata have no route record and
 * no hub card in R1, so each path falls to the catch-all 404 and no page answers with a 500.
 */
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildRoutes } from '@/app/router'

import { HUB_CARDS, HUB_THEME } from '../../components/hub/hub-cards'
import { HUB_ART } from '../../components/hub/hub-art'
import routes from '../../routes/permainan-extra'

const OFF = [
  ['pertandingan', '/permainan/pertandingan'],
  ['uji-minda', '/permainan/uji-minda'],
  ['sambung-kata', '/permainan/sambung-kata'],
] as const

describe('pages off in R1', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

  it('the route fragment has no record', () => {
    expect(routes).toEqual([])
  })

  it.each(OFF)('%s falls to the catch-all 404', (_id, path) => {
    expect(router.resolve(path).name).toBe('core.not-found')
  })

  it.each(OFF)('%s has no hub card and no card art', (id, path) => {
    expect(HUB_CARDS.some((c) => c.id === id || c.to === path)).toBe(false)
    expect(HUB_THEME[id]).toBeUndefined()
    expect(HUB_ART[id]).toBeUndefined()
  })

  it('Peta Pengembaraan stays as a link (ruling 14)', () => {
    expect(HUB_CARDS.find((c) => c.id === 'peta-pengembaraan')?.to).toBe('/peta-belajar')
  })
})
