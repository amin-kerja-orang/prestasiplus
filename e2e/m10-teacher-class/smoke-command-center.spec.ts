/**
 * M10 S2 `/guru/command-center` and the M17 drill-down mount at 375 / 768 / 1280 (M10-T4; SRS M10 §12
 * E2E-M10-08..17 and E2E-M17-70). Accounts: 5 guru (`guru@demo.test`: 8 pupils, 0 active today, 83 answers,
 * classes 2001 and 2002), admin 1 (`admin@demo.test`: the admin mirror, GPS 4.69 and no pupil) and the role
 * refusals (a pelajar goes to its landing page, a guest to /login). Evaluate, Badges, populated remedial
 * actions and the mount are PROPOSED / UNVERIFIED on live; those tests are `@provisional`.
 */

import type { Locator, Page } from '@playwright/test'

import { ALESA_ON } from '../support/alesa'
import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTouchTarget,
  isDesktopShell,
  isInViewportX,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(10)] }
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'
const CC = '/guru/command-center'
const API = '/api/guru/command-center'

test.use({ mockInit: { latency: 0 } })

const tid = (page: Page, id: string) => page.getByTestId(id)

async function openBoard(page: Page, gotoApp: (path: string) => Promise<void>): Promise<void> {
  await gotoApp(CC)
  await expect(tid(page, 'cc-s2')).toBeVisible()
  await expect(tid(page, 'cc-clock')).toBeVisible()
}

/** Distinct left edges of the boxes: 1 per row at 375, 2 at 768, 4 at 1280. */
async function columnsOf(locators: Locator): Promise<number> {
  const xs = await locators.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().left)),
  )
  return new Set(xs).size
}

