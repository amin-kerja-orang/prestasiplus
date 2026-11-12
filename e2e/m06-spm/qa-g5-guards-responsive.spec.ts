/**
 * QA G5 (roles-matrix row L18, M06 SPM): access guards, unknown ids and the responsive sweep of every
 * built M06 route at 375 / 768 / 1280.
 *
 * Covers AC-M06-04.1 (guest), role access (SRS §9), AC-M06-04.2 / 04.3 (404 page, no premium gate),
 * AC-M06-03.1 / 03.2 / 03.4 (menus), AC-M06-24.1 / 24.5 (no horizontal scroll, text >= 12 px), touch
 * targets >= 44 px below lg, heading legibility on dark heroes (user and admin shell).
 */

import type { Page } from '@playwright/test'

import { ALESA_ON } from '../support/alesa'
import { addInitSession } from '../fixtures/mock-page'
import { expectNoHorizontalScroll, expectTabTitle, isDesktopShell, moduleTag, navigateInApp, viewportWidth } from '../support'
import { expect, test } from './fixtures'
import { ADMIN, NOT_FOUND, PELAJAR, PELAJAR2, shellTitle, tid } from './support'

test.describe.configure({ timeout: 360_000 })

const GURU = 'guru@demo.test'

/** Every M06 route with concrete ids (S7 / S9 are the M05 routes, only the link is checked here). */
const ROUTES = [
  '/spm',
  '/spm/tahun-lepas',
  '/spm/tahun-lepas/BM/quiz?count=5',
  '/spm/latih-tubi',
  '/spm/latih-tubi/MATH',
  '/spm/latih-tubi/PERNIAGA/quiz?count=10',
  '/spm/ramalan',
  '/spm/ramalan/GEO',
  '/spm/ramalan/AKAUN?year=2026&set=3',
  '/spm/subjektif',
  '/spm/history',
  '/spm-mock',
  '/spm-mock/317',
  '/spm-mock/16/result',
  '/pusat-ai/spm',
]

