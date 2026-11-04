/**
 * S0-T06 sidebar walk (R1, D115). Logs in as the pupil, the Guru and the Admin Sekolah, opens every
 * link the rendered sidebar shows and asserts: a non-empty title that is neither the 403 nor the
 * 404 title, no banned string (AC-X2-3), and no redirect away from the item's own path. Also asserts
 * the role-denial ACs AC-MUR-SH-7 and AC-SH-6 (a wrong-role URL answers the 403 page; one API call
 * answers 403 FORBIDDEN).
 *
 * Runs only under playwright.http.config.ts (real stack). Viewport-independent checks run at 1280;
 * one 375 test per role opens the drawer and checks the sidebar link set is reachable there.
 *
 * Selector: `[data-testid="shell-user-sidebar"] nav a[data-nav-id]`. `UserNavList` puts a stable
 * `data-nav-id` (the nav item id of user-nav.ts) on every item link, including the children of a
 * collapsed group (`v-show`, so they stay in the DOM). Reading `href` from the DOM therefore needs no
 * group expansion and excludes the logo, profile and logout links that have no `data-nav-id`.
 *
 * Keep in step with `src/shells/__tests__/user-nav.test.ts` ("pins the sidebar item ids"): a nav
 * change must update both, and EXPECTED_RED below.
 */
import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { account, FORBIDDEN_TITLE, type ApiRole } from '../api/helpers'
import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'

/** The 404 page title (`NOT_FOUND_TITLE`, src/app/router/outcome.ts; not importable from e2e). */
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

/**
 * Banned strings of AC-X2-3 (docs/prd/r1/40-cross-cutting.md), compared case-insensitively. Read at
 * load time by the S0-T04 loader so the walk and the repository check never drift. The allow-list
 * rows of AC-X2-3 are not on any sidebar screen.
 */
// @ts-expect-error the loader is plain .mjs without type declarations
import { loadBannedStrings } from '../../scripts/check-placeholders.mjs'
const BANNED: string[] = (
  loadBannedStrings(readFileSync(new URL('../../docs/prd/r1/40-cross-cutting.md', import.meta.url), 'utf8')) as string[]
).map((s) => s.toLowerCase())

const SIDEBAR = '[data-testid="shell-user-sidebar"] nav a[data-nav-id]'
const DRAWER = '[data-testid="shell-user-drawer"] nav a[data-nav-id]'

interface Row {
  id: string
  route: string
  ownerCard: string
}

type WalkRole = 'student' | 'guru' | 'adminSekolah'

/**
 * Rows that are known red. They run as `test.fixme` (listed) and the walk fails if one now passes.
 * The first CI run decides further rows (D115): add one per failing item, `ownerCard` = the card of the
 * item's PRD module in docs/plan/r1-traceability.md. AWAITS THE FIRST CI RUN (no stack was available
 * when this was written).
 *
 * The Alat Soalan tool items of Guru (`GURU_TOOLS` in src/shells/nav/out-of-scope.ts: /guru/soalan-guru,
 * /guru/databank, /guru/kertas-peperiksaan, /guru/soalan-berstruktur ...; S6-T16..S6-T20) are hidden by
 * `navFor` while the prototype scope is on, so they are not rendered and have no row yet. Add a row per
 * route when a card un-hides one.
 */
const EXPECTED_RED: Record<WalkRole, Row[]> = {
  student: [
    // /prestasi redirects to the school dashboard (m08 routes/prestasi.ts:29), fixed by S10-T01.
    { id: 'prestasi', route: '/prestasi', ownerCard: 'S10-T01' },
    // The item is visible, but the m08 route currently answers 403 (Akses Ditolak) for the pupil until S10-T09 / S10-T03 land.
    { id: 'headcount', route: '/headcount', ownerCard: 'S10-T09' },
    { id: 'analisa-item', route: '/analisa-item', ownerCard: 'S10-T03' },
  ],
  guru: [
    // Laporan Mingguan screen of the teacher (M11-T5 S8) is not built yet.
    { id: 't-laporan-mingguan', route: '/guru/laporan-mingguan-kelas', ownerCard: 'S6-T01' },
  ],
  adminSekolah: [],
}

/** Fewest sidebar links a role must show (nav data: 41 / 26 / 23 ids); an empty sidebar fails. */
const MIN_LINKS: Record<WalkRole, number> = { student: 30, guru: 20, adminSekolah: 18 }

const ROLE_LABEL: Record<WalkRole, string> = {
  student: 'pupil',
  guru: 'Guru',
  adminSekolah: 'Admin Sekolah',
}

interface Link {
  id: string
  href: string
}

async function collect(page: Page, selector: string): Promise<Link[]> {
  await expect(page.locator(selector).first()).toBeAttached({ timeout: 20_000 })
  const links = await page.locator(selector).evaluateAll((as) =>
    as.map((a) => ({
      id: a.getAttribute('data-nav-id') ?? '',
      href: new URL((a as HTMLAnchorElement).href).pathname,
    })),
  )
  const seen = new Set<string>()
  return links.filter((l) => !seen.has(l.href) && !!seen.add(l.href))
}

