/**
 * M21 test hooks (`window.__mock`, dev and e2e builds; SRS M21 v1.2 §6.13; hook names are global).
 * Test-only fixtures never enter the default seed; `mock.reset()` discards them.
 *
 * | Hook | Effect |
 * |---|---|
 * | `m21LoadFixture(name)` | `'m21-many'`: 19 extra `SUSPENDED` sponsors (ids 12-30, for paging); `'m21-approved'`: sponsor 6 becomes `APPROVED`; `'m21-pending'`: one `PENDING` sponsor (id 12, no login yet: the sponsor anchors of XR-M21-01 are not in M02) |
 * | `m21MailLog()` | the simulated e-mail notices `{to, sponsorId, status, at}` (D14); recorded by the status transitions of M21-T3 |
 *
 * A bad call throws a `RangeError` (the hook promise rejects). Fixture sponsors are fictitious.
 */

import { mailLog, type MailNotice } from './mail-log'
import { nowIso } from './repository/clock'
import { sponsorsRepo } from './repository/sponsors'
import type { SponsorRow } from './repository/types'

function fixtureSponsor(id: number, name: string, status: SponsorRow['status']): SponsorRow {
  return {
    id,
    userId: null,
    name,
    category: 'SYARIKAT_SWASTA',
    description: null,
    tagline: null,
    website: null,
    logoUrl: null,
    registrationNumber: null,
    contactPersonName: null,
    contactPersonPosition: null,
    contactEmail: null,
    contactPhone: null,
    address: null,
    city: null,
    state: null,
    postcode: null,
    status,
    createdAt: nowIso(),
  }
}

function m21LoadFixture(name: string): { loaded: string } {
  if (name === 'm21-many') {
    const rows: SponsorRow[] = []
    for (let id = 12; id <= 30; id += 1) {
      rows.push(fixtureSponsor(id, `Penaja Ujian ${String(id - 11)}`, 'SUSPENDED'))
    }
    sponsorsRepo.insertMany(rows)
    return { loaded: name }
  }
  if (name === 'm21-approved') {
    if (!sponsorsRepo.patch(6, { status: 'APPROVED' })) throw new RangeError('sponsor 6 is missing')
    return { loaded: name }
  }
  if (name === 'm21-pending') {
    sponsorsRepo.insertMany([fixtureSponsor(12, 'Penaja Menunggu Ujian', 'PENDING')])
    return { loaded: name }
  }
  throw new RangeError(
    `m21LoadFixture: unknown fixture '${name}' (m21-many | m21-approved | m21-pending)`,
  )
}

function m21MailLog(): MailNotice[] {
  return mailLog()
}

/** The plugin's `hooks` field. */
export const m21Hooks = { m21LoadFixture, m21MailLog }
