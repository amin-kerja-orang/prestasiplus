// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { BattleLobby, BattleListRow } from '../../api'
import BattleRecentList from '../../components/battle/BattleRecentList.vue'
import BattleHistoryPage from '../../pages/BattleHistoryPage.vue'
import BattleLeaderboardPage from '../../pages/BattleLeaderboardPage.vue'
import BattleLobbyPage from '../../pages/BattleLobbyPage.vue'

const api = vi.hoisted(() => ({
  fetchBattleLobby: vi.fn(),
  fetchInvitations: vi.fn(),
  fetchBattleHistory: vi.fn(),
  fetchStudentStandings: vi.fn(),
  startBattle: vi.fn(),
  pollMatch: vi.fn(),
  searchOpponent: vi.fn(),
  sendInvite: vi.fn(),
}))
vi.mock('../../api/battle', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  ...api,
}))

const lobby = (over: Partial<BattleLobby> = {}): BattleLobby => ({
  grade: 4,
  gradeLabel: 'Darjah 4',
  spmUnlocked: false,
  subjects: Array.from({ length: 31 }, (_, i) => ({
    id: i + 1,
    name: i === 2 ? 'Matematik' : `Subjek ${String(i + 1)}`,
    icon: 'fa-book',
    colour: '#3B82F6',
    core: i < 7,
  })),
  pkskDomains: Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    name: `Domain ${String(i + 1)}`,
    icon: 'fa-leaf',
    colour: '#10B981',
  })),
  ...over,
})

let wrapper: VueWrapper | undefined

