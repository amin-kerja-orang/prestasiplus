/**
 * @api M18 S23 "Ringkasan Eksekutif" (`/amaran/ringkasan-eksekutif`) and S21 "Keberkesanan Intervensi"
 * (`/amaran/keberkesanan`) against the REAL API (AM-11, slug `m18-amaran-summary`). Read-only.
 *
 * - The school admin (`adminsekolah@demo.test`, school DEMO001) reaches each screen from the two buttons of
 *   M27 S4 `/amaran/sekolah` (`am-btn-ringkasan`, `am-btn-keberkesanan`). Needs both routes in the http build's
 *   prototype scope (`src/app/prototype-scope.ts`); without them the buttons are hidden and these tests fail.
 * - `GET /api/amaran/summary` (S23) and `GET /api/amaran/effectiveness` (S21) answer 200 to the school admin and
 *   403 to a pupil (`@Roles('admin','school_admin','teacher')`, apps/api/src/modules/school-admin/amaran).
 * - The field names are checked against the client types (`src/modules/m18-ppd-jpn/api/amaran.ts`, contract
 *   `packages/contract/src/school-admin/amaran.ts`); a mismatch is an app bug, never loosened here.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_SEKOLAH_PASS / BIJAK_STUDENT_PASS; see helpers.ts). Stack: npm run stack:up.
 */

import type { Page, Response } from '@playwright/test'

