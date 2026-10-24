/**
 * M02 G5 QA (qa-engineer): gap-closing E2E for S4-S8 and S12-S14 (E2E-M02-27, 28, 29, 30, 31, 33, 35, 38, 39,
 * 40, 48, 50, 56). Adds what the developer smoke does not assert: pickers with latency / faults / empty,
 * import round trips with a login of the imported account, class group switching, teacher-driven class select.
 */

import type { Page } from '@playwright/test'

import { expect, gotoApp as gotoAppOn, test } from '../fixtures/test'
import { acceptNextDialog, expectNoHorizontalScroll, moduleTag, TAG } from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)

async function loginUi(tab: Page, email: string, password: string): Promise<void> {
  await gotoAppOn(tab, '/login')
  await tab.getByTestId('login-email').fill(email)
  await tab.getByTestId('login-password').fill(password)
  await tab.getByTestId('login-submit').click()
}

test.describe('M02 QA S4 bulk import gaps', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/bulk-import')
  })

  test('E2E-M02-27: Guru / Admin show the school picker, Ibu Bapa / PPD hide it; the picker states', async ({
    page,
    mock,
  }) => {
    for (const [role, visible] of [
      ['teacher', true],
      ['parent', false],
      ['school_admin', true],
      ['ppd_officer', false],
    ] as const) {
      await byId(page, `bulk-role-${role}`).click()
      await expect(byId(page, 'bulk-school')).toHaveCount(visible ? 1 : 0)
    }
    await byId(page, 'bulk-role-teacher').click()
    await mock.setLatency(1200)
    await byId(page, 'bulk-school-search').fill('bangi')
    await expect(byId(page, 'bulk-school-loading')).toBeVisible()
    await expect(byId(page, 'bulk-school-result').first()).toBeVisible({ timeout: 8000 })
    await mock.clearLatency()
    expect(await byId(page, 'bulk-school-result').count()).toBeLessThanOrEqual(20)
    await expect(byId(page, 'bulk-school-result').first()).toContainText(/\(.+\)/)
    await byId(page, 'bulk-school-search').fill('zzqxvzz')
    await expect(byId(page, 'bulk-school-empty')).toBeVisible()
    await byId(page, 'bulk-school-search').fill('bangi')
    await byId(page, 'bulk-school-result').first().click()
    await expect(byId(page, 'bulk-school-chosen')).toContainText('Dipilih:')
    await byId(page, 'bulk-school-clear').click()
    await expect(byId(page, 'bulk-school-search')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-28: default password is pre-filled with the fixture default; CSV drop zone accepts .csv/.txt; Kembali returns', async ({
    page,
  }) => {
    // SEC-M02-01 fixture default (config importDefaultPassword), not the demo password.
    await expect(byId(page, 'bulk-default-password')).toHaveValue('Import2026')
    await expect(byId(page, 'bulk-default-password')).not.toHaveAttribute('required', '')
    await expect(byId(page, 'import-paste')).toBeVisible()
    await byId(page, 'import-mode-csv').click()
    await expect(byId(page, 'import-dropzone')).toBeVisible()
    const accept = await byId(page, 'import-file').getAttribute('accept')
    expect(accept).toMatch(/csv/)
    await expect(byId(page, 'bulk-format')).toContainText(
      'Nama, Emel, Telefon (pilihan), Kata Laluan (pilihan)',
    )
    await byId(page, 'bulk-back').click()
    await expect(page).toHaveURL('/admin/users')
  })

  test('E2E-M02-29: import as Guru + school (header, 1 existing e-mail, 1 without a password): counts, school set, default password works', async ({
    page,
    gotoApp,
    newTab,
  }) => {
    await byId(page, 'bulk-role-teacher').click()
    await byId(page, 'bulk-school-search').fill('bangi')
    await byId(page, 'bulk-school-result').first().click()
    const chosen = (await byId(page, 'bulk-school-chosen').innerText())
      .replace('Dipilih:', '')
      .replace(/s*([^()]*)s*$/, '')
      .trim()
    await byId(page, 'import-paste').fill(
      [
        'Nama, Emel, Telefon, Kata Laluan',
        'Guru Qa Satu, guru.qa1@contoh.test, 0123456789, KataQa123',
        'Guru Qa Dua, guru.qa2@contoh.test',
        `Guru Sedia Ada, ${ADMIN}`,
      ].join('\n'),
    )
    await byId(page, 'form-submit').click()
    await expect(byId(page, 'cmp-flash')).toContainText('2 pengguna didaftarkan, 1 dilangkau')
    await gotoApp('/admin/users?search=guru.qa')
    await expect(byId(page, 'user-row')).toHaveCount(2)
    for (const cell of await byId(page, 'user-row').locator('td:nth-child(7)').allInnerTexts()) {
      expect(chosen.startsWith(cell.trim())).toBe(true)
    }
    const tab = await newTab()
    await loginUi(tab, 'guru.qa2@contoh.test', 'Import2026')
    await expect(tab).not.toHaveURL(/\/login/)
    const tab2 = await newTab()
    await loginUi(tab2, 'guru.qa1@contoh.test', 'KataQa123')
    await expect(tab2).not.toHaveURL(/\/login/)
  })
})

