// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SoloBetulSalahPage from '../../pages/SoloBetulSalahPage.vue'
import SoloCabaranKilatPage from '../../pages/SoloCabaranKilatPage.vue'
import SoloKadMemoriPage from '../../pages/SoloKadMemoriPage.vue'
import SoloSusunJawapanPage from '../../pages/SoloSusunJawapanPage.vue'
import SoloTembakJawapanPage from '../../pages/SoloTembakJawapanPage.vue'
import { betulSalahPayload, memoriPayload, mountAt } from './helpers'

const fetchSoloGame = vi.hoisted(() => vi.fn())
const submitSoloGame = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  fetchSoloGame,
  submitSoloGame,
}))

let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.useFakeTimers()
  fetchSoloGame.mockReset()
  submitSoloGame.mockReset()
  fetchSoloGame.mockImplementation(() => Promise.resolve(betulSalahPayload()))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const games = [
  { name: 'betul-salah', page: SoloBetulSalahPage },
  { name: 'cabaran-kilat', page: SoloCabaranKilatPage },
  { name: 'tembak-jawapan', page: SoloTembakJawapanPage },
  { name: 'susun-jawapan', page: SoloSusunJawapanPage },
  { name: 'kad-memori', page: SoloKadMemoriPage },
]

describe('D58 stopgap: solo games in http mode', () => {
  describe.each(games)('$name', ({ name, page }) => {
    it('shows the unavailable state and makes no api call in http mode', async () => {
      vi.stubEnv('VITE_API_MODE', 'http')
      wrapper = await mountAt(page, `/permainan/${name}?darjah=1`)
      expect(wrapper.find('[data-testid="solo-unavailable"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Fungsi ini belum tersedia dalam demo')
      expect(wrapper.find('[data-testid="darjah-picker"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="solo-card-item"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="solo-start"]').exists()).toBe(false)
      expect(fetchSoloGame).not.toHaveBeenCalled()
      expect(submitSoloGame).not.toHaveBeenCalled()
    })

    it('renders the game as before in mock mode', async () => {
      fetchSoloGame.mockImplementation(() => Promise.resolve(name === 'kad-memori' ? memoriPayload() : betulSalahPayload()))
      wrapper = await mountAt(page, `/permainan/${name}`)
      expect(wrapper.find('[data-testid="solo-unavailable"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Fungsi ini belum tersedia dalam demo')
      const pickerOrCards =
        wrapper.find('[data-testid="darjah-picker"]').exists() ||
        wrapper.find('[data-testid="solo-card-item"]').exists()
      expect(pickerOrCards).toBe(true)
    })
  })
})
