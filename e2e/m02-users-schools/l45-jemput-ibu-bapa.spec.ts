/**
 * L45 "Jemput Ibu Bapa" S1 `/jemput-ibu-bapa` (owner M02): E2E-L45-01..14 and the S1 half of 24
 * (SRS docs/requirements/srs/L45-jemput-ibu-bapa.md §12). Every test runs on the three projects.
 *
 * Only the guest redirect and the admin 403 copy are OBSERVED on live (SRS §3); everything else on
 * this screen is PROPOSED (reference rebuild) or INFERRED, so those tests are `@provisional`.
 * `POST /api/me/parent-invite/generate` returning 403 for a non-student (E2E-L45-13) cannot be called
 * from Playwright (the e2e build exposes no API client); it is covered by the mock test
 * `src/modules/m02-users-schools/__tests__/mock/parent-invites.test.ts` ('permissions (§9) on #1 and #2'
 * › 'POST /api/me/parent-invite/generate: guest 401; every non-student 403').
 * Seeds: student 3 `pelajar2@demo.test` has no parent link and no school; student 2 `pelajar@demo.test`
 * has parent 6 "Ibu Bapa Demo". The first invite token issued since `mock.reset()` is 63 zeros + `1`.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, reloadApp, test } from '../fixtures/test'
import {
  actAs,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  moduleTag,
  navigateInApp,
  provisional,
  SM_MIN_WIDTH,
} from '../support'

const STUDENT_NO_PARENT = 'pelajar2@demo.test'
const STUDENT_WITH_PARENT = 'pelajar@demo.test'
const PROPOSED = 'L45 S1 content is PROPOSED from the reference rebuild (SRS §3, D23a)'
const INFERRED = 'L45 behaviour is INFERRED (SRS §3)'
const COPY_INTRO = 'Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej.'
const HERO_TEXT = 'Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda'
const FLASH = 'Link jemputan baru telah dijana!'
const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'
const TOKEN_RE = /^[0-9a-f]{64}$/
const FIRST_TOKEN = `${'0'.repeat(63)}1`
const SECOND_TOKEN = `${'0'.repeat(63)}2`

const tag = [moduleTag(2)]
const tagP = (reason: string) => provisional(reason)

const field = (page: Page) => page.getByTestId('jemput-url')

async function tokenOf(page: Page): Promise<string> {
  const value = await field(page).inputValue()
  const token = value.split('/ibu-bapa/terima/')[1] ?? ''
  expect(token).toMatch(TOKEN_RE)
  return token
}

/** The "Jemput Ibu Bapa" menu item of the surface the viewport shows (sidebar >= 1024, else drawer). */
async function menuItem(page: Page): Promise<Locator> {
  if (isDesktopShell(page)) {
    return page.getByTestId('shell-user-sidebar').locator('[data-nav-id="jemput-ibu-bapa"]')
  }
  await page.getByTestId('shell-user-hamburger').click()
  const drawer = page.getByTestId('shell-user-drawer')
  await expect(drawer).toHaveClass(/\bopen\b/)
  return drawer.locator('[data-nav-id="jemput-ibu-bapa"]')
}

/** A clipboard stand-in that records the text (`window.__copied`) or rejects. */
async function stubClipboard(page: Page, mode: 'ok' | 'reject'): Promise<void> {
  await page.addInitScript((m) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (m === 'reject') return Promise.reject(new Error('refused'))
          ;(window as unknown as { __copied?: string }).__copied = text
          return Promise.resolve()
        },
      },
    })
  }, mode)
}

