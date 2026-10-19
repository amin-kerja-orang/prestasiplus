/**
 * M22 test hooks (`window.__mock`, dev and e2e builds only; SRS M22 v1.1 §6.4, FR-M22-51). The baseline has
 * no write path (BR-M22-16): these give tests a reply, another status, an orphan owner or an empty store.
 *
 * | Hook | Effect |
 * |---|---|
 * | `setTicketState(id, {status?, adminReply?})` | gives a ticket a reply or another status |
 * | `orphanTicketOwner(id)` | points a ticket to a missing user (cell "—") |
 * | `clearTickets()` | removes all tickets |
 * | `addAdminUser({isActive})` | creates another `admin` user through M01 |
 * | `m22LoadProfile(name)` | adds the rows of `tickets-extra` or `tickets-many` at run time |
 */

import { users } from '@/modules/m01-authentication/mock'

import { isTicketStatus, type TicketStatus } from '../api/types'
import { nowIso, nowMs } from './repository/clock'
import { supportTicketsRepo } from './repository/tickets'
import { isTicketProfile, profileRows, TICKET_PROFILES } from './seeds/seed'

function setTicketState(
  id: number,
  state: { status?: TicketStatus; adminReply?: string | null },
): { id: number } {
  if (state.status !== undefined && !isTicketStatus(state.status)) {
    throw new RangeError(`setTicketState: unknown status '${String(state.status)}'`)
  }
  const patch = {
    ...(state.status === undefined ? {} : { status: state.status }),
    ...(state.adminReply === undefined ? {} : { adminReply: state.adminReply }),
    updatedAt: nowIso(),
  }
  if (!supportTicketsRepo.patch(id, patch)) throw new RangeError(`ticket ${String(id)} is missing`)
  return { id }
}

function orphanTicketOwner(id: number): { id: number } {
  if (!supportTicketsRepo.patch(id, { userId: 99_999_999 })) {
    throw new RangeError(`ticket ${String(id)} is missing`)
  }
  return { id }
}

function clearTickets(): { cleared: true } {
  supportTicketsRepo.removeAll()
  return { cleared: true }
}

let adminSeq = 0

function addAdminUser(options: { isActive?: boolean } = {}): { id: number; email: string } {
  adminSeq += 1
  const email = `admin.tambahan${String(adminSeq)}@demo.test`
  const row = users.create(
    {
      name: `Admin Tambahan ${String(adminSeq)}`,
      email,
      role: 'admin',
      isActive: options.isActive ?? true,
    },
    nowMs(),
  )
  return { id: row.id, email }
}

function m22LoadProfile(name: string): { loaded: string } {
  if (!isTicketProfile(name)) {
    throw new RangeError(
      `m22LoadProfile: unknown profile '${name}' (${TICKET_PROFILES.join(' | ')})`,
    )
  }
  supportTicketsRepo.seed(profileRows(name))
  return { loaded: name }
}

export const m22Hooks = {
  setTicketState,
  orphanTicketOwner,
  clearTickets,
  addAdminUser,
  m22LoadProfile,
}
