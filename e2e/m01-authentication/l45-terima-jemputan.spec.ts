/**
 * L45 S2 `/ibu-bapa/terima/:token` (owner M01): E2E-L45-15..23 and the S2 half of 24 (SRS
 * docs/requirements/srs/L45-jemput-ibu-bapa.md §12), on the three projects.
 *
 * OBSERVED on live: the "Link Tidak Sah" page for an admin and for any unknown token (`0000`, `zzzz`,
 * 64 zeros). The guest / parent / non-parent views of it and every valid-token state are PROPOSED
 * or INFERRED, so those tests are `@provisional`.
 *
 * Tokens are fixed with the `setParentInviteToken` hook (any non-empty string), so these tests do not
 * depend on the order of issue. Several roles act in one test, so they use `actAs` (not `loginAs`).
 * Seeds: student 2 `pelajar@demo.test` (school "SMK DEMO", parent 6 linked), student 3
 * `pelajar2@demo.test` (no school, no parent), student 4 `pelajarmaju@demo.test` (parent 6 linked),
 * parent 6 `ibubapa@demo.test` "Ibu Bapa Demo".
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  actAs,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  navigateInApp,
  provisional,
  SM_MIN_WIDTH,
} from '../support'

const ADMIN = 'admin@demo.test'
const PARENT = 'ibubapa@demo.test'
const STUDENT_2 = 'pelajar@demo.test'
const STUDENT_3 = 'pelajar2@demo.test'
const STUDENT_4 = 'pelajarmaju@demo.test'
const TOKEN_2 = 'a2'.repeat(32)
const TOKEN_3 = 'a3'.repeat(32)
const TOKEN_4 = 'a4'.repeat(32)
const INVALID_TITLE = 'Link Tidak Sah — PRESTASIPLUS'
const VALID_TITLE = 'Jemputan Ibu Bapa — PRESTASIPLUS'
const PROPOSED = 'L45 S2 valid-token states are PROPOSED from the reference rebuild (SRS §3, D23a)'
const INFERRED = 'L45 S2 behaviour is INFERRED (SRS §3)'
const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'
const OTHER_TEXT =
  'Anda kini log masuk sebagai akaun yang bukan Ibu Bapa. Untuk berhubung dengan pelajar ini, sila log keluar dan log masuk semula menggunakan akaun Ibu Bapa anda.'
const GUEST_TEXT =
  'Untuk memantau kemajuan pembelajaran anak anda di PRESTASIPLUS, sila log masuk menggunakan akaun Ibu Bapa anda. Selepas log masuk, buka semula pautan jemputan ini untuk mengesahkan hubungan.'

const tag = [moduleTag(1)]
const tagP = (reason: string) => provisional(reason)

type Mock = Parameters<typeof actAs>[1] & {
  hook: <T>(name: string, ...args: unknown[]) => Promise<T>
}
type Goto = (path: string) => Promise<void>

/** Fixes a student's invite token, with the mock up (opens `/login` first). */
async function seedTokens(gotoApp: Goto, mock: Mock): Promise<void> {
  await gotoApp('/login')
  await mock.hook('setParentInviteToken', 2, TOKEN_2)
  await mock.hook('setParentInviteToken', 3, TOKEN_3)
  await mock.hook('setParentInviteToken', 4, TOKEN_4)
}

