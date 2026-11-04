/**
 * Responsive pass of the S2 admin question screens (S2-T07; PRD 30 section 4.R, AC-ADM-R1..R5, R9, R10), against the REAL stack.
 *
 *   BASE_URL=http://localhost:5192 E2E_DEMO_PASSWORD=<demo password> \
 *     npx playwright test -c playwright.http.config.ts e2e/m04-question-bank/responsive-s2.spec.ts --workers=1
 *
 * Viewports are the three projects of `playwright.http.config.ts` (375x812, 768x1024, 1280x800). The tests branch on the
 * viewport width, never on the project name: below 1024 px is the "touch" layout (two touch projects).
 *
 * - Width loop (R1, R10): every built S2 screen has no horizontal page scroll; on the touch widths no own control is under
 *   44 x 44 px (a wrapping or associated label of 44 x 44 counts). `KNOWN_OUTSIDE_S2` lists the shared controls of other
 *   sectors that are still under 44 px (reported as needs:S8 and needs:S0); nothing else is excused.
 * - R9 Studio list cards, R2 the keyboard on the Studio editor, R3 the stimulus sheet, R4 Semak Ekstrak panes, R5 figure crop.
 *
 * Writes: R3 makes one stimulus and one group through the API and deletes both in `finally`. Everything else only reads.
 * The batch ids come from the API (an existing batch); a missing one skips the test with the reason.
 */
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { HTTP_MODE } from '../bijak/bijak-flow'
import { demoCreds, NEEDS_PASSWORD } from '../bijak/http-creds'

const { user: ADMIN_USER, pass: ADMIN_PASS } = demoCreds('adminPusat')

test.skip(!HTTP_MODE, 'needs BIJAK_API_BASE or BASE_URL (integration stack)')
test.skip(!ADMIN_USER || !ADMIN_PASS, NEEDS_PASSWORD)

const TOUCH_BELOW = 1024
const MIN_TARGET = 44

/**
 * Controls that belong to another sector and are still under 44 px: the DsDataTable row checkbox and pager (S8, needs:S8) and
 * the shell menu, search and theme buttons (S0, needs:S0). Matched by place in the DOM. Nothing else is excused.
 */
const KNOWN_OUTSIDE_S2 = [
  '[data-ds="data-table"] [role="checkbox"]',
  '[data-ds="data-table-pager"] button',
  '[data-testid="pentadbiran-header"] button',
] as const

const CONTROLS = 'a[href], button, [role="tab"], [role="checkbox"], [role="switch"], [role="radio"], [role="button"], input:not([type="hidden"]), select, textarea, summary'

async function login(page: Page): Promise<string> {
  const res = await page.request.post('/api/auth/login', { data: { identifier: ADMIN_USER, password: ADMIN_PASS } })
  expect(res.ok(), 'API login').toBe(true)
  const session = await page.request.get('/api/session')
  return ((await session.json()) as { data: { csrf: string } }).data.csrf
}

async function list(page: Page, path: string): Promise<Record<string, unknown>[]> {
  const res = await page.request.get(path)
  return res.ok() ? (((await res.json()) as { data?: Record<string, unknown>[] }).data ?? []) : []
}

const width = (page: Page): number => page.viewportSize()?.width ?? 0
const touch = (page: Page): boolean => width(page) < TOUCH_BELOW

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(400)
}

/** Checkbox and radio controls: the only ones whose label may carry the 44 x 44 hit area. */
const LABELLED = 'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]'

/**
 * Page overflow in px, how many own controls were seen, and the visible own controls under 44 x 44 (touch widths only).
 * A wrapping or associated label counts for a checkbox or radio; a button, link or text field must meet 44 px itself.
 */
