// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SoloSusunJawapanPage from '../../pages/SoloSusunJawapanPage.vue'
import { mountAt, rawOk, susunPayload } from './helpers'

const fetchSoloGame = vi.hoisted(() => vi.fn())
const submitSoloGame = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  fetchSoloGame,
  submitSoloGame,
}))

let wrapper: VueWrapper | undefined

beforeEach(() => {
  fetchSoloGame.mockReset()
  submitSoloGame.mockReset()
  fetchSoloGame.mockImplementation(() => Promise.resolve(susunPayload()))
  submitSoloGame.mockResolvedValue(rawOk({ is_new_record: false, syiling_awarded: 0 }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const byTestId = (id: string) => wrapper!.get(`[data-testid="${id}"]`)
const source = (letter: string) =>
  wrapper!.findAll('[data-testid="solo-tile"]').find((t) => t.text() === letter)!
const placedTexts = () => wrapper!.findAll('[data-testid="solo-placed"]').map((t) => t.text())
async function spell(letters: string): Promise<void> {
  for (const l of letters) await source(l).trigger('click')
}

describe('S16 Susun Jawapan (FR-M16-82..85)', () => {
  it('shows the picker without ?darjah', async () => {
    wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan')
    expect(wrapper.text()).toContain('Pilih darjah / tingkatan kamu:')
    expect(fetchSoloGame).not.toHaveBeenCalled()
  })

  it('renders the header, 20 dots, the puzzle area and a disabled check button', async () => {
    wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan?darjah=4')
    const text = wrapper.text()
    for (const s of [
      'Kembali',
      'Skor 0',
      '🪙 0',
      '🧩 Susun Jawapan',
      'Soalan 1 daripada 20',
      'Susun 1',
      '📥 Jawapan Kamu:',
      'Klik huruf/perkataan di bawah untuk susun',
      '🔤 Pilihan:',
      '✅ Semak Jawapan',
      '⏭️ Langkau Soalan Ini',
    ]) {
      expect(text).toContain(s)
    }
    expect(wrapper.findAll('[data-testid="solo-dot"]')).toHaveLength(20)
    expect(byTestId('solo-check').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('Hebat')
  })

  it('places and removes tiles (a tile click, the drop area removes the last)', async () => {
    wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan?darjah=4')
    await spell('CAB')
    expect(placedTexts()).toEqual(['C', 'A', 'B'])
    expect(wrapper.findAll('[data-testid="solo-tile"]')).toHaveLength(0)
    await wrapper.findAll('[data-testid="solo-placed"]')[0]!.trigger('click')
    expect(placedTexts()).toEqual(['A', 'B'])
    await byTestId('solo-drop').trigger('click')
    expect(placedTexts()).toEqual(['A'])
    expect(wrapper.findAll('[data-testid="solo-tile"]')).toHaveLength(2)
  })

  it('a correct check adds the points and syiling, then "Seterusnya →" moves on', async () => {
    wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan?darjah=4')
    await spell('ABC')
    await byTestId('solo-check').trigger('click')
    expect(byTestId('solo-feedback').text()).toBe('🎉 BETUL! +6 mata')
    expect(byTestId('solo-score').text()).toBe('Skor 6')
    expect(byTestId('solo-coins').text()).toBe('🪙 2')
    expect(wrapper.findAll('[data-testid="solo-dot"]')[0]!.classes()).toContain('done')
    await byTestId('solo-next').trigger('click')
    expect(wrapper.text()).toContain('Soalan 2 daripada 20')
  })

  it('a wrong check offers retry and skip; retry returns the tiles', async () => {
    wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan?darjah=4')
    await spell('CAB')
    await byTestId('solo-check').trigger('click')
    expect(byTestId('solo-feedback').text()).toBe('❌ Cuba lagi atau langkau')
    expect(wrapper.text()).toContain('🔄 Cuba Lagi')
    expect(wrapper.text()).toContain('⏭️ Langkau')
    expect(byTestId('solo-score').text()).toBe('Skor 0')
    await byTestId('solo-retry').trigger('click')
    expect(placedTexts()).toEqual([])
    expect(wrapper.findAll('[data-testid="solo-tile"]')).toHaveLength(3)
  })

  it('shows the result after the 20th puzzle and submits once', async () => {
    wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan?darjah=4')
    await spell('ABC')
    await byTestId('solo-check').trigger('click')
    await byTestId('solo-next').trigger('click')
    for (let i = 2; i <= 20; i++) await byTestId('solo-skip-question').trigger('click')
    await vi.waitFor(() => expect(submitSoloGame).toHaveBeenCalledTimes(1))
    expect(submitSoloGame).toHaveBeenCalledWith('susun-jawapan', {
      session_id: 'ws_0123456789abc',
      solved_count: 1,
      total_puzzles: 20,
      score: 6,
      syiling_earned: 2,
    })
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Susun Jawapan selesai!'))
    expect(byTestId('solo-result-title').text()).toBe('TERUSKAN!')
    expect(wrapper.text()).toContain('Selesai')
    expect(wrapper.text()).toContain('1/20')
    expect(wrapper.text()).toContain('Syiling Diperolehi')
    expect(wrapper.text()).toContain('0 🪙')
    expect(wrapper.text()).not.toContain('REKOD BARU')
  })
})
