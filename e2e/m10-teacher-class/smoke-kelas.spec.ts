/**
 * M10 S4 `/guru/kelas`, S5 `/guru/kelas/cipta` and S35 (`/guru/kelas/:id` → 404) at 375 / 768 / 1280
 * (M10-T5; SRS M10 §12 E2E-M10-20..24 and the S4/S5/S35 part of 02 and 79). Accounts: 5 guru
 * (`guru@demo.test`), the admin, and the role refusals of SRS §9 (pelajar goes to its landing page,
 * a guest to /login). Populated cards, the QR copy and the 422 copy are PROPOSED / UNVERIFIED
 * (FR-M10-29, FR-M10-34); those tests are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { addInitSession } from '../fixtures/mock-page'
import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
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
/** The admin landing `/admin` (D48); the prototype scope redirects it on to the Command Center. */
const ADMIN_LANDING = /\/admin(\/command-center)?$/
/** Mock teacher with no class (id 5301): the observed empty state of S4/S5 (DV-M10-48: the admin no longer reaches them). */
const GURU_NO_CLASS = 'guru2@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

async function expectHeader(page: Page, title: string, subtitle: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(subtitle)
}

/**
 * Types `term`, then clicks the first result whose name matches `namePattern` and returns that name.
 * The canonical fixture school SMK DEMO is outside `/api/schools/search` (M02 v1.21), so the specs
 * pick a dataset school; its type is told by the name prefix (SEKOLAH KEBANGSAAN = SK, SEKOLAH MENENGAH = SMK).
 */
async function pickSchool(page: Page, term: string, namePattern: RegExp): Promise<string> {
  await page.getByTestId('school-search').fill(term)
  const results = page.getByTestId('school-result')
  await expect(results.first()).toBeVisible()
  const names = await results.locator('span:first-child').allTextContents()
  const index = names.findIndex((n) => namePattern.test(n.trim()))
  expect(index, 'a result matching ' + String(namePattern)).toBeGreaterThanOrEqual(0)
  await results.nth(index).click()
  return names[index]!.trim()
}

test.describe('M10 S4 Kelas Saya', MODULE, () => {
  test('SRS §12 #20 teacher with no class: "0 kelas aktif", create link, empty card @m10', async ({
    page,
    gotoApp,
  }) => {
    await addInitSession(page, GURU_NO_CLASS)
    await gotoApp('/guru/kelas')
    await expectTabTitle(page, 'Kelas Saya - Portal Guru')
    await expectHeader(page, 'Portal Guru', 'Urus kelas dan tugasan anda 🏫')
    await expect(page.getByRole('heading', { name: 'Kelas Saya' })).toHaveText('Kelas Saya')
    await expect(page.getByTestId('kelas-active-count')).toHaveText('0 kelas aktif')
    await expect(page.getByTestId('kelas-create')).toHaveAttribute('href', '/guru/kelas/cipta')
    await expect(page.getByTestId('kelas-create')).toHaveText('Cipta Kelas Baru')
    const empty = page.getByTestId('kelas-empty')
    await expect(empty).toContainText('Belum Ada Kelas')
    await expect(empty).toContainText('Cipta kelas pertama anda untuk memulakan pengajaran')
    await expect(page.getByTestId('kelas-empty-create')).toHaveAttribute(
      'href',
      '/guru/kelas/cipta',
    )
    await expectTouchTarget(page.getByTestId('kelas-create'))
    await expectNoHorizontalScroll(page)
  })

  test(
    'SRS §12 #21 guru: 2 kelas aktif, two cards, cards per row by width @m10',
    provisional('class cards are PROPOSED (FR-M10-29)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kelas')
      await expect(page.getByTestId('kelas-active-count')).toHaveText('2 kelas aktif')
      const cards = page.getByTestId('class-card')
      await expect(cards).toHaveCount(2)
      await expect(cards.nth(0).getByTestId('class-count')).toHaveText('8 pelajar')
      await expect(cards.nth(1).getByTestId('class-count')).toHaveText('8 pelajar')
      await expect(page.getByTestId('class-code')).toHaveText(['DMO101', 'DMO102'])
      const a = await cards.nth(0).boundingBox()
      const b = await cards.nth(1).boundingBox()
      if (isMobileWidth(page)) expect(Math.abs(a!.x - b!.x)).toBeLessThan(2)
      else expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
      await expectTouchTarget(cards.nth(0).getByTestId('class-qr'))
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #21 QR modal: spinner then name and school, canvas 192px, URL, copy, print, close @m10',
    provisional('QR button and card are PROPOSED; the join URL is PROPOSED (BR-M10-02)'),
    async ({ page, gotoApp, loginAs }) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.addInitScript(() => {
        ;(window as unknown as { __printed: number }).__printed = 0
        window.print = () => {
          ;(window as unknown as { __printed: number }).__printed += 1
        }
      })
      await loginAs(GURU)
      await gotoApp('/guru/kelas')
      await page.getByTestId('class-card').first().getByTestId('class-qr').click()
      await expect(page.getByTestId('quick-qr-modal')).toBeVisible()
      await expect(page.getByTestId('qr-name')).not.toHaveText('-')
      await expect(page.getByTestId('qr-school')).toHaveText('SMK DEMO')
      const canvas = page.getByTestId('qr-canvas')
      await expect(canvas).toBeVisible()
      const box = await canvas.boundingBox()
      expect(Math.round(box!.width)).toBe(192)
      expect(Math.round(box!.height)).toBe(192)
      const url = await page.getByTestId('qr-url').inputValue()
      expect(url).toMatch(/^https:\/\/prestasiplus\.my\/kelas-saya\?kod=DMO101$/)
      await expect(page.getByTestId('qr-url')).toHaveAttribute('readonly', '')
      await expectNoHorizontalScroll(page)

      const dialog = acceptNextDialog(page, { type: 'alert', message: 'Disalin!' })
      await page.getByTestId('qr-copy').click()
      await dialog
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url)

      await page.getByTestId('qr-print').click()
      expect(
        await page.evaluate(() => (window as unknown as { __printed: number }).__printed),
      ).toBe(1)

      await page.getByTestId('qr-close').click()
      await expect(page.getByTestId('quick-qr-modal')).toHaveCount(0)

      await page.getByTestId('class-card').first().getByTestId('class-qr').click()
      await expect(page.getByTestId('quick-qr-modal')).toBeVisible()
      await page.getByTestId('cmp-modal-backdrop').click({ position: { x: 4, y: 4 } })
      await expect(page.getByTestId('quick-qr-modal')).toHaveCount(0)
    },
  )
})

