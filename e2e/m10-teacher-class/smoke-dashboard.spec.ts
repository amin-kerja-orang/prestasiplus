/**
 * M10 S1 `/guru` "Dashboard Guru" at 375 / 768 / 1280 (M10-T2; SRS M10 §12 E2E-M10-05, 06, 07 and
 * the S1 part of 02, 09 and 79). Accounts: the admin (no classes, observed 0/3 and 20719) and
 * 5 guru (`guru@demo.test`, classes 2001 and 2002: 3/3, provisional definitions).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

/** FR-M10-129: no text node inside `main` is smaller than 12px. */
async function minFontSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.querySelector('main') ?? document.body
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let min = Infinity
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || !n.parentElement) continue
      min = Math.min(min, parseFloat(getComputedStyle(n.parentElement).fontSize))
    }
    return min
  })
}

test.describe('M10 S1 Dashboard Guru', MODULE, () => {
  test('E2E-M10-02/06 admin: header, checklist 0/3, stat cards, panels, tiles, empty cards @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    await expect(page.getByTestId('guru-dashboard')).toBeVisible({ timeout: 15_000 })
    await expectTabTitle(page, 'Dashboard Guru | PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Dashboard Guru')
    await expect(page.getByTestId('shell-user-subtitle')).toContainText('Selamat datang, ')
    await expect(page.getByTestId('shell-user-subtitle')).toContainText('👩‍🏫')

    await expect(page.getByTestId('checklist-count')).toHaveText('0/3 langkah selesai')
    await expect(page.getByTestId('checklist-percent')).toHaveText('0%')
    await expect(page.getByTestId('checklist-link')).toHaveCount(3)
    await expect(page.getByTestId('checklist-link').nth(2)).toHaveAttribute(
      'href',
      '/guru/misi-harian/cipta',
    )

    const values = page.getByTestId('stat-value')
    await expect(values).toHaveText(['0', '0', '20719', '0'])
    await expect(page.getByTestId('stat-questions')).toContainText('✅ 19361 diluluskan')
    await expect(page.getByTestId('stat-classes')).toContainText('0 jumlah kelas')

    const today = page.getByTestId('today-panel')
    await expect(today).toContainText('Fokus guru yang paling penting hari ini')
    await expect(today).toContainText('Tiada pelajar berkeutamaan tinggi dikesan buat masa ini.')
    await expect(today).toContainText('Tiada topik kritikal menonjol dikesan daripada data semasa.')
    await expect(page.getByTestId('today-analytics')).toHaveAttribute('href', '/analitik/kelas')
    await expect(page.getByTestId('today-action')).toContainText(
      'Bina aktiviti pertama untuk pelajar',
    )
    await expect(page.getByTestId('today-action-link')).toHaveAttribute('href', '/guru/kelas')

    await expect(page.getByTestId('peer-card')).toContainText('Cadangan rakan pembimbing pelajar')
    await expect(page.getByTestId('peer-card').locator('p').first()).toHaveCSS(
      'text-transform',
      'uppercase',
    )
    await expect(page.getByTestId('quick-tile')).toHaveCount(4)
    await expect(page.getByTestId('classes-empty')).toHaveText('Belum ada kelas. Cipta sekarang!')
    await expect(page.getByTestId('submissions-empty')).toContainText(
      'Buat tugasan di kelas untuk lihat penghantaran di sini.',
    )

    await expectTouchTarget(page.getByTestId('checklist-link').first())
    await expectTouchTarget(page.getByTestId('quick-tile').first())
    await expectNoHorizontalScroll(page)
    expect(await minFontSize(page)).toBeGreaterThanOrEqual(12)
  })

  test('E2E-M10-05 guide: content, close → pill persists on reload, pill → guide persists @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    await expect(page.getByTestId('guide-title')).toHaveText('Mula Di Sini — 3 Langkah Mudah')
    await expect(page.getByTestId('guide-step')).toHaveCount(3)
    await expect(page.getByTestId('guide-link')).toHaveText([
      'Kelas Saya →',
      'Pelajar Saya →',
      'Monitoring →',
    ])
    await expectNoHorizontalScroll(page)

    await page.getByTestId('guide-close').click()
    await expect(page.getByTestId('guide-show')).toHaveText('Tunjuk panduan Mula Di Sini')
    await gotoApp('/guru')
    await expect(page.getByTestId('guide-show')).toBeVisible()
    await expect(page.getByTestId('guide-card')).toHaveCount(0)

    await page.getByTestId('guide-show').click()
    await expect(page.getByTestId('guide-card')).toBeVisible()
    await gotoApp('/guru')
    await expect(page.getByTestId('guide-card')).toBeVisible()
  })

  test('responsive: stat cards 2 / 4 per row, panels stack below lg, no h-scroll @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    await expect(page.getByTestId('stat-cards')).toBeVisible()
    const boxes = await Promise.all(
      ['classes', 'students', 'questions', 'assignments'].map((k) =>
        page.getByTestId(`stat-${k}`).boundingBox(),
      ),
    )
    const perRow = boxes.filter((b) => Math.abs(b!.y - boxes[0]!.y) < 2).length
    expect(perRow).toBe(viewportWidth(page) >= 1024 ? 4 : 2)
    const cols = await Promise.all(
      ['today-students', 'today-topics', 'today-actions'].map((k) =>
        page.getByTestId(k).boundingBox(),
      ),
    )
    const sideBySide = Math.abs(cols[0]!.y - cols[1]!.y) < 2
    expect(sideBySide).toBe(viewportWidth(page) >= 1024)
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M10-07 guru: 3/3, 100%, Kelas Aktif 2, Pelajar 8, class lines @m10',
    provisional('definitions of the counts are INFERRED (DV-M10-12, BR-M10-05)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru')
      await expect(page.getByTestId('checklist-count')).toHaveText('3/3 langkah selesai')
      await expect(page.getByTestId('checklist-percent')).toHaveText('100%')
      await expect(page.getByTestId('stat-value')).toHaveText(['2', '8', '1', '0'])
      await expect(page.getByTestId('stat-classes')).toContainText('2 jumlah kelas')
      await expect(page.getByTestId('classes-item')).toHaveCount(2)
      await expect(page.getByTestId('classes-item').first()).toContainText('· 8 pelajar')
      await expect(page.getByTestId('submissions-empty')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )
})
