/**
 * M13 teacher screens S2 to S6, V1, V2 and the shell/404 cases at 375 / 768 / 1280 (M13-T3, M13-T4;
 * SRS M13 v1.1 §12: E2E-M13-01, 02, 04, 06 to 09, 31 to 52). The AI is simulated (D4): canned content.
 * Accounts: the admin (no records, no class) and 5 guru (`guru@demo.test`, designed records 13101 to
 * 13311). Tests that assert canned content, teacher data, roles or export layout are `@provisional`.
 */

import { readFile } from 'node:fs/promises'

import type { Locator, Page } from '@playwright/test'

import { expect as baseExpect, test } from '../fixtures/test'
import type { MockHandle } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

/** Slow machines: E2E_TIMEOUT_FACTOR multiplies the expect timeout (assertions unchanged). */
const TIMEOUT_FACTOR = Number(process.env.E2E_TIMEOUT_FACTOR) || 1
const expect = baseExpect.configure({ timeout: 10_000 * TIMEOUT_FACTOR })

const ADMIN = 'admin@demo.test'
const GURU = 'guru@demo.test'
const MODULE = { tag: [moduleTag(13)] }

// Cikgu Alesa is hidden unless the app is built with VITE_ALESA_AI=on (D73): every route 404s.
test.skip(process.env.VITE_ALESA_AI !== 'on', 'ALESA AI surfaces are hidden (D73)')
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'
const ESSAY_TEXT = 'Karangan contoh ini hanya untuk ujian dan ditulis dengan neutral. Ia bukan karangan sebenar sesiapa.'

test.use({ mockInit: { latency: 0 } })

async function latency(mock: MockHandle, ms: number): Promise<void> {
  await mock.config('m13.aiLatencyMs', ms)
}

const tid = (page: Page, id: string) => page.getByTestId(id)
const h1 = (page: Page) => page.getByTestId('shell-user-main').locator('h1')

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page="not-found"]')).toBeVisible({ timeout: 30_000 * TIMEOUT_FACTOR })
  await expectTabTitle(page, NOT_FOUND_TITLE)
  await expect(page.getByText('Halaman Tidak Dijumpai').first()).toBeVisible()
  await expect(page.getByText('Oops! An Error Occurred')).toHaveCount(0)
}

async function headerCase(th: Locator): Promise<string> {
  return th.evaluate((el) => getComputedStyle(el).textTransform)
}

/** The nav entries of the shell for the current viewport (sidebar at 1280, drawer below). */
async function navScope(page: Page): Promise<Locator> {
  if (isDesktopShell(page)) return tid(page, 'shell-user-sidebar')
  await tid(page, 'shell-user-hamburger').click()
  const drawer = tid(page, 'shell-user-drawer')
  await expect(drawer).toHaveClass(/\bopen\b/)
  return drawer
}

test.describe('M13 shell, 404 and routing', MODULE, () => {
  test('E2E-M13-01 admin menu: the M13 entries, badge and targets in the sidebar or the drawer @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    const nav = await navScope(page)
    for (const href of ['/cikgu', '/cikgu/rph', '/cikgu/essay', '/cikgu/pbd']) {
      await expect(nav.locator(`a[href="${href}"]`).first()).toBeVisible()
    }
    const chat = nav.locator('a[href="/cikgu"]').first()
    await expect(chat).toContainText('Cikgu Alesa')
    await expect(chat).toContainText('AI')
    if (isDesktopShell(page)) {
      await expect(nav.getByText('Cikgu Alesa Tools')).toBeVisible()
      await expect(nav.locator('[data-nav-id="pbd-auto-tag"]')).toHaveAttribute('href', '/cikgu/pbd')
    }
  })

  test('E2E-M13-02 the matching entries are active on /cikgu/pbd and on /cikgu @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/pbd')
    let nav = await navScope(page)
    await expect(nav.locator('a[href="/cikgu/pbd"]').first()).toHaveClass(/\bactive\b/)
    await expect(nav.locator('a[href="/cikgu"]').first()).toHaveClass(/\bactive\b/)
    await gotoApp('/cikgu')
    nav = await navScope(page)
    await expect(nav.locator('a[href="/cikgu"]').first()).toHaveClass(/\bactive\b/)
  })

  test('E2E-M13-04 bottom nav below 1024px: six entries, "Chat" opens the shell chatbot; hidden at 1280 @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/rph')
    const bottom = tid(page, 'shell-user-bottom-nav')
    if (isDesktopShell(page)) {
      await expect(bottom).toBeHidden()
      return
    }
    for (const label of ['Home', 'SPM', 'Game', 'Topik', 'Chat', 'Lagi']) {
      await expect(bottom).toContainText(label)
    }
    await page.evaluate(() => {
      const w = window as unknown as { __chatToggled: number }
      w.__chatToggled = 0
      window.addEventListener('toggle-chatbot', () => {
        w.__chatToggled += 1
      })
    })
    await bottom.locator('[data-nav-id="bottom-chat"]').click()
    await expect(page).toHaveURL(/\/cikgu\/rph$/)
    expect(
      await page.evaluate(() => (window as unknown as { __chatToggled: number }).__chatToggled),
    ).toBe(1)
  })

  test('E2E-M13-06 admin: unknown M13 paths and /cikgu-alesa show the 404 page @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const path of ['/cikgu-alesa', '/cikgu/unknown', '/cikgu/rph/1/edit', '/cikgu/rph/abc']) {
      await gotoApp(path)
      await expectNotFound(page)
    }
    const practice = page.getByRole('link', { name: 'Mula Latihan' })
    await expect(practice).toHaveAttribute('href', '/practice')
  })

  test('E2E-M13-07 admin: GET of the post-only paths is the 404 page, not a framework error @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const path of ['/cikgu/send', '/cikgu/pbd/rollup', '/cikgu/pbd/bulk-approve']) {
      await gotoApp(path)
      await expectNotFound(page)
    }
  })

  test(
    'E2E-M13-08 admin: another user record id is the 404 page and #4 / #6 answer 404 @m13',
    provisional('record ownership and the detail routes are INFERRED (BR-M13-01)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/cikgu/rph/13101')
      await expectNotFound(page)
      expect((await mock.lastRequest('/api/cikgu/rph/13101'))?.status).toBe(404)
      await gotoApp('/cikgu/essay/13201')
      await expectNotFound(page)
      expect((await mock.lastRequest('/api/cikgu/essays/13201'))?.status).toBe(404)
    },
  )

  test('E2E-M13-09 trailing slashes are dropped and ?classroom_id= is ignored @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/')
    await expect(page.locator('.cikgu-alesa-shell h1')).toHaveText('Cikgu Alesa')
    await gotoApp('/cikgu/rph/')
    await expect(h1(page)).toHaveText('📋 Rancangan Pengajaran Harian (RPH)')
    await gotoApp('/cikgu/rph/baharu?classroom_id=1')
    await expect(tid(page, 'rph-no-class')).toBeVisible()
    await expect(page.locator('#subject_name')).toHaveValue('')
    await gotoApp('/cikgu/pbd?classroom_id=1')
    await expect(tid(page, 'pbd-empty')).toBeVisible()
  })
})