async function mountPage(component: object, url = '/battle') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/battle', component: { template: '<div />' } },
      { path: '/battle/arena/:uuid', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(component, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchBattleLobby.mockResolvedValue(lobby())
  api.fetchInvitations.mockResolvedValue({ status: 200, headers: {}, body: { invitations: [] } })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

const byId = (id: string) => wrapper!.find(`[data-testid="${id}"]`)

describe('S1 lobby', () => {
  it('renders the hero, 7 core tiles, disabled mode buttons and no modal', async () => {
    await mountPage(BattleLobbyPage)
    expect(wrapper!.text()).toContain('Cabar kawan, cari lawan, atau wakili sekolah anda!')
    expect(wrapper!.findAll('[data-testid="battle-subject"]')).toHaveLength(7)
    for (const id of ['battle-quick-match', 'battle-challenge', 'battle-school-battle']) {
      expect(byId(id).attributes('disabled')).toBeDefined()
    }
    expect(document.body.querySelector('[data-testid="battle-invitations-modal"]')).toBeNull()
    expect(api.fetchInvitations).toHaveBeenCalledTimes(1)
  })

  it('"Lagi 24 subjek lain" reveals the rest and a selected tile enables the buttons', async () => {
    await mountPage(BattleLobbyPage)
    expect(byId('battle-toggle-more').text()).toBe('Lagi 24 subjek lain')
    await byId('battle-toggle-more').trigger('click')
    expect(wrapper!.findAll('[data-testid="battle-subject"]')).toHaveLength(31)
    expect(byId('battle-toggle-more').text()).toBe('Tutup')
    await wrapper!.findAll('[data-testid="battle-subject"]')[2]!.trigger('click')
    expect(wrapper!.findAll('[data-testid="battle-subject"]')[2]!.attributes('aria-pressed')).toBe(
      'true',
    )
    expect(byId('battle-quick-match').attributes('disabled')).toBeUndefined()
  })

  it('PKSK needs a domain and a level', async () => {
    await mountPage(BattleLobbyPage)
    await byId('battle-type-pksk').trigger('click')
    expect(wrapper!.findAll('[data-testid="battle-domain"]')).toHaveLength(15)
    expect(byId('battle-level-t1').text()).toBe('Tingkatan 1')
    await wrapper!.findAll('[data-testid="battle-domain"]')[0]!.trigger('click')
    expect(byId('battle-quick-match').attributes('disabled')).toBeDefined()
    await byId('battle-level-t4').trigger('click')
    expect(byId('battle-quick-match').attributes('disabled')).toBeUndefined()
  })

  it('SPM below Tingkatan 4 only toggles the tooltip and keeps the type', async () => {
    await mountPage(BattleLobbyPage)
    await byId('battle-type-spm').trigger('click')
    expect(byId('battle-spm-tip').text()).toBe('Khas untuk pelajar Tingkatan 4 & 5 sahaja')
    expect(byId('battle-panel-biasa').exists()).toBe(true)
    await byId('battle-type-spm').trigger('click')
    expect(byId('battle-spm-tip').exists()).toBe(false)
  })

  it('an unlocked SPM shows its subjects', async () => {
    api.fetchBattleLobby.mockResolvedValue(
      lobby({ spmUnlocked: true, grade: 10, spmSubjects: [{ id: 3, name: 'Matematik' }] }),
    )
    await mountPage(BattleLobbyPage)
    await byId('battle-type-spm').trigger('click')
    expect(wrapper!.findAll('[data-testid="battle-spm-subject"]')).toHaveLength(1)
    await byId('battle-spm-subject').trigger('click')
    expect(byId('battle-quick-match').attributes('disabled')).toBeUndefined()
  })

  it('the switch toggles its texts', async () => {
    await mountPage(BattleLobbyPage)
    expect(byId('battle-visibility-text').text()).toBe('Hanya pelajar gred sama boleh match')
    await byId('battle-visibility-switch').trigger('click')
    expect(byId('battle-visibility-text').text()).toBe(
      'Semua gred boleh nampak & mohon sertai anda',
    )
    expect(byId('battle-visibility-label').text()).toBe('Terbuka')
  })

  it('a start failure shows the banner and the close button clears it', async () => {
    api.startBattle.mockResolvedValue({ status: 422, headers: {}, body: {} })
    await mountPage(BattleLobbyPage)
    await wrapper!.findAll('[data-testid="battle-subject"]')[2]!.trigger('click')
    await byId('battle-quick-match').trigger('click')
    await flushPromises()
    expect(api.startBattle).toHaveBeenCalledWith(
      'quick-match',
      { question_type: 'biasa', open_to_all: false, subject_id: 3 },
      expect.anything(),
    )
    expect(byId('battle-error').text()).toBe('Ralat dari pelayan. Sila cuba lagi.')
    await byId('battle-error-close').trigger('click')
    expect(byId('battle-error').exists()).toBe(false)
  })

  it('opens the invitations modal by itself when the list is not empty', async () => {
    api.fetchInvitations.mockResolvedValue({
      status: 200,
      headers: {},
      body: { invitations: [{ uuid: 'i-1', sender_name: 'Murid A', sender_school: 'SK Satu' }] },
    })
    await mountPage(BattleLobbyPage)
    const modal = document.body.querySelector('[data-testid="battle-invitations-modal"]')
    expect(modal?.textContent).toContain('Murid A')
    expect(modal?.textContent).toContain('SK Satu')
  })
})

const row = (over: Partial<BattleListRow> = {}): BattleListRow => ({
  uuid: 'b-1',
  playerA: { id: 1, name: 'Pemain A', homeHere: true },
  scoreA: 800,
  scoreB: 0,
  playerB: { id: 2, name: 'Pemain B' },
  winner: 'A',
  createdAt: '2026-09-25T07:59:30Z',
  ...over,
})

describe('BattleRecentList colours (BR-M16-14)', () => {
  function render(r: BattleListRow) {
    wrapper = mount(BattleRecentList, { props: { rows: [r], homeColour: true } })
    return wrapper
  }

  it('home player A is slate, the winner score is green, B is blue', () => {
    const w = render(row())
    expect(w.get('[data-testid="battle-player-a"]').classes()).toContain('text-highlighted')
    expect(w.get('[data-testid="battle-score-a"]').classes()).toContain('text-success')
    expect(w.get('[data-testid="battle-score-b"]').classes()).not.toContain('text-success')
    expect(w.get('[data-testid="battle-player-b"]').classes()).toContain('text-primary-t')
  })

  it('a visiting player A is blue; a 0-0 row greens player B; a tie greens neither', () => {
    let w = render(row({ playerA: { id: 1, name: 'x', homeHere: false } }))
    expect(w.get('[data-testid="battle-player-a"]').classes()).toContain('text-primary-t')
    w.unmount()
    w = render(row({ scoreA: 0, scoreB: 0, winner: 'B' }))
    expect(w.get('[data-testid="battle-score-b"]').classes()).toContain('text-success')
    expect(w.get('[data-testid="battle-score-a"]').classes()).not.toContain('text-success')
    w.unmount()
    w = render(row({ scoreA: 8830, scoreB: 8830, winner: null }))
    expect(w.findAll('.text-success')).toHaveLength(0)
  })
})

describe('S5 history', () => {
  it('shows the empty card with the "Mula Battle" link', async () => {
    api.fetchBattleHistory.mockResolvedValue([])
    await mountPage(BattleHistoryPage, '/battle')
    expect(wrapper!.text()).toContain('Tiada sejarah battle')
    expect(wrapper!.text()).toContain('Mulakan pertandingan pertama anda sekarang!')
    expect(byId('battle-history-start').attributes('href')).toBe('/battle')
  })

  it('lists the rows when there are battles', async () => {
    api.fetchBattleHistory.mockResolvedValue([row()])
    await mountPage(BattleHistoryPage, '/battle')
    expect(wrapper!.findAll('[data-testid="battle-recent-row"]')).toHaveLength(1)
  })
})

describe('S2 leaderboard', () => {
  it('shows the empty row, then reloads the period when the pill changes', async () => {
    api.fetchStudentStandings.mockResolvedValue([])
    await mountPage(BattleLeaderboardPage, '/battle')
    expect(api.fetchStudentStandings.mock.calls[0]![0]).toBe('weekly')
    expect(byId('battle-leaderboard-empty').text()).toBe(
      'Belum ada data ranking. Mula battle untuk muncul di sini!',
    )
    api.fetchStudentStandings.mockResolvedValue([
      {
        rank: 1,
        userId: 9,
        name: 'Murid',
        school: 'SK',
        menang: 2,
        seri: 0,
        kalah: 2,
        ketepatan: 58,
        streak: 1,
        skor: 591,
      },
    ])
    await byId('battle-pill-monthly').trigger('click')
    await flushPromises()
    expect(api.fetchStudentStandings.mock.calls[1]![0]).toBe('monthly')
    expect(byId('battle-msk').text()).toBe('2/0/2')
    expect(wrapper!.text()).toContain('58%')
  })
})