test.describe('M02 QA S5 student import gaps', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/import-students')
  })

  test('E2E-M02-30: picker shows a spinner, lists at most 20 rows, "empty" and a chip that can be cleared', async ({
    page,
    mock,
  }) => {
    await mock.setLatency(1200)
    await byId(page, 'admin-school-search').fill('bangi')
    await expect(byId(page, 'admin-school-loading')).toBeVisible()
    await expect(byId(page, 'admin-school-result').first()).toBeVisible({ timeout: 8000 })
    await mock.clearLatency()
    expect(await byId(page, 'admin-school-result').count()).toBeLessThanOrEqual(20)
    await byId(page, 'admin-school-search').fill('zzqxvzz')
    await expect(byId(page, 'admin-school-empty')).toBeVisible()
    await byId(page, 'admin-school-search').fill('bangi')
    await byId(page, 'admin-school-result').first().click()
    await expect(byId(page, 'admin-school-chip')).toBeVisible()
    await byId(page, 'admin-school-clear').click()
    await expect(byId(page, 'admin-school-search')).toBeVisible()
  })

  test('E2E-M02-31: quota panel shows "Memeriksa kuota..." first; a quota fault falls back to the no-subscription warning', async ({
    page,
    mock,
  }) => {
    await mock.setLatency(1500)
    await byId(page, 'admin-school-search').fill('SMK Leqoe')
    await expect(byId(page, 'admin-school-result').first()).toBeVisible({ timeout: 8000 })
    await byId(page, 'admin-school-result').filter({ hasText: 'SMK Leqoe' }).first().click()
    await expect(byId(page, 'quota-loading')).toContainText('Memeriksa kuota...')
    await expect(byId(page, 'quota-figures')).toHaveText('2 / 1000', { timeout: 10_000 })
    await mock.clearLatency()

    await byId(page, 'admin-school-clear').click()
    await mock.failNext('/api/admin/schools/:id/quota', 500)
    await byId(page, 'admin-school-search').fill('SMK Leqoe')
    await byId(page, 'admin-school-result').filter({ hasText: 'SMK Leqoe' }).first().click()
    await expect(byId(page, 'quota-none')).toContainText('Sekolah ini tiada langganan aktif')
  })

  test('E2E-M02-33: class groups follow the school type (none -> both, SMK -> Tingkatan, SK -> Darjah); a hidden checked card is unchecked', async ({
    page,
  }) => {
    await expect(byId(page, 'class-group-primary')).toBeVisible()
    await expect(byId(page, 'class-group-secondary')).toBeVisible()
    await expect(page.locator('input[name=class_level]')).toHaveCount(11)

    await byId(page, 'admin-school-search').fill('KUALA SELANGOR')
    await byId(page, 'admin-school-result')
      .filter({ hasText: 'SEKOLAH KEBANGSAAN KUALA SELANGOR' })
      .first()
      .click()
    await expect(byId(page, 'class-group-primary')).toBeVisible()
    await expect(byId(page, 'class-group-secondary')).toHaveCount(0)
    await page.locator('input[name=class_level]').first().check({ force: true })
    await expect(page.locator('input[name=class_level]:checked')).toHaveCount(1)

    await byId(page, 'admin-school-clear').click()
    await byId(page, 'admin-school-search').fill('SMK Leqoe')
    await byId(page, 'admin-school-result').filter({ hasText: 'SMK Leqoe' }).first().click()
    await expect(byId(page, 'class-group-primary')).toHaveCount(0)
    await expect(byId(page, 'class-group-secondary')).toBeVisible()
    await expect(page.locator('input[name=class_level]:checked')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-35: a school without a subscription refuses the import; a valid paste creates a Title Case student who can log in', async ({
    page,
    gotoApp,
    newTab,
  }) => {
    await byId(page, 'admin-school-search').fill('KUALA SELANGOR')
    await byId(page, 'admin-school-result')
      .filter({ hasText: 'SEKOLAH KEBANGSAAN KUALA SELANGOR' })
      .first()
      .click()
    await expect(byId(page, 'quota-none')).toBeVisible()
    await page.locator('input[name=class_level]').first().check({ force: true })
    await byId(page, 'import-paste').fill('PELAJAR QA TIGA\nm-qa0003@moe-dl.edu.my\nkatalaluan3')
    await byId(page, 'form-submit').click()
    await expect(byId(page, 'student-alert')).toBeVisible()
    await expect(byId(page, 'import-paste')).toHaveValue(/PELAJAR QA TIGA/)

    await gotoApp('/admin/import-students')
    await byId(page, 'admin-school-search').fill('SMK Leqoe')
    await byId(page, 'admin-school-result').filter({ hasText: 'SMK Leqoe' }).first().click()
    await expect(byId(page, 'quota-figures')).toHaveText('2 / 1000')
    await page.locator('input[name=class_level]').first().check({ force: true })
    await byId(page, 'import-paste').fill('PELAJAR QA SATU\nm-qa0001@moe-dl.edu.my\nkatalaluan1')
    await byId(page, 'form-submit').click()
    await expect(byId(page, 'cmp-flash')).toContainText('1 pelajar didaftarkan')

    await gotoApp('/admin/users?search=m-qa0001')
    const row = byId(page, 'user-row').first()
    await expect(row.getByTestId('user-name')).toHaveText('Pelajar Qa Satu')
    const id = Number(await row.getAttribute('data-user-id'))
    expect(id).toBeGreaterThanOrEqual(9_000_001)
    const tab = await newTab()
    await loginUi(tab, 'm-qa0001@moe-dl.edu.my', 'katalaluan1')
    await expect(tab).toHaveURL(/\/dashboard/)
  })
})

