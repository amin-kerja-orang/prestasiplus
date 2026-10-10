/**
 * M16 L26 Permainan, G5 round 2 (QA): the AC groups that round 1 did not execute: AC-M16-09.2 (arena scoring),
 * 04.4 (deterministic replay), 19.3 / 19.4 (Papan Bijak board, winner and Pendahulu), 27.5 (already spun, 409
 * alert) and the S9-S12 room play-through. Murid account `pelajar@demo.test`. Screenshots go to `.playwright-mcp/`.
 */

import type { Page } from '@playwright/test'

import { addInitSession, wireMockPage } from '../fixtures/mock-page'
import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect as baseExpect, test } from '../fixtures/test'
import type { MockHandle } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

const expect = baseExpect.configure({ timeout: Number(process.env.E2E_EXPECT_MS) || 10_000 })

const STUDENT = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(16)] }
const SHOTS = '.playwright-mcp/r2-'

test.use({ mockInit: { latency: 0 } })

async function pause(page: Page, clock: { pauseAt(t: number): Promise<void> }): Promise<void> {
  await clock.pauseAt((await page.evaluate(() => Date.now())) + 10_000)
}

/** Client-side navigation (keeps the mock state, unlike a page load). */
async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(p: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

async function openArena(page: Page, gotoApp: (p: string) => Promise<void>, mock: MockHandle) {
  await gotoApp('/battle')
  await expect(page.getByTestId('battle-lobby').locator('h2').first()).toHaveText('Battle Arena')
  const tile = page.getByTestId('battle-subject').filter({ hasText: 'Matematik' })
  if (!(await tile.first().isVisible())) await page.getByTestId('battle-toggle-more').click()
  await tile.first().click()
  // Freeze the page clock: from here on time moves only with `mock.advanceTime`, so an answer "after 3 s" is exactly 3 s.
  await page.context().clock.pauseAt((await page.evaluate(() => Date.now())) + 10_000)
  await page.getByTestId('battle-quick-match').click()
  await expect(page.getByTestId('battle-timer')).toBeVisible()
  for (let n = 1; n <= 3; n++) {
    await mock.advanceTime(3000) // one 3 s poll per step: the 3rd poll matches
    await expect
      .poll(async () => (await mock.requests('/api/battle/poll-match/*')).length)
      .toBeGreaterThanOrEqual(n)
  }
  await expect(page).toHaveURL(/\/battle\/arena\/[0-9a-f-]{36}$/)
  await expect(page.getByTestId('battle-arena-progress')).toHaveText('Soalan 1/10')
}

/** Answers the 10 arena questions with option `pick(i)` after `delay(i)` seconds; returns the feedback per question. */
async function playArena(
  page: Page,
  mock: MockHandle,
  pick: (i: number) => number,
  delay: (i: number) => number,
) {
  const rows: { i: number; delay: number; feedback: string; scoreA: number; scoreB: number }[] = []
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId('battle-arena-progress')).toHaveText(`Soalan ${String(i)}/10`)
    await mock.advanceTime(delay(i) * 1000)
    await page.getByTestId('battle-arena-option').nth(pick(i)).click()
    const fb = page.getByTestId('battle-arena-feedback')
    await expect(fb).toBeVisible()
    const feedback = (await fb.innerText()).trim()
    const scoreA = Number(await page.getByTestId('battle-arena-score-A').innerText())
    const scoreB = Number(await page.getByTestId('battle-arena-score-B').innerText())
    rows.push({ i, delay: delay(i), feedback, scoreA, scoreB })
    await mock.advanceTime(1500)
  }
  return rows
}

