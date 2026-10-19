/**
 * M02-T6 developer smoke for S4 `/admin/users/bulk-import` and S5 `/admin/import-students` (build-plan M02-T6;
 * QA writes E2E-M02-* at G5): a paste import with one created, one skipped and one failed line; the S5
 * quota panel for school 10220 (2 / 1000, allowed) and 8078 (423 / 415, full, refused); the 200-row
 * existing-students notice (school 8082), as the admin demo account at 375 / 768 / 1280. Result flash
 * copy is UNVERIFIED (SRS §8), so the tests that assert it are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, provisional, TAG } from '../support'

const ADMIN = 'admin@demo.test'

const byId = (page: Page, id: string) => page.getByTestId(id)

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
    await expectTabTitle(page, 'Import Pengguna Pukal - Admin PRESTASIPLUS')
    await expect(byId(page, 'bulk-hero')).toContainText('Import Pengguna Pukal')
    await expect(page.getByText('Borang Import Pengguna')).toBeVisible()
    await expect(page.locator('input[name=role]')).toHaveCount(4)
    await expect(page.locator('input[name=role]:checked')).toHaveCount(0)
    await expect(byId(page, 'bulk-school')).toHaveCount(0)

    await byId(page, 'bulk-role-teacher').click()
    await expect(byId(page, 'bulk-school')).toBeVisible()
    await byId(page, 'bulk-role-parent').click()
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
      await byId(page, 'bulk-role-teacher').click()
      await byId(page, 'bulk-school-search').fill('KUALA SELANGOR')
      await byId(page, 'bulk-school-result')
        .filter({ hasText: 'SEKOLAH KEBANGSAAN KUALA SELANGOR' })
        .first()
        .click()
      await expect(byId(page, 'bulk-school-chosen')).toContainText(
        'Dipilih: SEKOLAH KEBANGSAAN KUALA SELANGOR',
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
      await expect(page.locator('input[name=role]:checked')).toHaveCount(0)
      await expect(byId(page, 'bulk-school')).toHaveCount(0)
      await expect(byId(page, 'import-paste')).toHaveValue('')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'a missing school is refused with the red alert and the input is kept',
    provisional('Validation copy is the Laravel default (SRS §5)'),
    async ({ page }) => {
      await byId(page, 'bulk-role-teacher').click()
      await byId(page, 'import-paste').fill('Guru Demo Empat, guru.empat@demo.test')
      await byId(page, 'form-submit').click()
      await expect(byId(page, 'bulk-alert')).toContainText('The school id field is required.')
      await expect(byId(page, 'import-paste')).toHaveValue('Guru Demo Empat, guru.empat@demo.test')
      await expect(page.locator('input[name=role]:checked')).toHaveCount(1)
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
    await expectTabTitle(page, 'Import Pelajar (ID Delima) - Admin PRESTASIPLUS')
    await expect(byId(page, 'student-hero')).toContainText('Import Pelajar via ID Delima')
    await expect(page.getByText('Borang Import Pelajar')).toBeVisible()
    await expect(page.locator('input[name=class_level]')).toHaveCount(11)
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
    await expect(byId(page, 'quota-bar')).toHaveAttribute('style', /width: 0%/)
    await expect(byId(page, 'existing-toggle')).toContainText('Pelajar Sedia Ada (2 orang)')
    // Exactly one class group matches the school type.
    await expect(page.locator('input[name=class_level]')).not.toHaveCount(11)
    await expectNoHorizontalScroll(page)
  })

  test(
    'school 10220: a paste of two records (one existing) creates one student',
    provisional('The result flash copy is a placeholder (SRS §8, URS OQ-1/OQ-2)'),
    async ({ page }) => {
      await pickSchool10220(page)
      await expect(byId(page, 'quota-figures')).toHaveText('2 / 1000')
      await page.locator('input[name=class_level]').first().check({ force: true })

      // The second record uses the DELIMa ID of an existing anchor student: read it from the list.
      await byId(page, 'existing-toggle').click()
      const existingId = (await byId(page, 'existing-row').first().locator('td').nth(2).innerText())
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
      await expect(byId(page, 'quota-bar')).toHaveAttribute('style', /width: 100%/)
      await expect(byId(page, 'quota-note')).toHaveText(
        'Kuota penuh! Sila tingkatkan kuota dahulu.',
      )
      await expect(page.locator('input[name=class_level]')).toHaveCount(5)

      // Import is never disabled by the quota (as live): the server refuses.
      await expect(byId(page, 'form-submit')).toBeEnabled()
      await page.locator('input[name=class_level]').first().check({ force: true })
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

  test('school 940 has no subscription: the warning shows', async ({ page }) => {
    await byId(page, 'admin-school-search').fill('KUALA SELANGOR')
    await byId(page, 'admin-school-result')
      .filter({ hasText: 'SEKOLAH KEBANGSAAN KUALA SELANGOR' })
      .first()
      .click()
    await expect(byId(page, 'quota-none')).toContainText(
      'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.',
    )
    await expect(page.locator('input[name=class_level]')).toHaveCount(6)
  })

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
    await expect(byId(page, 'existing-row')).toHaveCount(200)
    await expect(byId(page, 'existing-cap')).toHaveText(
      'Menunjukkan 200 pertama sahaja. Gunakan carian untuk cari pelajar tertentu.',
    )
    await byId(page, 'existing-search').fill('zzz-tiada-padanan')
    await expect(byId(page, 'existing-empty')).toContainText('Tiada pelajar dijumpai')
    await expect(byId(page, 'existing-cap')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M02-33: an SJK(C) school created on S10 offers Darjah only on S5 (DV-M02-09)',
    provisional('The flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, gotoApp }) => {
      // Two full app boots (S10, then S5) plus a save: allow more than the 30 s default.
      test.setTimeout(120_000)
      const name = 'SJK(C) Demo Ujian Satu'
      await gotoApp('/admin/schools/create')
      await page.getByLabel('Nama Sekolah').fill(name)
      await page.getByLabel('Kod Sekolah').fill('ZZZ9901')
      await page.getByLabel('Jenis').selectOption('SJK(C)')
      await page.getByLabel('Negeri').selectOption('Selangor')
      await page.getByLabel('Daerah').fill('PPD DEMO')
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL('/admin/schools')

      await gotoApp('/admin/import-students')
      await expect(page.locator('input[name=class_level]')).toHaveCount(11)
      await byId(page, 'admin-school-search').fill(name)
      await byId(page, 'admin-school-result').filter({ hasText: name }).first().click()
      await expect(byId(page, 'class-group-primary')).toBeVisible()
      await expect(byId(page, 'class-group-secondary')).toHaveCount(0)
      await expect(page.locator('input[name=class_level]')).toHaveCount(6)
      await expectNoHorizontalScroll(page)
    },
  )
})
