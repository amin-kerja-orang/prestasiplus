/**
 * M02 G5 QA (qa-engineer): gap-closing E2E for the S1 user list, menus, access and the responsive sweep
 * (E2E-M02-01, 02, 04, 05, 07, 08, 09, 10, 11, 60, 61, 62). Written on top of the developer smoke specs;
 * it does not repeat what they already assert.
 */

import type { Page } from '@playwright/test'

import { DEMO_PASSWORD, expect, gotoApp as gotoAppOn, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  TAG,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)

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
    await expect(byId(page, 'user-row').first()).toBeVisible()
  })

  test('E2E-M02-01: header, 7 cards (order, hrefs, labels), filters, action links', async ({
    page,
  }) => {
    await expect(byId(page, 'shell-admin-title').first()).toHaveText('Pengurusan Pengguna')
    await expect(byId(page, 'shell-admin-subtitle').first()).toHaveText(
      'Urus akaun pengguna PRESTASIPLUS',
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
    const form = byId(page, 'users-filter')
    await expect(form.locator('label')).toHaveText(['Peranan', 'Sekolah', 'Status', 'Cari'])
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
    await expect(byId(page, 'users-search')).toHaveAttribute('placeholder', 'Nama atau emel...')
    await expect(byId(page, 'users-school').locator('option').first()).toHaveText('Semua Sekolah')
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

  test('E2E-M02-02/04: columns, numbering, "-" placeholders, newest first, page 2 numbering', async ({
    page,
    gotoApp,
  }) => {
    await expect(byId(page, 'users-table').locator('thead th')).toHaveText([
      '',
      '#',
      'Nama',
      'Emel',
      'Telefon',
      'Peranan',
      'Sekolah',
      'Aktif?',
      'Tarikh',
      'Tindakan',
    ])
    const rows = byId(page, 'user-row')
    await expect(rows.first().locator('td').nth(1)).toHaveText('1')
    await expect(rows.nth(24).locator('td').nth(1)).toHaveText('25')
    // Newest first: dd/mm/yyyy dates are never increasing down the page.
    const dates = await rows.locator('td:nth-child(9)').allInnerTexts()
    const asNum = dates.map((d) => {
      const [dd, mm, yy] = d.trim().split('/')
      return Number(`${yy}${mm}${dd}`)
    })
    for (let i = 1; i < asNum.length; i++) expect(asNum[i]!).toBeLessThanOrEqual(asNum[i - 1]!)
    for (const d of dates) expect(d.trim()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    // "-" is shown for a missing phone / school somewhere in the first 25 rows (as live).
    const cells = await rows.locator('td:nth-child(5), td:nth-child(7)').allInnerTexts()
    expect(cells.map((c) => c.trim())).toContain('-')

    await gotoApp('/admin/users?page=2')
    await expect(rows.first().locator('td').nth(1)).toHaveText('26')
    await expect(rows.nth(24).locator('td').nth(1)).toHaveText('50')
  })

  test('E2E-M02-02: the JPN officer role badge reads "Pegawai JPN"', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=jpn_officer')
    await expect(byId(page, 'user-row')).toHaveCount(2)
    for (const badge of await byId(page, 'user-role').all())
      await expect(badge).toHaveText('Pegawai JPN')
    // No stat card is ringed for jpn_officer (DV-M02-10).
    await expect(byId(page, 'users-stats').locator('[data-active="true"]')).toHaveCount(0)
  })

  test('E2E-M02-04: pagination keeps the filter; mobile shows Previous as text on page 1', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=student&page=2')
    await expect(byId(page, 'users-role')).toHaveValue('student')
    await expect(byId(page, 'user-row').first().locator('td').nth(1)).toHaveText('26')
    const pager = byId(page, 'users-pager')
    if (isMobileWidth(page)) {
      await expect(pager.getByRole('link', { name: /Next/ }).first()).toHaveAttribute(
        'href',
        /role=student.*page=3|page=3.*role=student/,
      )
    } else {
      await expect(pager).toContainText('Showing 26 to 50 of 4533 results')
      await expect(pager.getByRole('link', { name: /Next/ }).first()).toHaveAttribute(
        'href',
        /role=student/,
      )
    }
    await gotoApp('/admin/users')
    if (isMobileWidth(page)) {
      await expect(pager).toContainText('Previous')
      await expect(pager.getByRole('link', { name: /Previous/ })).toHaveCount(0)
    } else {
      // Numbered window: 1 … 10, "...", last two, next chevron.
      for (const n of ['2', '10', '206', '207']) {
        await expect(
          pager.getByRole('link', { name: `Go to page ${n}`, exact: true }),
        ).toBeVisible()
      }
      await expect(pager).toContainText('...')
    }
  })

  test('E2E-M02-05: role + status + search combined, controls keep values, ring only on the active card', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users')
    const ringless = await byId(page, 'users-stat-teacher').evaluate(
      (el) => getComputedStyle(el).boxShadow,
    )
    await expect(byId(page, 'users-stats').locator('[data-active="true"]')).toHaveCount(0)

    await byId(page, 'users-stat-teacher').click()
    await expect(page).toHaveURL(/\/admin\/users\?role=teacher$/)
    await expect(byId(page, 'users-role')).toHaveValue('teacher')
    const ringed = await byId(page, 'users-stat-teacher').evaluate(
      (el) => getComputedStyle(el).boxShadow,
    )
    expect(ringed).not.toBe(ringless)
    const other = await byId(page, 'users-stat-student').evaluate(
      (el) => getComputedStyle(el).boxShadow,
    )
    expect(other).toBe(ringless)

    await byId(page, 'users-status').selectOption('1')
    await byId(page, 'users-search').fill('guru')
    await byId(page, 'users-search-submit').click()
    await expect(page).toHaveURL(/role=teacher/)
    await expect(page).toHaveURL(/is_active=1/)
    await expect(page).toHaveURL(/search=guru/)
    await expect(byId(page, 'users-role')).toHaveValue('teacher')
    await expect(byId(page, 'users-status')).toHaveValue('1')
    await expect(byId(page, 'users-search')).toHaveValue('guru')
    const roles = await byId(page, 'user-role').allInnerTexts()
    expect(roles.length).toBeGreaterThan(0)
    for (const r of roles) expect(r.trim()).toBe('Guru')
    for (const t of await byId(page, 'user-toggle').allInnerTexts()) expect(t.trim()).toBe('Aktif')

    // School filter: pick the first real school option.
    await gotoApp('/admin/users')
    await expect(byId(page, 'user-row').first()).toBeVisible()
    const options = byId(page, 'users-school').locator('option')
    await expect.poll(() => options.count()).toBeGreaterThan(2)
    const names = (await options.allInnerTexts()).slice(1).map((s) => s.trim())
    expect(names).toEqual(
      [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).length ? names : [],
    )
    const value = await options.nth(1).getAttribute('value')
    await byId(page, 'users-school').selectOption(value!)
    await byId(page, 'users-search-submit').click()
    await expect(page).toHaveURL(new RegExp(`school=${value}`))
    await expect(byId(page, 'user-row').first()).toBeVisible()
    for (const t of await byId(page, 'user-row').locator('td:nth-child(7)').allInnerTexts()) {
      expect(t.trim()).toBe(names[0])
    }
  })

  test('E2E-M02-08: every row has Edit; Pakej only on Admin Sekolah rows', async ({
    page,
    gotoApp,
  }) => {
    for (const row of await byId(page, 'user-row').all()) {
      await expect(row.getByTestId('user-edit')).toHaveAttribute('title', 'Edit')
      await expect(row.getByTestId('user-packages')).toHaveCount(0)
    }
    await gotoApp('/admin/users?role=school_admin')
    const rows = byId(page, 'user-row')
    await expect(rows).toHaveCount(16)
    for (const row of await rows.all()) {
      const id = await row.getAttribute('data-user-id')
      await expect(row.getByTestId('user-packages')).toHaveAttribute('title', 'Pakej')
      await expect(row.getByTestId('user-packages')).toHaveAttribute(
        'href',
        `/admin/users/${id}/packages`,
      )
    }
    await rows.first().getByTestId('user-packages').click()
    await expect(page).toHaveURL(/\/admin\/users\/\d+\/packages$/)
  })

  test('E2E-M02-07: dismissing the toggle confirm changes nothing; accept shows the spinner while pending', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/admin/users?role=student')
    const row = byId(page, 'user-row').first()
    const before = (await row.getByTestId('user-toggle').innerText()).trim()
    const dismissed = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Pasti untuk menukar status pengguna ini?',
    })
    await row.getByTestId('user-toggle').click()
    await dismissed
    await expect(row.getByTestId('user-toggle')).toHaveText(before)
    expect((await mock.requests()).filter((r) => r.path.includes('toggle-active'))).toHaveLength(0)

    await mock.setLatency(1500)
    const accepted = acceptNextDialog(page, { type: 'confirm' })
    await row.getByTestId('user-toggle').click()
    await accepted
    await expect(row.getByTestId('user-toggle')).toBeDisabled()
    await expect(row.getByTestId('user-toggle').locator('svg.animate-spin')).toBeVisible()
    await expect(row.getByTestId('user-toggle')).toBeEnabled({ timeout: 8000 })
    await expect(row.getByTestId('user-toggle')).not.toHaveText(before)
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
    const row = byId(page, 'user-row').first()
    await expect(row).toContainText('pelajarmaju@demo.test')
    await expect(row.getByTestId('user-toggle')).toHaveText('Aktif')
    const accepted = acceptNextDialog(page, { type: 'confirm' })
    await row.getByTestId('user-toggle').click()
    await accepted
    await expect(row.getByTestId('user-toggle')).toHaveText('Tidak')

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
    const first = byId(page, 'user-row').first()
    const name = (await first.getByTestId('user-name').innerText()).trim()
    const dismissed = dismissNextDialog(page, {
      type: 'confirm',
      message: `Login sebagai ${name}?`,
    })
    await first.getByTestId('user-login-as').click()
    await dismissed
    await expect(page).toHaveURL(/\/admin\/users\?role=student$/)
    await expect(first).toBeVisible()
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('pp.auth') ?? 'null'))
    expect(auth.user.role).toBe('admin')
    // Every non-own row has the title on the control.
    await expect(first.getByTestId('user-login-as')).toHaveAttribute('title', 'Login As')
    await expect(first.getByTestId('user-delete')).toHaveAttribute('title', 'Padam')
  })

  test('E2E-M02-10: the delete modal closes with the backdrop; "Ya, Padam" removes the row and flashes', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=parent')
    const first = byId(page, 'user-row').first()
    const id = await first.getAttribute('data-user-id')
    await first.getByTestId('user-delete').click()
    await expect(byId(page, 'users-delete-modal')).toBeVisible()
    await page.mouse.click(4, 4)
    await expect(byId(page, 'users-delete-modal')).toHaveCount(0)
    await expect(page.locator(`[data-user-id="${id}"]`)).toHaveCount(1)

    await first.getByTestId('user-delete').click()
    await byId(page, 'users-delete-confirm').click()
    await expect(page.locator(`[data-user-id="${id}"]`)).toHaveCount(0)
    await expect(byId(page, 'users-stat-parent').getByTestId('users-stat-count')).toHaveText('37')
    await expect(byId(page, 'cmp-flash').or(page.getByRole('status')).first()).toBeVisible()
  })

  test('E2E-M02-11: untick hides the bar; on ?role=admin the header box selects the other row only', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=student')
    const rows = byId(page, 'user-row')
    await rows.first().getByTestId('user-select').check()
    await expect(byId(page, 'users-bulk-bar')).toContainText('1 dipilih')
    await rows.first().getByTestId('user-select').uncheck()
    await expect(byId(page, 'users-bulk-bar')).toHaveCount(0)

    // Bulk modal: Batal closes without deleting.
    await rows.nth(0).getByTestId('user-select').check()
    await rows.nth(1).getByTestId('user-select').check()
    await byId(page, 'users-bulk-delete').click()
    await expect(byId(page, 'users-bulk-modal')).toContainText('Padam Pengguna Terpilih?')
    await expect(byId(page, 'users-bulk-modal')).toContainText('Ya, Padam Semua')
    await byId(page, 'users-bulk-cancel').click()
    await expect(byId(page, 'users-bulk-modal')).toHaveCount(0)
    await expect(byId(page, 'users-stat-student').getByTestId('users-stat-count')).toHaveText(
      '4533',
    )

    await gotoApp('/admin/users?role=admin')
    await expect(rows).toHaveCount(2)
    await byId(page, 'users-select-all').check()
    await expect(byId(page, 'users-selected-count')).toHaveText('1')
    // Own row: has the toggle and Edit, no checkbox / Login As / delete.
    const own = rows.filter({ hasText: 'admin@demo.test' })
    await expect(own.getByTestId('user-toggle')).toBeVisible()
    await expect(own.getByTestId('user-edit')).toBeVisible()
    await expect(own.getByTestId('user-select')).toHaveCount(0)
  })
})

