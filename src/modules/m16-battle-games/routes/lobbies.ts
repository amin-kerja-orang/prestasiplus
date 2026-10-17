import type { RouteRecordRaw } from 'vue-router'

import type { RoomGame } from '../api'
import { LOBBY_GAMES, ROOM_GAME_META } from '../components/lobby/lobby-config'

/**
 * M16 route fragment: S7 `/papan-bijak`, S8–S12 the five lobbies and the provisional rooms `/{game}/:code`
 * (M16-T4). User shell, every logged-in role. Shell header = the game title with the user-portal
 * subtitle (DV-M16-01); tab title "{Game} — PRESTASIPLUS" (URS FN-M16-1.1.3, 1.1.4). The room routes keep
 * `:code` free (any string): the page resolves it (S7 → 404 page, S8–S12 → the lobby with the flash).
 */
const meta = (game: RoomGame) => ({
  layout: 'user' as const,
  access: 'auth' as const,
  title: `${ROOM_GAME_META[game].title} — PRESTASIPLUS`,
  header: { title: ROOM_GAME_META[game].title, subtitle: 'Selamat datang kembali' },
  module: 'M16' as const,
})

const room = (game: RoomGame): RouteRecordRaw => ({
  path: `/${game}/:code`,
  name: `m16.room.${game}`,
  component: () => import('../pages/RoomPage.vue'),
  props: (route) => ({ game, code: String(route.params.code) }),
  meta: meta(game),
})

const routes: RouteRecordRaw[] = [
  {
    path: '/papan-bijak',
    name: 'm16.lobby.papan-bijak',
    component: () => import('../pages/PapanBijakPage.vue'),
    meta: { ...meta('papan-bijak'), v2: true },
  },
  room('papan-bijak'),
  ...LOBBY_GAMES.flatMap((game): RouteRecordRaw[] => [
    {
      path: `/${game}`,
      name: `m16.lobby.${game}`,
      component: () => import('../pages/LobbyPage.vue'),
      props: { game },
      meta: meta(game),
    },
    room(game),
  ]),
]

export default routes
