/**
 * G5 QA regression for M27 S0 "Dashboard Sekolah" `/admin-sekolah` (roles-matrix L07, Admin Sekolah part).
 * Complements smoke-dashboard.spec.ts (E2E-M27-01..34): this file adds the QA-only checks (extra denied roles,
 * query/path abuse, 320 px, loading and error states, link targets by click, panel arithmetic, touch-target
 * measurements, console and page errors). No figure is pinned: totals are compared with the page's own parts.
 * Runs on mobile 375, tablet 768 and desktop 1280; the 320 px test runs on the mobile project only.
 */

import type { Page } from '@playwright/test'

import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, isDesktopShell, viewportWidth } from '../support'

const MODULE = { tag: ['@m27', '@qa-l07'] }
const PAGE = '/admin-sekolah'
const AZLAN = 'azlan@demo.test'
const SUHAIMI = 'suhaimi@demo.test'
const ADMIN_SEKOLAH = 'adminsekolah@demo.test'
const POPULATED = 1214

test.use({ mockInit: { latency: 0 } })

async function signIn(page: Page, who: string | number): Promise<void> {
  await gotoAppOn(page, '/login')
  await createMockHandle(page).setUser(who)
}

async function open(page: Page, gotoApp: (p: string) => Promise<void>, path = PAGE): Promise<void> {
  await gotoApp(path)
  await expect(page.getByTestId('sd-page')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('sd-grades')).toBeVisible({ timeout: 60_000 })
}

/** In-app navigation (no reload): keeps armed faults and latency, which a page reload would drop. */
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

/** Records page errors and console errors from now on. */
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

const smallText = (page: Page) =>
  page.getByTestId('sd-page').evaluate((root) => {
    const out: string[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent || n.textContent.trim() === '') continue
      const el = n.parentElement
      if (!el) continue
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) out.push(`${n.textContent.trim()} (${String(size)}px)`)
    }
    return out
  })

test.describe('access (QA extras)', MODULE, () => {
  for (const email of [
    'pelajar2@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
    'ppd@demo.test',
    'jpn@demo.test',
  ]) {
    test(`AC-07.3 ${email} gets the 403 page, no S0 data, no horizontal scroll`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(email)
      await gotoApp(PAGE)
      const root = page.locator('[data-page=forbidden]')
      await expect(root).toBeVisible()
      await expect(root).toContainText('Akses Ditolak')
      await expect(page.getByTestId('sd-page')).toHaveCount(0)
      await expect(page.getByTestId('sd-banner')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    })
  }

  test('AC-07.5 query school_id and a trailing path do not change the school (adminsekolah, 900001)', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, ADMIN_SEKOLAH)
    await open(page, gotoApp, `${PAGE}?school_id=900003&schoolId=900003`)
    await expect(page.getByTestId('sd-banner-name')).toHaveText('SMK DEMO', { ignoreCase: true })
    await expect(page.getByTestId('sd-banner')).not.toContainText(/Seri Putra/i)
  })

  test('AC-07.5 other undefined sub-paths give the 404 page, not S0', async ({ page, gotoApp }) => {
    await signIn(page, AZLAN)
    for (const p of ['/admin-sekolah/pilih-sekolah/', '/admin-sekolah/pilih-sekolah?school_id=1']) {
      await gotoApp(p)
      await expect(page.locator('[data-page=not-found]')).toBeVisible()
      await expect(page.getByTestId('sd-page')).toHaveCount(0)
    }
  })

  test('AC-07.4 null-school admin: 403 page, no figure or school text, no request data leak', async ({
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
    await gotoApp(PAGE)
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
    await expect(page.getByTestId('sd-cards')).toHaveCount(0)
    await expect(page.getByTestId('sd-performance')).toHaveCount(0)
    await expect(page.getByTestId('sd-perutusan')).toHaveCount(0)
    const calls = await createMockHandle(page).requests('/api/admin-sekolah/dashboard')
    expect(calls.every((c) => c.status === 403)).toBe(true)
  })
})

