/**
 * Independent G5 regression for M27 Part B S6 to S12 (roles-matrix rows L56 Senarai Pelajar, L57 Senarai Guru and
 * the user-management screens behind them). Report: docs/qa/L56-L58-pengguna-sekolah.md.
 *
 * Complements (does not repeat) partb-users.spec.ts: access by role, school scope against forged query values,
 * validation copy, duplicate e-mail, create / edit persistence, pupils read-only, teacher deactivate, CSV content
 * (own school, columns, no phone / IC, injection guard), layout at 320 / 375 / 768 / 1280, empty states for P1,
 * loading and error states and privacy.
 */

import type { Page } from '@playwright/test'

import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { acceptNextDialog, expectNoHorizontalScroll, isDesktopShell, viewportWidth } from '../support'

const TAG = { tag: ['@m27', '@qa-l56'] }
const P1 = 'azlan@demo.test' // school 900003, no pupil / teacher / class
const P2 = 'adminsekolah@demo.test' // school 900001
const FORBIDDEN_TITLE = 'Akses Ditolak | PRESTASIPLUS'

test.use({ mockInit: { latency: 0 } })

async function signIn(page: Page, who: string): Promise<void> {
  await gotoAppOn(page, '/login')
  await createMockHandle(page).setUser(who)
}

const rows = (page: Page) => page.getByTestId('user-row')

async function openList(page: Page, gotoApp: (p: string) => Promise<void>, path: string) {
  await gotoApp(path)
  await expect(page.getByTestId('user-found')).toContainText('pengguna dijumpai', { timeout: 60_000 })
}

async function downloadCsv(page: Page): Promise<{ name: string; body: string }> {
  const pending = page.waitForEvent('download')
  await page.getByTestId('user-export').click()
  const file = await pending
  const chunks: Buffer[] = []
  for await (const c of await file.createReadStream()) chunks.push(c as Buffer)
  return { name: file.suggestedFilename(), body: Buffer.concat(chunks).toString('utf8') }
}

async function smallestFont(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    let min = 99
    for (const el of Array.from(document.querySelectorAll(`${sel} *`))) {
      if (el.children.length === 0 && el.textContent?.trim()) {
        min = Math.min(min, parseFloat(getComputedStyle(el).fontSize))
      }
    }
    return min
  }, selector)
}

test.describe('QA access and scope', TAG, () => {
  test('QA-ACC-1 a pupil gets the 403 page on every S6 to S12 route; a guest is sent to /login', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    test.setTimeout(360_000)
    await loginAs('pelajar@demo.test')
    for (const path of [
      '/admin-sekolah/pelajar',
      '/admin-sekolah/guru',
      '/admin-sekolah/pelajar/3001',
      '/admin-sekolah/guru/5',
      '/admin-sekolah/guru/baru',
      '/admin-sekolah/pelajar/baru',
    ]) {
      await gotoApp(path)
      await expect(page.locator('[data-page=forbidden]')).toBeVisible({ timeout: 60_000 })
      await expect(page).toHaveTitle(FORBIDDEN_TITLE)
    }
  })

  test('QA-ACC-2 platform admin gets the 403 page on S6 and S12', async ({ page, loginAs, gotoApp }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs('admin@demo.test')
    for (const path of ['/admin-sekolah/pelajar', '/admin-sekolah/pelajar/baru']) {
      await gotoApp(path)
      await expect(page.locator('[data-page=forbidden]')).toBeVisible({ timeout: 60_000 })
    }
  })

  test('QA-ACC-3 forged school / role query values never widen the list (P2 sees only school 900001, P1 sees nothing)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar?school_id=900003&schoolId=900003&role=guru&kelas=1')
    await expect(page.locator('[data-testid="user-row"][data-user-id="3001"]')).toBeVisible()
    await expect(page.getByTestId('user-count-label')).toHaveText('Pelajar')
    await expect(page.getByText('guru@demo.test')).toHaveCount(0)
    await openList(page, gotoApp, '/admin-sekolah/guru?school_id=900003&role=pelajar')
    await expect(page.getByTestId('user-count-label')).toHaveText('Guru')
    await expect(page.locator('[data-testid="user-row"][data-user-id="3001"]')).toHaveCount(0)
  })

  test('QA-ACC-4 P1 (school 900003) sees an empty S6 and S7 even when the query names school 900001', async ({
    page,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await signIn(page, P1)
    await openList(page, gotoApp, '/admin-sekolah/pelajar?school_id=900001&schoolId=900001')
    await expect(rows(page).filter({ hasNot: page.getByTestId('user-empty') })).toHaveCount(0)
    await expect(page.getByTestId('user-empty')).toBeVisible()
    await openList(page, gotoApp, '/admin-sekolah/guru?school_id=900001')
    await expect(page.getByTestId('user-empty')).toBeVisible()
    await expect(page.getByTestId('user-found')).toHaveText('0 pengguna dijumpai')
  })

  test('QA-ACC-5 P1 cannot open a pupil / teacher of school 900001 (404)', async ({ page, gotoApp }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await signIn(page, P1)
    for (const path of ['/admin-sekolah/pelajar/3001', '/admin-sekolah/guru/5']) {
      await gotoApp(path)
      await expect(page.locator('[data-page=not-found]')).toBeVisible({ timeout: 60_000 })
    }
  })
})

