// @vitest-environment jsdom
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { JutawanPage as JutawanPageData, RoomQuestion } from '../../api'
import JutawanMainPage from '../../pages/JutawanMainPage.vue'
import JutawanPage from '../../pages/JutawanPage.vue'
import { mountAt } from './helpers'

const fetchJutawanPage = vi.hoisted(() => vi.fn())
const startJutawan = vi.hoisted(() => vi.fn())
const answerJutawan = vi.hoisted(() => vi.fn())
const lifelineJutawan = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  fetchJutawanPage,
  startJutawan,
  answerJutawan,
  lifelineJutawan,
}))

let wrapper: VueWrapper | undefined

const q = (id: number): RoomQuestion => ({
  id,
  text: `Soalan jutawan ${String(id)}`,
  options: ['A', 'B', 'C', 'D'].map((label, i) => ({ id: i, label, text: `Jawapan ${label}` })),
})

beforeEach(() => {
  vi.useFakeTimers()
  for (const f of [fetchJutawanPage, startJutawan, answerJutawan, lifelineJutawan]) f.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const subjects: NonNullable<JutawanPageData['subjects']> = [
  { id: 1, name: 'Bahasa Melayu', emoji: '📝', colour: '#3b82f6', count: 579 },
  { id: 3, name: 'Matematik', emoji: '🔢', colour: '#10b981', count: 1077 },
]

describe('S19 Jutawan Ilmu (FR-M16-96, 97)', () => {
  it('without ?darjah: picker over the header, stats and the hint', async () => {
    fetchJutawanPage.mockResolvedValue({ bestLevel: 0, games: 0 })
    wrapper = await mountAt(JutawanPage, '/permainan/jutawan')
    const text = wrapper.text()
    for (const s of [
      'Pilih darjah / tingkatan kamu:',
      '💰 Jutawan Ilmu',
      'Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!',
      'L0',
      'Rekod Tertinggi',
      'Permainan',
      '1,000🪙',
      'Hadiah Utama',
      '👆',
      'Pilih darjah atau tingkatan di atas untuk mula.',
    ]) {
      expect(text).toContain(s)
    }
    expect(fetchJutawanPage).toHaveBeenCalledWith(undefined)
  })

  it('with ?darjah=4: heading and one link per subject with its count', async () => {
    fetchJutawanPage.mockResolvedValue({ bestLevel: 3, games: 1, heading: 'DARJAH 4', subjects })
    wrapper = await mountAt(JutawanPage, '/permainan/jutawan?darjah=4')
    expect(fetchJutawanPage).toHaveBeenCalledWith(4)
    expect(wrapper.find('[data-testid="darjah-picker"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('📚 PILIH SUBJEK (DARJAH 4)')
    expect(wrapper.get('[data-testid="jutawan-best"]').text()).toBe('L3')
    const links = wrapper.findAll('[data-testid="jutawan-subject"]')
    expect(links.map((l) => l.text())).toEqual([
      expect.stringContaining('Bahasa Melayu'),
      expect.stringContaining('Matematik'),
    ])
    expect(links[1]!.text()).toContain('1077 soalan')
    expect(links[1]!.attributes('href')).toBe('/permainan/jutawan/main?subject=3&darjah=4')
  })

  it('?darjah=10 reads TINGKATAN 4 from the server heading', async () => {
    fetchJutawanPage.mockResolvedValue({ bestLevel: 0, games: 0, heading: 'TINGKATAN 4', subjects })
    wrapper = await mountAt(JutawanPage, '/permainan/jutawan?darjah=10')
    expect(wrapper.text()).toContain('(TINGKATAN 4)')
  })
})

describe('Jutawan game (provisional)', () => {
  const START = { sessionId: 'jut_0123456789abc', index: 1, question: q(1), lifelines: 3 }

  it('an invalid subject shows an error and a way back without calling the API', async () => {
    wrapper = await mountAt(JutawanMainPage, '/permainan/jutawan/main?subject=x&darjah=4')
    expect(startJutawan).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Subjek atau darjah tidak sah.')
    expect(wrapper.text()).toContain('← Pilih subjek')
  })

  it('plays 3 correct then a wrong answer and ends at L3', async () => {
    startJutawan.mockResolvedValue(START)
    answerJutawan
      .mockResolvedValueOnce({ correct: true, level: 1, next: q(2) })
      .mockResolvedValueOnce({ correct: true, level: 2, next: q(3) })
      .mockResolvedValueOnce({ correct: true, level: 3, next: q(4) })
      .mockResolvedValueOnce({ correct: false, level: 3, result: { level: 3, credited: 0 } })
    wrapper = await mountAt(JutawanMainPage, '/permainan/jutawan/main?subject=3&darjah=4')
    expect(startJutawan).toHaveBeenCalledWith({ subject: 3, darjah: 4 })
    expect(wrapper.text()).toContain('Soalan jutawan 1')
    expect(wrapper.findAll('[data-testid="jutawan-rung"]')).toHaveLength(15)
    for (let i = 1; i <= 4; i++) {
      await wrapper.findAll('[data-testid="jutawan-option"]')[1]!.trigger('click')
      await flushPromises()
      await vi.advanceTimersByTimeAsync(700)
    }
    expect(answerJutawan).toHaveBeenNthCalledWith(1, 'jut_0123456789abc', { questionId: 1, optionId: 1 })
    expect(wrapper.text()).toContain('Tahniah! Anda sampai L3.')
    expect(wrapper.text()).toContain('🔄 Main Lagi')
    expect(wrapper.text()).toContain('🎮 Hub')
  })

  it('"50:50" removes two options and drops the lifeline count', async () => {
    startJutawan.mockResolvedValue(START)
    lifelineJutawan.mockResolvedValue({ removedOptionIds: [0, 2], lifelines: 2 })
    wrapper = await mountAt(JutawanMainPage, '/permainan/jutawan/main?subject=3&darjah=4')
    expect(wrapper.get('[data-testid="jutawan-lifeline"]').text()).toBe('50:50 (3)')
    await wrapper.get('[data-testid="jutawan-lifeline"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="jutawan-option"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="jutawan-lifeline"]').text()).toBe('50:50 (2)')
    expect(wrapper.get('[data-testid="jutawan-lifeline"]').attributes('disabled')).toBeDefined()
  })
})
