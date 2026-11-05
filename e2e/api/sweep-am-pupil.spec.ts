/**
 * @api Pupil-view http sweep (slug `am-sweep-http-pupil`, SWP-1, SWP-2, SWP-3, SWP-9). Read-only.
 *
 * A pupil must never be offered a link the app refuses afterwards:
 *   (a) /timeline: no "Profil Awam Anda" link to /pelajar/:id (outside the pupil's prototype scope);
 *   (b) /prestasi/tingkatan/t4: no "Lihat →" link to /prestasi/kelas/:id (staff only), no 404 page;
 *   (c) own /prestasi/:id: no "Lihat Penuh" link to /headcount/student/:id (staff only);
 *   (d) a teacher keeps the class links on the same page (no regression);
 *   (e) /kelas-saya: there is no join box and no POST to /api/kelas-saya/join (API-MUR-04).
 * Preconditions are asserted (the page rendered its data), never skipped, so an empty page cannot pass.
 *
 * (e) only reads: it asserts the pupil is already a member of the seeded demo class ("Kelas Demo Tingkatan 4",
 * listed on Kelas Saya; `SWP_JOINED_CLASS_NAME` overrides the name) and that the page offers no join control.
 *
 * Test (a) needs a build with `VITE_PROTOTYPE_SCOPE=on` (the default in compose and in CI): the scope is what
 * keeps /pelajar/:id away from the pupil, so with the scope off the box is rightly shown and (a) fails.
 *
 * Env: E2E_DEMO_PASSWORD (or BIJAK_STUDENT_B_PASS / BIJAK_GURU_PASS).
 */

import type { Page } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, expectNoHScroll } from './helpers'

const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'
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
 * Opens /prestasi/tingkatan/t4 and asserts the precondition: the API answered 200 with at least one class
 * row, and the class card rendered (a table on desktop, cards on mobile). `staff` also requires a row with a
 * link target. A pupil gets every `href` as null from the API since SW5-04 (#248), so the pupil test checks
 * that no class link renders whatever the API sends.
 */
async function openTingkatan(page: Page, staff: boolean): Promise<void> {
  const levelCall = page.waitForResponse(
    (r) => r.url().includes('/api/performance/levels/t4') && r.request().method() === 'GET',
    { timeout: 30_000 },
  )
  await page.goto('/prestasi/tingkatan/t4')
  const res = await levelCall
  expect(res.status(), 'GET /api/performance/levels/t4').toBe(200)
  const body = (await res.json()) as { data: { classRows: { href: string | null }[] } }
  expect(body.data.classRows.length, 'the level has class rows').toBeGreaterThan(0)
  if (staff) {
    expect(
      body.data.classRows.filter((r) => r.href !== null).length,
      'the level has class rows with a link target',
    ).toBeGreaterThan(0)
  }
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

  test('(b) pupil /prestasi/tingkatan/t4 has no class links and no 404 page @api', async ({
    page,
  }) => {
    const { user, pass } = account('studentB')
    await loginViaUi(page, user, pass)
    await openTingkatan(page, false)
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
    await openTingkatan(page, true)
    const links = page.locator('a[href^="/prestasi/kelas/"]')
    await expect.poll(() => links.count()).toBeGreaterThan(0)
    await expect(links.first()).toContainText('Lihat')
    await expectNoHScroll(page)
  })

  test('(e) pupil /kelas-saya: no join box and no join request @api', async ({ page }) => {
    const { user, pass } = account('studentB')
    await loginViaUi(page, user, pass)

    // Precondition: the pupil is already a member of the demo class, so the card below must be listed.
    const mine = await page.request.get('/api/kelas-saya')
    expect(mine.status(), 'GET /api/kelas-saya').toBe(200)
    const body = (await mine.json()) as { data: { name: string }[] }
    expect(
      body.data.map((c) => c.name),
      `the pupil is already in "${JOINED_CLASS_NAME}"`,
    ).toContain(JOINED_CLASS_NAME)

    await page.goto('/kelas-saya')
    await expect(
      page.getByTestId('joined-class').filter({ hasText: JOINED_CLASS_NAME }),
      'its card is listed on Kelas Saya',
    ).toBeVisible({ timeout: 20_000 })
    // The join box is gone (API-MUR-04, D-A8): no control, and nothing posts to the removed route.
    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/kelas-saya/join')) posts += 1
    })
    await expect(page.getByTestId('join-submit')).toHaveCount(0)
    await expect(page.getByTestId('class-code')).toHaveCount(0)
    await expect(page.getByText('Masukkan Kod Kelas')).toHaveCount(0)
    expect(posts, 'no POST to /api/kelas-saya/join').toBe(0)
    await expectNoHScroll(page)
  })
})
