/**
 * M02-T6 developer smoke for S4 `/admin/users/bulk-import` and S5 `/admin/import-students` (build-plan M02-T6;
 * QA writes E2E-M02-* at G5): a paste import with one created, one skipped and one failed line; the S5
 * quota panel for school 10220 (2 / 1000, allowed) and 8078 (423 / 415, full, refused); the 200-row
 * existing-students notice (school 8082), as the admin demo account at 375 / 768 / 1280. Result flash
 * copy is UNVERIFIED (SRS §8), so the tests that assert it are `@provisional`.
 *
 * v2 forms (DsFormSection cards): the hero panels carry no page title (it is the page header), the role and
 * class cards are URadioGroup radios, the quota bar is a UProgress. Primary schools (SK, SJK) are out of
 * the picker and the Darjah group is gone (D72 / D101: Tingkatan 1-5 only).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, provisional, TAG } from '../support'

const ADMIN = 'admin@demo.test'

const byId = (page: Page, id: string) => page.getByTestId(id)

/** Pick a role / class card (the radio is visually hidden behind the card). */
async function pickRole(page: Page, label: string): Promise<void> {
  await page.getByRole('radio', { name: label, exact: true }).check({ force: true })
}

/** The rows of the existing students table (cards below 768 px). */
const existingRows = (page: Page) =>
  page.locator(
    '[data-testid=existing-table] tbody tr, [data-testid=existing-table] [data-ds=data-table-cards] > li',
  )

/** School 10220 (SMK, Kuala Lumpur): active subscription, quota 1000, 2 students (SRS §6 anchors). */
async function pickSchool10220(page: Page): Promise<void> {
  await byId(page, 'admin-school-search').fill('SMK Leqoe')
  await byId(page, 'admin-school-result').filter({ hasText: 'SMK Leqoe' }).first().click()
  await expect(byId(page, 'admin-school-chip')).toContainText('SMK Leqoe')
}