test.describe('QA-G5 M06 access guards', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const path of ROUTES) {
    test(`E2E-M06-06 a guest on ${path} is sent to /login`, async ({ page, gotoApp }) => {
      await gotoApp(path)
      if (path === '/pusat-ai/spm' && !ALESA_ON) {
        // D73: S13 is not registered while VITE_ALESA_AI is off, so a guest meets the 404 page.
        await expectTabTitle(page, NOT_FOUND)
        return
      }
      await expect(page).toHaveURL(/\/login/)
    })
  }

  const ROLE_PAGES: Array<[string, string]> = [
    ['/spm', 'spm-hub-page'],
    ['/spm/tahun-lepas', 'spm-databank-page'],
    ['/spm/latih-tubi', 'spm-latih-tubi-page'],
    ['/spm/latih-tubi/MATH', 'spm-config-page'],
    ['/spm/ramalan', 'tracking-hub-page'],
    ['/spm/ramalan/GEO', 'tracking-subject-page'],
    ['/spm/subjektif', 'subjektif-page'],
    ['/spm/history', 'spm-history-page'],
    ['/spm-mock', 'mock-page'],
    ['/pusat-ai/spm', 'walk-page'],
  ]

  for (const who of [PELAJAR, 'pelajarmaju@demo.test', GURU, ADMIN, 'ibubapa@demo.test', 'adminsekolah@demo.test']) {
    test(`SRS-9 ${who} can open every M06 list screen (no redirect, no 403/404, no premium gate)`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(who)
      let first = true
      for (const [path, ready] of ROLE_PAGES) {
        if (first) await gotoApp(path)
        else await navigateInApp(page, path)
        first = false
        if (path === '/pusat-ai/spm' && !ALESA_ON) {
          // D73: S13 is not registered while VITE_ALESA_AI is off, so every role meets the 404 page.
          await expectTabTitle(page, NOT_FOUND)
          continue
        }
        await expect(page, `${who} on ${path}`).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`))
        await expect(tid(page, ready), `${who} on ${path}`).toBeVisible({ timeout: 30_000 })
        await expectNoHorizontalScroll(page)
        // AC-M06-04.3: no premium lock, PRO badge or package prompt.
        const main = page.locator('main').first()
        await expect(main.getByText(/^PRO$/), `${who} PRO badge on ${path}`).toHaveCount(0)
        await expect(main.getByText(/langgan|naik taraf|upgrade|pakej/i), `${who} package prompt on ${path}`).toHaveCount(0)
      }
    })
  }

  for (const who of [PELAJAR, GURU, 'ibubapa@demo.test', 'penaja@demo.test', 'adminsekolah@demo.test', 'ppd@demo.test', 'jpn@demo.test']) {
    test(`AC-M06-12.4 / SRS-9 the readiness card is not shown to ${who}`, async ({ page, loginAs, gotoApp }) => {
      await loginAs(who)
      await gotoApp('/spm/ramalan')
      await expect(tid(page, 'tracking-hub-page')).toBeVisible({ timeout: 60_000 })
      await expect(tid(page, 'lanes')).toBeVisible()
      await expect(tid(page, 'readiness')).toHaveCount(0)
    })
  }
})

test.describe('QA-G5 M06 unknown ids are the 404 page', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  const UNKNOWN = [
    '/spm/latih-tubi/XYZ',
    '/spm/latih-tubi/xyz',
    '/spm/latih-tubi/XYZ/quiz?count=5',
    '/spm/tahun-lepas/XYZ/quiz?count=5',
    '/spm/ramalan/XYZ',
    '/spm/ramalan/XYZ?year=2026&set=1',
    '/spm-mock/99999',
    '/spm-mock/99999/result',
    '/spm-mock/abc',
    '/spm-mock/abc/result',
    '/spm/zzz',
  ]
  for (const path of UNKNOWN) {
    test(`E2E-M06-06 ${path} shows the global 404 page`, async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await gotoApp(path)
      await expectTabTitle(page, NOT_FOUND)
      await expect(page.getByText('Halaman Tidak Dijumpai').first()).toBeVisible()
      await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute('href', '/practice')
      await expectNoHorizontalScroll(page)
    })
  }

  test('BR-M06-26 a mock of another owner is the 404 page (student on the admin mocks 16 and 317)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm')
    for (const path of ['/spm-mock/16/result', '/spm-mock/317', '/spm-mock/16']) {
      await navigateInApp(page, path)
      await expectTabTitle(page, NOT_FOUND)
    }
  })

  test('E2E-M06-17 /spm/ramalan/BM and /BI land on the S7 lists; S7 and S9 links resolve', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/ramalan/BM')
    await expect(page).toHaveURL(/\/latihan-berstruktur\?.*subject_id=1/)
    await expect(page.url()).toContain('scope=spm')
    await expect(page.url()).toContain('track=bahasa')
    await expect(page.getByRole('link', { name: /Kembali ke Tracking A SPM/ })).toHaveAttribute('href', '/spm/ramalan')
    await gotoApp('/spm/ramalan/BI')
    await expect(page).toHaveURL(/subject_id=2/)
    // S9 via the S8 card.
    await gotoApp('/spm/subjektif')
    await expect(tid(page, 'subjektif-grid')).toBeVisible({ timeout: 30_000 })
    const first = tid(page, 'subjektif-grid').locator('a').first()
    const href = await first.getAttribute('href')
    expect(href).toMatch(/^\/latihan-berstruktur\?subject_id=\d+&scope=spm$/)
    await first.click()
    await expect(page).toHaveURL(/\/latihan-berstruktur\?/)
    await expect(page.getByRole('link', { name: /Kembali ke Subjektif SPM/ })).toHaveAttribute('href', '/spm/subjektif')
  })
})

test.describe('QA-G5 M06 menus', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('AC-M06-03.1 / 03.2 student: sidebar SPM + SPM Mock Exam (>= 1024), bottom nav SPM and drawer (< 1024)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm')
    await expect(tid(page, 'spm-hub-page')).toBeVisible({ timeout: 60_000 })
    if (isDesktopShell(page)) {
      const side = tid(page, 'pembelajaran-sidebar')
      await expect(side.locator('a[href="/spm"]').first()).toContainText('SPM')
      await expect(side.locator('a[href="/spm"]').first()).toBeVisible()
      await expect(side.locator('a[href="/spm-mock"]').first()).toContainText('SPM Mock Exam')
    } else {
      const bottom = tid(page, 'pembelajaran-bottom-nav').locator('a[href="/spm"]')
      await expect(bottom).toBeVisible()
      await expect(bottom).toContainText('SPM')
      await tid(page, 'pembelajaran-bottom-nav').getByText('Lagi').click()
      await expect(tid(page, 'pembelajaran-lagi-nav').locator('a[href="/spm"]').first()).toBeVisible()
    }
  })

  test('AC-M06-03.4 admin: Portal Pentadbiran menu, sidebar (>= 1024) or drawer (< 1024)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/spm-mock')
    await expect(shellTitle(page)).toBeVisible({ timeout: 60_000 })
    // The menu is src/shells/pentadbiran/menu.ts (D113): the same menu in the sidebar from lg and in the
    // drawer (UDashboardSidebar, opened by the menu button) below lg.
    let scope = tid(page, 'pentadbiran-sidebar')
    if (!isDesktopShell(page)) {
      await tid(page, 'pentadbiran-menu-button').click()
      scope = page.getByRole('dialog')
      await expect(scope).toBeVisible()
    }
    // Group "Soalan" holds KS-01 "SPM" -> /admin/spm (menu.ts:126-129, fragments/s3.ts:8; PRD 30 §3.2 pos 1).
    const spm = scope.locator('a[href="/admin/spm"]').first()
    if (!(await spm.isVisible())) await scope.getByText('Soalan', { exact: true }).first().click()
    await expect(spm).toBeVisible()
    await expect(spm).toContainText('SPM')

    // PENGURUSAN > group "SPM": exactly four rows in this order (PRD 30-admin-pusat.md:185 row 6; :227-229 KS-03/04/05
    // "MERGE -> hub lane card AND group SPM item"). C-76: expected RED until the group is back in the menu.
    const lanes: Array<[string, string]> = [
      ['Databank Soalan', '/admin/spm/databank'],
      ['Latih Tubi', '/admin/spm/latih-tubi'],
      ['Tracking A', '/admin/spm/tracking-a'],
      ['Subjektif', '/admin/spm/subjektif'],
    ]
    const laneLinks = scope.locator(lanes.map(([, h]) => `a[href="${h}"]`).join(', '))
    if ((await laneLinks.first().isVisible()) === false) {
      // The group parent is a button named "SPM" (the KS-01 row is a link, not a button).
      await scope.getByRole('button', { name: 'SPM', exact: true }).first().click()
    }
    await expect(laneLinks).toHaveCount(4)
    expect(await laneLinks.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual(
      lanes.map(([, h]) => h),
    )
    for (const [name, href] of lanes) {
      await expect(scope.locator(`a[href="${href}"]`).first(), name).toContainText(name)
    }

    // Absent from the admin menu:
    const absent: Array<[string, string]> = [
      // PRD 30 §3.1 row 6: V2 linked the SPM group to the pupil pages; V3 never links the admin to them (FD-MENU-2).
      ['Databank Soalan pupil page', '/spm/tahun-lepas'],
      ['Latih Tubi pupil page', '/spm/latih-tubi'],
      ['Tracking A pupil page', '/spm/ramalan'],
      ['Subjektif pupil page', '/spm/subjektif'],
      // PRD 30 §3.3 row KS-02 (HIDE): Bank Soalan SPM has no sidebar entry.
      ['KS-02 Bank Soalan SPM', '/admin/spm/soalan'],
      // PRD 30 §3.1 row "not rendered" (Pusat AI) and §6 row 37 (D73): no SPM Walkthrough entry.
      ['SPM Walkthrough (Pusat AI)', '/pusat-ai/spm'],
      // No menu row exists in src/shells/pentadbiran/menu/fragments and PRD 30 §3.3 is silent on it (open question).
      ['SPM Mock Exam', '/spm-mock'],
    ]
    for (const [name, href] of absent) {
      await expect(scope.locator(`a[href="${href}"]`), name).toHaveCount(0)
    }
  })

  // AC-M06-03.4 (hub and lanes): /admin/spm cards open the four lanes and each lane loads with its pupil link.
  // Card ids kandungan-open-{lane} and hrefs: m28 admin/kandungan/pages/KandunganHubPage.vue:82 (UButton :to the
  // named lane route, routes/admin-kandungan.ts:12-52); page containers: LaneDatabankPage.vue:40, LaneLatihTubiPage.vue:37,
  // TrackingAListPage.vue:38, LaneSubjektifPage.vue:40; pupil link `lane-pupil` "lihat sisi pelajar" (FD-MENU-2):
  // LaneShell.vue:56. Shown only when the pupil route is registered (admin/kandungan/lanes.ts:18-31); C-76 covers it.
  test('AC-M06-03.4 admin: the /admin/spm hub links the four lanes, each lane loads with "lihat sisi pelajar"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    const LANES: Array<[string, string, string]> = [
      ['databank', '/admin/spm/databank', 'lane-databank'],
      ['latih-tubi', '/admin/spm/latih-tubi', 'lane-latih-tubi'],
      ['tracking-a', '/admin/spm/tracking-a', 'lane-tracking-a'],
      ['subjektif', '/admin/spm/subjektif', 'lane-subjektif'],
    ]
    await loginAs(ADMIN)
    await gotoApp('/admin/spm')
    await expect(tid(page, 'kandungan-hub')).toBeVisible({ timeout: 60_000 })
    for (const [key, href] of LANES) {
      await expect(tid(page, `kandungan-open-${key}`), `hub card ${key}`).toHaveAttribute('href', href)
    }
    for (const [key, href, container] of LANES) {
      await navigateInApp(page, href)
      await expect(page, key).toHaveURL(new RegExp(`${href.replace(/\//g, '\\/')}$`))
      await expect(tid(page, container), `lane ${key}`).toBeVisible({ timeout: 60_000 })
      await expect(page, `lane ${key} is not the 404 page`).not.toHaveTitle(NOT_FOUND)
      await expect(tid(page, 'lane-pupil'), `lane ${key} pupil link`).toContainText('lihat sisi pelajar')
      await expectNoHorizontalScroll(page)
    }
  })
})

