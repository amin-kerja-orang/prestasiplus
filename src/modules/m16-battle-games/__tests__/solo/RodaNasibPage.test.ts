// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpinPage } from '../../api'
import { nextWheelRotation } from '../../components/solo/solo-lib'
import RodaNasibPage from '../../pages/RodaNasibPage.vue'
import { mountAt, rawOk } from './helpers'

const fetchSpinPage = vi.hoisted(() => vi.fn())
const spinWheel = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  fetchSpinPage,
  spinWheel,
}))

const SEGMENTS: SpinPage['segments'] = [
  ['1 Syiling', 'syiling', 1, 25, '#3b82f6', '🪙'],
  ['3 Syiling', 'syiling', 3, 20, '#8b5cf6', '💰'],
  ['5 Syiling', 'syiling', 5, 15, '#10b981', '💎'],
  ['10 Syiling', 'syiling', 10, 8, '#f59e0b', '🏆'],
  ['20 Syiling', 'syiling', 20, 3, '#ef4444', '🔥'],
  ['Cuba Lagi', 'nothing', 0, 15, '#6b7280', '😅'],
  ['2 Syiling', 'syiling', 2, 10, '#ec4899', '✨'],
  ['7 Syiling', 'syiling', 7, 4, '#14b8a6', '🎁'],
].map(([label, type, value, weight, color, icon]) => ({
  label,
  type,
  value,
  weight,
  color,
  icon,
})) as SpinPage['segments']

const page = (over: Partial<SpinPage> = {}): SpinPage => ({
  segments: SEGMENTS,
  spins: 2,
  won: 0,
  alreadySpun: false,
  canEarnSyiling: false,
  ...over,
})

const spinBody = (index: number, credited = 0) =>
  rawOk({
    success: true,
    message: '',
    result: {
      segment_index: index,
      label: SEGMENTS[index]!.label,
      icon: SEGMENTS[index]!.icon,
      type: SEGMENTS[index]!.type,
      value: SEGMENTS[index]!.value,
    },
    coinsCredited: credited,
  })

let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.useFakeTimers()
  fetchSpinPage.mockReset()
  spinWheel.mockReset()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const button = () => wrapper!.get('[data-testid="spin-button"]')
const rotation = () =>
  Number(wrapper!.get('[data-testid="wheel-disc"]').attributes('data-rotation'))

describe('S18 Roda Nasib (FR-M16-93..95)', () => {
  it('renders the header, the chips, the wheel and an enabled SPIN button', async () => {
    fetchSpinPage.mockResolvedValue(page())
    wrapper = await mountAt(RodaNasibPage, '/permainan/roda-nasib')
    const text = wrapper.text()
    for (const s of [
      'Permainan',
      '🎯 Roda Nasib',
      'Pusing roda sekali sehari untuk hadiah misteri!',
      '🎰 2 kali spin',
      '🪙 0 Syiling dimenangkan',
    ]) {
      expect(text).toContain(s)
    }
    expect(wrapper.find('canvas').attributes('width')).toBe('380')
    expect(wrapper.find('canvas').attributes('height')).toBe('380')
    expect(button().text()).toBe('🎯 SPIN!')
    expect(button().attributes('disabled')).toBeUndefined()
  })

  it('spins 4.2 s to the server segment, opens the prize modal and locks the button', async () => {
    fetchSpinPage.mockResolvedValue(page())
    spinWheel.mockResolvedValue(spinBody(2, 0))
    wrapper = await mountAt(RodaNasibPage, '/permainan/roda-nasib')
    await button().trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(spinWheel).toHaveBeenCalledTimes(1)
    expect(button().text()).toBe('⏳ Sedang Pusing...')
    expect(button().attributes('disabled')).toBeDefined()
    expect(rotation()).toBe(nextWheelRotation(0, 2))
    // segment 2: 7 turns (2520°) + landing 157.5° (= 360 − 112.5 − 90)
    expect(rotation()).toBe(2677.5)
    expect(wrapper.find('[data-testid="prize-overlay"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(4199)
    expect(wrapper.find('[data-testid="prize-overlay"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.get('[data-testid="prize-icon"]').text()).toBe('💎')
    expect(wrapper.get('[data-testid="prize-label"]').text()).toBe('5 Syiling')
    // M14 seed: nothing credited, so the two syiling lines do not show (DV-M16-23).
    expect(wrapper.text()).not.toContain('Ditambah ke akaun kamu!')
    expect(wrapper.text()).not.toContain('+5 Syiling')
    expect(wrapper.get('[data-testid="spin-count"]').text()).toBe('🎰 3 kali spin')
    expect(wrapper.get('[data-testid="spin-won"]').text()).toBe('🪙 0 Syiling dimenangkan')
    expect(button().text()).toBe('✅ Sudah Spin Hari Ini')
    expect(button().attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="prize-close"]').trigger('click')
    expect(wrapper.find('[data-testid="prize-overlay"]').exists()).toBe(false)
  })

  it('shows "+5 Syiling" and "Ditambah ke akaun kamu!" for a credited amount', async () => {
    fetchSpinPage.mockResolvedValue(page({ canEarnSyiling: true }))
    spinWheel.mockResolvedValue(spinBody(2, 5))
    wrapper = await mountAt(RodaNasibPage, '/permainan/roda-nasib')
    await button().trigger('click')
    await vi.advanceTimersByTimeAsync(4200)
    expect(wrapper.get('[data-testid="prize-amount"]').text()).toBe('+5 Syiling')
    expect(wrapper.text()).toContain('Ditambah ke akaun kamu!')
    expect(wrapper.get('[data-testid="spin-won"]').text()).toBe('🪙 5 Syiling dimenangkan')
  })

  it('"Cuba Lagi" says not to worry, and an overlay click closes the modal', async () => {
    fetchSpinPage.mockResolvedValue(page())
    spinWheel.mockResolvedValue(spinBody(5, 0))
    wrapper = await mountAt(RodaNasibPage, '/permainan/roda-nasib')
    await button().trigger('click')
    await vi.advanceTimersByTimeAsync(4200)
    expect(wrapper.get('[data-testid="prize-icon"]').text()).toBe('😅')
    expect(wrapper.get('[data-testid="prize-label"]').text()).toBe('Cuba Lagi')
    expect(wrapper.text()).toContain('Jangan risau, cuba lagi esok!')
    await wrapper.get('[data-testid="prize-overlay"]').trigger('click')
    expect(wrapper.find('[data-testid="prize-overlay"]').exists()).toBe(false)
  })

  it('a spin already used today is disabled on load', async () => {
    fetchSpinPage.mockResolvedValue(page({ alreadySpun: true }))
    wrapper = await mountAt(RodaNasibPage, '/permainan/roda-nasib')
    expect(button().text()).toBe('✅ Sudah Spin Hari Ini')
    expect(button().attributes('disabled')).toBeDefined()
  })

  it('a refused spin (409) alerts the message and locks the button', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    fetchSpinPage.mockResolvedValue(page())
    spinWheel.mockResolvedValue({
      status: 409,
      headers: {},
      body: { success: false, message: 'Anda sudah spin hari ini.' },
    })
    wrapper = await mountAt(RodaNasibPage, '/permainan/roda-nasib')
    await button().trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(alert).toHaveBeenCalledWith('Anda sudah spin hari ini.')
    expect(button().text()).toBe('✅ Sudah Spin Hari Ini')
    expect(rotation()).toBe(0)
  })
})
