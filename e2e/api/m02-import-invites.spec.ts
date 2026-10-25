/**
 * @api M02 imports, parent invites and complimentary students (Admin Pusat) against the REAL API (EX-4),
 * at 375 / 768 / 1280.
 *
 * What each test proves (UAT / finding in brackets):
 *  - IMP-01  bulk import of two Guru from pasted lines: the school picker list is painted in the flow (SWX-4),
 *            the one-time passwords are shown for both rows, the accounts exist, a second import of the same
 *            lines creates nothing ("dilangkau") and shows no passwords (BR-14, D59b)
 *  - IMP-02  import caps: 1000 lines are accepted, 1001 lines and more than 1 MB are refused with the BM
 *            message, a file over 1 MB is 413; an empty paste shows the red alert and keeps the role (FR-M02-55)
 *  - IMP-03  DELIMa student import follows the school subscription quota: no subscription is refused, a quota
 *            of 2 takes two pupils, the third is refused "Kuota tidak mencukupi." (BR-15..17, FR-M02-58/59)
 *  - PAR-01  parent invite: the pupil issues a link, the guest preview shows the first name, the parent accepts,
 *            the link is single use, the pupil page lists the parent, Admin Pusat sees the link, a new link
 *            makes the old one invalid ("Link Tidak Sah"), unlinking removes it (D23, D57f, D58)
 *  - PAR-02  creating a Ibu Bapa with the student linker: the result list is painted in the flow and the link is
 *            stored (SWX-4, SWX-2 string ids)
 *  - COMP-01 Pelajar Komplimen: the list loads from the API and the create page opens (UAT-ADM-13)
 *  - COMP-02 registering a pupil from the form: `test.fail()`, BUG BE `lookups.controller.ts:42-47`, the teacher
 *            classes endpoint always answers [] so the class select is empty (BR-18, FR-M02-71)
 *  - COMP-03 a pupil registered over the API is listed with a masked IC and coins off; coins go on in bulk (ids are strings)
 *
 * Data written: everything is created by the test with fictitious names and `@example.test` / `@moe-dl.edu.my`
 * addresses, unique per run, project and test, and removed again (also on failure): accounts are deleted,
 * subscriptions cancelled (a cancelled row stays in the list), links removed. Imports and invites have per-user
 * hourly rate limits, so the tests that import sign in as a throw-away Admin Pusat (own bucket), and the invites
 * are issued by a throw-away pupil. Generated passwords exist in memory only: never logged, attached or written.
 * Seed accounts and the password come from `./helpers` (`account()`); the password is never written here.
 */

import { expect, test, type Page } from '@playwright/test'

import { gotoApi, loginViaUi } from '../fixtures/api'
import { account, expectNoHScroll, newPeerContext } from './helpers'
import {
  cancelOpenSubscriptions,
  createTempAdmin,
  createUser,
  dataOf,
  isPainted,
  openApiSession,
  openTempSession,
  removeUsers,
  stamp,
  type ApiErrorBody,
  type TempUser,
} from './m02-m17-support'

interface WireUser {
  id: string
  name: string
  email: string
  roles: string[]
  school: { id: string; name: string } | null
  linkedStudents?: { id?: string; studentId?: string; name?: string }[]
}

interface ImportBody {
  data: {
    created: number
    skipped: number
    failed: number
    errors: { line: number; message: string }[]
    credentials?: { line: number; email: string; generatedPassword: string }[]
  }
  status: string
}

const SUB_SCHOOL = 'SK Demo Tiga'

/** Signs the page in as an account made by `createUser` / `createTempAdmin`. */
async function signInAs(page: Page, user: TempUser): Promise<void> {
  await loginViaUi(page, user.email, user.password)
}

