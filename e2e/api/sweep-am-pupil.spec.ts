/**
 * @api Pupil-view http sweep (slug `am-sweep-http-pupil`, SWP-1, SWP-2, SWP-3, SWP-9). Read-only.
 *
 * A pupil must never be offered a link the app refuses afterwards:
 *   (a) /timeline: no "Profil Awam Anda" link to /pelajar/:id (outside the pupil's prototype scope);
 *   (b) /prestasi/tingkatan/t4: no "Lihat →" link to /prestasi/kelas/:id (staff only), no 404 page;
 *   (c) own /prestasi/:id: no "Lihat Penuh" link to /headcount/student/:id (staff only);
 *   (d) a teacher keeps the class links on the same page (no regression);
 *   (e) /kelas-saya: the "already joined" refusal clears when the code is emptied.
 * Preconditions are asserted (the page rendered its data), never skipped, so an empty page cannot pass.
 *
 * (e) joins only a class the pupil already belongs to, so the API answers 409 and nothing is written.
 * The join code is not in `GET /api/kelas-saya`, so it is the seeded demo class code (DEMO4S,
 * apps/api/prisma/seed/poc/classes.ts DEMO_CLASS_CODE); `SWP_JOINED_CODE` overrides it. The test first
 * asserts that the pupil is already a member of THAT class (its card, "Kelas Demo Tingkatan 4", is listed on
 * Kelas Saya; `SWP_JOINED_CLASS_NAME` overrides the name), so it fails loudly instead of creating a membership.
 *
 * Test (a) needs a build with `VITE_PROTOTYPE_SCOPE=on` (the default in compose and in CI): the scope is what
 * keeps /pelajar/:id away from the pupil, so with the scope off the box is rightly shown and (a) fails.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_B_PASS / BIJAK_GURU_PASS).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
const ALREADY_JOINED = 'Anda sudah menyertai kelas ini.'
const JOINED_CODE = process.env.SWP_JOINED_CODE || 'DEMO4S'
const JOINED_CLASS_NAME = process.env.SWP_JOINED_CLASS_NAME || 'Kelas Demo Tingkatan 4'

/** The pupil's own user id, from the session the app itself uses. */
async function ownId(page: Page): Promise<string> {
  const res = await page.request.get('/api/me')
  expect(res.status(), 'GET /api/me').toBe(200)
  const body = (await res.json()) as { data: { id: number | string } }
  return String(body.data.id)
}

async function expectNot404(page: Page): Promise<void> {
  await expect(page).not.toHaveTitle(NOT_FOUND_TITLE)
  await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toHaveCount(0)
}

/**
 * Opens /prestasi/tingkatan/t4 and asserts the precondition: the API answered 200 with at least one
 * class row that carries a link target, and the class card rendered (a table on desktop, cards on mobile).
 */
async function openTingkatan(page: Page): Promise<void> {
  const levelCall = page.waitForResponse(
    (r) => r.url().includes('/api/performance/levels/t4') && r.request().method() === 'GET',
    { timeout: 30_000 },
  )
  await page.goto('/prestasi/tingkatan/t4')
  const res = await levelCall
  expect(res.status(), 'GET /api/performance/levels/t4').toBe(200)
  const body = (await res.json()) as { data: { classRows: { href: string | null }[] } }
  expect(
    body.data.classRows.filter((r) => r.href !== null).length,
    'the level has class rows with a link target',
  ).toBeGreaterThan(0)
  await expect(page.getByTestId('tingkatan-page')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('class-card')).toBeVisible({ timeout: 20_000 })
}

