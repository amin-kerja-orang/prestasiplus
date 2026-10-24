// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { GamesHub } from '../../api'
import PermainanPage from '../../pages/PermainanPage.vue'

const fetchGamesHub = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', () => ({ fetchGamesHub }))

const hub = (over: Partial<GamesHub> = {}): GamesHub => ({
  openRooms: [],
  chips: { papanBijakPlayed: false, battled: false },
  ...over,
})

let wrapper: VueWrapper | undefined

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/permainan', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/permainan')
  await router.isReady()
  wrapper = mount(PermainanPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  fetchGamesHub.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S6 hub page', () => {
  it('shows the loading state until the first response, then the hero', async () => {
    let resolve!: (v: GamesHub) => void
    fetchGamesHub.mockReturnValueOnce(new Promise<GamesHub>((r) => (resolve = r)))
    await mountPage()
    expect(wrapper!.find('[data-testid="hub-loading"]').exists()).toBe(true)
    resolve(hub())
    await flushPromises()
    expect(wrapper!.find('[data-testid="hub-loading"]').exists()).toBe(false)
    expect(wrapper!.get('[data-testid="hub-h1"]').text()).toBe('🎮 Zona Permainan')
    expect(wrapper!.text()).toContain(
      'Main sambil belajar! Kumpul Syiling, naik kedudukan, dan jadi champion sekolah. Pilih permainan kegemaran kamu.',
    )
  })

  it('renders the 18 cards in order with one button link each', async () => {
    fetchGamesHub.mockResolvedValueOnce(hub())
    await mountPage()
    const titles = wrapper!.findAll('h3').map((h) => h.text())
    expect(titles).toHaveLength(18)
    expect(titles[0]).toBe('Papan Bijak')
    expect(titles[10]).toBe('Peta Pengembaraan')
    expect(titles[17]).toBe('Kad Memori')
    expect(wrapper!.findAll('[data-testid="hub-card-button"]')).toHaveLength(18)
    const hrefs = wrapper!
      .findAll('a[data-testid="hub-card-button"]')
      .map((a) => a.attributes('href'))
    expect(hrefs[1]).toBe('/battle')
    expect(hrefs[10]).toBe('/peta-belajar')
  })

  it('shows the empty strip as live and no room chip', async () => {
    fetchGamesHub.mockResolvedValueOnce(hub())
    await mountPage()
    const strip = wrapper!.get('[data-testid="hub-open-rooms-empty"]').text()
    expect(strip).toContain('🌙')
    expect(strip).toContain('Tiada bilik terbuka buat masa ini.')
    expect(strip).toContain('Cipta bilik permainan dan jemput rakan-rakan!')
    expect(wrapper!.findAll('[data-testid="hub-open-room"]')).toHaveLength(0)
  })

  it('shows one chip per open room linking to the room', async () => {
    fetchGamesHub.mockResolvedValueOnce(
      hub({
        openRooms: [{ game: 'papan-bijak', code: 'PB1234', host: 'Host Demo', players: 1, max: 4 }],
      }),
    )
    await mountPage()
    const chip = wrapper!.get('[data-testid="hub-open-room"]')
    expect(chip.attributes('href')).toBe('/papan-bijak/PB1234')
    expect(chip.text()).toContain('Papan Bijak')
    expect(chip.text()).toContain('PB1234')
    expect(chip.text()).toContain('1/4')
  })

  it('shows the "Belum" chips only while the viewer has not played / battled (DV-M16-14)', async () => {
    fetchGamesHub.mockResolvedValueOnce(hub())
    await mountPage()
    expect(wrapper!.get('[data-testid="hub-card-papan-bijak"]').text()).toContain(
      '🆕 Belum main lagi',
    )
    expect(wrapper!.get('[data-testid="hub-card-battle"]').text()).toContain('🆕 Belum battle lagi')
    wrapper!.unmount()

    fetchGamesHub.mockResolvedValueOnce(hub({ chips: { papanBijakPlayed: true, battled: false } }))
    await mountPage()
    expect(wrapper!.get('[data-testid="hub-card-papan-bijak"]').text()).not.toContain(
      'Belum main lagi',
    )
    expect(wrapper!.get('[data-testid="hub-card-battle"]').text()).toContain('Belum battle lagi')
    wrapper!.unmount()

    fetchGamesHub.mockResolvedValueOnce(hub({ chips: { papanBijakPlayed: false, battled: true } }))
    await mountPage()
    expect(wrapper!.get('[data-testid="hub-card-papan-bijak"]').text()).toContain('Belum main lagi')
    expect(wrapper!.get('[data-testid="hub-card-battle"]').text()).not.toContain(
      'Belum battle lagi',
    )
  })

  it('navigates once from the card body and once from the button', async () => {
    fetchGamesHub.mockResolvedValueOnce(hub())
    const { router } = await mountPage()
    const push = vi.spyOn(router, 'push')
    await wrapper!.get('[data-testid="hub-card-kuiz-relay"] p').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.fullPath).toBe('/kuiz-relay')

    await router.push('/permainan')
    push.mockClear()
    await wrapper!.get('[data-testid="hub-card-benteng-ilmu"] a').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledTimes(1) // the RouterLink only; the card handler leaves link clicks alone
    expect(router.currentRoute.value.fullPath).toBe('/benteng-ilmu')
  })

  it('shows the load error when the request fails', async () => {
    fetchGamesHub.mockRejectedValueOnce(new Error('boom'))
    await mountPage()
    expect(wrapper!.get('[data-testid="hub-error"]').text()).toContain('Maaf, berlaku ralat.')
    expect(wrapper!.find('[data-testid="hub-grid"]').exists()).toBe(false)
  })
})