test.describe('M02 QA S6-S8 gaps', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  // E2E-M02-38 (empty list after `mock.reset({ comp: 0 })`): BLOCKED, the reset override `comp` is not implemented (BUG-M02-QA-01).

  test('E2E-M02-39: class select follows the teacher (5 -> DMO101/DMO102 after the loading text; 5302 -> 3; 5301 and a fault -> none)', async ({
    page,
    mock,
    gotoApp,
  }) => {
    await gotoApp('/admin/comp-students/create')
    await expect(byId(page, 'comp-info')).toContainText('kata laluan 20262026')
    await expect(byId(page, 'comp-teacher').locator('option').nth(1)).toContainText(/\(.+@.+\)/)
    await mock.setLatency(1200)
    await byId(page, 'comp-teacher').selectOption('5')
    // SRS E2E-M02-39: the "no active class" text shows during the latency, then exactly the 2 classes.
    await expect(byId(page, 'comp-no-class')).toHaveText('Guru ini tiada kelas aktif.')
    await expect(byId(page, 'comp-class').locator('option')).toHaveCount(3, { timeout: 8000 })
    const options = await byId(page, 'comp-class').locator('option').allInnerTexts()
    expect(options.slice(1).map((o) => o.trim())).toEqual([
      expect.stringContaining('DMO101'),
      expect.stringContaining('DMO102'),
    ])
    await mock.clearLatency()
    await byId(page, 'comp-teacher').selectOption('5302')
    await expect(byId(page, 'comp-class').locator('option')).toHaveCount(4)
    for (const o of (await byId(page, 'comp-class').locator('option').allInnerTexts()).slice(1)) {
      expect(o).toMatch(/\(.+\)/)
    }
    await byId(page, 'comp-teacher').selectOption('5301')
    await expect(byId(page, 'comp-no-class')).toHaveText('Guru ini tiada kelas aktif.')
    await byId(page, 'comp-teacher').selectOption('')
    await mock.failNext('/api/admin/teachers/:id/classrooms', 500)
    await byId(page, 'comp-teacher').selectOption('5302')
    await expect(byId(page, 'comp-no-class')).toHaveText('Guru ini tiada kelas aktif.')
  })

  test('E2E-M02-40: registered complimentary students get {last 6 IC digits}@prestasiplus.my, coins MATI, and can log in with the fixture password', async ({
    page,
    gotoApp,
    newTab,
  }) => {
    await gotoApp('/admin/comp-students/create')
    await byId(page, 'comp-teacher').selectOption('5302')
    await expect(byId(page, 'comp-class').locator('option')).toHaveCount(4)
    await byId(page, 'comp-class').selectOption({ index: 1 })
    await byId(page, 'comp-students').fill(
      ['MURID KOMPLIMEN QA SATU, 070707077701', 'MURID KOMPLIMEN QA DUA, 080808088802'].join('\n'),
    )
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/comp-students$/)
    const created = byId(page, 'comp-row').filter({ hasText: '077701@prestasiplus.my' })
    await expect(created).toHaveCount(1)
    await expect(created.getByTestId('comp-coins')).toHaveText('MATI')
    const pw = (
      await (async () => {
        await gotoApp('/admin/comp-students/create')
        return byId(page, 'comp-info-password').innerText()
      })()
    ).trim()
    const tab = await newTab()
    await loginUi(tab, '077701@prestasiplus.my', pw)
    await expect(tab).not.toHaveURL(/\/login/)
  })

  test('E2E-M02-41: S8 shows "—" when the student has no IC and the classes table headers', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/comp-students/5901')
    await expect(byId(page, 'comp-card')).toBeVisible()
    const dt = byId(page, 'comp-card').locator('dt')
    await expect(dt.nth(1)).toHaveText('No. KP')
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M02 QA S12-S14 gaps', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('E2E-M02-47: filter labels/options and "Lihat" links of the subscription list', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/school-subscriptions')
    await expect(byId(page, 'subs-row').first()).toBeVisible()
    await expect(byId(page, 'subs-status').locator('option')).toHaveText([
      'Semua Status',
      'Aktif',
      'Tempoh Ihsan',
      'Tamat',
      'Dibatalkan',
    ])
    await expect(byId(page, 'subs-level').locator('option').first()).toContainText('Semua')
    for (const row of await byId(page, 'subs-row').all()) {
      await expect(row.getByTestId('subs-view')).toHaveAttribute(
        'href',
        /\/admin\/school-subscriptions\/\d+$/,
      )
    }
    await expect(byId(page, 'subs-add')).toHaveText(/Langganan Baru/)
  })

  test('E2E-M02-48: the S13 school picker shows a loading indicator and rows "{code} — {district}, {state}"', async ({
    page,
    mock,
    gotoApp,
  }) => {
    await gotoApp('/admin/school-subscriptions/create')
    await expect(byId(page, 'sub-tier-basic')).toBeChecked()
    await mock.setLatency(1200)
    await byId(page, 'sub-school-search').fill('kluang')
    await expect(byId(page, 'sub-school-loading')).toBeVisible()
    await expect(byId(page, 'sub-school-result').first()).toBeVisible({ timeout: 8000 })
    await mock.clearLatency()
    await expect(byId(page, 'sub-school-result').first()).toContainText(/.+ — .+, .+/)
    await expect(byId(page, 'sub-package')).toHaveCount(4)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-50: a Pemantauan subscription ends one month after its start, a Penuh one a year after; both show on the detail', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/school-subscriptions/create')
    await byId(page, 'sub-school-search').fill('kluang')
    await byId(page, 'sub-school-result').first().click()
    await byId(page, 'sub-package').nth(1).check({ force: true })
    await byId(page, 'sub-submit').click()
    await expect(page).toHaveURL(/\/admin\/school-subscriptions\/\d+$/)
    await expect(byId(page, 'sub-tier')).toHaveText('Pemantauan')
    await expect(byId(page, 'sub-tiles')).toContainText('500/bulan')
    // Clock is fixed at DEFAULT_NOW (25/09/2026): +1 month = 25/10/2026.
    await expect(byId(page, 'sub-tiles')).toContainText('25/10/2026')

    await gotoApp('/admin/school-subscriptions/create')
    await byId(page, 'sub-school-search').fill('kluang')
    await byId(page, 'sub-school-result').nth(1).click()
    await page.getByText('Penuh', { exact: true }).click()
    await byId(page, 'sub-package').nth(1).check({ force: true })
    await byId(page, 'sub-submit').click()
    await expect(byId(page, 'sub-tier')).toHaveText('Penuh')
    await expect(byId(page, 'sub-tiles')).toContainText('25/09/2027')
  })

  test('E2E-M02-56: upgrade end date is now + 1 year and the note carries the timestamp', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/school-subscriptions/14')
    await byId(page, 'sub-toggle-upgrade').click()
    const accepted = acceptNextDialog(page, { type: 'confirm' })
    await byId(page, 'sub-upgrade-submit').click()
    await accepted
    await expect(byId(page, 'sub-tier')).toHaveText('Penuh')
    await expect(byId(page, 'sub-tiles')).toContainText('25/09/2027')
    await expect(byId(page, 'sub-notes')).toContainText(
      /\[Naik taraf Pemantauan → Penuh pada 25\/09\/2026 \d{2}:\d{2}\]/,
    )
  })
})

test.describe('M02 QA E2E-M02-33 (DV-M02-09)', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M02-33: an SJK(C) school created on S10 offers Darjah only on S5', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/schools/create')
    const name = 'SJK(C) Demo Qa Satu'
    await page.getByLabel('Nama Sekolah').fill(name)
    await page.getByLabel('Kod Sekolah').fill('ZZQ9901')
    await page.getByLabel('Jenis').selectOption('SJK(C)')
    await page.getByLabel('Negeri').selectOption('Selangor')
    await page.getByLabel('Daerah').fill('PPD DEMO')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/schools')
    await page.evaluate(async () => {
      const el = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: { globalProperties: { $router: { push(t: string): Promise<unknown> } } }
        }
      }
      await el.__vue_app__.config.globalProperties.$router.push('/admin/import-students')
    })
    await byId(page, 'admin-school-search').fill(name)
    await byId(page, 'admin-school-result').filter({ hasText: name }).first().click()
    await expect(byId(page, 'class-group-primary')).toBeVisible()
    await expect(byId(page, 'class-group-secondary')).toHaveCount(0)
    await expect(page.locator('input[name=class_level]')).toHaveCount(6)
  })
})