async function expectInvalidPage(page: Page): Promise<void> {
  await expectTabTitle(page, INVALID_TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Link Tidak Sah')
  const root = page.getByTestId('invite-invalid')
  await expect(root).toContainText('Link jemputan ini tidak sah atau telah tamat tempoh.')
  await expect(page.getByTestId('invite-invalid-icon')).toBeVisible()
  await expect(page.getByTestId('invite-invalid-info')).toHaveText(
    'Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu.',
  )
  await expect(page.getByTestId('invite-invalid-info').locator('svg')).toHaveCount(1)
  const login = page.getByTestId('invite-invalid-login')
  await expect(login).toHaveText('Log Masuk')
  await expect(login).toHaveAttribute('href', '/login')
  await expect(login.locator('svg')).toHaveCount(1)
  const home = page.getByTestId('invite-invalid-home')
  await expect(home).toHaveText('Laman Utama')
  await expect(home).toHaveAttribute('href', '/')
  await expect(home.locator('svg')).toHaveCount(1)
  const footer = page.getByTestId('invite-invalid-footer')
  await expect(footer).toHaveText('PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia')
  await expect(footer).toHaveAttribute('href', '/')
  await expect(footer.locator('svg')).toHaveCount(1)
  await expectTouchTarget(login)
  await expectTouchTarget(home)
  await expectTouchTarget(footer)
  // The standalone page has no shell.
  await expect(page.locator('[data-layout="user"], [data-layout="admin"]')).toHaveCount(0)
  await expectNoHorizontalScroll(page)
}

async function parentsOf(
  page: Page,
  mock: Mock,
  gotoApp: Goto,
  student: string,
): Promise<string[]> {
  await actAs(page, mock, gotoApp, student, '/jemput-ibu-bapa')
  await expect(page.getByTestId('jemput-hero')).toBeVisible()
  return page.getByTestId('jemput-parent-name').allInnerTexts()
}

test.describe('L45 S2 /ibu-bapa/terima/:token', { tag }, () => {
  // Several tests boot the app more than once; a boot takes up to ~6 s (more when workers compete).
  test.describe.configure({ timeout: 90_000 })
  test.use({ mockInit: { latency: 0 } })

  test('E2E-L45-15 admin: "0000" shows the exact "Link Tidak Sah" page (OBSERVED)', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, ADMIN, '/ibu-bapa/terima/0000')
    await expectInvalidPage(page)
    await expect(page).toHaveURL('/ibu-bapa/terima/0000')
    if ((page.viewportSize()?.width ?? 0) >= SM_MIN_WIDTH) {
      // terima-invalid-token-desktop.png: the card is about 448px wide and centred.
      const box = (await page.getByTestId('invite-invalid-login').boundingBox())!
      const viewport = page.viewportSize()!
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2)
      expect(box.width).toBeGreaterThan(380)
      expect(box.width).toBeLessThanOrEqual(448)
    }
    // The buttons work.
    await page.getByTestId('invite-invalid-login').click()
    await expect(page).toHaveURL('/login')
  })

  test(
    'E2E-L45-15 guest: "0000" shows the same page (INFERRED)',
    tagP(INFERRED),
    async ({ page, gotoApp }) => {
      await gotoApp('/ibu-bapa/terima/0000')
      await expectInvalidPage(page)
      await page.getByTestId('invite-invalid-home').click()
      await expect(page).not.toHaveURL(/terima/)
    },
  )

  test(
    'E2E-L45-15 parent: "0000" shows the same page (INFERRED)',
    tagP(INFERRED),
    async ({ page, gotoApp, mock }) => {
      await gotoApp('/login')
      await actAs(page, mock, gotoApp, PARENT, '/ibu-bapa/terima/0000')
      await expectInvalidPage(page)
    },
  )

  test(
    'E2E-L45-16 a link of a deactivated student is "Link Tidak Sah"',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      test.slow()
      await seedTokens(gotoApp, mock)
      await actAs(page, mock, gotoApp, null, `/ibu-bapa/terima/${TOKEN_3}`)
      await expect(page.getByTestId('invite-heading')).toContainText('Pelajar Dua Demo')

      await actAs(page, mock, gotoApp, ADMIN, '/admin/users?role=student')
      await page.getByTestId('users-search').fill('pelajar2@demo.test')
      await page.getByTestId('users-search-submit').click()
      const row = page.getByTestId('user-row').filter({ hasText: 'pelajar2@demo.test' })
      await expect(row).toHaveCount(1)
      const toggle = row.getByTestId('user-toggle')
      await expect(toggle).toHaveText('Aktif')
      page.once('dialog', (dialog) => void dialog.accept())
      await toggle.click()
      await expect(toggle).toHaveText('Tidak')

      await actAs(page, mock, gotoApp, null, `/ibu-bapa/terima/${TOKEN_3}`)
      await expectInvalidPage(page)
    },
  )

  for (const token of ['zzzz', '0'.repeat(64)]) {
    test(`E2E-L45-17 "${token.slice(0, 8)}${token.length > 8 ? '…' : ''}" shows the same "Link Tidak Sah" page (OBSERVED)`, async ({
      page,
      gotoApp,
      mock,
    }) => {
      await gotoApp('/login')
      await actAs(page, mock, gotoApp, ADMIN, `/ibu-bapa/terima/${token}`)
      await expectInvalidPage(page)
      await expect(page).toHaveURL(`/ibu-bapa/terima/${token}`)
      await expect(page.getByTestId('invite-valid')).toHaveCount(0)
    })
  }

  for (const [label, token, student, school] of [
    ['student 2 (with school)', TOKEN_2, 'Pelajar Demo', 'SMK DEMO'],
    ['student 3 (no school)', TOKEN_3, 'Pelajar Dua Demo', null],
  ] as const) {
    test(
      `E2E-L45-18 guest opens the link of ${label}`,
      tagP(PROPOSED),
      async ({ page, gotoApp, mock }) => {
        await seedTokens(gotoApp, mock)
        await actAs(page, mock, gotoApp, null, `/ibu-bapa/terima/${token}`)
        await expectTabTitle(page, VALID_TITLE)
        await expect(page.getByTestId('invite-initials')).toHaveText('PD')
        await expect(page.getByTestId('invite-eyebrow')).toHaveText('Jemputan Ibu Bapa')
        await expect(page.getByTestId('invite-heading')).toHaveText(
          `Anda dijemput untuk memantau kemajuan ${student}`,
        )
        if (school) await expect(page.getByTestId('invite-school')).toHaveText(school)
        else await expect(page.getByTestId('invite-school')).toHaveCount(0)
        await expect(page.getByTestId('invite-guest-text')).toHaveText(GUEST_TEXT)
        const login = page.getByTestId('invite-login')
        await expect(login).toHaveText('Log Masuk Sebagai Ibu Bapa')
        await expect(login).toHaveAttribute('href', '/login')
        await expect(page.getByTestId('invite-register-note')).toHaveText(
          'Belum mempunyai akaun Ibu Bapa? Daftar akaun Ibu Bapa terlebih dahulu, kemudian buka semula pautan jemputan ini.',
        )
        await expect(page.getByTestId('invite-register-link')).toHaveText('Daftar akaun Ibu Bapa')
        await expect(page.getByTestId('invite-register-link')).toHaveAttribute('href', '/register')
        await expect(page.getByTestId('invite-caption')).toHaveText(
          `Pautan jemputan ini dikongsi oleh ${student} melalui PRESTASIPLUS.`,
        )
        await expect(page.getByTestId('invite-back')).toHaveText('PRESTASIPLUS')
        await expect(page.getByTestId('invite-back')).toHaveAttribute('href', '/')
        await expectNoHorizontalScroll(page)

        // Nothing was linked.
        const parents = await parentsOf(
          page,
          mock,
          gotoApp,
          student === 'Pelajar Demo' ? STUDENT_2 : STUDENT_3,
        )
        expect(parents).toEqual(student === 'Pelajar Demo' ? ['Ibu Bapa Demo'] : [])

        // The CTA and the register link navigate.
        await actAs(page, mock, gotoApp, null, `/ibu-bapa/terima/${token}`)
        await page.getByTestId('invite-register-link').click()
        await expect(page).toHaveURL('/register')
      },
    )
  }

  test(
    'E2E-L45-19 guest hand-off: log in as the parent from the CTA, land on the landing page, reopen the link',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      test.slow()
      await seedTokens(gotoApp, mock)
      await actAs(page, mock, gotoApp, null, `/ibu-bapa/terima/${TOKEN_3}`)
      await page.getByTestId('invite-login').click()
      await expect(page).toHaveURL('/login')
      await page.getByTestId('login-email').fill(PARENT)
      await page.getByTestId('login-password').fill('Demo1234')
      await page.getByTestId('login-submit').click()
      // The requested URL is ignored (M01 BR-08): the parent lands on the role landing page.
      await expect(page).toHaveURL('/dashboard')
      await gotoApp(`/ibu-bapa/terima/${TOKEN_3}`)
      await expect(page.getByTestId('invite-eyebrow')).toHaveText('Berjaya Berhubung')
      await expect(page.getByTestId('invite-linked-box')).toBeVisible()
    },
  )

  test(
    'E2E-L45-20 a logged-in parent is linked: eyebrow, heading, green box, profile link, the link exists',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      test.slow()
      await seedTokens(gotoApp, mock)
      await actAs(page, mock, gotoApp, PARENT, `/ibu-bapa/terima/${TOKEN_3}`)
      await expectTabTitle(page, VALID_TITLE)
      await expect(page.getByTestId('invite-eyebrow')).toHaveText('Berjaya Berhubung')
      await expect(page.getByTestId('invite-heading')).toHaveText(
        'Anda kini berhubung dengan Pelajar Dua Demo',
      )
      await expect(page.getByTestId('invite-linked-box')).toHaveText(
        'Akaun anda (Ibu Bapa Demo) telah dihubungkan dengan pelajar ini. Anda kini boleh memantau kemajuan mereka.',
      )
      const profile = page.getByTestId('invite-profile-link')
      await expect(profile).toHaveText('Lihat Profil Kemajuan')
      await expect(profile).toHaveAttribute('href', '/pelajar/3')
      await expectTouchTarget(profile)
      await expect(page.getByTestId('invite-caption')).toHaveText(
        'Pautan jemputan ini dikongsi oleh Pelajar Dua Demo melalui PRESTASIPLUS.',
      )
      await expectNoHorizontalScroll(page)
      expect(await parentsOf(page, mock, gotoApp, STUDENT_3)).toEqual(['Ibu Bapa Demo'])
    },
  )

  test(
    'E2E-L45-21 reopening or refreshing never duplicates the link; a second student adds a second link',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      test.slow()
      await seedTokens(gotoApp, mock)
      await actAs(page, mock, gotoApp, PARENT, `/ibu-bapa/terima/${TOKEN_3}`)
      await expect(page.getByTestId('invite-linked-box')).toBeVisible()
      await gotoApp(`/ibu-bapa/terima/${TOKEN_3}`) // reload
      await expect(page.getByTestId('invite-linked-box')).toBeVisible()
      // Student 4 is already linked to parent 6 (seed): still one row, and the page still ends linked.
      await gotoApp(`/ibu-bapa/terima/${TOKEN_4}`)
      await expect(page.getByTestId('invite-heading')).toHaveText(
        'Anda kini berhubung dengan Pelajar Maju Demo',
      )
      expect(await parentsOf(page, mock, gotoApp, STUDENT_3)).toEqual(['Ibu Bapa Demo'])
      expect(await parentsOf(page, mock, gotoApp, STUDENT_4)).toEqual(['Ibu Bapa Demo'])
      // A second student for the same parent (student 2) keeps the first link.
      await actAs(page, mock, gotoApp, PARENT, `/ibu-bapa/terima/${TOKEN_2}`)
      await expect(page.getByTestId('invite-linked-box')).toBeVisible()
      expect(await parentsOf(page, mock, gotoApp, STUDENT_2)).toEqual(['Ibu Bapa Demo'])
      expect(await parentsOf(page, mock, gotoApp, STUDENT_3)).toEqual(['Ibu Bapa Demo'])
    },
  )

  test(
    'E2E-L45-22 a failed accept keeps the valid card, shows the alert and links nothing',
    tagP(INFERRED),
    async ({ page, gotoApp, mock }) => {
      await seedTokens(gotoApp, mock)
      await actAs(page, mock, gotoApp, PARENT, '/profile')
      // `failNext` lives in the page, so the accept is reached by a client-side navigation.
      await mock.failNext('POST /api/parent-invites/:token/accept', 500)
      await navigateInApp(page, `/ibu-bapa/terima/${TOKEN_3}`)
      await expect(page.getByTestId('invite-accept-alert')).toContainText(GENERIC_ERROR)
      await expect(page.getByTestId('invite-eyebrow')).toHaveText('Jemputan Ibu Bapa')
      await expect(page.getByTestId('invite-linked-box')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      expect(await parentsOf(page, mock, gotoApp, STUDENT_3)).toEqual([])
    },
  )

  test(
    'E2E-L45-23 a logged-in non-parent is told to switch account; the button logs out to /login',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      await seedTokens(gotoApp, mock)
      await actAs(page, mock, gotoApp, STUDENT_2, `/ibu-bapa/terima/${TOKEN_3}`)
      await expect(page.getByTestId('invite-eyebrow')).toHaveText('Jemputan Ibu Bapa')
      await expect(page.getByTestId('invite-other-text')).toHaveText(OTHER_TEXT)
      await expect(page.getByTestId('invite-other-text').locator('strong')).toHaveText(
        'bukan Ibu Bapa',
      )
      const button = page.getByTestId('invite-switch')
      await expect(button).toHaveText('Log Keluar & Log Masuk Sebagai Ibu Bapa')
      await expectTouchTarget(button)
      await expectNoHorizontalScroll(page)
      await button.click()
      await expect(page).toHaveURL('/login')
      expect(await page.evaluate(() => localStorage.getItem('pp.auth'))).toBeNull()
      // No link was created.
      expect(await parentsOf(page, mock, gotoApp, STUDENT_3)).toEqual([])
    },
  )

  test(
    'E2E-L45-24 responsive sweep of S2: invalid, guest and linked at 320 / 375 / 768 / 1280',
    tagP(PROPOSED),
    async ({ page, gotoApp, mock }) => {
      test.slow()
      await seedTokens(gotoApp, mock)
      const states: [string | null, string, string][] = [
        [null, '0000', 'invite-invalid'],
        [null, TOKEN_3, 'invite-guest-text'],
        [PARENT, TOKEN_3, 'invite-linked-box'],
        [STUDENT_2, TOKEN_3, 'invite-other-text'],
      ]
      for (const [who, token, marker] of states) {
        for (const width of [320, 375, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 })
          await actAs(page, mock, gotoApp, who, `/ibu-bapa/terima/${token}`)
          await expect(page.getByTestId(marker)).toBeVisible()
          await expectNoHorizontalScroll(page)
          // Every link and button >= 44px; buttons are full width of the card below sm.
          const targets = page.locator('main a, main button')
          const count = await targets.count()
          for (let i = 0; i < count; i++) await expectTouchTarget(targets.nth(i))
          // No text below 12px.
          const tooSmall = await page.locator('main').evaluate((root) => {
            const bad: string[] = []
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              const text = (n.textContent ?? '').trim()
              const el = n.parentElement
              if (text && el && parseFloat(getComputedStyle(el).fontSize) < 12) bad.push(text)
            }
            return bad
          })
          expect(tooSmall).toEqual([])
          // The card keeps at least 12px of margin at 320.
          const card = page.locator('main > div').first()
          const box = (await card.boundingBox())!
          expect(box.x).toBeGreaterThanOrEqual(12)
          expect(box.x + box.width).toBeLessThanOrEqual(width - 12)
          expect(box.width).toBeLessThanOrEqual(512)
        }
      }
    },
  )
})
