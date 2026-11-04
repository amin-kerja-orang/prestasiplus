/**
 * @api stack smoke (card S0-T02, FR-X5-2): proves the stack that `npm run stack:up` builds boots with no manual step
 * and that the five seeded e2e accounts can sign in. For each account it posts the login, then reads the cookie
 * session and checks the active role. Run against the stack:
 *   npm run stack:up && npx playwright test -c playwright.http.config.ts e2e/api/stack-smoke.spec.ts
 * Passwords are resolved by `account(role)` (see helpers.ts); this spec never reads one itself.
 */

import { expect, test } from '../fixtures/api'
import { account, type ApiRole } from './helpers'

const ROLES: [ApiRole, string][] = [
  ['student', 'student'],
  ['studentB', 'student'],
  ['guru', 'teacher'],
  ['adminSekolah', 'school_admin'],
  ['adminPusat', 'admin'],
]

test.describe('stack smoke @api', () => {
  // argon2 on the real API makes a login take several seconds on a busy machine.
  test.setTimeout(60_000)

  for (const [role, activeRole] of ROLES) {
    test(`${role} signs in and the session is ${activeRole} @api`, async ({ page }) => {
      const a = account(role)
      const login = await page.request.post('/api/auth/login', { data: { identifier: a.user, password: a.pass } })
      expect(login.status(), 'POST /api/auth/login').toBe(200)
      const res = await page.request.get('/api/session')
      expect(res.status(), 'GET /api/session').toBe(200)
      const body = (await res.json()) as { data: { active: { role: string } } }
      expect(body.data.active.role).toBe(activeRole)
    })
  }
})