test.describe('M13 S2 / S3 / V1 RPH', MODULE, () => {
  test('E2E-M13-31 admin S2: header, button, upper-case headers, empty row, pager variants @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/rph')
    await expect(h1(page)).toHaveText('📋 Rancangan Pengajaran Harian (RPH)')
    await expect(page.getByText('RPH yang dijana oleh Cikgu Alesa atau cikgu sendiri.')).toBeVisible()
    await expect(tid(page, 'rph-create')).toHaveAttribute('href', '/cikgu/rph/baharu')
    await expect(tid(page, 'rph-create')).toHaveText('Jana RPH Baharu')
    const heads = page.locator('[data-testid="rph-table"] th')
    await expect(heads).toHaveText(['Tarikh', 'Subjek / Level', 'Tajuk', 'Status', 'Tindakan'])
    expect(await headerCase(heads.first())).toBe('uppercase')
    await expect(tid(page, 'rph-empty')).toContainText('Belum ada RPH. Klik "Jana RPH Baharu"')
    await expect(tid(page, 'rph-empty').locator('em')).toHaveText(
      '"Tolong jana RPH untuk Matematik T4 Bab 3 esok"',
    )
    await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await gotoApp('/cikgu/rph?page=2')
    await expect(tid(page, 'rph-empty')).toBeVisible()
    const pager = page.locator('nav[aria-label="Pagination Navigation"]')
    await expect(pager).toBeVisible()
    if (isMobileWidth(page)) {
      await expect(pager.getByText('« Previous')).toBeVisible()
      await expect(pager.locator('a', { hasText: '« Previous' })).toHaveAttribute('href', /page=1/)
      await expect(pager.getByText('Next »')).toBeVisible()
    } else {
      await expect(pager.getByText('Showing 0 of 0 results')).toBeVisible()
      await expect(pager.locator('a[aria-label="Go to page 1"]')).toBeVisible()
    }
  })

  test(
    'E2E-M13-32 teacher S2: rows 13101 then 13102 with the designed values @m13',
    provisional('the rows and their layout are PROPOSED (FR-M13-36)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/rph')
      const rows = page.locator('[data-testid="rph-row"]')
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(0).locator('td')).toHaveText([
        '28/09/2026',
        'Kimia / T5',
        'Elektrolisis Larutan Akueus',
        'Dijana',
        'Lihat',
      ])
      await expect(rows.nth(1).locator('td')).toHaveText([
        '25/09/2026',
        'Sejarah / T5',
        'Ulang Kaji Bab 1',
        'Dijana',
        'Lihat',
      ])
      await expect(rows.nth(0).locator('a')).toHaveAttribute('href', '/cikgu/rph/13101')
      await expect(rows.nth(1).locator('a')).toHaveAttribute('href', '/cikgu/rph/13102')
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M13-33 admin S3: back link, no-class sentence, nine fields, defaults, info box @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/rph/baharu')
    await expect(tid(page, 'rph-back')).toHaveAttribute('href', '/cikgu/rph')
    await expect(h1(page)).toHaveText('Jana RPH dengan Cikgu Alesa')
    await expect(tid(page, 'rph-no-class')).toHaveText(
      'Sistem belum jumpa kelas yang dikaitkan dengan akaun Cikgu. Sila isi manual.',
    )
    const form = page.locator('#rph-create-form')
    await expect(form).not.toHaveAttribute('novalidate', /.*/)
    await expect(page.locator('#subject_name')).toHaveAttribute(
      'placeholder',
      'cth: Matematik, Sains, Bahasa Melayu',
    )
    await expect(page.locator('#subject_name')).toHaveAttribute('list', 'subject-list')
    await expect(page.locator('#level option')).toHaveCount(6)
    await expect(page.locator('#level option').nth(0)).toHaveText('— Pilih —')
    await expect(page.locator('#level option').nth(1)).toHaveText('Tingkatan 1')
    await expect(page.locator('#level option').nth(5)).toHaveText('Tingkatan 5')
    await expect(page.locator('#subject-list option')).toHaveCount(31)
    const names = await page.locator('#subject-list option').evaluateAll((els) =>
      els.map((e) => (e as HTMLOptionElement).value),
    )
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
    await page.locator('#subject_name').fill('Mata Pelajaran Bebas')
    await expect(page.locator('#subject_name')).toHaveValue('Mata Pelajaran Bebas')
    await expect(page.locator('#tajuk')).toHaveAttribute('maxlength', '200')
    await expect(page.locator('#tajuk')).toHaveAttribute(
      'placeholder',
      'cth: Pecahan Setara, Sel Sebagai Unit Asas Hidupan, Persamaan Kuadratik',
    )
    await expect(page.locator('#class_name')).toHaveAttribute('placeholder', 'cth: 4 Bestari')
    await expect(page.locator('#lesson_date')).toHaveValue('2026-09-25')
    await expect(page.locator('#duration_minutes')).toHaveValue('60')
    await expect(page.locator('#duration_minutes')).toHaveAttribute('min', '15')
    await expect(page.locator('#duration_minutes')).toHaveAttribute('max', '240')
    await expect(page.locator('#time_slot')).toHaveAttribute('placeholder', 'cth: 8.00-9.00 pagi')
    await expect(page.locator('#tema')).toHaveAttribute('placeholder', 'cth: Nombor & Operasi')
    await expect(page.locator('#pengajaran_keperluan')).toHaveAttribute('maxlength', '500')
    await page.locator('#pengajaran_keperluan').fill('k'.repeat(520))
    expect((await page.locator('#pengajaran_keperluan').inputValue()).length).toBe(500)
    await expect(tid(page, 'rph-info')).toContainText('📌 Apa yang Cikgu Alesa akan jana:')
    await expect(tid(page, 'rph-info').locator('li')).toHaveCount(4)
    await expect(page.getByText('⏱️ Proses ambil masa 10-30 saat. Sila tunggu.')).toBeVisible()
    await expect(page.locator('#submit-label')).toHaveText('Jana RPH dengan Cikgu Alesa')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M13-34 S3 "Batal" leaves without a confirm and the fields reset; columns per width @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/rph/baharu')
    let dialogs = 0
    page.on('dialog', async (d) => {
      dialogs += 1
      await d.dismiss()
    })
    const subject = page.locator('#subject_name')
    const level = page.locator('#level')
    const [sb, lb] = [await subject.boundingBox(), await level.boundingBox()]
    if (viewportWidth(page) < 768) expect(Math.abs(sb!.x - lb!.x)).toBeLessThan(2)
    else expect(Math.abs(sb!.y - lb!.y)).toBeLessThan(12)
    const kelas = await page.locator('#class_name').boundingBox()
    const tarikh = await page.locator('#lesson_date').boundingBox()
    if (viewportWidth(page) >= 768) expect(Math.abs(kelas!.y - tarikh!.y)).toBeLessThan(12)
    await subject.fill('Sains')
    await tid(page, 'rph-cancel').click()
    await expect(page).toHaveURL(/\/cikgu\/rph$/)
    await page.goBack()
    await expect(page.locator('#subject_name')).toHaveValue('')
    expect(dialogs).toBe(0)
  })

  test('E2E-M13-35 S3 empty submit marks the required fields invalid and sends nothing @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/rph/baharu')
    await page.locator('#submit-btn').click()
    const invalid = await page
      .locator('#rph-create-form')
      .evaluate((f) => Array.from(f.querySelectorAll(':invalid')).map((e) => e.id))
    expect(invalid).toEqual(['subject_name', 'level', 'tajuk'])
    await page.locator('#subject_name').fill('Matematik')
    await page.locator('#level').selectOption('T4')
    await page.locator('#tajuk').fill('Pecahan Setara')
    await page.locator('#duration_minutes').fill('10')
    await page.locator('#submit-btn').click()
    expect(await page.locator('#duration_minutes').evaluate((e) => (e as HTMLInputElement).validity.rangeUnderflow)).toBe(true)
    expect((await mock.requests('POST /api/cikgu/rph')).length).toBe(0)
    await expect(page).toHaveURL(/\/cikgu\/rph\/baharu$/)
  })

  test(
    'E2E-M13-36 teacher generates an RPH: busy label, then V1, then the list order @m13',
    provisional('the canned RPH content and its list position are PROPOSED (BR-M13-11, 13)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/rph/baharu')
      await latency(mock, 800 * TIMEOUT_FACTOR)
      await page.locator('#subject_name').fill('Matematik')
      await page.locator('#level').selectOption('T4')
      await page.locator('#tajuk').fill('Pecahan Setara')
      await page.locator('#pengajaran_keperluan').fill('Kelas mixed-ability.')
      await page.locator('#submit-btn').click()
      await expect(page.locator('#submit-label')).toHaveText('Cikgu Alesa sedang jana RPH…')
      await expect(page.locator('#submit-btn')).toBeDisabled()
      await expect(page.locator('#submit-btn')).toHaveClass(/opacity-60/)
      await expect(page).toHaveURL(/\/cikgu\/rph\/\d+$/)
      const id = Number(page.url().split('/').pop())
      expect(id).toBeGreaterThanOrEqual(9_000_001)
      await expect(h1(page)).toHaveText('📋 Rancangan Pengajaran Harian (RPH)')
      await expect(tid(page, 'rph-view-date')).toHaveText('25/09/2026')
      await expect(tid(page, 'rph-view-subject')).toHaveText('Matematik / T4')
      await expect(tid(page, 'rph-view-tajuk')).toHaveText('Pecahan Setara')
      await expect(tid(page, 'rph-view-status')).toHaveText('Dijana')
      const content = tid(page, 'rph-view-content')
      for (const part of [
        'Set Induksi (6 minit)',
        'Aktiviti 1 (15 minit)',
        'Aktiviti 2 (15 minit)',
        'Aktiviti 3 (15 minit)',
        'Penutup (9 minit)',
      ]) {
        await expect(content).toContainText(part)
      }
      expect(((await content.textContent()) ?? '').trim().endsWith('Keperluan Khas: Kelas mixed-ability.')).toBe(true)
      await expectNoHorizontalScroll(page)
      await gotoApp('/cikgu/rph')
      const rows = page.locator('[data-testid="rph-row"]')
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(0).locator('td').nth(1)).toHaveText('Kimia / T5')
      await expect(rows.nth(1).locator('td').nth(1)).toHaveText('Matematik / T4')
      await expect(rows.nth(2).locator('td').nth(1)).toHaveText('Sejarah / T5')
    },
  )

  test(
    'E2E-M13-37 teacher S3: the class select fills subject, level and class @m13',
    provisional('the teacher class branch of S3 is PROPOSED (FR-M13-39)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/rph/baharu')
      await expect(page.locator('#rph-class-pick')).toBeVisible()
      await expect(tid(page, 'rph-no-class')).toHaveCount(0)
      await expect(page.locator('label[for="rph-class-pick"]')).toHaveText('Kelas Saya')
      await expect(page.locator('#rph-class-pick option').first()).toHaveText('— Pilih —')
      await page.locator('#rph-class-pick').selectOption({ label: '5 MARIKH - Kimia' })
      await expect(page.locator('#subject_name')).toHaveValue('Kimia')
      await expect(page.locator('#level')).toHaveValue('T5')
      await expect(page.locator('#class_name')).toHaveValue('5 MARIKH - Kimia')
    },
  )

  test(
    'E2E-M13-38 teacher chat asks for an RPH: confirmation and a new list row; a vague request saves nothing @m13',
    provisional('the chat RPH tool and its parsing are INFERRED / PROPOSED (BR-M13-10)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu')
      await latency(mock, 0)
      const meta = page.locator('#cikgu-meta')
      await page.locator('#cikgu-input').fill('Tolong jana RPH untuk Matematik T4 Bab 3 esok')
      await page.locator('#cikgu-send').click()
      await expect(page.locator('#cikgu-history .cikgu-msg')).toHaveCount(3)
      await expect(page.locator('#cikgu-history .cikgu-msg').nth(2)).toContainText('Siap!')
      await expect(meta).toContainText('Tool hops: 1')
      await page.locator('#cikgu-input').fill('Tolong jana RPH')
      await page.locator('#cikgu-send').click()
      await expect(page.locator('#cikgu-history .cikgu-msg')).toHaveCount(5)
      await expect(page.locator('#cikgu-history .cikgu-msg').nth(4)).toContainText(
        'Boleh nyatakan subjek, tingkatan/tahun dan tajuk?',
      )
      await expect(meta).toContainText('Tool hops: 0')
      await gotoApp('/cikgu/rph')
      const rows = page.locator('[data-testid="rph-row"]')
      await expect(rows).toHaveCount(3)
      await expect(rows.nth(0).locator('td')).toContainText(['28/09/2026'])
      await expect(rows.nth(1).locator('td')).toHaveText([
        '26/09/2026',
        'Matematik / T4',
        'Bab 3',
        'Dijana',
        'Lihat',
      ])
      await expect(rows.nth(2).locator('td').first()).toHaveText('25/09/2026')
    },
  )

  test(
    'E2E-M13-39 teacher views V1 and V2; edit, print and bad ids are the 404 page @m13',
    provisional('the view pages and their content are PROPOSED (Q-M13-2)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/rph/13101')
      await expect(tid(page, 'rph-back')).toHaveText('← Senarai RPH')
      await expect(tid(page, 'rph-view-subject')).toHaveText('Kimia / T5')
      await expect(tid(page, 'rph-view-tajuk')).toHaveText('Elektrolisis Larutan Akueus')
      await expect(tid(page, 'rph-view-content')).toContainText('Objektif Pembelajaran')
      await expectNoHorizontalScroll(page)
      await gotoApp('/cikgu/essay/13201')
      await expect(h1(page)).toHaveText('📝 Marking Karangan AI')
      await expect(tid(page, 'essay-view-student')).toHaveText('Murid Demo 01')
      await expect(tid(page, 'essay-view-marks')).toHaveText('35/50')
      await expect(tid(page, 'essay-view-comment')).toContainText('Komen membina:')
      await expectNoHorizontalScroll(page)
      for (const path of ['/cikgu/rph/13101/print', '/cikgu/rph/abc', '/cikgu/essay/99999999']) {
        await gotoApp(path)
        await expectNotFound(page)
      }
    },
  )
})

