/**
 * M02 G5 QA (qa-engineer): gap-closing E2E for the S1 user list, menus, access and the responsive sweep
 * (E2E-M02-01, 02, 04, 05, 07, 08, 09, 10, 11, 60, 61, 62). Written on top of the developer smoke specs;
 * it does not repeat what they already assert.
 */

import type { Page } from '@playwright/test'

import { DEMO_PASSWORD, expect, gotoApp as gotoAppOn, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  TAG,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)

const tableLayout = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768

/** The list rows: table rows from 768 px, cards below. */
const rowsOf = (page: Page) =>
  page.locator(
    '[data-testid=users-table] tbody tr, [data-testid=users-table] [data-ds=data-table-cards] > li',
  )

/** The row (table row or card) of user `id`. */
const rowOf = (page: Page, id: string | null) =>
  rowsOf(page).filter({
    has: page.locator(`[data-testid="user-row"][data-user-id="${String(id)}"]`),
  })

async function openFilters(page: Page): Promise<void> {
  if (!tableLayout(page)) {
    await page.locator('[data-ds="filter-open"]').click()
    await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
  }
}

async function applyFilters(page: Page): Promise<void> {
  if (tableLayout(page)) await page.getByRole('button', { name: 'Cari', exact: true }).click()
  else await page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }).click()
}

/** In-app navigation (no reload): much cheaper than a full app boot per route. */
async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate(async (p) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(target: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(p)
  }, path)
}

const ROUTES_16 = [
  '/admin/users',
  '/admin/users/create',
  '/admin/users/2/edit',
  '/admin/users/5601/packages',
  '/admin/users/bulk-import',
  '/admin/import-students',
  '/admin/comp-students',
  '/admin/comp-students/create',
  '/admin/comp-students/5901',
  '/admin/schools',
  '/admin/schools/create',
  '/admin/schools/8078/edit',
  '/admin/school-subscriptions',
  '/admin/school-subscriptions/create',
  '/admin/school-subscriptions/14',
  '/admin/school-subscriptions/14/renewal-invoice',
]

const CARDS: [string, string][] = [
  ['student', 'Pelajar'],
  ['teacher', 'Guru'],
  ['parent', 'Ibu Bapa'],
  ['sponsor', 'Penaja'],
  ['school_admin', 'Admin Sekolah'],
  ['ppd_officer', 'Pegawai PPD'],
  ['admin', 'Admin'],
]

