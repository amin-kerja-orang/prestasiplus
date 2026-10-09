/**
 * M22 "Tiket Bantuan" S1 `/pusat-tuisyen/tiket` and S2 `/admin/tiket` at 375 / 768 / 1280 (SRS M22 v1.1 §12:
 * E2E-M22-01…45). Clock 2026-09-25T15:40:00+08:00. Profiles through the override `ticketsProfile` (the key
 * `profile` belongs to M02), hooks through `mock.hook`.
 *
 * Not run here as E2E: E2E-M22-15, 16, 36 are "request only" (the mock transport lives in the app, so the raw
 * API is not reachable from the test): covered by `src/modules/m22-support-tickets/__tests__/mock/tickets.test.ts`.
 * E2E-M22-38, 39, 40 (`@provisional`): the notification counts are not readable from the UI as a delta (the
 * seeded admin inbox is large and the bell caps at 99+); covered by the same handler test. Declared below as
 * skipped tests with that reason.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, provisional, viewportWidth } from '../support'

const MODULE = { tag: ['@m22'] }
const PATH = '/pusat-tuisyen/tiket'
const QUEUE = '/admin/tiket'
const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const PELAJAR3 = 'pelajarmaju@demo.test'
const GURU = 'guru@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const NOT_FOUND_COPY =
  'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?'
const FLASH = 'Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.'
const EXTRA = { mockInit: { latency: 0, overrides: { ticketsProfile: 'tickets-extra' } } }
const MANY = { mockInit: { latency: 0, overrides: { ticketsProfile: 'tickets-many' } } }

test.use({ mockInit: { latency: 0 } })

const cards = (page: Page) => page.getByTestId('tk-card')
const cardOf = (page: Page, id: number) => cards(page).filter({ hasText: `#${String(id)} —` })

async function openS1(page: Page, gotoApp: (p: string) => Promise<void>, path = PATH) {
  await gotoApp(path)
  await expect(page.getByTestId('tk-page')).toBeVisible()
  await expect(page.getByTestId('tk-loading')).toHaveCount(0)
}

async function openS2(page: Page, gotoApp: (p: string) => Promise<void>, path = QUEUE) {
  await gotoApp(path)
  await expect(page.getByTestId('tq-page')).toBeVisible()
  await expect(page.getByTestId('tq-chips')).toBeVisible()
}

async function fontSizesOk(root: Locator): Promise<void> {
  const small = await root.evaluate((el) => {
    const bad: string[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!(n.textContent ?? '').trim()) continue
      const parent = n.parentElement
      if (parent && parseFloat(getComputedStyle(parent).fontSize) < 12) {
        bad.push(`${parent.tagName}:${(n.textContent ?? '').trim().slice(0, 20)}`)
      }
    }
    return bad
  })
  expect(small).toEqual([])
}

test.describe('S1 list', MODULE, () => {
  test('E2E-M22-01 header, subtitle', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp)
    await expect(page.getByTestId('shell-user-title')).toHaveText('Tiket Bantuan')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
      'Senarai aduan dan permintaan anda',
    )
    if (viewportWidth(page) >= 1280) {
      await expect(page.getByTestId('shell-user-sidebar')).toBeVisible()
    }
  })

  test(
    'E2E-M22-01 (provisional part) tab title and the active sidebar item',
    provisional(
      'tab title is PROPOSED, sidebar-active state is INFERRED (SRS E2E-M22-01)',
      MODULE.tag,
    ),
    async ({ page, loginAs, gotoApp }) => {
      test.skip(viewportWidth(page) < 1280, 'sidebar at 1280 only')
      await loginAs(PELAJAR2)
      await openS1(page, gotoApp)
      await expectTabTitle(page, 'Tiket Bantuan - PRESTASIPLUS')
      await expect(
        page.getByTestId('shell-user-sidebar').locator('[data-nav-id="tiket-bantuan"]'),
      ).toHaveClass(/\bactive\b/)
    },
  )

  test('E2E-M22-02 one card with count, title, body, time, badge, not a link', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp)
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
    await expect(cards(page)).toHaveCount(1)
    const card = cardOf(page, 1)
    await expect(card.locator('h3')).toHaveText('#1 — Tidak dapat log masuk ke akaun')
    await expect(card).toContainText(
      'Saya cuba log masuk tetapi sistem tidak menerima kata laluan saya.',
    )
    await expect(card.getByTestId('tk-time')).toHaveText('1 hari yang lepas')
    await expect(card.getByTestId('tk-badge')).toHaveText('Dibuka')
    await expect(card.getByTestId('tk-badge')).toHaveClass(/bg-red-100/)
    await expect(card.locator('a')).toHaveCount(0)
    const url = page.url()
    await card.click()
    expect(page.url()).toBe(url)
  })

  test.describe('tickets-extra', () => {
    test.use(EXTRA)

    test('E2E-M22-03 six cards #8…#3 with badge colours, no pagination', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(PELAJAR)
      await openS1(page, gotoApp)
      await expect(cards(page)).toHaveCount(6)
      const ids = await cards(page).locator('h3').allInnerTexts()
      expect(ids.map((t) => t.split(' ')[0])).toEqual(['#8', '#7', '#6', '#5', '#4', '#3'])
      const badges = await cards(page).getByTestId('tk-badge').allInnerTexts()
      expect(badges).toEqual([
        'Dibuka',
        'Ditutup',
        'Selesai',
        'Menunggu Balas',
        'Dalam Proses',
        'Dibuka',
      ])
      const classes = ['red', 'slate', 'green', 'blue', 'amber', 'red']
      for (const [i, c] of classes.entries()) {
        await expect(cards(page).nth(i).getByTestId('tk-badge')).toHaveClass(new RegExp(`bg-${c}-`))
      }
      await expect(page.locator('nav[aria-label*="agination"]')).toHaveCount(0)
    })

    test('E2E-M22-04 the long body is clamped to 2 lines', async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await openS1(page, gotoApp)
      const body = cardOf(page, 8).getByTestId('tk-body')
      const clamp = await body.evaluate((el) => getComputedStyle(el).webkitLineClamp)
      expect(clamp).toBe('2')
      const lines = await body.evaluate((el) => {
        const lh = parseFloat(getComputedStyle(el).lineHeight)
        return Math.round(el.getBoundingClientRect().height / lh)
      })
      expect(lines).toBe(2)
    })

    test('E2E-M22-09 a tab filters, the count stays, every tab keeps the path', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(PELAJAR)
      await openS1(page, gotoApp)
      await page.getByTestId('tk-tabs').getByRole('link', { name: 'Selesai' }).click()
      await expect(page).toHaveURL(/\/pusat-tuisyen\/tiket\?status=selesai$/)
      await expect(cards(page)).toHaveCount(1)
      await expect(cardOf(page, 6)).toBeVisible()
      await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 6')
      await expect(page.getByTestId('tk-tabs').getByRole('link', { name: 'Selesai' })).toHaveClass(
        /bg-slate-800/,
      )
    })

    test('E2E-M22-19 reply panel on #6 only', async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await openS1(page, gotoApp)
      const panel = cardOf(page, 6).getByTestId('tk-reply')
      await expect(panel).toContainText('Balasan Sokongan')
      await expect(panel).toContainText('Terima kasih. Isu anda telah dibetulkan.')
      await expect(panel).toContainText('Sila cuba semula.')
      const lines = await panel.locator('p.whitespace-pre-line').evaluate((el) => {
        const lh = parseFloat(getComputedStyle(el).lineHeight)
        return Math.round(el.getBoundingClientRect().height / lh)
      })
      expect(lines).toBe(2)
      await expect(cards(page).getByTestId('tk-reply')).toHaveCount(1)
    })
  })

  test('E2E-M22-05 teacher and school admin: same anatomy, own tickets only (none)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(GURU)
    await openS1(page, gotoApp)
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
    await expect(page.getByTestId('tk-empty')).toBeVisible()
    await mock.setUser(SCHOOL_ADMIN)
    await openS1(page, gotoApp)
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
    await expect(page.getByTestId('tk-empty')).toBeVisible()
  })

  test('E2E-M22-06 empty: count 0, empty card, first-ticket button opens the form', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openS1(page, gotoApp)
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
    await expect(page.getByTestId('tk-empty')).toContainText('Tiada tiket lagi.')
    await expect(page.getByTestId('tk-form-card')).toBeHidden()
    await page.getByTestId('tk-first').click()
    await expect(page.getByTestId('tk-form-card')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('E2E-M22-07 a tab with no ticket shows the empty card, the count stays', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp, `${PATH}?status=selesai`)
    await expect(page.getByTestId('tk-empty')).toContainText('Tiada tiket lagi.')
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
  })

  test('E2E-M22-08 tabs: order, labels, hrefs, no counts', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp)
    const tabs = page.getByTestId('tk-tabs').getByRole('link')
    expect(await tabs.allInnerTexts()).toEqual([
      'Semua',
      'Dibuka',
      'Dalam Proses',
      'Menunggu Balas',
      'Selesai',
      'Ditutup',
    ])
    const hrefs = await tabs.evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(hrefs).toEqual([
      PATH,
      `${PATH}?status=dibuka`,
      `${PATH}?status=dalam_proses`,
      `${PATH}?status=menunggu_balas`,
      `${PATH}?status=selesai`,
      `${PATH}?status=ditutup`,
    ])
  })

  test('E2E-M22-10 an unknown status shows all, "Semua" active', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M22-10 runs at 1280 only')
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp, `${PATH}?status=xyz`)
    await expect(cards(page)).toHaveCount(1)
    await expect(page.getByTestId('tk-tabs').getByRole('link', { name: 'Semua' })).toHaveClass(
      /bg-slate-800/,
    )
  })
})

test.describe('S1 create', MODULE, () => {
  test('E2E-M22-11 the form is hidden on load and the button toggles it', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp)
    await expect(page.getByTestId('tk-form-card')).toBeHidden()
    await page.getByTestId('tk-new').click()
    await expect(page.getByTestId('tk-form-card')).toBeVisible()
    await page.getByTestId('tk-new').click()
    await expect(page.getByTestId('tk-form-card')).toBeHidden()
  })

  test(
    'E2E-M22-12 form anatomy (maxlength is PROPOSED)',
    provisional('the maxlength attributes are PROPOSED (SRS E2E-M22-12)', MODULE.tag),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR2)
      await openS1(page, gotoApp)
      await page.getByTestId('tk-new').click()
      const form = page.getByTestId('tk-form')
      await expect(page.getByTestId('tk-form-card').locator('h3')).toHaveText('Tiket Baru')
      await expect(form.getByLabel('Subjek')).toHaveAttribute(
        'placeholder',
        'Ringkasan masalah atau permintaan anda',
      )
      await expect(form.getByLabel('Subjek')).toHaveAttribute('required', '')
      await expect(form.getByLabel('Subjek')).toHaveAttribute('maxlength', '255')
      await expect(form.getByLabel('Butiran')).toHaveAttribute('rows', '5')
      await expect(form.getByLabel('Butiran')).toHaveAttribute('maxlength', '5000')
      await expect(form.getByLabel('Butiran')).toHaveAttribute(
        'placeholder',
        'Terangkan masalah anda dengan terperinci...',
      )
      await expect(page.getByTestId('tk-submit')).toHaveText('Hantar Tiket')
    },
  )

  test('E2E-M22-13 create: stays on S1, banner once, form closed, count 1, card first', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openS1(page, gotoApp)
    await page.getByTestId('tk-new').click()
    await page.getByLabel('Subjek').fill('Ujian tiket')
    await page.getByLabel('Butiran').fill('Butiran ujian tiket.')
    await page.getByTestId('tk-submit').click()
    await expect(page).toHaveURL(new RegExp(`${PATH}$`))
    await expect(page.getByTestId('tk-flash')).toContainText(FLASH)
    await expect(page.getByTestId('tk-form-card')).toBeHidden()
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
    await expect(cards(page).first()).toContainText('Ujian tiket')
    await expect(cards(page).first().getByTestId('tk-badge')).toHaveText('Dibuka')
    await page.reload()
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
    await expect(page.getByTestId('tk-flash')).toHaveCount(0)
  })

  test(
    'E2E-M22-14 whitespace-only values: nothing stored, form open, values kept, one message',
    provisional('the validation copy is PROPOSED (SRS E2E-M22-14)', MODULE.tag),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await openS1(page, gotoApp)
      await page.getByTestId('tk-new').click()
      await page.getByLabel('Subjek').fill('   ')
      await page.getByLabel('Butiran').fill('Isi')
      await page.getByTestId('tk-submit').click()
      await expect(page.getByTestId('tk-form-error')).toHaveText('Subjek diperlukan.')
      await expect(page.getByTestId('tk-form-card')).toBeVisible()
      await expect(page.getByLabel('Butiran')).toHaveValue('Isi')
      await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
      await page.getByLabel('Subjek').fill('Ada')
      await page.getByLabel('Butiran').fill('   ')
      await page.getByTestId('tk-submit').click()
      await expect(page.getByTestId('tk-form-error')).toHaveText('Butiran diperlukan.')
      await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
    },
  )

  test('E2E-M22-17 teacher and school admin create; it shows on their own S1 only', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(GURU)
    await openS1(page, gotoApp)
    await page.getByTestId('tk-new').click()
    await page.getByLabel('Subjek').fill('Tiket guru')
    await page.getByLabel('Butiran').fill('Isi guru')
    await page.getByTestId('tk-submit').click()
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
    await mock.setUser(SCHOOL_ADMIN)
    await gotoApp(PATH)
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
    await page.getByTestId('tk-new').click()
    await page.getByLabel('Subjek').fill('Tiket admin sekolah')
    await page.getByLabel('Butiran').fill('Isi')
    await page.getByTestId('tk-submit').click()
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
    await expect(cards(page).first()).toContainText('Tiket admin sekolah')
    await expect(page.getByText('Tiket guru')).toHaveCount(0)
  })

  test('E2E-M22-18 markup in the subject shows as text', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await openS1(page, gotoApp)
    await page.getByTestId('tk-new').click()
    await page.getByLabel('Subjek').fill('<b>x</b> & "y"')
    await page.getByLabel('Butiran').fill('Isi')
    await page.getByTestId('tk-submit').click()
    await expect(cards(page).first().locator('h3')).toContainText('<b>x</b> & "y"')
    await expect(cards(page).first().locator('h3 b')).toHaveCount(0)
  })
})

test.describe('S1 access', MODULE, () => {
  test('E2E-M22-20 a guest goes to /login', async ({ page, gotoApp }) => {
    await gotoApp(PATH)
    await expect(page).toHaveURL(/\/login/)
  })

  test('E2E-M22-21 isolation: ?userId is ignored, each user sees only their own', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp, `${PATH}?userId=4`)
    await expect(cards(page)).toHaveCount(1)
    await expect(page.getByText('Soalan kuiz tidak dipaparkan')).toHaveCount(0)
    await mock.setUser(PELAJAR3)
    await openS1(page, gotoApp, `${PATH}?userId=3`)
    await expect(cards(page)).toHaveCount(1)
    await expect(page.getByText('Tidak dapat log masuk ke akaun')).toHaveCount(0)
  })

  test(
    'E2E-M22-22 other roles open S1 with their own tickets (none)',
    provisional('parent, sponsor and JPN access is INFERRED (SRS E2E-M22-22)', MODULE.tag),
    async ({ page, loginAs, gotoApp, mock }) => {
      test.skip(viewportWidth(page) < 1280, 'E2E-M22-22 runs at 1280 only')
      await loginAs(ADMIN)
      await openS1(page, gotoApp)
      await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
      await expect(page.getByText('Tidak dapat log masuk ke akaun')).toHaveCount(0)
      for (const who of [
        'ppd@demo.test',
        'ibubapa@demo.test',
        'penaja@demo.test',
        'jpn@demo.test',
      ]) {
        await mock.setUser(who)
        await openS1(page, gotoApp)
        await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')
      }
    },
  )

  test('E2E-M22-23 the routes that are not built answer the 404 page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    for (const p of [`${PATH}/baru`, `${PATH}/1`, '/tiket', '/tiket/baru']) {
      await gotoApp(p)
      await expect(page.locator('body')).toContainText(NOT_FOUND_COPY)
    }
  })
})

test.describe('S2 queue', MODULE, () => {
  test('E2E-M22-24 admin shell, heading and sub-line', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openS2(page, gotoApp)
    await expect(page.getByRole('heading', { name: 'Tiket Sokongan', level: 1 })).toBeVisible()
    await expect(page.getByText('Permohonan bantuan daripada pengguna.')).toBeVisible()
  })

  test(
    'E2E-M22-24 (provisional part) tab title',
    provisional('the tab title is PROPOSED (SRS E2E-M22-24)', MODULE.tag),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openS2(page, gotoApp)
      await expectTabTitle(page, 'Tiket Sokongan - PRESTASIPLUS')
    },
  )

  test('E2E-M22-25 the two seed rows in order with dates, names, pills', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openS2(page, gotoApp)
    const head = await page.locator('thead th').allInnerTexts()
    expect(head.map((t) => t.toLowerCase())).toEqual([
      'tarikh',
      'pengguna',
      'subjek',
      'status',
      'dibalas',
    ])
    const rows = page.getByTestId('tq-row')
    await expect(rows).toHaveCount(2)
    expect(await rows.nth(0).locator('td').allInnerTexts()).toEqual([
      '2026-09-25 09:30:00',
      'Pelajar Maju Demo',
      'Soalan kuiz tidak dipaparkan',
      'dibuka',
      '—',
    ])
    expect((await rows.nth(1).locator('td').allInnerTexts())[0]).toBe('2026-09-24 10:12:00')
  })

  test.describe('tickets-extra', () => {
    test.use(EXTRA)

    test('E2E-M22-26 "Ya" only on #6, raw status pills', async ({ page, loginAs, gotoApp }) => {
      test.skip(viewportWidth(page) < 1280, 'E2E-M22-26 runs at 1280 only')
      await loginAs(ADMIN)
      await openS2(page, gotoApp)
      const rows = page.getByTestId('tq-row')
      await expect(rows).toHaveCount(9)
      const yes = rows.filter({ has: page.locator('td:last-child', { hasText: /^Ya$/ }) })
      await expect(yes).toHaveCount(1)
      await expect(yes).toContainText('Kata laluan tidak boleh ditukar')
      await expect(yes).toContainText('selesai')
      await expect(rows.filter({ hasText: 'menunggu_balas' })).toHaveCount(1)
    })

    test('E2E-M22-32 chips: present statuses, vocabulary order, counts, total', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      test.skip(viewportWidth(page) < 1280, 'E2E-M22-32 runs at 1280 only')
      await loginAs(ADMIN)
      await openS2(page, gotoApp)
      expect(await page.getByTestId('tq-chips').getByRole('link').allInnerTexts()).toEqual([
        'Semua (9)',
        'dibuka (5)',
        'dalam_proses (1)',
        'menunggu_balas (1)',
        'selesai (1)',
        'ditutup (1)',
      ])
    })

    test('E2E-M22-33 a chip filters, counts unchanged', async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openS2(page, gotoApp)
      await page
        .getByTestId('tq-chips')
        .getByRole('link', { name: /^selesai/ })
        .click()
      await expect(page).toHaveURL(/\/admin\/tiket\?status=selesai$/)
      await expect(page.getByTestId('tq-row')).toHaveCount(1)
      await expect(page.getByTestId('tq-chips').getByRole('link').first()).toHaveText('Semua (9)')
      await expect(
        page.getByTestId('tq-chips').getByRole('link', { name: /^selesai/ }),
      ).toHaveClass(/bg-indigo-600/)
    })

    test(
      'E2E-M22-41 (provisional part) badge "5" under tickets-extra',
      provisional('the value follows the INFERRED badge definition (SRS E2E-M22-41)', MODULE.tag),
      async ({ page, loginAs, gotoApp }) => {
        test.skip(viewportWidth(page) < 1280, 'sidebar at 1280 only')
        await loginAs(ADMIN)
        await gotoApp('/dashboard')
        await expect(
          page.getByTestId('shell-user-sidebar').locator('[data-nav-id="urus-tiket"]'),
        ).toContainText('5')
      },
    )
  })

  test('E2E-M22-27 an orphan owner shows "—"', async ({ page, loginAs, gotoApp, mock }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M22-27 runs at 1280 only')
    await loginAs(ADMIN)
    await gotoApp(QUEUE)
    await mock.hook('orphanTicketOwner', 1)
    await openS2(page, gotoApp)
    const row = page.getByTestId('tq-row').filter({ hasText: 'Tidak dapat log masuk' })
    expect((await row.locator('td').allInnerTexts())[1]).toBe('—')
  })

  test('E2E-M22-28 read-only: no control in the table or above it but the chips', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openS2(page, gotoApp)
    await expect(
      page.getByTestId('tq-page').locator('button, input, textarea, select'),
    ).toHaveCount(0)
    await expect(page.locator('tbody a')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /balas|padam|tutup|tugas/i })).toHaveCount(0)
  })

  test.describe('tickets-many', () => {
    test.use(MANY)

    test('E2E-M22-29 200 rows newest first, "Semua (205)"', async ({ page, loginAs, gotoApp }) => {
      test.skip(viewportWidth(page) < 1280, 'E2E-M22-29 runs at 1280 only')
      await loginAs(ADMIN)
      await openS2(page, gotoApp)
      await expect(page.getByTestId('tq-row')).toHaveCount(200)
      await expect(page.getByTestId('tq-chips').getByRole('link').first()).toHaveText('Semua (205)')
      await expect(page.getByTestId('tq-row').first()).toContainText('2026-09-25 09:30:00')
    })
  })

  test('E2E-M22-30 no ticket: "Belum ada tiket sokongan."', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(QUEUE)
    await mock.hook('clearTickets')
    await openS2(page, gotoApp)
    await expect(page.getByTestId('tq-empty')).toHaveText('Belum ada tiket sokongan.')
    await expect(page.locator('table')).toHaveCount(0)
  })

  test('E2E-M22-31 base seed chips, "Semua" active', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openS2(page, gotoApp)
    const chips = page.getByTestId('tq-chips').getByRole('link')
    expect(await chips.allInnerTexts()).toEqual(['Semua (2)', 'dibuka (2)'])
    await expect(chips.first()).toHaveClass(/bg-indigo-600/)
  })

  test('E2E-M22-34 an unknown status gives its own empty text', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M22-34 runs at 1280 only')
    await loginAs(ADMIN)
    await openS2(page, gotoApp, `${QUEUE}?status=xyz`)
    await expect(page.getByTestId('tq-empty')).toHaveText('Tiada tiket berstatus “xyz”.')
  })
})

test.describe('access and badge', MODULE, () => {
  test(
    'E2E-M22-35 a guest goes to /login; other roles are sent away',
    provisional('role redirect follows the router rule for /admin/* (SRS E2E-M22-35)', MODULE.tag),
    async ({ page, gotoApp, loginAs, mock }) => {
      await gotoApp(QUEUE)
      await expect(page).toHaveURL(/\/login/)
      await loginAs(PELAJAR)
      await gotoApp(QUEUE)
      await expect(page.getByTestId('tq-page')).toHaveCount(0)
      for (const who of [GURU, SCHOOL_ADMIN, 'ppd@demo.test', 'jpn@demo.test']) {
        await mock.setUser(who)
        await gotoApp(QUEUE)
        await expect(page.getByTestId('tq-page')).toHaveCount(0)
        await expect(page.getByText('Soalan kuiz tidak dipaparkan')).toHaveCount(0)
      }
    },
  )

  test('E2E-M22-37 "Urus Tiket" shows for the admin only', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M22-37 runs at 1280 only')
    await loginAs(ADMIN)
    await gotoApp('/dashboard')
    const item = page.getByTestId('shell-user-sidebar').locator('[data-nav-id="urus-tiket"]')
    await expect(item).toBeVisible()
    await mock.setUser(SCHOOL_ADMIN)
    await gotoApp(PATH)
    await expect(
      page.getByTestId('shell-user-sidebar').locator('[data-nav-id="urus-tiket"]'),
    ).toHaveCount(0)
  })

  test('E2E-M22-41 the admin badge shows the open count "2"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/dashboard')
    const surface = viewportWidth(page) >= 1024 ? 'shell-user-sidebar' : 'shell-user-drawer'
    if (surface === 'shell-user-drawer') await page.getByTestId('shell-user-hamburger').click()
    const item = page.getByTestId(surface).locator('[data-nav-id="urus-tiket"]')
    await expect(item).toContainText('2')
  })

  test(
    'E2E-M22-41 (provisional part) badge "3" after a pupil creates a ticket',
    provisional('the badge definition is INFERRED (SRS E2E-M22-41)', MODULE.tag),
    async ({ page, loginAs, gotoApp, mock }) => {
      test.skip(viewportWidth(page) < 1280, 'sidebar at 1280 only')
      await loginAs(PELAJAR)
      await openS1(page, gotoApp)
      await page.getByTestId('tk-new').click()
      await page.getByLabel('Subjek').fill('Satu lagi')
      await page.getByLabel('Butiran').fill('Isi')
      await page.getByTestId('tk-submit').click()
      await expect(page.getByTestId('tk-flash')).toBeVisible()
      await mock.setUser(ADMIN)
      await gotoApp('/dashboard')
      await expect(
        page.getByTestId('shell-user-sidebar').locator('[data-nav-id="urus-tiket"]'),
      ).toContainText('3')
    },
  )

  test(
    'E2E-M22-42 the badge is not rendered at 0',
    provisional('hiding at 0 is PROPOSED (SRS E2E-M22-42)', MODULE.tag),
    async ({ page, loginAs, gotoApp, mock }) => {
      test.skip(viewportWidth(page) < 1280, 'E2E-M22-42 runs at 1280 only')
      await loginAs(ADMIN)
      await gotoApp(QUEUE)
      await mock.hook('clearTickets')
      await gotoApp('/dashboard')
      const item = page.getByTestId('shell-user-sidebar').locator('[data-nav-id="urus-tiket"]')
      await expect(item).toBeVisible()
      await expect(item).not.toContainText(/\d/)
    },
  )

  for (const id of [38, 39, 40]) {
    test(
      `E2E-M22-${String(id)} notification to the admins`,
      provisional('covered by the handler test (SRS E2E-M22-38…40 are provisional)', MODULE.tag),
      () => {
        test.skip(true, 'covered by src/modules/m22-support-tickets/__tests__/mock/tickets.test.ts')
      },
    )
  }
  for (const id of [15, 16, 36]) {
    test(`E2E-M22-${String(id)} request only`, () => {
      test.skip(true, 'request-only scenario: covered by the M22 handler test (no raw API in E2E)')
    })
  }
})

test.describe('responsive and quality', MODULE, () => {
  test('E2E-M22-43 no horizontal scroll on S1 and S2; the table scrolls inside its card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openS1(page, gotoApp)
    await expect(cards(page).first().or(page.getByTestId('tk-empty'))).toBeVisible()
    await expectNoHorizontalScroll(page)
    await openS2(page, gotoApp)
    await expect(page.getByTestId('tq-table')).toBeVisible()
    await expectNoHorizontalScroll(page)
    if (viewportWidth(page) === 375) {
      const scroller = page
        .getByTestId('tq-table')
        .locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]')
      const [sw, cw] = await scroller.evaluate((el) => [el.scrollWidth, el.clientWidth])
      expect(sw).toBeGreaterThan(cw)
    }
  })

  test('E2E-M22-43 the count row stacks at 375 and tabs wrap', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) !== 375, 'stacking is checked at 375')
    await loginAs(PELAJAR2)
    await openS1(page, gotoApp)
    const total = await page.getByTestId('tk-total').boundingBox()
    const button = await page.getByTestId('tk-new').boundingBox()
    expect(button!.y).toBeGreaterThan(total!.y + total!.height - 1)
    const tabs = await page
      .getByTestId('tk-tabs')
      .getByRole('link')
      .evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size)
    expect(tabs).toBeGreaterThan(1)
  })

  test('E2E-M22-44 every text is at least 12 px on S1 and S2', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openS1(page, gotoApp)
    await fontSizesOk(page.getByTestId('tk-page'))
    await openS2(page, gotoApp)
    await expect(page.getByTestId('tq-table')).toBeVisible()
    await fontSizesOk(page.getByTestId('tq-page'))
  })

  test.describe('forced error', () => {
    test(
      'E2E-M22-45 a 500 shows the error state with retry',
      provisional('the shared error convention is PROPOSED (SRS E2E-M22-45)', MODULE.tag),
      async ({ page, loginAs, gotoApp, mock }) => {
        await loginAs(PELAJAR2)
        await gotoApp('/dashboard')
        await mock.failNext('/api/tiket', { status: 500 })
        await gotoApp(PATH)
        await expect(page.getByTestId('tk-error')).toBeVisible()
        await page.getByTestId('tk-retry').click()
        await expect(cards(page)).toHaveCount(1)
      },
    )
  })
})
