/**
 * S0-T07 Admin Pusat sidebar check (R1, D107, D115; PRD 30 §3). Logs in as the seeded Admin Pusat
 * account and checks the Portal Pentadbiran sidebar against the target menu: group order, labels,
 * routes, the `LIVE` pill, and that every link opens a real screen (non-empty title, neither the 403
 * nor the 404 title, no banned string of AC-X2-3, final path equal to the link path). Also checks the
 * 375 drawer reaches the same link set and that 768 has no horizontal page scroll.
 *
 * Runs only under playwright.http.config.ts (real stack). Selectors: `pentadbiran-nav` (the sidebar
 * `UNavigationMenu`, desktop sidebar and the mobile drawer share it), `pentadbiran-menu-button`
 * (opens the drawer below lg), `pentadbiran-main`, `pentadbiran-nav-badge`.
 *
 * Keep in step with `src/shells/pentadbiran/menu.ts` (rendered items = built routes only): when a
 * card makes a route exist and flips its item to built, add the row to EXPECTED below.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { BrowserContext, Page, TestInfo } from '@playwright/test'

import { account, FORBIDDEN_TITLE } from '../api/helpers'
import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'

/** The 404 page title (`NOT_FOUND_TITLE`, src/app/router/outcome.ts; not importable from e2e). */
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

/** Banned strings of AC-X2-3 (same loader as the S0-T06 walk). */
// @ts-expect-error the loader is plain .mjs without type declarations
import { loadBannedStrings } from '../../scripts/check-placeholders.mjs'
const BANNED: string[] = (
  loadBannedStrings(readFileSync(new URL('../../docs/prd/r1/40-cross-cutting.md', import.meta.url), 'utf8')) as string[]
).map((s) => s.toLowerCase())

const NAV = '[data-testid="pentadbiran-nav"]'
const NAV_LINKS = `${NAV} a[href]`

interface Expected {
  group: string
  /** Heading row shown before the links that follow (a sub-group). */
  sub?: string
  label: string
  href: string
}

/**
 * The rendered Admin Pusat sidebar today, in order (PRD 30 §3.1, §3.2, §3.4; built routes only).
 * Kirkpatrick is one folded row labelled `Kirkpatrick` that opens its first page.
 */
const EXPECTED: Expected[] = [
  { group: '', label: 'Command Center', href: '/admin/command-center' },
  { group: '', label: 'Aktiviti Harian', href: '/admin/command-center/daily-activity' },
  { group: '', label: 'Audio KBAT', href: '/admin/audio-kbat' },
  { group: 'Analitik', label: 'Monitoring', href: '/admin/monitoring' },
  { group: 'Analitik', label: 'Kirkpatrick', href: '/admin/kirkpatrick' },
  { group: 'Kurikulum', label: 'Kurikulum', href: '/admin/curriculum' },
  { group: 'Kurikulum', label: 'Subjek', href: '/admin/subjects' },
  { group: 'Kurikulum', label: 'Tahap Pendidikan', href: '/admin/education-levels' },
  { group: 'Soalan', label: 'SPM', href: '/admin/spm' },
  { group: 'Soalan', label: 'Bank Soalan (Studio)', href: '/admin/studio' },
  { group: 'Soalan', label: 'Import & Semakan', href: '/admin/spm/soalan/ekstrak' },
  { group: 'Soalan', label: 'Set Builder', href: '/admin/studio/sets' },
  { group: 'Soalan', label: 'Audit Rajah', href: '/admin/soalan-gambar' },
  { group: 'Soalan', sub: 'Bank Lama (Legasi)', label: 'Senarai Soalan', href: '/admin/questions' },
  { group: 'Soalan', sub: 'Bank Lama (Legasi)', label: 'Soalan Berstruktur', href: '/admin/structured-questions' },
  { group: 'Pengguna', label: 'Senarai Pengguna', href: '/admin/users' },
  { group: 'Pengguna', label: 'Sekolah', href: '/admin/schools' },
  { group: 'Pengguna', label: 'Langganan Sekolah', href: '/admin/school-subscriptions' },
  { group: 'Pengguna', label: 'Import Pelajar', href: '/admin/import-students' },
  { group: 'Pengguna', label: 'Pelajar Komplimen', href: '/admin/comp-students' },
  { group: 'Pengguna', label: 'Import Pengguna', href: '/admin/users/bulk-import' },
  { group: 'SPM', label: 'Databank Soalan', href: '/admin/spm/databank' },
  { group: 'Premium', label: 'PKSK Soalan', href: '/admin/pksk/questions' },
  { group: 'Premium', label: 'PKSK Akses', href: '/admin/pksk/access' },
  { group: 'Kandungan', label: 'Artikel', href: '/admin/articles' },
  { group: 'Kandungan', label: 'Banner', href: '/admin/banners' },
  { group: 'Kandungan', label: 'Nota', href: '/admin/notes' },
  { group: 'Kandungan', label: 'Upload Screenshot', href: '/admin/tools/screenshots' },
  { group: 'Sistem', label: 'Tiket Bantuan', href: '/admin/tiket' },
]

