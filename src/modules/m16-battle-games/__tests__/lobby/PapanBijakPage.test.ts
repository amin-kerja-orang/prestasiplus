// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { GameLobby } from '../../api'
import PapanBijakPage from '../../pages/PapanBijakPage.vue'
import { usel } from './select-helper'

const fetchGameLobby = vi.hoisted(() => vi.fn())
const createRoom = vi.hoisted(() => vi.fn())
const joinRoom = vi.hoisted(() => vi.fn())
const startPbQuickMatch = vi.hoisted(() => vi.fn())
const pollPbQuickMatch = vi.hoisted(() => vi.fn())
const cancelPbQuickMatch = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', () => ({
  fetchGameLobby,
  createRoom,
  joinRoom,
  startPbQuickMatch,
  pollPbQuickMatch,
  cancelPbQuickMatch,
}))

const top10 = [
  {
    rank: 1,
    userId: 1,
    name: 'Admin Demo',
    initials: 'AD',
    menang: 4,
    jumlah: 6,
    kadar: 67,
    skor: 90,
    betul: 13,
  },
  {
    rank: 2,
    userId: 2,
    name: 'Pelajar Panjang Na...',
    initials: 'PP',
    menang: 3,
    jumlah: 4,
    kadar: 75,
    skor: 80,
    betul: 10,
  },
  {
    rank: 3,
    userId: 3,
    name: 'Pelajar Tiga',
    initials: 'PT',
    menang: 1,
    jumlah: 4,
    kadar: 25,
    skor: 40,
    betul: 5,
  },
]

const lobby = (over: Partial<GameLobby> = {}): GameLobby => ({
  autoGrade: 'DARJAH_4',
  autoGradeName: 'Darjah 4',
  top10,
  ...over,
})

let wrapper: VueWrapper | undefined