test.describe('M02 bulk user import (Admin Pusat) @api', () => {
  test.setTimeout(150_000)

  test('IMP-01 import two Guru from pasted lines, then the same lines again @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    const temp = await createTempAdmin(admin, info)
    const key = stamp(info)
    const emails = [`guru.import.a${key}@example.test`, `guru.import.b${key}@example.test`]
    try {
      await signInAs(page, temp)
      await gotoApi(page, '/admin/users/bulk-import')
      await expect(page.getByTestId('bulk-form')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId('bulk-default-password')).toHaveCount(0)

      await page.locator('label', { hasText: /^Guru$/ }).click()
      await page.getByTestId('bulk-school-search').fill('Demo Dua')
      const result = page.getByTestId('bulk-school-result').filter({ hasText: 'SK Demo Dua' })
      await expect(result).toBeVisible({ timeout: 15_000 })
      expect(await isPainted(result), 'the school result is not clipped by the form card').toBe(
        true,
      )
      await result.click()

      const lines = [
        `Guru Import A ${key}, ${emails[0]}, 0123456789`,
        `Guru Import B ${key}, ${emails[1]}`,
      ]
      await page.getByTestId('import-paste').fill(lines.join('\n'))
      await expectNoHScroll(page)

      const imported = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/users/bulk-import' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      const res = await imported
      expect(res.status(), 'POST /api/admin/users/bulk-import').toBe(200)
      const body = (await res.json()) as ImportBody
      expect(body.data).toMatchObject({ created: 2, skipped: 0, failed: 0 })
      expect(body.data.credentials?.map((c) => c.email)).toEqual(emails)

      // One-time passwords for both rows; the form was reset.
      await expect(page.getByTestId('bulk-credentials')).toBeVisible()
      await expect(page.getByTestId('credential-row')).toHaveCount(2)
      for (const email of emails) {
        await expect(
          page.getByTestId('credential-row-email').filter({ hasText: email }),
        ).toHaveCount(1)
      }
      for (const pw of await page.getByTestId('credential-row-password').allTextContents()) {
        expect(pw.trim().length, 'a generated password per row').toBeGreaterThan(7)
      }
      await expect(page.getByTestId('import-paste')).toHaveValue('')
      await expectNoHScroll(page)

      // The accounts exist as Guru of SK Demo Dua.
      for (const email of emails) {
        const found = (
          (await admin.get(`/api/admin/users?search=${encodeURIComponent(email)}`)).body as {
            data: WireUser[]
          }
        ).data
        expect(found, `${email} exists`).toHaveLength(1)
        expect(found[0]).toMatchObject({ roles: ['teacher'], school: { name: 'SK Demo Dua' } })
      }

      // The same lines again: skipped, no passwords.
      await page.locator('label', { hasText: /^Guru$/ }).click()
      await page.getByTestId('bulk-school-search').fill('Demo Dua')
      await page.getByTestId('bulk-school-result').filter({ hasText: 'SK Demo Dua' }).click()
      await page.getByTestId('import-paste').fill(lines.join('\n'))
      const again = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/users/bulk-import' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      const second = (await (await again).json()) as ImportBody
      expect(second.data).toMatchObject({ created: 0, skipped: 2, failed: 0 })
      expect(second.status).toContain('dilangkau')
      await expect(page.getByTestId('credential-row')).toHaveCount(0)
    } finally {
      const ids: string[] = []
      for (const email of emails) {
        const found = (
          (await admin.get(`/api/admin/users?search=${encodeURIComponent(email)}`)).body as {
            data: WireUser[]
          }
        ).data
        ids.push(...found.map((u) => u.id))
      }
      await removeUsers(admin, [...ids, temp.id])
      await admin.dispose()
    }
  })

  test('IMP-02 the import caps and the empty paste are refused with BM messages @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    const temp = await createTempAdmin(admin, info)
    try {
      const own = await openTempSession(browser, info, temp)
      try {
        // Lines that are not e-mail addresses: even if a cap were missing, nothing would be created.
        const rows = (n: number) =>
          Array.from({ length: n }, (_, i) => `Baris ${i}, tidak-sah-${i}`).join('\n')
        const base = { role: 'teacher', schoolId: '2', importMode: 'paste' }

        const atCap = await own.send('POST', '/api/admin/users/bulk-import', {
          ...base,
          pasteContent: rows(1000),
        })
        expect(atCap.status, '1000 lines are accepted').toBe(200)
        expect((atCap.body as ImportBody).data).toMatchObject({ created: 0 })

        const over = await own.send('POST', '/api/admin/users/bulk-import', {
          ...base,
          pasteContent: rows(1001),
        })
        expect(over.status, '1001 lines are refused').toBe(422)
        expect((over.body as ApiErrorBody).error.fields?.pasteContent).toContain('1000 baris')

        const big = await own.send('POST', '/api/admin/users/bulk-import', {
          ...base,
          pasteContent: 'a'.repeat(1_100_000),
        })
        expect(big.status, 'more than 1 MB is refused').toBe(422)
        expect((big.body as ApiErrorBody).error.fields?.pasteContent).toContain('1 MB')
      } finally {
        await own.dispose()
      }

      // A file over 1 MB is 413 (multipart).
      const context = await newPeerContext(browser, info)
      try {
        const login = await context.request.post('/api/auth/login', {
          data: { identifier: temp.email, password: temp.password },
        })
        expect(login.status()).toBe(200)
        const csrf = (
          (await (await context.request.get('/api/session')).json()) as { data: { csrf: string } }
        ).data.csrf
        const file = await context.request.post('/api/admin/users/bulk-import', {
          headers: { 'x-csrf-token': csrf },
          multipart: {
            role: 'teacher',
            schoolId: '2',
            importMode: 'csv',
            csvFile: {
              name: 'besar.csv',
              mimeType: 'text/csv',
              buffer: Buffer.from('a'.repeat(1_200_000)),
            },
          },
        })
        expect(file.status(), 'a CSV file over 1 MB').toBe(413)
      } finally {
        await context.close()
      }

      // The screen: a role and no data shows the API message and keeps the role.
      await signInAs(page, temp)
      await gotoApi(page, '/admin/users/bulk-import')
      await expect(page.getByTestId('bulk-form')).toBeVisible({ timeout: 20_000 })
      await page.locator('label', { hasText: /^Ibu Bapa$/ }).click()
      const refused = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/users/bulk-import' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      expect((await refused).status(), 'no data is a validation error').toBe(422)
      const alert = page.getByTestId('bulk-alert')
      await expect(alert).toBeVisible({ timeout: 15_000 })
      expect(((await alert.textContent()) ?? '').toLowerCase()).not.toContain(
        'the given data was invalid',
      )
      await expect(page.getByTestId('bulk-credentials')).toHaveCount(0)
      await expectNoHScroll(page)
    } finally {
      await removeUsers(admin, [temp.id])
      await admin.dispose()
    }
  })

  test('IMP-03 the DELIMa student import follows the subscription quota @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    const temp = await createTempAdmin(admin, info)
    const key = stamp(info)
    const mail = (n: number) => `m-uji${key}${n}@moe-dl.edu.my`
    const block = (n: number) => `MURID UJIAN IMPORT ${n} ${key}\n${mail(n)}\nkatalaluan${n}`
    try {
      const schoolId = await cancelOpenSubscriptions(admin, SUB_SCHOOL)
      await signInAs(page, temp)
      await gotoApi(page, '/admin/import-students')
      await expect(page.getByTestId('student-form')).toBeVisible({ timeout: 20_000 })

      const pickSchool = async () => {
        await page.getByTestId('admin-school-search').fill('Demo Tiga')
        const found = page.getByTestId('admin-school-result').filter({ hasText: SUB_SCHOOL })
        await expect(found).toBeVisible({ timeout: 15_000 })
        expect(await isPainted(found), 'the school result is not clipped by the card').toBe(true)
        await found.click()
        await expect(page.getByTestId('admin-school-chip')).toBeVisible()
      }

      // 1. No subscription: the quota panel says so and the import is refused.
      await pickSchool()
      await expect(page.getByTestId('quota-none')).toBeVisible({ timeout: 15_000 })
      await page.locator('label', { hasText: 'Darjah 3' }).click()
      await page.getByTestId('import-paste').fill(block(1))
      const noSub = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/students/import' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      expect((await noSub).status(), 'no subscription').toBe(422)
      await expect(page.getByTestId('student-alert')).toContainText('tiada langganan aktif', {
        timeout: 15_000,
      })
      await expectNoHScroll(page)

      // 2. A subscription with room for two more pupils.
      const packages = dataOf<{ id: string; formLevel: string }[]>(
        await admin.get('/api/admin/school-packages'),
        'GET school-packages',
      )
      const primary = packages.find((p) => p.formLevel === 'd1_d6') ?? packages[0]!
      const probe = dataOf<{ id: string; used: number }>(
        await admin.send('POST', '/api/admin/school-subscriptions', {
          schoolId,
          packageTier: 'basic',
          schoolPackageId: primary.id,
          studentQuota: 1,
        }),
        'POST school-subscriptions',
      )
      // Re-create it with the quota the school already uses plus two.
      await admin.send('POST', `/api/admin/school-subscriptions/${probe.id}/cancel`)
      dataOf(
        await admin.send('POST', '/api/admin/school-subscriptions', {
          schoolId,
          packageTier: 'basic',
          schoolPackageId: primary.id,
          studentQuota: probe.used + 2,
        }),
        'POST school-subscriptions (quota)',
      )

      await page.reload()
      await expect(page.getByTestId('student-form')).toBeVisible({ timeout: 20_000 })
      await pickSchool()
      await expect(page.getByTestId('quota-summary')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('quota-none')).toHaveCount(0)
      await page.locator('label', { hasText: 'Darjah 3' }).click()
      await page.getByTestId('import-paste').fill(`${block(1)}\n\n${block(2)}`)
      const two = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/students/import' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      const twoRes = await two
      expect(twoRes.status(), 'two pupils within the quota').toBe(200)
      expect(((await twoRes.json()) as ImportBody).data).toMatchObject({
        created: 2,
        skipped: 0,
        failed: 0,
      })
      const quota = dataOf<{ remaining: number }>(
        await admin.get(`/api/admin/schools/${schoolId}/quota`),
        'GET quota',
      )
      expect(quota.remaining, 'the quota is used up').toBe(0)

      // 3. The third pupil does not fit.
      await pickSchool()
      await page.locator('label', { hasText: 'Darjah 3' }).click()
      await page.getByTestId('import-paste').fill(block(3))
      const three = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/students/import' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Import', exact: true }).click()
      expect((await three).status(), 'over the quota').toBe(422)
      await expect(page.getByTestId('student-alert')).toContainText('Kuota tidak mencukupi', {
        timeout: 15_000,
      })
      await expect(page.getByTestId('import-paste'), 'the input is kept').toHaveValue(block(3))
      await expectNoHScroll(page)
    } finally {
      const ids: string[] = []
      for (const n of [1, 2, 3]) {
        const found = (
          (await admin.get(`/api/admin/users?search=${encodeURIComponent(mail(n))}`)).body as {
            data: WireUser[]
          }
        ).data
        ids.push(...found.map((u) => u.id))
      }
      await removeUsers(admin, [...ids, temp.id])
      await cancelOpenSubscriptions(admin, SUB_SCHOOL)
      await admin.dispose()
    }
  })
})