test.describe('M02 S4 bulk user import', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/bulk-import')
  })

  test('title, content, role cards, school picker and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Import Pengguna Pukal | PRESTASIPLUS')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Import Pengguna Pukal')
    await expect(byId(page, 'bulk-hero')).toContainText('Jenis pengguna')
    await expect(page.getByRole('heading', { name: 'Borang Import Pengguna' })).toBeAttached()
    await expect(page.getByRole('radio')).toHaveCount(4)
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
    await expect(byId(page, 'bulk-school')).toHaveCount(0)

    await pickRole(page, 'Guru')
    await expect(byId(page, 'bulk-school')).toBeVisible()
    await pickRole(page, 'Ibu Bapa')
    await expect(byId(page, 'bulk-school')).toHaveCount(0)

    await expect(byId(page, 'bulk-default-password')).not.toHaveValue('')
    await expect(byId(page, 'import-paste')).toBeVisible()
    await byId(page, 'import-mode-csv').click()
    await expect(byId(page, 'import-file-status')).toHaveText('Tiada fail dipilih')
    await byId(page, 'import-file').setInputFiles({
      name: 'demo.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Nama,Emel\n'),
    })
    await expect(byId(page, 'import-file-status')).toHaveText('Fail dipilih: demo.csv')
    await expect(byId(page, 'bulk-notes')).toContainText('Emel sedia ada akan dilangkau automatik')
    await expectNoHorizontalScroll(page)
    await expect(byId(page, 'bulk-students-link')).toHaveAttribute('href', '/admin/import-students')
  })

  test(
    'paste as Guru + school: 1 created, 1 skipped, 1 failed and the form resets',
    provisional('The result flash copy is a placeholder (SRS §8, URS OQ-1/OQ-2)'),
    async ({ page }) => {
      await pickRole(page, 'Guru')
      await byId(page, 'bulk-school-search').fill('BANDAR BARU BANGI')
      await byId(page, 'bulk-school-result')
        .filter({ hasText: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI' })
        .first()
        .click()
      await expect(byId(page, 'bulk-school-chosen')).toContainText(
        'Dipilih: SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI',
      )

      await byId(page, 'import-paste').fill(
        [
          'Guru Demo Satu, guru.satu@demo.test, 0123456789',
          `Guru Demo Dua, ${ADMIN}`,
          'Guru Demo Tiga, bukan-emel',
        ].join('\n'),
      )
      await byId(page, 'form-submit').click()

      const flash = byId(page, 'cmp-flash')
      await expect(flash).toContainText(
        'Import selesai: 1 pengguna didaftarkan, 1 dilangkau, 1 gagal.',
      )
      await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
      await expect(byId(page, 'bulk-school')).toHaveCount(0)
      await expect(byId(page, 'import-paste')).toHaveValue('')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'a missing school is refused with the red alert and the input is kept',
    provisional('Validation copy is the Laravel default (SRS §5)'),
    async ({ page }) => {
      await pickRole(page, 'Guru')
      await byId(page, 'import-paste').fill('Guru Demo Empat, guru.empat@demo.test')
      await byId(page, 'form-submit').click()
      await expect(byId(page, 'bulk-alert')).toContainText('The school id field is required.')
      await expect(byId(page, 'import-paste')).toHaveValue('Guru Demo Empat, guru.empat@demo.test')
      await expect(page.getByRole('radio', { checked: true })).toHaveCount(1)
    },
  )
})

test.describe('M02 S5 DELIMa student import', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/import-students')
  })

  test('title, content, both class groups, modes and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Import Pelajar | PRESTASIPLUS')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Import Pelajar via ID Delima')
    await expect(byId(page, 'student-hero')).toContainText('Login pelajar')
    await expect(page.getByRole('heading', { name: 'Borang Import Pelajar' })).toBeAttached()
    // Tingkatan 1-5 only (D72 / D101): the Darjah group is gone.
    await expect(page.getByRole('radio')).toHaveCount(5)
    await expect(byId(page, 'class-group-secondary')).toBeVisible()
    await expect(byId(page, 'class-group-primary')).toHaveCount(0)
    await expect(byId(page, 'student-format-paste')).toContainText(
      'Format DELIMa (3-4 baris per pelajar):',
    )
    await byId(page, 'import-mode-csv').click()
    await expect(byId(page, 'student-format-csv')).toContainText(
      'Nama, Email DELIMa, Kata Laluan, No KP (pilihan)',
    )
    await expect(byId(page, 'student-notes')).toContainText(
      'ID yang sudah wujud akan dilangkau automatik',
    )
    await expect(byId(page, 'student-back')).toHaveAttribute('href', '/admin')
    await expectNoHorizontalScroll(page)
  })

  test('school 10220 (2 / 1000): emerald quota, Tingkatan or Darjah only, import is allowed', async ({
    page,
  }) => {
    await pickSchool10220(page)

    await expect(byId(page, 'quota-figures')).toHaveText('2 / 1000')
    await expect(byId(page, 'quota-summary')).toHaveAttribute('data-state', 'available')
    await expect(byId(page, 'quota-note')).toHaveText('Baki kuota: 998 pelajar')
    await expect(byId(page, 'quota-bar')).toHaveAttribute('aria-valuenow', '0')
    await expect(byId(page, 'existing-toggle')).toContainText('Pelajar Sedia Ada (2 orang)')
    await expect(page.getByRole('radio')).toHaveCount(5)
    await expectNoHorizontalScroll(page)
  })

  test(
    'school 10220: a paste of two records (one existing) creates one student',
    provisional('The result flash copy is a placeholder (SRS §8, URS OQ-1/OQ-2)'),
    async ({ page }) => {
      await pickSchool10220(page)
      await expect(byId(page, 'quota-figures')).toHaveText('2 / 1000')
      await page.getByRole('radio').first().check({ force: true })

      // The second record uses the DELIMa ID of an existing anchor student: read it from the list.
      await byId(page, 'existing-toggle').click()
      const existingId = (await existingRows(page).first().locator('td').nth(2).innerText())
        .trim()
        .split(/\s+/)[0]
      expect(existingId).toBeTruthy()

      await byId(page, 'import-paste').fill(
        [
          'PELAJAR DEMO SATU',
          'm-demo0001@moe-dl.edu.my',
          'katalaluan1',
          '',
          'PELAJAR DEMO DUA',
          existingId!,
          'katalaluan2',
        ].join('\n'),
      )
      await byId(page, 'form-submit').click()
      await expect(byId(page, 'cmp-flash')).toContainText(
        'Import selesai: 1 pelajar didaftarkan, 1 dilangkau.',
      )
      await expect(byId(page, 'admin-school-chip')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'school 8078 (423 / 415): red full panel and the import is refused',
    provisional('The refusal copy "Kuota tidak mencukupi." is a placeholder (SRS §5)'),
    async ({ page }) => {
      await byId(page, 'admin-school-search').fill('BANDAR BARU BANGI')
      await byId(page, 'admin-school-result')
        .filter({ hasText: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI' })
        .first()
        .click()

      await expect(byId(page, 'quota-figures')).toHaveText('423 / 415')
      await expect(byId(page, 'quota-summary')).toHaveAttribute('data-state', 'full')
      await expect(byId(page, 'quota-bar')).toHaveAttribute('aria-valuenow', '100')
      await expect(byId(page, 'quota-note')).toHaveText(
        'Kuota penuh! Sila tingkatkan kuota dahulu.',
      )
      await expect(page.getByRole('radio')).toHaveCount(5)

      // Import is never disabled by the quota (as live): the server refuses.
      await expect(byId(page, 'form-submit')).toBeEnabled()
      await page.getByRole('radio').first().check({ force: true })
      await byId(page, 'import-paste').fill(
        'PELAJAR DEMO TIGA\nm-demo0003@moe-dl.edu.my\nkatalaluan3',
      )
      await byId(page, 'form-submit').click()
      await expect(byId(page, 'student-alert')).toContainText('Kuota tidak mencukupi.')
      await expect(byId(page, 'import-paste')).toHaveValue(/PELAJAR DEMO TIGA/)
      await expect(byId(page, 'admin-school-chip')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test('school 8082: the existing list shows the 200-row notice and search narrows it', async ({
    page,
  }) => {
    await byId(page, 'admin-school-search').fill('ENGKU HUSAIN')
    await byId(page, 'admin-school-result')
      .filter({ hasText: 'SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN' })
      .first()
      .click()
    await expect(byId(page, 'existing-toggle')).toContainText('Pelajar Sedia Ada (549 orang)')
    await byId(page, 'existing-toggle').click()
    await expect(existingRows(page)).toHaveCount(200)
    await expect(byId(page, 'existing-cap')).toHaveText(
      'Menunjukkan 200 pertama sahaja. Gunakan carian untuk cari pelajar tertentu.',
    )
    await byId(page, 'existing-search').fill('zzz-tiada-padanan')
    await expect(byId(page, 'existing-empty')).toContainText('Tiada pelajar dijumpai')
    await expect(byId(page, 'existing-cap')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})
