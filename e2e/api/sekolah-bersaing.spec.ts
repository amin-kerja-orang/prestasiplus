/**
 * @api `/sekolah-bersaing` on the REAL API at 375 / 768 / 1280 (R1-AS-45, API-AS-14, FR-X2-4): the live board for
 * Admin Sekolah and Admin Pusat, 403 for a pupil and a Guru. The rows follow the seeded practice data, so the page
 * is compared with the API answer, not with fixed values.
 *
 * Env: E2E_DEMO_PASSWORD (or the BIJAK_*_PASS of each role).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll, type ApiRole } from './helpers'

interface BoardRow {
  rank: number
  school: string
  state: string
  accuracy: number
  pupils: number
}

async function expectBoard(page: Page, rows: BoardRow[]): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Sekolah Bersaing' })).toBeVisible()
  if (rows.length === 0) {
    await expect(page.getByText('Belum ada data')).toBeVisible()
    await expect(page.getByText('Tiada rekod latihan sekolah lagi.')).toBeVisible()
  } else {
    await expect(page.getByTestId('sb-label')).toHaveText('Papan Pemimpin')
    await expect(page.getByTestId('sb-row')).toHaveCount(rows.length)
    await expect(page.getByTestId('sb-school').first()).toContainText(rows[0]?.school ?? '')
    await expect(page.getByTestId('sb-pupils').first()).toContainText(String(rows[0]?.pupils))
  }
  await expectNoHScroll(page)
}

test.describe('Sekolah Bersaing @api', () => {
  for (const [role, name] of [
    ['adminSekolah', 'Admin Sekolah'],
    ['adminPusat', 'Admin Pusat'],
  ] as const satisfies readonly (readonly [ApiRole, string])[]) {
    test(`AC-AS-45-1 ${name} sees the live board from the API @api`, async ({ page }) => {
      const who = account(role)
      await loginViaUi(page, who.user, who.pass)
      const answered = page.waitForResponse(
        (r) => r.url().endsWith('/api/sekolah-bersaing') && r.request().method() === 'GET',
      )
      await page.goto('/sekolah-bersaing')
      const res = await answered
      expect(res.status(), `GET /api/sekolah-bersaing ${await res.text()}`).toBe(200)
      const rows = ((await res.json()) as { data: BoardRow[] }).data
      expect(rows.length).toBeLessThanOrEqual(30)
      expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1))
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(['accuracy', 'pupils', 'rank', 'school', 'state'])
      }
      await expectBoard(page, rows)

      // AC-AS-45-2: an unknown parameter is ignored, there is no week any more.
      const withWeek = await page.request.get('/api/sekolah-bersaing?week=2020-01-06')
      expect(withWeek.status()).toBe(200)
      expect(((await withWeek.json()) as { data: BoardRow[] }).data).toEqual(rows)
    })
  }

  for (const [role, name] of [
    ['student', 'a pupil'],
    ['guru', 'a Guru'],
  ] as const satisfies readonly (readonly [ApiRole, string])[]) {
    test(`FR-X2-4 ${name} gets the 403 page and the API answers 403 @api`, async ({ page }) => {
      const who = account(role)
      await loginViaUi(page, who.user, who.pass)
      await page.goto('/sekolah-bersaing')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Akses Ditolak')
      await expect(page.getByTestId('sb-row')).toHaveCount(0)
      await expectNoHScroll(page)
      expect((await page.request.get('/api/sekolah-bersaing')).status()).toBe(403)
    })
  }
})