test.describe('M16 L26 round 2', MODULE, () => {
  test('QA-R2-09.2 arena: a correct answer after 3 s adds 900, a wrong one adds 0; the bot answers @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    test.setTimeout(240_000)
    await loginAs(STUDENT)
    await openArena(page, gotoApp, mock)
    const rows = await playArena(
      page,
      mock,
      (i) => i % 4,
      () => 3,
    )
    // eslint-disable-next-line no-console
    console.log('QA-R2-09.2 rows', JSON.stringify(rows))
    let running = 0
    let botMoved = false
    for (const r of rows) {
      const gain = Number(/^\+(\d+)/.exec(r.feedback)?.[1])
      expect([0, 900]).toContain(gain)
      running += gain
      expect(r.scoreA).toBe(running)
      if (r.scoreB > 0) botMoved = true
    }
    expect(rows.some((r) => /^\+900/.test(r.feedback))).toBe(true)
    expect(botMoved).toBe(true)
    await page.screenshot({ path: `${SHOTS}ac092-${test.info().project.name}.png` })
  })

  test('QA-R2-09.2b arena: the score follows 1000 - round(500 x s / 15) at 0, 7 and 14 s @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    test.setTimeout(240_000)
    await loginAs(STUDENT)
    await openArena(page, gotoApp, mock)
    const secs = [0, 7, 14, 0, 7, 14, 0, 7, 14, 0]
    const rows = await playArena(
      page,
      mock,
      (i) => i % 4,
      (i) => secs[i - 1]!,
    )
    // eslint-disable-next-line no-console
    console.log('QA-R2-09.2b rows', JSON.stringify(rows))
    for (const r of rows) {
      const gain = Number(/^\+(\d+)/.exec(r.feedback)?.[1])
      const expected = 1000 - Math.round((500 * r.delay) / 15)
      expect([0, expected]).toContain(gain)
    }
    expect(rows.some((r) => !/^\+0/.test(r.feedback))).toBe(true)
  })

  test('QA-R2-04.4 replay: the same flow in two fresh browser contexts gives the same arena, spin and room game @m16', async ({
    browser,
  }) => {
    test.setTimeout(500_000)
    const replay = async () => {
      const ctx = await browser.newContext({
        viewport: test.info().project.use.viewport ?? { width: 1280, height: 800 },
        locale: 'ms-MY',
        timezoneId: 'Asia/Kuala_Lumpur',
      })
      try {
        const page = await ctx.newPage()
        await wireMockPage(page, { mockInit: { latency: 0 } })
        await addInitSession(page, STUDENT)
        const mock = createMockHandle(page)
        const go = (path: string) => gotoAppOn(page, path)
        await openArena(page, go, mock)
        const rows = await playArena(
          page,
          mock,
          (i) => i % 4,
          () => 3,
        )
        const arena = rows.map((r) => `${r.feedback}|${String(r.scoreA)}|${String(r.scoreB)}`).join(';')

        await spaGo(page, '/permainan/roda-nasib')
        await expect(page.getByTestId('spin-button')).toHaveText('🎯 SPIN!')
        await page.getByTestId('spin-button').click()
        await mock.advanceTime(4200)
        await expect(page.getByTestId('prize-label')).toBeVisible()
        const spin = await page.getByTestId('prize-label').innerText()

        await spaGo(page, '/perang-fakta')
        await page.getByTestId('create-submit').click()
        await expect(page).toHaveURL(/\/perang-fakta\/[A-Z0-9]{6}$/)
        await mock.advanceTime(3000)
        await expect(page.getByTestId('room-player')).toHaveCount(2)
        await page.getByTestId('room-start').click()
        for (let round = 1; round <= 15; round++) {
          await expect(page.getByTestId('room-round')).toHaveText(`Pusingan ${String(round)}/15`)
          await page.getByTestId('room-option').first().click()
        }
        await expect(page.getByTestId('room-result-title')).toBeVisible()
        const room = [
          await page.getByTestId('room-result-title').innerText(),
          (await page.getByTestId('room-scores').innerText()).replace(/\s+/g, ' '),
        ].join(' || ')
        return { arena, spin, room }
      } finally {
        await ctx.close()
      }
    }
    const a = await replay()
    const b = await replay()
    // eslint-disable-next-line no-console
    console.log('QA-R2-04.4 A', JSON.stringify(a), 'B', JSON.stringify(b))
    expect(b.arena).toBe(a.arena)
    expect(b.spin).toBe(a.spin)
    expect(b.room).toBe(a.room)
  })

  test('QA-R2-19.4 Papan Bijak room: 50 tiles, 3 ladders, 3 snakes, 2 bonus, 2 traps, 35 quiz @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/papan-bijak')
    await page.getByTestId('create-submit').click()
    await expect(page).toHaveURL(/\/papan-bijak\/[A-Z0-9]{6}$/)
    await mock.advanceTime(3000)
    await expect(page.getByTestId('room-player')).toHaveCount(2)
    await page.getByTestId('room-start').click()
    await expect(page.getByTestId('room-tile')).toHaveCount(50)
    const tiles = await page.getByTestId('room-tile').allInnerTexts()
    const count = (emoji: string) => tiles.filter((t) => t.includes(emoji)).length
    expect({
      ladder: count('🪜'),
      snake: count('🐍'),
      bonus: count('🎁'),
      trap: count('⚠️'),
      quiz: count('❓'),
    }).toEqual({ ladder: 3, snake: 3, bonus: 2, trap: 2, quiz: 35 })
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: `${SHOTS}ac194-${test.info().project.name}.png`, fullPage: true })
  })

  test('QA-R2-19.3 a won Perang Fakta room is shown as my win; the stored win count, Pendahulu and S29 Selesai are asserted in the unit test @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    test.setTimeout(120_000)
    await loginAs(STUDENT)
    await gotoApp('/perang-fakta')
    await page.getByTestId('create-submit').click()
    await expect(page).toHaveURL(/\/perang-fakta\/[A-Z0-9]{6}$/)
    await mock.advanceTime(3000)
    await expect(page.getByTestId('room-player')).toHaveCount(2)
    await page.getByTestId('room-start').click()
    for (let round = 1; round <= 15; round++) {
      await expect(page.getByTestId('room-round')).toHaveText(`Pusingan ${String(round)}/15`)
      await page.getByTestId('room-option').first().click()
    }
    await expect(page.getByTestId('room-result-title')).toHaveText('🏆 Pelajar Demo menang!')
    await expect(page.getByTestId('room-scores').locator('li')).toHaveCount(2)
    await page.screenshot({ path: `${SHOTS}ac193-win-${test.info().project.name}.png` })
    // Back in the lobby the Pendahulu list keeps its 10 rows: a first win (1) is below the visible cut (2+).
    await spaGo(page, '/perang-fakta')
    await expect(page.getByTestId('leaders-row')).toHaveCount(10)
  })

  test('QA-R2-320 S6-S12 have no horizontal scroll at 320 px @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(STUDENT)
    await page.setViewportSize({ width: 320, height: 640 })
    const paths = [
      '/permainan',
      '/papan-bijak',
      '/perang-fakta',
      '/benteng-ilmu',
      '/perlumbaan-matematik',
      '/kuiz-relay',
      '/teka-silang-kata',
    ]
    for (const [i, path] of paths.entries()) {
      if (i === 0) await gotoApp(path)
      else await spaGo(page, path)
      await expect(
        page.getByTestId(i === 0 ? 'hub-h1' : i === 1 ? 'pb-h1' : 'lobby-h1'),
      ).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
    await page.screenshot({ path: `${SHOTS}s12-320-${test.info().project.name}.png`, fullPage: true })
  })

  test('QA-R2-13 S4 hero line has "PPD" once (BUG-L26-01): 8106, 8090 and 900 @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(STUDENT)
    const seen: Record<string, string> = {}
    for (const id of ['8106', '8090', '900']) {
      if (id === '8106') await gotoApp(`/battle/ranking-sekolah/${id}`)
      else await spaGo(page, `/battle/ranking-sekolah/${id}`)
      await expect(page.getByTestId('battle-school-detail')).toBeVisible()
      await expect(page.getByTestId('battle-school-name')).not.toHaveText('')
      const line = (await page.getByTestId('battle-school-line').innerText()).trim()
      seen[id] = `${(await page.getByTestId('battle-school-name').innerText()).trim()} / ${line}`
      expect(line).not.toMatch(/PPD PPD/)
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: `${SHOTS}s4-${id}-${test.info().project.name}.png` })
    }
    // eslint-disable-next-line no-console
    console.log('QA-R2-13 hero lines', JSON.stringify(seen))
    expect(seen['8106']).toContain('/ PPD HULU LANGAT · Selangor · SMK')
    expect(seen['900']).toContain('/ PPD KUALA LANGAT · Selangor · SK')
  })

  test('QA-R2-27.5Roda Nasib already spun: disabled button; a stale tab sends a spin and gets the 409 alert @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
    newTab,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/permainan/roda-nasib')
    const button = page.getByTestId('spin-button')
    await expect(button).toHaveText('🎯 SPIN!')
    // Second tab of the same browser: spin there first.
    const other = await newTab()
    await other.goto('/permainan/roda-nasib')
    const otherButton = other.getByTestId('spin-button')
    await expect(otherButton).toHaveText('🎯 SPIN!')
    await otherButton.click()
    await mock.advanceTime(4200)
    await other.getByTestId('prize-close').click()
    await expect(otherButton).toHaveText('✅ Sudah Spin Hari Ini')
    await expect(otherButton).toBeDisabled()
    await other.screenshot({ path: `${SHOTS}ac275-disabled-${test.info().project.name}.png` })
    // The first tab is stale: it still offers the spin; the server refuses it.
    const dialog = new Promise<string>((resolve) => {
      page.once('dialog', (d) => {
        const m = d.message()
        void d.accept()
        resolve(m)
      })
    })
    await button.click()
    expect(await dialog).toBe('Anda sudah spin hari ini.')
    await expect(button).toHaveText('✅ Sudah Spin Hari Ini')
    await expect(button).toBeDisabled()
    await page.screenshot({ path: `${SHOTS}ac275-409-${test.info().project.name}.png` })
  })
})

