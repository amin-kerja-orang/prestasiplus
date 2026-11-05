// @vitest-environment jsdom
/**
 * R1-ADM-N-05 `/admin/permainan` against a mocked client (S7-T03; 30 N05-01..03, 48 section 2, AC-GM-00.11, AC-GM-14.3):
 * exact BM copy, the live breakdown, each card saving on its own, the server's messages at the field.
 */
import { GAMES_ADMIN_GAMES, GAMES_ADMIN_SETTING_KEYS, GAMES_ADMIN_SETTINGS } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { AdminGames, AdminSpinSegment } from '../../api/game-types'
import TetapanPermainanPage from '../../pages/TetapanPermainanPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({
  fetchAdminGames: vi.fn(),
  saveGameSettings: vi.fn(),
  saveGameActive: vi.fn(),
  fetchSpinSegments: vi.fn(),
  saveSpinSegments: vi.fn(),
}))
vi.mock('../../api/games', () => api)

const defaults = Object.fromEntries(GAMES_ADMIN_SETTING_KEYS.map((key) => [key, GAMES_ADMIN_SETTINGS[key].default]))
const overview = (over: Partial<AdminGames['settings']> = {}): AdminGames => ({
  stats: { rooms: 160, playing: 2, finished: 158, players: 189 },
  settings: { boardgameQuizTiles: 35, ...defaults, ...over } as AdminGames['settings'],
  games: GAMES_ADMIN_GAMES.map(({ key, name, ...rest }) => ({ key, name, active: true, ...rest })),
})
const SEGMENTS: AdminSpinSegment[] = [
  { position: 1, label: '1 Syiling', syiling: 1, weight: 25, active: true },
  { position: 2, label: '3 Syiling', syiling: 3, weight: 20, active: true },
  { position: 3, label: '5 Syiling', syiling: 5, weight: 15, active: true },
  { position: 4, label: '10 Syiling', syiling: 10, weight: 8, active: true },
  { position: 5, label: '20 Syiling', syiling: 20, weight: 3, active: true },
  { position: 6, label: 'Cuba Lagi', syiling: 0, weight: 15, active: true },
  { position: 7, label: '2 Syiling', syiling: 2, weight: 10, active: true },
  { position: 8, label: '7 Syiling', syiling: 7, weight: 4, active: true },
]

const invalid = (fields: Record<string, string>, message: string) =>
  new ApiError({ status: 422, code: 'VALIDATION_ERROR', message, fields })