/** Opens one link and returns the list of problems found (empty = the link is healthy). */
async function problemsOf(page: Page, link: Link): Promise<string[]> {
  await gotoApi(page, link.href)
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  const problems: string[] = []
  const title = await page.title()
  if (!title.trim()) problems.push('empty title')
  if (title === FORBIDDEN_TITLE) problems.push('403 title')
  if (title === NOT_FOUND_TITLE) problems.push('404 title')
  const text = (await page.locator('body').innerText()).toLowerCase()
  for (const s of BANNED) if (text.includes(s)) problems.push(`banned string "${s}"`)
  const path = new URL(page.url()).pathname
  if (!path.startsWith(link.href)) problems.push(`redirected to ${path}`)
  return problems
}

async function login(page: Page, role: ApiRole): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1280
const isPhone = (page: Page) => page.viewportSize()?.width === 375

const ROLES: WalkRole[] = ['student', 'guru', 'adminSekolah']

for (const role of ROLES) {
  test.describe(`sidebar walk: ${ROLE_LABEL[role]}`, () => {
    test(`@api every sidebar link opens a real screen (${role}, 1280)`, async ({ page }) => {
      test.skip(!isDesktop(page), 'viewport-independent: runs at 1280 only')
      test.setTimeout(300_000)
      await login(page, role)
      const links = await collect(page, SIDEBAR)
      expect(links.length, `${role}: sidebar links rendered`).toBeGreaterThanOrEqual(MIN_LINKS[role])

      const red = EXPECTED_RED[role]
      const stale = red.filter((r) => !links.some((l) => l.href === r.route))
      expect(
        stale.map((r) => `${r.id} ${r.route} (${r.ownerCard})`),
        'EXPECTED_RED rows that match no rendered sidebar link: remove the stale rows',
      ).toEqual([])

      const failures: string[] = []
      for (const link of links) {
        const row = red.find((r) => r.route === link.href)
        const problems = await problemsOf(page, link)
        if (row) {
          if (problems.length === 0) {
            failures.push(`${link.id} ${link.href}: now passes, remove its EXPECTED_RED row (${row.ownerCard})`)
          }
        } else if (problems.length > 0) {
          failures.push(`${link.id} ${link.href}: ${problems.join('; ')}`)
        }
      }
      expect(failures, 'sidebar links with problems').toEqual([])
    })

    for (const row of EXPECTED_RED[role]) {
      test.fixme(`@api expected-red ${row.id} ${row.route} (${role}) owner ${row.ownerCard}`, async () => {
        // Runs inside the walk above (it fails when this row starts passing); listed here as a progress meter.
      })
    }

    test(`@api the drawer reaches the same links (${role}, 375)`, async ({ page }) => {
      test.skip(!isPhone(page), 'drawer test runs at 375 only')
      await login(page, role)
      // The sidebar is in the DOM but hidden below lg: read its link set, then open the drawer.
      const sidebar = await collect(page, SIDEBAR)
      expect(sidebar.length, `${role}: sidebar links rendered`).toBeGreaterThanOrEqual(MIN_LINKS[role])
      await page.getByTestId('shell-user-hamburger').click()
      await expect(page.getByTestId('shell-user-drawer')).toBeVisible()
      const drawer = new Set((await collect(page, DRAWER)).map((l) => l.href))
      const missing = sidebar.map((l) => l.href).filter((h) => !drawer.has(h))
      expect(missing, 'sidebar links missing from the drawer').toEqual([])
      // One link of the drawer is reachable by tapping it (the rest are covered at 1280).
      const first = sidebar[0]!
      await page.locator(`${DRAWER}[href="${first.href}"]`).first().click()
      await expect.poll(() => new URL(page.url()).pathname).toMatch(new RegExp(`^${first.href}`))
    })
  })
}

test.describe('role denial (AC-MUR-SH-7, AC-SH-6)', () => {
  async function expectForbidden(page: Page, path: string): Promise<void> {
    await gotoApi(page, path)
    await expect(page).toHaveTitle(FORBIDDEN_TITLE)
    await expect(page.getByText('Akses Ditolak').first()).toBeVisible()
  }

  const DENIED: { role: WalkRole; paths: string[] }[] = [
    {
      role: 'student',
      paths: ['/guru/command-center', '/admin-sekolah/command-center', '/admin/studio'],
    },
    { role: 'guru', paths: ['/admin-sekolah/command-center'] },
    { role: 'adminSekolah', paths: ['/guru/command-center'] },
  ]

  for (const { role, paths } of DENIED) {
    for (const path of paths) {
      test(`@api ${role} on ${path} answers 403 (1280)`, async ({ page }) => {
        test.skip(!isDesktop(page), 'viewport-independent: runs at 1280 only')
        await login(page, role)
        await expectForbidden(page, path)
      })
    }
  }

  // Expected-red: PRESTASI_SCHOOL_ROLES in m08 routes/prestasi.ts includes `student`, so the pupil
  // still opens the school dashboard. Owner: S10-T03.
  test.fixme('@api student on /prestasi/sekolah answers 403 (expected-red, owner S10-T03)', async ({ page }) => {
    await login(page, 'student')
    await expectForbidden(page, '/prestasi/sekolah')
  })

  test('@api GET /api/admin/pksk-access as the pupil answers 403 FORBIDDEN (1280)', async ({ page }) => {
    test.skip(!isDesktop(page), 'viewport-independent: runs at 1280 only')
    await login(page, 'student')
    const res = await page.request.get('/api/admin/pksk-access')
    expect(res.status()).toBe(403)
    // Error body shape: `{ error: { code, message, requestId } }` (all-exceptions.filter.ts).
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN')
  })
})