import { expect, gotoApi, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

const S4 = '/amaran/sekolah'
const S23 = '/amaran/ringkasan-eksekutif'
const S21 = '/amaran/keberkesanan'
const SLOW = { timeout: 30_000 }

type Json = Record<string, unknown>

async function signIn(page: Page, role: 'adminSekolah' | 'student'): Promise<void> {
  const { user, pass } = account(role)
  await loginViaUi(page, user, pass)
}

async function dataOf(res: Response | Awaited<ReturnType<Page['request']['get']>>): Promise<Json> {
  return ((await res.json()) as { data: Json }).data
}

function expectKeys(obj: unknown, keys: string[], what: string): void {
  expect(obj, what).toBeTruthy()
  for (const k of keys) expect(Object.keys(obj as Json), `${what} has "${k}"`).toContain(k)
}

/** Opens S4 as the school admin and waits for both M18 buttons. */
async function openS4(page: Page): Promise<void> {
  await signIn(page, 'adminSekolah')
  await gotoApi(page, S4)
  await expect(page.getByTestId('am-tiles')).toBeVisible(SLOW)
  await expect(page.getByTestId('am-btn-ringkasan')).toBeVisible()
  await expect(page.getByTestId('am-btn-keberkesanan')).toBeVisible()
}

test.describe('M18 amaran summary S23 and S21 @api', () => {
  test.setTimeout(90_000)

  test('S4 button opens S23 with real data, no error state, no h-scroll @api', async ({ page }) => {
    await openS4(page)
    const api = page.waitForResponse((r) => r.url().includes('/api/amaran/summary'), SLOW)
    await page.getByTestId('am-btn-ringkasan').click()
    expect((await api).status(), 'GET /api/amaran/summary').toBe(200)
    await expect(page).toHaveURL(new RegExp(S23))

    await expect(page.getByTestId('rk-sheet')).toBeVisible(SLOW)
    for (const id of ['rk-title', 'rk-tiles', 'rk-distribution', 'rk-kombo', 'rk-footer']) {
      await expect(page.getByTestId(id), id).toBeVisible()
    }
    await expect(page.getByTestId('rk-title')).not.toBeEmpty()
    await expect(page.getByTestId('rk-error')).toHaveCount(0)
    await expect(page.getByTestId('rk-loading')).toHaveCount(0)
    await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
    await expect(page.getByText('Perbandingan Sekolah Daerah')).toHaveCount(0)
    await expectNoHScroll(page)

    await page.getByTestId('rk-back').click()
    await expect(page).toHaveURL(new RegExp(`${S4}$`))
  })

  test('S4 button opens S21 with real data (tiles, then data or the zero state), no error state, no h-scroll @api', async ({
    page,
  }) => {
    await openS4(page)
    const api = page.waitForResponse((r) => r.url().includes('/api/amaran/effectiveness'), SLOW)
    await page.getByTestId('am-btn-keberkesanan').click()
    expect((await api).status(), 'GET /api/amaran/effectiveness').toBe(200)
    await expect(page).toHaveURL(new RegExp(S21))

    await expect(page.getByTestId('kb-tiles')).toBeVisible(SLOW)
    await expect(page.getByTestId('kb-error')).toHaveCount(0)
    await expect(page.getByTestId('kb-loading')).toHaveCount(0)
    await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
    for (const id of ['kb-tile-total', 'kb-tile-rate', 'kb-tile-action', 'kb-tile-pending']) {
      await expect(page.getByTestId(id), id).toBeVisible()
    }
    // Total from the API decides the state: 0 = the zero state, else the lists.
    const report = ((await dataOf(await api)) as { report: { cards: { total: number } } }).report
    if (report.cards.total === 0) {
      await expect(page.getByTestId('kb-none')).toBeVisible()
    } else {
      await expect(page.getByTestId('kb-none')).toHaveCount(0)
      await expect(page.getByTestId('kb-types')).toBeVisible()
      await expect(page.getByTestId('kb-teachers')).toBeVisible()
    }
    await expectNoHScroll(page)

    await page.getByTestId('kb-back').click()
    await expect(page).toHaveURL(new RegExp(`${S4}$`))
  })

  test('school admin: GET /api/amaran/summary is 200 and matches the client types @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    const res = await page.request.get('/api/amaran/summary')
    expect(res.status(), 'GET /api/amaran/summary').toBe(200)
    const d = await dataOf(res)
    expectKeys(
      d,
      ['scope', 'title', 'subtitle', 'pupilsLine', 'generatedAt', 'tally', 'kombo'],
      'summary',
    )
    expect(d.scope).toBe('school')
    expect(typeof d.title).toBe('string')
    expect(typeof d.generatedAt, 'generatedAt is epoch ms (number)').toBe('number')
    expectKeys(d.tally, ['green', 'yellow', 'red', 'total', 'pct'], 'summary.tally')
    expectKeys((d.tally as Json).pct, ['green', 'yellow', 'red'], 'summary.tally.pct')
    expectKeys(d.kombo, ['active', 'pupils', 'avg', 'max', 'today'], 'summary.kombo')
    const t = d.tally as { green: number; yellow: number; red: number; total: number }
    expect(t.green + t.yellow + t.red, 'tally parts add up to total').toBe(t.total)
    if (d.weakness !== undefined) {
      for (const w of d.weakness as Json[]) {
        expectKeys(w, ['subjectId', 'subjectName', 'weak', 'total', 'pct'], 'summary.weakness[]')
      }
    }
  })

  test('school admin: a foreign school id in the query is not answered with another school @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    const own = await dataOf(await page.request.get('/api/amaran/summary'))
    const res = await page.request.get('/api/amaran/summary?scope=school&schoolId=900003')
    expect([200, 403, 404], 'GET /api/amaran/summary?schoolId=<foreign>').toContain(res.status())
    if (res.status() === 200)
      expect((await dataOf(res)).title, 'still the own school').toBe(own.title)
  })

  test('school admin: GET /api/amaran/effectiveness is 200 and matches the client types @api', async ({
    page,
  }) => {
    await signIn(page, 'adminSekolah')
    const res = await page.request.get('/api/amaran/effectiveness')
    expect(res.status(), 'GET /api/amaran/effectiveness').toBe(200)
    const d = await dataOf(res)
    expectKeys(d, ['school', 'report'], 'effectiveness')
    expectKeys(d.school, ['id', 'name'], 'effectiveness.school')
    const r = d.report as Json
    expectKeys(
      r,
      ['cards', 'doughnut', 'trend', 'byType', 'byTeacher', 'followUps', 'bySchool'],
      'effectiveness.report',
    )
    expectKeys(
      r.cards,
      [
        'total',
        'berkesan',
        'evaluated',
        'rate',
        'needsAction',
        'sederhana',
        'tidakBerkesan',
        'notEvaluated',
      ],
      'report.cards',
    )
    expect(r.doughnut, 'doughnut is a 4-tuple').toHaveLength(4)
    expectKeys(r.trend, ['labels', 'data'], 'report.trend')
    expect((r.trend as { labels: unknown[] }).labels).toHaveLength(6)
    expect((r.trend as { data: unknown[] }).data).toHaveLength(6)
    for (const row of r.byType as Json[])
      expectKeys(row, ['type', 'label', 'count'], 'report.byType[]')
    for (const row of r.byTeacher as Json[]) {
      expectKeys(
        row,
        ['teacherId', 'name', 'total', 'berkesan', 'notEvaluated', 'rate'],
        'report.byTeacher[]',
      )
    }
    for (const row of r.followUps as Json[]) {
      expectKeys(
        row,
        ['id', 'studentId', 'studentName', 'type', 'label', 'interventionDate', 'effectiveness'],
        'report.followUps[]',
      )
    }
  })

  test('student: both Amaran report endpoints are refused (403/404) @api', async ({ page }) => {
    await signIn(page, 'student')
    for (const path of ['/api/amaran/summary', '/api/amaran/effectiveness']) {
      const res = await page.request.get(path)
      expect([403, 404], `GET ${path} as a pupil`).toContain(res.status())
    }
  })

  for (const path of [S23, S21]) {
    test(`student opening ${path} sees no data and no report is fetched @api`, async ({ page }) => {
      await signIn(page, 'student')
      const ok: string[] = []
      page.on('response', (r) => {
        if (/\/api\/amaran\/(summary|effectiveness)/.test(r.url()) && r.status() === 200)
          ok.push(r.url())
      })
      await gotoApi(page, path)
      // Either the in-place 403 page or a redirect away; never the report.
      await expect(page.getByTestId('rk-sheet')).toHaveCount(0)
      await expect(page.getByTestId('rk-tiles')).toHaveCount(0)
      await expect(page.getByTestId('kb-tiles')).toHaveCount(0)
      await expect(page.getByTestId('kb-types')).toHaveCount(0)
      await page.waitForLoadState('networkidle')
      expect(ok, 'no successful Amaran report response for a pupil').toEqual([])
      await expectNoHScroll(page)
    })
  }
})