async function open(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/admin/permainan')
  await router.isReady()
  const w = mount(TetapanPermainanPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}

const tid = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const flash = () => useFlashStore().current

beforeEach(() => {
  document.body.innerHTML = ''
  setActivePinia(createPinia())
  for (const f of Object.values(api)) f.mockReset()
  api.fetchAdminGames.mockResolvedValue(overview())
  api.fetchSpinSegments.mockResolvedValue(SEGMENTS)
})

describe('route', () => {
  it('is /admin/permainan in the admin shell, admin only, with the shell title', () => {
    const route = routes.find((r) => r.path === '/admin/permainan')
    expect(route?.meta).toMatchObject({
      layout: 'admin',
      roles: ['admin'],
      title: '🎮 Tetapan Permainan - Admin Panel',
      header: { title: 'Tetapan Permainan' },
    })
  })
})

describe('the copy of 30 N-05', () => {
  it('shows the four tiles with their counts', async () => {
    const w = await open()
    for (const [key, label, value] of [
      ['rooms', 'Jumlah Bilik', '160'],
      ['playing', 'Sedang Aktif', '2'],
      ['finished', 'Selesai', '158'],
      ['players', 'Pemain Unik', '189'],
    ] as const) {
      const text = tid(w, `gs-tile-${key}`).text()
      expect(text).toContain(label)
      expect(text).toContain(value)
    }
  })

  it('shows the Papan Bijak card, with unit and hint', async () => {
    const w = await open()
    const form = tid(w, 'gs-board-form')
    expect(form.text()).toContain('Papan Bijak')
    expect(form.text()).toContain('Tetapan papan permainan ular & tangga (50 petak)')
    expect(form.text()).toContain('Bilangan Petak Soalan')
    expect(form.text()).toContain('petak')
    expect(form.text()).toContain('Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan.')
    expect(tid(w, 'gs-board-save').text()).toBe('Simpan Tetapan')
    expect((tid(w, 'gs-quiz-tiles').element as HTMLInputElement).value).toBe('35')
  })

  it('marks no input invalid before a save', async () => {
    const w = await open()
    expect(w.findAll('[aria-invalid="true"]')).toHaveLength(0)
    expect(w.findAll('[data-testid="field-error"]')).toHaveLength(0)
  })

  it('shows every key of Ganjaran & Had Permainan with its exact label and value', async () => {
    const w = await open()
    const form = tid(w, 'gs-reward-form')
    expect(form.text()).toContain('Ganjaran & Had Permainan')
    for (const key of GAMES_ADMIN_SETTING_KEYS) {
      expect(form.text(), key).toContain(GAMES_ADMIN_SETTINGS[key].label)
      expect(tid(w, `gs-setting-${key}`).exists(), key).toBe(true)
    }
    expect((tid(w, 'gs-setting-game_win_xp').element as HTMLInputElement).value).toBe('20')
  })

  it('has no field for a key of another screen and no coin switch', async () => {
    const w = await open()
    expect(tid(w, 'gs-setting-xp_per_correct').exists()).toBe(false)
    expect(tid(w, 'gs-setting-games_award_syiling').exists()).toBe(false)
    expect(w.text()).not.toContain('Syiling permainan')
  })
})

describe('Pecahan Papan (N05-02)', () => {
  it('shows the breakdown and recomputes it as the admin types', async () => {
    const w = await open()
    const box = tid(w, 'gs-breakdown')
    expect(box.text()).toContain('Pecahan Papan (50 petak)')
    for (const label of ['Petak soalan (quiz):', 'Tangga (3) + Ular (3):', 'Bonus (2) + Perangkap (2):', 'Petak biasa (jalan kosong):', 'Mula + Tamat:']) {
      expect(box.text()).toContain(label)
    }
    expect(tid(w, 'gs-chip-quiz').text()).toBe('35 soalan')
    expect(tid(w, 'gs-chip-special').text()).toBe('10 khas')
    expect(tid(w, 'gs-chip-plain').text()).toBe('3 biasa')

    await tid(w, 'gs-quiz-tiles').setValue('20')
    expect(tid(w, 'gs-chip-quiz').text()).toBe('20 soalan')
    expect(tid(w, 'gs-chip-plain').text()).toBe('18 biasa')

    await tid(w, 'gs-quiz-tiles').setValue('45')
    expect(tid(w, 'gs-chip-plain').text()).toBe('0 biasa')

    await tid(w, 'gs-quiz-tiles').setValue('')
    expect(tid(w, 'gs-chip-quiz').text()).toBe('0 soalan')
  })
})

describe('saving Papan Bijak', () => {
  it('sends only its key and flashes "Tetapan permainan disimpan."', async () => {
    api.saveGameSettings.mockResolvedValue(overview({ boardgameQuizTiles: 20 }).settings)
    const w = await open()
    await tid(w, 'gs-quiz-tiles').setValue('20')
    await tid(w, 'gs-board-form').trigger('submit')
    await flushPromises()
    expect(api.saveGameSettings).toHaveBeenCalledExactlyOnceWith({ boardgame_quiz_tiles: 20 })
    expect(flash()).toEqual({ type: 'success', message: 'Tetapan permainan disimpan.' })
  })

  it('keeps unsaved input of the other card', async () => {
    api.saveGameSettings.mockResolvedValue(overview({ boardgameQuizTiles: 20 }).settings)
    const w = await open()
    await tid(w, 'gs-setting-game_win_xp').setValue('77')
    await tid(w, 'gs-board-form').trigger('submit')
    await flushPromises()
    expect((tid(w, 'gs-setting-game_win_xp').element as HTMLInputElement).value).toBe('77')
  })

  it('shows the server message at the field and keeps the input', async () => {
    api.saveGameSettings.mockRejectedValue(invalid({ boardgame_quiz_tiles: 'Maksimum 38 petak soalan.' }, 'Maksimum 38 petak soalan.'))
    const w = await open()
    await tid(w, 'gs-quiz-tiles').setValue('39')
    await tid(w, 'gs-board-form').trigger('submit')
    await flushPromises()
    expect(tid(w, 'gs-board-form').find('[data-testid="field-error"]').text()).toBe('Maksimum 38 petak soalan.')
    expect((tid(w, 'gs-quiz-tiles').element as HTMLInputElement).value).toBe('39')
    expect(tid(w, 'gs-quiz-tiles').attributes('aria-invalid')).toBe('true')
    expect(flash()).toBeNull()
  })

  it('sends null for an empty input, so the server answers on the key', async () => {
    api.saveGameSettings.mockRejectedValue(invalid({ boardgame_quiz_tiles: 'Bilangan petak tidak sah.' }, 'Bilangan petak tidak sah.'))
    const w = await open()
    await tid(w, 'gs-quiz-tiles').setValue('')
    await tid(w, 'gs-board-form').trigger('submit')
    await flushPromises()
    expect(api.saveGameSettings).toHaveBeenCalledWith({ boardgame_quiz_tiles: null })
    expect(tid(w, 'gs-board-form').text()).toContain('Bilangan petak tidak sah.')
  })

  it('shows a failure with no fields in the card', async () => {
    api.saveGameSettings.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }))
    const w = await open()
    await tid(w, 'gs-board-form').trigger('submit')
    await flushPromises()
    expect(tid(w, 'gs-board-failure').text()).toContain('Ralat pelayan.')
  })
})