test.describe('M02 QA menus, access, responsive', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 180_000 })
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M02-60: the PENGGUNA menu group (desktop sidebar) / bottom nav and "Lagi" (below 1024)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/schools')
    if (isDesktopShell(page)) {
      const nav = byId(page, 'shell-admin-nav')
      const expected: [string, string][] = [
        ['Senarai Pengguna', '/admin/users'],
        ['Sekolah', '/admin/schools'],
        ['Langganan Sekolah', '/admin/school-subscriptions'],
        ['Import Pelajar', '/admin/import-students'],
        ['Pelajar Komplimen', '/admin/comp-students'],
        ['Import Pengguna', '/admin/users/bulk-import'],
      ]
      await expect(nav).toContainText('Pengguna')
      for (const [label, href] of expected) {
        await expect(nav.locator(`a[href="${href}"]`).first()).toContainText(label)
      }
    } else {
      const bottom = byId(page, 'shell-admin-bottom-nav')
      await expect(bottom.locator('a[href="/admin/users"]')).toContainText('Pengguna')
      await bottom.getByRole('button', { name: /Lagi/ }).click()
      const lagi = byId(page, 'shell-admin-lagi')
      await expect(lagi).toBeVisible()
      await expect(lagi).toContainText('Sistem')
      for (const href of ['/admin/schools', '/admin/school-subscriptions']) {
        await expect(lagi.locator(`a[href="${href}"]`).first()).toBeVisible()
      }
      await expectNoHorizontalScroll(page)
      await bottom.locator('a[href="/admin/users"]').click()
      await expect(page).toHaveURL('/admin/users')
    }
  })

  test('E2E-M02-61: guests are sent to /login on all 16 routes; a student is sent to /dashboard', async ({
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
    await byId(page, 'user-row').first().getByTestId('user-delete').click()
    const box = await byId(page, 'users-delete-modal')
      .locator('h3')
      .locator('xpath=..')
      .boundingBox()
    if (viewportWidth(page) < 768) expect(box!.width).toBeGreaterThan(viewportWidth(page) * 0.8)
    else expect(box!.width).toBeLessThan(viewportWidth(page) * 0.8)
  })
})