async function measure(page: Page): Promise<{ overflow: number; seen: number; small: string[] }> {
  return page.evaluate(
    ({ controls, labelled, known, min, checkTargets }) => {
      const el = document.documentElement
      const small: string[] = []
      let seen = 0
      for (const e of Array.from(document.querySelectorAll<HTMLElement>(controls))) {
        const r = e.getBoundingClientRect()
        if (r.width <= 2 && r.height <= 2) continue
        if (r.width === 0 || r.height === 0 || getComputedStyle(e).visibility === 'hidden') continue
        if (known.some((sel) => e.matches(sel) || e.closest(sel) !== null)) continue
        seen += 1
        if (!checkTargets) continue
        const big = (b: DOMRect): boolean => b.width >= min - 0.5 && b.height >= min - 0.5
        if (big(r)) continue
        if (e.matches(labelled)) {
          const labels = Array.from((e as HTMLInputElement).labels ?? [])
          const wrap = e.closest('label')
          if ([wrap, ...labels].some((l) => l !== null && big(l.getBoundingClientRect()))) continue
        }
        const name = e.dataset.testid ?? e.getAttribute('aria-label') ?? (e.textContent ?? '').trim().slice(0, 30)
        small.push(`${e.tagName.toLowerCase()}${e.getAttribute('role') ? `[${e.getAttribute('role')}]` : ''}:${name}:${String(Math.round(r.width))}x${String(Math.round(r.height))}`)
      }
      return { overflow: el.scrollWidth - el.clientWidth, seen, small }
    },
    { controls: CONTROLS, labelled: LABELLED, known: [...KNOWN_OUTSIDE_S2], min: MIN_TARGET, checkTargets: touch(page) },
  )
}

async function expectResponsive(page: Page, what: string): Promise<void> {
  const m = await measure(page)
  expect.soft(m.seen, `${what}: the measure saw no own control (blank, skeleton or error page)`).toBeGreaterThan(0)
  expect.soft(m.overflow, `${what}: horizontal page overflow in px`).toBeLessThanOrEqual(0)
  expect.soft(m.small, `${what}: own controls under ${String(MIN_TARGET)} x ${String(MIN_TARGET)} px`).toEqual([])
}

interface Ids {
  question: string | null
  structured: string | null
  /** Any batch, for the width loop. */
  batch: string | null
  /** A non-manual batch that has items, for R4. */
  reviewBatch: string | null
}

async function discover(page: Page): Promise<Ids> {
  const q = (await list(page, '/api/questions?pageSize=1'))[0]
  const s = (await list(page, '/api/structured-questions?pageSize=1'))[0]
  const batches = await list(page, '/api/intake/batches?pageSize=20')
  const withItems = batches.find((b) => Number(b.itemCount ?? 0) > 0 && b.sourceKind !== 'manual')
  return {
    question: q ? String(q.id) : null,
    structured: s ? String(s.id) : null,
    batch: batches[0] ? String(batches[0].id) : null,
    reviewBatch: withItems ? String(withItems.id) : null,
  }
}

/** A passage stimulus in a group of its own (no members), removed again by `drop`. */
async function makeGroup(page: Page, csrf: string): Promise<{ groupId: string; stimulusId: string; text: string; drop: () => Promise<void> } | null> {
  const headers = { 'x-csrf-token': csrf }
  const token = `R3-${String(Date.now())}`
  const text = `Petikan ujian responsif ${token}. Rajah ini dikongsi oleh soalan di bawahnya.`
  const stim = await page.request.post('/api/stimuli', { headers, data: { kind: 'passage', label: `Petikan ${token}`, body: { ms: text } } })
  if (!stim.ok()) return null
  const stimulusId = String(((await stim.json()) as { data: { id: string } }).data.id)
  const drop = async (): Promise<void> => {
    await page.request.delete(`/api/stimulus-groups/${groupId}`, { headers }).catch(() => undefined)
    await page.request.delete(`/api/stimuli/${stimulusId}`, { headers }).catch(() => undefined)
  }
  let groupId = ''
  const grp = await page.request.post('/api/stimulus-groups', { headers, data: { label: `Kumpulan ${token}`, stimulusIds: [stimulusId], questionIds: [] } })
  if (!grp.ok()) {
    await page.request.delete(`/api/stimuli/${stimulusId}`, { headers }).catch(() => undefined)
    return null
  }
  groupId = String(((await grp.json()) as { data: { id: string } }).data.id)
  return { groupId, stimulusId, text, drop }
}