test.describe('M13 S4 / S5 / V2 essay', MODULE, () => {
  test('E2E-M13-40 admin S4: header, button, upper-case headers, empty row, pager @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/essay')
    await expect(h1(page)).toHaveText('📝 Marking Karangan AI')
    await expect(
      page.getByText('Karangan yang dimark oleh Cikgu Alesa berdasarkan rubric SPM/PT3.'),
    ).toBeVisible()
    await expect(tid(page, 'essay-create')).toHaveAttribute('href', '/cikgu/essay/baharu')
    const heads = page.locator('[data-testid="essay-table"] th')
    await expect(heads).toHaveText(['Pelajar', 'Subjek / Rubric', 'Tajuk', 'Markah', 'Tindakan'])
    expect(await headerCase(heads.nth(3))).toBe('uppercase')
    await expect(tid(page, 'essay-empty')).toHaveText(
      'Belum ada karangan dimark. Klik "Mark Karangan Baharu" untuk mula.',
    )
    await expectNoHorizontalScroll(page)
    await gotoApp('/cikgu/essay?page=2')
    await expect(page.locator('nav[aria-label="Pagination Navigation"]')).toBeVisible()
    if (!isMobileWidth(page)) await expect(page.getByText('Showing 0 of 0 results')).toBeVisible()
  })

  test(
    'E2E-M13-41 teacher S4: rows 13202 then 13201 with marks and links @m13',
    provisional('the rows and their layout are PROPOSED (FR-M13-50)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/essay')
      const rows = page.locator('[data-testid="essay-row"]')
      await expect(rows).toHaveCount(2)
      await expect(rows.nth(0).locator('td')).toHaveText([
        'Murid Demo 02',
        'Sejarah / Sejarah — Karangan Esei',
        'Semangat Patriotisme',
        '14/20',
        'Lihat',
      ])
      await expect(rows.nth(1).locator('td')).toHaveText([
        'Murid Demo 01',
        'Bahasa Melayu / SPM Bahasa Melayu — Karangan (Bahagian B)',
        'Kepentingan Membaca',
        '35/50',
        'Lihat',
      ])
      await expect(rows.nth(0).locator('td').nth(3)).toHaveClass(/text-center/)
      await expect(rows.nth(0).locator('a')).toHaveAttribute('href', '/cikgu/essay/13202')
      await expect(rows.nth(1).locator('a')).toHaveAttribute('href', '/cikgu/essay/13201')
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M13-42 S5 default: labels, placeholders, six rubrics, no names, amber box, buttons @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/essay/baharu')
    await expect(tid(page, 'essay-back')).toHaveText('← Senarai')
    await expect(tid(page, 'essay-back')).toHaveAttribute('href', '/cikgu/essay')
    await expect(h1(page)).toHaveText('📝 Mark Karangan Baharu')
    await expect(page.getByText('Salin & tampal karangan pelajar di bawah.')).toBeVisible()
    const options = page.locator('#rubric_key option')
    await expect(options).toHaveCount(6)
    await expect(options.nth(0)).toHaveText('SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)')
    await expect(options.nth(5)).toHaveText('Rubric Am (default) (100 markah)')
    await expect(page.locator('#rubric_key')).toHaveValue('spm_bm_karangan')
    await expect(page.locator('#subject_name')).toHaveAttribute('placeholder', 'cth: Bahasa Melayu')
    await expect(page.locator('#level')).toHaveAttribute('placeholder', 'T4')
    await expect(page.locator('#essay_text')).toHaveAttribute('rows', '14')
    await expect(page.locator('#essay_text')).toHaveAttribute(
      'placeholder',
      'Salin & tampal karangan pelajar di sini…',
    )
    await expect(page.locator('#word-counter')).toHaveText('0 perkataan')
    expect(await page.locator('#essay-form [name]').count()).toBe(0)
    await expect(page.locator('#essay-form')).not.toHaveAttribute('action', /.*/)
    await expect(tid(page, 'essay-amber')).toContainText('Apa yang berlaku selepas klik:')
    await expect(page.locator('#essay-submit')).toHaveText('Hantar ke Cikgu Alesa')
    await expect(tid(page, 'essay-cancel')).toHaveAttribute('href', '/cikgu/essay')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M13-43 S5 counter, the 50-character rule and the hand-off URL @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/essay/baharu')
    await page.locator('#essay_text').fill('Satu dua')
    await expect(page.locator('#word-counter')).toHaveText('2 perkataan')
    await page.locator('#essay_text').fill('a b c d e')
    await expect(page.locator('#word-counter')).toHaveText('5 perkataan')
    const dialog = acceptNextDialog(page, {
      type: 'alert',
      message: 'Karangan terlalu pendek (minimum 50 aksara).',
    })
    await page.locator('#essay_text').fill('x'.repeat(49))
    await page.locator('#essay-submit').click()
    await dialog
    await expect(page).toHaveURL(/\/cikgu\/essay\/baharu$/)
    await page.locator('#rubric_key').selectOption('sejarah_essay')
    await page.locator('#subject_name').fill('Sejarah')
    await page.locator('#level').fill('T5')
    await page.locator('#student_name').fill('Murid Demo 03')
    await page.locator('#essay_title').fill('Semangat Patriotisme')
    await page.locator('#essay_text').fill(ESSAY_TEXT)
    await page.locator('#essay-submit').click()
    await expect(page).toHaveURL(
      /\/cikgu\?action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid\+Demo\+03&title=Semangat\+Patriotisme$/,
    )
    await expect(page.locator('#cikgu-input')).toHaveValue(
      'Tolong mark karangan ini menggunakan rubric Sejarah — Karangan Esei (20 markah). ' +
        'Subjek: Sejarah. Level: T5. Pelajar: Murid Demo 03. Tajuk: Semangat Patriotisme. ' +
        `Karangan: ${ESSAY_TEXT}`,
    )
    expect((await mock.requests('/api/cikgu/send')).length).toBe(0)
  })

  test('E2E-M13-44 S5: Enter does nothing, "Batal" leaves without a confirm, a reload resets @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/essay/baharu')
    let dialogs = 0
    page.on('dialog', async (d) => {
      dialogs += 1
      await d.dismiss()
    })
    await page.locator('#subject_name').fill('Sejarah')
    await page.locator('#subject_name').press('Enter')
    await expect(page).toHaveURL(/\/cikgu\/essay\/baharu$/)
    await page.locator('#rubric_key').selectOption('general')
    await page.locator('#essay_text').fill('a b c')
    await gotoApp('/cikgu/essay/baharu')
    await expect(page.locator('#rubric_key')).toHaveValue('spm_bm_karangan')
    await expect(page.locator('#word-counter')).toHaveText('0 perkataan')
    await tid(page, 'essay-cancel').click()
    await expect(page).toHaveURL(/\/cikgu\/essay$/)
    expect(dialogs).toBe(0)
  })
})