describe('saving Ganjaran & Had Permainan', () => {
  it('sends only the edited keys as numbers, with the toggle as 1 or 0, and flashes', async () => {
    api.saveGameSettings.mockResolvedValue(overview({ game_win_xp: 30, games_room_bots_enabled: 0 }).settings)
    const w = await open()
    await tid(w, 'gs-setting-game_win_xp').setValue('30')
    await tid(w, 'gs-setting-games_room_bots_enabled').trigger('click')
    await tid(w, 'gs-reward-form').trigger('submit')
    await flushPromises()
    expect(api.saveGameSettings).toHaveBeenCalledExactlyOnceWith({ game_win_xp: 30, games_room_bots_enabled: 0 })
    expect(flash()).toEqual({ type: 'success', message: 'Tetapan permainan disimpan.' })
  })

  it('a save with no edit sends the 22 keys, as an empty body is refused', async () => {
    api.saveGameSettings.mockResolvedValue(overview().settings)
    const w = await open()
    await tid(w, 'gs-reward-form').trigger('submit')
    await flushPromises()
    const body = api.saveGameSettings.mock.calls[0]?.[0] as Record<string, number>
    expect(Object.keys(body).sort()).toEqual([...GAMES_ADMIN_SETTING_KEYS].sort())
    expect(body.battle_questions_default).toBe(10)
  })

  it('the next save compares with the saved values, not the first load', async () => {
    api.saveGameSettings.mockResolvedValue(overview({ game_win_xp: 30 }).settings)
    const w = await open()
    await tid(w, 'gs-setting-game_win_xp').setValue('30')
    await tid(w, 'gs-reward-form').trigger('submit')
    await flushPromises()
    await tid(w, 'gs-setting-game_draw_xp').setValue('12')
    await tid(w, 'gs-reward-form').trigger('submit')
    await flushPromises()
    expect(api.saveGameSettings).toHaveBeenLastCalledWith({ game_draw_xp: 12 })
  })

  it('AC-GM-00.11: the range message shows at its field', async () => {
    api.saveGameSettings.mockRejectedValue(invalid({ battle_question_seconds: 'Nilai mesti antara 10 dan 60.' }, 'Nilai mesti antara 10 dan 60.'))
    const w = await open()
    await tid(w, 'gs-setting-battle_question_seconds').setValue('5')
    await tid(w, 'gs-reward-form').trigger('submit')
    await flushPromises()
    expect(tid(w, 'gs-reward-form').find('[data-testid="field-error"]').text()).toBe('Nilai mesti antara 10 dan 60.')
    expect(flash()).toBeNull()
  })
})

