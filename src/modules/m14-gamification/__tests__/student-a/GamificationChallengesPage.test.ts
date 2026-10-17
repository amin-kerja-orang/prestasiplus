// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import GamificationChallengesPage from '../../pages/GamificationChallengesPage.vue'
import { challenge } from './fixtures'

const api = vi.hoisted(() => ({ fetchGamificationChallenges: vi.fn() }))
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
    expect(t('s13-hero').text()).toContain('Selesaikan cabaran untuk dapatkan syiling & XP bonus!')
    expect(t('s13-counter-value').text()).toContain('0/10')
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
    expect(t('s13-counter-value').text()).toContain('1/2')
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