const ROOMS = [
  ['perang-fakta', 'Perang Fakta'],
  ['benteng-ilmu', 'Benteng Ilmu'],
  ['perlumbaan-matematik', 'Perlumbaan Matematik'],
  ['kuiz-relay', 'Kuiz Relay'],
  ['teka-silang-kata', 'Teka Silang Kata'],
] as const

test.describe('M16 L26 round 2: S8-S12 room play-through', MODULE, () => {
  for (const [slug, title] of ROOMS) {
    test(`QA-R2-room ${title}: create, bots join, Mula, play to the result @m16`, async ({
      page,
      gotoApp,
      loginAs,
      mock,
    }) => {
      test.setTimeout(300_000)
      await loginAs(STUDENT)
      await gotoApp(`/${slug}`)
      await page.getByTestId('create-submit').click()
      await expect(page).toHaveURL(new RegExp(`/${slug}/[A-Z0-9]{6}$`))
      await expect(page.getByTestId('room-waiting')).toBeVisible()
      await expectNoHorizontalScroll(page)
      for (let i = 0; i < 8 && !(await page.getByTestId('room-start').isEnabled()); i++) {
        await mock.advanceTime(3000)
        await page.waitForTimeout(300)
      }
      await expect(page.getByTestId('room-start')).toBeEnabled()
      const players = await page.getByTestId('room-player').count()
      await page.screenshot({ path: `${SHOTS}room-${slug}-wait-${test.info().project.name}.png` })
      await page.getByTestId('room-start').click()
      await expect(page.getByTestId('room-playing')).toBeVisible()
      await page.screenshot({ path: `${SHOTS}room-${slug}-play-${test.info().project.name}.png` })
      let guard = 0
      const result = page.getByTestId('room-result')
      while (!(await result.isVisible()) && guard++ < 80) {
        await expectNoHorizontalScroll(page)
        if (await page.getByTestId('room-option').first().isVisible()) {
          await page.getByTestId('room-option').first().click()
        } else if (await page.getByTestId('room-word-input').isVisible()) {
          await page.getByTestId('room-word-input').fill('x')
          await page.getByTestId('room-word-submit').click()
        }
        await page.waitForTimeout(150)
        if (slug === 'teka-silang-kata' && guard === 3) await mock.advanceTime(5 * 60_000 + 1000)
      }
      await expect(result).toBeVisible()
      // eslint-disable-next-line no-console
      console.log(`QA-R2-room ${slug} players=${String(players)} steps=${String(guard)} result=`, (await page.getByTestId('room-result-title').innerText()).trim())
      await expect(page.getByTestId('room-hub')).toHaveAttribute('href', '/permainan')
      await expectNoHorizontalScroll(page)
      await page.screenshot({ path: `${SHOTS}room-${slug}-result-${test.info().project.name}.png` })
    })
  }
})