/** Group headings in order, with the sub heading row inside Soalan. The top shortcuts have none. */
const HEADINGS = [
  'Analitik',
  'Kurikulum',
  'Soalan',
  'Bank Lama (Legasi)',
  'Pengguna',
  'SPM',
  'Premium',
  'Kandungan',
  'Sistem',
]

/**
 * Redirects that are by design (link path -> final path). None are known for Admin Pusat yet; the
 * first CI run calibrates (D115): add a row with its reason, never widen the comparison.
 */
const ALLOWED_REDIRECTS: { from: string; to: string; reason: string }[] = []

/** Rows known red: `test.fixme` list and a failure when one starts passing. Calibrated by CI. */
const EXPECTED_RED: { route: string; ownerCard: string }[] = []

interface Link {
  label: string
  href: string
}

const normalPath = (p: string): string => (p.length > 1 ? p.replace(/\/+$/, '') : p)
const pathOk = (from: string, finalPath: string): boolean =>
  normalPath(finalPath) === normalPath(from) ||
  ALLOWED_REDIRECTS.some((r) => r.from === from && r.to === normalPath(finalPath))

const onDesktop = (info: TestInfo) => info.project.name === 'desktop'
const onTablet = (info: TestInfo) => info.project.name === 'tablet'
const onPhone = (info: TestInfo) => info.project.name === 'mobile'

const WAIT_MS = 10_000
const PER_LINK_MS = 6_000
const BASE_MS = 60_000

