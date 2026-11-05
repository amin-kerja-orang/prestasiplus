/**
 * Smoke spec of the chain helpers (card S9-T06). Runs under playwright.http.config.ts (real stack, CI seed).
 * Checks the `UJI` record name with `R1_TEAM` set and unset, and that `loginAs` signs in each seed role with
 * the expected active role (the mapping used by S0-T02).
 */
import { expect, test } from '../../fixtures/api'

import { currentSession, isUjiRecord, loginAs, r1Session, r1Team, ujiName, type ApiRole } from './helpers'

const DAY = new Date('2026-11-05T10:00:00Z')

test.describe('chain helpers: UJI names', () => {
  // Pure checks: one project is enough.
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'runs on the desktop project only')
  })

  test('@api ujiName uses R1_TEAM and the ISO day', () => {
    const before = process.env.R1_TEAM
    try {
      process.env.R1_TEAM = 'team-x'
      expect(r1Team()).toBe('team-x')
      expect(ujiName('Bab Rantaian', DAY)).toBe('UJI team-x 2026-11-05 Bab Rantaian')
      delete process.env.R1_TEAM
      expect(r1Team()).toBe('lokal')
      expect(ujiName('Bab Rantaian', DAY)).toBe('UJI lokal 2026-11-05 Bab Rantaian')
    } finally {
      if (before === undefined) delete process.env.R1_TEAM
      else process.env.R1_TEAM = before
    }
  })

  test('@api isUjiRecord and r1Session', () => {
    expect(isUjiRecord(ujiName('x', DAY))).toBe(true)
    expect(isUjiRecord('Bab 1 Fungsi')).toBe(false)
    expect(isUjiRecord('uji kecil')).toBe(false)
    expect(r1Session()).toBe(process.env.R1_SESSION?.trim() || 'S-0')
  })
})

const ROLES: { role: ApiRole; active: string }[] = [
  { role: 'student', active: 'student' },
  { role: 'studentB', active: 'student' },
  { role: 'guru', active: 'teacher' },
  { role: 'adminSekolah', active: 'school_admin' },
  { role: 'adminPusat', active: 'admin' },
]

test.describe('chain helpers: loginAs', () => {
  for (const { role, active } of ROLES) {
    test(`@api loginAs(${role}) signs in as ${active}`, async ({ page }, info) => {
      // Viewport-independent: one project is enough.
      test.skip(info.project.name !== 'desktop', 'runs on the desktop project only')
      await loginAs(page, role)
      expect((await currentSession(page)).active.role).toBe(active)
    })
  }
})
