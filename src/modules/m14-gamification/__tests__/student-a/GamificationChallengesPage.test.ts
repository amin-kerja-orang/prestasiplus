// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import GamificationChallengesPage from '../../pages/GamificationChallengesPage.vue'
import { challenge } from './fixtures'

const api = vi.hoisted(() => ({ fetchGamificationChallenges: vi.fn(), claimChallenge: vi.fn() }))
vi.mock('../../api', () => api)

let w: VueWrapper | undefined
const t = (id: string) => w!.get(`[data-testid="${id}"]`)

async function mountPage() {
  w = mount(GamificationChallengesPage)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  w?.unmount()
  w = undefined
})

describe('S13 challenges (AC-M14-09)', () => {
  it('renders the header, counter and one card per challenge in the served order (AC-09.1)', async () => {
    api.fetchGamificationChallenges.mockResolvedValue({
      data: [
        challenge(1, { title: 'Rajin Berlatih', target: 3 }),
        challenge(2, {
          title: 'Si Tepat',
          difficulty: 'medium',
          rewardSyiling: 20,
          rewardXp: 15,
          target: 80,
        }),
      ],
      meta: { completed: 0, active: 10 },
    })
    await mountPage()
    expect(t('s13-hero').get('h1').text()).toBe('Cabaran Harian')
    expect(t('s13-hero').text()).toContain('Selesaikan cabaran hari ini dan tuntut ganjaran syiling')
    expect(t('s13-counter-value').text()).toBe('0/10')
    expect(t('s13-counter').text()).toContain('Selesai')
    const cards = w!.findAll('[data-testid="s13-card"]')
    expect(cards.map((c) => c.get('[data-testid="s13-title"]').text())).toEqual([
      'Rajin Berlatih',
      'Si Tepat',
    ])
    expect(cards[1]!.get('[data-testid="s13-difficulty"]').text()).toBe('Sederhana')
    expect(cards[1]!.get('[data-testid="s13-reward-syiling"]').text()).toContain('+20')
    expect(cards[1]!.get('[data-testid="s13-reward-xp"]').text()).toContain('+15')
    expect(cards[1]!.get('[data-testid="s13-progress"]').text()).toBe('Progres: 0/80')
    expect(cards[1]!.get('[data-testid="s13-pct"]').text()).toBe('0%')
  })

  it('a completed card keeps the layout with a full bar and the completed styling (AC-09.2)', async () => {
    api.fetchGamificationChallenges.mockResolvedValue({
      data: [
        challenge(1, { title: 'Si Tepat', target: 80, progress: 80, pct: 100, completed: true }),
        challenge(2, { title: 'Rajin Berlatih', target: 3, progress: 1, pct: 33.33 }),
      ],
      meta: { completed: 1, active: 2 },
    })
    await mountPage()
    expect(t('s13-counter-value').text()).toBe('1/2')
    const [done, open] = w!.findAll('[data-testid="s13-card"]')
    expect(done!.attributes('data-completed')).toBe('true')
    expect(done!.get('[data-testid="s13-title"]').text()).toBe('✅ Si Tepat')
    expect(done!.get('[data-testid="s13-progress"]').text()).toBe('Progres: 80/80')
    expect(done!.get('[data-testid="s13-pct"]').text()).toBe('100%')
    expect(done!.get('[data-testid="s13-bar"]').attributes('data-value')).toContain('100')
    expect(open!.get('[data-testid="s13-pct"]').text()).toBe('33%')
    expect(open!.get('[data-testid="s13-title"]').text()).toBe('Rajin Berlatih')
  })

  it('shows an error box when the API fails', async () => {
    api.fetchGamificationChallenges.mockRejectedValue(new Error('boom'))
    await mountPage()
    expect(w!.text()).toContain('Ralat berlaku. Sila cuba lagi.')
  })
})

