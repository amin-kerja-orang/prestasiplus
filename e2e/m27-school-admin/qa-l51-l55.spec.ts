/**
 * Independent G5 regression for M27 Part B S1 to S5 (roles-matrix rows L51 Statistik Penggunaan, L52 DSKP Heatmap,
 * L53 Laporan Aktiviti, L54 Amaran Awal, L55 Laporan Bulanan). Report: docs/qa/L51-L55-admin-sekolah-analitik.md.
 *
 * Complements (does not repeat) partb-analytics.spec.ts, partb-proposed.spec.ts and partb-amaran.spec.ts:
 *  - role guards on all five routes: guest, every other role, a school admin with NO school (AC-M27-12.1..12.3);
 *  - forged school / school_id / role query values never widen the scope (AC-M27-12.4) on every screen;
 *  - responsive matrix at the project width (375 / 768 / 1280) plus 320: no horizontal page scroll, nothing
 *    overflowing its card, text at least 12 px, no overlapping controls, controls reachable (AC-M27-14.1..14.3);
 *  - navigation reachable on every width (sidebar or drawer);
 *  - server-error state of S2, S4 and S5 (the existing specs cover S1 and S3 only);
 *  - odd / hostile query values do not break any screen;
 *  - privacy scan of the page text (no IC, no platform wording, no NaN / undefined).
 */

import type { Page } from '@playwright/test'

import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, viewportWidth } from '../support'

const TAG = { tag: ['@m27', '@qa-l51'] }
const P1 = 'azlan@demo.test' // school 900003, no pupil / teacher / class
const P2 = 'adminsekolah@demo.test' // school 900001, populated
const SCHOOL_P1 = 'SMK Demo Seri Putra'
const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'
const FORBIDDEN_COPY =
  'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.'

test.use({ mockInit: { latency: 0 } })
test.describe.configure({ timeout: 300_000 })

interface Screen {
  key: string
  path: string
  root: string
  ready: string
  nav: string
  title: string
  endpoint: string
  /** an extra query to exercise the second view of the screen */
  alt: string
  /** the testid of the server-error block */
  error: string
}

const SCREENS: Screen[] = [
  {
    key: 'S1',
    path: '/admin-sekolah/statistik-penggunaan',
    root: 'su-page',
    ready: 'su-tiles',
    nav: 'sa-statistik-penggunaan',
    title: 'Statistik Penggunaan',
    endpoint: '/api/admin-sekolah/usage',
    alt: '?period=7days',
    error: 'su-error',
  },
  {
    key: 'S2',
    path: '/admin-sekolah/dskp-heatmap',
    root: 'dh-page',
    ready: 'dh-card',
    nav: 'sa-dskp-heatmap',
    title: 'DSKP Heatmap',
    endpoint: '/api/admin-sekolah/dskp-heatmap',
    alt: '?tingkatan=T5',
    error: 'dh-error',
  },
  {
    key: 'S3',
    path: '/admin-sekolah/laporan-aktiviti',
    root: 'la-page',
    ready: 'la-tabs',
    nav: 'sa-laporan-aktiviti',
    title: 'Laporan Aktiviti',
    endpoint: '/api/admin-sekolah/laporan-aktiviti',
    alt: '?range=90',
    error: 'la-error',
  },
  {
    key: 'S4',
    path: '/amaran/sekolah',
    root: 'am-page',
    ready: 'am-tiles',
    nav: 'sa-amaran-awal',
    title: 'Amaran Awal — Sekolah',
    endpoint: '/api/amaran/schools/*',
    alt: '?tingkatan=T5',
    error: 'am-error',
  },
  {
    key: 'S5',
    path: '/admin-sekolah/laporan-bulanan',
    root: 'lb-page',
    ready: 'lb-cards',
    nav: 'sa-laporan-bulanan',
    title: 'Laporan Bulanan',
    endpoint: '/api/admin-sekolah/laporan-bulanan',
    alt: '?bulan=2026-08',
    error: 'lb-error',
  },
]