describe('Senarai Permainan (N05-04)', () => {
  it('shows the card, the 14 games with an Aktif switch, and descriptions only where 30 gives one', async () => {
    const w = await open()
    const card = tid(w, 'gs-games')
    expect(card.text()).toContain('Senarai Permainan')
    expect(card.text()).toContain('Permainan yang tersedia dalam sistem')
    for (const game of GAMES_ADMIN_GAMES) {
      const row = tid(w, `gs-game-${game.key}`)
      expect(row.text(), game.key).toContain(game.name)
      expect(row.text(), game.key).toContain('Aktif')
    }
    expect(tid(w, 'gs-game-papan-bijak').text()).toContain('Ular & tangga dengan soalan kuiz. Multiplayer 2-4 pemain.')
    expect(tid(w, 'gs-game-kad-memori').text()).toContain('Padankan soalan dengan jawapan. 6 pasangan (12 kad).')
    expect(tid(w, 'gs-game-battle').text()).toContain('1v1 kuiz battle masa nyata. Pilih lawan & subjek.')
  })

  it('has no row or switch for sambung-kata or tournament', async () => {
    const w = await open()
    for (const key of ['sambung-kata', 'tournament']) {
      expect(tid(w, `gs-game-${key}`).exists(), key).toBe(false)
      expect(tid(w, `gs-game-${key}-active`).exists(), key).toBe(false)
    }
    expect(tid(w, 'gs-games').text()).not.toContain('Sambung Kata')
  })

  it('switching off saves at once and flashes DINYAHAKTIFKAN; switching on flashes DIAKTIFKAN', async () => {
    const row = { key: 'kad-memori', name: 'Kad Memori', active: false }
    api.saveGameActive.mockResolvedValueOnce(row)
    const w = await open()
    const toggle = tid(w, 'gs-game-kad-memori-active')
    await toggle.trigger('click')
    await flushPromises()
    expect(api.saveGameActive).toHaveBeenCalledExactlyOnceWith('kad-memori', false)
    expect(flash()).toEqual({ type: 'success', message: 'Permainan "Kad Memori" telah DINYAHAKTIFKAN.' })
    expect(tid(w, 'gs-game-kad-memori-active').attributes('aria-checked')).toBe('false')

    api.saveGameActive.mockResolvedValueOnce({ ...row, active: true })
    await tid(w, 'gs-game-kad-memori-active').trigger('click')
    await flushPromises()
    expect(api.saveGameActive).toHaveBeenLastCalledWith('kad-memori', true)
    expect(flash()).toEqual({ type: 'success', message: 'Permainan "Kad Memori" telah DIAKTIFKAN.' })
  })

  it('a failed write leaves the switch as it was and shows the message', async () => {
    api.saveGameActive.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Rekod tidak dijumpai. Ia mungkin telah dipadam.' }))
    const w = await open()
    await tid(w, 'gs-game-battle-active').trigger('click')
    await flushPromises()
    expect(tid(w, 'gs-game-battle-active').attributes('aria-checked')).toBe('true')
    expect(tid(w, 'gs-game-failure').text()).toContain('Rekod tidak dijumpai. Ia mungkin telah dipadam.')
    expect(flash()).toBeNull()
  })

  it('an empty list shows "Tiada permainan didaftarkan lagi."', async () => {
    api.fetchAdminGames.mockResolvedValue({ ...overview(), games: [] })
    const w = await open()
    expect(tid(w, 'gs-games-empty').text()).toContain('Tiada permainan didaftarkan lagi.')
  })
})

