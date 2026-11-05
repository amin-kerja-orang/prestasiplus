/**
 * S0-T06 sidebar walk (R1, D115). Logs in as the pupil, the Guru and the Admin Sekolah, opens every
 * link the rendered sidebar shows and asserts: a non-empty title that is neither the 403 nor the
 * 404 title, no banned string (AC-X2-3), and no redirect away from the item's own path (exact path
 * match, query and trailing slash ignored, plus the by-design ALLOWED_REDIRECTS). Also asserts
 * the role-denial ACs AC-MUR-SH-7 and AC-SH-6 (a wrong-role URL answers the 403 page; one API call
 * answers 403 FORBIDDEN).
 *
 * Runs only under playwright.http.config.ts (real stack). Viewport-independent checks run at 1280;
 * one 375 test per role checks that the tab bar plus the "Lagi" panel reach the desktop link set
 * (minus the account links) and taps each link.
 *
 * Selectors: in the http build the pupil, Guru and Admin Sekolah render the Pembelajaran shell
 * (src/app/router/layouts.ts), not UserShell. Desktop: `[data-testid="pembelajaran-nav"] a[href]`, the
 * `UNavigationMenu` of the sidebar (section headings are label rows, not links, so `a[href]` is exactly
 * the openable items; the Kirkpatrick group is one row that opens its first page; account links live in
 * the footer menu). Phone: the bottom tab bar (`pembelajaran-bottom-nav`) plus the "Lagi" slide-over
 * (`pembelajaran-lagi-nav`). The links carry no `data-nav-id`, so rows are keyed by role and route path.
 *
 * Calibration: EXPECTED_RED is calibrated by the first CI run, per the card (D115). The S0-T06 PR
 * lists that as awaiting CI.
 *
 * Keep in step with `src/shells/__tests__/user-nav.test.ts` ("pins the sidebar item ids") and
 * `src/shells/pembelajaran/pembelajaran-nav.ts`: a nav change must update both, and EXPECTED_RED below.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { BrowserContext, Page, TestInfo } from '@playwright/test'

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

const SIDEBAR = '[data-testid="pembelajaran-nav"] a[href]'
const TABS = '[data-testid="pembelajaran-bottom-nav"] a[href]'
const LAGI = '[data-testid="pembelajaran-lagi-nav"] a[href]'
/** Account links: in the footer menu on desktop and the account block of "Lagi"; not part of the phone diff. */
const ACCOUNT_PATHS = ['/profile', '/tetapan', '/panduan', '/pusat-tuisyen/panduan', '/pusat-tuisyen/tiket']

interface Row {
  id: string
  route: string
  ownerCard: string
}

type WalkRole = 'student' | 'guru' | 'adminSekolah'

/**
 * Rows that are known red. They run as `test.fixme` (listed) and the walk fails if one now passes.
 * The first CI run decides further rows (D115): add one per failing item, `ownerCard` = the card of the
 * item's PRD module in docs/plan/r1-traceability.md. Calibrated by the CI runs of e08d5575 and 0daa328a.
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
  // Guru: the Laporan Mingguan row (S6-T01) was removed after its first CI run showed it passing.
  guru: [],
  adminSekolah: [
    // The route allows school_admin (S0-T06), but GET /api/analytics/classes is @Roles('admin','teacher')
    // (apps/api/src/modules/reports/performance/http/performance.controllers.ts:53), so the page shows 403.
    // S10-T04 change (2) adds school_admin to @Roles and canOpenClassAnalysis.
    { id: 'sa-analitik-adaptif', route: '/analitik/kelas', ownerCard: 'S10-T04' },
  ],
}

/**
 * Fewest sidebar links a role must show, from what `sidebarEntries(role)` yields with the scope on:
 * pupil 41 items (40 allowed here because the Cikgu ALESA item depends on VITE_ALESA_AI), Guru 26 items
 * minus the 7 Kirkpatrick pages plus their one row = 20, Admin Sekolah 23. An empty sidebar fails.
 */
