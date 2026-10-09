// @vitest-environment jsdom
/**
 * S7 "Cari Lawan Auto" (SRS M16 v1.6 FR-M16-59, FR-M16-60; §7.1): start #29, the +1 s counter, poll #30
 * every 3 s, matched / expired / cancelled, cancel #31, the error line kept after the search (DV-M16-20)
 * and no timer left after the card is unmounted.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import QuickMatchCard from '../../components/lobby/QuickMatchCard.vue'

const startPbQuickMatch = vi.hoisted(() => vi.fn())
const pollPbQuickMatch = vi.hoisted(() => vi.fn())
const cancelPbQuickMatch = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', () => ({ startPbQuickMatch, pollPbQuickMatch, cancelPbQuickMatch }))

const res = <T>(body: T, status = 200) => ({ status, headers: {}, body })

let wrapper: VueWrapper | undefined

async function search() {
  wrapper = mount(QuickMatchCard, { attachTo: document.body })
  await wrapper.get('[data-testid="qm-start"]').trigger('click')
  await flushPromises()
}

const elapsed = () => wrapper!.get('[data-testid="qm-elapsed"]').text()

beforeEach(() => {
  vi.useFakeTimers()
  startPbQuickMatch.mockReset()
  pollPbQuickMatch.mockReset()
  cancelPbQuickMatch.mockReset()
  startPbQuickMatch.mockResolvedValue(res({ status: 'searching' }))
  pollPbQuickMatch.mockResolvedValue(res({ status: 'searching' }))
  cancelPbQuickMatch.mockResolvedValue(res({ status: 'cancelled' }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('Papan Bijak quick match', () => {
  it('has the idle copy and the two selects', () => {
    wrapper = mount(QuickMatchCard, { attachTo: document.body })
    const t = wrapper.text()
    expect(t).toContain('Cari Lawan Auto')
    expect(t).toContain('Sistem cari pemain sepadan secara automatik')
    expect(t).toContain('🔍 Cari Lawan Sekarang')
    expect(
      wrapper.get('[data-testid="qm-subject"]').findAll('option').map((o) => o.text()),
    ).toEqual(['Matematik', 'Bahasa Melayu', 'Sains', 'Bahasa Inggeris'])
    expect(wrapper.get('[data-testid="qm-mode"]').findAll('option').map((o) => o.text())).toEqual([
      'Tahap sama',
      'Semua darjah/tingkatan',
    ])
  })

  it('posts the subject and match mode, counts every second and polls every 3 s', async () => {
    await search()
    expect(startPbQuickMatch).toHaveBeenCalledWith({ subject: 'MATEMATIK', match_mode: 'same_grade' })
    expect(wrapper!.text()).toContain('Sila tunggu, sistem sedang mencari pemain sepadan')
    expect(elapsed()).toBe('Mencari lawan... 0s')
    await vi.advanceTimersByTimeAsync(2000)
    expect(elapsed()).toBe('Mencari lawan... 2s')
    expect(pollPbQuickMatch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(pollPbQuickMatch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(6000)
    expect(pollPbQuickMatch).toHaveBeenCalledTimes(3)
    expect(elapsed()).toBe('Mencari lawan... 9s')
  })

  it('emits the room code on matched and stops every timer', async () => {
    pollPbQuickMatch
      .mockResolvedValueOnce(res({ status: 'searching' }))
      .mockResolvedValueOnce(res({ status: 'searching' }))
      .mockResolvedValueOnce(res({ status: 'matched', room_code: 'K7M2QX' }))
    await search()
    await vi.advanceTimersByTimeAsync(9000)
    expect(wrapper!.emitted('matched')).toEqual([['K7M2QX']])
    expect(wrapper!.find('[data-testid="qm-searching"]').exists()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('expired shows the error below the button and keeps it until the next search (DV-M16-20)', async () => {
    pollPbQuickMatch.mockResolvedValueOnce(res({ status: 'expired' }))
    await search()
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper!.find('[data-testid="qm-searching"]').exists()).toBe(false)
    expect(wrapper!.get('[data-testid="qm-error"]').text()).toBe('Tiada lawan dijumpai. Cuba lagi!')
    await wrapper!.get('[data-testid="qm-start"]').trigger('click')
    await flushPromises()
    expect(wrapper!.find('[data-testid="qm-error"]').exists()).toBe(false)
  })

  it('a poll answering cancelled returns to idle without an error', async () => {
    pollPbQuickMatch.mockResolvedValueOnce(res({ status: 'cancelled' }))
    await search()
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper!.find('[data-testid="qm-searching"]').exists()).toBe(false)
    expect(wrapper!.find('[data-testid="qm-error"]').exists()).toBe(false)
  })

  it('"Batal Carian" posts #31, returns to idle and stops polling', async () => {
    await search()
    await wrapper!.get('[data-testid="qm-cancel"]').trigger('click')
    await flushPromises()
    expect(cancelPbQuickMatch).toHaveBeenCalledTimes(1)
    expect(wrapper!.find('[data-testid="qm-searching"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(9000)
    expect(pollPbQuickMatch).not.toHaveBeenCalled()
  })

  it('a start answer with data.error shows it on the error line', async () => {
    startPbQuickMatch.mockResolvedValueOnce(res({ error: 'Subjek tidak sah.' }, 422))
    await search()
    expect(wrapper!.get('[data-testid="qm-error"]').text()).toBe('Subjek tidak sah.')
    expect(pollPbQuickMatch).not.toHaveBeenCalled()
  })

  it('a network failure on start shows "Ralat rangkaian. Sila cuba lagi."', async () => {
    startPbQuickMatch.mockRejectedValueOnce(new Error('network'))
    await search()
    expect(wrapper!.get('[data-testid="qm-error"]').text()).toBe('Ralat rangkaian. Sila cuba lagi.')
  })

  it('a failed poll keeps searching (no client timeout)', async () => {
    pollPbQuickMatch.mockRejectedValueOnce(new Error('network'))
    await search()
    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper!.find('[data-testid="qm-searching"]').exists()).toBe(true)
  })

  it('leaves no timer behind when the card is unmounted while searching', async () => {
    await search()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    wrapper!.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})