async function signIn(page: Page, who: string | number): Promise<void> {
  await gotoAppOn(page, '/login')
  await createMockHandle(page).setUser(who)
}

async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate(async (p) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(t: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(p)
  }, path)
}

async function open(
  page: Page,
  gotoApp: (p: string) => Promise<void>,
  s: Screen,
  query = '',
): Promise<void> {
  await gotoApp(`${s.path}${query}`)
  await expect(page.getByTestId(s.ready)).toBeVisible({ timeout: 180_000 })
}

async function expectForbidden(page: Page, s: Screen): Promise<void> {
  const root = page.locator('[data-page=forbidden]')
  await expect(root).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveTitle(FORBIDDEN_TITLE)
  await expect(root).toContainText('403')
  await expect(root).toContainText('Akses Ditolak')
  await expect(root).toContainText(FORBIDDEN_COPY)
  await expect(page.getByTestId(s.root)).toHaveCount(0)
  await expect(page.getByTestId(s.ready)).toHaveCount(0)
}

// ---------------------------------------------------------------------------------------------------
// Role guards (AC-M27-12.1, 12.2, 12.3, 21.5)
// ---------------------------------------------------------------------------------------------------

test.describe('QA role guards on S1 to S5', TAG, () => {
  test('QA-ACC-1 a guest on each of the five routes is sent to /login', async ({ page, gotoApp }) => {
    for (const s of SCREENS) {
      await gotoApp(s.path)
      await expect(page, `${s.key} guest`).toHaveURL(/\/login/)
      await expect(page.getByTestId(s.root)).toHaveCount(0)
    }
  })

  for (const who of [
    'admin@demo.test',
    'guru@demo.test',
    'pelajar@demo.test',
    'pelajar2@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
    'ppd@demo.test',
    'jpn@demo.test',
  ]) {
    test(`QA-ACC-2 ${who} gets the 403 page on each of the five routes, in place`, async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      // the verdict does not depend on the width: the extra roles run at 1280 only
      test.skip(
        viewportWidth(page) < 1280 && !['admin@demo.test', 'guru@demo.test', 'pelajar@demo.test'].includes(who),
        'extra roles run at 1280 only',
      )
      await loginAs(who)
      for (const s of SCREENS) {
        await gotoApp(s.path)
        await expectForbidden(page, s)
        expect(page.url(), `${s.key} stays in place`).toContain(s.path)
        await expectNoHorizontalScroll(page)
      }
      // none of the M27 analytics endpoints answered 200 for this role
      for (const s of SCREENS) {
        const calls = await mock.requests(s.endpoint)
        expect(calls.filter((c) => c.status === 200), `${s.key} 200 for ${who}`).toHaveLength(0)
      }
    })
  }

  test('QA-ACC-3 a school admin with no school gets the 403 page on each route; no figure, no 200 from the endpoint', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/login')
    const account = await page.evaluate(async () => {
      const hooks = window.__mock as unknown as {
        seedSchoolAdminWithoutSchool(): Promise<{ id: number; email: string }>
      }
      return hooks.seedSchoolAdminWithoutSchool()
    })
    await createMockHandle(page).setUser(account.id)
    for (const s of SCREENS) {
      await gotoApp(s.path)
      await expectForbidden(page, s)
      const text = await page.locator('body').innerText()
      expect(text, `${s.key} shows no school name`).not.toContain(SCHOOL_P1)
      expect(text, `${s.key} shows no M27 copy`).not.toMatch(/Penglibatan|Jumlah Pelajar|Peta DSKP|Senarai Guru/)
      const calls = await createMockHandle(page).requests(s.endpoint)
      expect(
        calls.filter((c) => c.status === 200),
        `${s.key} no 200 for a null-school admin`,
      ).toHaveLength(0)
      await expectNoHorizontalScroll(page)
    }
  })

  test('QA-ACC-4 forged school / school_id / role values do not change the school (P1 stays empty, P1 school name stays)', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, P1)
    const forged = '?school=900001&school_id=900001&schoolId=900001&role=teacher&sekolah=900001'
    for (const s of SCREENS) {
      await open(page, gotoApp, s, forged)
      await expect(page.getByTestId('shell-user-subtitle'), `${s.key} sub-line`).toHaveText(SCHOOL_P1)
    }
    // S1: P1 has no pupil, so the first tile stays 0 under a forged school
    await open(page, gotoApp, SCREENS[0]!, forged)
    await expect(page.getByTestId('su-tile-value').first()).toHaveText('0')
    await open(page, gotoApp, SCREENS[3]!, forged)
    await expect(page.getByTestId('am-tile-value').first()).toHaveText('0')
    await open(page, gotoApp, SCREENS[4]!, forged)
    await expect(page.getByTestId('lb-card-participation')).toContainText('0%')
    await open(page, gotoApp, SCREENS[2]!, forged)
    await page.getByTestId('la-tab-murid').click()
    await expect(page.getByTestId('la-murid-row')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------------------------------
// Responsive matrix (AC-M27-14.1, 14.2, 14.3, FR-M27-46) and navigation
// ---------------------------------------------------------------------------------------------------

/** Right-edge or left-edge escapes that are not inside a scroll container (auto / scroll). */
async function escapingElements(page: Page, rootId: string): Promise<string[]> {
  return page.getByTestId(rootId).evaluate((root) => {
    const vw = document.documentElement.clientWidth
    const out: string[] = []
    const scrolls = (el: Element): boolean => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if (o === 'auto' || o === 'scroll') return true
      }
      return false
    }
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if ((r.right > vw + 1 || r.left < -1) && !scrolls(el)) {
        out.push(`${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.className.toString().slice(0, 40)}] ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`)
      }
    }
    return out.slice(0, 10)
  })
}