describe('S13 Tuntut (FR-MUR-30-3/4/6, AC-MUR-30-1/2/5; API-GAME-11)', () => {
  const list = (over: Record<string, unknown> = {}) => ({
    data: [
      challenge(1, { title: 'Selesai', completed: true, progress: 3, pct: 100 }),
      challenge(2, { title: 'Dituntut', completed: true, progress: 3, pct: 100, claimed: true }),
      challenge(3, { title: 'Belum', progress: 1, pct: 33 }),
    ],
    meta: { completed: 2, active: 3, claimed: 1 },
    ...over,
  })
  const cardOf = (i: number) => w!.findAll('[data-testid="s13-card"]')[i]!
  const press = async (i = 0) => {
    await cardOf(i).get('[data-testid="s13-claim"]').trigger('click')
    await flushPromises()
  }
  const apiError = (status: number, code: string, message: string) =>
    new ApiError({ status, code, message })

  beforeEach(() => {
    api.fetchGamificationChallenges.mockResolvedValue(list())
  })

  it('shows Tuntut only on a done, unclaimed card; Dituntut on a claimed one; nothing on an open one', async () => {
    await mountPage()
    expect(cardOf(0).get('[data-testid="s13-claim"]').text()).toBe('Tuntut')
    expect(cardOf(0).find('[data-testid="s13-claimed"]').exists()).toBe(false)
    expect(cardOf(1).find('[data-testid="s13-claim"]').exists()).toBe(false)
    expect(cardOf(1).get('[data-testid="s13-claimed"]').text()).toBe('Dituntut')
    expect(cardOf(2).find('[data-testid="s13-claim"]').exists()).toBe(false)
    expect(cardOf(2).find('[data-testid="s13-claimed"]').exists()).toBe(false)
  })

  it('the summary counts the claimed rewards: "{n} / {total} ganjaran dituntut"', async () => {
    await mountPage()
    expect(t('s13-claimed-count').text()).toBe('1 / 3 ganjaran dituntut')
  })

  it('a press sends one uuid, shows the amounts, marks the card claimed and raises the counter', async () => {
    api.claimChallenge.mockResolvedValue({ claimed: true, rewardSyiling: 15, rewardXp: 10 })
    await mountPage()
    await press()
    expect(api.claimChallenge).toHaveBeenCalledTimes(1)
    const [id, uuid] = api.claimChallenge.mock.calls[0]!
    expect(id).toBe(1)
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(t('s13-success').text()).toBe('Ganjaran dituntut: +15 syiling, +10 mata.')
    expect(cardOf(0).find('[data-testid="s13-claim"]').exists()).toBe(false)
    expect(cardOf(0).get('[data-testid="s13-claimed"]').text()).toBe('Dituntut')
    expect(t('s13-claimed-count').text()).toBe('2 / 3 ganjaran dituntut')
  })

  it('shows the notices of the answer, such as a tier-up', async () => {
    api.claimChallenge.mockResolvedValue({
      claimed: true,
      rewardSyiling: 15,
      rewardXp: 10,
      notices: ['Tahniah! Anda naik ke tier Perak.'],
    })
    await mountPage()
    await press()
    expect(w!.findAll('[data-testid="s13-notice"]').map((n) => n.text())).toEqual([
      'Tahniah! Anda naik ke tier Perak.',
    ])
  })

  it('the button is disabled while the request is in flight, so a double press sends one request', async () => {
    let finish!: (v: unknown) => void
    api.claimChallenge.mockReturnValue(new Promise((r) => (finish = r)))
    await mountPage()
    const btn = cardOf(0).get('[data-testid="s13-claim"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(api.claimChallenge).toHaveBeenCalledTimes(1)
    finish({ claimed: true, rewardSyiling: 15, rewardXp: 10 })
    await flushPromises()
    expect(api.claimChallenge).toHaveBeenCalledTimes(1)
  })

  it('a retry of the same press (the answer never arrived) reuses the uuid; a later press after an answer gets a new one', async () => {
    api.claimChallenge
      .mockRejectedValueOnce(apiError(0, 'NETWORK_ERROR', 'Tiada sambungan.'))
      .mockResolvedValueOnce({ claimed: true, rewardSyiling: 15, rewardXp: 10 })
    await mountPage()
    await press()
    expect(t('s13-failure').text()).toBe('Ralat berlaku. Sila cuba lagi.')
    expect(cardOf(0).get('[data-testid="s13-claim"]').attributes('disabled')).toBeUndefined()
    await press()
    expect(api.claimChallenge).toHaveBeenCalledTimes(2)
    expect(api.claimChallenge.mock.calls[1]![1]).toBe(api.claimChallenge.mock.calls[0]![1])
    expect(w!.find('[data-testid="s13-failure"]').exists()).toBe(false)
  })

  it('a definitive refusal drops the uuid: the next press sends a new one', async () => {
    api.claimChallenge
      .mockRejectedValueOnce(apiError(409, 'CHALLENGE_NOT_DONE', 'Cabaran belum selesai.'))
      .mockResolvedValueOnce({ claimed: true, rewardSyiling: 15, rewardXp: 10 })
    await mountPage()
    await press()
    await press()
    expect(api.claimChallenge.mock.calls[1]![1]).not.toBe(api.claimChallenge.mock.calls[0]![1])
  })

  it('409 CHALLENGE_CLAIMED marks the card claimed without an error', async () => {
    api.claimChallenge.mockRejectedValue(
      apiError(409, 'CHALLENGE_CLAIMED', 'Ganjaran sudah dituntut.'),
    )
    await mountPage()
    await press()
    expect(cardOf(0).get('[data-testid="s13-claimed"]').text()).toBe('Dituntut')
    expect(w!.find('[data-testid="s13-failure"]').exists()).toBe(false)
    expect(t('s13-claimed-count').text()).toBe('2 / 3 ganjaran dituntut')
  })

  it.each([
    [409, 'CHALLENGE_NOT_DONE', 'Cabaran belum selesai.'],
    [409, 'CONFLICT', 'Kunci ini telah digunakan.'],
    [403, 'FORBIDDEN', 'Mod Pelajar tidak mendapat ganjaran sebenar.'],
    [404, 'NOT_FOUND', 'Cabaran tidak dijumpai.'],
  ])('%i %s shows the server message and keeps Tuntut', async (status, code, message) => {
    api.claimChallenge.mockRejectedValue(apiError(status, code, message))
    await mountPage()
    await press()
    expect(t('s13-failure').text()).toBe(message)
    expect(cardOf(0).find('[data-testid="s13-claim"]').exists()).toBe(true)
    expect(t('s13-claimed-count').text()).toBe('1 / 3 ganjaran dituntut')
  })
})
