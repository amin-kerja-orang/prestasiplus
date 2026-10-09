// @vitest-environment jsdom
/**
 * Rooms `/papan-bijak/:code` and `/{game}/:code` (SRS M16 v1.6 FR-M16-66..70, §7.1; PROVISIONAL): waiting,
 * start, play, result, the 3 s poll, and the not-found outcomes (S7 → 404 page, S8–S12 → lobby + flash).
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useFlashStore } from '@/stores/flash'

import type { RoomGame, RoomView } from '../../api'
import RoomPage from '../../pages/RoomPage.vue'

const fetchRoom = vi.hoisted(() => vi.fn())
const joinRoom = vi.hoisted(() => vi.fn())
const startRoom = vi.hoisted(() => vi.fn())
const roomAction = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', () => ({ fetchRoom, joinRoom, startRoom, roomAction }))
vi.mock('@/composables/useSession', () => ({
  useSession: () => ({ user: ref({ id: 1 }) }),
}))

const notFound = () =>
  new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Bilik tidak dijumpai.' })

const room = (over: Partial<RoomView> = {}): RoomView => ({
  code: 'ABC123',
  game: 'perang-fakta',
  status: 'waiting',
  host: { id: 1, name: 'Admin Demo' },
  players: [
    { id: 1, name: 'Admin Demo', grade: 'Darjah 4', points: 0, isBot: false },
    { id: 2, name: 'Pelajar Dua', grade: 'Darjah 4', points: 0, isBot: true },
  ],
  settings: {
    subject: 'MATEMATIK',
    gradeLevel: 'DARJAH_4',
    matchMode: 'same_grade',
    gradeMin: null,
    gradeMax: null,
    maxPlayers: 6,
    minPlayers: 2,
  },
  state: null,
  ...over,
})

const playing = (over: Partial<RoomView> = {}): RoomView =>
  room({
    status: 'playing',
    state: { awaiting: 'answer', round: 1, total: 15, humanId: 1, log: [], roundSecondsLeft: 10 },
    round: 1,
    question: {
      id: 77,
      text: '5 + 3 → 8',
      options: [
        { id: 0, label: 'A', text: 'Betul' },
        { id: 1, label: 'B', text: 'Salah' },
      ],
    },
    ...over,
  })

let wrapper: VueWrapper | undefined

async function mountRoom(game: RoomGame = 'perang-fakta', code = 'abc123') {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: `/${game}`, component: { template: '<div />' } },
      { path: `/${game}/:code`, component: { template: '<div />' } },
      { path: '/permainan', component: { template: '<div />' } },
    ],
  })
  await router.push(`/${game}/${code}`)
  await router.isReady()
  wrapper = mount(RoomPage, {
    props: { game, code },
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

const get = (id: string) => wrapper!.get<HTMLElement>(`[data-testid="${id}"]`)

beforeEach(() => {
  for (const m of [fetchRoom, joinRoom, startRoom, roomAction]) m.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('waiting room (FR-M16-68)', () => {
  it('shows the code, the players with grade and "Hos", and the host "Mula" button', async () => {
    fetchRoom.mockResolvedValue(room())
    await mountRoom()
    expect(fetchRoom.mock.calls[0]![1]).toBe('ABC123') // the code is upper-cased
    expect(get('room-h1').text()).toBe('⚔️ Perang Fakta')
    expect(get('room-code').text()).toBe('Kod Bilik: ABC123')
    const players = wrapper!.findAll('[data-testid="room-player"]')
    expect(players).toHaveLength(2)
    expect(players[0]!.text()).toContain('Admin Demo')
    expect(players[0]!.text()).toContain('Darjah 4')
    expect(players[0]!.find('[data-testid="room-player-host"]').text()).toBe('Hos')
    expect(players[1]!.find('[data-testid="room-player-host"]').exists()).toBe(false)
    expect(get('room-start').text()).toBe('Mula')
    expect(get('room-start').attributes('disabled')).toBeUndefined()
  })

  it('disables "Mula" below the game minimum (Kuiz Relay needs 4)', async () => {
    fetchRoom.mockResolvedValue(
      room({ game: 'kuiz-relay', settings: { ...room().settings, minPlayers: 4, maxPlayers: 8 } }),
    )
    await mountRoom('kuiz-relay')
    expect(get('room-start').attributes('disabled')).toBeDefined()
  })

  it('a player who is not the host waits for the host', async () => {
    fetchRoom.mockResolvedValue(room({ host: { id: 2, name: 'Pelajar Dua' } }))
    await mountRoom()
    expect(wrapper!.find('[data-testid="room-start"]').exists()).toBe(false)
    expect(get('room-wait-host').text()).toBe('Menunggu hos memulakan permainan')
  })

  it('"Mula" starts the room and shows the question', async () => {
    fetchRoom.mockResolvedValue(room())
    startRoom.mockResolvedValueOnce(playing())
    await mountRoom()
    await get('room-start').trigger('click')
    await flushPromises()
    expect(startRoom).toHaveBeenCalledWith('perang-fakta', 'ABC123')
    expect(get('room-round').text()).toBe('Pusingan 1/15')
    expect(get('room-question-text').text()).toBe('5 + 3 → 8')
    expect(wrapper!.findAll('[data-testid="room-option"]').map((o) => o.text())).toEqual([
      'ABetul',
      'BSalah',
    ])
  })

  it('shows a refused start (409) in the red box', async () => {
    fetchRoom.mockResolvedValue(room())
    startRoom.mockRejectedValueOnce(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Pemain belum mencukupi.' }),
    )
    await mountRoom()
    await get('room-start').trigger('click')
    await flushPromises()
    expect(get('room-action-errors').text()).toContain('Pemain belum mencukupi.')
  })
})

describe('play and result (FR-M16-69, 70)', () => {
  it('posts an answer with the question id, the option and the seconds', async () => {
    fetchRoom.mockResolvedValue(playing())
    roomAction.mockResolvedValueOnce(
      playing({
        round: 2,
        state: { awaiting: 'answer', round: 2, total: 15, humanId: 1, log: [] },
      }),
    )
    await mountRoom()
    await wrapper!.findAll('[data-testid="room-option"]')[0]!.trigger('click')
    await flushPromises()
    expect(roomAction).toHaveBeenCalledTimes(1)
    expect(roomAction.mock.calls[0]![2]).toMatchObject({
      type: 'answer',
      questionId: 77,
      optionId: 0,
    })
    expect(get('room-round').text()).toBe('Pusingan 2/15')
  })

  it('Perang Fakta shows the 10 s round countdown', async () => {
    fetchRoom.mockResolvedValue(playing())
    await mountRoom()
    expect(get('room-countdown').text()).toBe('10s')
  })

  it('Papan Bijak: the roll button posts {type: roll}; the board has 50 tiles', async () => {
    const board = Array.from({ length: 50 }, (_, i) =>
      i === 0 ? 'start' : i === 49 ? 'finish' : 'plain',
    )
    const pb = room({
      game: 'papan-bijak',
      status: 'playing',
      state: {
        awaiting: 'roll',
        round: 1,
        total: 50,
        humanId: 1,
        board,
        positions: { '1': 1, '2': 1 },
        log: [],
      },
    })
    fetchRoom.mockResolvedValue(pb)
    roomAction.mockResolvedValueOnce({
      ...pb,
      state: { ...pb.state!, positions: { '1': 5, '2': 1 }, log: ['roll:4'] },
    })
    await mountRoom('papan-bijak')
    expect(wrapper!.findAll('[data-testid="room-tile"]')).toHaveLength(50)
    await get('room-roll').trigger('click')
    await flushPromises()
    expect(roomAction.mock.calls[0]![2]).toEqual({ type: 'roll' })
    expect(get('room-dice').text()).toBe('🎲 Dadu: 4')
    expect(wrapper!.get('[data-tile="5"]').findAll('[data-testid="room-token"]')).toHaveLength(1)
  })

  it('a finished room shows the winner, the scores and the hub link', async () => {
    fetchRoom.mockResolvedValue(
      room({
        status: 'finished',
        result: {
          winnerId: 1,
          winnerName: 'Admin Demo',
          mvpId: null,
          scores: [
            { userId: 1, name: 'Admin Demo', points: 9, correct: 9 },
            { userId: 2, name: 'Pelajar Dua', points: 6, correct: 6 },
          ],
        },
      }),
    )
    await mountRoom()
    expect(get('room-result-title').text()).toBe('🏆 Admin Demo menang!')
    expect(wrapper!.findAll('[data-testid="room-scores"] li')).toHaveLength(2)
    expect(get('room-hub').text()).toBe('🎮 Hub')
    expect(get('room-hub').attributes('href')).toBe('/permainan')
  })

  it('Kuiz Relay result: team winner and MVP', async () => {
    fetchRoom.mockResolvedValue(
      room({
        game: 'kuiz-relay',
        status: 'finished',
        players: [
          { id: 1, name: 'Admin Demo', grade: 'Darjah 4', points: 12, isBot: false, team: 1 },
          { id: 2, name: 'Pelajar Dua', grade: 'Darjah 4', points: 40, isBot: true, team: 2 },
        ],
        result: { winnerId: null, winnerName: null, mvpId: 2, scores: [] },
      }),
    )
    await mountRoom('kuiz-relay')
    expect(get('room-result-title').text()).toBe('🏆 Pasukan B menang!')
    expect(get('room-mvp').text()).toBe('MVP: Pelajar Dua')
  })
})

describe('polling (§7.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  })

  it('polls #26 every 3 s while the room is open and applies the bot that joined', async () => {
    fetchRoom.mockResolvedValueOnce(room({ players: [room().players[0]!] }))
    fetchRoom.mockResolvedValue(room())
    await mountRoom()
    expect(wrapper!.findAll('[data-testid="room-player"]')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2999)
    expect(fetchRoom).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(fetchRoom).toHaveBeenCalledTimes(2)
    expect(wrapper!.findAll('[data-testid="room-player"]')).toHaveLength(2)
  })

  it('stops polling when the room finishes and clears every timer on unmount', async () => {
    fetchRoom.mockResolvedValueOnce(room())
    fetchRoom.mockResolvedValue(
      room({
        status: 'finished',
        result: { winnerId: null, winnerName: null, mvpId: null, scores: [] },
      }),
    )
    await mountRoom()
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(fetchRoom).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(12_000)
    expect(fetchRoom).toHaveBeenCalledTimes(2)
    wrapper!.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skips a tick while the previous poll is still running', async () => {
    fetchRoom.mockResolvedValueOnce(room())
    fetchRoom.mockImplementation(() => new Promise(() => undefined))
    await mountRoom()
    await vi.advanceTimersByTimeAsync(12_000)
    expect(fetchRoom).toHaveBeenCalledTimes(2) // the initial load and the first poll
  })
})

describe('server clocks (BR-M16-20)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  })

  const withLeft = (left: number): RoomView =>
    playing({
      state: {
        awaiting: 'answer',
        round: 1,
        total: 15,
        humanId: 1,
        log: [],
        roundSecondsLeft: left,
      },
    })

  it('counts the Perang Fakta round down from the server value and resyncs on the poll', async () => {
    fetchRoom.mockResolvedValueOnce(withLeft(10))
    fetchRoom.mockResolvedValue(withLeft(4)) // the poll at 3 s: the server says 4, not 7
    await mountRoom()
    expect(get('room-countdown').text()).toBe('10s')
    await vi.advanceTimersByTimeAsync(2000)
    expect(get('room-countdown').text()).toBe('8s')
    await vi.advanceTimersByTimeAsync(1000) // the poll lands
    await flushPromises()
    // 4 s from the server (3 s if the 1 s tick of the same instant ran right after the poll), never 7 s.
    expect(['4s', '3s']).toContain(get('room-countdown').text())
  })

  it('a reload keeps the clock: it starts from what the server says, not from 10', async () => {
    fetchRoom.mockResolvedValue(withLeft(3))
    await mountRoom()
    expect(get('room-countdown').text()).toBe('3s')
  })

  it('sends the explicit no-vote (optionId null, 0 s) when the round clock reaches 0', async () => {
    fetchRoom.mockResolvedValue(withLeft(2))
    roomAction.mockResolvedValueOnce(withLeft(10))
    await mountRoom()
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()
    expect(roomAction).toHaveBeenCalledTimes(1)
    expect(roomAction.mock.calls[0]![2]).toEqual({
      type: 'answer',
      questionId: 77,
      optionId: null,
      seconds: 0,
    })
    expect(wrapper!.find('[data-testid="room-action-errors"]').exists()).toBe(false)
  })

  it('stays silent when the no-vote loses the race with the server clock', async () => {
    fetchRoom.mockResolvedValue(withLeft(1))
    roomAction.mockRejectedValueOnce(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Soalan tidak sepadan.' }),
    )
    await mountRoom()
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(roomAction).toHaveBeenCalledTimes(1)
    expect(wrapper!.text()).not.toContain('Soalan tidak sepadan.')
  })

  it('runs the 1 s ticker only while the game plays', async () => {
    fetchRoom.mockResolvedValue(room())
    startRoom.mockResolvedValueOnce(playing())
    await mountRoom()
    expect(vi.getTimerCount()).toBe(1) // the 3 s poll only
    await get('room-start').trigger('click')
    await flushPromises()
    expect(vi.getTimerCount()).toBe(2)
    wrapper!.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
  })

  it('Teka Silang Kata shows the server clock and never loops answers at 0:00', async () => {
    const tk = (left: number): RoomView =>
      room({
        game: 'teka-silang-kata',
        status: 'playing',
        state: { awaiting: 'answer', round: 1, total: 8, humanId: 1, log: [], secondsLeft: left },
        round: 1,
        question: { id: 5, text: 'Cat?', options: [] },
      })
    fetchRoom.mockResolvedValueOnce(tk(2))
    fetchRoom.mockResolvedValue(tk(0)) // the re-read at 0:00
    await mountRoom('teka-silang-kata')
    expect(get('room-clock').text()).toBe('⏱️ 0:02')
    await vi.advanceTimersByTimeAsync(1000)
    expect(get('room-clock').text()).toBe('⏱️ 0:01')
    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()
    expect(get('room-clock').text()).toBe('⏱️ 0:00')
    expect(roomAction).not.toHaveBeenCalled() // the server ends the game; the page only re-reads it
    expect(fetchRoom.mock.calls.length).toBeGreaterThan(1)
  })
})

describe('not found (FR-M16-66, DV-M16-07)', () => {
  it('S8–S12: an unknown code goes back to the lobby with the flash', async () => {
    fetchRoom.mockRejectedValue(notFound())
    joinRoom.mockRejectedValue(notFound())
    const { router } = await mountRoom('perang-fakta', 'XXXXXX')
    await flushPromises()
    expect(joinRoom).toHaveBeenCalledWith('perang-fakta', 'XXXXXX')
    expect(router.currentRoute.value.fullPath).toBe('/perang-fakta')
    expect(useFlashStore().pending).toEqual({ type: 'error', message: 'Bilik tidak dijumpai.' })
  })

  it('S7: an unknown code is the 404 page', async () => {
    fetchRoom.mockRejectedValue(notFound())
    joinRoom.mockRejectedValue(notFound())
    const { router } = await mountRoom('papan-bijak', 'XXXXXX')
    expect(useRouteOutcome().value).toBe(404)
    expect(router.currentRoute.value.fullPath).toBe('/papan-bijak/XXXXXX')
  })

  it('a non-player of a joinable room is joined, then the room opens (hub chip link)', async () => {
    fetchRoom.mockRejectedValueOnce(notFound())
    fetchRoom.mockResolvedValue(room())
    joinRoom.mockResolvedValueOnce({ code: 'ABC123' })
    await mountRoom()
    expect(joinRoom).toHaveBeenCalledWith('perang-fakta', 'ABC123')
    expect(get('room-code').text()).toBe('Kod Bilik: ABC123')
  })

  it('another load failure shows the red box', async () => {
    fetchRoom.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    await mountRoom()
    expect(get('room-error').text()).toContain('Maaf, berlaku ralat.')
  })
})
