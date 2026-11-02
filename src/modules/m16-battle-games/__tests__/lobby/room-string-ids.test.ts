// @vitest-environment jsdom
/**
 * The rooms in http mode: the real client and transport, with bodies shaped as the API returns them
 * (`GamesRoomView`: `host.id`, `players[].id` and `state.humanId` are `IdSchema` strings). The session
 * user goes through the real `withPrototypeIds`, which turns the API's `"12"` into the number 12.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { createHttpTransport, installTransport } from '@/api'
import { withPrototypeIds } from '@/stores/session'
import type { UserMe } from '@/stores/session-types'

import type { RoomGame } from '../../api'
import RoomPage from '../../pages/RoomPage.vue'

vi.mock('@/composables/useSession', () => ({
  useSession: () => {
    const wire = { id: '12', schoolId: '1', name: 'Pelajar Demo', role: 'student' }
    return { user: ref(withPrototypeIds(wire as unknown as UserMe, wire as unknown as UserMe)) }
  },
}))

const QUESTION = {
  id: '901',
  text: 'Soalan satu',
  options: [
    { id: 0, label: 'A', text: 'x' },
    { id: 1, label: 'B', text: 'y' },
  ],
}

const roomOf = (game: RoomGame, hostId: string) => ({
  code: 'ABC123',
  game,
  status: 'waiting',
  host: { id: hostId, name: 'Hos Contoh' },
  players: [
    { id: hostId, name: 'Hos Contoh', grade: 'Tingkatan 4', points: 0, isBot: false },
    { id: '88', name: 'Bot Contoh', grade: 'Tingkatan 4', points: 0, isBot: true },
  ],
  settings: {
    subject: 'MATEMATIK',
    gradeLevel: 'TINGKATAN_4',
    matchMode: 'same_grade',
    gradeMin: null,
    gradeMax: null,
    maxPlayers: 6,
    minPlayers: 2,
  },
  state: null,
})

const playingOf = (game: RoomGame, hostId: string) => ({
  ...roomOf(game, hostId),
  status: 'playing',
  round: 1,
  question: QUESTION,
  state: {
    awaiting: game === 'papan-bijak' ? 'roll' : 'answer',
    round: 1,
    total: 15,
    humanId: hostId,
    log: [],
  },
})

let sent: { method: string; url: string; body: unknown }[] = []
let wrapper: VueWrapper | undefined

function install(game: RoomGame, hostId: string): void {
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const url = input as string
        const method = init?.method ?? 'GET'
        const raw = init?.body as string | undefined
        sent.push({ method, url, body: raw ? JSON.parse(raw) : null })
        const data = method === 'GET' ? roomOf(game, hostId) : playingOf(game, hostId)
        return Promise.resolve(
          new Response(JSON.stringify({ data }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      },
    }),
  )
}

async function mountRoom(game: RoomGame): Promise<VueWrapper> {
  setActivePinia(createPinia())
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push(`/${game}/ABC123`)
  wrapper = mount(RoomPage, { props: { game, code: 'ABC123' }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

beforeEach(() => {
  sent = []
  vi.stubEnv('VITE_API_MODE', 'http')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllEnvs()
})

// Every game that shares `RoomPage`.
const GAMES: RoomGame[] = [
  'papan-bijak',
  'perang-fakta',
  'benteng-ilmu',
  'perlumbaan-matematik',
  'teka-silang-kata',
  'kuiz-relay',
]

describe.each(GAMES)('%s room with string ids from the API', (game) => {
  it('the host gets "Mula", not the wait line, and after it may act', async () => {
    install(game, '12')
    const w = await mountRoom(game)
    expect(has(w, 'room-wait-host')).toBe(false)
    expect(has(w, 'room-start')).toBe(true)

    await w.get('[data-testid="room-start"]').trigger('click')
    await flushPromises()
    expect(sent.at(-1)).toMatchObject({
      method: 'POST',
      url: `/api/games/${game}/rooms/ABC123/start`,
    })
    expect(has(w, 'room-playing')).toBe(true)
    expect(has(w, 'room-watching')).toBe(false)
    if (game === 'papan-bijak') expect(has(w, 'room-roll')).toBe(true)
  })

  it('a player who is not the host keeps the wait line', async () => {
    install(game, '99')
    const w = await mountRoom(game)
    expect(has(w, 'room-wait-host')).toBe(true)
    expect(has(w, 'room-start')).toBe(false)
  })
})
