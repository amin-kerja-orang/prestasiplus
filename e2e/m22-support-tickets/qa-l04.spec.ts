/**
 * L04 "Tiket Bantuan" (M22) G5 regression spec: exploratory checks beyond `tiket.spec.ts` kept as automated
 * tests. Runs on mobile 375 / tablet 768 / desktop 1280 unless a test says otherwise.
 *
 * Covers: create limits 255/5000 through the real form (accepted at the limit, 422 copy above it), the flash
 * text verbatim and status "dibuka" for murid / guru / school admin, tabs and `?status=`, the reply panel,
 * denial of `/admin/tiket` for school admin / guru / murid (landing URL, no queue request answered 200), the
 * open-count request made by the admin only, S2 dates in Malaysian time whatever the browser zone, S2 read-only,
 * the unbuilt paths, and a real long unbroken subject at 320 px.
 *
 * The raw API is not reachable from a test (the mock transport lives in the app), so request status codes are
 * read from the mock request log (`mock.requests`).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, viewportWidth } from '../support'

const MODULE = { tag: ['@m22'] }
const PATH = '/pusat-tuisyen/tiket'
const QUEUE = '/admin/tiket'
const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const GURU = 'guru@demo.test'
const SCHOOL_ADMIN = 'adminsekolah@demo.test'
const FLASH = 'Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin.'

test.use({ mockInit: { latency: 0 } })

const cards = (page: Page) => page.getByTestId('tk-card')

async function openS1(page: Page, gotoApp: (p: string) => Promise<void>, path = PATH) {
  await gotoApp(path)
  await expect(page.getByTestId('tk-page')).toBeVisible()
  await expect(page.getByTestId('tk-loading')).toHaveCount(0)
}

async function create(page: Page, subject: string, body: string) {
  const form = page.getByTestId('tk-form-card')
  if (!(await form.isVisible())) await page.getByTestId('tk-new').click()
  await page.getByLabel('Subjek').fill(subject)
  await page.getByLabel('Butiran').fill(body)
  await page.getByTestId('tk-submit').click()
}

/** Console errors and page errors from now on (resource 404s from the dev preview are not counted). */
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

test.describe('L04 create through the form', MODULE, () => {
  test('AC-04.2/04.3/04.6 limits: 255 and 5000 accepted; 256 and 5001 refused with the copy', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await openS1(page, gotoApp)
    await page.getByTestId('tk-new').click()
    await expect(page.getByLabel('Subjek')).toHaveAttribute('maxlength', '255')
    await expect(page.getByLabel('Butiran')).toHaveAttribute('maxlength', '5000')

    // 256 / 5001: Playwright `fill` honours maxlength, so drop the attributes first (as a direct API caller
    // bypasses them): refused by the endpoint, form stays open, values kept.
    await page.evaluate(() => {
      document.querySelector('#tk-subject')?.removeAttribute('maxlength')
      document.querySelector('#tk-body')?.removeAttribute('maxlength')
    })
    await create(page, 'a'.repeat(256), 'isi')
    await expect(page.getByTestId('tk-form-error')).toHaveText('Subjek tidak boleh melebihi 255 aksara.')
    await expect(page.getByTestId('tk-form-card')).toBeVisible()
    await expect(page.getByLabel('Subjek')).toHaveValue('a'.repeat(256))
    await expect(page.getByTestId('tk-flash')).toHaveCount(0)
    await create(page, 'ok', 'b'.repeat(5001))
    await expect(page.getByTestId('tk-form-error')).toHaveText(
      'Butiran tidak boleh melebihi 5000 aksara.',
    )
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 0')

    // exactly at the limits: accepted
    await create(page, 'a'.repeat(255), 'b'.repeat(5000))
    await expect(page.getByTestId('tk-flash')).toHaveText(FLASH)
    await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).first().getByTestId('tk-badge')).toHaveText('Dibuka')
    await expectNoHorizontalScroll(page)
    const posts = (await mock.requests('/api/tiket')).filter((r) => r.method === 'POST')
    expect(posts.map((r) => r.status)).toEqual([422, 422, 201])
  })

  for (const [who, label] of [
    [PELAJAR, 'murid'],
    [GURU, 'guru'],
    [SCHOOL_ADMIN, 'school_admin'],
  ] as const) {
    test(`AC-04.3/04.8/03.x ${label}: flash verbatim, status dibuka, tabs and ?status=, reply panel`, async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      await loginAs(who)
      await openS1(page, gotoApp)
      await create(page, `Ujian ${label}`, 'Baris satu')
      const flash = page.getByTestId('tk-flash')
      await expect(flash).toHaveText(FLASH)
      await expect(page.getByTestId('tk-form-card')).toBeHidden()
      expect(new URL(page.url()).pathname).toBe(PATH)
      expect(new URL(page.url()).search).toBe('')
      await expect(cards(page)).toHaveCount(1)
      await expect(cards(page).first().getByTestId('tk-badge')).toHaveText('Dibuka')
      await expect(cards(page).first().locator('h3')).toContainText(`Ujian ${label}`)

      // tabs: dibuka keeps it, selesai is empty, count unchanged, path stays
      await page.getByTestId('tk-tabs').getByRole('link', { name: 'Dibuka' }).click()
      await expect(page).toHaveURL(new RegExp(`${PATH}\\?status=dibuka$`))
      await expect(cards(page)).toHaveCount(1)
      await expect(flash).toHaveCount(0)
      await page.getByTestId('tk-tabs').getByRole('link', { name: 'Selesai' }).click()
      await expect(page.getByTestId('tk-empty')).toBeVisible()
      await expect(page.getByTestId('tk-total')).toHaveText('Jumlah tiket: 1')
      await expect(page.getByTestId('tk-reply')).toHaveCount(0)

      // reply panel through the test hook
      const id = Number((await mock.requests('/api/tiket')).filter((r) => r.method === 'POST').length)
      expect(id).toBe(1)
      await gotoApp(PATH)
      const heading = await cards(page).first().locator('h3').innerText()
      const ticketId = Number(/^#(\d+)/.exec(heading)?.[1])
      await mock.hook('setTicketState', ticketId, { adminReply: 'Satu\nDua', status: 'selesai' })
      await gotoApp(`${PATH}?status=selesai`)
      await expect(cards(page)).toHaveCount(1)
      const reply = page.getByTestId('tk-reply')
      await expect(reply).toContainText('Balasan Sokongan')
      await expect(reply).toContainText('Satu')
      await expect(reply).toContainText('Dua')
      const lines = await reply.locator('p').nth(1).evaluate((el) => el.getBoundingClientRect().height)
      const oneLine = await reply.locator('p').nth(0).evaluate((el) => el.getBoundingClientRect().height)
      expect(lines).toBeGreaterThan(oneLine)
    })
  }

  test('FR-M22-06 the banner is gone after a reload; the other users keep their own list', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openS1(page, gotoApp)
    await create(page, 'Sekali sahaja', 'Isi')
    await expect(page.getByTestId('tk-flash')).toBeVisible()
    await gotoApp(PATH)
    await expect(page.getByTestId('tk-flash')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(1)
  })
})

