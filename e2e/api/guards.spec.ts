/**
 * @api role guards against the REAL API (BE-32 AC3, slug `e2e-bijak`). Read-only: nothing is written.
 *
 * What the code does (src/app/router/guards.ts `decideAccess`, routes in src/modules/m28-bijak-spm):
 * - `/spm/bijak` has `roles: ['student','admin']` + `onForbidden: '403'`, so a teacher gets the
 *   in-place 403 page (URL unchanged, tab title "Akses Ditolak | PRESTASIPLUS"), D43.
 * - `/admin/spm/kertas` has `roles: ['admin']` and no `onForbidden`, so another role is redirected to
 *   its own home (`scopeHomePath`, intentional, fix B2 in #60): murid /dashboard, guru /guru, admin sekolah /admin-sekolah.
 * - The API is the real boundary: `GET /api/admin/papers` is `@Roles('admin')` (apps/api/src/modules/
 *   exam/builder/builder.controller.ts) and `/api/bijak/*` is `@Roles('student')` (attempts + papers
 *   controllers, D43): both answer 403 to the wrong role.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_<ROLE>_PASS; see helpers.ts). Stack: npm run stack:up.
 */

import type { Page } from '@playwright/test'

import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, FORBIDDEN_TITLE, HOME } from './helpers'

const ADMIN_PAGE = '/admin/spm/kertas'
const BIJAK_PAGE = '/spm/bijak'

/** Strict: redirected to the role home, the builder is not rendered, no horizontal scroll. */
async function expectRedirectedHome(page: Page, home: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${home}/?([?#]|$)`), { timeout: 20_000 })
  await expect(page.getByTestId('papers-page')).toHaveCount(0)
  await expect(page.getByText('Pembina Kertas')).toHaveCount(0)
  await expectNoHScroll(page)
}

test.describe('role guards @api', () => {
  test.setTimeout(60_000)

  const adminDenied = [
    { role: 'student', label: 'murid' },
    { role: 'guru', label: 'guru' },
    { role: 'adminSekolah', label: 'admin sekolah' },
  ] as const

  for (const { role, label } of adminDenied) {
    test(`${label} is redirected home from ${ADMIN_PAGE} and GET /api/admin/papers is 403 @api`, async ({
      page,
    }) => {
      const { user, pass } = account(role)
      await loginViaUi(page, user, pass)

      // API boundary (real): 403 for a role other than Admin Pusat.
      const res = await page.request.get('/api/admin/papers')
      expect(res.status(), 'GET /api/admin/papers').toBe(403)

      // SPA: redirect to the role home (scopeHomePath).
      await gotoApi(page, ADMIN_PAGE)
      await expectRedirectedHome(page, HOME[role])
    })
  }

  test('guru gets the in-place 403 on /spm/bijak and 403 from the Bijak API (D43) @api', async ({
    page,
  }) => {
    const { user, pass } = account('guru')
    await loginViaUi(page, user, pass)

    await gotoApi(page, BIJAK_PAGE)
    // roles ['student','admin'] + onForbidden '403': the URL stays, the 403 page shows.
    await expect(page).toHaveTitle(FORBIDDEN_TITLE)
    expect(new URL(page.url()).pathname).toBe(BIJAK_PAGE)
    await expect(page.getByText('Akses Ditolak').first()).toBeVisible()
    await expectNoHScroll(page)

    for (const path of ['/api/bijak/papers', '/api/bijak/history']) {
      const res = await page.request.get(path)
      expect(res.status(), `GET ${path} as teacher`).toBe(403)
    }
  })

  test('Admin Pusat is allowed on /admin/spm/kertas and GET /api/admin/papers (control) @api', async ({
    page,
  }) => {
    const { user, pass } = account('adminPusat')
    await loginViaUi(page, user, pass)
    expect((await page.request.get('/api/admin/papers')).status()).toBe(200)
    await gotoApi(page, ADMIN_PAGE)
    expect(new URL(page.url()).pathname).toBe(ADMIN_PAGE)
    await expect(page).not.toHaveTitle(FORBIDDEN_TITLE)
    await expectNoHScroll(page)
  })
})