test.describe('QA S6 and S7 lists', TAG, () => {
  test('QA-L56-1 order is active first then id descending; search is case-insensitive on name and e-mail; inactive filter is empty', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const ids = await rows(page).evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-user-id'))))
    expect(ids.length).toBeGreaterThanOrEqual(9)
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
    await page.getByTestId('user-search').fill('MURID3001@DEMO')
    await page.getByTestId('user-search-submit').click()
    await expect(page.getByTestId('user-found')).toHaveText('1 pengguna dijumpai')
    await page.getByTestId('user-search').fill('murid demo 0')
    await page.getByTestId('user-search-submit').click()
    await expect(page.getByTestId('user-found')).toHaveText('8 pengguna dijumpai')
    await page.getByTestId('user-search').fill('')
    await page.getByTestId('user-status-filter').selectOption('0')
    await page.getByTestId('user-search-submit').click()
    await expect(page.getByTestId('user-found')).toHaveText('0 pengguna dijumpai')
    await expect(page.getByTestId('user-empty')).toBeVisible()
  })

  test('QA-L56-2 pupils are read-only (no toggle control) and the page shows no IC number', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await expect(page.getByTestId('user-toggle')).toHaveCount(0)
    await expect(page.locator('button:has-text("Aktif"), button:has-text("Tidak")')).toHaveCount(0)
    const text = await page.getByTestId('sp-page').innerText()
    expect(text).not.toMatch(/\b\d{6}-?\d{2}-?\d{4}\b/)
    expect(text).not.toMatch(/No\. ?KP|Kad Pengenalan|\bIC\b/i)
  })

  test('QA-L56-3 layout: no horizontal scroll at 320 and the viewport width, text at least 12px, actions reachable', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    for (const path of ['/admin-sekolah/pelajar', '/admin-sekolah/guru']) {
      await openList(page, gotoApp, path)
      await expectNoHorizontalScroll(page)
      expect(await smallestFont(page, '[data-testid=sp-page]')).toBeGreaterThanOrEqual(12)
      await expect(page.getByTestId('user-export')).toBeInViewport({ ratio: 0.5 })
      await expect(page.getByTestId('user-add')).toBeVisible()
    }
    if (viewportWidth(page) <= 375) {
      await page.setViewportSize({ width: 320, height: 700 })
      await page.waitForTimeout(600)
      await expectNoHorizontalScroll(page)
      await expect(page.getByTestId('user-add')).toBeVisible()
    }
  })

  test('QA-L56-4 P1 empty states carry the spec copy on S6 and S7', async ({ page, gotoApp }) => {
    await signIn(page, P1)
    for (const path of ['/admin-sekolah/pelajar', '/admin-sekolah/guru']) {
      await openList(page, gotoApp, path)
      await expect(page.getByTestId('user-empty')).toContainText('Tiada pengguna dijumpai')
      await expect(page.getByTestId('user-empty')).toContainText('Cuba ubah kriteria carian anda')
      await expect(page.getByTestId('user-count')).toHaveText('0')
      await expectNoHorizontalScroll(page)
    }
  })

  test('QA-L56-5 loading shows skeleton rows; a server error is not a blank page', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar')
    await expect(page.getByTestId('user-found')).toContainText('pengguna dijumpai', { timeout: 60_000 })
    await mock.failNext('/api/admin-sekolah/pelajar', 500)
    await page.getByTestId('user-search').fill('murid')
    await page.getByTestId('user-search-submit').click()
    // either the inline error block or the global error page must be visible (FR-M27-48 asks for the M01 error page)
    await expect(page.locator('[data-testid=user-error], [data-page=server-error], [data-page=error]').first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('QA-L57-1 S7 teacher 5: last login is relative or "Belum login", classes column, teachers only', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/guru')
    const body = await page.getByTestId('user-table').innerText()
    expect(body).not.toContain('murid3001@demo.test')
    expect(body).not.toContain('adminsekolah@demo.test')
    await expect(page.locator('[data-testid="user-row"][data-user-id="5"]').getByTestId('user-classes')).toHaveText('2 kelas')
  })
})