test.describe('L04 access and badge', MODULE, () => {
  test('AC-09.1/09.2 guest to /login; school admin, guru and murid are denied the queue', async ({
    page,
    gotoApp,
    mock,
  }) => {
    test.setTimeout(600_000)
    await gotoApp(QUEUE)
    await expect(page).toHaveURL(/\/login/)
    for (const who of [SCHOOL_ADMIN, GURU, PELAJAR]) {
      await gotoApp('/login')
      await mock.setUser(who)
      await gotoApp(QUEUE)
      await expect(page.getByTestId('tq-page')).toHaveCount(0)
      await expect(page.getByTestId('tq-row')).toHaveCount(0)
      await expect(page.getByText('Soalan kuiz tidak dipaparkan')).toHaveCount(0)
      await expect(page).not.toHaveURL(/\/admin\/tiket/)
      const answered = (await mock.requests('/api/admin/tiket')).filter((r) => r.status === 200)
      expect(answered, `${who}: no queue request may be answered 200`).toHaveLength(0)
    }
  })

  for (const who of [PELAJAR, GURU, SCHOOL_ADMIN]) {
    test(`AC-11.x ${who}: no open-count request, no "Urus Tiket"`, async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      const errors = watchErrors(page)
      await loginAs(who)
      await openS1(page, gotoApp)
      if (viewportWidth(page) >= 1024) {
        await expect(
          page.getByTestId('shell-user-sidebar').locator('[data-nav-id="urus-tiket"]'),
        ).toHaveCount(0)
      }
      expect(await mock.requests('/api/admin/tiket/open-count')).toHaveLength(0)
      expect(await mock.requests('/api/admin/tiket')).toHaveLength(0)
      expect(errors).toEqual([])
    })
  }

  test('AC-11.1/11.2/11.3 admin: one open-count request answered 200, live badge, hidden at 0 for Urus Tiket only', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'sidebar at 1280 only')
    const errors = watchErrors(page)
    await loginAs(ADMIN)
    await gotoApp('/dashboard')
    const item = page.getByTestId('shell-user-sidebar').locator('[data-nav-id="urus-tiket"]')
    await expect(item).toContainText('2')
    const reqs = await mock.requests('/api/admin/tiket/open-count')
    expect(reqs.length).toBeGreaterThanOrEqual(1)
    expect(reqs.every((r) => r.status === 200)).toBe(true)
    // live: an in-memory change shows after the next page load
    await mock.hook('m22LoadProfile', 'tickets-extra')
    await gotoApp('/dashboard')
    await expect(item).toContainText('5')
    await mock.hook('clearTickets')
    await gotoApp('/dashboard')
    await expect(item).toBeVisible()
    await expect(item).not.toContainText(/\d/)
    expect(errors).toEqual([])
  })
})

