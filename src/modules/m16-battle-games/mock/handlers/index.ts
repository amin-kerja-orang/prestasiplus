/**
 * M16 routes: SRS M16 v1.6 §7 #1-#52 (T1: #1-#21 and #42-#50; T2: the game endpoints #22-#41 and #51-#52).
 */

import type { RouteDef } from '@/mock/define'

import { adminGamesRoutes } from './admin-games'
import { battleRoutes } from './battle'
import { gamesRoutes } from './games'
import { leagueRoutes } from './leagues'
import { standingsRoutes } from './standings'
import { tournamentRoutes } from './tournaments'

export const m16Routes: RouteDef[] = [
  ...battleRoutes,
  ...standingsRoutes,
  ...gamesRoutes,
  ...tournamentRoutes,
  ...leagueRoutes,
  ...adminGamesRoutes,
]