test.describe('M13 S6 PBD', MODULE, () => {
  test('E2E-M13-45 admin S6: header, select with the placeholder only, buttons, export href, empty row @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu/pbd')
    await expect(h1(page)).toHaveText('📊 PBD Auto-Tag — Antrian Semakan')
    await expect(page.getByText('AI cadangan Tahap Penguasaan (TP1-6)')).toBeVisible()
    await expect(page.locator('[data-testid="pbd-class"] option')).toHaveText(['Pilih kelas untuk rollup'])
    await expect(tid(page, 'pbd-class')).not.toHaveAttribute('required', /.*/)
    await expect(tid(page, 'pbd-rollup')).toHaveText('Jalankan Auto-Tag')
    await expect(tid(page, 'pbd-export')).toHaveText('Eksport CSV (Approved)')
    await expect(tid(page, 'pbd-export')).toHaveAttribute('href', '/cikgu/pbd/export.csv')
    await expect(tid(page, 'pbd-bulk')).toHaveText('Lulus pukal (TP cadangan)')
    await expect(page.getByText('Pilih semua')).toBeVisible()
    const heads = page.locator('[data-testid="pbd-table"] th')
    await expect(heads).toHaveText(['', 'Pelajar', 'SP', 'Skor', 'TP Cadangan', 'Tindakan'])
    expect(await headerCase(heads.nth(1))).toBe('uppercase')
    await expect(tid(page, 'pbd-empty')).toHaveText(
      'Tiada antrian semakan. Klik "Jalankan Auto-Tag" untuk scan aktiviti pelajar.',
    )
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M13-46 teacher S6: class options and nine pending rows in order @m13',
    provisional('the rows, SP labels and scores are PROPOSED / designed (FR-M13-64)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/pbd')
      await expect(page.locator('[data-testid="pbd-class"] option')).toHaveText([
        'Pilih kelas untuk rollup',
        '5 MARIKH - Kimia',
        '5 MARIKH - Sejarah',
      ])
      const rows = page.locator('[data-testid="pbd-row"]')
      await expect(rows).toHaveCount(9)
      const cells = async (i: number) => rows.nth(i).locator('td').allTextContents()
      expect((await cells(0)).map((t) => t.trim())).toEqual(['', 'Murid Demo 03', '1.1.1', '40.0%', 'TP3', '-'])
      expect((await cells(1)).map((t) => t.trim())).toEqual(['', 'Murid Demo 01', '5.1.1', '88.9%', 'TP5', '-'])
      expect((await cells(2)).map((t) => t.trim())).toEqual(['', 'Murid Demo 02', '5.1.1', '50.0%', 'TP3', '-'])
      expect((await cells(8)).map((t) => t.trim())).toEqual(['', 'Murid Demo 08', '5.1.1', '12.5%', 'TP1', '-'])
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M13-47 teacher rollup: a new correct answer moves Murid Demo 08 to 22.2% TP2; class 2002 adds no row for approved students @m13',
    provisional('rollup, scores and the M05 hook are PROPOSED / requested (XR-M13-03b)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/pbd')
      await expect(page.locator('[data-testid="pbd-row"]')).toHaveCount(9)
      await mock.hook('addAnswer', { userId: 3008, questionId: 700001, isCorrect: true })
      let dialogs = 0
      page.on('dialog', async (d) => {
        dialogs += 1
        await d.dismiss()
      })
      await tid(page, 'pbd-class').selectOption({ label: '5 MARIKH - Kimia' })
      await tid(page, 'pbd-rollup').click()
      const row8 = page.locator('[data-testid="pbd-row"]', { hasText: 'Murid Demo 08' })
      await expect(row8).toContainText('22.2%')
      await expect(row8).toContainText('TP2')
      await expect(page.locator('[data-testid="pbd-row"]')).toHaveCount(9)
      await expect(tid(page, 'pbd-class')).toHaveValue('')
      await tid(page, 'pbd-class').selectOption({ label: '5 MARIKH - Sejarah' })
      await tid(page, 'pbd-rollup').click()
      await expect(tid(page, 'pbd-class')).toHaveValue('')
      const sejarah = page.locator('[data-testid="pbd-row"]', { hasText: '1.1.1' })
      await expect(sejarah).toHaveCount(1)
      await expect(sejarah).toContainText('Murid Demo 03')
      expect(dialogs).toBe(0)
    },
  )

  test(
    'E2E-M13-48 teacher: "Pilih semua" by a real click, bulk approve of two rows, nothing ticked changes nothing @m13',
    provisional('the bulk approval and its queue are INFERRED (BR-M13-16)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/pbd')
      let dialogs = 0
      page.on('dialog', async (d) => {
        dialogs += 1
        await d.dismiss()
      })
      const checks = page.locator('.row-check')
      await expect(checks).toHaveCount(9)
      await page.locator('#select-all').check()
      for (let i = 0; i < 9; i++) await expect(checks.nth(i)).toBeChecked()
      await page.locator('#select-all').uncheck()
      for (let i = 0; i < 9; i++) await expect(checks.nth(i)).not.toBeChecked()
      await page
        .locator('[data-testid="pbd-row"]', { hasText: 'Murid Demo 01' })
        .filter({ hasText: '5.1.1' })
        .locator('.row-check')
        .check()
      await page
        .locator('[data-testid="pbd-row"]', { hasText: 'Murid Demo 02' })
        .locator('.row-check')
        .check()
      await tid(page, 'pbd-bulk').click()
      await expect(page.locator('[data-testid="pbd-row"]')).toHaveCount(7)
      await expect(page.locator('#select-all')).not.toBeChecked()
      await expect(page.locator('.row-check:checked')).toHaveCount(0)
      await tid(page, 'pbd-bulk').click()
      await expect(page.locator('[data-testid="pbd-row"]')).toHaveCount(7)
      expect(dialogs).toBe(0)
    },
  )

  for (const who of [GURU, ADMIN]) {
    test(`E2E-M13-49 S6 DOM (${who}): #bulk-form has no nested form and owns every row checkbox @m13`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(who)
      await gotoApp('/cikgu/pbd')
      await expect(page.locator('#bulk-form')).toBeVisible()
      if (who === GURU) await expect(page.locator('.row-check').first()).toBeVisible()
      const result = await page.evaluate(() => {
        const form = document.querySelector('#bulk-form') as HTMLFormElement
        return {
          nested: form.querySelectorAll('form').length,
          foreign: Array.from(document.querySelectorAll<HTMLInputElement>('.row-check')).filter(
            (c) => c.form !== form,
          ).length,
        }
      })
      expect(result).toEqual({ nested: 0, foreign: 0 })
    })
  }

  test(
    'E2E-M13-50 export: teacher file with the header and two approved lines; admin header only @m13',
    provisional('the CSV layout and the approved rows are PROPOSED (BR-M13-17)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu/pbd')
      await expect(tid(page, 'pbd-export')).toBeVisible()
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        tid(page, 'pbd-export').click(),
      ])
      expect(download.suggestedFilename()).toBe('pbd-approved.csv')
      const text = await readFile((await download.path()) as string, 'utf8')
      const lines = text.trim().split(/\r?\n/)
      expect(lines[0]).toBe('pelajar,kelas,sp,skor,tp,tarikh_lulus')
      expect(lines).toHaveLength(3)
    },
  )

  test(
    'E2E-M13-50b admin export: the header line only @m13',
    provisional('the CSV layout is PROPOSED (BR-M13-17)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp('/cikgu/pbd')
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        tid(page, 'pbd-export').click(),
      ])
      expect(download.suggestedFilename()).toBe('pbd-approved.csv')
      const text = await readFile((await download.path()) as string, 'utf8')
      expect(text.trim().split(/\r?\n/)).toEqual(['pelajar,kelas,sp,skor,tp,tarikh_lulus'])
    },
  )

  test(
    'E2E-M13-52 admin: rollup with the placeholder opens no dialog and leaves the queue empty @m13',
    provisional('the no-op rollup and its silence are PROPOSED (FR-M13-65)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/cikgu/pbd')
      let dialogs = 0
      page.on('dialog', async (d) => {
        dialogs += 1
        await d.dismiss()
      })
      await tid(page, 'pbd-rollup').click()
      await expect.poll(async () => (await mock.requests('POST /api/cikgu/pbd/rollup')).length).toBe(1)
      await expect(tid(page, 'pbd-empty')).toBeVisible()
      await expect(page.locator('[data-variant]')).toHaveCount(0)
      expect(dialogs).toBe(0)
    },
  )
})

