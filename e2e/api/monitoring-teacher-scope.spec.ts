/**
 * @api M11 S2 on the REAL API: a teacher's overview and export count the pupils of the own classes, the same pupils S3
 * lists, while the school admin of that school keeps the whole school. Read-only. Runs at 375 / 768 / 1280
 * (playwright.http.config.ts) on the demo seed: `guru@demo.test` has one class (DEMO4S) in DEMO001, a school with more pupils.
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

  test('a teacher S2 counts and export equal the S3 list, and the school admin keeps the whole school @api', async ({
    browser,
    page,
  }, info) => {
    const guru = account('guru')
    await loginViaUi(page, guru.user, guru.pass)
    const overview = await read<Overview>(page, '/api/monitoring/overview')
    const schoolId = overview.teacherRows[0]?.schoolId
    expect(schoolId, 'the own school').toBeTruthy()
    const detail = await read<Detail>(page, `/api/monitoring/schools/${schoolId!}`)

    expect(detail.students.length, 'the seeded class has pupils').toBeGreaterThan(0)
    expect(overview.kpi.students).toBe(detail.students.length)
    expect(overview.kpi.engaged).toBe(detail.cards.engaged)
    expect(overview.kpi.answers).toBe(detail.cards.answers)
    expect(overview.kpi.teachers).toBe(1)
    expect(overview.studentRows.map((r) => r.schoolId)).toEqual([schoolId])

    const exported = await read<{ rows: Row[] }>(page, '/api/monitoring/export?format=csv')
    expect(exported.rows.map((r) => r.registered)).toEqual([detail.students.length])

    await page.goto('/guru/monitoring')
    await expect(page.getByTestId('mon-kpis')).toBeVisible({ timeout: 20_000 })
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
      // The whole school holds other classes too: the teacher's view is narrower, and every own pupil is in it.
      expect(whole.kpi.students).toBeGreaterThan(overview.kpi.students)
      const everyone = new Set(wholeDetail.students.map((s) => s.id))
      for (const s of detail.students) expect(everyone.has(s.id)).toBe(true)
    } finally {
      await peer.close()
    }
  })
})
