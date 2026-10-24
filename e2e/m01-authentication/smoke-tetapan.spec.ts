/**
 * M01-T7a developer smoke: S9 `/tetapan` in the user shell (Murid / Guru / Admin Sekolah) at
 * 375 / 768 / 1280. Observed: hero, cards, exact copy, defaults, independent controls, tab title
 * "Tetapan Peribadi" (no suffix). INFERRED (@provisional): the user shell for non-admin roles
 * (OQ-6), the save round trip and its success copy (UNVERIFIED COPY).
 */

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  SM_MIN_WIDTH,
  TAG,
  viewportWidth,
} from '../support'

const DESCRIPTIONS = [
  'Suis utama — jika dimatikan, semua elemen rohani dinyahaktifkan.',
  'Paparan 2 saat sebelum kuiz bermula: "Bismillahi tawakkaltu \'alallah". Tetapan untuk Muslim.',
  'Notifikasi awal pagi untuk yang bangun Subuh — 30 minit waktu belajar selepas Subuh paling produktif.',
  'Notifikasi waktu sahur (~4:30 pagi) untuk belajar sebelum Subuh. Rentak lebih ringan semasa Ramadan.',
  'Untuk mod rohani yang sesuai. Future: Hindu/Buddhist/Christian content akan ditambah.',
]

test.describe('M01 /tetapan (user shell)', { tag: [TAG.smoke, moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.slow() // the mock boots slowly when other builds share the machine

  test('E2E-M01-32 guru: hero, cards, exact copy, defaults, independent controls', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('guru@demo.test')
    await gotoApp('/tetapan')
    await expectTabTitle(page, 'Tetapan Peribadi')

    await expect(page.getByRole('heading', { name: '⚙️ Tetapan Peribadi' })).toBeVisible()
    await expect(
      page.getByText('Atur pengalaman PrestasiPlus mengikut keperluan rohani & masa anda.'),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: '🕌 Mod Rohani' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '🌍 Latar Agama (pilihan)' })).toBeVisible()
    for (const text of DESCRIPTIONS)
      await expect(page.getByText(text, { exact: true })).toBeVisible()

    for (const id of [
      'spiritual_mode',
      'show_bismillah_splash',
      'subuh_push_enabled',
      'ramadan_mode_enabled',
    ]) {
      await expect(page.getByTestId(`tetapan-${id}`)).not.toBeChecked()
    }
    await expect(page.getByTestId('tetapan-subuh_push_enabled-time')).toHaveValue('05:30')
    await expect(page.getByTestId('tetapan-ramadan_mode_enabled-time')).toHaveValue('04:30')
    await expect(page.getByTestId('tetapan-faith')).toHaveValue('')
    await expect(page.getByTestId('tetapan-faith').locator('option')).toHaveText([
      '— Tidak nyatakan —',
      'Islam',
      'Hindu',
      'Buddha',
      'Kristian',
      'Tiada',
    ])

    // Independent: ticking every box changes nothing else; times are always editable.
    await page.getByTestId('tetapan-spiritual_mode').check()
    await page.getByTestId('tetapan-subuh_push_enabled').check()
    await expect(page.getByTestId('tetapan-show_bismillah_splash')).not.toBeChecked()
    await expect(page.getByTestId('tetapan-ramadan_mode_enabled-time')).toBeEnabled()
    await expect(page.getByTestId('tetapan-subuh_push_enabled-time')).toHaveValue('05:30')

    await expectTouchTarget(page.getByTestId('tetapan-submit'))
    await expectTouchTarget(page.getByTestId('tetapan-faith'))
    await expectNoHorizontalScroll(page)
  })

  test('layout: stacked below sm, row from sm; no horizontal scroll', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/tetapan')
    await expect(page.getByTestId('tetapan-form')).toBeVisible()
    const check = await page.getByTestId('tetapan-subuh_push_enabled').boundingBox()
    const time = await page.getByTestId('tetapan-subuh_push_enabled-time').boundingBox()
    expect(check).not.toBeNull()
    expect(time).not.toBeNull()
    if (viewportWidth(page) < SM_MIN_WIDTH) {
      expect((time?.y ?? 0) > (check?.y ?? 0) + (check?.height ?? 0)).toBe(true)
    } else {
      expect(Math.abs((time?.y ?? 0) - (check?.y ?? 0))).toBeLessThan(30)
    }
    await expectNoHorizontalScroll(page)
  })

  for (const who of ['pelajar@demo.test', 'adminsekolah@demo.test']) {
    test(
      `E2E-M01-32 save round trip as ${who} keeps the values @m01`,
      provisional('user shell for non-admin (OQ-6), save flash copy UNVERIFIED'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(who)
        await gotoApp('/tetapan')
        await page.getByTestId('tetapan-spiritual_mode').check()
        await page.getByTestId('tetapan-ramadan_mode_enabled-time').fill('04:45')
        await page.getByTestId('tetapan-faith').selectOption('muslim')
        await page.getByTestId('tetapan-submit').click()
        await expect(page.getByTestId('tetapan-status')).toContainText('Tetapan berjaya disimpan.')
        await expect(page.getByTestId('tetapan-spiritual_mode')).toBeChecked()

        await gotoApp('/tetapan')
        await expect(page.getByTestId('tetapan-form')).toBeVisible()
        await expect(page.getByTestId('tetapan-spiritual_mode')).toBeChecked()
        await expect(page.getByTestId('tetapan-ramadan_mode_enabled-time')).toHaveValue('04:45')
        await expect(page.getByTestId('tetapan-faith')).toHaveValue('muslim')
        await expectNoHorizontalScroll(page)
      },
    )
  }
})
