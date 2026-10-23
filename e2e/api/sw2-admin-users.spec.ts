/**
 * @api AM2-SW2 (PR #234): the Admin Pusat user list, the user forms and the profile school card against the
 * REAL API (http mode), at 375 / 768 / 1280.
 *
 * What each test proves (the defect it guards is in brackets):
 *  - SW2-01  every row / card has a non-empty role badge (the wire row carries `roles[]` and no `role`)
 *  - SW2-02  the school chip shows the school name (wire ids are strings, the URL id was compared as a number)
 *  - SW2-03  the signed-in admin's own row has no checkbox and no "Padam" (string wire id vs numeric session id)
 *  - SW2-04  a school admin's "..." menu has "Pakej"; no row offers "Login As" (the API has no impersonation)
 *  - SW2-05  no "Pegawai JPN" in the role filter, the create form or the edit form (not a contract role)
 *  - SW2-07  at 768 and 1280 the "Tindakan" header and the first "..." button sit inside the table card
 *  - SW2-11  /profile/edit shows the school card for a student only (teacher: absent)
 *
 * Read-only: nothing is created, changed or deleted, so a re-run leaves the seed as it was.
 * Seed accounts and the password come from `./helpers` (`account()`); the password is never written here.
 * Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PUSAT_PASS / BIJAK_GURU_PASS / BIJAK_STUDENT_PASS).
 */

import { expect, test, type Locator, type Page } from '@playwright/test'

import { currentSession, gotoApi, loginViaUi } from '../fixtures/api'
import { account, expectNoHScroll, type ApiRole } from './helpers'

/** Tailwind `md`: the list is a table from here, a card list below (DsDataTable `useMedia`). */
const TABLE_MIN_WIDTH = 768
/** Pegawai JPN is not a role of the API contract. */
const JPN_LABEL = 'Pegawai JPN'
/** Wire role -> badge text (`ROLE_LABELS` in the list page). */
const ROLE_LABEL: Record<string, string> = {
  student: 'Pelajar',
  teacher: 'Guru',
  parent: 'Ibu Bapa',
  sponsor: 'Penaja',
  school_admin: 'Admin Sekolah',
  ppd_officer: 'Pegawai PPD',
  admin: 'Admin',
}

interface WireRow {
  id: string
  roles: string[]
}

function isTableLayout(page: Page): boolean {
  const size = page.viewportSize()
  if (!size) throw new Error('the page has no fixed viewport')
  return size.width >= TABLE_MIN_WIDTH
}

async function signIn(page: Page, role: ApiRole): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

/** Opens `/admin/users` (optionally with a query) and waits for the first loaded row or card. */
async function openUserList(page: Page, query = ''): Promise<void> {
  await gotoApi(page, `/admin/users${query}`)
  await expect(page.getByTestId('users-table')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('user-row').first()).toBeVisible({ timeout: 20_000 })
}

/** One table row (md and up) or one card (below md) that holds the row actions of user `id`. */
function rowOf(page: Page, id: string): Locator {
  return page
    .locator('tr, [data-ds="data-table-cards"] > li')
    .filter({ has: page.locator(`[data-testid="user-row"][data-user-id="${id}"]`) })
}

/** The wire list for a query, read with the page's own session (the same call the screen makes). */
async function wireList(page: Page, query: Record<string, string> = {}): Promise<WireRow[]> {
  const res = await page.request.get('/api/admin/users', { params: query })
  expect(res.status(), 'GET /api/admin/users').toBe(200)
  return ((await res.json()) as { data: WireRow[] }).data
}

/** Below md the filter fields sit in a bottom sheet behind "Penapis"; from md they are inline. */
async function openFilterControls(page: Page): Promise<void> {
  if (!isTableLayout(page)) {
    await page.locator('[data-ds="filter-open"]').click()
    await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
  }
}

async function applyFilters(page: Page): Promise<void> {
  if (isTableLayout(page)) await page.getByRole('button', { name: 'Cari', exact: true }).click()
  else await page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }).click()
}

/** Opens the "..." menu of a row and returns the menu item labels; closes it again. */
async function menuLabels(page: Page, row: Locator): Promise<string[]> {
  await row.getByTestId('row-menu').click()
  const items = page.getByRole('menuitem')
  await expect(items.first()).toBeVisible()
  const labels = (await items.allTextContents()).map((t) => t.trim())
  await page.keyboard.press('Escape')
  await expect(items.first()).toBeHidden()
  return labels
}

