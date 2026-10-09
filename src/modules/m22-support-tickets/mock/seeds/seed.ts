/**
 * M22 seed (SRS M22 v1.1 §6.3, DL-M22-11). Default: two fictitious `dibuka` tickets (URS §1.5) owned by
 * users 3 and 4. Test profiles (never in the default seed): `tickets-extra`, `tickets-many`, chosen by the
 * override `ticketsProfile` (M02 already owns the override key `profile`).
 */

import { toIsoMyt } from '@/lib/time'
import type { SeedContext } from '@/mock/define'

import type { TicketStatus } from '../../api/types'
import { bindM22Clock } from '../repository/clock'
import { supportTicketsRepo } from '../repository/tickets'
import type { TicketRow } from '../tables/tables'

export const OVERRIDE_TICKETS_PROFILE = 'ticketsProfile'
export const PROFILE_TICKETS_EXTRA = 'tickets-extra'
export const PROFILE_TICKETS_MANY = 'tickets-many'
export const TICKET_PROFILES = [PROFILE_TICKETS_EXTRA, PROFILE_TICKETS_MANY] as const
export type TicketProfile = (typeof TICKET_PROFILES)[number]

export function isTicketProfile(v: unknown): v is TicketProfile {
  return typeof v === 'string' && (TICKET_PROFILES as readonly string[]).includes(v)
}

function row(
  id: number,
  userId: number,
  subject: string,
  body: string,
  status: TicketStatus,
  createdAt: string,
  adminReply: string | null = null,
): TicketRow {
  return { id, userId, subject, body, status, adminReply, createdAt, updatedAt: createdAt }
}

export const BASE_TICKETS: readonly TicketRow[] = [
  row(
    1,
    3,
    'Tidak dapat log masuk ke akaun',
    'Saya cuba log masuk tetapi sistem tidak menerima kata laluan saya.',
    'dibuka',
    '2026-09-24T10:12:00+08:00',
  ),
  row(
    2,
    4,
    'Soalan kuiz tidak dipaparkan',
    'Soalan Matematik Darjah 1 tidak muncul selepas saya tekan butang mula.',
    'dibuka',
    '2026-09-25T09:30:00+08:00',
  ),
]

const LONG_BODY =
  'Selepas saya kemas kini peranti, halaman latihan menjadi perlahan sekali. Setiap kali saya menekan jawapan, skrin terhenti beberapa saat sebelum soalan seterusnya muncul. Saya sudah cuba memulakan semula pelayar dan peranti tetapi masalah masih sama. Mohon pasukan sokongan menyemak akaun saya dan memberitahu apa yang perlu dilakukan.'

/** URS §1.5: #3-#9 (ascending createdAt between 2026-09-20 and 2026-09-25). */
export const EXTRA_TICKETS: readonly TicketRow[] = [
  row(
    3,
    2,
    'Masalah paparan markah',
    'Markah latihan saya tidak dikemas kini.',
    'dibuka',
    '2026-09-20T09:00:00+08:00',
  ),
  row(
    4,
    2,
    'Sijil tidak boleh dimuat turun',
    'Butang muat turun tidak berfungsi.',
    'dalam_proses',
    '2026-09-21T10:00:00+08:00',
  ),
  row(
    5,
    2,
    'Pertanyaan tentang pakej',
    'Bagaimana saya menaik taraf pakej?',
    'menunggu_balas',
    '2026-09-22T11:00:00+08:00',
  ),
  row(
    6,
    2,
    'Kata laluan tidak boleh ditukar',
    'Saya tidak dapat menukar kata laluan di halaman tetapan.',
    'selesai',
    '2026-09-23T12:00:00+08:00',
    'Terima kasih. Isu anda telah dibetulkan.\nSila cuba semula.',
  ),
  row(
    7,
    2,
    'Permintaan padam akaun lama',
    'Sila padam akaun lama saya.',
    'ditutup',
    '2026-09-24T08:30:00+08:00',
  ),
  row(8, 2, 'Halaman latihan perlahan', LONG_BODY, 'dibuka', '2026-09-25T08:00:00+08:00'),
  row(
    9,
    5,
    'Senarai kelas kosong',
    'Senarai kelas saya tidak dipaparkan.',
    'dibuka',
    '2026-09-25T09:00:00+08:00',
  ),
]

/** `tickets-many`: 203 more tickets of user 3 (ids 3-205), one minute apart before 2026-09-25T09:00:00+08:00. */
export function manyTickets(): TicketRow[] {
  const end = Date.parse('2026-09-25T09:00:00+08:00')
  const out: TicketRow[] = []
  for (let i = 0; i < 203; i += 1) {
    const at = toIsoMyt(end - (203 - i) * 60_000)
    out.push(row(3 + i, 3, `Tiket ujian ${String(i + 1)}`, 'Butiran tiket ujian.', 'dibuka', at))
  }
  return out
}

export function profileRows(profile: TicketProfile | null): TicketRow[] {
  if (profile === PROFILE_TICKETS_EXTRA) return [...EXTRA_TICKETS]
  if (profile === PROFILE_TICKETS_MANY) return manyTickets()
  return []
}

function profileOf(overrides: Readonly<Record<string, unknown>>): TicketProfile | null {
  const v = overrides[OVERRIDE_TICKETS_PROFILE]
  if (v === undefined) return null
  if (!isTicketProfile(v)) {
    throw new Error(
      `M22 override '${OVERRIDE_TICKETS_PROFILE}' must be one of ${TICKET_PROFILES.join(' | ')}, got ${JSON.stringify(v)}`,
    )
  }
  return v
}

export function seedTickets(ctx: SeedContext): void {
  bindM22Clock(ctx.clock)
  supportTicketsRepo.seed([...BASE_TICKETS, ...profileRows(profileOf(ctx.overrides))])
}

/** Finalise: the ids are unique and every owner is a user (checked through the repository). */
export function checkSeed(): void {
  const ids = new Set(supportTicketsRepo.all().map((t) => t.id))
  if (ids.size !== supportTicketsRepo.all().length) throw new Error('M22 seed: duplicate ticket id')
}