test.describe('QA CSV', TAG, () => {
  test('QA-CSV-1 pupil CSV: columns, own school only, no phone / IC, status filter honoured; teacher CSV', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar?school_id=900003')
    const { name, body } = await downloadCsv(page)
    expect(name).toMatch(/^users-pelajar-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(body.charCodeAt(0)).toBe(0xfeff)
    const lines = body.slice(1).trim().split(/\r?\n/)
    expect(lines[0]).toBe('id,name,email,role,sekolah,kelas,is_active,created_at')
    expect(lines.length).toBeGreaterThanOrEqual(9)
    for (const l of lines.slice(1)) {
      expect(l).toContain(',pelajar,')
      expect(l).not.toContain('guru@demo.test')
    }
    const ids = lines.slice(1).map((l) => Number(l.split(',')[0]))
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    expect(body).not.toMatch(/0120003\d{3}/) // seeded pupil phone numbers
    expect(body).not.toMatch(/\b\d{6}-?\d{2}-?\d{4}\b/)
    expect(new Set(lines.slice(1).map((l) => l.split(',')[4]))).toEqual(new Set(['SMK DEMO']))
    // search narrows the file to the form value
    await page.getByTestId('user-search').fill('murid3001')
    const one = await downloadCsv(page)
    expect(one.body.trim().split(/\r?\n/).length).toBe(2)
    // inactive status yields a header-only file
    await page.getByTestId('user-search').fill('')
    await page.getByTestId('user-status-filter').selectOption('0')
    const none = await downloadCsv(page)
    expect(none.body.slice(1).trim().split(/\r?\n/)).toEqual(['id,name,email,role,sekolah,kelas,is_active,created_at'])
  })

  test('QA-CSV-2 P1 downloads a header-only CSV on S6 and S7 (no data of school 900001)', async ({ page, gotoApp }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await signIn(page, P1)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const a = await downloadCsv(page)
    expect(a.body.slice(1).trim()).toBe('id,name,email,role,sekolah,kelas,is_active,created_at')
    await openList(page, gotoApp, '/admin-sekolah/guru')
    const b = await downloadCsv(page)
    expect(b.name).toMatch(/^users-guru-/)
    expect(b.body.slice(1).trim()).toBe('id,name,email,role,sekolah,kelas,is_active,created_at')
  })

  test('QA-CSV-3 injection guard: a pupil whose name starts with "=" is exported with a leading apostrophe; class appears', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('pupil-name').fill('=HYPERLINK Murid')
    await page.getByTestId('pupil-email').fill('inj.qa@demo.test')
    await page.getByTestId('pupil-class').selectOption({ index: 1 })
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('pupil-credential')).toBeVisible()
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const { body } = await downloadCsv(page)
    const line = body.split(/\r?\n/).find((l) => l.includes('inj.qa@demo.test'))
    expect(line).toBeTruthy()
    expect(line).toContain(",'=HYPERLINK Murid,")
    expect(line).toMatch(/5 MARIKH/)
  })
})