test.describe('AM2-SW2 admin pusat users @api', () => {
  test.setTimeout(120_000)

  test('SW2-01 every row shows a role badge with the role label @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    await openUserList(page)

    const wire = await wireList(page)
    expect(wire.length, 'the seed has users on page 1').toBeGreaterThan(5)
    const ids = await page
      .getByTestId('user-row')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-user-id')))
    expect(ids.length, 'rows or cards on screen').toBe(wire.length)

    for (const row of wire) {
      const role = row.roles[0] ?? 'unmapped'
      const label = ROLE_LABEL[role]
      expect(label, `the label of seed role "${role}" is known to this spec`).toBeTruthy()
      // The badge is the one element whose whole text is the label (names and e-mails never equal it).
      await expect(
        rowOf(page, row.id).getByText(label!, { exact: true }),
        `role badge "${label}" of user ${row.id}`,
      ).toHaveCount(1)
    }

    if (isTableLayout(page)) {
      // The table cell has a test id: no badge may be empty or a raw/undefined code.
      const badges = page.getByTestId('user-role')
      await expect(badges).toHaveCount(wire.length)
      for (const text of await badges.allTextContents()) {
        expect(text.trim(), 'role badge text').not.toBe('')
        expect(text.trim(), 'role badge text').not.toMatch(/undefined|unmapped/i)
      }
    }
    await expectNoHScroll(page)
  })

  test('SW2-04 school admin menu has Pakej and no row offers Login As @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    await openUserList(page, '?role=school_admin')

    const wire = await wireList(page, { role: 'school_admin' })
    expect(wire.length, 'the seed has school admins').toBeGreaterThan(0)
    for (const row of wire) {
      const labels = await menuLabels(page, rowOf(page, row.id))
      expect(labels, `menu of school admin ${row.id}`).toContain('Pakej')
      expect(labels, `menu of school admin ${row.id}`).not.toContain('Login As')
      expect(labels, `menu of school admin ${row.id}`).toContain('Padam')
    }

    // Any other role: still no Login As, and no Pakej (school admins only).
    await openUserList(page, '?role=student')
    const student = (await wireList(page, { role: 'student' }))[0]!
    const studentMenu = await menuLabels(page, rowOf(page, student.id))
    expect(studentMenu).not.toContain('Login As')
    expect(studentMenu).not.toContain('Pakej')
    expect(studentMenu).toContain('Padam')
    await expectNoHScroll(page)
  })

  test('SW2-03 the own row has no checkbox and no Padam, other rows keep both @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    const own = (await currentSession(page)).user.id

    // Only the admin role holds the signed-in admin (the seed has one Admin Pusat).
    await openUserList(page, '?role=admin')
    const ownRow = rowOf(page, own)
    await expect(ownRow, 'the signed-in admin is listed under role=admin').toHaveCount(1)
    await expect(ownRow.getByTestId('user-select'), 'checkbox on the own row').toHaveCount(0)
    const ownMenu = await menuLabels(page, ownRow)
    expect(ownMenu, 'menu of the own row').not.toContain('Padam')
    expect(ownMenu, 'menu of the own row').not.toContain('Login As')
    expect(ownMenu, 'the own row can still be deactivated').toContain('Nyahaktifkan')

    // The check is not vacuous: another user's row has the checkbox and "Padam".
    await openUserList(page, '?role=student')
    const other = (await wireList(page, { role: 'student' }))[0]!
    expect(other.id).not.toBe(own)
    await expect(rowOf(page, other.id).getByTestId('user-select')).toHaveCount(1)
    expect(await menuLabels(page, rowOf(page, other.id))).toContain('Padam')
    await expectNoHScroll(page)
  })

  test('SW2-05 no Pegawai JPN in the role filter @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    await openUserList(page)
    await openFilterControls(page)

    const options = (await page.getByTestId('users-role').locator('option').allTextContents()).map(
      (t) => t.trim(),
    )
    expect(options, 'role filter options').toContain('Pegawai PPD')
    expect(options, 'role filter options').toContain('Admin Sekolah')
    expect(options, 'role filter options').not.toContain(JPN_LABEL)
    expect(options.join('|')).not.toMatch(/JPN/)
  })

  test('SW2-07 Tindakan and the first "..." button are inside the table card @api', async ({
    page,
  }) => {
    await signIn(page, 'adminPusat')
    await openUserList(page)

    const card = page.getByTestId('users-table')
    const cardBox = (await card.boundingBox())!
    expect(cardBox, 'table card box').not.toBeNull()
    const first = page.getByTestId('user-row').first()
    const menu = first.getByTestId('row-menu')
    await expect(menu).toBeVisible()

    const targets: Record<string, Locator> = { 'first "..." button': menu }
    if (isTableLayout(page)) {
      const header = page.getByRole('columnheader', { name: 'Tindakan' })
      await expect(header).toBeVisible()
      targets['"Tindakan" header'] = header
    }
    for (const [name, locator] of Object.entries(targets)) {
      const box = (await locator.boundingBox())!
      expect(box, `${name} box`).not.toBeNull()
      expect(box.x, `${name} left edge inside the card`).toBeGreaterThanOrEqual(cardBox.x - 0.5)
      expect(
        box.x + box.width,
        `${name} right edge inside the card (card right ${cardBox.x + cardBox.width})`,
      ).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5)
    }

    // The table fits its card: nothing scrolls sideways inside it or on the page.
    if (isTableLayout(page)) {
      const scrollsInside = await card.evaluate((el) =>
        [...el.querySelectorAll<HTMLElement>('*')].some(
          (n) =>
            n.scrollWidth > n.clientWidth + 1 &&
            getComputedStyle(n).overflowX !== 'visible' &&
            n.clientWidth > 0 &&
            (n.tagName === 'DIV' || n.tagName === 'TABLE'),
        ),
      )
      expect(scrollsInside, 'a container inside the table card scrolls sideways').toBe(false)
    }
    await expectNoHScroll(page)

    // The menu opens from that button and stays on screen.
    await menu.click()
    const item = page.getByRole('menuitem').first()
    await expect(item).toBeVisible()
    const itemBox = (await item.boundingBox())!
    const viewport = page.viewportSize()!
    expect(itemBox.x, 'menu item left edge on screen').toBeGreaterThanOrEqual(0)
    expect(itemBox.x + itemBox.width, 'menu item right edge on screen').toBeLessThanOrEqual(
      viewport.width + 0.5,
    )
  })

  test('SW2-02 the school chip shows the school name, not "Sekolah N" @api', async ({ page }) => {
    await signIn(page, 'adminPusat')
    await openUserList(page)
    await openFilterControls(page)

    const schools = (await (await page.request.get('/api/admin/users/filters')).json()) as {
      data: { schools: { id: string; name: string }[] }
    }
    const school =
      schools.data.schools.find((s) => s.name === 'SK Demo Tiga') ?? schools.data.schools[0]!
    const select = page.getByTestId('users-school')
    await expect(select.locator('option', { hasText: school.name })).toHaveCount(1, {
      timeout: 20_000,
    })
    await select.selectOption({ label: school.name })
    await applyFilters(page)

    await expect(page).toHaveURL(new RegExp(`[?&]school=${school.id}(&|$)`))
    const chips = page.getByTestId('active-filter')
    await expect(chips).toHaveCount(1)
    await expect(chips.first()).toHaveText(school.name)
    await expect(chips.first()).not.toContainText(/^Sekolah \d+$/)
    await expect(page.getByTestId('user-row').first()).toBeVisible()
    await expectNoHScroll(page)

    // A deep link carries the same chip.
    await openUserList(page, `?school=${school.id}`)
    await expect(page.getByTestId('active-filter').first()).toHaveText(school.name)
  })

  test('SW2-05 create and edit forms have no Pegawai JPN role @api', async ({ page }) => {
    await signIn(page, 'adminPusat')

    await gotoApi(page, '/admin/users/create')
    const createRole = page.getByTestId('user-role')
    await expect(createRole).toBeVisible({ timeout: 20_000 })
    const createOptions = (await createRole.locator('option').allTextContents()).map((t) =>
      t.trim(),
    )
    expect(createOptions, 'create form roles').toContain('Pegawai PPD')
    expect(createOptions, 'create form roles').toContain('Admin Sekolah')
    expect(createOptions, 'create form roles').not.toContain(JPN_LABEL)
    await expectNoHScroll(page)

    const student = (await wireList(page, { role: 'student' }))[0]!
    await gotoApi(page, `/admin/users/${student.id}/edit`)
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
    const editOptions = (
      await page.getByTestId('user-role').locator('option').allTextContents()
    ).map((t) => t.trim())
    expect(editOptions, 'edit form roles').toContain('Pelajar')
    expect(editOptions, 'edit form roles').not.toContain(JPN_LABEL)
    await expectNoHScroll(page)
  })
})

test.describe('AM2-SW2 profile school card @api', () => {
  test.setTimeout(90_000)

  test('SW2-11 a teacher has no school card on /profile/edit @api', async ({ page }) => {
    await signIn(page, 'guru')
    await gotoApi(page, '/profile/edit')
    await expect(page.getByTestId('profile-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('profile-save')).toBeVisible()
    await expect(page.getByTestId('profile-school-card')).toHaveCount(0)
    // By its heading too, so the check does not depend on the test id alone.
    await expect(page.getByRole('heading', { name: 'Maklumat Sekolah' })).toHaveCount(0)
    await expectNoHScroll(page)
  })

  test('SW2-11 a student sees the school card on /profile/edit @api', async ({ page }) => {
    await signIn(page, 'student')
    await gotoApi(page, '/profile/edit')
    await expect(page.getByTestId('profile-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('profile-school-card')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maklumat Sekolah' })).toBeVisible()
    await expectNoHScroll(page)
  })
})