test.describe('M13 responsive sweep', MODULE, () => {
  const screens: [string, string][] = [
    ['/cikgu', '.cikgu-alesa-shell'],
    ['/cikgu/rph', '[data-testid="rph-table"]'],
    ['/cikgu/rph/baharu', '#rph-create-form'],
    ['/cikgu/rph/13101', '[data-testid="rph-view-content"]'],
    ['/cikgu/essay', '[data-testid="essay-table"]'],
    ['/cikgu/essay/baharu', '#essay-form'],
    ['/cikgu/essay/13201', '[data-testid="essay-view-comment"]'],
    ['/cikgu/pbd', '[data-testid="pbd-table"]'],
    ['/cikgu/unknown', '[data-page="not-found"]'],
  ]
  for (const [path, ready] of screens) {
    test(`E2E-M13-51 ${path} has no page-level horizontal scroll @m13`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(GURU)
      await gotoApp(path)
      await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 * TIMEOUT_FACTOR })
      await expectNoHorizontalScroll(page)
      if (path === '/cikgu') {
        // S1: "Hantar" stays inside the card.
        const card = await page.locator('.cikgu-alesa-shell').boundingBox()
        const send = await page.locator('#cikgu-send').boundingBox()
        expect(send!.x + send!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
      }
    })
  }

  // S2 / S4 / S6: the table scrolls inside its card at 375 and "TINDAKAN" is reachable.
  for (const [path, table] of [
    ['/cikgu/rph', 'rph-table'],
    ['/cikgu/essay', 'essay-table'],
    ['/cikgu/pbd', 'pbd-table'],
  ] as const) {
    test(`E2E-M13-51 ${path} table scrolls inside its card @m13`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(GURU)
      await gotoApp(path)
      await expect(tid(page, table)).toBeVisible({ timeout: 30_000 * TIMEOUT_FACTOR })
      const dims = await page.evaluate((id) => {
        const el = document
          .querySelector(`[data-testid="${id}"]`)!
          .closest('.overflow-x-auto') as HTMLElement
        const before = el.scrollWidth - el.clientWidth
        el.scrollLeft = el.scrollWidth
        return { overflow: before }
      }, table)
      if (viewportWidth(page) <= 375) expect(dims.overflow).toBeGreaterThan(0)
      const box = await page.locator(`[data-testid="${table}"] th`).last().boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth(page) + 1)
    })
  }

  test('E2E-M13-51 S6 toolbar: stacked rows below 768, one row from 768; no added ARIA roles @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/cikgu/pbd')
    await expect(tid(page, 'pbd-class')).toBeVisible({ timeout: 30_000 * TIMEOUT_FACTOR })
    // Polled: the toolbar can still be settling right after the class list loads.
    await expect
      .poll(async () => {
        const sel = await tid(page, 'pbd-class').boundingBox()
        const btn = await tid(page, 'pbd-rollup').boundingBox()
        if (!sel || !btn) return false
        return viewportWidth(page) < 768
          ? btn.y > sel.y + sel.height - 2
          : Math.abs(btn.y - sel.y) < 20
      })
      .toBe(true)
    expect(await page.locator('#bulk-form [role], #rollup-form [role]').count()).toBe(0)
  })
})