const MIN_LINKS: Record<WalkRole, number> = { student: 40, guru: 20, adminSekolah: 23 }

const ROLE_LABEL: Record<WalkRole, string> = {
  student: 'pupil',
  guru: 'Guru',
  adminSekolah: 'Admin Sekolah',
}

interface Link {
  id: string
  href: string
  /** `target="_blank"` links open a new tab; the drawer click loop skips them. */
  blank: boolean
}

/**
 * Redirects that are by design, so they are not a "redirected" problem. Any other difference between
 * the link path and the final path is one. Derived from the m08 route files.
 */
const ALLOWED_REDIRECTS: { role: WalkRole; from: string; to: string; reason: string }[] = [
  {
    role: 'guru',
    from: '/analisa-item',
    to: '/analisa-item/kelas',
    // src/modules/m08-student-performance/routes/analisa-item.ts: analisaItemTarget(teacher)
    reason: 'teacher is sent to the class item analysis',
  },
  {
    role: 'adminSekolah',
    from: '/analisa-item',
    to: '/analisa-item/sekolah',
    // src/modules/m08-student-performance/routes/analisa-item.ts: analisaItemTarget(school_admin)
    reason: 'school admin is sent to the school item analysis',
  },
  {
    role: 'adminSekolah',
    from: '/prestasi',
    to: '/prestasi/sekolah',
    // src/modules/m08-student-performance/routes/prestasi.ts:29 redirects /prestasi for every role;
    // /prestasi/sekolah is the school admin's own dashboard (the pupil's row is EXPECTED_RED, S10-T01).
    reason: 'school admin Prestasi is the school dashboard',
  },
]

const normalPath = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, '') : p)

/** True when `finalPath` is the link's own path (query and trailing slash ignored) or an allowed redirect. */
function pathOk(role: WalkRole, from: string, finalPath: string): boolean {
  const f = normalPath(finalPath)
  if (f === normalPath(from)) return true
  return ALLOWED_REDIRECTS.some((r) => r.role === role && r.from === from && r.to === f)
}

async function collect(page: Page, selector: string): Promise<Link[]> {
  await expect(page.locator(selector).first()).toBeAttached({ timeout: 20_000 })
  const links = await page.locator(selector).evaluateAll((as) =>
    as.map((a) => ({
      id: (a.textContent ?? '').trim().replace(/\s+/g, ' '),
      href: new URL((a as HTMLAnchorElement).href).pathname,
      blank: (a as HTMLAnchorElement).target === '_blank',
    })),
  )
  const seen = new Set<string>()
  return links.filter((l) => !seen.has(l.href) && !!seen.add(l.href))
}

/** Opens one link and returns the list of problems found (empty = the link is healthy). */
async function problemsOf(page: Page, role: WalkRole, link: Link): Promise<string[]> {
  await gotoApi(page, link.href)
  const problems: string[] = []
  // The route has settled once the title is set and the shell's main landmark is visible. The
  // 403/404 outcome pages are rendered by LayoutHost and may have no main landmark: then it is a problem.
  try {
    await expect.poll(() => page.title(), { timeout: 8_000 }).not.toBe('')
  } catch {
    problems.push('empty title')
  }
  const main = page.locator('[data-testid="pembelajaran-main"], main, [role="main"]').first()
  try {
    await expect(main).toBeVisible({ timeout: 8_000 })
  } catch {
    problems.push('no visible main landmark')
  }
  const title = await page.title()
  if (title === FORBIDDEN_TITLE) problems.push('403 title')
  if (title === NOT_FOUND_TITLE) problems.push('404 title')
  const text = (await page.locator('body').innerText()).toLowerCase()
  for (const s of BANNED) if (text.includes(s)) problems.push(`banned string "${s}"`)
  const path = new URL(page.url()).pathname
  if (!pathOk(role, link.href, path)) problems.push(`redirected to ${path}`)
  return problems
}