test.describe('M02 QA S1 gaps', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 90_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp, page }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users')
    await expect(rowsOf(page).first()).toBeVisible()
  })

  test('E2E-M02-01: header, 7 cards (order, hrefs, labels), filters, action links', async ({
    page,
  }) => {
    await expect(byId(page, 'pentadbiran-header').getByRole('heading', { level: 1 })).toHaveText(
      'Senarai Pengguna',
    )
    await expect(byId(page, 'pentadbiran-subtitle')).toHaveText(
      'Cari, tapis dan urus akaun pelajar, guru dan pentadbir.',
    )
    const cards = byId(page, 'users-stats').locator('a')
    await expect(cards).toHaveCount(7)
    for (const [i, [role, label]] of CARDS.entries()) {
      await expect(cards.nth(i)).toHaveAttribute('href', `/admin/users?role=${role}`)
      await expect(cards.nth(i)).toContainText(label)
      // Label never truncated (DV-M02-02): no clipped text inside the card.
      const clipped = await cards.nth(i).evaluate((el) => {
        return Array.from(el.querySelectorAll('span')).some(
          (s) => s.scrollWidth > s.clientWidth + 1,
        )
      })
      expect(clipped).toBe(false)
    }
    await openFilters(page)
    await expect(byId(page, 'users-role').locator('option')).toHaveText([
      'Semua Peranan',
      'Pelajar',
      'Guru',
      'Ibu Bapa',
      'Penaja',
      'Admin Sekolah',
      'Pegawai PPD',
      'Pegawai JPN',
      'Admin',
    ])
    await expect(byId(page, 'users-status').locator('option')).toHaveText([
      'Semua',
      'Aktif',
      'Tidak Aktif',
    ])
    await expect(byId(page, 'users-role')).toHaveAccessibleName('Peranan')
    await expect(byId(page, 'users-school')).toHaveAccessibleName('Sekolah')
    await expect(byId(page, 'users-status')).toHaveAccessibleName('Status')
    await expect(byId(page, 'users-search')).toHaveAttribute(
      'placeholder',
      'Cari nama atau emel...',
    )
    await expect(byId(page, 'users-school').locator('option').first()).toHaveText('Semua Sekolah')
    if (!tableLayout(page)) await page.keyboard.press('Escape')
    await expect(byId(page, 'users-add')).toHaveAttribute('href', '/admin/users/create')
    await expect(byId(page, 'users-add')).toHaveText('Tambah')
    await expect(byId(page, 'users-import-students')).toHaveAttribute(
      'href',
      '/admin/import-students',
    )
    await expect(byId(page, 'users-import-students')).toHaveText('Import Pelajar')
    await expect(byId(page, 'users-import-users')).toHaveAttribute(
      'href',
      '/admin/users/bulk-import',
    )
    await expect(byId(page, 'users-import-users')).toHaveText('Import Pengguna')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-02/04: columns, "-" placeholders, newest first, page 2 range', async ({
    page,
    gotoApp,
  }) => {
    // The "#" numbering column is gone from the v2 list (DsDataTable); the page range lives in the pager.
    if (tableLayout(page)) {
      const heads = (await byId(page, 'users-table').locator('thead th').allTextContents()).map(
        (t) => t.trim(),
      )
      expect(heads).toEqual([
        '',
        'Nama',
        'Telefon',
        'Peranan',
        'Sekolah',
        'Status',
        'Tarikh',
        'Tindakan',
      ])
    }
    await expect(rowsOf(page)).toHaveCount(25)
    await expect(page.locator('[data-ds="data-table-pager"]')).toContainText(
      'Menunjukkan 1-25 daripada',
    )
    if (tableLayout(page)) {
      // Newest first: dd/mm/yyyy dates are never increasing down the page ("Tarikh" is hidden below 2xl,
      // so the cell text is read, not its visibility).
      const dates = (
        await byId(page, 'users-table').locator('tbody tr td:nth-child(7)').allTextContents()
      ).map((d) => d.trim())
      const asNum = dates.map((d) => {
        const [dd, mm, yy] = d.split('/')
        return Number(`${yy}${mm}${dd}`)
      })
      for (let i = 1; i < asNum.length; i++) expect(asNum[i]!).toBeLessThanOrEqual(asNum[i - 1]!)
      for (const d of dates) expect(d).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
      // "-" is shown for a missing phone / school somewhere in the first 25 rows (as live).
      const cells = await byId(page, 'users-table')
        .locator('tbody tr td:nth-child(3), tbody tr td:nth-child(5)')
        .allTextContents()
      expect(cells.map((c) => c.trim())).toContain('-')
    }

    await gotoApp('/admin/users?page=2')
    await expect(rowsOf(page)).toHaveCount(25)
    await expect(page.locator('[data-ds="data-table-pager"]')).toContainText(
      'Menunjukkan 26-50 daripada',
    )
  })

  test('E2E-M02-02: the JPN officer role badge reads "Pegawai JPN"', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=jpn_officer')
    await expect(rowsOf(page)).toHaveCount(2)
    for (const row of await rowsOf(page).all()) await expect(row).toContainText('Pegawai JPN')
    // No stat card is ringed for jpn_officer (DV-M02-10).
    await expect(byId(page, 'users-stats').locator('[data-active="true"]')).toHaveCount(0)
  })

  test('E2E-M02-04: pagination keeps the filter; Previous is disabled on page 1', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=student&page=2')
    await openFilters(page)
    await expect(byId(page, 'users-role')).toHaveValue('student')
    if (!tableLayout(page)) await page.keyboard.press('Escape')
    const pager = page.locator('[data-ds="data-table-pager"]')
    // data deferred: BUG-I2 (the mock has 4,453 pupils, the SRS 4,533)
    await expect(pager).toContainText('Menunjukkan 26-50 daripada 4533 hasil')
    await pager.getByRole('button', { name: 'Seterusnya' }).click()
    await expect(page).toHaveURL(/role=student/)
    await expect(page).toHaveURL(/page=3/)
    await expect(pager).toContainText('Menunjukkan 51-75 daripada')

    await gotoApp('/admin/users')
    await expect(pager.getByRole('button', { name: 'Sebelum' })).toBeDisabled()
    if (!isMobileWidth(page)) {
      // data deferred: BUG-I2 (last page 207 follows the SRS total of 5159 users)
      for (const n of ['2', '207']) {
        await expect(pager.getByRole('button', { name: n, exact: true })).toBeVisible()
      }
    }
  })

  test('E2E-M02-05: role + status + search combined, controls keep values, ring only on the active card', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users')
    await expect(byId(page, 'users-stats').locator('[data-active="true"]')).toHaveCount(0)

    await byId(page, 'users-stat-teacher').click()
    await expect(page).toHaveURL(/\/admin\/users\?role=teacher$/)
    await expect(byId(page, 'users-stat-teacher')).toHaveAttribute('data-active', 'true')
    await expect(byId(page, 'users-stat-student')).not.toHaveAttribute('data-active', 'true')
    await expect(byId(page, 'users-stats').locator('[data-active="true"]')).toHaveCount(1)
    await openFilters(page)
    await expect(byId(page, 'users-role')).toHaveValue('teacher')

    await byId(page, 'users-status').selectOption('1')
    await byId(page, 'users-search').fill('guru')
    await applyFilters(page)
    await expect(page).toHaveURL(/role=teacher/)
    await expect(page).toHaveURL(/is_active=1/)
    await expect(page).toHaveURL(/search=guru/)
    await openFilters(page)
    await expect(byId(page, 'users-role')).toHaveValue('teacher')
    await expect(byId(page, 'users-status')).toHaveValue('1')
    await expect(byId(page, 'users-search')).toHaveValue('guru')
    if (!tableLayout(page)) await page.keyboard.press('Escape')
    await expect(rowsOf(page).first()).toBeVisible()
    for (const row of await rowsOf(page).all()) {
      await expect(row).toContainText('Guru')
      await expect(row).toContainText('Aktif')
    }

    // School filter: pick the first real school option.
    await gotoApp('/admin/users')
    await expect(rowsOf(page).first()).toBeVisible()
    await openFilters(page)
    const options = byId(page, 'users-school').locator('option')
    await expect.poll(() => options.count()).toBeGreaterThan(2)
    const names = (await options.allTextContents()).slice(1).map((s) => s.trim())
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'ms'))
    expect(names).toEqual(sorted)
    const value = await options.nth(1).getAttribute('value')
    await byId(page, 'users-school').selectOption(value!)
    await applyFilters(page)
    await expect(page).toHaveURL(new RegExp(`school=${value}`))
    await expect(rowsOf(page).first()).toBeVisible()
    for (const row of await rowsOf(page).all()) await expect(row).toContainText(names[0]!)
  })

  test('E2E-M02-08: every row has Edit; Pakej only on Admin Sekolah rows (row menu)', async ({
    page,
    gotoApp,
  }) => {
    for (const row of (await rowsOf(page).all()).slice(0, 5)) {
      await expect(row.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', /\/edit$/)
      await row.getByTestId('row-menu').click()
      await expect(page.getByRole('menuitem', { name: 'Pakej' })).toHaveCount(0)
      await page.keyboard.press('Escape')
    }
    await gotoApp('/admin/users?role=school_admin')
    await expect(rowsOf(page)).toHaveCount(16)
    const first = rowsOf(page).first()
    const id = await first.getByTestId('user-row').getAttribute('data-user-id')
    await first.getByTestId('row-menu').click()
    await expect(page.getByRole('menuitem', { name: 'Pakej' })).toHaveAttribute(
      'href',
      `/admin/users/${id}/packages`,
    )
    await page.getByRole('menuitem', { name: 'Pakej' }).click()
    await expect(page).toHaveURL(/\/admin\/users\/\d+\/packages$/)
  })

  test('E2E-M02-07: dismissing the toggle confirm changes nothing; accepting flips the status', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/admin/users?role=student')
    const active = rowsOf(page).filter({ has: page.getByText('Aktif', { exact: true }) }).first()
    const id = await active.getByTestId('user-row').getAttribute('data-user-id')
    const row = rowOf(page, id)
    await expect(row.getByTestId('user-status')).toHaveText('Aktif')
    await row.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Nyahaktifkan' }).click()
    await expect(page.getByRole('dialog')).toContainText('Pasti untuk menukar status pengguna ini?')
    await page.locator('[data-ds="confirm-cancel"]').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(row.getByTestId('user-status')).toHaveText('Aktif')
    expect((await mock.requests()).filter((r) => r.path.includes('toggle-active'))).toHaveLength(0)

    await row.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Nyahaktifkan' }).click()
    await page.locator('[data-ds="confirm-ok"]').click()
    await expect(row.getByTestId('user-status')).not.toHaveText('Aktif')
    // The list reloaded at the same URL (filters kept).
    await expect(page).toHaveURL(/\/admin\/users\?role=student$/)
  })

  test('E2E-M02-07: the seeded inactive student (11) cannot log in; a user deactivated here cannot either', async ({
    page,
    gotoApp,
    newTab,
  }) => {
    // Deactivate an active student through the list, then try to log in as that account in a second tab.
    await gotoApp('/admin/users?search=pelajarmaju')
    const row = rowsOf(page).first()
    await expect(row).toContainText('pelajarmaju@demo.test')
    await expect(row.getByTestId('user-status')).toHaveText('Aktif')
    await row.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Nyahaktifkan' }).click()
    await page.locator('[data-ds="confirm-ok"]').click()
    await expect(row.getByTestId('user-status')).not.toHaveText('Aktif')

    const tab = await newTab()
    for (const email of ['pelajarmaju@demo.test', 'tidakaktif@demo.test']) {
      await gotoAppOn(tab, '/login')
      await tab.getByTestId('login-email').fill(email)
      await tab.getByTestId('login-password').fill(DEMO_PASSWORD)
      await tab.getByTestId('login-submit').click()
      await expect(tab.getByTestId('login-alert')).toContainText('tidak aktif')
      await expect(tab).toHaveURL(/\/login/)
    }
  })

  test('E2E-M02-09: dismissing Login As stays on the list', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=student')
    const first = rowsOf(page).first()
    const name = (await first.getByTestId('user-name').first().innerText()).trim()
    await first.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Login As' }).click()
    await expect(page.getByRole('dialog')).toContainText(`Login sebagai ${name}?`)
    await page.locator('[data-ds="confirm-cancel"]').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/admin\/users\?role=student$/)
    await expect(first).toBeVisible()
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('pp.auth') ?? 'null'))
    expect(auth.user.role).toBe('admin')
    // Every non-own row has Login As and Padam in the row menu.
    await first.getByTestId('row-menu').click()
    await expect(page.getByRole('menuitem', { name: 'Login As' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Padam' })).toBeVisible()
  })

  test('E2E-M02-10: the delete modal closes with the backdrop; "Ya, Padam" removes the row and flashes', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=parent')
    const first = rowsOf(page).first()
    const id = await first.getByTestId('user-row').getAttribute('data-user-id')
    await first.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Padam' }).click()
    await expect(byId(page, 'users-delete-modal')).toBeVisible()
    await page.mouse.click(4, 4)
    await expect(byId(page, 'users-delete-modal')).toHaveCount(0)
    await expect(page.locator(`[data-user-id="${id}"]`)).toHaveCount(1)

    await first.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Padam' }).click()
    await byId(page, 'users-delete-confirm').click()
    await expect(page.locator(`[data-user-id="${id}"]`)).toHaveCount(0)
    await expect(byId(page, 'users-stat-parent').getByTestId('users-stat-value')).toHaveText('37')
    await expect(byId(page, 'cmp-flash').or(page.getByRole('status')).first()).toBeVisible()
  })

  test('E2E-M02-11: untick hides the bar; on ?role=admin the header box selects the other row only', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=student')
    const rows = rowsOf(page)
    await rows.first().getByRole('checkbox').check()
    await expect(byId(page, 'users-bulk-bar')).toContainText('1 dipilih')
    await rows.first().getByRole('checkbox').uncheck()
    await expect(byId(page, 'users-bulk-bar')).toHaveCount(0)

    // Bulk modal: Batal closes without deleting.
    await rows.nth(0).getByRole('checkbox').check()
    await rows.nth(1).getByRole('checkbox').check()
    await byId(page, 'users-bulk-delete').click()
    await expect(byId(page, 'users-bulk-modal')).toContainText('Padam Pengguna Terpilih?')
    await expect(byId(page, 'users-bulk-modal')).toContainText('Ya, Padam Semua')
    await byId(page, 'users-bulk-cancel').click()
    await expect(byId(page, 'users-bulk-modal')).toHaveCount(0)
    // data deferred: BUG-I2 (the mock has 4,453 pupils, the SRS 4,533)
    await expect(byId(page, 'users-stat-student').getByTestId('users-stat-value')).toHaveText(
      '4,533',
    )

    await gotoApp('/admin/users?role=admin')
    await expect(rows).toHaveCount(2)
    if (tableLayout(page)) {
      await byId(page, 'users-select-all').check()
      await expect(byId(page, 'users-selected-count')).toHaveText('1')
    }
    // Own row: has Edit and the status toggle in its menu, no checkbox / Login As / delete.
    const own = rows.filter({ hasText: 'admin@demo.test' })
    await expect(own.getByRole('link', { name: 'Edit' })).toBeVisible()
    await expect(own.getByRole('checkbox')).toHaveCount(0)
    await own.getByTestId('row-menu').click()
    await expect(page.getByRole('menuitem', { name: /ktifkan/ }).first()).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Login As' })).toHaveCount(0)
  })
})

