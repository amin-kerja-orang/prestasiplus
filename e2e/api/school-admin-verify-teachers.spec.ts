/**
 * @api School admin verifies self-registered teachers (issue #191, docs/design/m27-pending-teacher-verify.md
 * section 15.3 steps 1 to 7 and 9) against the REAL API. Writes data: the teachers are created by the test itself
 * through the public `POST /api/auth/register` (role teacher, school of the seeded school_admin = id 1), so no
 * seed record is invented and nothing depends on a pre-loaded pending teacher.
 *
 * Contract facts used (packages/contract/src/school-admin/pending-teachers.ts, account/schema.ts):
 * - `GET /api/admin-sekolah/guru/pending` lists the pending teachers of the admin's school only, oldest first.
 * - `POST /api/admin-sekolah/guru/{id}/verify` answers 200 `{ status: "Guru berjaya disahkan." }`; 404 for
 *   everything else (already verified, other school), 403 for any role other than school_admin.
 * - The e-mail is REQUIRED on register, so a pending teacher with a null e-mail cannot be created through the
 *   public API: the null e-mail "-" is covered by the unit test (m27 `__tests__/users/pending.test.ts`). The
 *   phone is optional, so teacher "Dua" has none and the phone cell shows "-".
 * - Step 8 (429 on the POST, network failure, failing GET) cannot be produced against the real API without
 *   hacks (throttle is 30 writes/min per user); it is covered by unit tests in the same file.
 * - Names are fictitious ("Cikgu Contoh ..."). Teachers left over from an aborted earlier run (same name prefix,
 *   same school) are verified away first so the counts are exact. The one teacher registered for another school
 *   stays pending there (it has no admin on the seed); that is the isolation check.
 *
 * Data left behind: the verified `Cikgu Contoh` teachers stay active in school 1 and one `Cikgu Contoh Asing` stays
 * pending in school 2, per project and run. Use a fresh DB (`stack:down -v`) between runs.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_<ROLE>_PASS; see helpers.ts). Stack: npm run stack:up.
 */

import type { Locator, Page } from '@playwright/test'