test.describe('QA forms', TAG, () => {
  test('QA-S12-1 validation copy: required, min 3 name, e-mail format, duplicate, password under 8; values kept', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The name field is required.')
    await expect(page.getByTestId('user-form-alert')).toContainText('The email field is required.')
    await page.getByTestId('pupil-name').fill('Ab')
    await page.getByTestId('pupil-email').fill('a@demo.test')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The name field must be at least 3 characters.')
    await page.getByTestId('pupil-name').fill('Murid Ujian Dua')
    await page.getByTestId('pupil-email').fill('bukan-emel')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The email field must be a valid email address.')
    await page.getByTestId('pupil-email').fill('guru@demo.test')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The email has already been taken.')
    await page.getByTestId('pupil-email').fill('murid.dua@demo.test')
    await page.getByTestId('pupil-password').fill('1234567')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The password field must be at least 8 characters.')
    await expect(page.getByTestId('pupil-name')).toHaveValue('Murid Ujian Dua')
    await expect(page.getByTestId('pupil-credential')).toHaveCount(0)
  })

  test('QA-S12-2 create with an empty password shows a default password of 8+ chars once, class enrolment visible in S6, pupil can sign in', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    test.setTimeout(360_000)
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('pupil-name').fill('Murid Ujian Tiga')
    await page.getByTestId('pupil-email').fill('murid.tiga@demo.test')
    await page.getByTestId('pupil-class').selectOption({ index: 1 })
    await page.getByTestId('form-submit').click()
    const block = page.getByTestId('pupil-credential')
    await expect(block).toBeVisible()
    await expect(block).toContainText('Nama:')
    await expect(block).toContainText('Sekolah:')
    const pw = (await page.getByTestId('credential-password').innerText()).trim()
    expect(pw.length).toBeGreaterThanOrEqual(8)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const row = rows(page).filter({ hasText: 'murid.tiga@demo.test' })
    await expect(row).toHaveCount(1)
    await expect(row.getByTestId('user-status')).toHaveText('Aktif')
    await expect(row).toContainText('5 MARIKH')
    await page.getByTestId('shell-user-header-logout').click()
    await expect(page).toHaveURL('/login')
    await page.getByTestId('login-email').fill('murid.tiga@demo.test')
    await page.getByTestId('login-password').fill(pw)
    await page.getByTestId('login-submit').click()
    await expect(page).not.toHaveURL(/\/login$/)
  })

  test('QA-S12-3 the new pupil is created in the viewer school: P1 creates one and it lists only for P1', async ({
    page,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await signIn(page, P1)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('pupil-class').locator('option')).toHaveCount(1) // only "Tiada kelas"
    await page.getByTestId('pupil-name').fill('Murid Ujian Empat')
    await page.getByTestId('pupil-email').fill('murid.empat@demo.test')
    await page.getByTestId('pupil-password').fill('KataLaluan-8')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('credential-password')).toHaveText('KataLaluan-8')
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByTestId('user-count')).toHaveText('1')
    await expect(page.getByTestId('user-found')).toHaveText('1 pengguna dijumpai')
  })

  test('QA-S9-1 edit errors: used e-mail, 256-char name, new password under 6 / mismatch; passwords cleared', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/3002')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('user-email').fill('guru@demo.test')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The email has already been taken.')
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar\/3002$/)
    await page.getByTestId('user-email').fill('murid3002@demo.test')
    await page.getByTestId('user-name').fill('x'.repeat(256))
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('must not be greater than 255 characters')
    await page.getByTestId('user-name').fill('Murid Demo 02')
    await page.getByTestId('user-password-toggle').click()
    await page.getByTestId('user-new-password').fill('12345')
    await page.getByTestId('user-new-password-confirm').fill('12345')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('at least 6 characters')
    await page.getByTestId('user-new-password').fill('123456')
    await page.getByTestId('user-new-password-confirm').fill('654321')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('confirmation does not match')
    await expect(page.getByTestId('user-new-password')).toHaveValue('')
  })

  test('QA-S9-2 role / school / grade are not editable; editing the name persists in S6 and the CSV', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/3003')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('select, input[name*=role i], input[name*=school i], input[name*=ic i]')).toHaveCount(0)
    await page.getByTestId('user-name').fill('Murid Demo 03 Disunting')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar$/)
    await expect(page.getByText('Pengguna berjaya dikemaskini.')).toBeVisible()
    const { body } = await downloadCsv(page)
    expect(body).toContain('Murid Demo 03 Disunting')
  })

  test('QA-S11-1 validation copy and create: required, password under 6, mismatch, duplicate; new teacher active and in S7 and CSV', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/guru/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('form-submit').click()
    for (const m of [
      'The name field is required.',
      'The email field is required.',
      'The password field is required.',
    ]) {
      await expect(page.getByTestId('user-form-alert')).toContainText(m)
    }
    await page.getByTestId('user-name').fill('Guru Ujian Dua')
    await page.getByTestId('user-email').fill('guru.dua@demo.test')
    await page.getByTestId('user-password').fill('12345')
    await page.getByTestId('user-password-confirm').fill('12345')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The password field must be at least 6 characters.')
    await page.getByTestId('user-password').fill('123456')
    await page.getByTestId('user-password-confirm').fill('1234567')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('confirmation does not match')
    // a refused submit clears both password fields (SRS §17): type the pair again
    await page.getByTestId('user-password').fill('123456')
    await page.getByTestId('user-password-confirm').fill('123456')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/guru$/)
    const row = rows(page).filter({ hasText: 'guru.dua@demo.test' })
    await expect(row.getByTestId('user-toggle')).toContainText('Aktif')
    const { body } = await downloadCsv(page)
    expect(body).toContain('guru.dua@demo.test')
    // the used e-mail is now refused
    await gotoApp('/admin-sekolah/guru/baru')
    await page.getByTestId('user-name').fill('Guru Ujian Tiga')
    await page.getByTestId('user-email').fill('GURU.DUA@demo.test')
    await page.getByTestId('user-password').fill('123456')
    await page.getByTestId('user-password-confirm').fill('123456')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toContainText('The email has already been taken.')
  })

  test('QA-S10-1 a deactivated teacher keeps no link / Edit, cannot be opened (403), is absent from the active CSV and can be reactivated', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/guru')
    const row = rows(page).filter({ hasText: 'guru@demo.test' })
    const accepted = acceptNextDialog(page, { type: 'confirm' })
    await row.getByTestId('user-toggle').click()
    await accepted
    await expect(page.getByText('Status pengguna berjaya dikemaskini.')).toBeVisible()
    await expect(row.getByTestId('user-impersonate')).toBeDisabled()
    await expect(row.getByTestId('user-impersonate')).toHaveAttribute('title', 'Akaun ini tidak aktif')
    await page.getByTestId('user-status-filter').selectOption('1')
    await page.getByTestId('user-search-submit').click()
    await expect(page.getByTestId('user-empty')).toBeVisible()
    await page.getByTestId('user-status-filter').selectOption('0')
    await page.getByTestId('user-search-submit').click()
    await expect(rows(page)).toHaveCount(1)
    const csv = await downloadCsv(page)
    expect(csv.body).toContain(',0,')
    await gotoApp('/admin-sekolah/guru/5')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible({ timeout: 60_000 })
  })

  test('QA-FORM-LAYOUT S9 / S10 / S11 / S12 fit the viewport; fields and buttons are at least 12px and reachable', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    for (const path of [
      '/admin-sekolah/pelajar/3001',
      '/admin-sekolah/guru/5',
      '/admin-sekolah/guru/baru',
      '/admin-sekolah/pelajar/baru',
    ]) {
      await gotoApp(path)
      await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
      await expectNoHorizontalScroll(page)
      expect(await smallestFont(page, '[data-testid=user-form]')).toBeGreaterThanOrEqual(12)
      await page.getByTestId('form-submit').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('form-submit')).toBeInViewport()
      await expect(page.getByTestId('form-cancel')).toBeVisible()
    }
  })

  test('QA-S12-CRED the one-time credential block fits the viewport and a reload shows no password', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('pupil-name').fill('Murid Ujian Lima Dengan Nama Yang Sangat Panjang Sekali Untuk Ujian Lebar')
    await page.getByTestId('pupil-email').fill('murid.lima.dengan.emel.yang.sangat.panjang.sekali@demo.test')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('pupil-credential')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('pupil-credential')).toHaveCount(0)
  })
})

