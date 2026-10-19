// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { TournamentBanner } from '../..'

const api = vi.hoisted(() => ({ fetchActiveTournaments: vi.fn() }))
vi.mock('../../api', () => api)

let wrapper: VueWrapper | undefined

async function mountBanner() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<i />' } }],
  })
  await router.push('/')
  await router.isReady()
  wrapper = mount(TournamentBanner, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const REG = {
  uuid: 'uuid-reg',
  title: 'Contoh Tournament Pendaftaran',
  status: 'registration',
  live_match: null,
}
const ONGOING = {
  uuid: 'uuid-on',
  title: 'Contoh Tournament Berlangsung',
  status: 'ongoing',
  live_match: null,
}
const LIVE = {
  uuid: 'uuid-live',
  title: 'Contoh Tournament LIVE',
  status: 'ongoing',
  live_match: { school_a: 'Sekolah A', school_b: 'Sekolah B' },
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchActiveTournaments.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('TournamentBanner (S30, FR-M16-08..11)', () => {
  it('is exported from the module entry and requests #1 exactly once on mount', async () => {
    await mountBanner()
    expect(api.fetchActiveTournaments).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for an empty list (the default seed)', async () => {
    const w = await mountBanner()
    expect(w.html()).toBe('<!--v-if-->')
    expect(w.text()).not.toContain('DAFTAR')
  })

  it('renders nothing when the request failed (the client returns [])', async () => {
    api.fetchActiveTournaments.mockResolvedValue([])
    const w = await mountBanner()
    expect(w.find('[data-testid="tournament-banner"]').exists()).toBe(false)
  })

  it('registration: "Pendaftaran dibuka" and the "DAFTAR" badge, linking to the detail', async () => {
    api.fetchActiveTournaments.mockResolvedValue([REG])
    const w = await mountBanner()
    const item = w.get('[data-testid="tournament-banner-item"]')
    expect(item.attributes('href')).toBe('/tournament/uuid-reg')
    expect(item.text()).toContain('Contoh Tournament Pendaftaran')
    expect(item.text()).toContain('Pendaftaran dibuka')
    expect(item.text()).toContain('DAFTAR')
  })

  it('ongoing: "Sedang berlangsung" without a badge', async () => {
    api.fetchActiveTournaments.mockResolvedValue([ONGOING])
    const w = await mountBanner()
    const item = w.get('[data-testid="tournament-banner-item"]')
    expect(item.text()).toContain('Sedang berlangsung')
    expect(item.text()).not.toContain('DAFTAR')
    expect(item.text()).not.toContain('MAIN')
  })

  it('live match: red card "LIVE: a vs b" and "MAIN", taking precedence over the status', async () => {
    api.fetchActiveTournaments.mockResolvedValue([LIVE])
    const w = await mountBanner()
    const item = w.get('[data-testid="tournament-banner-live"]')
    expect(item.find('[data-ds="live-badge"]').exists()).toBe(true)
    expect(item.get('[data-testid="tournament-banner-line"]').text()).toBe(
      'LIVE: Sekolah A vs Sekolah B',
    )
    expect(item.text()).toContain('MAIN')
    expect(item.text()).not.toContain('Sedang berlangsung')
    expect(item.attributes('href')).toBe('/tournament/uuid-live')
  })

  it('stacks several items in response order', async () => {
    api.fetchActiveTournaments.mockResolvedValue([REG, ONGOING, LIVE])
    const w = await mountBanner()
    const links = w.findAll('[data-testid="tournament-banner"] a').map((a) => a.attributes('href'))
    expect(links).toEqual(['/tournament/uuid-reg', '/tournament/uuid-on', '/tournament/uuid-live'])
    expect(w.get('[data-testid="tournament-banner"]').classes()).toContain('mb-4')
  })
})