test.describe('L45 S1 /jemput-ibu-bapa', { tag }, () => {
  // Several tests boot the app more than once; a boot takes up to ~6 s (more when workers compete).
  test.describe.configure({ timeout: 90_000 })
  test.use({ mockInit: { latency: 0 } })

  test(
    'E2E-L45-01 content: title, header, hero, cards, three buttons, field value',
    tagP(PROPOSED),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT_NO_PARENT)
      await gotoApp('/profile')
      await (await menuItem(page)).click()
      await expect(page).toHaveURL('/jemput-ibu-bapa')
      await expectTabTitle(page, 'Jemput Ibu Bapa - PRESTASIPLUS')
      await expect(page.getByTestId('shell-user-title')).toHaveText('Jemput Ibu Bapa')
      await expect(page.getByTestId('shell-user-subtitle')).toHaveText(HERO_TEXT)
      const hero = page.getByTestId('jemput-hero')
      await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Jemput Ibu Bapa 👨‍👩‍👧')
      await expect(hero).toContainText(HERO_TEXT)
      const card = page.getByTestId('jemput-link-card')
      await expect(card.getByRole('heading', { level: 2 })).toHaveText('Link Jemputan')
      await expect(card).toContainText(COPY_INTRO)
      await expect(page.getByTestId('jemput-copy')).toHaveText('Salin')
      await expect(page.getByTestId('jemput-whatsapp')).toHaveText('Hantar via WhatsApp')
      await expect(page.getByTestId('jemput-regenerate')).toHaveText('Jana Link Baru')
      await expect(field(page)).toHaveAttribute('readonly', '')
      const origin = new URL(page.url()).origin
      await expect(field(page)).toHaveValue(`${origin}/ibu-bapa/terima/${FIRST_TOKEN}`)
      expect(await tokenOf(page)).toMatch(TOKEN_RE)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-L45-02 the token is stable across reload and sessions; two students differ',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      await gotoApp('/login')
      await actAs(page, mock, gotoApp, STUDENT_NO_PARENT, '/jemput-ibu-bapa')
      const first = await tokenOf(page)
      await reloadApp(page)
      expect(await tokenOf(page)).toBe(first)
      await actAs(page, mock, gotoApp, STUDENT_WITH_PARENT, '/jemput-ibu-bapa')
      const other = await tokenOf(page)
      expect(other).not.toBe(first)
      await actAs(page, mock, gotoApp, STUDENT_NO_PARENT, '/jemput-ibu-bapa')
      expect(await tokenOf(page)).toBe(first)
    },
  )

  test.describe('loading', () => {
    test.use({ mockInit: { latency: { '*': 0, 'GET /api/me/parent-invite': 1500 } } })

    test(
      'E2E-L45-03 spinner while loading, then the alert with "Cuba lagi" when the call fails',
      tagP(INFERRED),
      async ({ page, loginAs, gotoApp, mock }) => {
        await loginAs(STUDENT_NO_PARENT)
        await gotoApp('/profile')
        // `failNext` lives in the page, so the call is made by a client-side navigation.
        await mock.failNext('GET /api/me/parent-invite', 500)
        await navigateInApp(page, '/jemput-ibu-bapa')
        await expect(page.getByTestId('jemput-loading')).toBeVisible()
        await expect(page.getByTestId('jemput-alert')).toContainText(GENERIC_ERROR)
        await expect(page.getByTestId('jemput-retry')).toHaveText('Cuba lagi')
        await expectTouchTarget(page.getByTestId('jemput-retry'))
        await expectNoHorizontalScroll(page)
        await page.getByTestId('jemput-retry').click()
        await expect(page.getByTestId('jemput-hero')).toBeVisible()
        await expect(page.getByTestId('jemput-alert')).toHaveCount(0)
      },
    )
  })

  test.describe('copy', () => {
    test(
      'E2E-L45-04 "Salin" writes the URL, shows "Disalin!" (emerald) for 2 s, then reverts',
      tagP(PROPOSED),
      async ({ page, loginAs, gotoApp, clock }) => {
        await stubClipboard(page, 'ok')
        await loginAs(STUDENT_NO_PARENT)
        await gotoApp('/jemput-ibu-bapa')
        const button = page.getByTestId('jemput-copy')
        const url = await field(page).inputValue()
        await button.click()
        await expect(button).toHaveText('Disalin!')
        await expect(button).toHaveAttribute('data-copied', 'true')
        await expect(button).toHaveClass(/bg-emerald/)
        expect(
          await page.evaluate(() => (window as unknown as { __copied?: string }).__copied),
        ).toBe(url)
        await clock.fastForward(2100)
        await expect(button).toHaveText('Salin')
        await expect(button).toHaveClass(/bg-indigo/)
      },
    )

    test(
      'E2E-L45-04 a refused clipboard leaves the label unchanged and shows no error (DV-L45-04)',
      tagP(INFERRED),
      async ({ page, loginAs, gotoApp }) => {
        await stubClipboard(page, 'reject')
        await loginAs(STUDENT_NO_PARENT)
        await gotoApp('/jemput-ibu-bapa')
        await page.getByTestId('jemput-copy').click()
        await page.waitForTimeout(300)
        await expect(page.getByTestId('jemput-copy')).toHaveText('Salin')
        await expect(page.getByTestId('jemput-alert')).toHaveCount(0)
      },
    )
  })

  test(
    'E2E-L45-05 WhatsApp keeps its href and target; the click opens nothing (D14)',
    tagP(PROPOSED),
    async ({ page, context, loginAs, gotoApp }) => {
      await loginAs(STUDENT_NO_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      const link = page.getByTestId('jemput-whatsapp')
      const url = await field(page).inputValue()
      await expect(link).toHaveAttribute(
        'href',
        'https://wa.me/?text=' +
          encodeURIComponent(
            `Salam ibu/bapa! Klik link ini untuk pantau perkembangan saya di PRESTASIPLUS: ${url}`,
          ),
      )
      await expect(link).toHaveAttribute('target', '_blank')
      await expectTouchTarget(link)
      let opened = 0
      context.on('page', () => opened++)
      await link.click()
      await page.waitForTimeout(400)
      expect(opened).toBe(0)
      expect(page.url()).toContain('/jemput-ibu-bapa')
      expect(context.pages()).toHaveLength(1)
    },
  )

  test(
    'E2E-L45-06 "Jana Link Baru": disabled while pending, new link, flash, same URL',
    tagP(PROPOSED),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(STUDENT_NO_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      const before = await field(page).inputValue()
      await mock.setLatency(800, 'POST /api/me/parent-invite/generate')
      const button = page.getByTestId('jemput-regenerate')
      await button.click()
      await expect(button).toBeDisabled()
      await expect(page.getByTestId('jemput-flash')).toHaveText(FLASH)
      await expect(button).toBeEnabled()
      await expect(page).toHaveURL('/jemput-ibu-bapa')
      const after = await field(page).inputValue()
      expect(after).not.toBe(before)
      await expect(page.getByTestId('jemput-whatsapp')).toHaveAttribute(
        'href',
        new RegExp(encodeURIComponent(after).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      )
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-L45-07 after regenerating, the old URL is "Link Tidak Sah" and the new URL is valid',
    tagP(PROPOSED),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT_NO_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      expect(await tokenOf(page)).toBe(FIRST_TOKEN)
      await page.getByTestId('jemput-regenerate').click()
      await expect(page.getByTestId('jemput-flash')).toHaveText(FLASH)
      expect(await tokenOf(page)).toBe(SECOND_TOKEN)
      await gotoApp(`/ibu-bapa/terima/${FIRST_TOKEN}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Link Tidak Sah')
      await gotoApp(`/ibu-bapa/terima/${SECOND_TOKEN}`)
      await expect(page.getByTestId('invite-heading')).toHaveText(
        'Anda dijemput untuk memantau kemajuan Pelajar Dua Demo',
      )
    },
  )

  test(
    'E2E-L45-08 a failed regenerate keeps the old link and shows the alert; the parents list is unchanged',
    tagP(INFERRED),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(STUDENT_WITH_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      const before = await field(page).inputValue()
      await mock.failNext('POST /api/me/parent-invite/generate', 500)
      await page.getByTestId('jemput-regenerate').click()
      await expect(page.getByTestId('jemput-alert')).toHaveText(GENERIC_ERROR)
      await expect(page.getByTestId('jemput-flash')).toHaveCount(0)
      await expect(field(page)).toHaveValue(before)
      await expect(page.getByTestId('jemput-regenerate')).toBeEnabled()
      // A successful regenerate leaves the connected parents untouched (AC-04.3).
      await page.getByTestId('jemput-regenerate').click()
      await expect(page.getByTestId('jemput-flash')).toHaveText(FLASH)
      await expect(page.getByTestId('jemput-parent')).toHaveCount(1)
      await expect(page.getByTestId('jemput-parent-name')).toHaveText('Ibu Bapa Demo')
    },
  )

  test(
    'E2E-L45-09 student 2: one row with name and email, no chip, no remove control',
    tagP(PROPOSED),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT_WITH_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      const card = page.getByTestId('jemput-parents-card')
      await expect(card.getByRole('heading', { level: 2 })).toHaveText('Ibu Bapa Dihubungkan')
      await expect(page.getByTestId('jemput-parent')).toHaveCount(1)
      await expect(page.getByTestId('jemput-parent-name')).toHaveText('Ibu Bapa Demo')
      await expect(page.getByTestId('jemput-parent-email')).toHaveText('ibubapa@demo.test')
      await expect(card.locator('button, a, input')).toHaveCount(0)
      await expect(page.getByTestId('jemput-parent').locator('span')).toHaveCount(1) // only the icon tile
      await expect(page.getByTestId('jemput-empty')).toHaveCount(0)
      await expect(page.getByTestId('jemput-parent').locator('img')).toHaveCount(0)
    },
  )

  test('E2E-L45-10 student 3: empty state', tagP(PROPOSED), async ({ page, loginAs, gotoApp }) => {
    await loginAs(STUDENT_NO_PARENT)
    await gotoApp('/jemput-ibu-bapa')
    const empty = page.getByTestId('jemput-empty')
    await expect(empty).toContainText('👨‍👩‍👧')
    await expect(empty).toContainText('Belum ada ibu bapa dihubungkan')
    await expect(empty).toContainText('Hantar link jemputan di atas')
    await expect(page.getByTestId('jemput-parent')).toHaveCount(0)
  })

  test(
    'E2E-L45-11 an accepted invite and M02 admin link edits show on S1; rows are ordered by name',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      test.slow()
      await gotoApp('/login')
      await actAs(page, mock, gotoApp, STUDENT_NO_PARENT, '/jemput-ibu-bapa')
      const token = await tokenOf(page)

      // Parent 6 opens the link: the link is created.
      await mock.setUser('ibubapa@demo.test')
      await gotoApp(`/ibu-bapa/terima/${token}`)
      await expect(page.getByTestId('invite-linked-box')).toBeVisible()

      await mock.setUser(STUDENT_NO_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      await expect(page.getByTestId('jemput-parent-name')).toHaveText(['Ibu Bapa Demo'])

      // The admin adds parent 5401 to student 3 in M02 S3: two rows, by name A to Z.
      await mock.setUser('admin@demo.test')
      await gotoApp('/admin/users/5401/edit')
      await page.getByTestId('linker-search').fill('Pelajar Dua')
      await page.getByTestId('linker-result').first().click()
      await expect(page.getByTestId('linker-chip')).toHaveCount(1)
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL('/admin/users')

      await mock.setUser(STUDENT_NO_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      await expect(page.getByTestId('jemput-parent-name')).toHaveText([
        'Ibu Bapa Demo',
        'Ibu Bapa Dua Demo',
      ])

      // The admin removes the link again: the list follows.
      await mock.setUser('admin@demo.test')
      await gotoApp('/admin/users/5401/edit')
      await page.getByTestId('linker-remove').first().click()
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL('/admin/users')
      await mock.setUser(STUDENT_NO_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      await expect(page.getByTestId('jemput-parent-name')).toHaveText(['Ibu Bapa Demo'])
    },
  )

  test('E2E-L45-12 a guest is sent to /login with no message', async ({ page, gotoApp }) => {
    await gotoApp('/jemput-ibu-bapa')
    await expect(page).toHaveURL('/login')
    await expect(page.getByTestId('login-alert')).toHaveCount(0)
  })

  test('E2E-L45-13 admin sees the 403 page in place (OBSERVED copy)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/jemput-ibu-bapa')
    await expect(page).toHaveURL('/jemput-ibu-bapa')
    await expectTabTitle(page, '403 - Akses Ditolak | PRESTASIPLUS')
    await expect(page.getByText('403', { exact: true })).toBeVisible()
    await expect(page.getByText('🚫')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Akses Ditolak')
    await expect(
      page.getByText(
        'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.',
      ),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
    await expect(page.getByRole('link', { name: 'Log Masuk' })).toHaveAttribute('href', '/login')
    await expect(page.getByText('PRESTASIPLUS', { exact: true })).toBeVisible()
    await expectNoHorizontalScroll(page)
    // No "Jemput Ibu Bapa" menu item for the admin either (the student-only item is never rendered).
    await expect(page.locator('[data-nav-id="jemput-ibu-bapa"]')).toHaveCount(0)
  })

  for (const [role, who] of [
    ['teacher', 'guru@demo.test'],
    ['parent', 'ibubapa@demo.test'],
  ] as const) {
    test(
      `E2E-L45-13 ${role}: the same 403 page and no menu item (INFERRED)`,
      tagP(INFERRED),
      async ({ page, loginAs, gotoApp }) => {
        await loginAs(who)
        await gotoApp('/jemput-ibu-bapa')
        await expect(page).toHaveURL('/jemput-ibu-bapa')
        await expectTabTitle(page, '403 - Akses Ditolak | PRESTASIPLUS')
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Akses Ditolak')
        await gotoApp('/profile')
        await expect(page.getByTestId('profile-page')).toBeVisible()
        await expect(page.locator('[data-nav-id="jemput-ibu-bapa"]')).toHaveCount(0)
      },
    )
  }

  test(
    'E2E-L45-14 menu item for the student (sidebar or drawer), current page marked, absent for the parent',
    tagP(PROPOSED),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT_NO_PARENT)
      await gotoApp('/profile')
      const item = await menuItem(page)
      await expect(item).toBeVisible()
      await expect(item).toContainText('Jemput Ibu Bapa')
      await expect(item).toHaveAttribute('href', '/jemput-ibu-bapa')
      await item.click()
      await expect(page).toHaveURL('/jemput-ibu-bapa')
      await expect(page.getByTestId('jemput-hero')).toBeVisible()
      const current = await menuItem(page)
      await expect(current).toHaveClass(/\bactive\b/)
    },
  )

  test(
    'E2E-L45-24 responsive sweep of S1 with and without parents',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      test.slow()
      await gotoApp('/login')
      for (const [who, withParents] of [
        [STUDENT_WITH_PARENT, true],
        [STUDENT_NO_PARENT, false],
      ] as const) {
        await mock.setUser(who)
        for (const width of [320, 375, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 })
          await gotoApp('/jemput-ibu-bapa')
          await expect(page.getByTestId('jemput-hero')).toBeVisible()
          await expect(
            withParents ? page.getByTestId('jemput-parent') : page.getByTestId('jemput-empty'),
          ).toBeVisible()
          await expectNoHorizontalScroll(page)

          // Taps >= 44px.
          for (const id of ['jemput-copy', 'jemput-whatsapp', 'jemput-regenerate', 'jemput-url']) {
            await expectTouchTarget(page.getByTestId(id))
          }

          // Buttons stack below sm and sit side by side from sm.
          const wa = (await page.getByTestId('jemput-whatsapp').boundingBox())!
          const regen = (await page.getByTestId('jemput-regenerate').boundingBox())!
          if (width < SM_MIN_WIDTH) {
            expect(regen.y).toBeGreaterThan(wa.y + wa.height - 1)
            const card = (await page.getByTestId('jemput-link-card').boundingBox())!
            expect(wa.width).toBeGreaterThan(card.width * 0.8)
          } else {
            expect(Math.abs(regen.y - wa.y)).toBeLessThan(2)
          }

          // The long URL scrolls inside its field, not the page.
          if (width <= 375) {
            const overflow = await field(page).evaluate((el) => el.scrollWidth - el.clientWidth)
            expect(overflow).toBeGreaterThan(0)
          }

          // No content text below 12px.
          const tooSmall = await page.getByTestId('jemput-page').evaluate((root) => {
            const bad: string[] = []
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              const text = (n.textContent ?? '').trim()
              const el = n.parentElement
              if (!text || !el) continue
              if (parseFloat(getComputedStyle(el).fontSize) < 12) bad.push(text)
            }
            return bad
          })
          expect(tooSmall).toEqual([])

          if (withParents) {
            const name = page.getByTestId('jemput-parent-name')
            expect(await name.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis')
          }
        }
      }
    },
  )

  test(
    'E2E-L45-24 the success flash and the regenerate error do not widen the page',
    tagP(PROPOSED),
    async ({ page, loginAs, gotoApp, mock }) => {
      await page.setViewportSize({ width: 320, height: 800 })
      await loginAs(STUDENT_NO_PARENT)
      await gotoApp('/jemput-ibu-bapa')
      await page.getByTestId('jemput-regenerate').click()
      await expect(page.getByTestId('jemput-flash')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await mock.failNext('POST /api/me/parent-invite/generate', 500)
      await page.getByTestId('jemput-regenerate').click()
      await expect(page.getByTestId('jemput-alert')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )
})