test.describe('M10 S5 Cipta Kelas', MODULE, () => {
  test('SRS §12 #22 fields, 31 subjects in id order, 11 tiles, no required radios @m10', async ({
    page,
    gotoApp,
  }) => {
    await addInitSession(page, GURU_NO_CLASS)
    await gotoApp('/guru/kelas/cipta')
    await expectTabTitle(page, 'Cipta Kelas - Portal Guru')
    await expectHeader(page, 'Cipta Kelas Baru', 'Isi butiran kelas anda')
    await expect(page.getByTestId('kelas-back')).toHaveAttribute('href', '/guru/kelas')
    await expect(page.getByTestId('kelas-back')).toContainText('Kembali')
    await expect(page.getByTestId('school-search')).toHaveAttribute(
      'placeholder',
      'Taip nama sekolah untuk cari...',
    )
    await expect(page.getByTestId('kelas-name')).toHaveAttribute('placeholder', 'cth: 5 Bestari')
    await expect(page.getByText('Nama kumpulan latih tubi anda.')).toBeVisible()
    const options = page.locator('[data-testid="kelas-subject"] option')
    await expect(options).toHaveCount(32)
    await expect(options.nth(0)).toHaveText('-- Pilih Subjek --')
    await expect(options.nth(1)).toHaveText('Bahasa Melayu')
    await expect(page.getByTestId('kelas-levels').getByRole('radio')).toHaveCount(11)
    await expect(page.getByTestId('kelas-levels')).toHaveAttribute('aria-required', 'false')
    await expect(
      page.locator('[data-testid="kelas-levels"] [role="radio"][aria-required="true"]'),
    ).toHaveCount(0)
    await expect(page.getByTestId('kelas-description')).toHaveAttribute(
      'placeholder',
      'Penerangan ringkas tentang kelas ini...',
    )
    await expect(page.getByText('Auto dari kelas sekolah')).toHaveCount(0)
    await expect(page.getByTestId('kelas-submit')).toHaveText('Cipta Kelas')
    await expectTouchTarget(page.getByTestId('kelas-submit'))
    // one column at 375: the tiles are 2 per row there, never overflowing
    await expectNoHorizontalScroll(page)
    if (viewportWidth(page) < 640) {
      const b = await page.getByTestId('kelas-name').boundingBox()
      expect(b!.width).toBeGreaterThan(280)
    }
  })

  test('SRS §12 #22 school search: 1 character no request, "de" results, "zzz" empty, tiles follow the school type @m10', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await addInitSession(page, GURU_NO_CLASS)
    await gotoApp('/guru/kelas/cipta')
    const input = page.getByTestId('school-search')
    await input.fill('d')
    await page.waitForTimeout(500)
    expect(await mock.requests('/api/schools/search')).toHaveLength(0)
    await expect(page.getByTestId('school-results')).toHaveCount(0)

    await input.fill('de')
    await expect(page.getByTestId('school-result').first()).toBeVisible()
    const reqs = await mock.requests('/api/schools/search')
    expect(reqs.length).toBeGreaterThan(0)
    expect(JSON.stringify(reqs[reqs.length - 1])).toContain('15')
    await expectNoHorizontalScroll(page)

    await input.fill('zzzzzz')
    await expect(page.getByTestId('school-none')).toHaveText('Tiada sekolah dijumpai')

    const smk = await pickSchool(page, 'SEKOLAH MENENGAH', /^SEKOLAH MENENGAH /)
    await expect(page.getByTestId('school-selected-name')).toHaveText(smk)
    await expect(page.getByTestId('kelas-levels').locator('[data-slot="label"]')).toHaveText([
      'Ting. 1',
      'Ting. 2',
      'Ting. 3',
      'Ting. 4',
      'Ting. 5',
    ])
    await page.getByTestId('school-clear').click()
    await expect(page.getByTestId('kelas-levels').getByRole('radio')).toHaveCount(11)

    await pickSchool(page, 'SEKOLAH KEBANGSAAN', /^SEKOLAH KEBANGSAAN /)
    await expect(page.getByTestId('kelas-levels').getByRole('radio')).toHaveCount(6)
    await expect(
      page.getByTestId('kelas-levels').locator('[data-slot="label"]').first(),
    ).toHaveText('Tahun 1')
  })

  test('SRS §12 #23 empty name: native validity message, no request @m10', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await addInitSession(page, GURU_NO_CLASS)
    await gotoApp('/guru/kelas/cipta')
    await page.getByTestId('kelas-submit').click()
    const valid = await page
      .getByTestId('kelas-name')
      .evaluate((el) => (el as HTMLInputElement).validity.valueMissing)
    expect(valid).toBe(true)
    expect(await mock.requests('/api/guru/classes')).toHaveLength(0)
    await expect(page).toHaveURL(/\/guru\/kelas\/cipta$/)
  })

  test(
    'SRS §12 #24 guru creates "5 Bestari" Kimia Ting. 5 at a secondary school: back on the list with a unique code @m10',
    provisional('the success flash and the card layout are UNVERIFIED / PROPOSED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/guru/kelas/cipta')
      await pickSchool(page, 'SEKOLAH MENENGAH', /^SEKOLAH MENENGAH /)
      await page.getByTestId('kelas-name').fill('5 Bestari')
      await page.getByTestId('kelas-subject').selectOption({ label: 'Kimia' })
      await page.getByTestId('kelas-level').filter({ hasText: 'Ting. 5' }).click()
      await page.getByTestId('kelas-submit').click()
      await expect(page).toHaveURL(/\/guru\/kelas$/)
      await expect(page.getByTestId('kelas-active-count')).toHaveText('3 kelas aktif')
      const card = page.getByTestId('class-card').filter({ hasText: '5 Bestari' })
      await expect(card).toHaveCount(1)
      await expect(card.getByTestId('class-subject')).toHaveText('Kimia')
      const code = (await card.getByTestId('class-code').textContent()) ?? ''
      expect(code).toMatch(/^[A-Z0-9]{6}$/)
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M10 S35 and role access', MODULE, () => {
  test('SRS §12 #02 /guru/kelas/:id and /edit render the 404 page @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    for (const path of ['/guru/kelas/2001', '/guru/kelas/2001/edit', '/guru/kelas/999999']) {
      await gotoApp(path)
      await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
      await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
      await expectNoHorizontalScroll(page)
    }
  })

  test('SRS §9 / DV-M10-48 the admin leaves /guru/kelas and /guru/kelas/cipta for its landing page @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru/kelas')
    await expect(page).not.toHaveURL(/\/guru\//)
    await expect(page).toHaveURL(ADMIN_LANDING)
    await gotoApp('/guru/kelas/cipta')
    await expect(page).not.toHaveURL(/\/guru\//)
    await expect(page).toHaveURL(ADMIN_LANDING)
  })

  test(
    'SRS §9 a guest is sent to /login; a pelajar leaves /guru/kelas for its landing page @m10',
    provisional('other roles on /guru/* are INFERRED (OQ-M10-08)'),
    async ({ page, gotoApp, loginAs }) => {
      await gotoApp('/guru/kelas')
      await expect(page).toHaveURL(/\/login$/)
      await loginAs(PELAJAR)
      await gotoApp('/guru/kelas/cipta')
      await expect(page).not.toHaveURL(/\/guru\//)
    },
  )
})