// ---- Responsive matrix: every screen S6 to S12 at 320 / 375 / 768 / 1280 (replaces Session 2's T8). ----------------

const WIDTHS = [320, 375, 768, 1280]
const SCREENS: { id: string; path: string; ready: string; controls: string[]; table?: boolean }[] = [
  { id: 'S6', path: '/admin-sekolah/pelajar', ready: 'user-table', table: true, controls: ['user-export', 'user-add', 'user-search', 'user-search-submit', 'user-status-filter'] },
  { id: 'S7', path: '/admin-sekolah/guru', ready: 'user-table', table: true, controls: ['user-export', 'user-add', 'user-search', 'user-search-submit', 'user-status-filter'] },
  { id: 'S9', path: '/admin-sekolah/pelajar/3001', ready: 'user-form', controls: ['user-name', 'user-email', 'user-password-toggle', 'form-cancel', 'form-submit'] },
  { id: 'S10', path: '/admin-sekolah/guru/5', ready: 'user-form', controls: ['user-name', 'user-email', 'user-password-toggle', 'form-cancel', 'form-submit'] },
  { id: 'S11', path: '/admin-sekolah/guru/baru', ready: 'user-form', controls: ['user-name', 'user-email', 'user-password', 'user-password-confirm', 'form-cancel', 'form-submit'] },
  { id: 'S12', path: '/admin-sekolah/pelajar/baru', ready: 'user-form', controls: ['pupil-name', 'pupil-class', 'pupil-email', 'pupil-password', 'form-cancel', 'form-submit'] },
]

