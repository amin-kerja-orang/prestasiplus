/**
 * @api Forced password change (AM2-A1, DV-26) against the REAL API, for a pupil, a teacher and an
 * Admin Pusat.
 *
 * NEEDS THE ROUTER PATCH (half AZ: global guard that sends a session flagged `mustChangePassword`
 * to `/password/change`). The M01 part alone only adds the page; nothing sends a flagged account
 * there until the shared router/session files carry the patch. So the spec is OFF unless
 * `E2E_FORCED_PASSWORD=1` (an explicit switch, not a runtime guess: a missing redirect then fails
 * the job instead of hiding).
 *
 * The API no longer flags an admin-created account (R39: `POST /api/admin/users` answers
 * `mustChangePassword: false`); only migrated and bootstrapped accounts carry the flag, and no
 * endpoint sets it. The spec therefore creates the account through the API (one-time generated
 * password, held in memory only, never logged or attached) and then sets `users.must_reset_password`
 * with `psql` on the test database (`E2E_DATABASE_URL` only; local host or `E2E_DB_IS_TEST=1`; the
 * connection goes through PG* environment variables, never argv; never logged).
 *
 * Flow per role: the flagged user logs in and lands on the change page (not an error page; other
 * pages redirect back to it) -> a wrong current password shows the server 422 in the alert -> a right
 * one changes it, the session is read again (the stored CSRF equals the server's) and the user lands
 * on the role landing page; a reload stays there -> a fresh browser signs in with the new password
 * and goes straight to the landing page. No horizontal page scroll at 375 / 768 / 1280 (the config
 * projects). The account is deleted at the end.
 *
 * Passwords are typed into the page: trace, screenshot and video are off for this file (the repo is
 * public and artifacts are uploaded). Writes data: the e-mail is unique per run and project. Env:
 * E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PUSAT_PASS) for the Admin Pusat login.
 */

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { account, csrfOf, expectNoHScroll, newPeerContext } from './helpers'

/** Random per run, kept in memory only (never a known password on any target). */
const NEW_PASSWORD = `T${randomUUID()}!a1`

const CHANGE_URL = /\/password\/change(\?|$)/

interface RoleCase {
  label: string
  /** Body of `POST /api/admin/users` (besides name and e-mail). */
  create: Record<string, unknown>
  /** Landing page after the change (prototype scope home). */
  landing: RegExp
  /** A page of the role other than the change page, to prove the redirect back. */
  other: string
}

const ROLES: RoleCase[] = [
  {
    label: 'pupil',
    create: { roles: ['student'], grade: 10 },
    landing: /\/dashboard(\?|$)/,
    other: '/dashboard',
  },
  {
    label: 'teacher',
    create: { roles: ['teacher'], schoolId: '1' },
    landing: /\/guru(\?|$)/,
    other: '/guru',
  },
  {
    label: 'admin',
    create: { roles: ['admin'] },
    landing: /\/admin\/command-center(\?|$)/,
    other: '/admin/command-center',
  },
]

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
/** The e-mails this spec creates: `am2a1.<base36 time><project><role>@example.test`. */
const TEST_EMAIL = /^am2a1\.[a-z0-9]+@example\.test$/

/**
 * Flags the account the spec just created (the API cannot): `users.must_reset_password = true`, on
 * the TEST database `E2E_DATABASE_URL` only (no `DATABASE_URL` fallback). The host must be
 * localhost / 127.0.0.1 / ::1, or `E2E_DB_IS_TEST=1` must say that it is a throw-away database. The
 * connection goes to `psql` through the PG* environment variables only: no URL (and so no password)
 * in argv, in `ps` or in an error. The update is scoped to the id AND the e-mail just created and
 * must change exactly one row. A failure throws a fixed message (no command line, no stderr).
 */
function flagAccount(id: string, email: string): void {
  const raw = process.env.E2E_DATABASE_URL
  if (!raw) throw new Error('E2E_DATABASE_URL (the test database) is needed to flag the account')
  if (!/^\d+$/.test(id)) throw new Error('flagging refused: unexpected user id')
  if (!TEST_EMAIL.test(email)) throw new Error('flagging refused: not a test account e-mail')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('E2E_DATABASE_URL is not a valid URL')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!LOCAL_HOSTS.has(host) && process.env.E2E_DB_IS_TEST !== '1') {
    throw new Error(
      'flagging refused: the database host is not local (set E2E_DB_IS_TEST=1 for a test database)',
    )
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: host,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
  }
  let out: string
  try {
    out = execFileSync(
      'psql',
      [
        '-X',
        '-q',
        '-t',
        '-A',
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        `id=${id}`,
        '-v',
        `email=${email}`,
        '-f',
        '-',
      ],
      {
        env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        input:
          "update users set must_reset_password = true where id = :'id'::bigint and email = :'email' returning id;\n",
      },
    )
  } catch (err) {
    const status = (err as { status?: number | null }).status
    throw new Error(`flagging the test account failed (psql exit ${String(status ?? 'none')})`)
  }
  if (out.trim() !== id)
    throw new Error('flagging the test account changed an unexpected number of rows')
}