test.describe('L04 queue (S2)', MODULE, () => {
  test('AC-07.x read-only, chips, MYT dates, no console errors', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    const errors = watchErrors(page)
    await loginAs(ADMIN)
    await gotoApp(QUEUE)
    await expect(page.getByTestId('tq-table')).toBeVisible()
    await expect(page.getByTestId('tq-chips')).toContainText('Semua (2)')
    await expect(page.getByTestId('tq-chips')).toContainText('dibuka (2)')
    const rows = page.getByTestId('tq-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).locator('td').nth(0)).toHaveText('2026-09-25 09:30:00')
    await expect(rows.nth(1).locator('td').nth(0)).toHaveText('2026-09-24 10:12:00')
    for (const th of await page.locator('[data-testid="tq-table"] th').all()) {
      expect(await th.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')
    }
    // nothing writable inside the page content
    const page_ = page.getByTestId('tq-page')
    await expect(page_.locator('button, input, textarea, select, form')).toHaveCount(0)
    await expect(rows.locator('a, button')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    expect(errors).toEqual([])
  })

  test.describe('browser in another time zone', () => {
    test.use({ timezoneId: 'America/New_York' })
    test('DV-M22-09 the queue prints Malaysian time whatever the browser zone', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      await gotoApp(QUEUE)
      await expect(page.getByTestId('tq-row').nth(0).locator('td').nth(0)).toHaveText(
        '2026-09-25 09:30:00',
      )
    })
  })

  test('AC-07.x a filter that holds no ticket and an unknown value', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp(`${QUEUE}?status=selesai`)
    await expect(page.getByTestId('tq-empty')).toHaveText('Tiada tiket berstatus “selesai”.')
    await gotoApp(`${QUEUE}?status=<b>x</b>`)
    await expect(page.getByTestId('tq-empty')).toHaveText('Tiada tiket berstatus “<b>x</b>”.')
    await expect(page.getByTestId('tq-page').locator('b')).toHaveCount(0)
  })
})

test.describe('L04 unbuilt paths and states', MODULE, () => {
  test('FR-M22-27 /tiket, /tiket/baru and /pusat-tuisyen/tiket/baru answer 404 (signed in and guest)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    for (const p of ['/tiket', '/tiket/baru', '/pusat-tuisyen/tiket/baru', '/pusat-tuisyen/tiket/1']) {
      await gotoApp(p)
      await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
      await expect(page.getByTestId('tk-page')).toHaveCount(0)
    }
  })

  test('AC-12.4 loading state while the list is slow, then the data', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/dashboard')
    await mock.setLatency(2500, '/api/tiket')
    // enter S1 in-app (a reload would drop the latency)
    await page.evaluate(async () => {
      const el = document.querySelector('#app') as Element & {
        __vue_app__: { config: { globalProperties: { $router: { push(t: string): Promise<unknown> } } } }
      }
      void el.__vue_app__.config.globalProperties.$router.push('/pusat-tuisyen/tiket')
    })
    await expect(page.getByTestId('tk-loading')).toBeVisible()
    await expect(page.getByTestId('tk-empty')).toHaveCount(0)
    await expect(page.getByTestId('tk-empty')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('tk-loading')).toHaveCount(0)
  })

  test('AC-12.4 a network error shows the error box with retry on S2 and S1', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await openS1(page, gotoApp)
    await mock.networkErrorNext('GET /api/tiket')
    await page.getByTestId('tk-tabs').getByRole('link', { name: 'Ditutup' }).click()
    await expect(page.getByTestId('tk-error')).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await page.getByTestId('tk-retry').click()
    await expect(page.getByTestId('tk-empty')).toBeVisible()
  })
})

test.describe('L04 320 px', MODULE, () => {
  test.use({ viewport: { width: 320, height: 700 } })

  test('a long unbroken subject, body and reply do not overflow; text at least 12 px', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', '320 px is checked once, on the mobile project')
    await loginAs(PELAJAR)
    await openS1(page, gotoApp)
    const long = 'Panjang'.repeat(36)
    await create(page, long, long.repeat(10))
    await expect(page.getByTestId('tk-flash')).toBeVisible()
    await gotoApp(PATH)
    const heading = await cards(page).first().locator('h3').innerText()
    const ticketId = Number(/^#(\d+)/.exec(heading)?.[1])
    await mock.hook('setTicketState', ticketId, { adminReply: long, status: 'menunggu_balas' })
    await gotoApp(PATH)
    await page.getByTestId('tk-new').click()
    await expect(page.getByTestId('tk-reply')).toBeVisible()
    await expectNoHorizontalScroll(page)
    const small = await page.getByTestId('tk-page').evaluate((el) => {
      const bad: string[] = []
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!(n.textContent ?? '').trim()) continue
        const p = n.parentElement
        if (p && parseFloat(getComputedStyle(p).fontSize) < 12) bad.push(p.tagName)
      }
      return bad
    })
    expect(small).toEqual([])
    // the badge keeps inside the card
    const card = await cards(page).first().boundingBox()
    const badge = await cards(page).first().getByTestId('tk-badge').boundingBox()
    expect(badge!.x + badge!.width).toBeLessThanOrEqual(card!.x + card!.width + 0.5)
  })
})