/* ------------------------------------------------------------------ responsive sweep */

interface Violation {
  kind: string
  detail: string
}

/** Text below 12 px, (below lg) touch targets below 44 px, and low contrast on headings / light text. */
async function audit(page: Page): Promise<Violation[]> {
  const touch = !isDesktopShell(page)
  return page.locator('main').first().evaluate((main, checkTouch) => {
    const out: Array<{ kind: string; detail: string }> = []
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim()
      if (!text || /^[\p{Extended_Pictographic}\s️]+$/u.test(text)) continue
      const el = node.parentElement
      if (!el || !visible(el)) continue
      const size = Number.parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) out.push({ kind: 'font', detail: `"${text.slice(0, 40)}" ${size}px` })
    }
    if (checkTouch) {
      const sel = 'a[href], button, select, input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea, [role=button]'
      for (const el of Array.from(main.querySelectorAll(sel))) {
        if (!visible(el)) continue
        const cs = getComputedStyle(el)
        if (cs.position === 'absolute' && el.getBoundingClientRect().width < 2) continue
        if (el.tagName === 'A') {
          const p = el.parentElement
          if (p && ['P', 'LI', 'SPAN'].includes(p.tagName) && p.textContent!.trim() !== el.textContent!.trim()) continue
        }
        const r = el.getBoundingClientRect()
        if (r.width < 43.9 || r.height < 43.9) {
          const label = (el.getAttribute('data-testid') ?? el.textContent ?? '').trim().slice(0, 40)
          out.push({ kind: 'touch', detail: `<${el.tagName.toLowerCase()}> ${label} ${Math.round(r.width)}x${Math.round(r.height)}` })
        }
      }
    }
    // Heading legibility: contrast of every heading against the backdrop behind it.
    const rgb = (s: string): [number, number, number, number] | null => {
      const m = s.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number)
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1]
    }
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
    }
    const backdrops = (el: Element): number[][] => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n)
        const img = cs.backgroundImage
        if (img && img !== 'none' && /gradient/.test(img)) {
          const stops = (img.match(/rgba?\([^)]+\)/g) ?? []).map(rgb).filter((c): c is [number, number, number, number] => !!c && c[3] > 0.5)
          if (stops.length) return stops
        }
        const bg = rgb(cs.backgroundColor)
        if (bg && bg[3] > 0.5) return [bg]
      }
      return [[255, 255, 255, 1]]
    }
    for (const h of Array.from(main.querySelectorAll('h1, h2, h3, h4'))) {
      if (!visible(h)) continue
      const fg = rgb(getComputedStyle(h).color)
      if (!fg) continue
      const fl = lum(fg)
      const bds = backdrops(h)
      const mean = [0, 1, 2].map((i) => bds.reduce((acc, c) => acc + c[i]!, 0) / bds.length)
      for (const b of [mean]) {
        const bl = lum(b)
        const ratio = (Math.max(fl, bl) + 0.05) / (Math.min(fl, bl) + 0.05)
        if (ratio < 3) {
          out.push({ kind: 'contrast', detail: `<${h.tagName.toLowerCase()}> "${(h.textContent ?? '').trim().slice(0, 40)}" ${ratio.toFixed(2)}:1 (fg ${getComputedStyle(h).color})` })
          break
        }
      }
    }
    return out
  }, touch)
}