async function mountPage() {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/papan-bijak', component: { template: '<div />' } },
      { path: '/papan-bijak/:code', component: { template: '<div />' } },
    ],
  })
  await router.push('/papan-bijak')
  await router.isReady()
  wrapper = mount(PapanBijakPage, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

const sel = (id: string) => usel(wrapper!, id)

beforeEach(() => {
  for (const m of [
    fetchGameLobby,
    createRoom,
    joinRoom,
    startPbQuickMatch,
    pollPbQuickMatch,
    cancelPbQuickMatch,
  ])
    m.mockReset()
  fetchGameLobby.mockResolvedValue(lobby())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S7 Papan Bijak lobby: static content (FR-M16-54, 58)', () => {
  it('renders the hero, the subjects, the auto grade box and the how-to lines', async () => {
    await mountPage()
    expect(wrapper!.get('[data-testid="pb-h1"]').text()).toBe('🎲 Papan Bijak')
    expect(wrapper!.get('[data-testid="pb-subtitle"]').text()).toBe(
      'Permainan papan kuiz berbilang pemain — jemput kawan, gulung dadu, jawab soalan! 🐍🪜',
    )
    expect(sel('create-subject').texts()).toEqual(['🔢 Matematik', '📝 Bahasa Melayu', '🔬 Sains', '🇬🇧 Bahasa Inggeris'])
    const auto = wrapper!.get('[data-testid="grade-auto"]').text()
    expect(auto).toContain('Darjah 4')
    expect(auto).toContain('(auto dari profil anda)')
    expect(wrapper!.get('[data-testid="grade-auto-row"]').text()).toContain('Tukar')
    const how = wrapper!.get('[data-testid="pb-how-to"]')
    expect(how.text()).toContain('Cara Bermain:')
    expect(how.findAll('li').map((l) => l.text())).toEqual([
      '🎲 1. Gulung dadu dan bergerak di papan',
      '📝 2. Jatuh di petak kuiz — jawab soalan!',
      '🪜 3. Naik tangga untuk shortcut',
      '🐍 4. Elak ular yang menarik turun',
      '🏆 5. Sampai petak 50 dulu = MENANG!',
    ])
  })

  it('"Tukar" shows the optgroup select and "← Guna auto" returns to the auto box', async () => {
    await mountPage()
    await wrapper!.get('[data-testid="grade-switch"]').trigger('click')
    expect(wrapper!.find('[data-testid="grade-auto"]').exists()).toBe(false)
    const select = sel('grade-select')
    expect(select.labels()).toEqual([
      'Sekolah Rendah',
      'Sekolah Menengah',
    ])
    expect(select.value()).toBe('DARJAH_4')
    await select.set('TINGKATAN_2')
    expect(sel('create-mode').texts()[1]).toBe('Semua Tingkatan (1-5)')
    await wrapper!.get('[data-testid="grade-back"]').trigger('click')
    expect(wrapper!.get('[data-testid="grade-auto"]').text()).toContain('Darjah 4')
    expect(sel('create-mode').texts()[1]).toBe('Semua Darjah (1-6)')
  })

  it('an account without a grade opens on the select (no auto box, no way back)', async () => {
    fetchGameLobby.mockResolvedValue(lobby({ autoGrade: null, autoGradeName: null }))
    await mountPage()
    expect(wrapper!.find('[data-testid="grade-auto"]').exists()).toBe(false)
    expect(wrapper!.find('[data-testid="grade-select"]').exists()).toBe(true)
    expect(wrapper!.find('[data-testid="grade-back"]').exists()).toBe(false)
  })

  it('custom shows "Dari" / "Hingga" (default D1 / D6) and "Maks Pemain" 2-6 defaults to 4', async () => {
    await mountPage()
    expect(wrapper!.find('[data-testid="create-range"]').exists()).toBe(false)
    expect(sel('create-max-players').texts()).toEqual(['2 Pemain', '3 Pemain', '4 Pemain', '5 Pemain', '6 Pemain'])
    expect(sel('create-max-players').value()).toBe(4)
    await sel('create-mode').set('custom')
    expect(sel('create-grade-min').value()).toBe(1)
    expect(sel('create-grade-max').value()).toBe(6)
    expect(sel('create-grade-max').items()).toHaveLength(11)
  })
})

describe('S7 live look: tinted panels', () => {
  it('has the violet create, green join, amber quick match and pink Top 10 panels and a violet hero', async () => {
    await mountPage()
    // v2: the hero is a DS card with the page h1 (the old violet gradient header is gone).
    expect(wrapper!.get('[data-testid="pb-h1"]').text()).toContain('Papan Bijak')
    // v2: UCard panels (no tinted gradients).
    for (const id of ['create-card', 'join-card', 'quick-match', 'top10-card'])
      expect(wrapper!.find(`[data-testid="${id}"]`).exists()).toBe(true)
    // "Cara Bermain:" lives inside the green join panel, as live.
    expect(wrapper!.get('[data-testid="join-card"]').text()).toContain('Cara Bermain:')
  })
})

describe('S7 create and join (FR-M16-56, 57)', () => {
  it('creates a room with the form body and opens /papan-bijak/{code}', async () => {
    createRoom.mockResolvedValueOnce({ code: 'K7M2QX' })
    const { router } = await mountPage()
    await sel('create-max-players').set(4)
    await wrapper!.get('[data-testid="create-form"]').trigger('submit')
    await flushPromises()
    expect(createRoom).toHaveBeenCalledWith('papan-bijak', {
      subject: 'MATEMATIK',
      grade_level: 'DARJAH_4',
      match_mode: 'same_grade',
      max_players: 4,
    })
    expect(router.currentRoute.value.fullPath).toBe('/papan-bijak/K7M2QX')
  })

  it('sends the custom range only for the custom mode', async () => {
    createRoom.mockResolvedValueOnce({ code: 'AAAAAA' })
    await mountPage()
    await sel('create-mode').set('custom')
    await sel('create-grade-min').set(2)
    await sel('create-grade-max').set(9)
    await wrapper!.get('[data-testid="create-form"]').trigger('submit')
    await flushPromises()
    expect(createRoom.mock.calls[0]![1]).toMatchObject({
      match_mode: 'custom',
      grade_min: 2,
      grade_max: 9,
    })
  })

  it('shows the server errors above the form and stays on the lobby', async () => {
    createRoom.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { grade_min: 'Julat tahap tidak sah.' },
      }),
    )
    const { router } = await mountPage()
    await wrapper!.get('[data-testid="create-form"]').trigger('submit')
    await flushPromises()
    expect(wrapper!.get('[data-testid="create-errors"]').text()).toContain('Julat tahap tidak sah.')
    expect(router.currentRoute.value.fullPath).toBe('/papan-bijak')
  })

  it('the join code is required, at most 6 characters and shown upper case', async () => {
    await mountPage()
    const input = wrapper!.get<HTMLInputElement>('[data-testid="join-input"]')
    expect(input.attributes('required')).toBeDefined()
    expect(input.attributes('maxlength')).toBe('6')
    expect(input.attributes('placeholder')).toBe('ABC123')
    expect(wrapper!.get('[data-testid="join-card"]').text()).toContain('Kod Bilik (6 aksara)')
    expect(wrapper!.get('[data-testid="join-submit"]').text()).toBe('🚀 Masuk Bilik')
    await input.setValue('abc123')
    expect(input.element.value).toBe('ABC123')
  })

  it('joins by code, opening the room', async () => {
    joinRoom.mockResolvedValueOnce({ code: 'ABC123' })
    const { router } = await mountPage()
    await wrapper!.get('[data-testid="join-input"]').setValue('abc123')
    await wrapper!.get('[data-testid="join-form"]').trigger('submit')
    await flushPromises()
    expect(joinRoom).toHaveBeenCalledWith('papan-bijak', 'ABC123')
    expect(router.currentRoute.value.fullPath).toBe('/papan-bijak/ABC123')
  })

  it('an unknown code stays on the lobby with the flash "Bilik tidak dijumpai."', async () => {
    joinRoom.mockRejectedValueOnce(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Bilik tidak dijumpai.' }),
    )
    const { router } = await mountPage()
    await wrapper!.get('[data-testid="join-input"]').setValue('ZZZZZZ')
    await wrapper!.get('[data-testid="join-form"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/papan-bijak')
    expect(useFlashStore().current).toEqual({ type: 'error', message: 'Bilik tidak dijumpai.' })
  })
})

describe('S7 Top 10 (FR-M16-61)', () => {
  it('renders the medals, initials, names and Kadar pill colours', async () => {
    await mountPage()
    const rows = wrapper!.findAll('[data-testid="top10-row"]')
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.get('[data-testid="row-rank"]').text())).toEqual(['🥇', '🥈', '🥉'])
    expect(rows[0]!.get('[data-testid="row-avatar"]').text()).toBe('AD')
    expect(rows[1]!.get('[data-testid="row-title"]').text()).toBe('Pelajar Panjang Na...')
    const kadar = rows.map((r) => r.get('[data-testid="top10-kadar"]'))
    expect(kadar.map((k) => k.text())).toEqual(['67%', '75%', '25%'])
    expect(kadar[0]!.classes().join(' ')).toContain('warning')
    expect(kadar[1]!.classes().join(' ')).toContain('success')
    expect(kadar[2]!.classes().join(' ')).toContain('error')
    expect(wrapper!.get('[data-testid="top10-card"]').text()).toContain(
      'Papan Markah — 10 Juara Teratas',
    )
  })
})