/** Text nodes under 12 px (FR-M27-46). */
async function smallText(page: Page, rootId: string): Promise<string[]> {
  return page.getByTestId(rootId).evaluate((root) => {
    const out: string[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent || n.textContent.trim() === '') continue
      const el = n.parentElement
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) out.push(`${n.textContent.trim().slice(0, 30)} (${String(size)}px)`)
    }
    return out.slice(0, 10)
  })
}

/** Visible controls whose boxes intersect (neither containing the other): overlapping controls. */
async function overlappingControls(page: Page, rootId: string): Promise<string[]> {
  return page.getByTestId(rootId).evaluate((root) => {
    const els = Array.from(root.querySelectorAll('a[href], button, select, input')).filter((e) => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    const out: string[] = []
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i]!
        const b = els[j]!
        if (a.contains(b) || b.contains(a)) continue
        const ra = a.getBoundingClientRect()
        const rb = b.getBoundingClientRect()
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
        if (w > 2 && h > 2) out.push(`${(a.textContent ?? '').trim().slice(0, 20)} x ${(b.textContent ?? '').trim().slice(0, 20)}`)
      }
    }
    return out.slice(0, 10)
  })
}

/** Visible controls that sit (partly) off the horizontal viewport, or are smaller than 24 px (WCAG 2.2 AA minimum). */
async function unusableControls(page: Page, rootId: string): Promise<string[]> {
  return page.getByTestId(rootId).evaluate((root) => {
    const vw = document.documentElement.clientWidth
    const scrolls = (el: Element): boolean => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if (o === 'auto' || o === 'scroll') return true
      }
      return false
    }
    const out: string[] = []
    for (const el of Array.from(root.querySelectorAll('a[href], button, select, input'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const label = `${(el.textContent ?? '').trim().slice(0, 24) || (el.getAttribute('data-testid') ?? el.tagName)}`
      if (!scrolls(el) && (r.left < -1 || r.right > vw + 1)) out.push(`off-canvas: ${label}`)
      if (r.height < 24 && !scrolls(el)) out.push(`small ${Math.round(r.height)}px: ${label}`)
    }
    return out.slice(0, 10)
  })
}