interface SweepRoute {
  name: string
  path: string
  who: string
  ready: string
  now?: string
}

const SWEEP: SweepRoute[] = [
  { name: 'S1', path: '/spm', who: PELAJAR, ready: 'spm-hub-page' },
  { name: 'S1-admin', path: '/spm', who: ADMIN, ready: 'spm-hub-page' },
  { name: 'S2', path: '/spm/tahun-lepas', who: PELAJAR, ready: 'databank-grid' },
  { name: 'Q1', path: '/spm/tahun-lepas/BM/quiz?count=5', who: PELAJAR, ready: 'quiz-title' },
  { name: 'S3', path: '/spm/latih-tubi', who: PELAJAR, ready: 'spm-latih-tubi-page' },
  { name: 'S4', path: '/spm/latih-tubi/MATH', who: PELAJAR, ready: 'config-start' },
  { name: 'S4-BA', path: '/spm/latih-tubi/BA', who: PELAJAR, ready: 'config-start' },
  { name: 'Q2', path: '/spm/latih-tubi/PERNIAGA/quiz?count=10', who: PELAJAR, ready: 'quiz-title' },
  { name: 'Q2-empty', path: '/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=5', who: PELAJAR, ready: 'spm-no-questions' },
  { name: 'S5', path: '/spm/ramalan', who: PELAJAR, ready: 'lanes' },
  { name: 'S5-admin', path: '/spm/ramalan', who: ADMIN, ready: 'readiness-tiles' },
  { name: 'S6-GEO', path: '/spm/ramalan/GEO', who: PELAJAR, ready: 'set-grid' },
  { name: 'S6-AKAUN', path: '/spm/ramalan/AKAUN', who: PELAJAR, ready: 'set-grid' },
  { name: 'S6-BA', path: '/spm/ramalan/BA', who: PELAJAR, ready: 'subject-empty' },
  { name: 'Q3', path: '/spm/ramalan/AKAUN?year=2026&set=3', who: PELAJAR, ready: 'quiz-title' },
  { name: 'S8', path: '/spm/subjektif', who: PELAJAR, ready: 'subjektif-grid' },
  { name: 'S8-new', path: '/spm/subjektif', who: PELAJAR2, ready: 'subjektif-grid' },
  { name: 'S10', path: '/spm/history', who: ADMIN, ready: 'history-rows' },
  { name: 'S10-empty', path: '/spm/history?type=ramalan', who: ADMIN, ready: 'history-empty' },
  { name: 'S10-student', path: '/spm/history', who: PELAJAR, ready: 'history-rows' },
  { name: 'S11-student', path: '/spm-mock', who: PELAJAR, ready: 'mock-form' },
  { name: 'S11-admin', path: '/spm-mock', who: ADMIN, ready: 'mock-list' },
  { name: 'Q4-admin', path: '/spm-mock/317', who: ADMIN, ready: 'run-items' },
  { name: 'S12-admin', path: '/spm-mock/16/result', who: ADMIN, ready: 'result-review' },
  { name: 'S13-student', path: '/pusat-ai/spm', who: PELAJAR, ready: 'walk-form' },
  { name: 'S13-admin', path: '/pusat-ai/spm', who: ADMIN, ready: 'walk-form' },
]

test.describe('QA-G5 M06 responsive sweep', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const r of SWEEP) {
    test(`AC-M06-24.1 / 24.5 ${r.name} (${r.path}) no h-scroll, no text < 12 px, touch >= 44 px below lg, readable headings`, async ({
      page,
      gotoApp,
    }) => {
      await addInitSession(page, r.who)
      await gotoApp(r.path)
      if (r.path === '/pusat-ai/spm' && !ALESA_ON) {
        // D73: S13 is not registered while VITE_ALESA_AI is off; its off-state is the 404 page.
        await expectTabTitle(page, NOT_FOUND)
        await expectNoHorizontalScroll(page)
        return
      }
      await expect(tid(page, r.ready).first()).toBeVisible({ timeout: 60_000 })
      await expectNoHorizontalScroll(page)
      const violations = await audit(page)
      expect(
        violations,
        `${r.name} at ${String(viewportWidth(page))} px: ${violations.map((v) => `${v.kind}: ${v.detail}`).join(' | ')}`,
      ).toEqual([])
    })
  }
})