/** Signs in once per project and reuses the saved cookies (the login endpoint is throttled). */
async function login(page: Page, info: TestInfo): Promise<void> {
  const dir = join(info.project.outputDir, 'r1-auth')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${info.project.name}-adminPusat.json`)
  try {
    const state = JSON.parse(readFileSync(file, 'utf8')) as { cookies: Parameters<BrowserContext['addCookies']>[0] }
    await page.context().addCookies(state.cookies)
    const res = await page.request.get('/api/session')
    if (res.status() === 200) {
      await gotoApi(page, '/admin/command-center')
      return
    }
    await page.context().clearCookies()
  } catch {
    // no saved session yet, or unreadable: sign in below
  }
  const { user, pass } = account('adminPusat')
  await loginViaUi(page, user, pass)
  await page.context().storageState({ path: file })
}

async function collect(page: Page): Promise<Link[]> {
  await expect(page.locator(NAV_LINKS).first()).toBeAttached({ timeout: 20_000 })
  const links = await page.locator(NAV_LINKS).evaluateAll((as) =>
    as.map((a) => ({
      // the LIVE pill is part of the link text; it is asserted separately
      label: (a.textContent ?? '').trim().replace(/\s+/g, ' ').replace(/ LIVE$/, ''),
      href: new URL((a as HTMLAnchorElement).href).pathname,
    })),
  )
  const seen = new Set<string>()
  return links.filter((l) => !seen.has(l.href) && !!seen.add(l.href))
}

/** Heading rows of the open sidebar, in DOM order: the text of `NAV` minus the link labels. */
async function headingsOf(page: Page): Promise<string[]> {
  return page.locator(NAV).evaluate((nav, wanted) => {
    const text = (nav as HTMLElement).innerText
    return (wanted as string[])
      .map((h) => ({ h, at: text.indexOf(h) }))
      .filter((x) => x.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((x) => x.h)
  }, HEADINGS)
}

function expectMenu(links: Link[], headings: string[]): void {
  expect(
    links.map((l) => [l.label, l.href]),
    'sidebar links, labels and order',
  ).toEqual(EXPECTED.map((e) => [e.label, e.href]))
  expect(headings, 'group headings in order').toEqual(HEADINGS)
}

async function problemsOf(page: Page, link: Link): Promise<string[]> {
  await gotoApi(page, link.href)
  const problems: string[] = []
  try {
    await expect.poll(() => page.title(), { timeout: 8_000 }).not.toBe('')
  } catch {
    problems.push('empty title')
  }
  try {
    await expect(page.locator('[data-testid="pentadbiran-main"], main, [role="main"]').first()).toBeVisible({
      timeout: 8_000,
    })
  } catch {
    problems.push('no visible main landmark')
  }
  const title = await page.title()
  if (title === FORBIDDEN_TITLE) problems.push('403 title')
  if (title === NOT_FOUND_TITLE) problems.push('404 title')
  const text = (await page.locator('body').innerText()).toLowerCase()
  for (const s of BANNED) if (text.includes(s)) problems.push(`banned string "${s}"`)
  const path = new URL(page.url()).pathname
  if (!pathOk(link.href, path)) problems.push(`redirected to ${path}`)
  return problems
}

/** Pages whose width is checked at every viewport (page scroll, not an inner scroller). */
const WIDTH_PAGES = ['/admin/command-center', '/admin/studio', '/admin/questions', '/admin/users', '/admin/spm']

async function overflowFailures(page: Page, hrefs: string[], width: number): Promise<string[]> {
  const failures: string[] = []
  for (const href of hrefs) {
    await gotoApi(page, href)
    await expect(page.locator('[data-testid="pentadbiran-main"], main').first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (overflow > 0) failures.push(`${href}: ${overflow}px of horizontal page scroll at ${width}`)
  }
  return failures
}

test.describe('Admin Pusat sidebar (S0-T07)', () => {
  test('@api the sidebar is the target menu and every link opens a real screen (1280)', async ({ page }, info) => {
    test.skip(!onDesktop(info), 'viewport-independent: runs on the desktop project only')
    page.setDefaultTimeout(WAIT_MS)
    await login(page, info)
    const links = await collect(page)
    expectMenu(links, await headingsOf(page))

    // Command Center carries the LIVE pill, and only it does.
    const badges = page.locator('[data-testid="pentadbiran-nav-badge"]')
    await expect(badges).toHaveCount(1)
    await expect(badges.first()).toHaveText('LIVE')
    await expect(page.locator(`${NAV} a[href="/admin/command-center"]`)).toContainText('LIVE')

    const budget = links.length * PER_LINK_MS + BASE_MS
    test.setTimeout(budget + 30_000)
    const deadline = Date.now() + budget
    const stale = EXPECTED_RED.filter((r) => !links.some((l) => l.href === r.route))
    const failures: string[] = stale.map((r) => `${r.route} (${r.ownerCard}): EXPECTED_RED row matches no sidebar link`)
    for (const link of links) {
      if (Date.now() > deadline) {
        failures.push(`${link.href}: not opened, the walk budget of ${budget} ms ran out`)
        continue
      }
      const red = EXPECTED_RED.find((r) => r.route === link.href)
      const problems = await problemsOf(page, link)
      if (red) {
        if (problems.length === 0) failures.push(`${link.href}: now passes, remove its EXPECTED_RED row (${red.ownerCard})`)
      } else if (problems.length > 0) {
        failures.push(`${link.label} ${link.href}: ${problems.join('; ')}`)
      }
    }
    expect(failures, 'sidebar links with problems').toEqual([])
  })

  for (const row of EXPECTED_RED) {
    test.fixme(`@api expected-red ${row.route} owner ${row.ownerCard}`, async () => {
      // Runs inside the walk above (it fails when this row starts passing); listed as a progress meter.
    })
  }

  test('@api the 375 drawer opens and holds the same links (375)', async ({ page }, info) => {
    test.skip(!onPhone(info), 'phone test runs on the mobile project only')
    test.setTimeout(120_000)
    page.setDefaultTimeout(WAIT_MS)
    await login(page, info)
    // Below lg the sidebar lives in a drawer: closed at first, opened by the menu button.
    await expect(page.locator(NAV)).toHaveCount(0)
    await page.getByTestId('pentadbiran-menu-button').click()
    await expect(page.locator(NAV)).toBeVisible()
    expectMenu(await collect(page), await headingsOf(page))
    await expect(page.locator('[data-testid="pentadbiran-nav-badge"]')).toHaveText('LIVE')
    // Tapping a link goes to its page and closes the drawer.
    await page.locator(`${NAV} a[href="/admin/monitoring"]`).click()
    await page.waitForURL((u) => normalPath(u.pathname) === '/admin/monitoring')
    await expect(page.locator(NAV)).toHaveCount(0)
    // No horizontal page scroll at 375.
    expect(await overflowFailures(page, WIDTH_PAGES, 375), 'horizontal page scroll').toEqual([])
  })

  test('@api no horizontal page scroll on the sidebar pages (1280)', async ({ page }, info) => {
    test.skip(!onDesktop(info), 'desktop test runs on the desktop project only')
    test.setTimeout(120_000)
    page.setDefaultTimeout(WAIT_MS)
    await login(page, info)
    expect(await overflowFailures(page, WIDTH_PAGES, 1280), 'horizontal page scroll').toEqual([])
  })

  test('@api the LIVE badge stays accessible when the sidebar is collapsed to the icon rail (1280)', async ({ page }, info) => {
    test.skip(!onDesktop(info), 'the icon rail exists on the desktop project only (below lg the menu is a drawer)')
    page.setDefaultTimeout(WAIT_MS)
    await login(page, info)
    await expect(page.locator('[data-testid="pentadbiran-nav-badge"]')).toBeVisible()
    await page.getByRole('button', { name: 'Tukar saiz menu' }).click()
    // Rail: the label and its pill are hidden; a dot and a screen-reader name carry the badge.
    await expect(page.locator('[data-testid="pentadbiran-nav-badge"]')).toBeHidden()
    await expect(page.locator('[data-testid="pentadbiran-nav-badge-dot"]')).toBeVisible()
    await expect(page.locator('[data-testid="pentadbiran-nav-badge-sr"]')).toHaveText('Command Center LIVE')
    // Put the rail back so the saved sidebar width does not leak into later tests of this session.
    await page.getByRole('button', { name: 'Tukar saiz menu' }).click()
    await expect(page.locator('[data-testid="pentadbiran-nav-badge"]')).toBeVisible()
  })

  test('@api no horizontal page scroll on the sidebar pages (768)', async ({ page }, info) => {
    test.skip(!onTablet(info), 'tablet test runs on the tablet project only')
    test.setTimeout(120_000)
    page.setDefaultTimeout(WAIT_MS)
    await login(page, info)
    const failures = await overflowFailures(page, WIDTH_PAGES, 768)
    expect(failures).toEqual([])
  })
})