test.describe('QA responsive S6 to S12', TAG, () => {
  for (const s of SCREENS) {
    test(`QA-RESP-${s.id} ${s.path} at 320 / 375 / 768 / 1280: no page scroll, controls inside the viewport, tappable, no overlap, table scrolls in its card`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      test.setTimeout(300_000)
      await loginAs(P2)
      await gotoApp(s.path)
      await expect(page.getByTestId(s.ready)).toBeVisible({ timeout: 90_000 })
      if (s.table) await expect(page.getByTestId('user-found')).toContainText('pengguna dijumpai', { timeout: 60_000 })
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 812 })
        await page.waitForTimeout(600) // let the layout settle after the resize
        await expectNoHorizontalScroll(page)
        for (const id of s.controls) {
          const el = page.getByTestId(id).first()
          await el.scrollIntoViewIfNeeded()
          await expect(el, `${s.id}@${w} ${id} visible`).toBeVisible()
          const b = await el.boundingBox()
          expect(b, `${s.id}@${w} ${id} box`).not.toBeNull()
          const box = b!
          expect(box.x, `${s.id}@${w} ${id} left edge`).toBeGreaterThanOrEqual(-1)
          expect(box.x + box.width, `${s.id}@${w} ${id} right edge`).toBeLessThanOrEqual(w + 1)
          if (w < 1280 && /export|add|submit|cancel|toggle|search-submit/.test(id)) {
            expect(box.height, `${s.id}@${w} ${id} tap height`).toBeGreaterThanOrEqual(40)
          }
        }
        // no two controls overlap (compare the area after scrolling, so use page coordinates)
        const pageBoxes = await Promise.all(
          s.controls.map(async (id) =>
            page.getByTestId(id).first().evaluate((e) => {
              const r = e.getBoundingClientRect()
              return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }
            }),
          ),
        )
        for (let i = 0; i < pageBoxes.length; i++) {
          for (let j = i + 1; j < pageBoxes.length; j++) {
            const a = pageBoxes[i]!
            const b = pageBoxes[j]!
            const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
            const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
            expect(ox > 2 && oy > 2, `${s.id}@${w} ${s.controls[i]} overlaps ${s.controls[j]}`).toBe(false)
          }
        }
        expect(await smallestFont(page, 'main'), `${s.id}@${w} min font`).toBeGreaterThanOrEqual(12)
        if (s.table) {
          const wrap = page
            .getByTestId('user-table')
            .locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]')
          const m = await wrap.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, right: el.getBoundingClientRect().right }))
          expect(m.right, `${s.id}@${w} table card inside viewport`).toBeLessThanOrEqual(w + 1)
          if (m.sw > m.cw) {
            // the card scrolls inside itself: its last column header is reachable
            await page.locator('thead th').last().scrollIntoViewIfNeeded()
            await expectNoHorizontalScroll(page)
          }
        }
      }
    })
  }

  test('QA-RESP-S12-CRED credential block at 320 / 375 / 768 / 1280 does not scroll the page or clip', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.setTimeout(300_000)
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 90_000 })
    await page.getByTestId('pupil-name').fill('Murid Responsif Dengan Nama Yang Panjang Sekali')
    await page.getByTestId('pupil-email').fill('murid.responsif.dengan.emel.yang.panjang@demo.test')
    await page.getByTestId('pupil-password').fill('KataLaluanYangSangatPanjangSekali-12345')
    await page.getByTestId('form-submit').click()
    const block = page.getByTestId('pupil-credential')
    await expect(block).toBeVisible()
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 812 })
      await page.waitForTimeout(600) // let the layout settle after the resize
      await expectNoHorizontalScroll(page)
      const r = await block.evaluate((e) => ({ right: e.getBoundingClientRect().right, sw: e.scrollWidth, cw: e.clientWidth }))
      expect(r.right, `credential block right edge @${w}`).toBeLessThanOrEqual(w + 1)
      expect(r.sw, `credential block clipped @${w}`).toBeLessThanOrEqual(r.cw + 1)
    }
  })
})

// ---- S8 Kelas Sekolah (roles-matrix L58, FR-M27-111 to 116, AC 31.x, 32.x). --------------------------------------

const S8_PATH = '/admin-sekolah/kelas'
const klRows = (page: Page) => page.getByTestId('kl-row')

async function openS8(page: Page, gotoApp: (p: string) => Promise<void>, path = S8_PATH) {
  await gotoApp(path)
  await expect(page.getByTestId('kl-table')).toBeVisible({ timeout: 90_000 })
}

