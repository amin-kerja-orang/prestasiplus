/**
 * @api M11 S2 on the REAL API: a teacher's overview, export and school detail cover the whole own school (R1-GUR-10, S6-T08),
 * equal to the school admin's figures; another school is 404. Read-only. Runs at 375 / 768 / 1280
 * (playwright.http.config.ts) on the demo seed: `guru@demo.test` and the school admin share DEMO001.
 *
 * Env: E2E_DEMO_PASSWORD (or the BIJAK_<ROLE>_PASS variables).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

interface Row {
  schoolId: string
  registered: number
  engaged: number
}
interface Overview {
  kpi: { students: number; engaged: number; answers: number; teachers: number }
  studentRows: Row[]
  teacherRows: { schoolId: string; registered: number }[]
}
interface Detail {
  cards: { students: number; engaged: number; answers: number; teachers: number }
  students: { id: string }[]
}

async function read<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(path)
  expect(res.status(), `GET ${path}`).toBe(200)
  return ((await res.json()) as { data: T }).data
}

test.describe('M11 S2 teacher scope @api', () => {
  test.setTimeout(60_000)

  test('a teacher sees the whole own school, equal to the school admin; another school is 404 @api', async ({
    browser,
    page,
  }, info) => {
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)
    const overview = await read<Overview>(page, '/api/monitoring/overview')
    const schoolId = overview.teacherRows[0]?.schoolId
    expect(schoolId, 'the own school').toBeTruthy()
    const detail = await read<Detail>(page, `/api/monitoring/schools/${schoolId!}`)

    expect(detail.students.length, 'the school has pupils').toBeGreaterThan(0)
    expect(overview.kpi.students).toBe(detail.students.length)
    expect(overview.kpi.engaged).toBe(detail.cards.engaged)
    expect(overview.kpi.answers).toBe(detail.cards.answers)
    expect(overview.kpi.teachers).toBe(detail.cards.teachers)
    expect(overview.studentRows.map((r) => r.schoolId)).toEqual([schoolId])

    const exported = await read<{ rows: Row[] }>(page, '/api/monitoring/export?format=csv')
    expect(exported.rows.map((r) => r.registered)).toEqual([detail.students.length])

    // Another school is 404 for the teacher.
    const other = Number(schoolId) + 1_000_000
    expect((await page.request.get(`/api/monitoring/schools/${other}`)).status()).toBe(404)

    await page.goto('/guru/monitoring')
    // R1-GUR-10: `/guru/monitoring` is the school detail of the own school (banner, header), not the national overview.
    await expect(page.getByTestId('mon-school-header')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('mon-scope-banner')).toBeVisible()
    await expect(page.getByTestId('mon-kpis')).toHaveCount(0)
    await expect(page.locator('[data-ds=load-error]')).toHaveCount(0)
    await expectNoHScroll(page)

    const peer = await browser.newContext({
      ...(info.project.use.baseURL ? { baseURL: info.project.use.baseURL } : {}),
    })
    try {
      const adminPage = await peer.newPage()
      const admin = account('adminSekolah')
      await loginViaUi(adminPage, admin.user, admin.pass)
      const whole = await read<Overview>(adminPage, '/api/monitoring/overview')
      const wholeDetail = await read<Detail>(adminPage, `/api/monitoring/schools/${schoolId!}`)
      expect(whole.kpi.students).toBe(wholeDetail.students.length)
      // The teacher sees exactly what the school admin sees.
      expect(whole.kpi).toEqual(overview.kpi)
      expect(wholeDetail.cards).toEqual(detail.cards)
      expect(wholeDetail.students.map((s) => s.id).sort()).toEqual(detail.students.map((s) => s.id).sort())
      expect(whole.teacherRows).toEqual(overview.teacherRows)
    } finally {
      await peer.close()
    }
  })
})
