/**
 * @api The five single-player games (M16 S13-S17) against the REAL API, http mode (D58a keyless payloads).
 * Routes: /permainan/{betul-salah,cabaran-kilat,tembak-jawapan,susun-jawapan}?darjah=10 and /permainan/kad-memori.
 * Wire: GET /api/games/solo/{game} (no key fields) -> POST .../check (Kad Memori: .../reveal then .../check)
 * -> POST .../submit with the body exactly { session_id }.
 *
 * Data note: the local PoC seed has questions for darjah 10/11 (Tingkatan 4/5) only, so `?darjah=10`; Kad Memori
 * draws D1..D4 questions and needs at least 6 of them. The pupil logs in ONCE (login throttle 5/min per
 * identifier) and the tests share that page (serial).
 */

import type { BrowserContext, Page, Request, Response } from '@playwright/test'

import { expect, loginViaUi, test } from '../fixtures/api'
import { account, newPeerContext } from './helpers'

const KEY_FIELDS = ['is_true', 'correct', 'answer', 'pair_id', 'content']
const DARJAH = 10

/** Every object key anywhere in a JSON value. */
function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out))
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      out.add(k)
      allKeys(x, out)
    }
  }
  return out
}

/** The payload of an API reply, with or without a `{ data }` envelope. */
function unwrap(json: unknown): Record<string, unknown> {
  const o = (json ?? {}) as Record<string, unknown>
  return (o.data && typeof o.data === 'object' ? o.data : o) as Record<string, unknown>
}

const isSolo = (r: { url(): string; method(): string }, game: string, tail: string, method: string): boolean =>
  new URL(r.url()).pathname === `/api/games/solo/${game}${tail}` && r.method() === method

const waitGet = (page: Page, game: string): Promise<Response> =>
  page.waitForResponse((r) => isSolo(r.request(), game, '', 'GET'), { timeout: 30_000 })
const waitPostRes = (page: Page, game: string, tail: string): Promise<Response> =>
  page.waitForResponse((r) => isSolo(r.request(), game, tail, 'POST'), { timeout: 60_000 })
const waitPostReq = (page: Page, game: string, tail: string): Promise<Request> =>
  page.waitForRequest((r) => isSolo(r, game, tail, 'POST'), { timeout: 120_000 })

async function expectKeyless(res: Response): Promise<void> {
  expect(res.status(), 'GET solo payload').toBe(200)
  const keys = allKeys(await res.json())
  for (const k of KEY_FIELDS) expect(keys.has(k), `payload has no "${k}" field`).toBe(false)
}

/** Opens a game page and returns its (keyless) GET response. */
async function open(page: Page, game: string, query = `?darjah=${String(DARJAH)}`): Promise<Response> {
  const get = waitGet(page, game)
  await page.goto(`/permainan/${game}${query}`)
  const res = await get
  await expectKeyless(res)
  return res
}

/** No horizontal page scroll at the current viewport (the mandatory responsive rule). */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(fits, 'no horizontal page scroll').toBe(true)
}

async function expectSubmit(req: Request, res: Promise<Response>): Promise<void> {
  expect(req.postDataJSON(), 'submit body is only the session id').toEqual({
    session_id: expect.any(String),
  })
  expect(Object.keys(req.postDataJSON() as object)).toEqual(['session_id'])
  expect((await res).status(), 'POST submit').toBe(200)
}