async function layoutChecks(page: Page, s: Screen, label: string): Promise<void> {
  await expectNoHorizontalScroll(page)
  expect(await escapingElements(page, s.root), `${s.key} ${label}: elements escaping the viewport`).toEqual([])
  expect(await smallText(page, s.root), `${s.key} ${label}: text below 12 px`).toEqual([])
  expect(await overlappingControls(page, s.root), `${s.key} ${label}: overlapping controls`).toEqual([])
  expect(await unusableControls(page, s.root), `${s.key} ${label}: controls off-canvas or under 24 px`).toEqual([])
}

/** Tables of the page stay inside their card: the table's scroll container does not exceed the viewport. */
async function expectTablesInsideCards(page: Page, rootId: string): Promise<void> {
  const bad = await page.getByTestId(rootId).evaluate((root) => {
    const vw = document.documentElement.clientWidth
    const out: string[] = []
    for (const t of Array.from(root.querySelectorAll('table'))) {
      const r = t.getBoundingClientRect()
      if (r.width === 0) continue
      // the nearest ancestor that scrolls or clips
      let host: Element | null = t.parentElement
      while (host && host !== document.body) {
        const o = getComputedStyle(host).overflowX
        if (o === 'auto' || o === 'scroll') break
        host = host.parentElement
      }
      const hr = host ? host.getBoundingClientRect() : r
      if (hr.right > vw + 1 || hr.left < -1) out.push(`table container ${Math.round(hr.left)}..${Math.round(hr.right)} of ${vw}`)
      if (r.width > hr.width + 1 && !(host && getComputedStyle(host).overflowX.match(/auto|scroll/))) {
        out.push('table wider than a non-scrolling container')
      }
    }
    return out
  })
  expect(bad, 'tables stay inside their card').toEqual([])
}

async function viewsOf(page: Page, s: Screen, label: string): Promise<void> {
  await layoutChecks(page, s, label)
  await expectTablesInsideCards(page, s.root)
}

for (const persona of [
  { id: 'P2', who: P2 },
  { id: 'P1', who: P1 },
]) {
  for (const s of SCREENS) {
    test.describe(`QA responsive ${s.key} ${persona.id}`, TAG, () => {
      test(`QA-RESP ${s.key} ${persona.id}: layout at the project width and (mobile project) 320`, async ({
        page,
        gotoApp,
      }) => {
        await signIn(page, persona.who)
        const w = viewportWidth(page)
        await open(page, gotoApp, s)
        await viewsOf(page, s, `${String(w)} default`)

        // second view of the screen
        await open(page, gotoApp, s, s.alt)
        await viewsOf(page, s, `${String(w)} ${s.alt}`)

        // S3 tabs hold the two wide tables
        if (s.key === 'S3') {
          for (const tab of ['guru', 'murid']) {
            await page.getByTestId(`la-tab-${tab}`).click()
            await expect(page.getByTestId(`la-${tab}`)).toBeVisible()
            await viewsOf(page, s, `${String(w)} tab ${tab}`)
          }
          await page.getByTestId('la-tab-overview').click()
        }
        // S2: the subject select with the longest option, T4 and T5
        if (s.key === 'S2') {
          const options = await page.getByTestId('dh-subject').locator('option').allTextContents()
          for (const label of options.slice(0, 4)) {
            await page.getByTestId('dh-subject').selectOption({ label })
            await expect(page.getByTestId('dh-caption')).toContainText(label.split(' ')[0] ?? label, { timeout: 60_000 })
            await viewsOf(page, s, `${String(w)} subject ${label}`)
          }
        }

        if (w <= 375) {
          // a real 320 px phone loads the page at 320: set the viewport first, then load (no in-place resize)
          await page.setViewportSize({ width: 320, height: 700 })
          await open(page, gotoApp, s)
          await viewsOf(page, s, '320')
          await open(page, gotoApp, s, s.alt)
          await viewsOf(page, s, `320 ${s.alt}`)
          if (s.key === 'S3') {
            for (const tab of ['guru', 'murid']) {
              await page.getByTestId(`la-tab-${tab}`).click()
              await expect(page.getByTestId(`la-${tab}`)).toBeVisible()
              await viewsOf(page, s, `320 tab ${tab}`)
            }
          }
        }
      })
    })
  }
}