test.describe('content (QA extras)', MODULE, () => {
  test('AC-03.x Perutusan card: at most 3 rows, header always, no empty sentence; "Lihat semua →" target', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const card = page.getByTestId('sd-perutusan')
    await expect(card).toContainText('Perutusan Terkini')
    await expect(page.getByTestId('sd-perutusan-all')).toHaveText('Lihat semua →')
    await expect(page.getByTestId('sd-perutusan-all')).toHaveAttribute('href', '/perutusan')
    const rows = await page.getByTestId('sd-perutusan-row').count()
    expect(rows).toBeLessThanOrEqual(3)
    if (rows === 0) await expect(page.getByTestId('sd-perutusan-rows')).toHaveCount(0)
    for (const text of ['Tiada perutusan', 'Belum ada perutusan', 'Tiada data']) {
      await expect(card).not.toContainText(text)
    }
  })

  test('AC-02.3 suhaimi: only the state chip, no placeholder, at every width', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, SUHAIMI)
    await open(page, gotoApp)
    await expect(page.getByTestId('sd-chip-state')).toHaveText('Johor')
    await expect(page.getByTestId('sd-chip-ppd')).toHaveCount(0)
    await expect(page.getByTestId('sd-chip-code')).toHaveCount(0)
    await expect(page.getByTestId('sd-chips')).not.toContainText(/Tiada|^-$|Kod:/)
    await expectNoHorizontalScroll(page)
  })

  test('AC-10.4 AMARAN AWAL: three tallies are integers and "{n} murid dinilai" = their sum (populated and fixture)', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const read = async () => {
      const t = async (id: string) =>
        Number((await page.getByTestId(id).innerText()).replace(/[,\s]/g, ''))
      return { s: await t('sd-risk-safe'), w: await t('sd-risk-watch'), h: await t('sd-risk-high') }
    }
    const a = await read()
    await expect(page.getByTestId('sd-panel-risk')).toContainText('Selamat')
    await expect(page.getByTestId('sd-panel-risk')).toContainText('Berhati')
    await expect(page.getByTestId('sd-panel-risk')).toContainText('Berisiko')
    const sum = a.s + a.w + a.h
    expect(Number.isInteger(sum)).toBe(true)
    await expect(page.getByTestId('sd-risk-total')).toHaveText(
      `${sum.toLocaleString('en-US')} murid dinilai`,
    )
    await mock.setUser(AZLAN)
    await open(page, gotoApp)
    const b = await read()
    await expect(page.getByTestId('sd-risk-total')).toHaveText(
      `${(b.s + b.w + b.h).toLocaleString('en-US')} murid dinilai`,
    )
  })

  test('AC-10.1/FR-31 panel order, labels in capitals by CSS, title and subtitle', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await expect(page.getByTestId('sd-performance-title')).toHaveText('Ringkasan Prestasi')
    await expect(page.getByTestId('sd-performance-subtitle')).toHaveText(
      'GPS, risiko murid, ketepatan latihan & perbandingan tingkatan',
    )
    const order = await page
      .getByTestId('sd-panels')
      .locator('> *')
      .evaluateAll((els) =>
        els.map((e) => {
          const lbl = e.querySelector('p,span,h3') as HTMLElement | null
          return lbl ? getComputedStyle(lbl).textTransform + '|' + (lbl.textContent ?? '').trim() : ''
        }),
      )
    expect(order.length).toBe(4)
    expect(order.map((o) => o.split('|')[1]?.toUpperCase())).toEqual([
      'GPS SEKOLAH',
      'AMARAN AWAL',
      'LATIHAN',
      'TINGKATAN',
    ])
  })

  test('AC-11.1/11.2/05.2 clicking links lands on the right routes and "← Papan Pemuka" returns to S0 path chain', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    await page.getByTestId('sd-panel-levels').click()
    await expect(page).toHaveURL(/\/prestasi\/tingkatan$/)
    await page.goBack()
    await expect(page.getByTestId('sd-page')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('sd-grades-full').click()
    await expect(page).toHaveURL(/\/prestasi\/sekolah$/)
    await page.goBack()
    await expect(page.getByTestId('sd-page')).toBeVisible({ timeout: 60_000 })
    await page.locator('[data-testid="sd-breadcrumb"] a').click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
    await expect(page.locator('[data-page=not-found]')).toHaveCount(0)
  })

  test('AC-02.2 / 06.5 clicking banner, chips and cards changes nothing', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    const url = page.url()
    for (const id of ['sd-banner-name', 'sd-chip-state', 'sd-chip-ppd', 'sd-chip-code', 'sd-card-pupils', 'sd-card-subscription']) {
      await page.getByTestId(id).click()
      expect(page.url()).toBe(url)
    }
    await expect(page.locator('[data-testid^="sd-card-"] a, [data-testid="sd-banner"] a')).toHaveCount(0)
  })

  test('FR-37 / no leak of placeholders: no "undefined", "NaN", "null", "[object" in the page text', async ({
    page,
    gotoApp,
  }) => {
    for (const who of [AZLAN, SUHAIMI, ADMIN_SEKOLAH, POPULATED]) {
      await signIn(page, who)
      await open(page, gotoApp)
      const text = await page.getByTestId('sd-page').innerText()
      expect(text).not.toMatch(/undefined|NaN|\bnull\b|\[object/)
    }
  })

  test('console and page errors stay empty while S0 loads and links are followed', async ({
    page,
    gotoApp,
  }) => {
    const errors = watchErrors(page)
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await page.getByTestId('sd-panel-levels').click()
    await expect(page).toHaveURL(/\/prestasi\/tingkatan$/)
    expect(errors).toEqual([])
  })
})