/**
 * Signs in once per role and project, then reuses the saved cookies (also across retries, which run in a
 * new worker process). The login endpoint is throttled per identifier + address (THROTTLE_LOGIN_PER_MINUTE,
 * default 200 here), per address for failures (20 a minute) and per identifier for failures (100 per
 * 15 minutes; apps/api/src/modules/auth/login-throttle.service.ts), and the whole e2e suite shares one
 * address, so a login per test ended in 429 RATE_LIMITED. A saved session that the API no longer accepts
 * falls back to a fresh login.
 */
async function login(page: Page, role: ApiRole, info: TestInfo): Promise<void> {
  const dir = join(info.project.outputDir, 'r1-auth')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${info.project.name}-${role}.json`)
  try {
    const state = JSON.parse(readFileSync(file, 'utf8')) as { cookies: Parameters<BrowserContext['addCookies']>[0] }
    await page.context().addCookies(state.cookies)
    const res = await page.request.get('/api/session')
    if (res.status() === 200) {
      await gotoApi(page, '/')
      return
    }
    await page.context().clearCookies()
  } catch {
    // no saved session yet, or unreadable: sign in below
  }
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
  await page.context().storageState({ path: file })
}

// Project names of playwright.http.config.ts: mobile (375), tablet (768), desktop (1280).
const onDesktop = (info: TestInfo) => info.project.name === 'desktop'
const onPhone = (info: TestInfo) => info.project.name === 'mobile'

/** Every action and locator wait of a walk test is capped, so a broken shell fails fast instead of hanging. */
const WAIT_MS = 10_000
/** Wall-time budget per link: goto plus the settle waits. The walk stops at its budget and reports. */
const PER_LINK_MS = 6_000
const BASE_MS = 60_000

/**
 * Sidebar-only items: the pupil's Remedial has `surfaces: ['sidebar']` (src/shells/nav/user-nav.ts:219), so
 * the "Lagi" panel (drawer surface) does not list it by design. Not a phone gap.
 */
const SIDEBAR_ONLY_PATHS = ['/remedial/saya']

const ROLES: WalkRole[] = ['student', 'guru', 'adminSekolah']

for (const role of ROLES) {
  test.describe(`sidebar walk: ${ROLE_LABEL[role]}`, () => {
    test(`@api every sidebar link opens a real screen (${role}, 1280)`, async ({ page }, info) => {
      test.skip(!onDesktop(info), 'viewport-independent: runs on the desktop project only')
      page.setDefaultTimeout(WAIT_MS)
      await login(page, role, info)
      const links = await collect(page, SIDEBAR)
      const budget = links.length * PER_LINK_MS + BASE_MS
      test.setTimeout(budget + 30_000)
      const deadline = Date.now() + budget
      expect(links.length, `${role}: sidebar links rendered`).toBeGreaterThanOrEqual(MIN_LINKS[role])

      const red = EXPECTED_RED[role]
      const stale = red.filter((r) => !links.some((l) => l.href === r.route))
      // All problems are collected first and asserted once, so a slow link does not hide the others.
      const failures: string[] = stale.map(
        (r) => `${r.id} ${r.route} (${r.ownerCard}): EXPECTED_RED row matches no rendered sidebar link, remove the stale row`,
      )
      for (const link of links) {
        if (Date.now() > deadline) {
          failures.push(`${link.id} ${link.href}: not opened, the walk budget of ${budget} ms ran out`)
          continue
        }
        const row = red.find((r) => r.route === link.href)
        const problems = await problemsOf(page, role, link)
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

    test(`@api the tab bar and the Lagi panel reach the same links (${role}, 375)`, async ({ page }, info) => {
      test.skip(!onPhone(info), 'phone test runs on the mobile project only')
      test.setTimeout(240_000)
      page.setDefaultTimeout(WAIT_MS)
      await login(page, role, info)
      // The desktop sidebar is not in the DOM at 375: read its link set at 1280, then go back to 375.
      await page.setViewportSize({ width: 1280, height: 800 })
      const desktop = await collect(page, SIDEBAR)
      expect(desktop.length, `${role}: sidebar links rendered`).toBeGreaterThanOrEqual(MIN_LINKS[role])
      await page.setViewportSize({ width: 375, height: 812 })
      const lagiButton = page.locator('[data-nav-id="tab-lagi"]')
      await expect(lagiButton, 'the "Lagi" tab').toBeVisible({ timeout: WAIT_MS })
      const tabs = await collect(page, TABS)
      const lagiNav = page.getByTestId('pembelajaran-lagi-nav')
      const openLagi = async () => {
        await lagiButton.click({ timeout: WAIT_MS })
        await expect(lagiNav, 'the Lagi panel').toBeVisible({ timeout: WAIT_MS })
      }
      await openLagi()
      const lagi = await collect(page, LAGI)
      const reachable = new Set([...tabs, ...lagi].map((l) => l.href))
      const missing = desktop
        .map((l) => l.href)
        .filter((h) => !ACCOUNT_PATHS.includes(h) && !SIDEBAR_ONLY_PATHS.includes(h) && !reachable.has(h))
      expect(missing, 'desktop sidebar links not reachable from the tab bar or the Lagi panel').toEqual([])
      // Tap every Lagi link except new-tab links, expected-red rows and Log Keluar (it would end the
      // session); check it lands on its own path. The loop stops at its budget.
      const red = EXPECTED_RED[role]
      const failures: string[] = []
      const deadline = Date.now() + 150_000
      const targets = lagi.filter(
        (l) => !l.blank && l.href !== '/logout' && !red.some((r) => r.route === l.href),
      )
      // Each tap starts from a closed panel and opens it afresh, so a panel that is still closing (or a
      // click swallowed by its overlay) cannot make a tap hit the previous page. The link is found by its
      // href inside the open panel, never by position.
      const closeLagi = async () => {
        if (await lagiNav.isVisible()) {
          await page.keyboard.press('Escape')
          await expect(lagiNav).toBeHidden({ timeout: 5_000 })
        }
      }
      for (const link of targets) {
        if (Date.now() > deadline) {
          failures.push(`${link.id} ${link.href}: not tapped, the phone budget ran out`)
          continue
        }
        let landed = false
        for (let attempt = 0; attempt < 2 && !landed; attempt++) {
          try {
            await closeLagi()
            await openLagi()
            const a = lagiNav.locator(`a[href="${link.href}"]`).first()
            await a.scrollIntoViewIfNeeded({ timeout: 5_000 })
            await a.click({ timeout: 5_000 })
            await page.waitForURL((u) => pathOk(role, link.href, u.pathname), { timeout: 6_000 })
            landed = true
          } catch {
            // retried once from a closed panel
          }
        }
        if (!landed) failures.push(`${link.id} ${link.href}: landed on ${new URL(page.url()).pathname}`)
      }
      expect(failures, 'Lagi links that do not reach their own path').toEqual([])
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
      test(`@api ${role} on ${path} answers 403 (1280)`, async ({ page }, info) => {
        test.skip(!onDesktop(info), 'viewport-independent: runs on the desktop project only')
        await login(page, role, info)
        await expectForbidden(page, path)
      })
    }
  }

  // Expected-red: PRESTASI_SCHOOL_ROLES in m08 routes/prestasi.ts includes `student`, so the pupil
  // still opens the school dashboard. Owner: S10-T03.
  test.fixme('@api student on /prestasi/sekolah answers 403 (expected-red, owner S10-T03)', async ({ page }, info) => {
    await login(page, 'student', info)
    await expectForbidden(page, '/prestasi/sekolah')
  })

  test('@api GET /api/admin/pksk-access as the pupil answers 403 FORBIDDEN (1280)', async ({ page }, info) => {
    test.skip(!onDesktop(info), 'viewport-independent: runs on the desktop project only')
    await login(page, 'student', info)
    const res = await page.request.get('/api/admin/pksk-access')
    expect(res.status()).toBe(403)
    // Error body shape: `{ error: { code, message, requestId } }` (all-exceptions.filter.ts).
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN')
  })
})