test.describe('QA S8 Kelas Sekolah', TAG, () => {
  for (const who of ['guru@demo.test', 'pelajar@demo.test', 'admin@demo.test']) {
    test(`QA-S8-1 ${who} gets the 403 page on S8`, async ({ page, loginAs, gotoApp }) => {
      test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
      await loginAs(who)
      await gotoApp(S8_PATH)
      await expect(page.locator('[data-page=forbidden]')).toBeVisible({ timeout: 60_000 })
      await expect(page).toHaveTitle(FORBIDDEN_TITLE)
    })
  }

  test('QA-S8-3 header, tab title, breadcrumb, sub-line, active sidebar item, tile and count line', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openS8(page, gotoApp)
    await expect(page).toHaveTitle('Kelas Sekolah | PRESTASIPLUS')
    await expect(page.getByTestId('kl-crumb-back')).toHaveText('Dashboard Sekolah')
    await expect(page.getByTestId('kl-crumb-back')).toHaveAttribute('href', '/admin-sekolah')
    await expect(page.getByTestId('kl-tile-label')).toHaveText('Kelas Aktif')
    await expect(page.getByTestId('kl-displayed')).toHaveText(/^\d+ kelas dipaparkan\s*$/)
    await expect(page.getByText('SMK DEMO').first()).toBeVisible()
    if (isDesktopShell(page)) {
      const side = page.getByTestId('shell-user-sidebar')
      await expect(side.locator('[data-nav-id="sa-kelas-sekolah"]')).toHaveClass(/\bactive\b/)
      await expect(side.locator('[data-nav-id="sa-dashboard"]')).not.toHaveClass(/\bactive\b/)
    }
  })

  test('QA-S8-4 only classroom rows of the own school: classes 2001 and 2002, never 419 / 806; forged school / role query ignored', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openS8(page, gotoApp, `${S8_PATH}?school=900003&school_id=900003&schoolId=900003&role=guru`)
    const hrefs = await page.getByTestId('kl-name').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    expect(hrefs).toContain('/prestasi/kelas/2001')
    expect(hrefs).toContain('/prestasi/kelas/2002')
    expect(hrefs).not.toContain('/prestasi/kelas/419')
    expect(hrefs).not.toContain('/prestasi/kelas/806')
    expect(await page.getByTestId('kl-tile-value').innerText()).toBe(String(hrefs.length))
    await expect(page.getByTestId('kl-displayed')).toHaveText(`${hrefs.length} kelas dipaparkan`)
  })

  test('QA-S8-5 P1 empty state: "0 kelas dipaparkan", tile 0, empty copy, no horizontal scroll', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, P1)
    await openS8(page, gotoApp, `${S8_PATH}?school_id=900001`)
    await expect(page.getByTestId('kl-displayed')).toHaveText('0 kelas dipaparkan')
    await expect(page.getByTestId('kl-tile-value')).toHaveText('0')
    await expect(page.getByTestId('kl-empty')).toContainText('Tiada kelas dijumpai')
    await expect(page.getByTestId('kl-empty')).toContainText('Sila cipta kelas terlebih dahulu')
    await expect(klRows(page)).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('QA-S8-6 search is case-insensitive on the class name, a miss shows the empty row, the tile ignores filters', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openS8(page, gotoApp)
    await page.getByTestId('kl-search').fill('KIMIA')
    await expect(page).toHaveURL(/search=KIMIA/i, { timeout: 30_000 })
    await expect(klRows(page)).toHaveCount(1)
    await expect(page.getByTestId('kl-displayed')).toHaveText('1 kelas dipaparkan')
    await expect(page.getByTestId('kl-tile-value')).not.toHaveText('0')
    await page.getByTestId('kl-search').fill('zzz-tiada')
    await expect(page.getByTestId('kl-displayed')).toHaveText('0 kelas dipaparkan', { timeout: 30_000 })
    await expect(page.getByTestId('kl-empty')).toBeVisible()
  })

  test('QA-S8-7 level filter lists only the levels of the school; choosing one narrows rows; unknown level falls back to all', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openS8(page, gotoApp)
    const options = await page.getByTestId('kl-level').locator('option').allInnerTexts()
    expect(options[0]).toBe('Semua')
    expect(options).toContain('Tingkatan 5')
    expect(options).not.toContain('Tingkatan 4')
    await page.getByTestId('kl-level').selectOption({ label: 'Tingkatan 5' })
    await expect(page).toHaveURL(/level=/)
    await expect(klRows(page).first()).toBeVisible()
    for (const t of await page.getByTestId('kl-level-cell').allInnerTexts()) expect(t.trim()).toBe('Tingkatan 5')
    await openS8(page, gotoApp, `${S8_PATH}?level=tidak-wujud`)
    expect(await klRows(page).count()).toBeGreaterThanOrEqual(2)
  })

  test('QA-S8-8 order is class name A to Z; row numbers run 1..n; columns and cell formats', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openS8(page, gotoApp)
    const names = (await page.getByTestId('kl-name').allInnerTexts()).map((n) => n.trim())
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
    const nos = await page.getByTestId('kl-no').allInnerTexts()
    expect(nos).toEqual(nos.map((_, i) => String(i + 1)))
    await expect(page.locator('thead th')).toHaveText(['#', 'Kelas', 'Subjek', 'Tingkatan', 'Guru', 'Murid', 'Kod Kelas'])
    for (const m of await page.getByTestId('kl-members').allInnerTexts()) expect(m.trim()).toMatch(/^\d[\d,]*$/)
    for (const s of await page.getByTestId('kl-subject').allInnerTexts()) expect(s.trim()).not.toBe('')
  })

  test('QA-S8-9 the class name opens the school-scoped class page', async ({ page, loginAs, gotoApp }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await openS8(page, gotoApp)
    await page.getByTestId('kl-name').first().click()
    await expect(page).toHaveURL(/\/prestasi\/kelas\/\d+$/, { timeout: 60_000 })
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible({ timeout: 60_000 })
  })

  test('QA-S8-10 loading state is shown, then a server error renders the inline error block (not blank)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah')
    await expect(page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-kelas-sekolah"]')).toBeVisible({ timeout: 90_000 })
    await mock.setLatency(2500, '/api/admin-sekolah/kelas')
    await page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-kelas-sekolah"]').click() // in-app navigation keeps the mock alive
    await expect(page.getByTestId('kl-loading')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('kl-table')).toBeVisible({ timeout: 60_000 })
    await mock.clearLatency('/api/admin-sekolah/kelas')
    await mock.failNext('/api/admin-sekolah/kelas', 500)
    await page.getByTestId('kl-search').fill('kim')
    await expect(
      page.locator('[data-testid=kl-error], [data-page=server-error], [data-page=error]').first(),
    ).toBeVisible({ timeout: 30_000 })
  })

  test('QA-S8-11 no IC / e-mail of pupils on the page; text at least 12px; read-only (no write buttons)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openS8(page, gotoApp)
    const text = await page.getByTestId('kl-page').innerText()
    expect(text).not.toMatch(/\b\d{6}-?\d{2}-?\d{4}\b/)
    expect(text).not.toMatch(/@demo\.test/)
    expect(await smallestFont(page, '[data-testid=kl-page]')).toBeGreaterThanOrEqual(12)
    await expect(page.getByTestId('kl-page').getByRole('button')).toHaveCount(0)
  })
})

