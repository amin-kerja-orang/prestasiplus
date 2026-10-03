/**
 * M06-T2 S1 hub (SRS M06 v1.4 §12: E2E-M06-01, -02, and the S1 part of -04, -06, -39). All run on the three
 * viewport projects. `smoke-hub` is the file named in build-plan §2.6 ("Mod SPM - PRESTASIPLUS").
 */

import { expect, test } from './fixtures'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  viewportWidth,
} from '../support'
import { ADMIN, columnsOf, NOT_FOUND, PELAJAR, PELAJAR2, smallTexts, tid } from './support'

test.describe('M06 S1 hub', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-01 hub: pill, title, lead, stats, module cards, chips, links and icons', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm')
    await expectTabTitle(page, 'Mod SPM - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Mod SPM')
    if (isDesktopShell(page)) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Selamat datang kembali')
    }
    await expect(tid(page, 'spm-pill')).toHaveText('MOD SPM')
    await expect(tid(page, 'spm-title')).toHaveText('Persediaan SPM')
    await expect(tid(page, 'spm-lead')).toHaveText(
      'Latihan lengkap untuk pelajar Tingkatan 4 & 5. Soalan tahun lepas, latih tubi, Tracking A, dan latihan bahasa berformat sebenar.',
    )

    const stats = page.locator('[data-testid^=spm-stat-]')
    await expect(stats.getByTestId('stat-value')).toHaveText(['20,529', '25', '0', '1,769'])
    await expect(stats.getByTestId('stat-label')).toHaveText([
      'Jumlah Soalan',
      'Subjek SPM',
      'Tahun Tersedia',
      'Soalan Tracking A',
    ])
    const width = viewportWidth(page)
    expect(await columnsOf(page, 'spm-stats')).toBe(width >= 768 ? 4 : 2)

    const cards = page.locator('[data-testid^=spm-module-]')
    await expect(cards).toHaveCount(4)
    const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(hrefs).toEqual(['/spm/tahun-lepas', '/spm/latih-tubi', '/spm/ramalan', '/spm/subjektif'])
    await expect(cards.getByTestId('module-chip')).toHaveText([
      '14,673 soalan',
      '14,673 soalan',
      '1,769 soalan',
      '4,059 set subjektif',
    ])
    await expect(cards.nth(0)).toContainText('Databank Soalan')
    await expect(cards.nth(0)).toContainText(
      'Bank soalan SPM mengikut subjek, dipaparkan secara rawak.',
    )
    await expect(cards.nth(1)).toContainText('Latihan ikut topik dan bab untuk Tingkatan 4 & 5.')
    await expect(cards.nth(2)).toContainText(
      'Set objektif penuh dan lane bahasa khas untuk latihan intensif menjelang SPM.',
    )
    await expect(cards.nth(3)).toContainText(
      'Latihan soalan esei & jawapan panjang, disemak oleh guru.',
    )
    for (let i = 0; i < 4; i++) await expect(cards.nth(i)).toContainText('Mula')
    // Every tile icon shows a glyph (DV-M06-03).
    const blank = await page
      .getByTestId('module-icon')
      .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width === 0).length)
    expect(blank).toBe(0)
    expect(await columnsOf(page, 'spm-modules')).toBe(width >= 1024 ? 4 : width >= 768 ? 2 : 1)

    // 20,529 is never shown next to a smaller contradicting figure: both chips are below it.
    await expectNoHorizontalScroll(page)
    await tid(page, 'spm-history-link').click()
    await expect(page).toHaveURL(/\/spm\/history$/)
    await expect(tid(page, 'spm-heading')).toHaveText('Sejarah Kuiz SPM')
  })

  test('E2E-M06-02 "Prestasi SPM Anda" for the admin and for a student with no activity', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/spm')
    await expect(page.getByRole('heading', { name: 'Prestasi SPM Anda' })).toBeVisible()
    const values = page.locator('[data-testid^=spm-mine-]')
    await expect(values.getByTestId('mine-value')).toHaveText(['4', '21.8%', '26', '84'])
    await expect(values.getByTestId('mine-label')).toHaveText([
      'Sesi Kuiz',
      'Purata Ketepatan',
      'Syiling Diperoleh',
      'Soalan Dijawab',
    ])
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-02 student without activity shows 0 / 0.0% / 0 / 0', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/spm')
    await expect(page.locator('[data-testid^=spm-mine-]').getByTestId('mine-value')).toHaveText([
      '0',
      '0.0%',
      '0',
      '0',
    ])
  })

  test('E2E-M06-06 a guest goes to /login from S1', async ({ page, gotoApp }) => {
    await gotoApp('/spm')
    await expect(page).toHaveURL(/\/login/)
  })

  test('E2E-M06-06 an unknown subject code is the 404 page; S1 has no premium gate', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/latih-tubi/XYZ')
    await expectTabTitle(page, NOT_FOUND)
    // No premium gate on S1 (FR-M06-14).
    await gotoApp('/spm')
    await expect(tid(page, 'spm-title')).toBeVisible()
    await expect(tid(page, 'shell-user-main').getByText(/\bPRO\b/)).toHaveCount(0)
  })

  test('E2E-M06-39 S1 has no horizontal scroll and no text below 12px', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm')
    await expect(tid(page, 'spm-title')).toBeVisible()
    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
  })

  test('hub shows a skeleton while loading and an error box with "Cuba Semula"', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/history')
    await mock.setLatency(800, '/api/spm/overview')
    await page.getByTestId('spm-back').click()
    await expect(tid(page, 'spm-skeleton')).toBeVisible()
    await expect(tid(page, 'spm-title')).toBeVisible()
    await mock.clearLatency('/api/spm/overview')

    // In-app navigation keeps the armed fault (a reload would boot a fresh mock).
    await gotoApp('/spm/history')
    await mock.failNext('/api/spm/overview', 500)
    await page.getByTestId('spm-back').click()
    await expect(page.getByText('Maaf, berlaku ralat. Sila cuba semula.')).toBeVisible()
    await tid(page, 'spm-retry').click()
    await expect(tid(page, 'spm-stats')).toBeVisible()
  })
})