/** The smallest computed font size (px) of the visible text nodes under `root`. */
async function minFontSize(page: Page, rootTestId: string): Promise<number> {
  return page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`) ?? document.body
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let min = Infinity
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue
      const el = n.parentElement
      if (!el) continue
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      min = Math.min(min, parseFloat(style.fontSize))
    }
    return min
  }, rootTestId)
}

test.describe('M10 S2 Command Center, admin mirror', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('E2E-M10-08 tab title, no shell, top bar, KPI values, empty panels, insight, footer, 10 s poll @m10', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openBoard(page, gotoApp)
    await expect(page).toHaveTitle(/^Command Center — Guru: \S.* [|] PRESTASIPLUS$/)
    await expect(tid(page, 'shell-user-sidebar')).toHaveCount(0)
    await expect(tid(page, 'shell-admin-sidebar')).toHaveCount(0)

    await expect(tid(page, 'cc-title')).toHaveText('Command Center')
    await expect(tid(page, 'cc-back')).toHaveAttribute('href', '/guru')
    await expect(tid(page, 'cc-back')).toHaveText('← Dashboard')
    await expect(tid(page, 'cc-links').getByRole('link')).toHaveText([
      '🔬 Remedial',
      '📊 Rekod',
      '⚠ Evaluate',
      '🔮 Ramalan SPM',
      '👩‍🏫 Kelas',
      '🏆 Badges',
    ])
    await expect(tid(page, 'cc-link-rekod')).toHaveAttribute('href', '/guru/remedial-progress')
    await expect(tid(page, 'cc-live-badge')).toHaveText('LIVE')

    // the clock ticks (the Playwright clock runs 3 s)
    const first = await tid(page, 'cc-clock').innerText()
    expect(first).toMatch(/^\d\d:\d\d:\d\d$/)
    await mock.advanceTime(3000)
    await expect(tid(page, 'cc-clock')).not.toHaveText(first)

    await expect(tid(page, 'cc-kpi-value')).toHaveText(['--', '--', '0%', '4.69'])
    await expect(tid(page, 'cc-kpi-sub')).toHaveText([
      '0 aktif menjawab',
      'sepanjang masa',
      'keseluruhan sekolah',
      'purata GPS',
    ])
    await expect(tid(page, 'cc-classes-empty')).toHaveText('Tiada data')
    await expect(tid(page, 'cc-feed-empty')).toHaveText('Tiada aktiviti terkini')
    await expect(tid(page, 'cc-leaderboard-empty')).toHaveText('Tiada data minggu ini')
    await expect(tid(page, 'cc-week-change')).toHaveText('Sama dengan minggu lepas')
    await expect(tid(page, 'cc-insight')).toHaveText(
      '"0% pelajar terlibat aktif. Ketepatan purata 0%. GPS sekolah: 4.69."',
    )
    await expect(tid(page, 'cc-engagement-total')).toHaveText('Jumlah: 0 pelajar')
    await expect(
      page.locator('[data-testid^="cc-band-"]:not([data-testid="cc-band-count"])'),
    ).toHaveCount(5)
    await expect(tid(page, 'cc-kirk-text')).toHaveText([
      '☆☆☆☆☆ 0/10',
      '0% ketepatan',
      '0 aktif 30h',
      'GPS 4.69',
    ])
    await expect(tid(page, 'cc-activity-today')).toHaveText('0 soalan')
    await expect(tid(page, 'cc-footer')).toHaveText(
      (ALESA_ON ? 'Powered by ALESA AI · ' : '') +
        'PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat',
    )

    // after 10 s a second live-data request
    await expect
      .poll(async () => (await mock.requests(`GET ${API}/live-data`)).length)
      .toBeGreaterThanOrEqual(1)
    const before = (await mock.requests(`GET ${API}/live-data`)).length
    await mock.advanceTime(10_000)
    await expect
      .poll(async () => (await mock.requests(`GET ${API}/live-data`)).length)
      .toBeGreaterThan(before)
  })

  test('E2E-M10-09 grids 1 / 2 / 4 per row, nothing clipped, links reachable, LIVE and clock visible, text >= 12 px @m10', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp)
    const width = viewportWidth(page)
    const kpis = tid(page, 'cc-kpis').locator(':scope > div')
    await expect(kpis).toHaveCount(4)
    const expectedCols = isMobileWidth(page) ? 1 : isDesktopShell(page) ? 4 : 2
    expect(await columnsOf(kpis)).toBe(expectedCols)
    const panels = tid(page, 'cc-panels').locator('section')
    await expect(panels).toHaveCount(8)
    // 4 grid columns at 1280: the three panel columns start at 3 distinct edges (the middle one spans 2)
    expect(await columnsOf(panels)).toBe(expectedCols === 4 ? 3 : expectedCols)

    // no tile or panel clipped: every box inside the viewport
    for (const box of await kpis.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().toJSON()),
    )) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(width + 0.5)
    }
    for (const box of await panels.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().toJSON()),
    )) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(width + 0.5)
    }

    // the six links: scrollable row below 1024 px, all reachable
    const nav = tid(page, 'cc-links')
    const links = nav.getByRole('link')
    await expect(links).toHaveCount(6)
    if (isDesktopShell(page)) {
      expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    } else if (isMobileWidth(page)) {
      expect(await nav.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    }
    for (let i = 0; i < 6; i++) {
      const link = links.nth(i)
      await link.scrollIntoViewIfNeeded()
      expect(await isInViewportX(page, link)).toBe(true)
      await expectTouchTarget(link)
    }
    await expectTouchTarget(tid(page, 'cc-back'))
    expect(await isInViewportX(page, tid(page, 'cc-live-badge'))).toBe(true)
    expect(await isInViewportX(page, tid(page, 'cc-clock'))).toBe(true)
    await expectNoHorizontalScroll(page)

    expect(await minFontSize(page, 'cc-s2')).toBeGreaterThanOrEqual(12)
    // with a modal open
    await tid(page, 'cc-kpi-students').click()
    await expect(tid(page, 'cc-drill-empty')).toBeVisible()
    expect(await minFontSize(page, 'cc-s2')).toBeGreaterThanOrEqual(12)
    expect(await minFontSize(page, 'cc-drill-modal')).toBeGreaterThanOrEqual(12)
    // the panel scales in (F-15): measure the button once the transition has ended
    await expect
      .poll(async () => (await tid(page, 'cc-modal-close').boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(43.9)
    await expectTouchTarget(tid(page, 'cc-modal-close'))
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M10-11 drill titles after the loading texts, "Tiada data", closes by "×" and by the backdrop @m10', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openBoard(page, gotoApp)
    await mock.setLatency(600, `GET ${API}/drill`)
    const cases: [string, string][] = [
      ['cc-kpi-students', 'Pelajar Berdaftar'],
      ['cc-kpi-gps', 'GPS Sekolah'],
      ['cc-kirk-t1', 'Kirkpatrick T1'],
      ['cc-mood-happy', 'Mood Pelajar'],
    ]
    for (const [tile, title] of cases) {
      await tid(page, tile).click()
      await expect(tid(page, 'cc-modal-title')).toHaveText('Memuatkan...')
      await expect(tid(page, 'cc-drill-loading')).toHaveText('Memuatkan data...')
      await expect(tid(page, 'cc-modal-title')).toHaveText(title)
      await expect(tid(page, 'cc-drill-empty')).toHaveText('Tiada data')
      await tid(page, 'cc-modal-close').click()
      await expect(tid(page, 'cc-drill-modal')).toHaveCount(0)
    }
    await tid(page, 'cc-kpi-students').click()
    await expect(tid(page, 'cc-drill-empty')).toBeVisible()
    await page.getByTestId('cmp-modal-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(tid(page, 'cc-drill-modal')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M10-13 "👩‍🏫 Kelas" (0 / 0 / 0%, headers, no row) and "🔮 Ramalan SPM" (cards, 10 chips, empty text) @m10', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp)
    await tid(page, 'cc-link-kelas').click()
    await expect(tid(page, 'cc-modal-title')).toHaveText('Kelas Saya — Ringkasan Prestasi')
    await expect(tid(page, 'cc-modal-card')).toHaveText([
      '0Jumlah Pelajar',
      '0Aktif',
      '0%Ketepatan',
    ])
    await expect(tid(page, 'cc-kelas-table').locator('th')).toHaveText([
      '#',
      'Kelas',
      'Tingkatan',
      'Pelajar',
      'Aktif',
      'Ketepatan',
    ])
    await expect(tid(page, 'cc-kelas-row')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await tid(page, 'cc-modal-close').click()

    await tid(page, 'cc-link-predictive').click()
    await expect(tid(page, 'cc-modal-title')).toHaveText('Ramalan SPM — Predictive Analytics')
    await expect(tid(page, 'cc-grade-chip')).toHaveText([
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'C+',
      'C',
      'D',
      'E',
      'G',
    ])
    await expect(tid(page, 'cc-modal-card')).toHaveText([
      '0Pelajar Dianalisis',
      '0Ramalan GPS Purata',
      '0Berisiko',
      '-Gred Terbanyak',
    ])
    await expect(tid(page, 'cc-predictive-empty')).toHaveText('Tiada data mencukupi untuk ramalan')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M10-15 "🔬 Remedial": loading text then the congratulation; a failed scan shows "Ralat: ..." @m10', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await openBoard(page, gotoApp)
    await mock.setLatency(600, `GET ${API}/remedial/scan`)
    await tid(page, 'cc-link-remedial').click()
    await expect(tid(page, 'cc-modal-title')).toHaveText('Smart Remedial — Scan Pelajar Lemah')
    await expect(tid(page, 'cc-modal-loading')).toHaveText('Mengimbas topik lemah pelajar...')
    await expect(tid(page, 'cc-remedial-empty')).toHaveText(
      'Tiada pelajar dengan topik lemah (<50% accuracy). Tahniah!',
    )
    await tid(page, 'cc-modal-close').click()

    await mock.failNext(`GET ${API}/remedial/scan`, 500)
    await tid(page, 'cc-link-remedial').click()
    await expect(tid(page, 'cc-remedial-error')).toContainText('Ralat: ')
    await expect(tid(page, 'cc-remedial-table')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M10-17 Evaluate and Badges for the admin: cards and the empty states',
    provisional('Evaluate and Badges were never opened on live (L-M10-03)'),
    async ({ page, gotoApp }) => {
      await openBoard(page, gotoApp)
      await tid(page, 'cc-link-evaluate').click()
      await expect(tid(page, 'cc-modal-title')).toHaveText(
        'Auto Evaluate — Penilaian Risiko Pelajar',
      )
      await expect(tid(page, 'cc-modal-card')).toHaveText([
        '0Jumlah Pelajar',
        '0Berisiko',
        '0Kritikal',
        '0Tinggi',
        '0Sederhana',
      ])
      await expect(tid(page, 'cc-evaluate-empty')).toHaveText(
        'Semua pelajar dalam keadaan baik! Tiada risiko dikesan.',
      )
      await expectNoHorizontalScroll(page)
      await tid(page, 'cc-modal-close').click()

      await tid(page, 'cc-link-badges').click()
      await expect(tid(page, 'cc-modal-title')).toHaveText(
        'Achievement System — Scan & Award Badges',
      )
      await expect(tid(page, 'cc-modal-card').first()).toContainText('Pelajar')
      await expect(tid(page, 'cc-badge-chip').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M10 S2 Command Center, guru 5', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(GURU)
  })

  test('E2E-M10-10 KPI tiles 8 / "0 aktif menjawab" / 83 and the class rows of 2001 and 2002 @m10', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp)
    await expect(page).toHaveTitle('Command Center — Guru: Guru Demo | PRESTASIPLUS')
    const values = tid(page, 'cc-kpi-value')
    await expect(values.nth(0)).toHaveText('8')
    await expect(values.nth(1)).toHaveText('83')
    await expect(tid(page, 'cc-kpi-sub').nth(0)).toHaveText('0 aktif menjawab')
    const rows = tid(page, 'cc-class-row')
    await expect(rows).toHaveCount(2)
    await expect(tid(page, 'cc-class-level')).toHaveText(['tingkatan-5', 'tingkatan-5'])
    await expect(tid(page, 'cc-class-stats').first()).toContainText('8 plj')
    await expect(tid(page, 'cc-class-stats').last()).toContainText('8 plj')
    await expect(tid(page, 'cc-engagement-total')).toHaveText('Jumlah: 8 pelajar')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M10-12 drill students: 8 rows with status "Login" @m10', async ({ page, gotoApp }) => {
    await openBoard(page, gotoApp)
    await expect(tid(page, 'cc-kpi-value').first()).toHaveText('8')
    await tid(page, 'cc-kpi-students').click()
    await expect(tid(page, 'cc-modal-title')).toHaveText('Pelajar Berdaftar')
    const rows = tid(page, 'cc-drill-row')
    await expect(rows).toHaveCount(8)
    const lastCells = await rows.evaluateAll((els) =>
      els.map((el) => el.querySelectorAll('td')[5]?.textContent?.trim()),
    )
    expect(lastCells).toEqual(Array(8).fill('Login'))
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M10-12b a drill row opens the mounted M17 student page in a new tab; a pupil outside the scope is 404',
    provisional(
      'the mount of the M17 drill-down under /guru/command-center is PROPOSED (FR-M17-60)',
    ),
    async ({ page, gotoApp, context }) => {
      await openBoard(page, gotoApp)
      await expect(tid(page, 'cc-kpi-value').first()).toHaveText('8')
      await tid(page, 'cc-kpi-students').click()
      const rows = tid(page, 'cc-drill-row')
      await expect(rows).toHaveCount(8)

      // The popup is opened by `window.open` and is a page without the fixture's __MOCK_INIT__ script
      // (init scripts are per page), so its own content is not asserted: only its URL is read, then the
      // same URL is opened in the main page, which is wired.
      const popupPromise = context.waitForEvent('page')
      await rows.first().click()
      const popup = await popupPromise
      await expect.poll(() => popup.url()).toMatch(/\/guru\/command-center\/student\/\d+$/)
      const url = new URL(popup.url())
      await popup.close()

      await gotoApp(url.pathname)
      await expect(tid(page, 'cc-title')).toHaveText('PrestasiPlus Command Center')
      await expect(tid(page, 'cc-crumb-current')).toHaveText(/\S/)
      await expect(tid(page, 'shell-user-sidebar')).toHaveCount(0)
      await expectNoHorizontalScroll(page)

      await gotoApp(`${CC}/student/2022`)
      await expect(page.locator('[data-page=not-found]')).toBeVisible()
      await expect(page).toHaveTitle(NOT_FOUND_TITLE)
    },
  )

  test('E2E-M10-14 "👩‍🏫 Kelas": two rows (2001, 2002) @m10', async ({ page, gotoApp }) => {
    await openBoard(page, gotoApp)
    await tid(page, 'cc-link-kelas').click()
    await expect(tid(page, 'cc-kelas-row')).toHaveCount(2)
    await expect(tid(page, 'cc-modal-card').first()).toHaveText('8Jumlah Pelajar')
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M10-14c a Kelas row opens the mounted M17 class page in a new tab',
    provisional(
      'the mount of the M17 drill-down under /guru/command-center is PROPOSED (FR-M17-60)',
    ),
    async ({ page, gotoApp, context }) => {
      await openBoard(page, gotoApp)
      await tid(page, 'cc-link-kelas').click()
      await expect(tid(page, 'cc-kelas-row')).toHaveCount(2)
      // popup content is not asserted, see E2E-M10-12b
      const popupPromise = context.waitForEvent('page')
      await tid(page, 'cc-kelas-row').first().click()
      const popup = await popupPromise
      await expect.poll(() => popup.url()).toMatch(/\/guru\/command-center\/classroom\/2001$/)
      await popup.close()
    },
  )

  test('E2E-M10-14b "🔮 Ramalan SPM" lists the pupils with 10 or more answers and risk chips @m10', async ({
    page,
    gotoApp,
  }) => {
    await openBoard(page, gotoApp)
    await tid(page, 'cc-link-predictive').click()
    await expect(tid(page, 'cc-predictive-row').first()).toBeVisible()
    await expect(tid(page, 'cc-modal-card').first()).toHaveText('3Pelajar Dianalisis')
    await expect(tid(page, 'cc-predictive-row').first()).toContainText('KRITIKAL')
    await expect(tid(page, 'cc-predictive-table').locator('th')).toHaveText([
      '#',
      'Pelajar',
      'Accuracy',
      'Trend',
      'Konsistensi',
      'Ramalan',
      'GPS',
      'Risiko',
    ])
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M10-16 Remedial: count line, headers, "Lihat Quiz (5 soalan)" and "Batal & Jana Semula", "Jana Kimia" and the failures',
    provisional('the remedial actions are SOURCE-DERIVED, the server rules UNVERIFIED (FR-M10-23)'),
    async ({ page, gotoApp, mock, context }) => {
      await openBoard(page, gotoApp)
      await tid(page, 'cc-link-remedial').click()
      await expect(tid(page, 'cc-remedial-count')).toHaveText(
        '7 pelajar dikesan lemah dalam topik tertentu (accuracy <50%)',
      )
      await expect(tid(page, 'cc-remedial-table').locator('th')).toHaveText([
        'Pelajar',
        'Topik Lemah',
        'Accuracy Terendah',
        'Tindakan',
      ])
      await expectNoHorizontalScroll(page)

      const row8 = tid(page, 'cc-remedial-row').filter({ hasText: 'Murid Demo 08' })
      const view = row8.getByTestId('cc-remedial-view')
      await expect(view).toHaveText('Lihat Quiz (5 soalan)')
      await expect(view).toHaveAttribute('href', '/remedial/7601')
      const popupPromise = context.waitForEvent('page')
      await view.click()
      const popup = await popupPromise
      await expect.poll(() => popup.url()).toMatch(/\/remedial\/7601$/)
      await popup.close()

      // generate for another pupil: "Menjana..." then the "{Subjek} ({n})" link; a refusal shows its text
      await mock.setLatency(500, `POST ${API}/remedial/generate`)
      const row2 = tid(page, 'cc-remedial-row').filter({ hasText: 'Murid Demo 02' })
      await mock.failNext(`POST ${API}/remedial/generate`, {
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Tiada soalan untuk topik lemah',
      })
      await row2.getByTestId('cc-remedial-generate').first().click()
      await expect(row2.getByTestId('cc-remedial-gen-error').first()).toHaveText(
        'Tiada soalan untuk topik lemah',
      )
      const button = row2.getByTestId('cc-remedial-generate').first()
      await expect(button).toHaveText('Jana Kimia')
      await button.click()
      await expect(button).toHaveText('Menjana...')
      await expect(row2.getByTestId('cc-remedial-made').first()).toHaveText(/^Kimia \(\d+\)$/)

      // cancel 7601: a failure first, then the success
      await mock.setLatency(500, `POST ${API}/remedial/cancel`)
      await mock.failNext(`POST ${API}/remedial/cancel`, 409)
      const cancel = row8.getByTestId('cc-remedial-cancel')
      const failed = acceptNextDialog(page, {
        message:
          'Batal set soalan remedial untuk Murid Demo 08? Anda boleh jana semula selepas ini.',
      })
      await cancel.click()
      await failed
      await expect(row8.getByTestId('cc-remedial-cancel-text')).toHaveText('Gagal — cuba lagi')
      const accepted = acceptNextDialog(page)
      await cancel.click()
      await accepted
      await expect(cancel).toHaveText('Membatal...')
      await expect(row8.getByTestId('cc-remedial-cancel-text')).toHaveText(
        'Dibatalkan — boleh jana semula',
      )
      await expect(row8.getByTestId('cc-remedial-generate').first()).toHaveText('Jana Kimia')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M10-17 Evaluate (risk badges, rows open the student page) and Badges (chip -> holders modal)',
    provisional('Evaluate and Badges were never opened on live (L-M10-03)'),
    async ({ page, gotoApp }) => {
      await openBoard(page, gotoApp)
      await tid(page, 'cc-link-evaluate').click()
      await expect(tid(page, 'cc-evaluate-row').first()).toBeVisible()
      await expect(tid(page, 'cc-modal-card').first()).toHaveText('8Jumlah Pelajar')
      const risks = await tid(page, 'cc-risk').allTextContents()
      expect(risks.length).toBeGreaterThan(0)
      for (const r of risks) expect(['KRITIKAL', 'TINGGI', 'SEDERHANA']).toContain(r.trim())
      await expectNoHorizontalScroll(page)
      await tid(page, 'cc-modal-close').click()

      await tid(page, 'cc-link-badges').click()
      const chips = tid(page, 'cc-badge-chip')
      await expect(chips).toHaveCount(3)
      await chips.first().click()
      await expect(tid(page, 'cc-holders-modal')).toBeVisible()
      await expect(tid(page, 'cc-holders-modal').getByTestId('cc-modal-title')).toHaveText(
        'Lencana: Pemula Rajin',
      )
      await expect(tid(page, 'cc-holders-empty')).toHaveText(
        'Belum ada pelajar yang memiliki lencana ini.',
      )
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M17 mount under /guru/command-center (E2E-M17-70) and refusals', MODULE, () => {
  test(
    'E2E-M17-70 teacher: classroom 2001 shows class 2001, classroom 370 is 404',
    provisional('the teacher mount of the M17 drill-down is PROPOSED (FR-M17-60)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp(`${CC}/classroom/2001`)
      // S6 on the DS detail template (DV-M17-57): the shell prints the title and crumbs; back link "Kembali"
      await expect(tid(page, 'cc-title')).toHaveCount(0)
      await expect(tid(page, 'cc-info')).toContainText('Kimia')
      await expect(page.locator('[data-ds="back-link"]')).toHaveAttribute('href', /^\/guru\/command-center/)
      await expect(tid(page, 'shell-user-sidebar')).toHaveCount(0)
      await expectNoHorizontalScroll(page)

      await gotoApp(`${CC}/classroom/370`)
      await expect(page.locator('[data-page=not-found]')).toBeVisible()
      await expect(page).toHaveTitle(NOT_FOUND_TITLE)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'FR-M10-26 admin is unscoped: classroom 370 opens on the mounted page',
    provisional('the teacher mount of the M17 drill-down is PROPOSED (FR-M17-60)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp(`${CC}/classroom/370`)
      await expect(tid(page, 'cc-title')).toHaveCount(0)
      await expect(tid(page, 'cc-info')).toHaveText(/\S/)
      await expect(page.locator('[data-page=not-found]')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §9 a guest is sent to /login; a pelajar leaves S2 and the mount for its landing page',
    provisional('other roles on /guru/* are INFERRED (OQ-M10-08)'),
    async ({ page, gotoApp, loginAs }) => {
      await gotoApp(CC)
      await expect(page).toHaveURL(/\/login$/)
      await loginAs(PELAJAR)
      await gotoApp(CC)
      await expect(page).not.toHaveURL(/\/guru\//)
      await gotoApp(`${CC}/classroom/2001`)
      await expect(page).not.toHaveURL(/\/guru\//)
    },
  )
})