test.describe('S2 responsive pass (S2-T07) @api', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  /* ---------------------------------------------------------------------------------- R1 and R10: every built S2 screen */

  /** `anchor`: a testid of the real, loaded page (never the shell), asserted before measuring so a 404, a login redirect or a skeleton cannot pass. */
  const SCREENS: { name: string; anchor: string; path: (ids: Ids) => string | null }[] = [
    { name: 'Studio list', anchor: 'studio-table', path: () => '/admin/studio' },
    { name: 'Studio create', anchor: 'studio-form', path: () => '/admin/studio/questions/create' },
    { name: 'Studio sunting', anchor: 'studio-form', path: (i) => (i.question ? `/admin/studio/questions/${i.question}/sunting` : null) },
    { name: 'Intake list', anchor: 'intake-table', path: () => '/admin/spm/soalan/ekstrak' },
    { name: 'Muat naik', anchor: 'intake-upload-page', path: () => '/admin/spm/soalan/muat-naik' },
    { name: 'Manual', anchor: 'intake-manual-page', path: () => '/admin/spm/soalan/manual' },
    { name: 'Import CSV', anchor: 'import-form', path: () => '/admin/questions/import' },
    { name: 'Import history', anchor: 'history-page', path: () => '/admin/questions/import-history' },
    { name: 'Senarai Soalan', anchor: 'questions-table', path: () => '/admin/questions' },
    { name: 'Kualiti', anchor: 'quality-page', path: () => '/admin/questions/quality' },
    { name: 'Laporan soalan', anchor: 'reports-page', path: () => '/admin/question-reports' },
    { name: 'Penghantaran soalan', anchor: 'submissions-table', path: () => '/admin/question-submissions' },
    { name: 'Soalan berstruktur list', anchor: 'structured-table', path: () => '/admin/structured-questions' },
    { name: 'Soalan berstruktur detail', anchor: 'structured-detail', path: (i) => (i.structured ? `/admin/structured-questions/${i.structured}` : null) },
    { name: 'Quick Edit', anchor: 'bank-edit-page', path: (i) => (i.question ? `/admin/spm/soalan/${i.question}/sunting` : null) },
    { name: 'Soalan gambar', anchor: 'diagrams-page', path: () => '/admin/soalan-gambar' },
  ]

  for (const screen of SCREENS) {
    test(`${screen.name}: no horizontal scroll, own targets >= 44 px on touch @api`, async ({ page }) => {
      const path = screen.path(await discover(page))
      test.skip(path === null, `no record to open for ${screen.name} in the seed`)
      await page.goto(path as string)
      const anchor = page.getByTestId(screen.anchor).first()
      const unavailable = page.getByTestId('unavailable-state')
      await expect(anchor.or(unavailable).first(), `${screen.name}: the page did not load`).toBeVisible()
      // A screen the API mode does not serve shows its "not available" state: nothing to measure, so say so instead of passing.
      test.skip(await unavailable.isVisible(), `${screen.name} is not served in http mode (unavailable state)`)
      await expect(anchor, `${screen.name}: the page did not load`).toBeVisible()
      await settle(page)
      await expectResponsive(page, screen.name)
    })
  }

  test('Semak Ekstrak: both panes, no horizontal scroll, own targets >= 44 px on touch @api', async ({ page }) => {
    const ids = await discover(page)
    test.skip(ids.batch === null, 'no intake batch on this stack')
    await page.goto(`/admin/spm/soalan/ekstrak/${String(ids.batch)}`)
    await settle(page)
    await expect(page.getByTestId('intake-review-page')).toBeVisible()
    await expect(page.getByTestId('questions-panel')).toBeVisible()
    const head = page.getByTestId('question-card').first().locator('button[aria-expanded]').first()
    if ((await head.count()) > 0 && (await head.getAttribute('aria-expanded')) !== 'true') await head.click()
    await expectResponsive(page, 'Semak Ekstrak (Editor)')
    if (touch(page)) {
      await page.getByRole('tab', { name: 'Sumber PDF' }).click()
      await expect(page.getByTestId('source-panel')).toBeVisible()
      await expectResponsive(page, 'Semak Ekstrak (Sumber PDF)')
    }
  })

  test('Studio group page: no horizontal scroll, own targets >= 44 px on touch @api', async ({ page }) => {
    const csrf = await login(page)
    const g = await makeGroup(page, csrf)
    test.skip(g === null, 'a stimulus group could not be created through the API on this stack')
    try {
      await page.goto(`/admin/studio/groups/${g!.groupId}`)
      await expect(page.getByTestId('studio-group-panel')).toBeVisible()
      await settle(page)
      await expectResponsive(page, 'Studio group page')
    } finally {
      await g!.drop()
    }
  })

  /* ---------------------------------------------------------------------------------------------- R9: Studio list cards */

  test('R9 Studio list: below md each row is a card with the full stem, 3 lines and Lihat penuh @api', async ({ page }) => {
    test.skip(width(page) >= 768, 'cards are the phone layout; the table is unchanged from md')
    await page.goto('/admin/studio')
    await expect(page.getByTestId('studio-card').first()).toBeVisible()
    await settle(page)
    const cards = page.getByTestId('studio-card')
    expect(await cards.count()).toBeGreaterThan(0)

    // The status badge is not cut mid-word and not wrapped onto two lines.
    const badge = cards.first().getByTestId('studio-row-status')
    const fit = await badge.evaluate((b) => {
      const tops = new Set<number>()
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const r of Array.from(range.getClientRects())) tops.add(Math.round(r.top))
      }
      return { clipped: b.scrollWidth > b.clientWidth + 1, lines: tops.size }
    })
    expect(fit.clipped, 'badge text clipped').toBe(false)
    expect(fit.lines, 'badge lines').toBeLessThanOrEqual(1)

    // The longest stem of the page: full text (not the 80 character excerpt), clamped to 3 lines.
    const stems = await page.getByTestId('studio-card-stem').evaluateAll((els) => els.map((e) => (e.textContent ?? '').length))
    const longest = stems.indexOf(Math.max(...stems))
    test.skip(Math.max(...stems) <= 120, 'no stem on this page is longer than 3 lines')
    const stem = page.getByTestId('studio-card-stem').nth(longest)
    // The rendered text is the full API text of that row (found by its number label), not the 80 character excerpt.
    const no = ((await cards.nth(longest).getByTestId('studio-card-no').textContent()) ?? '').trim()
    const api = (await list(page, '/api/questions?pageSize=25')).find((r) => String(r.numberLabel || r.id) === no)
    expect(api, `row ${no} is in the API page`).toBeDefined()
    const flat = (t: string): string => t.replace(/\s+/g, ' ').trim()
    expect(flat((await stem.textContent()) ?? '')).toBe(flat(String(api?.questionText)))
    expect(await stem.evaluate((e) => getComputedStyle(e).getPropertyValue('-webkit-line-clamp'))).toBe('3')
    const card = cards.nth(longest)
    const row = card.locator('xpath=ancestor::li[1]')
    const more = card.getByTestId('studio-card-more')
    await expect(more).toHaveText('Lihat penuh')
    const collapsed = (await stem.boundingBox())!.height
    await more.click()
    await expect(more).toHaveText('Tunjuk kurang')
    expect((await stem.boundingBox())!.height, 'the stem grows when expanded').toBeGreaterThan(collapsed + 4)
    await more.click()
    await expect(more).toHaveText('Lihat penuh')

    // Row actions are reachable in one tap (a card has them inline) and the card keeps the kertas line.
    await expect(row.getByTestId('studio-row-preview')).toBeVisible()
    await expect(card.getByTestId('studio-card-kertas')).toBeVisible()
    await expect(card.getByTestId('studio-card-sumber')).toBeVisible()
    await expectResponsive(page, 'Studio list cards')
  })

  /* ----------------------------------------------------------------------------- R2: the keyboard on the Studio editor */

  test('R2 Studio editor at 375: with the keyboard up the stem field and the save bar are both in view @api', async ({ page }) => {
    test.skip(width(page) !== 375, 'the keyboard case is the 375 px phone')
    await page.setViewportSize({ width: 375, height: 420 })
    await page.goto('/admin/studio/questions/create')
    const stem = page.getByTestId('studio-stem')
    await expect(stem).toBeVisible()
    await stem.click()
    await expect(stem).toBeFocused()
    await page.waitForTimeout(500)
    const view = page.viewportSize()!
    const field = (await stem.boundingBox())!
    const bar = (await page.getByTestId('studio-save-bar').boundingBox())!
    expect(field.y, 'field top is in the viewport').toBeGreaterThanOrEqual(0)
    expect(field.y + field.height, 'field bottom is in the viewport').toBeLessThanOrEqual(view.height)
    expect(bar.y, 'save bar top is in the viewport').toBeGreaterThanOrEqual(0)
    expect(bar.y + bar.height, 'save bar bottom is in the viewport').toBeLessThanOrEqual(view.height + 1)
    expect(field.y + field.height, 'the save bar does not cover the field').toBeLessThanOrEqual(bar.y + 1)
  })

  /* ---------------------------------------------------------------------------------- R3: the stimulus in a sheet < 1024 */

  test('R3 Studio editor of a group question: Rangsangan opens the stimulus in one tap and closes without losing text @api', async ({ page }) => {
    const csrf = await login(page)
    const g = await makeGroup(page, csrf)
    test.skip(g === null, 'a stimulus group could not be created through the API on this stack')
    try {
      await page.goto(`/admin/studio/questions/create?kumpulan=${g!.groupId}`)
      await expect(page.getByTestId('studio-stem')).toBeVisible()
      await expect(page.getByTestId('studio-group-id')).toBeVisible()
      const chip = page.getByTestId('studio-stimulus-open')
      if (!touch(page)) {
        // From 1024 px the page does not add a chip or a pinned panel.
        await expect(chip).toHaveCount(0)
        return
      }
      await expect(chip).toHaveText('Rangsangan')
      const typed = 'Soalan 2 ujian responsif'
      await page.getByTestId('studio-stem').fill(typed)
      await chip.click() // one tap
      const sheet = page.getByRole('dialog', { name: 'Rangsangan' })
      await expect(sheet).toBeVisible()
      await expect(sheet).toContainText(g!.text)
      if (width(page) < 640) {
        const box = (await sheet.boundingBox())!
        expect(box.y + box.height, 'a bottom sheet sits on the bottom edge').toBeGreaterThanOrEqual(page.viewportSize()!.height - 2)
      }
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
      await expect(page.getByTestId('studio-stem')).toHaveValue(typed)
      await expectResponsive(page, 'Studio editor of a group question')
    } finally {
      await g!.drop()
    }
  })

  /* --------------------------------------------------------------------------- R4: Semak Ekstrak, Sumber PDF | Editor */

  test('R4 Semak Ekstrak: Sumber PDF and Editor keep the page and the item, the action bar stays reachable @api', async ({ page }) => {
    const ids = await discover(page)
    test.skip(ids.reviewBatch === null, 'no non-manual intake batch with items on this stack')
    await page.goto(`/admin/spm/soalan/ekstrak/${String(ids.reviewBatch)}`)
    await expect(page.getByTestId('question-card').first()).toBeVisible()

    if (!touch(page)) {
      // Side by side from lg: no tabs, source on the left, editor on the right.
      await expect(page.getByRole('tab')).toHaveCount(0)
      const left = (await page.getByTestId('source-panel').boundingBox())!
      const right = (await page.getByTestId('questions-panel').boundingBox())!
      expect(left.x + left.width).toBeLessThanOrEqual(right.x + 1)
      // The source holds its place while the editor scrolls (sticky). Open every item so the editor is long enough to scroll.
      for (const h of await page.getByTestId('question-card').locator('button[aria-expanded="false"]').all()) await h.click()
      const top = await page.getByTestId('source-panel').evaluate(async (panel) => {
        let sc: HTMLElement | null = panel.parentElement
        while (sc !== null && !(sc.scrollHeight > sc.clientHeight + 5 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement
        const room = sc === null ? 0 : sc.scrollHeight - sc.clientHeight
        if (sc === null || room < 300) return null
        sc.scrollTop = Math.min(700, room)
        await new Promise((r) => setTimeout(r, 300))
        return panel.getBoundingClientRect().top
      })
      expect(top, 'the page did not scroll 300 px or more: the sticky source cannot be checked').not.toBeNull()
      expect(top, 'the source pane scrolled away instead of staying in view').toBeGreaterThanOrEqual(-1)
      expect(top).toBeLessThan(200)
      return
    }

    const tabs = page.getByRole('tablist', { name: 'Paparan' }).getByRole('tab')
    await expect(tabs).toHaveText(['Sumber PDF', 'Editor'])
    await expect(page.getByRole('tab', { name: 'Editor' })).toHaveAttribute('aria-selected', 'true')

    const header = page.getByTestId('question-card').first().locator('button[aria-expanded]').first()
    // The first item opens by itself; open it only when it is closed.
    if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    const counter = page.getByTestId('item-counter').first()
    const counterText = await counter.textContent()

    for (let round = 0; round < 2; round++) {
      await page.getByRole('tab', { name: 'Sumber PDF' }).click()
      await expect(page.getByTestId('source-panel')).toBeVisible()
      await expect(page.getByTestId('questions-panel')).toBeHidden()
      // The source page that was shown stays the pressed one.
      await expect(page.getByRole('group', { name: 'Pilih halaman' }).locator('[aria-pressed="true"]')).toHaveCount(1)
      await page.getByRole('tab', { name: 'Editor' }).click()
      await expect(page.getByTestId('questions-panel')).toBeVisible()
      await expect(page.getByTestId('source-panel')).toBeHidden()
      // The same item is still open.
      await expect(header).toHaveAttribute('aria-expanded', 'true')
      expect(await counter.textContent()).toBe(counterText)
    }

    // The action bar is reachable: scroll to it and nothing covers its first button.
    const accept = page.getByTestId('item-accept').first()
    await accept.scrollIntoViewIfNeeded()
    await expect(accept).toBeVisible()
    const covered = await accept.evaluate((b) => {
      const r = b.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return !(hit !== null && b.contains(hit))
    })
    expect(covered, 'Terima is covered by another element').toBe(false)
    await expectResponsive(page, 'Semak Ekstrak after switching panes')
  })

  /* ----------------------------------------------------------------------------------------- R5: figure crop full-screen */

  test('R5 Semak Ekstrak: a tap on a figure crop opens it full-screen @api', async ({ page }) => {
    const ids = await discover(page)
    test.skip(ids.reviewBatch === null, 'no non-manual intake batch with items on this stack')
    await page.goto(`/admin/spm/soalan/ekstrak/${String(ids.reviewBatch)}`)
    await expect(page.getByTestId('question-card').first()).toBeVisible()
    if (touch(page)) await page.getByRole('tab', { name: 'Sumber PDF' }).click()
    const crop = page.getByTestId('figure-tap').locator('img').first()
    test.skip((await crop.count()) === 0, 'no batch on this stack has a stimulus with a figure crop (covered by the component test intake-review-panes)')
    await crop.click()
    const viewer = page.getByRole('dialog')
    await expect(viewer.getByTestId('figure-viewer-img')).toBeVisible()
    const box = (await viewer.boundingBox())!
    const view = page.viewportSize()!
    expect(box.width).toBeGreaterThanOrEqual(view.width - 2)
    expect(box.height).toBeGreaterThanOrEqual(view.height - 2)
  })
})