test.describe('QA navigation reachable from S1 to S5', TAG, () => {
  test('QA-NAV every screen of S1 to S5 is reachable from the sidebar (1280) or the drawer (below 1024)', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, P1)
    await open(page, gotoApp, SCREENS[0]!)
    for (const s of SCREENS.slice(1)) {
      if (isDesktopShell(page)) {
        await expect(page.getByTestId('shell-user-sidebar')).toBeVisible()
        await page.getByTestId('shell-user-sidebar').locator(`[data-nav-id="${s.nav}"]`).click()
      } else {
        await page.getByTestId('shell-user-hamburger').click()
        const item = page.getByTestId('shell-user-drawer').locator(`[data-nav-id="${s.nav}"]`)
        await expect(item).toBeVisible()
        await item.scrollIntoViewIfNeeded() // the drawer list scrolls inside itself
        await expect(item).toBeInViewport({ ratio: 0.9 })
        await item.click()
      }
      await expect(page).toHaveURL(new RegExp(s.path.replace(/[/]/g, '\\/')))
      await expect(page.getByTestId(s.ready)).toBeVisible({ timeout: 120_000 })
      await expect(page.getByTestId('shell-user-title')).toHaveText(s.title)
      await expectNoHorizontalScroll(page)
    }
  })
})

// ---------------------------------------------------------------------------------------------------
// Errors (AC-M27-14.5; the existing specs cover S1 and S3)
// ---------------------------------------------------------------------------------------------------

