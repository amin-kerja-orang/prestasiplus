/**
 * M16-T1 routes: SRS M16 v1.6 §7 #1-#21 and #42-#50. The game endpoints #22-#41 and #51-#52 are M16-T2.
 */

import type { RouteDef } from '@/mock/define'

import { battleRoutes } from './battle'
import { leagueRoutes } from './leagues'
import { standingsRoutes } from './standings'
import { tournamentRoutes } from './tournaments'

export const m16Routes: RouteDef[] = [
  ...battleRoutes,
  ...standingsRoutes,
  ...tournamentRoutes,
  ...leagueRoutes,
]
