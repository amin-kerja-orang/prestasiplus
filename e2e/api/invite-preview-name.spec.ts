/**
 * @api SW4-05 `/ibu-bapa/terima/:token` against the REAL API: the contract preview carries
 * `student.firstName` and `schoolName` only (D57f), so the page must show the first name in the
 * heading and the caption and initials in the avatar (not "...kemajuan" with nothing after it).
 *
 * The invite is NOT accepted (no parent/child link is written). The seed student's link is read from
 * `/jemput-ibu-bapa`; when only a hash is held (the clear token is never returned again, D58) a new
 * link is generated, which rotates the seed student's token (see the warning in
 * `jemput-ibu-bapa.spec.ts`).
 */

import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, newPeerContext } from './helpers'

const TOKEN_IN_LINK = /\/ibu-bapa\/terima\/([0-9a-f]{64})$/

test.describe('invite preview shows the student name @api', () => {
  test.setTimeout(90_000)

  test('a guest sees the first name in heading and caption, and initials in the avatar @api', async ({
    page,
    browser,
  }, info) => {
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
    await gotoApi(page, '/jemput-ibu-bapa')

    const field = page.getByTestId('jemput-url')
    await expect(page.getByTestId('jemput-link-card')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('jemput-regenerate')).toBeEnabled({ timeout: 20_000 })
    if ((await field.inputValue()) === '') {
      await page.getByTestId('jemput-regenerate').click()
      await expect(page.getByTestId('jemput-flash')).toBeVisible()
    }
    await expect(field).toHaveValue(TOKEN_IN_LINK, { timeout: 20_000 })
    const token = TOKEN_IN_LINK.exec(await field.inputValue())?.[1]
    expect(token, 'the invite link carries a 64-hex token').toBeTruthy()

    // The expected first name comes from the API (the student's own profile), not from the spec.
    const me = await page.request.get('/api/me')
    expect(me.status(), 'GET /api/me').toBe(200)
    const profile = ((await me.json()) as { data: { name?: string; fullName?: string } }).data
    const fullName = (profile.name ?? profile.fullName ?? '').trim()
    expect(fullName, 'GET /api/me returns the student name').not.toBe('')

    const guest = await newPeerContext(browser, info)
    try {
      const view = await guest.newPage()

      // The contract preview body: the first name is what the page must show.
      const preview = await guest.request.get(`/api/parent-invites/${token}`)
      expect(preview.status(), 'GET /api/parent-invites/:token').toBe(200)
      const body = ((await preview.json()) as { data: { student: { firstName: string } } }).data
      const firstName = body.student.firstName
      expect(firstName, 'preview carries the first name').toBeTruthy()
      expect(fullName.toLowerCase()).toContain(firstName.toLowerCase())

      await gotoApi(view, `/ibu-bapa/terima/${token}`)
      const heading = view.getByTestId('invite-heading')
      await expect(heading).toBeVisible({ timeout: 20_000 })
      await expect(heading).toContainText(`Anda dijemput untuk memantau kemajuan ${firstName}`)

      const caption = view.getByTestId('invite-caption')
      await expect(caption).toContainText(`dikongsi oleh ${firstName} melalui PRESTASIPLUS`)
      expect(await caption.innerText()).not.toMatch(/oleh\s{2,}melalui/)

      const initials = view.getByTestId('invite-initials')
      await expect(initials).toBeVisible()
      await expect(initials).not.toHaveText('')
      expect((await initials.innerText()).trim()).toBe(firstName.charAt(0).toUpperCase())

      await expect(view.getByTestId('invite-guest-text')).toBeVisible()
      await expectNoHScroll(view)
    } finally {
      await guest.close()
    }
  })
})