import { API_PASSWORD, expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { isMobileWidth, viewportWidth } from '../support'
import { account, csrfOf, expectNoHScroll, FORBIDDEN_TITLE, newPeerContext } from './helpers'

const SCHOOL_ID = '1'
const OTHER_SCHOOL_ID = '2'
const NAME_PREFIX = 'Cikgu Contoh'
const LIST_PATH = '/admin-sekolah/guru'
const PENDING_PATH = '/admin-sekolah/guru/menunggu'
const VERIFIED_FLASH = 'Guru berjaya disahkan.'
const GONE_FLASH = 'Guru ini tidak lagi menunggu pengesahan. Senarai telah dikemas kini.'
const CONFIRM_TEXT = (name: string) =>
  `Sahkan ${name} sebagai guru sekolah ini? Akaun akan diaktifkan dan guru akan dimaklumkan.`
const EMPTY_TITLE = 'Tiada guru menunggu pengesahan'
const EMPTY_TEXT = 'Guru yang mendaftar sendiri dan memilih sekolah ini akan muncul di sini.'
const MD_MIN_WIDTH = 768

interface PendingRow {
  id: string
  name: string
  email: string | null
  phone: string | null
}

const found = (n: number) => `${n} guru menunggu pengesahan`

/** Self-registers a teacher through the public route (no session); asserts the pending-verification answer. */
async function registerTeacher(
  page: Page,
  o: { name: string; email: string; phone?: string; schoolId: string },
): Promise<void> {
  const res = await page.request.post('/api/auth/register', {
    data: {
      name: o.name,
      email: o.email,
      ...(o.phone ? { phone: o.phone } : {}),
      role: 'teacher',
      schoolId: o.schoolId,
      password: API_PASSWORD,
      passwordConfirmation: API_PASSWORD,
    },
  })
  expect(res.status(), `POST /api/auth/register (${o.name})`).toBe(201)
  const body = (await res.json()) as { data: { status: string } }
  expect(body.data.status).toBe('pending_verification')
}

async function listPending(page: Page): Promise<PendingRow[]> {
  const res = await page.request.get('/api/admin-sekolah/guru/pending')
  expect(res.status(), 'GET /api/admin-sekolah/guru/pending').toBe(200)
  return ((await res.json()) as { data: PendingRow[] }).data
}

async function verifyViaApi(page: Page, id: string): Promise<number> {
  const csrf = await csrfOf(page)
  const res = await page.request.post(`/api/admin-sekolah/guru/${id}/verify`, {
    headers: { 'X-CSRF-Token': csrf },
  })
  return res.status()
}

/** The visible "Sahkan {nama}" button of one row (the page renders the table and the cards variant). */
const verifyButton = (page: Page, id: string): Locator =>
  page.locator(`[data-testid="pt-verify"][data-user-id="${id}"]:visible`)

const flashText = (page: Page) => page.getByTestId('cmp-flash')

function isVerifyPost(url: string, method: string): boolean {
  return method === 'POST' && /\/api\/admin-sekolah\/guru\/\d+\/verify$/.test(url)
}

test.describe('school admin verifies self-registered teachers @api', () => {
  test.setTimeout(180_000)

  test('callout, list layout, confirm dialog, verify, stale 404, empty state, S7 and isolation @api', async ({
    page,
    browser,
  }, info) => {
    const admin = account('adminSekolah')
    const tag = `${Date.now().toString(36)}-${info.project.name}`
    const email = (key: string) => `contoh.${key}.${tag}@contoh.test`
    const names = {
      satu: `${NAME_PREFIX} Satu`,
      dua: `${NAME_PREFIX} Dua`,
      tiga: `${NAME_PREFIX} Tiga`,
      empat: `${NAME_PREFIX} Empat`,
      asing: `${NAME_PREFIX} Asing`,
    }

    // --- Arrange: sign in, clear own leftovers, register fresh pending teachers ------------------------------
    await loginViaUi(page, admin.user, admin.pass)
    for (const left of (await listPending(page)).filter((r) => r.name.startsWith(NAME_PREFIX))) {
      expect(await verifyViaApi(page, left.id), `cleanup verify ${left.id}`).toBe(200)
    }
    const baseline = (await listPending(page)).length
    expect(
      baseline,
      'school 1 must have no pending teacher besides this spec own (use a fresh DB: stack:down -v); the empty-state and focus steps need an empty list',
    ).toBe(0)

    await registerTeacher(page, { name: names.satu, email: email('satu'), phone: '0123456789', schoolId: SCHOOL_ID })
    await registerTeacher(page, { name: names.dua, email: email('dua'), schoolId: SCHOOL_ID }) // no phone
    await registerTeacher(page, { name: names.tiga, email: email('tiga'), phone: '0198765432', schoolId: SCHOOL_ID })
    await registerTeacher(page, { name: names.empat, email: email('empat'), phone: '0171234567', schoolId: SCHOOL_ID })
    await registerTeacher(page, { name: names.asing, email: email('asing'), schoolId: OTHER_SCHOOL_ID })

    const rows = await listPending(page)
    expect(rows.length, 'own school only: the other school teacher is not listed').toBe(baseline + 4)
    expect(rows.map((r) => r.name)).not.toContain(names.asing)
    const mine = (name: string) => rows.find((r) => r.name === name)!
    const satu = mine(names.satu)
    const dua = mine(names.dua)
    const tiga = mine(names.tiga)
    const empat = mine(names.empat)
    expect(dua.phone).toBeNull()
    // Own teachers are the newest: they are listed last, in registration order.
    expect(rows.slice(baseline).map((r) => r.id)).toEqual([satu.id, dua.id, tiga.id, empat.id])
    let remaining = baseline + 4

    // --- Step 1: callout on S7 -------------------------------------------------------------------------------
    await gotoApi(page, LIST_PATH)
    const callout = page.getByTestId('pt-callout')
    await expect(callout).toBeVisible({ timeout: 20_000 })
    await expect(callout).toContainText('Menunggu Pengesahan')
    await expect(page.getByTestId('pt-callout-count')).toHaveText(found(remaining))
    const semak = page.getByTestId('pt-callout-link')
    await expect(semak).toHaveText('Semak')
    const semakBox = (await semak.boundingBox())!
    expect(semakBox.height, 'Semak is at least 44 px high').toBeGreaterThanOrEqual(44)
    if (isMobileWidth(page)) {
      const countBox = (await page.getByTestId('pt-callout-count').boundingBox())!
      const calloutBox = (await callout.boundingBox())!
      expect(semakBox.y, 'Semak is stacked under the text below sm').toBeGreaterThan(countBox.y + countBox.height - 1)
      expect(semakBox.width, 'Semak is full width below sm').toBeGreaterThan(calloutBox.width * 0.8)
    }
    await expectNoHScroll(page)
    if (isMobileWidth(page)) {
      const original = page.viewportSize()!
      await page.setViewportSize({ width: 320, height: 800 })
      await expectNoHScroll(page)
      await page.setViewportSize(original)
    }

    // --- Step 2: Semak opens S7b ------------------------------------------------------------------------------
    await semak.click()
    await expect(page).toHaveURL(new RegExp(`${PENDING_PATH}$`))
    await expect(page.getByTestId('pt-page')).toBeVisible()
    await expect(page.getByTestId('pt-heading')).toHaveText('Guru Menunggu Pengesahan')
    await expect(page.getByTestId('pt-heading')).toHaveJSProperty('tagName', 'H1')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page).toHaveTitle('Guru Menunggu Pengesahan - PRESTASIPLUS')
    await expect(page.getByTestId('pt-back')).toHaveText('Senarai Guru')
    await expect(page.getByTestId('pt-count-card')).toContainText(String(remaining))
    await expect(page.getByTestId('pt-count-card')).toContainText('Menunggu Pengesahan')
    await expect(page.getByTestId('pt-found')).toHaveText(found(remaining))
    await expect(page.locator('[data-testid="pt-verify"]:visible')).toHaveCount(remaining)

    const tableLayout = viewportWidth(page) >= MD_MIN_WIDTH
    const table = page.locator('[data-testid="pt-table"] table:visible')
    if (tableLayout) {
      await expect(table).toHaveCount(1)
      await expect(table.getByRole('columnheader')).toHaveText([
        '#',
        'Nama',
        'Emel',
        'Telefon',
        'Tarikh Daftar',
        'Tindakan',
      ])
    } else {
      await expect(table).toHaveCount(0)
      await expect(page.locator('[data-testid="pt-name"]:visible').filter({ hasText: names.satu })).toHaveCount(1)
    }
    // Row content: name, e-mail, "-" for the missing phone, dd/mm/yyyy HH:mm date.
    const rowOf = (id: string) =>
      page.locator(`[data-testid="pt-verify"][data-user-id="${id}"]:visible`).locator(
        tableLayout ? 'xpath=ancestor::tr' : 'xpath=ancestor::*[.//*[@data-testid="pt-row"]][1]',
      )
    const duaRow = rowOf(dua.id)
    await expect(duaRow).toContainText(names.dua)
    await expect(duaRow.locator('[data-testid="pt-email"]:visible')).toHaveText(email('dua'))
    await expect(duaRow.locator('[data-testid="pt-phone"]:visible')).toHaveText('-')
    await expect(duaRow.locator('[data-testid="pt-date"]:visible')).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
    await expect(rowOf(satu.id).locator('[data-testid="pt-phone"]:visible')).toHaveText('0123456789')
    // No search, filter or pager; the other school's teacher is not on the page.
    await expect(page.getByTestId('user-filter')).toHaveCount(0)
    await expect(page.getByRole('searchbox')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: /halaman|pagination/i })).toHaveCount(0)
    await expect(page.getByText(names.asing)).toHaveCount(0)
    await expectNoHScroll(page)

    // --- Step 3: accessible name and touch target of every verify button -------------------------------------
    for (const t of [satu, dua, tiga, empat]) {
      const button = verifyButton(page, t.id)
      await expect(button).toHaveAccessibleName(`Sahkan ${t.name}`)
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }

    // --- Step 4: dialog copy; Batal and Esc send no POST, focus returns --------------------------------------
    const posts: string[] = []
    page.on('request', (r) => {
      if (isVerifyPost(r.url(), r.method())) posts.push(r.url())
    })
    const dialog = page.getByRole('dialog')
    for (const how of ['Batal', 'Escape'] as const) {
      await verifyButton(page, satu.id).click()
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('Sahkan Guru')
      await expect(dialog).toContainText(CONFIRM_TEXT(names.satu))
      await expect(dialog.getByRole('button', { name: 'Sahkan', exact: true })).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Batal' })).toBeVisible()
      if (how === 'Batal') await dialog.getByRole('button', { name: 'Batal' }).click()
      else await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(verifyButton(page, satu.id)).toBeFocused()
      await expect(page.locator('[data-testid="pt-verify"]:visible')).toHaveCount(remaining)
    }
    expect(posts, 'Batal and Esc send no POST').toHaveLength(0)

    // --- Step 5a: verify the first own row -> 200, flash, row gone, focus on the next row --------------------
    await verifyButton(page, satu.id).click()
    const verifyResponse = page.waitForResponse((r) => isVerifyPost(r.url(), r.request().method()))
    await dialog.getByRole('button', { name: 'Sahkan', exact: true }).click()
    const done = await verifyResponse
    expect(done.status(), 'POST verify').toBe(200)
    expect(done.url()).toContain(`/api/admin-sekolah/guru/${satu.id}/verify`)
    expect(((await done.json()) as { status: string }).status).toBe(VERIFIED_FLASH)
    remaining -= 1
    await expect(flashText(page)).toContainText(VERIFIED_FLASH)
    await expect(verifyButton(page, satu.id)).toHaveCount(0)
    await expect(page.getByTestId('pt-found')).toHaveText(found(remaining))
    await expect(verifyButton(page, dua.id)).toBeFocused()
    expect(posts).toHaveLength(1)

    // --- Step 7: stale row. Another session verifies "Tiga" first; Sahkan in this page then answers 404 -----
    const peerContext = await newPeerContext(browser, info)
    try {
      const peer = await peerContext.newPage()
      await loginViaUi(peer, admin.user, admin.pass)
      expect(await verifyViaApi(peer, tiga.id), 'peer verifies Tiga first').toBe(200)
    } finally {
      await peerContext.close()
    }
    await verifyButton(page, tiga.id).click()
    const staleResponse = page.waitForResponse((r) => isVerifyPost(r.url(), r.request().method()))
    await dialog.getByRole('button', { name: 'Sahkan', exact: true }).click()
    expect((await staleResponse).status(), 'second verify of the same teacher').toBe(404)
    remaining -= 1
    await expect(flashText(page)).toContainText(GONE_FLASH)
    await expect(flashText(page)).not.toContainText('Not Found')
    await expect(verifyButton(page, tiga.id)).toHaveCount(0)
    await expect(page.getByTestId('pt-found')).toHaveText(found(remaining))
    // Focus rule for the removed row: the row now at its position ("Empat").
    await expect(verifyButton(page, empat.id)).toBeFocused()

    // --- Step 5b: verify the LAST row -> focus on the previous row ("Dua") -------------------------------------
    await verifyButton(page, empat.id).click()
    await dialog.getByRole('button', { name: 'Sahkan', exact: true }).click()
    await expect(flashText(page)).toContainText(VERIFIED_FLASH)
    remaining -= 1
    await expect(verifyButton(page, empat.id)).toHaveCount(0)
    await expect(verifyButton(page, dua.id)).toBeFocused()

    // --- Step 5c: verify the only row -> empty state, focus on the h1 ----------------------------------------
    await verifyButton(page, dua.id).click()
    await dialog.getByRole('button', { name: 'Sahkan', exact: true }).click()
    await expect(flashText(page)).toContainText(VERIFIED_FLASH)
    remaining -= 1
    await expect(page.getByTestId('pt-found')).toHaveText(found(remaining))
    {
      const empty = page.getByTestId('pt-empty')
      await expect(empty).toContainText(EMPTY_TITLE)
      await expect(empty).toContainText(EMPTY_TEXT)
      await expect(page.getByTestId('pt-heading')).toBeFocused()
    }
    await expectNoHScroll(page)

    // --- Step 6: S7 lists the teachers as Aktif; the callout is gone when nothing is pending -----------------
    await gotoApi(page, LIST_PATH)
    await expect(page.getByTestId('pt-callout')).toHaveCount(0)
    for (const t of [satu, dua, tiga, empat]) {
      await gotoApi(page, `${LIST_PATH}?search=${encodeURIComponent(email(t.name.split(' ').pop()!.toLowerCase()))}`)
      // The search narrows the list to this teacher; the table and the cards variants differ in test ids only.
      await expect(page.getByText(t.name, { exact: true }).locator('visible=true').first()).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByRole('button', { name: 'Aktif', exact: true }).locator('visible=true').first()).toBeVisible()
    }

    // --- Isolation: the other school's teacher is still not in this admin's list ---------------------------
    expect((await listPending(page)).map((r) => r.name)).not.toContain(names.asing)
  })

  test('Admin Pusat gets the 403 page and API 403 on the pending list @api', async ({
    page,
  }) => {
    // Admin Pusat: in-place 403 page, API 403.
    const pusat = account('adminPusat')
    await loginViaUi(page, pusat.user, pusat.pass)
    await gotoApi(page, PENDING_PATH)
    await expect(page).toHaveTitle(FORBIDDEN_TITLE)
    expect(new URL(page.url()).pathname).toBe(PENDING_PATH)
    await expect(page.getByText('Akses Ditolak').first()).toBeVisible()
    await expect(page.getByTestId('pt-page')).toHaveCount(0)
    await expectNoHScroll(page)
    expect((await page.request.get('/api/admin-sekolah/guru/pending')).status()).toBe(403)
    expect(await verifyViaApi(page, '1')).toBe(403)
  })
})
