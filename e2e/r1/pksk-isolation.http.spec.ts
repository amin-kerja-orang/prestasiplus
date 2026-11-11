/**
 * PKSK isolation on the REAL API: a PKSK question (tag `pksk_domain`, M07) must never show in the M04 Studio
 * list, its search or its summary (questions.repository.ts: "The M04 lists, counts, sources and writes never see them";
 * contract GET /questions: "Legacy PKSK rows are never listed"), and the M04 admin detail must not open it
 * (`getAdmin` reads with scope `exclude` -> 404 NOT_FOUND, apps/api/test/questions/pksk-db.spec.ts:74).
 *
 * Routes: Studio = GET /api/questions (list, `meta.totalItems`), GET /api/questions/summary (`data.total`), GET /api/questions/:id
 * (the Studio frontend calls these, src/modules/m04-question-bank/api/questions.ts; there is no /api/admin/questions list route).
 * PKSK = POST /api/admin/pksk-questions (201), GET /api/admin/pksk-questions/:id, DELETE (204, used for cleanup).
 *
 * The seeded database is shared and other specs write to it, so the Studio totals are compared only when they were stable between
 * two reads taken before the create; otherwise the marker search (always 0) is the isolation proof.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PUSAT_PASS), as the other e2e/r1 specs.
 */
import type { Page } from '@playwright/test'

import { account, csrfOf } from '../api/helpers'
import { expect, loginViaUi, test } from '../fixtures/api'

interface Listing {
  total: number
  rows: unknown[]
}

async function studioList(page: Page, search?: string): Promise<Listing> {
  const qs = search === undefined ? '' : `?search=${encodeURIComponent(search)}`
  const res = await page.request.get(`/api/questions${qs}`)
  expect(res.status(), `GET /api/questions${qs}`).toBe(200)
  const body = (await res.json()) as { data: unknown[]; meta: { totalItems: number } }
  expect(Array.isArray(body.data)).toBe(true)
  expect(typeof body.meta.totalItems).toBe('number')
  return { total: body.meta.totalItems, rows: body.data }
}

async function studioSummaryTotal(page: Page): Promise<number> {
  const res = await page.request.get('/api/questions/summary')
  expect(res.status(), 'GET /api/questions/summary').toBe(200)
  const body = (await res.json()) as { data: { total: number } }
  expect(typeof body.data.total).toBe('number')
  return body.data.total
}

test.describe('PKSK isolation from Studio @api', () => {
  test.setTimeout(120_000)

  test('a PKSK question never shows in the Studio list, summary or search, and is read by id on the PKSK route @api', async ({ page }, info) => {
    const admin = account('adminPusat')
    await loginViaUi(page, admin.user, admin.pass)
    const marker = `E2EPKSKISO${info.project.name}${String(Date.now())}`

    // Before: two reads of the totals (stability check) and the marker search.
    const list1 = await studioList(page)
    const sum1 = await studioSummaryTotal(page)
    const list2 = await studioList(page)
    const sum2 = await studioSummaryTotal(page)
    const stable = list1.total === list2.total && sum1 === sum2
    expect((await studioList(page, marker)).total, 'marker unknown before the create').toBe(0)

    // A Bahagian B domain (the first one of the reference list).
    const domains = await page.request.get('/api/pksk-domains')
    expect(domains.status(), 'GET /api/pksk-domains').toBe(200)
    const domain = ((await domains.json()) as { data: { id: string; bahagian: string }[] }).data.find((d) => d.bahagian === 'B')
    expect(domain, 'a Bahagian B domain exists').toBeTruthy()

    let pkskId: string | undefined
    try {
      const created = await page.request.post('/api/admin/pksk-questions', {
        headers: { 'x-csrf-token': await csrfOf(page) },
        data: {
          bahagian: 'B',
          pkskDomainId: domain!.id,
          pkskTargetLevel: 'T1',
          questionText: `Soalan ${marker}`,
          difficultyLevel: 3,
          explanation: null,
          options: [
            { text: 'Pilihan 1', isCorrect: true },
            { text: 'Pilihan 2', isCorrect: false },
          ],
        },
      })
      expect(created.status(), `POST pksk-questions ${await created.text()}`).toBe(201)
      pkskId = ((await created.json()) as { data: { id: string } }).data.id
      expect(pkskId).toMatch(/^\d+$/)

      // PKSK side: visible by id and by search on its own route.
      const byId = await page.request.get(`/api/admin/pksk-questions/${pkskId}`)
      expect(byId.status(), 'GET pksk by id').toBe(200)
      const detail = ((await byId.json()) as { data: { id: string; questionText: string; bahagian: string; status: string } }).data
      expect(detail).toMatchObject({ id: pkskId, bahagian: 'B', status: 'approved' })
      expect(detail.questionText).toContain(marker)
      const pkskSearch = await page.request.get(`/api/admin/pksk-questions?search=${encodeURIComponent(marker)}`)
      expect(pkskSearch.status()).toBe(200)
      const pkskRows = ((await pkskSearch.json()) as { data: { id: string }[] }).data
      expect(pkskRows.map((r) => r.id)).toContain(pkskId)

      // Studio side: no leak.
      const marked = await studioList(page, marker)
      expect(marked.total, 'Studio search for the PKSK marker').toBe(0)
      expect(marked.rows).toHaveLength(0)
      const list3 = await studioList(page)
      const sum3 = await studioSummaryTotal(page)
      if (stable) {
        expect(list3.total, 'Studio list total unchanged').toBe(list1.total)
        expect(sum3, 'Studio summary total unchanged').toBe(sum1)
      }
      // The id never appears on the first page of the newest-first list (a leaked row would be the newest).
      expect((list3.rows as { id: string }[]).map((r) => r.id)).not.toContain(pkskId)

      // The M04 admin detail does not open it: 404 NOT_FOUND, never 200 or 500.
      const m04 = await page.request.get(`/api/questions/${pkskId}`)
      expect(m04.status(), 'GET /api/questions/:id of a PKSK id').toBe(404)
      expect(((await m04.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND')
    } finally {
      // DELETE /api/admin/pksk-questions/:id exists (204): the question is removed again.
      if (pkskId) {
        const del = await page.request.delete(`/api/admin/pksk-questions/${pkskId}`, {
          headers: { 'x-csrf-token': await csrfOf(page) },
        })
        expect(del.status(), 'cleanup DELETE pksk question').toBeLessThan(300)
      }
    }
  })
})