test.describe('QA server error state on S2, S4, S5', TAG, () => {
  for (const s of SCREENS.filter((x) => ['S2', 'S4', 'S5'].includes(x.key))) {
    test(`QA-ERR ${s.key}: an endpoint forced to 500 shows an error block, no figures, no horizontal scroll`, async ({
      page,
      gotoApp,
      mock,
    }) => {
      await signIn(page, P1)
      await open(page, gotoApp, SCREENS[0]!) // a light screen first (in-app navigation keeps the fault armed)
      await mock.failNext(s.endpoint, 500)
      await spaGoto(page, s.path)
      await expect(page.getByTestId(s.error)).toBeVisible({ timeout: 60_000 })
      await expect(page.getByTestId(s.ready)).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      const text = await page.getByTestId(s.root).innerText()
      expect(text).not.toMatch(/undefined|NaN|\[object/)
    })
  }

  test('QA-ERR network error on S5 shows an error block as well', async ({ page, gotoApp, mock }) => {
    await signIn(page, P1)
    await open(page, gotoApp, SCREENS[0]!)
    await mock.networkErrorNext('/api/admin-sekolah/laporan-bulanan')
    await spaGoto(page, SCREENS[4]!.path)
    await expect(page.getByTestId('lb-error')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('lb-cards')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------------------------------
// Odd input (exploratory, automated) and privacy (AC-M27-14.4)
// ---------------------------------------------------------------------------------------------------

const ODD: Record<string, string[]> = {
  S1: ['?period=', '?period=%3Cscript%3Ealert(1)%3C%2Fscript%3E', '?period=7days&period=today', '?period=TODAY'],
  S2: [
    '?subjectId=999999',
    '?subjectId=abc',
    '?subjectId=-1',
    '?tingkatan=T9',
    '?tingkatan=t4',
    '?tingkatan=%3Cimg%20src%3Dx%3E',
    '?subjectId=999999&tingkatan=T5',
  ],
  S3: ['?range=0', '?range=-7', '?range=abc', '?range=7.5', '?range=9999999999999999999', '?range=30&range=7'],
  S4: ['?tingkatan=T9', '?tingkatan=t4', '?tingkatan=%27%20OR%201%3D1', '?tingkatan='],
  S5: [
    '?bulan=2026-13',
    '?bulan=2026-00',
    '?bulan=0000-01',
    '?bulan=1900-01',
    '?bulan=2026-9',
    '?bulan=2026-09-01',
    '?bulan=%3Cscript%3E',
    '?bulan=2026-08&bulan=2026-07',
  ],
}

test.describe('QA odd query values', TAG, () => {
  for (const s of SCREENS) {
    test(`QA-ODD ${s.key}: odd values fall back, the page renders, no NaN / undefined / [object]`, async ({
      page,
      gotoApp,
    }) => {
      test.skip(viewportWidth(page) < 1280 && s.key !== 'S5' && s.key !== 'S2', 'runs at 1280 plus S2 and S5 on narrow widths')
      await signIn(page, P1)
      for (const q of ODD[s.key] ?? []) {
        await open(page, gotoApp, s, q)
        const text = await page.getByTestId(s.root).innerText()
        expect(text, `${s.key}${q}`).not.toMatch(/undefined|NaN|\[object|Invalid Date/)
        await expect(page.getByTestId(s.error), `${s.key}${q} no error block`).toHaveCount(0)
        await expect(page.locator('[data-page=forbidden], [data-page=not-found]'), `${s.key}${q} no 403/404`).toHaveCount(0)
        await expectNoHorizontalScroll(page)
      }
    })
  }

  test('QA-ODD S5 an out-of-range month shows the current month, and the "next" link never points to a future month', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, P1)
    const s = SCREENS[4]!
    for (const q of ['?bulan=2026-13', '?bulan=2026-00', '?bulan=2099-01', '?bulan=2026-09']) {
      await open(page, gotoApp, s, q)
      await expect(page.getByTestId('lb-heading'), q).toHaveText('Laporan September 2026')
      await expect(page.getByTestId('lb-next')).toHaveCount(0)
    }
    // a very old valid month: heading follows, both links exist, "prev" is a real previous month
    await open(page, gotoApp, s, '?bulan=2020-01')
    await expect(page.getByTestId('lb-heading')).toHaveText('Laporan Januari 2020')
    await expect(page.getByTestId('lb-prev')).toHaveText('← Disember 2019')
    await expect(page.getByTestId('lb-next')).toHaveText('Februari 2020 →')
  })
})

test.describe('QA privacy scan', TAG, () => {
  for (const s of SCREENS) {
    test(`QA-PRIV ${s.key} P2: no IC, no platform-wide wording, no other-school name, no placeholder leaks`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      test.skip(viewportWidth(page) < 1280, 'content scan runs at 1280 only')
      await loginAs(P2)
      await open(page, gotoApp, s)
      if (s.key === 'S3') {
        for (const tab of ['guru', 'murid']) {
          await page.getByTestId(`la-tab-${tab}`).click()
          await expect(page.getByTestId(`la-${tab}`)).toBeVisible()
        }
      }
      const text = await page.getByTestId(s.root).innerText()
      expect(text).not.toMatch(/\b\d{6}-?\d{2}-?\d{4}\b/)
      expect(text).not.toMatch(/No\. ?KP|Kad Pengenalan/i)
      expect(text).not.toMatch(/keseluruhan platform|seluruh platform/i)
      expect(text).not.toMatch(/undefined|NaN|\[object|null\b/)
      expect(text).not.toContain(SCHOOL_P1)
      // e-mails shown on S3 belong to the demo domain only (no real address)
      for (const mail of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) {
        expect(mail, 'e-mail domain').toMatch(/@(demo\.test|[\w-]+\.test|example\.(com|org))$/)
      }
    })
  }
})