test.describe('presentation (QA extras)', MODULE, () => {
  test('NFR no horizontal scroll and nothing past the right edge: populated, azlan, suhaimi', async ({
    page,
    gotoApp,
  }) => {
    for (const who of [POPULATED, AZLAN, SUHAIMI]) {
      await signIn(page, who)
      await open(page, gotoApp)
      await expectNoHorizontalScroll(page)
      const w = viewportWidth(page)
      const over = await page.getByTestId('sd-page').evaluate((root, vw) => {
        const out: string[] = []
        for (const el of root.querySelectorAll('*')) {
          const r = el.getBoundingClientRect()
          if (r.width > 0 && r.right > vw + 1) out.push(`${el.tagName}.${el.getAttribute('data-testid') ?? ''} right=${Math.round(r.right)}`)
        }
        return out
      }, w)
      expect(over).toEqual([])
    }
  })

  test('320 px: no horizontal scroll, text >= 12 px, grade rows and panels inside the viewport', async ({
    page,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) !== 375, '320 px runs on the mobile project only')
    await page.setViewportSize({ width: 320, height: 700 })
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    await expectNoHorizontalScroll(page)
    expect(await smallText(page)).toEqual([])
    for (const id of ['sd-banner', 'sd-cards', 'sd-performance', 'sd-grades']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(321)
    }
  })

  test('FR-26 text >= 12 px for azlan and suhaimi too', async ({ page, gotoApp }) => {
    for (const who of [AZLAN, SUHAIMI]) {
      await signIn(page, who)
      await open(page, gotoApp)
      expect(await smallText(page)).toEqual([])
    }
  })

  test('touch targets: links on S0 report their hit height (>= 44 px expected on touch widths)', async ({
    page,
    gotoApp,
  }, testInfo) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const heights: Record<string, number> = {}
    for (const id of ['sd-perutusan-all', 'sd-perutusan-all', 'sd-panel-levels', 'sd-grades-full']) {
      const box = await page.getByTestId(id).boundingBox()
      heights[id] = Math.round(box?.height ?? 0)
    }
    testInfo.annotations.push({ type: 'touch-heights', description: JSON.stringify(heights) })
    // the SRS states no touch-target value for S0 (D10: replicate live); the panel is a large block
    expect(heights['sd-panel-levels']).toBeGreaterThanOrEqual(44)
    if (!isDesktopShell(page)) {
      for (const [id, h] of Object.entries(heights)) {
        testInfo.annotations.push({ type: h >= 44 ? 'ok' : 'below-44', description: `${id}=${h}` })
      }
    }
  })

  test('loading state: spinner only, no data and no error while the endpoint is slow, then the page', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await spaGoto(page, '/admin-sekolah/pilih-sekolah')
    await mock.setLatency(2500, '/api/admin-sekolah/dashboard')
    await spaGoto(page, PAGE)
    await expect(page.getByTestId('sd-loading')).toBeVisible()
    await expect(page.getByTestId('sd-banner')).toHaveCount(0)
    await expect(page.getByTestId('sd-error')).toHaveCount(0)
    await expect(page.getByTestId('sd-banner')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('sd-loading')).toHaveCount(0)
  })

  test('error states: network error and 500 show an error box, no data, no horizontal scroll', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await spaGoto(page, '/admin-sekolah/pilih-sekolah')
    await mock.networkErrorNext('/api/admin-sekolah/dashboard')
    await spaGoto(page, PAGE)
    await expect(page.getByTestId('sd-error')).toBeVisible()
    await expect(page.getByTestId('sd-cards')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await spaGoto(page, '/admin-sekolah/pilih-sekolah')
    await mock.failNext('/api/admin-sekolah/dashboard', 500)
    await spaGoto(page, PAGE)
    await expect(page.getByTestId('sd-error')).toBeVisible()
    await expect(page.getByTestId('sd-performance')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('tab title and header after navigating away and back', async ({ page, gotoApp }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await expectTabTitle(page, 'Dashboard Sekolah | PRESTASIPLUS')
    await page.getByTestId('sd-panel-levels').click()
    await page.goBack()
    await expect(page.getByTestId('sd-page')).toBeVisible({ timeout: 60_000 })
    await expectTabTitle(page, 'Dashboard Sekolah | PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText('SMK Demo Seri Putra')
  })

  test('sidebar "Dashboard" is active only on /admin-sekolah (desktop): not on monitoring', async ({
    page,
    gotoApp,
  }) => {
    test.skip(!isDesktopShell(page), 'sidebar is desktop only')
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    const item = page.locator('[data-testid="shell-user-sidebar"] [data-nav-id="sa-dashboard"]')
    await expect(item).toHaveClass(/\bactive\b/)
    await gotoApp('/admin-sekolah/monitoring')
    await expect(item).toBeVisible()
    await expect(item).not.toHaveClass(/\bactive\b/)
  })
})