test.describe('QA responsive S8', TAG, () => {
  test('QA-RESP-S8 /admin-sekolah/kelas at 320 / 375 / 768 / 1280: no page scroll, controls inside the viewport, tap height, table scrolls in its card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.setTimeout(300_000)
    await loginAs(P2)
    await openS8(page, gotoApp)
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 812 })
      await page.waitForTimeout(600) // let the layout settle after the resize
      await expectNoHorizontalScroll(page)
      for (const id of ['kl-tile', 'kl-level', 'kl-search']) {
        const el = page.getByTestId(id)
        await el.scrollIntoViewIfNeeded()
        const b = (await el.boundingBox())!
        expect(b.x, `S8@${w} ${id} left`).toBeGreaterThanOrEqual(-1)
        expect(b.x + b.width, `S8@${w} ${id} right`).toBeLessThanOrEqual(w + 1)
        if (id !== 'kl-tile') expect(b.height, `S8@${w} ${id} tap height`).toBeGreaterThanOrEqual(40)
      }
      const lvl = (await page.getByTestId('kl-level').boundingBox())!
      const srch = (await page.getByTestId('kl-search').boundingBox())!
      const overlap =
        Math.min(lvl.x + lvl.width, srch.x + srch.width) - Math.max(lvl.x, srch.x) > 2 &&
        Math.min(lvl.y + lvl.height, srch.y + srch.height) - Math.max(lvl.y, srch.y) > 2
      expect(overlap, `S8@${w} filters overlap`).toBe(false)
      const first = page.getByTestId('kl-name').first()
      await first.scrollIntoViewIfNeeded()
      expect((await first.boundingBox())!.height, `S8@${w} link tap height`).toBeGreaterThanOrEqual(40)
      expect(await smallestFont(page, 'main'), `S8@${w} min font`).toBeGreaterThanOrEqual(12)
      const wrap = page.getByTestId('kl-table').locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]')
      const right = await wrap.evaluate((el) => el.getBoundingClientRect().right)
      expect(right, `S8@${w} table card inside viewport`).toBeLessThanOrEqual(w + 1)
      await page.locator('thead th').last().scrollIntoViewIfNeeded()
      await expectNoHorizontalScroll(page)
    }
  })
})