// Top level (a describe-level `use` forces a new worker): applies to this file only.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.describe('forced password change (AM2-A1) @api', () => {
  test.setTimeout(150_000)

  for (const role of ROLES) {
    test(`a flagged ${role.label} is sent to the change page, changes the password and lands on the role page @api`, async ({
      page,
      browser,
    }, info) => {
      test.skip(
        process.env.E2E_FORCED_PASSWORD !== '1',
        'needs the router patch that redirects a flagged session (PR #226 body)',
      )

      // Admin Pusat in its own context: creates the account and removes it at the end.
      const adminContext = await newPeerContext(browser, info)
      const adminPage = await adminContext.newPage()
      let peer: Awaited<ReturnType<typeof newPeerContext>> | null = null
      let id: string | null = null
      try {
        const { user: adminUser, pass: adminPass } = account('adminPusat')
        await loginViaUi(adminPage, adminUser, adminPass)

        const unique = `${Date.now().toString(36)}${info.project.name}${role.label}`
        const email = `am2a1.${unique}@example.test`
        const created = await adminPage.request.post('/api/admin/users', {
          headers: { 'x-csrf-token': await csrfOf(adminPage) },
          data: { name: `Ujian AM2A1 ${role.label}`, email, ...role.create },
        })
        // Cleanup is armed as soon as the id is known, before any assertion on the body.
        const body = (
          (await created.json().catch(() => ({}))) as {
            data?: { id?: string; generatedPassword?: string }
          }
        ).data
        id = body?.id ?? null
        expect(created.status(), 'POST /api/admin/users').toBe(201)
        const initialPassword = body?.generatedPassword ?? ''
        expect(initialPassword.length).toBeGreaterThan(0)
        flagAccount(id ?? '', email)

        // 1. Login lands on the change page (the router guard).
        await loginViaUi(page, email, initialPassword)
        await expect(page).toHaveURL(CHANGE_URL, { timeout: 15_000 })
        await expect(page.getByTestId('password-layout')).toBeVisible({ timeout: 20_000 })
        await expect(
          page.getByRole('heading', { level: 1, name: 'Tukar Kata Laluan' }),
        ).toBeVisible()
        await expect(
          page.getByText('Sila tukar kata laluan anda sebelum meneruskan.'),
        ).toBeVisible()
        await expect(page.getByText('Maaf, berlaku ralat')).toHaveCount(0)
        await expectNoHScroll(page)

        // 2. Any other page goes back to the change page.
        await gotoApi(page, role.other)
        await expect(page).toHaveURL(CHANGE_URL)

        // 3. A wrong current password shows the server 422 in the alert; the page stays.
        await page.getByTestId('change-current').fill('SalahSalah1')
        await page.getByTestId('change-new').fill(NEW_PASSWORD)
        await page.getByTestId('change-confirm').fill(NEW_PASSWORD)
        const wrong = page.waitForResponse(
          (r) => r.url().endsWith('/api/me/password') && r.request().method() === 'PUT',
          { timeout: 30_000 },
        )
        await page.getByTestId('change-submit').click()
        expect((await wrong).status(), 'PUT /api/me/password (wrong current)').toBe(422)
        await expect(page.getByTestId('change-alert')).toBeVisible()
        await expect(page).toHaveURL(CHANGE_URL)
        await expectNoHScroll(page)

        // 4. The right one: the password changes, the session is read again, the user lands on the role page.
        await page.getByTestId('change-current').fill(initialPassword)
        await page.getByTestId('change-new').fill(NEW_PASSWORD)
        await page.getByTestId('change-confirm').fill(NEW_PASSWORD)
        const changed = page.waitForResponse(
          (r) => r.url().endsWith('/api/me/password') && r.request().method() === 'PUT',
          { timeout: 30_000 },
        )
        const sessionRead = page.waitForResponse(
          (r) => r.url().endsWith('/api/session') && r.request().method() === 'GET',
          { timeout: 30_000 },
        )
        await page.getByTestId('change-submit').click()
        expect((await changed).status(), 'PUT /api/me/password').toBe(200)
        expect((await sessionRead).status(), 'GET /api/session').toBe(200)
        await expect(page).toHaveURL(role.landing, { timeout: 20_000 })
        await expect(page.getByText('Maaf, berlaku ralat')).toHaveCount(0)
        await expectNoHScroll(page)

        // 4b. The rotated CSRF token is the one in the stored session (later writes would fail otherwise).
        const serverCsrf = await csrfOf(page)
        const storedCsrf = await page.evaluate(
          () => (JSON.parse(localStorage.getItem('pp.auth') ?? '{}') as { csrf?: string }).csrf,
        )
        expect(storedCsrf, 'pp.auth.csrf equals GET /api/session csrf').toBe(serverCsrf)

        // 5. A reload stays on the role page (no flag, no redirect back).
        await page.reload()
        await expect(page).toHaveURL(role.landing)
        await expect(page.getByText('Maaf, berlaku ralat')).toHaveCount(0)
        await expectNoHScroll(page)

        // 6. A fresh browser signs in with the new password and goes straight to the role page.
        peer = await newPeerContext(browser, info)
        const peerPage = await peer.newPage()
        await loginViaUi(peerPage, email, NEW_PASSWORD)
        await expect(peerPage).toHaveURL(role.landing, { timeout: 20_000 })
      } finally {
        try {
          if (id !== null) {
            const removed = await adminPage.request.delete(`/api/admin/users/${id}`, {
              headers: { 'x-csrf-token': await csrfOf(adminPage) },
            })
            expect(removed.ok(), `DELETE /api/admin/users/${id} (cleanup)`).toBe(true)
          }
        } finally {
          await peer?.close().catch(() => undefined)
          await adminContext.close().catch(() => undefined)
        }
      }
    })
  }
})
