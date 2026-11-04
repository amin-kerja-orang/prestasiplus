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
import { readFileSync } from 'node:fs'

import type { Page, TestInfo } from '@playwright/test'

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
    await expect.poll(() => page.title(), { timeout: 15_000 }).not.toBe('')
  } catch {
    problems.push('empty title')
  }
  const main = page.locator('[data-testid="pembelajaran-main"], main, [role="main"]').first()
  try {
    await expect(main).toBeVisible({ timeout: 15_000 })
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

async function login(page: Page, role: ApiRole): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

// Project names of playwright.http.config.ts: mobile (375), tablet (768), desktop (1280).
const onDesktop = (info: TestInfo) => info.project.name === 'desktop'
const onPhone = (info: TestInfo) => info.project.name === 'mobile'

const ROLES: WalkRole[] = ['student', 'guru', 'adminSekolah']

for (const role of ROLES) {
  test.describe(`sidebar walk: ${ROLE_LABEL[role]}`, () => {
    test(`@api every sidebar link opens a real screen (${role}, 1280)`, async ({ page }, info) => {
      test.skip(!onDesktop(info), 'viewport-independent: runs on the desktop project only')
      await login(page, role)
      const links = await collect(page, SIDEBAR)
      test.setTimeout(links.length * 20_000 + 60_000)
      expect(links.length, `${role}: sidebar links rendered`).toBeGreaterThanOrEqual(MIN_LINKS[role])

      const red = EXPECTED_RED[role]
      const stale = red.filter((r) => !links.some((l) => l.href === r.route))
      // All problems are collected first and asserted once, so a slow link does not hide the others.
      const failures: string[] = stale.map(
        (r) => `${r.id} ${r.route} (${r.ownerCard}): EXPECTED_RED row matches no rendered sidebar link, remove the stale row`,
      )
      for (const link of links) {
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
      await login(page, role)
      // The desktop sidebar is not in the DOM at 375: read its link set at 1280, then go back to 375.
      await page.setViewportSize({ width: 1280, height: 800 })
      const desktop = await collect(page, SIDEBAR)
      expect(desktop.length, `${role}: sidebar links rendered`).toBeGreaterThanOrEqual(MIN_LINKS[role])
      test.setTimeout(desktop.length * 15_000 + 60_000)
      await page.setViewportSize({ width: 375, height: 812 })
      const lagiButton = page.locator('[data-nav-id="tab-lagi"]')
      await expect(lagiButton).toBeVisible()
      const tabs = await collect(page, TABS)
      const openLagi = async () => {
        await lagiButton.click()
        await expect(page.getByTestId('pembelajaran-lagi-nav')).toBeVisible()
      }
      await openLagi()
      const lagi = await collect(page, LAGI)
      const reachable = new Set([...tabs, ...lagi].map((l) => l.href))
      const missing = desktop
        .map((l) => l.href)
        .filter((h) => !ACCOUNT_PATHS.includes(h) && !reachable.has(h))
      expect(missing, 'desktop sidebar links not reachable from the tab bar or the Lagi panel').toEqual([])
      // Tap every Lagi link (new-tab links and expected-red rows excluded); check it lands on its own path.
      const red = EXPECTED_RED[role]
      const failures: string[] = []
      for (const link of lagi.filter((l) => !l.blank && !red.some((r) => r.route === l.href))) {
        if (!(await page.getByTestId('pembelajaran-lagi-nav').isVisible())) await openLagi()
        await page.locator(`${LAGI}[href="${link.href}"]`).first().click()
        try {
          await expect
            .poll(() => pathOk(role, link.href, new URL(page.url()).pathname), { timeout: 15_000 })
            .toBe(true)
        } catch {
          failures.push(`${link.id} ${link.href}: landed on ${new URL(page.url()).pathname}`)
        }
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

  test('@api GET /api/admin/pksk-access as the pupil answers 403 FORBIDDEN (1280)', async ({ page }, info) => {
    test.skip(!onDesktop(info), 'viewport-independent: runs on the desktop project only')
    await login(page, 'student')
    const res = await page.request.get('/api/admin/pksk-access')
    expect(res.status()).toBe(403)
    // Error body shape: `{ error: { code, message, requestId } }` (all-exceptions.filter.ts).
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN')
  })
})
