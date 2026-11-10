/**
 * M10 `/guru/kelas`, `/guru/kelas/cipta`, `/guru/kelas/:id/edit` and S35 (`/guru/kelas/:id` → 404) at
 * 375 / 768 / 1280 (M10-T5; R1-GUR-8, S6-T14: counter "{n} kelas · {n} pelajar", PRD copy, no join
 * code and no QR, the form Nama Kelas / Tingkatan / Subjek (pilihan) / Tahun Sesi, edit mode). Accounts:
 * 5 guru (`guru@demo.test`), the admin, and the role refusals of SRS §9 (pelajar goes to its landing page,
 * a guest to /login). The mock has no `PUT /api/guru/classes/:id`, so saving an edit is covered by the
 * component tests, not here.
 */

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

test.describe('M10 Kelas Saya (list)', MODULE, () => {
  test('R1-GUR-8 guru with no class: "0 kelas · 0 pelajar", "Cipta Kelas", PRD empty copy @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru/kelas')
    await expectTabTitle(page, 'Kelas Saya | PRESTASIPLUS')
    await expect(page.getByTestId('kelas-active-count')).toHaveText(/^0 kelas(?: · 0 pelajar)?$/)
    await expect(page.getByTestId('kelas-create')).toHaveAttribute('href', '/guru/kelas/cipta')
    await expect(page.getByTestId('kelas-create')).toHaveText('Cipta Kelas')
    await expect(page.getByTestId('kelas-empty')).toContainText(
      'Belum ada kelas. Cipta kelas pertama anda untuk mula.',
    )
    await expect(page.getByTestId('kelas-empty-create')).toHaveAttribute('href', '/guru/kelas/cipta')
    await expect(page.getByTestId('kelas-empty-create')).toHaveText('Cipta Kelas')
    await expectTouchTarget(page.getByTestId('kelas-create'))
    await expectNoHorizontalScroll(page)
  })

  test(
    'R1-GUR-8 guru: "2 kelas · {n} pelajar", two cards with an Edit link and no join code or QR @m10',
    provisional('class cards are PROPOSED (FR-M10-29)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kelas')
      await expect(page.getByTestId('kelas-active-count')).toHaveText(/^2 kelas · \d+ pelajar$/)
      const cards = page.getByTestId('class-card')
      await expect(cards).toHaveCount(2)
      await expect(cards.nth(0).getByTestId('class-count')).toHaveText('8 pelajar')
      await expect(cards.nth(1).getByTestId('class-count')).toHaveText('8 pelajar')
      await expect(page.getByTestId('class-code')).toHaveCount(0)
      await expect(page.getByTestId('class-qr')).toHaveCount(0)
      await expect(page.getByText('Kod QR')).toHaveCount(0)
      await expect(page.getByText(/DMO10\d/)).toHaveCount(0)
      const a = await cards.nth(0).boundingBox()
      const b = await cards.nth(1).boundingBox()
      if (isMobileWidth(page)) expect(Math.abs(a!.x - b!.x)).toBeLessThan(2)
      else expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
      const edit = cards.nth(0).getByTestId('class-edit')
      await expect(edit).toHaveText('Edit')
      await expect(edit).toHaveAttribute('href', /^\/guru\/kelas\/[^/]+\/edit$/)
      await expectTouchTarget(edit)
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M10 Cipta Kelas and Edit Kelas', MODULE, () => {
  test('R1-GUR-8 create form: Nama Kelas, Tingkatan, Subjek (pilihan), Tahun Sesi; no school picker, description or join code @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas/cipta')
    await expectTabTitle(page, 'Cipta Kelas Baru | PRESTASIPLUS')
    await expect(page.getByTestId('kelas-back')).toHaveAttribute('href', '/guru/kelas')
    await expect(page.getByText('Maklumat Kelas')).toBeVisible()
    await expect(page.getByTestId('kelas-name')).toHaveAttribute('placeholder', 'cth: 5 Bestari')
    const levels = page.locator('[data-testid="kelas-level"] option')
    await expect(levels).toHaveText([
      '-- Pilih tingkatan --',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    const options = page.locator('[data-testid="kelas-subject"] option')
    await expect(options.nth(0)).toHaveText('— Tiada —')
    await expect(options.nth(1)).toHaveText('Bahasa Melayu')
    await expect(page.getByText('Subjek (pilihan)')).toBeVisible()
    await expect(page.getByText('Tahun Sesi')).toBeVisible()
    await expect(page.getByTestId('kelas-year')).toHaveValue(/^20\d\d$/)
    await expect(page.getByTestId('school-search')).toHaveCount(0)
    await expect(page.getByTestId('kelas-description')).toHaveCount(0)
    await expect(page.getByTestId('kelas-members-card')).toHaveCount(0)
    await expect(page.getByTestId('kelas-submit')).toHaveText('Cipta Kelas')
    await expectTouchTarget(page.getByTestId('kelas-submit'))
    await expectNoHorizontalScroll(page)
    if (viewportWidth(page) < 640) {
      const b = await page.getByTestId('kelas-name').boundingBox()
      expect(b!.width).toBeGreaterThan(280)
    }
  })

  test('AC-GUR-8-2 empty form: BM messages, no request @m10', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas/cipta')
    await page.getByTestId('kelas-submit').click()
    await expect(page.getByText('Sila isi nama kelas.')).toBeVisible()
    await expect(page.getByText('Sila pilih tingkatan.')).toBeVisible()
    expect(await mock.requests('/api/guru/classes')).toHaveLength(0)
    await expect(page).toHaveURL(/\/guru\/kelas\/cipta$/)
  })

  test(
    'AC-GUR-8-1 guru creates "5 Bestari" Kimia Tingkatan 5: back on the list, "3 kelas", card with no join code @m10',
    provisional('the success flash and the card layout are UNVERIFIED / PROPOSED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kelas/cipta')
      await page.getByTestId('kelas-name').fill('5 Bestari')
      await page.getByTestId('kelas-level').selectOption('tingkatan-5')
      await page.getByTestId('kelas-subject').selectOption({ label: 'Kimia' })
      await page.getByTestId('kelas-submit').click()
      await expect(page).toHaveURL(/\/guru\/kelas$/)
      await expect(page.getByText('Kelas dicipta.')).toBeVisible()
      await expect(page.getByTestId('kelas-active-count')).toHaveText(/^3 kelas · \d+ pelajar$/)
      const card = page.getByTestId('class-card').filter({ hasText: '5 Bestari' })
      await expect(card).toHaveCount(1)
      await expect(card.getByTestId('class-subject')).toHaveText('Kimia')
      await expect(card.getByTestId('class-code')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test('R1-GUR-8 edit route: the card "Edit" opens the form filled, with the member list, the add box and the Cipta Pelajar link @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas')
    await page.getByTestId('class-card').first().getByTestId('class-edit').click()
    await expect(page).toHaveURL(/\/guru\/kelas\/[^/]+\/edit$/)
    await expectTabTitle(page, 'Edit Kelas | PRESTASIPLUS')
    await expect(page.getByTestId('kelas-name')).not.toHaveValue('')
    await expect(page.getByTestId('kelas-submit')).toHaveText('Simpan')
    await expect(page.getByTestId('kelas-members-card')).toBeVisible()
    await expect(page.getByTestId('kelas-add-existing')).toContainText('Tambah pelajar sedia ada')
    await expect(page.getByTestId('kelas-new-pupil-link')).toHaveAttribute(
      'href',
      '/guru/pelajar/cipta',
    )
    await expectNoHorizontalScroll(page)
  })

  test('R1-GUR-8 edit route of an unknown class: "Kelas tidak dijumpai." and no form @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas/999999/edit')
    await expect(page.getByTestId('kelas-not-found')).toContainText('Kelas tidak dijumpai.')
    await expect(page.getByTestId('kelas-form')).toHaveCount(0)
  })
})

test.describe('M10 S35 and role access', MODULE, () => {
  test('SRS §12 #02 /guru/kelas/:id renders the 404 page @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    for (const path of ['/guru/kelas/2001', '/guru/kelas/999999']) {
      await gotoApp(path)
      await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
      await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
      await expectNoHorizontalScroll(page)
    }
  })

  test(
    'SRS §9 a guest is sent to /login; a pelajar leaves /guru/kelas for its landing page @m10',
    provisional('other roles on /guru/* are INFERRED (OQ-M10-08)'),
    async ({ page, gotoApp, loginAs }) => {
      await gotoApp('/guru/kelas')
      await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)guru(%2F|\/)kelas$/)
      await loginAs(PELAJAR)
      await gotoApp('/guru/kelas/cipta')
      // v2: a forbidden role gets the 403 page in place (no redirect).
      await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
    },
  )
})