test.describe('pupil sweep: no dead links @api', () => {
  test.setTimeout(90_000)

  test('(a) pupil /timeline has no public-profile link to /pelajar/:id @api', async ({ page }) => {
    const { user, pass } = account('studentB')
    await loginViaUi(page, user, pass)
    await page.goto('/timeline')
    await expect(page.getByTestId('timeline-page')).toBeVisible({ timeout: 20_000 })
    // The data has loaded once the page actions render.
    await expect(page.getByTestId('add-post')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('a[href^="/pelajar/"], a[href*="/pelajar/"]')).toHaveCount(0)
    await expect(page.getByTestId('public-url')).toHaveCount(0)
    await expect(page.getByTestId('copy-url')).toHaveCount(0)
    await expectNoHScroll(page)
  })

  test('(b) pupil /prestasi/tingkatan/t4 has no class links and no 404 page @api', async ({ page }) => {
    const { user, pass } = account('studentB')
    await loginViaUi(page, user, pass)
    await openTingkatan(page)
    await expect(page.locator('a[href^="/prestasi/kelas/"]')).toHaveCount(0)
    await expectNot404(page)
    await expectNoHScroll(page)
  })

  test('(c) pupil own /prestasi/:id has no "Lihat Penuh" link to the headcount page @api', async ({
    page,
  }) => {
    const { user, pass } = account('studentB')
    await loginViaUi(page, user, pass)
    const id = await ownId(page)
    await page.goto(`/prestasi/${id}`)
    await expect(page.getByTestId('prestasi360-page')).toBeVisible({ timeout: 20_000 })
    // Precondition: the pupil has headcount cards, so the link would have been rendered before the fix.
    await expect(page.getByTestId('headcount-block')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator(`a[href="/headcount/student/${id}"]`)).toHaveCount(0)
    await expect(page.locator('a[href^="/headcount/"]')).toHaveCount(0)
    await expectNoHScroll(page)
  })

  test('(d) guru /prestasi/tingkatan/t4 still has the class links @api', async ({ page }) => {
    const { user, pass } = account('guru')
    await loginViaUi(page, user, pass)
    await openTingkatan(page)
    const links = page.locator('a[href^="/prestasi/kelas/"]')
    await expect.poll(() => links.count()).toBeGreaterThan(0)
    await expect(links.first()).toContainText('Lihat')
    await expectNoHScroll(page)
  })

  test('(e) pupil /kelas-saya: the "already joined" refusal clears when the code is emptied @api', async ({
    page,
  }) => {
    const { user, pass } = account('studentB')
    await loginViaUi(page, user, pass)

    // Precondition: the pupil is already a member of the class behind JOINED_CODE, so joining it again is
    // refused (409) and nothing is written. If not, stop here: submitting would create a membership.
    const mine = await page.request.get('/api/kelas-saya')
    expect(mine.status(), 'GET /api/kelas-saya').toBe(200)
    const body = (await mine.json()) as { data: { name: string }[] }
    expect(
      body.data.map((c) => c.name),
      `the pupil is already in "${JOINED_CLASS_NAME}" (join code ${JOINED_CODE})`,
    ).toContain(JOINED_CLASS_NAME)

    await page.goto('/kelas-saya')
    await expect(
      page.getByTestId('joined-class').filter({ hasText: JOINED_CLASS_NAME }),
      'its card is listed on Kelas Saya',
    ).toBeVisible({ timeout: 20_000 })
    const input = page.getByTestId('class-code')
    const submit = page.getByTestId('join-submit')
    await expect(input).toBeVisible({ timeout: 20_000 })

    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/kelas-saya/join')) posts += 1
    })

    await input.fill(JOINED_CODE)
    const refused = page.waitForResponse(
      (r) => r.url().endsWith('/api/kelas-saya/join') && r.request().method() === 'POST',
    )
    await submit.click()
    expect((await refused).status(), 'POST /api/kelas-saya/join of an already-joined code').toBe(409)
    await expect(page.getByTestId('join-error')).toContainText(ALREADY_JOINED)

    // Empty the field and press "Sertai": the native `required` blocks the request; the message must go.
    await input.fill('')
    await submit.click()
    await expect(page.getByTestId('join-error')).toHaveCount(0)
    await expect(page.getByTestId('join-success')).toHaveCount(0)
    expect(posts, 'the empty submit sent no second request').toBe(1)
    await expectNoHScroll(page)
  })
})