describe('Segmen Roda Nasib', () => {
  it('lists the 8 rows and the live total', async () => {
    const w = await open()
    expect(tid(w, 'gs-segment-form').text()).toContain('Segmen Roda Nasib')
    for (const s of SEGMENTS) {
      const pos = String(s.position)
      expect((tid(w, `gs-seg-${pos}-label`).element as HTMLInputElement).value).toBe(s.label)
      expect((tid(w, `gs-seg-${pos}-syiling`).element as HTMLInputElement).value).toBe(String(s.syiling))
      expect((tid(w, `gs-seg-${pos}-weight`).element as HTMLInputElement).value).toBe(String(s.weight))
    }
    expect(tid(w, 'gs-weight-total').text()).toBe('Jumlah berat: 100 / 100')
    await tid(w, 'gs-seg-1-weight').setValue('24')
    expect(tid(w, 'gs-weight-total').text()).toBe('Jumlah berat: 99 / 100')
  })

  it('AC-GM-14.3: a total of 99 shows "Jumlah berat mesti 100." and keeps the input', async () => {
    api.saveSpinSegments.mockRejectedValue(invalid({ segments: 'Jumlah berat mesti 100.' }, 'Jumlah berat mesti 100.'))
    const w = await open()
    await tid(w, 'gs-seg-1-weight').setValue('24')
    await tid(w, 'gs-segment-form').trigger('submit')
    await flushPromises()
    expect(tid(w, 'gs-segment-failure').text()).toContain('Jumlah berat mesti 100.')
    expect((tid(w, 'gs-seg-1-weight').element as HTMLInputElement).value).toBe('24')
    expect(flash()).toBeNull()
  })

  it('shows a row message beside its input', async () => {
    api.saveSpinSegments.mockRejectedValue(invalid({ 'segments.2.syiling': 'Nilai mesti antara 0 dan 100.' }, 'Nilai mesti antara 0 dan 100.'))
    const w = await open()
    await tid(w, 'gs-seg-3-syiling').setValue('101')
    await tid(w, 'gs-segment-form').trigger('submit')
    await flushPromises()
    expect(tid(w, 'gs-segment-form').find('[data-testid="field-error"]').text()).toBe('Nilai mesti antara 0 dan 100.')
  })

  it('sends the 8 rows as numbers, in position order, and flashes', async () => {
    api.saveSpinSegments.mockResolvedValue(SEGMENTS)
    const w = await open()
    await tid(w, 'gs-seg-2-label').setValue('Tiga')
    await tid(w, 'gs-seg-2-active').trigger('click')
    await tid(w, 'gs-segment-form').trigger('submit')
    await flushPromises()
    const rows = api.saveSpinSegments.mock.calls[0]?.[0] as AdminSpinSegment[]
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(rows[1]).toEqual({ position: 2, label: 'Tiga', syiling: 3, weight: 20, active: false })
    expect(flash()).toEqual({ type: 'success', message: 'Tetapan permainan disimpan.' })
  })
})

describe('load states', () => {
  it('a failed overview load offers a retry that works; the segments card stays', async () => {
    api.fetchAdminGames.mockRejectedValueOnce(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }))
    const w = await open()
    expect(tid(w, 'gs-board-form').exists()).toBe(false)
    expect(tid(w, 'gs-segment-form').exists()).toBe(true)
    await w.find('[data-testid="gs-overview-state"] button').trigger('click')
    await flushPromises()
    expect(tid(w, 'gs-board-form').exists()).toBe(true)
  })
})