test.describe('M02 parent invites @api', () => {
  test.setTimeout(150_000)

  test('PAR-01 issue, accept, single use, list, regenerate, unlink @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    const pupilAccount = await createUser(
      admin,
      info,
      'student',
      { schoolId: '2', grade: 10 },
      'muridjemput',
    )
    const parentAccount = await createUser(admin, info, 'parent', {}, 'ibujemput')
    const guest = await newPeerContext(browser, info)
    let linkId: string | null = null
    try {
      const pupil = await openTempSession(browser, info, pupilAccount)
      const parent = await openTempSession(browser, info, parentAccount)
      try {
        // A new pupil has no invite yet.
        const none = dataOf<{ hasToken: boolean; parents: unknown[] }>(
          await pupil.get('/api/me/parent-invite'),
          'GET /api/me/parent-invite',
        )
        expect(none.hasToken).toBe(false)
        expect(none.parents).toEqual([])

        // The pupil issues a link (64 hex token) and a guest sees the first name only.
        const issued = dataOf<{ token: string; expiresAt: string }>(
          await pupil.send('POST', '/api/me/parent-invite'),
          'POST /api/me/parent-invite',
        )
        expect(issued.token).toMatch(/^[0-9a-f]{64}$/)
        const preview = await guest.request.get(`/api/parent-invites/${issued.token}`)
        expect(preview.status(), 'guest preview').toBe(200)
        const shown = (
          (await preview.json()) as {
            data: { valid: boolean; student: { firstName: string; schoolName: string } }
          }
        ).data
        expect(shown.valid).toBe(true)
        expect(shown.student.schoolName).toBe('SK Demo Dua')
        expect(
          Object.keys(shown.student).sort(),
          'the preview carries no more than the first name',
        ).toEqual(['firstName', 'schoolName'])

        // The parent accepts; the link is single use.
        const accepted = dataOf<{ linked: boolean; linkId: string }>(
          await parent.send('POST', `/api/parent-invites/${issued.token}/accept`),
          'accept',
        )
        expect(accepted.linked).toBe(true)
        linkId = accepted.linkId
        const reuse = await parent.send('POST', `/api/parent-invites/${issued.token}/accept`)
        expect(reuse.status, 'the used link').toBe(404)
        expect((await guest.request.get(`/api/parent-invites/${issued.token}`)).status()).toBe(404)

        // Both sides and Admin Pusat see the link, with the parent e-mail masked.
        for (const [who, session] of [
          ['pupil', pupil],
          ['parent', parent],
        ] as const) {
          const links = dataOf<{ linkId: string; parent: { emailMasked: string } }[]>(
            await session.get('/api/me/parent-links'),
            `${who} parent-links`,
          )
          expect(links.map((l) => l.linkId)).toContain(linkId)
          expect(links[0]!.parent.emailMasked).not.toBe(parentAccount.email)
        }
        const adminLinks = dataOf<{ linkId: string }[]>(
          await admin.get('/api/admin/parent-links'),
          'admin parent-links',
        )
        expect(adminLinks.map((l) => l.linkId)).toContain(linkId)

        // The pupil's own page lists the parent.
        await signInAs(page, pupilAccount)
        await gotoApi(page, '/jemput-ibu-bapa')
        await expect(page.getByTestId('jemput-parents-card')).toBeVisible({ timeout: 20_000 })
        await expect(page.getByTestId('jemput-parent')).toHaveCount(1, { timeout: 15_000 })
        await expect(page.getByTestId('jemput-parent-name')).toContainText('Ujian ibujemput')
        await expectNoHScroll(page)

        // A new link replaces the old one; the old address is the "Link Tidak Sah" page.
        const fresh = dataOf<{ token: string }>(
          await pupil.send('POST', '/api/me/parent-invite/generate'),
          'generate',
        )
        expect(fresh.token).not.toBe(issued.token)
        const view = await guest.newPage()
        await gotoApi(view, `/ibu-bapa/terima/${issued.token}`)
        await expect(view.getByText('Link Tidak Sah')).toBeVisible({ timeout: 20_000 })
        await expectNoHScroll(view)
        await gotoApi(view, `/ibu-bapa/terima/${fresh.token}`)
        await expect(view.getByTestId('invite-heading')).toBeVisible({ timeout: 20_000 })
        await expectNoHScroll(view)

        // Unlink: the link is gone for both sides.
        const unlinked = await pupil.send('DELETE', `/api/me/parent-links/${linkId}`)
        expect(unlinked.status, 'unlink').toBeLessThan(300)
        linkId = null
        const left = dataOf<unknown[]>(await parent.get('/api/me/parent-links'), 'parent-links')
        expect(left).toEqual([])
        await page.reload()
        await expect(page.getByTestId('jemput-parent')).toHaveCount(0, { timeout: 15_000 })
      } finally {
        if (linkId)
          await pupil.send('DELETE', `/api/me/parent-links/${linkId}`).catch(() => undefined)
        await pupil.dispose()
        await parent.dispose()
      }
    } finally {
      await guest.close()
      await removeUsers(admin, [parentAccount.id, pupilAccount.id])
      await admin.dispose()
    }
  })

  test('PAR-02 creating an Ibu Bapa with the student linker stores the link @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    let parentId: string | null = null
    try {
      const { user, pass } = account('adminPusat')
      await loginViaUi(page, user, pass)
      await gotoApi(page, '/admin/users/create')
      await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('user-role').selectOption('parent')
      const key = stamp(info)
      const email = `ibu.pautan.${key}@example.test`.toLowerCase()
      await page.getByTestId('user-name').fill(`Ibu Pautan ${key}`)
      await page.getByTestId('user-email').fill(email)

      // The linker waits for three characters in http mode; the result list is painted in the flow.
      await page.getByTestId('linker-search').fill('Mur')
      await page.getByTestId('linker-search').fill('Murid Demo Maju')
      const result = page.getByTestId('linker-result').first()
      await expect(result).toBeVisible({ timeout: 15_000 })
      expect(await isPainted(result), 'the student result is not clipped by the form card').toBe(
        true,
      )
      await result.click()
      await expect(page.getByTestId('linker-chip')).toHaveCount(1)
      await expectNoHScroll(page)

      const created = page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/admin/users' && r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Daftar Pengguna' }).click()
      const res = await created
      expect(res.status(), 'POST /api/admin/users').toBe(201)
      const sent = JSON.parse(res.request().postData() ?? '{}') as {
        roles: string[]
        studentIds?: unknown[]
        linkedStudentIds?: unknown[]
      }
      expect(sent.roles).toEqual(['parent'])
      const ids = sent.studentIds ?? sent.linkedStudentIds ?? []
      expect(ids.length, 'one student is linked').toBe(1)
      expect(typeof ids[0], 'student ids go over the wire as strings (SWX-2)').toBe('string')
      parentId = ((await res.json()) as { data: { id: string } }).data.id

      const stored = dataOf<WireUser>(await admin.get(`/api/admin/users/${parentId}`), 'GET parent')
      expect(stored.roles).toEqual(['parent'])
      expect(stored.linkedStudents ?? [], 'the student link is stored').toHaveLength(1)
    } finally {
      if (parentId) await removeUsers(admin, [parentId])
      await admin.dispose()
    }
  })
})

