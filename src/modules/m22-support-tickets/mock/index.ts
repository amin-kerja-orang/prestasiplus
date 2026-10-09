/**
 * M22 mock plugin (SRS M22 v1.1 §6, §7). Owner of the `supportTickets` store (D12). Users are read through
 * M01 only; the `new_ticket` notification goes through the M01 `pushNotification` hook.
 *
 * Routes: #1 `GET /api/tiket`, #2 `POST /api/tiket`, #3 `GET /api/admin/tiket`, #4
 * `GET /api/admin/tiket/open-count`. Override `ticketsProfile` (`tickets-extra` | `tickets-many`; the key
 * `profile` belongs to M02). Bump `version` whenever the seed changes (overview §6.9).
 */

import { defineMockModule } from '@/mock/define'

import { ticketRoutes } from './handlers/tickets'
import { m22Hooks } from './hooks'
import { supportTicketsRepo } from './repository/tickets'
import { checkSeed, OVERRIDE_TICKETS_PROFILE, seedTickets } from './seeds/seed'
import { ticketsTable } from './tables/tables'

const plugin = defineMockModule({
  id: 'M22',
  dependsOn: ['core', 'M01'],
  version: 1,
  tables: { supportTickets: ticketsTable },
  repositories: { supportTickets: supportTicketsRepo },
  overrides: [OVERRIDE_TICKETS_PROFILE],
  seed: seedTickets,
  finalise: checkSeed,
  routes: [...ticketRoutes],
  hooks: m22Hooks,
})

export default plugin