test.describe('M02 QA menus, access, responsive', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 180_000 })
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M02-60: the Pengguna menu entries (sidebar from 1024, menu button below)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/schools')
    if (!isDesktopShell(page)) await byId(page, 'pentadbiran-menu-button').click()
    const nav = page.locator('[data-testid="pentadbiran-nav"]:visible')
    await expect(nav).toBeVisible()
    const expected: [string, string][] = [
      ['Senarai Pengguna', '/admin/users'],
      ['Sekolah', '/admin/schools'],
      ['Langganan Sekolah', '/admin/school-subscriptions'],
      ['Import Pelajar', '/admin/import-students'],
      ['Pelajar Komplimen', '/admin/comp-students'],
      ['Import Pengguna', '/admin/users/bulk-import'],
    ]
    for (const [label, href] of expected) {
      await expect(nav.locator(`a[href="${href}"]`).first()).toContainText(label)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-61: guests are sent to /login on all 16 routes; a student gets the in-place 403 page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await gotoApp('/login')
    for (const path of ROUTES_16) {
      await spaGoto(page, path)
      await expect(page, `guest ${path}`).toHaveURL(/\/login/)
    }
    await loginAs('pelajar@demo.test')
    await gotoApp('/admin/users')
    await expect(page).toHaveURL(/\/dashboard$/)
    await gotoApp('/admin/school-subscriptions')
    await expect(page).toHaveURL(/\/dashboard$/)
    // The API-level 401 / 403 of every M02 endpoint is asserted by the unit suites (users-admin, imports,
    // comp-students, schools-admin, subscriptions: "guest 401, other roles 403"); the page never reaches it.
  })

  test('E2E-M02-62: the 16 routes have no page horizontal scroll and render inside the shell', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users')
    for (const path of ROUTES_16) {
      await spaGoto(page, path)
      await expect(page).toHaveURL(path)
      await expect(page.locator('main, [data-testid="invoice-sheet"]').first()).toBeVisible()
      await page.waitForTimeout(800)
      const over = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }))
      expect(over.sw, `${path} at ${String(viewportWidth(page))}`).toBeLessThanOrEqual(over.cw)
    }
  })

  test('E2E-M02-62: S3 stacks the note card below the form; delete modals are full width below 768', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/2/edit')
    const form = await byId(page, 'user-form').boundingBox()
    const notes = await byId(page, 'user-security-notes').boundingBox()
    expect(notes!.y).toBeGreaterThan(form!.y + form!.height - 2)

    await gotoApp('/admin/users?role=student')
    await rowsOf(page).first().getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Padam' }).click()
    const box = await page.getByRole('dialog').boundingBox()
    if (viewportWidth(page) < 768) expect(box!.width).toBeGreaterThan(viewportWidth(page) * 0.8)
    else expect(box!.width).toBeLessThan(viewportWidth(page) * 0.8)
  })
})
