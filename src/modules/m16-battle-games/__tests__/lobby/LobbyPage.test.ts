// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { GameLobby, RoomGame } from '../../api'
import LobbyPage from '../../pages/LobbyPage.vue'
import { usel } from './select-helper'

const fetchGameLobby = vi.hoisted(() => vi.fn())
const createRoom = vi.hoisted(() => vi.fn())
const joinRoom = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', () => ({ fetchGameLobby, createRoom, joinRoom }))

const lobby = (over: Partial<GameLobby> = {}): GameLobby => ({
  autoGrade: 'TINGKATAN_4',
  autoGradeName: 'Tingkatan 4',
  leaders: [
    { rank: 1, userId: 5, name: 'Pelajar Satu', value: 5 },
    { rank: 2, userId: 6, name: 'Pelajar Dua', value: 4 },
    { rank: 3, userId: 7, name: 'Pelajar Tiga', value: 3 },
    { rank: 4, userId: 8, name: 'Pelajar Empat', value: 3 },
  ],
  ...over,
})

let wrapper: VueWrapper | undefined

async function mountPage(game: RoomGame = 'perang-fakta') {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: `/${game}`, component: { template: '<div />' } },
      { path: `/${game}/:code`, component: { template: '<div />' } },
    ],
  })
  await router.push(`/${game}`)
  await router.isReady()
  wrapper = mount(LobbyPage, {
    props: { game },
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

const get = (id: string) => wrapper!.get<HTMLElement>(`[data-testid="${id}"]`)

beforeEach(() => {
  for (const m of [fetchGameLobby, createRoom, joinRoom]) m.mockReset()
  fetchGameLobby.mockResolvedValue(lobby())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S8-S12 lobby template (FR-M16-62..65)', () => {
  it.each([
    [
      'perang-fakta',
      '⚔️ Perang Fakta',
      'Betul atau Salah? Vote & buktikan pengetahuan kamu!',
      '2-6 pemain · 15 pusingan · 10 saat setiap soalan',
      '⚔️ Cipta Bilik',
    ],
    [
      'benteng-ilmu',
      '🏰 Benteng Ilmu',
      'Serang benteng lawan dengan kuasa ilmu! Jawab betul = serang, jawab salah = rosak sendiri!',
      '2 pemain · HP 100 · Giliran bertukar',
      '🏰 Cipta Bilik',
    ],
    [
      'perlumbaan-matematik',
      '🏎️ Perlumbaan Matematik',
      'Jawab soalan, lari ke garisan penamat! Siapa paling pantas menang!',
      '2-4 pemain · 20 langkah · Siapa sampai dulu menang',
      '🏎️ Cipta Bilik',
    ],
    [
      'kuiz-relay',
      '🏃‍♂️ Kuiz Relay',
      'Berpasukan! Jawab soalan secara bergilir-gilir. Pasukan terbaik menang!',
      '4-8 pemain · 2 pasukan · 10 pusingan',
      '🏃‍♂️ Cipta Bilik',
    ],
    [
      'teka-silang-kata',
      '📝 Teka Silang Kata',
      'Isi silang kata paling pantas! Lawan masa dan lawan untuk markah tertinggi!',
      '2 pemain · 5 minit · Markah tertinggi menang',
      '📝 Cipta Bilik',
    ],
  ] as const)('%s: hero, rule line and create button', async (game, h1, sub, rule, button) => {
    await mountPage(game)
    expect(get('lobby-h1').text()).toBe(h1)
    expect(get('lobby-subtitle').text()).toBe(sub)
    expect(get('lobby-rule').text()).toBe(rule)
    expect(get('create-submit').text()).toBe(button)
  })

  it('create form: five subjects, one-way "Tukar", three match fields only', async () => {
    await mountPage()
    expect(usel(wrapper!, 'create-subject').texts()).toEqual(['Matematik', 'Bahasa Melayu', 'Bahasa Inggeris', 'Sains', 'Sejarah'])
    const auto = get('grade-auto').text()
    expect(auto).toContain('Tingkatan 4')
    expect(auto).toContain('(auto)')
    await get('grade-switch').trigger('click')
    expect(wrapper!.find('[data-testid="grade-select"]').exists()).toBe(true)
    expect(wrapper!.find('[data-testid="grade-back"]').exists()).toBe(false) // one-way, as live
    expect(usel(wrapper!, 'create-mode').texts()).toEqual(['Tahap sama sahaja', 'Semua Tingkatan'])
    expect(wrapper!.find('[data-testid="create-max-players"]').exists()).toBe(false)
  })

  it('creates a room and opens /{game}/{code}', async () => {
    createRoom.mockResolvedValueOnce({ code: 'Q1W2E3' })
    const { router } = await mountPage()
    await get('create-form').trigger('submit')
    await flushPromises()
    expect(createRoom).toHaveBeenCalledWith('perang-fakta', {
      subject: 'MATEMATIK',
      grade_level: 'TINGKATAN_4',
      match_mode: 'same_grade',
    })
    expect(router.currentRoute.value.fullPath).toBe('/perang-fakta/Q1W2E3')
  })

  it('v2 look: a hero card, the code box and "Masuk" on ONE row, the game-coloured actions', async () => {
    await mountPage('perang-fakta')
    expect(get('lobby-h1').text()).toContain('Perang Fakta')
    const form = get('join-form')
    expect(form.classes()).toContain('flex') // input and button side by side, not stacked
    expect(form.classes()).not.toContain('flex-col')
    expect(get('join-submit').text()).toBe('Masuk')
    expect(get('create-submit').classes().join(' ')).toContain('error')
    expect(get('join-submit').classes().join(' ')).toContain('error')
    wrapper!.unmount()
    await mountPage('benteng-ilmu')
    expect(get('create-submit').classes().join(' ')).toContain('success')
    expect(get('join-submit').classes().join(' ')).toContain('success')
  })

  it('join: not required, upper case, placeholder "Contoh: ABC123", "Masuk"', async () => {
    await mountPage()
    const input = wrapper!.get<HTMLInputElement>('[data-testid="join-input"]')
    expect(input.attributes('required')).toBeUndefined()
    expect(input.attributes('maxlength')).toBe('6')
    expect(input.attributes('placeholder')).toBe('Contoh: ABC123')
    expect(get('join-card').text()).toContain('🔑 Masuk Dengan Kod')
    expect(get('join-submit').text()).toBe('Masuk')
  })

  it('an empty or unknown code posts and shows the flash "Bilik tidak dijumpai."', async () => {
    joinRoom.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Bilik tidak dijumpai.' }),
    )
    const { router } = await mountPage()
    await get('join-form').trigger('submit') // empty: not required, so it submits
    await flushPromises()
    expect(joinRoom).toHaveBeenCalledWith('perang-fakta', '')
    expect(router.currentRoute.value.fullPath).toBe('/perang-fakta')
    expect(useFlashStore().current).toEqual({ type: 'error', message: 'Bilik tidak dijumpai.' })
  })

  it('a known code opens the room', async () => {
    joinRoom.mockResolvedValueOnce({ code: 'ABC123' })
    const { router } = await mountPage()
    await get('join-input').setValue('abc123')
    await get('join-form').trigger('submit')
    await flushPromises()
    expect(joinRoom).toHaveBeenCalledWith('perang-fakta', 'ABC123')
    expect(router.currentRoute.value.fullPath).toBe('/perang-fakta/ABC123')
  })

  it('"Pendahulu" lists medals then "{n}." with "{n} menang"; Kuiz Relay "{n} kali MVP"', async () => {
    await mountPage()
    const rows = wrapper!.findAll('[data-testid="leaders-row"]').map((r) => r.text())
    expect(rows).toHaveLength(4)
    rows.forEach((text, i) => {
      expect(text).toContain(['Pelajar Satu', 'Pelajar Dua', 'Pelajar Tiga', 'Pelajar Empat'][i]!)
      expect(text).toContain(' menang')
    })
    wrapper!.unmount()
    await mountPage('kuiz-relay')
    expect(wrapper!.findAll('[data-testid="leaders-row"]')[0]!.text()).toContain('5 kali MVP')
  })

  it('an empty leaders list shows no Pendahulu card', async () => {
    fetchGameLobby.mockResolvedValue(lobby({ leaders: [] }))
    await mountPage()
    expect(wrapper!.find('[data-testid="leaders-card"]').exists()).toBe(false)
  })
})