test.describe('solo games (http) @api', () => {
  test.describe.configure({ mode: 'serial' })

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }, info) => {
    test.setTimeout(90_000)
    context = await newPeerContext(browser, info)
    page = await context.newPage()
    const { user, pass } = account('student')
    await loginViaUi(page, user, pass)
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('Betul atau Salah: keyless items, check, feedback, 45 s clock then submit @api', async () => {
    test.setTimeout(150_000)
    const get = await open(page, 'betul-salah')
    const body = unwrap(await get.json())
    expect(JSON.stringify(body).length).toBeGreaterThan(10)
    expect(typeof body.sessionId === 'string' || typeof body.session_id === 'string').toBe(true)

    const card = page.getByTestId('solo-card')
    await expect(card).toBeVisible({ timeout: 30_000 }) // after the 3 s countdown
    await expect(card).not.toHaveText('')
    await expectNoHorizontalScroll(page)

    // The clock ends the game at 45 s: arm the submit listeners now.
    const submitReq = waitPostReq(page, 'betul-salah', '/submit')
    const submitRes = waitPostRes(page, 'betul-salah', '/submit')

    for (let i = 0; i < 2; i++) {
      const check = waitPostRes(page, 'betul-salah', '/check')
      await page.getByTestId(i === 0 ? 'solo-betul' : 'solo-salah').click()
      const res = await check
      expect(res.status(), 'POST check').toBe(200)
      const feedback = page.getByTestId('solo-feedback')
      await expect(feedback).toBeVisible()
      await expect(feedback).toHaveText(/✅|❌/)
      const verdict = unwrap(await res.json()).correct
      await expect(feedback).toHaveText(verdict === true ? '✅' : '❌')
      await expect(feedback).toBeHidden({ timeout: 5_000 }) // 700 ms, then the next statement
    }

    await expectSubmit(await submitReq, submitRes)
    const result = page.getByTestId('solo-result')
    await expect(result).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('solo-result-tile')).toHaveCount(4)
    await expect(page.getByTestId('solo-result-title')).not.toHaveText('')
  })

  test('Cabaran Kilat: keyless questions, check 200, option state @api', async () => {
    test.setTimeout(90_000)
    await open(page, 'cabaran-kilat')
    const options = page.getByTestId('solo-option')
    await expect(options.first()).toBeVisible({ timeout: 30_000 })
    expect(await options.count()).toBeGreaterThanOrEqual(2)
    await expect(page.getByTestId('solo-card')).not.toHaveText('')
    await expect(options.first()).toHaveAttribute('data-state', 'idle')
    await expectNoHorizontalScroll(page)

    const check = waitPostRes(page, 'cabaran-kilat', '/check')
    await options.first().click()
    const res = await check
    expect(res.status(), 'POST check').toBe(200)
    const correct = unwrap(await res.json()).correct === true
    await expect(options.first()).toHaveAttribute('data-state', correct ? 'correct' : 'wrong')
    // The other options are dimmed during the 400 ms before the next question.
    await expect(options.nth(1)).toHaveAttribute('data-state', 'dimmed')
    // Then the next question comes with idle options.
    await expect(page.getByText('Soalan 2')).toBeVisible({ timeout: 5_000 })
    await expect(options.first()).toHaveAttribute('data-state', 'idle')
  })

  test('Tembak Jawapan: keyless questions, first tap posts check, score or lives react @api', async () => {
    test.setTimeout(90_000)
    await open(page, 'tembak-jawapan')
    const tile = page.getByTestId('solo-tile').first()
    await expect(tile).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('solo-heart')).toHaveCount(3)
    await expect(page.locator('[data-testid=solo-heart][data-lost=true]')).toHaveCount(0)
    await expect(page.getByTestId('solo-score')).toHaveText('0')
    await expectNoHorizontalScroll(page)

    const check = waitPostRes(page, 'tembak-jawapan', '/check')
    await tile.click({ force: true }) // the tile is falling: do not wait for it to be stable
    const res = await check
    expect(res.status(), 'POST check').toBe(200)
    const correct = unwrap(await res.json()).correct === true
    if (correct) {
      await expect(page.getByTestId('solo-score')).not.toHaveText('0')
      await expect(page.getByText('Soalan 2')).toBeVisible()
    } else {
      await expect(page.locator('[data-testid=solo-heart][data-lost=true]')).toHaveCount(1)
      await expect(page.locator('[data-testid=solo-tile][data-wrong=true]')).toHaveCount(1)
    }
  })

  test('Susun Jawapan: keyless puzzles, Semak -> check 200 -> panel, skip to the end -> submit @api', async () => {
    test.setTimeout(120_000)
    await open(page, 'susun-jawapan')
    await expect(page.getByTestId('solo-card')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Soalan 1 daripada')).toBeVisible()
    await expect(page.getByTestId('solo-check')).toBeDisabled()
    await expectNoHorizontalScroll(page)

    // Place every tile in the shown order, then Semak.
    const source = page.getByTestId('solo-source').getByTestId('solo-tile')
    const total = await source.count()
    expect(total).toBeGreaterThan(0)
    for (let i = 0; i < total; i++) await source.first().click()
    await expect(page.getByTestId('solo-placed')).toHaveCount(total)

    const check = waitPostRes(page, 'susun-jawapan', '/check')
    await page.getByTestId('solo-check').click()
    const res = await check
    expect(res.status(), 'POST check').toBe(200)
    const correct = unwrap(await res.json()).correct === true
    const feedback = page.getByTestId('solo-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText(correct ? 'BETUL!' : 'Cuba lagi atau langkau')
    await expect(page.locator(`[data-testid=solo-dot][data-state=${correct ? 'done' : 'pending'}]`).first()).toBeVisible()

    // Skip / continue to the end of the 20 puzzles.
    const submitReq = waitPostReq(page, 'susun-jawapan', '/submit')
    const submitRes = waitPostRes(page, 'susun-jawapan', '/submit')
    const result = page.getByTestId('solo-result')
    const next = page.locator('[data-testid=solo-next], [data-testid=solo-skip], [data-testid=solo-skip-question]')
    for (let i = 0; i < 40 && !(await result.isVisible()); i++) {
      // Bounded and explicit: either a continue/skip button is there to click, or the result is already shown.
      await expect(next.first().or(result)).toBeVisible({ timeout: 10_000 })
      if (await result.isVisible()) break
      await next.first().click({ timeout: 10_000 })
    }
    await expectSubmit(await submitReq, submitRes)
    await expect(result).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('solo-result-tile')).toHaveCount(3)
  })

  test('Kad Memori: keyless cards, first tap reveals a face, second tap posts check @api', async () => {
    test.setTimeout(90_000)
    const get = await open(page, 'kad-memori', '')
    const body = unwrap(await get.json())
    expect((body.cards as unknown[]).length).toBe(12)
    const cards = page.getByTestId('solo-card-item')
    await expect(cards).toHaveCount(12, { timeout: 30_000 })
    await expect(cards.first()).toHaveAttribute('data-state', 'hidden')
    await expectNoHorizontalScroll(page)

    const reveal = waitPostRes(page, 'kad-memori', '/reveal')
    await cards.nth(0).click()
    const revealed = await reveal
    expect(revealed.status(), 'POST reveal').toBe(200)
    await expect(cards.nth(0)).toHaveAttribute('data-state', 'flipped')
    await expect(cards.nth(0)).toHaveText(/\S/)
    await expect(cards.nth(0)).not.toContainText('❓')

    const check = waitPostRes(page, 'kad-memori', '/check')
    await cards.nth(1).click()
    const res = await check
    expect(res.status(), 'POST check').toBe(200)
    await expect(page.getByTestId('solo-moves')).toContainText('1 langkah')
    const correct = unwrap(await res.json()).correct === true
    if (correct) {
      await expect(cards.nth(0)).toHaveAttribute('data-state', 'matched')
      await expect(cards.nth(1)).toHaveAttribute('data-state', 'matched')
      await expect(page.getByTestId('solo-matched')).toContainText('1 / 6')
    } else {
      // Mismatch: both shown (wrong) then flipped back after 800 ms.
      await expect(cards.nth(1)).toHaveText(/\S/)
      await expect(cards.nth(0)).toHaveAttribute('data-state', 'hidden', { timeout: 5_000 })
      await expect(cards.nth(1)).toHaveAttribute('data-state', 'hidden')
    }
  })
})