test.describe('M02 complimentary students (Admin Pusat) @api', () => {
  test.setTimeout(150_000)

  /** A fictitious 12 digit IC, unique per call (month 01, day 01 style digits are not validated by the API). */
  const fakeIc = () =>
    `0${String(Date.now()).slice(-5)}${Math.floor(10000 + Math.random() * 89999)}`.slice(0, 12)

  test('COMP-01 the list loads from the API and the create page opens @api', async ({ page }) => {
    const central = account('adminPusat')
    await loginViaUi(page, central.user, central.pass)
    const listed = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/admin/comp-students' && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await gotoApi(page, '/admin/comp-students')
    expect((await listed).status(), 'GET /api/admin/comp-students').toBe(200)
    await expect(page.getByTestId('comp-list-page')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('comp-error')).toHaveCount(0)
    await expect(page.getByTestId('comp-skeleton')).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByTestId('comp-table')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Daftar Baru' }).first()).toBeVisible()
    await expectNoHScroll(page)

    await gotoApi(page, '/admin/comp-students/create')
    await expect(page.getByTestId('comp-form')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('comp-teacher')).toBeVisible()
    await expectNoHScroll(page)
  })

  // KNOWN BUG (BE, M02): GET /api/admin/teachers/:id/classrooms is a stub that always answers `[]`
  // (apps/api/src/modules/users/lookups.controller.ts:42-47, "the classes table arrives with BE-17"; BE-17 has landed).
  // The "Kelas guru" select of S7 therefore never has a class and "Guru ini tiada kelas aktif." shows for a teacher
  // who has active classes, so no complimentary pupil can be registered from the screen. Remove `test.fail()` when
  // the endpoint returns the teacher's active classes.
  test('COMP-02 register one pupil in a teacher class from the form @api', async ({
    page,
    browser,
  }, info) => {
    test.fail(
      true,
      'BUG BE lookups.controller.ts:42-47: admin/teachers/:id/classrooms always answers []',
    )
    const admin = await openApiSession(browser, info, 'adminPusat')
    let compId: string | null = null
    const name = `Murid Komplimen ${stamp(info)}`
    try {
      const teachers = dataOf<{ id: string; email: string }[]>(
        await admin.get('/api/admin/teachers'),
        'GET /api/admin/teachers',
      )
      const demoTeacher = teachers.find((t) => t.email === 'guru@demo.test')
      expect(demoTeacher, 'the seed has the demo teacher').toBeTruthy()
      const classes = dataOf<unknown[]>(
        await admin.get(`/api/admin/teachers/${demoTeacher!.id}/classrooms`),
        'GET teacher classrooms',
      )
      expect(classes.length, 'the demo teacher has active classes').toBeGreaterThan(0)

      const central = account('adminPusat')
      await loginViaUi(page, central.user, central.pass)
      await gotoApi(page, '/admin/comp-students/create')
      await expect(page.getByTestId('comp-form')).toBeVisible({ timeout: 20_000 })
      await page.getByTestId('comp-teacher').selectOption(demoTeacher!.id)
      await expect(page.getByTestId('comp-no-class')).toHaveCount(0, { timeout: 15_000 })
      await page.getByTestId('comp-class').selectOption({ index: 1 })
      await page.getByTestId('comp-students').fill(`${name}, ${fakeIc()}`)
      const registered = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/comp-students' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByRole('button', { name: 'Daftar Pelajar Komplimen' }).click()
      const res = await registered
      expect(res.status(), 'POST /api/admin/comp-students').toBeLessThan(300)
      const sent = JSON.parse(res.request().postData() ?? '{}') as { classroomId: unknown }
      expect(typeof sent.classroomId, 'classroomId on the wire').toBe('string')
      await expect(page).toHaveURL(/\/admin\/comp-students$/, { timeout: 20_000 })
      await expect(page.locator('[data-testid=comp-name]:visible', { hasText: name })).toHaveCount(
        1,
        {
          timeout: 20_000,
        },
      )
    } finally {
      const rows = (
        (await admin.get('/api/admin/comp-students')).body as {
          data?: { id: string; name: string }[]
        }
      ).data
      compId = rows?.find((r) => r.name.toLowerCase() === name.toLowerCase())?.id ?? null
      if (compId) await removeUsers(admin, [compId])
      await admin.dispose()
    }
  })

  test('COMP-03 a registered pupil is listed with a masked IC, coins go on in bulk @api', async ({
    page,
    browser,
  }, info) => {
    const admin = await openApiSession(browser, info, 'adminPusat')
    // The register call has an hourly limit per user: a throw-away Admin Pusat has its own bucket.
    const temp = await createTempAdmin(admin, info)
    const name = `Murid Komplimen ${stamp(info)}`
    const ic = fakeIc()
    let compId: string | null = null
    try {
      // The screen cannot pick a class (COMP-02), so the pupil is registered over the API into a seed class.
      const guru = await openApiSession(browser, info, 'guru')
      let classroomId: string
      try {
        const classes = dataOf<{ id: string; isActive: boolean }[]>(
          await guru.get('/api/guru/classes'),
          'GET /api/guru/classes',
        )
        const active = classes.find((c) => c.isActive)
        expect(active, 'the demo teacher has an active class').toBeTruthy()
        classroomId = active!.id
      } finally {
        await guru.dispose()
      }
      const registrar = await openTempSession(browser, info, temp)
      const registered = await registrar
        .send('POST', '/api/admin/comp-students', {
          classroomId,
          packageExpiresAt: `${new Date().getFullYear() + 1}-12-31`,
          students: `${name}, ${ic}`,
        })
        .finally(() => registrar.dispose())
      expect(
        registered.status,
        `POST comp-students: ${JSON.stringify(registered.body)}`,
      ).toBeLessThan(300)

      const central = account('adminPusat')
      await loginViaUi(page, central.user, central.pass)
      await gotoApi(page, '/admin/comp-students')
      const row = page.locator('[data-testid=comp-name]:visible', { hasText: name })
      await expect(row).toHaveCount(1, { timeout: 20_000 })
      const list = (await admin.get('/api/admin/comp-students')).body as {
        data: { id: string; name: string; icMasked: string | null; coinsEnabled: boolean }[]
      }
      const mine = list.data.find((r) => r.name.toLowerCase() === name.toLowerCase())
      expect(mine, 'the API lists the new pupil').toBeTruthy()
      compId = mine!.id
      expect(mine!.icMasked, 'only the masked IC leaves the API').toMatch(/^xxxxxx-xx-xx\d{2}$/)
      expect(JSON.stringify(list), 'the full IC is never returned').not.toContain(ic)
      expect(mine!.coinsEnabled, 'a new complimentary pupil has coins off (FN-M02-3.2.7)').toBe(
        false,
      )
      await expectNoHScroll(page)

      // Coins on from the bulk bar of the list.
      await row
        .locator('xpath=ancestor::*[self::tr or self::li][1]')
        .locator('[data-testid=comp-select]')
        .check()
      await expect(page.getByTestId('comp-bulk-bar')).toBeVisible()
      await expect(page.getByTestId('comp-selected-count')).toHaveText('1')
      const bulk = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/admin/comp-students/bulk-action' &&
          r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      await page.getByTestId('comp-bulk-coins_on').click()
      const confirm = page.locator('[data-ds="confirm-ok"]')
      if (await confirm.isVisible().catch(() => false)) await confirm.click()
      const bulkRes = await bulk
      expect(bulkRes.status(), 'POST bulk-action').toBe(200)
      const sentBulk = JSON.parse(bulkRes.request().postData() ?? '{}') as { ids: unknown[] }
      expect(
        sentBulk.ids.map((i) => typeof i),
        'ids are strings on the wire',
      ).toEqual(['string'])
      await expect
        .poll(
          async () =>
            dataOf<{ coinsEnabled: boolean }>(
              await admin.get(`/api/admin/comp-students/${compId}`),
              'GET comp detail',
            ).coinsEnabled,
        )
        .toBe(true)
      await expectNoHScroll(page)
    } finally {
      if (!compId) {
        const rows = (
          (await admin.get('/api/admin/comp-students')).body as {
            data?: { id: string; name: string }[]
          }
        ).data
        compId = rows?.find((r) => r.name.toLowerCase() === name.toLowerCase())?.id ?? null
      }
      await removeUsers(admin, compId ? [compId, temp.id] : [temp.id])
      await admin.dispose()
    }
  })
})
