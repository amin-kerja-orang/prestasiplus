/**
 * Studio detail for the PKSK ids 177698, 178460 and 178000 (live V2 opens PKSK ids in the M04 detail with Subjek and Tahap
 * shown as "-", docs/discovery/M07-pksk.md:37). V3 intent, from the code: GET /api/questions/:id (the route the Studio editor
 * uses, `getAdmin`) reads with scope `exclude` and `bankOnly`, so a PKSK question is NOT FOUND there (404 NOT_FOUND, apps/api/test/
 * questions/pksk-db.spec.ts:74); PKSK questions are managed only through /api/admin/pksk-questions/:id.
 *
 * The seeded database may or may not hold these ids, so the assertions are: never 500, and a well-formed body of one of the two
 * documented shapes. 404 -> `{ error: { code: 'NOT_FOUND' } }`. 200 (an id that is a normal bank question) -> `data.id` equals the id and
 * `data.questionText` is a string; `subject` / `level` are objects or null (never undefined), so the editor can render "-".
 * The deterministic PKSK -> 404 proof (a question this run creates) is in pksk-isolation.http.spec.ts.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_ADMIN_PUSAT_PASS).
 */
import { account } from '../api/helpers'
import { expect, loginViaUi, test } from '../fixtures/api'

const IDS = ['177698', '178460', '178000']

test.describe('Studio detail of PKSK ids @api', () => {
  test.setTimeout(60_000)

  test('GET /api/questions/:id for a PKSK id is a well-formed 404 or 200, never a 500 @api', async ({ page }) => {
    const admin = account('adminPusat')
    await loginViaUi(page, admin.user, admin.pass)
    for (const id of IDS) {
      const res = await page.request.get(`/api/questions/${id}`)
      expect(res.status(), `GET /api/questions/${id} must not be a server error`).toBeLessThan(500)
      expect([200, 404], `GET /api/questions/${id}`).toContain(res.status())
      const body = (await res.json()) as Record<string, unknown>
      if (res.status() === 404) {
        expect((body as { error: { code: string } }).error.code, `${id} error code`).toBe('NOT_FOUND')
      } else {
        const data = (body as { data: { id: string; questionText: unknown; subject?: unknown; level?: unknown } }).data
        expect(data.id).toBe(id)
        expect(typeof data.questionText).toBe('string')
        for (const key of ['subject', 'level'] as const) {
          const v = data[key]
          expect(v === null || typeof v === 'object', `${id} ${key} is an object or null`).toBe(true)
        }
      }
    }
  })
})
