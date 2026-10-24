/**
 * M16 S13–S19 single-player games, Roda Nasib and Jutawan Ilmu at 375 / 768 / 1280 (M16-T5; SRS M16 v1.6
 * §12: E2E-M16-20 (picker rows), 57 to 71). The items of a game are random per session, so the tests
 * read what the page shows (the ✅ / ❌ feedback, the `correct` class) and check the SOURCE scoring rule
 * against it. The clock is paused (`pauseAt`) once a game is running and driven with `mock.advanceTime`.
 * Not covered here: the level-up of S15 and a correct arrangement in S16 (the answer keys are not in the
 * DOM; both are covered by the unit tests), E2E-M16-63 (payload counts, covered by the mock handler tests).
 */

import type { Page } from '@playwright/test'

import { expect as baseExpect, test } from '../fixtures/test'
import type { MockHandle } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
} from '../support'

const expect = baseExpect.configure({ timeout: 10_000 })

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

/** Stops the clock so that only `mock.advanceTime` moves the game. */
async function pause(page: Page, mock: MockHandle): Promise<void> {
  // `pauseAt` cannot go back in time and the clock keeps running while the call travels: widen the margin.
  for (const margin of [60, 200, 600, 1500]) {
    try {
      await page.clock.pauseAt((await mock.now()) + margin)
      return
    } catch (e) {
      if (!String(e).includes('Cannot fast-forward to the past')) throw e
    }
  }
  throw new Error('pause: the clock could not be paused')
}

/**
 * Client-side navigation: the mock boot costs seconds per page load, so a test boots once with `gotoApp`
 * and moves between screens with the router, as a user clicking a link would.
 */
async function go(page: Page, path: string): Promise<void> {
  await page.evaluate(async (target) => {
    type RouterLike = { push(to: string): Promise<unknown> }
    const el = document.querySelector('#app') as Element & {
      __vue_app__: { config: { globalProperties: { $router: RouterLike } } }
    }
    await el.__vue_app__.config.globalProperties.$router.push(target)
  }, path)
}

async function submits(mock: MockHandle, game: string): Promise<number> {
  return (await mock.requests(`/api/games/solo/${game}/submit`)).length
}

/**
 * Boots on a cheap page, stops the clock, then opens the game with the router: no timer of the game
 * (countdown, clock) runs until the test advances the clock, however slow the machine is.
 */
async function openPaused(
  page: Page,
  gotoApp: (path: string) => Promise<void>,
  mock: MockHandle,
  path: string,
): Promise<void> {
  await gotoApp('/permainan/jutawan')
  await pause(page, mock)
  await go(page, path)
}

/** Steps the paused countdown 3 → 2 → 1 → play (800 ms each). */
async function throughCountdown(page: Page, mock: MockHandle): Promise<void> {
  const number = page.getByTestId('solo-countdown-number')
  await expect(number).toHaveText('3')
  for (const next of ['2', '1']) {
    await mock.advanceTime(800)
    await expect(number).toHaveText(next)
  }
  await mock.advanceTime(800)
  await expect(page.getByTestId('solo-countdown')).toHaveCount(0)
}

test.describe('M16 S13–S19 solo games', MODULE, () => {
  test('E2E-M16-57 the darjah picker on S13-S16 and S19, "Darjah 4" starts, "← Kembali ke Hub" @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    const games = [
      ['/permainan/betul-salah', 'Betul atau Salah'],
      ['/permainan/cabaran-kilat', 'Cabaran Kilat'],
      ['/permainan/tembak-jawapan', 'Tembak Jawapan'],
      ['/permainan/susun-jawapan', 'Susun Jawapan'],
      ['/permainan/jutawan', 'Jutawan Ilmu'],
    ] as const
    await gotoApp('/permainan/jutawan')
    for (const [path, title] of games) {
      await go(page, path)
      const picker = page.getByTestId('darjah-picker')
      await expect(picker).toBeVisible()
      await expect(picker).toContainText(title)
      await expect(picker).toContainText('Pilih darjah / tingkatan kamu:')
      await expect(picker).toContainText('🏫 Sekolah Rendah')
      for (const n of [1, 2, 3, 4])
        await expect(picker.getByRole('link', { name: `Darjah ${String(n)}` })).toBeVisible()
      await expect(picker.getByRole('link', { name: '← Kembali ke Hub' })).toBeVisible()
      await expectTouchTarget(picker.getByRole('link', { name: 'Darjah 4' }))
      expect(await mock.requests('/api/games/solo/*')).toHaveLength(0)
      expect(await submits(mock, path.split('/').pop()!)).toBe(0)
    }

    await pause(page, mock)
    await go(page, '/permainan/betul-salah')
    await page.getByTestId('darjah-picker').getByRole('link', { name: 'Darjah 4' }).click()
    await expect(page).toHaveURL(/\/permainan\/betul-salah\?darjah=4$/)
    await expect(page.getByTestId('solo-countdown')).toBeVisible()
    await expect(page.getByTestId('darjah-picker')).toHaveCount(0)

    await go(page, '/permainan/cabaran-kilat')
    await page.getByRole('link', { name: '← Kembali ke Hub' }).click()
    await expect(page).toHaveURL(/\/permainan$/)
  })

  test('E2E-M16-58 Betul atau Salah: countdown, scoring, result, one submit, record @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openPaused(page, gotoApp, mock, '/permainan/betul-salah?darjah=4')
    await expectTabTitle(page, 'Betul atau Salah ✅ — PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-title').first()).toHaveText('Betul atau Salah')
    await expect(page.getByText('✅❌ BETUL ATAU SALAH')).toBeVisible()
    await throughCountdown(page, mock)
    await expect(page.getByTestId('solo-clock')).toHaveText('45')
    await expect(page.getByTestId('solo-score')).toHaveText('0')
    await expect(page.getByText('Kenyataan 1')).toBeVisible()
    await expect(page.getByText('❌ SALAH')).toBeVisible()
    await expect(page.getByText('✅ BETUL', { exact: true })).toBeVisible()
    await expectTouchTarget(page.getByTestId('solo-betul'))
    await expectNoHorizontalScroll(page)

    let streak = 0
    let maxStreak = 0
    let correct = 0
    let score = 0
    let coins = 0
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('solo-betul').click()
      const ok = (await page.getByTestId('solo-feedback').innerText()).trim() === '✅'
      if (ok) {
        streak += 1
        maxStreak = Math.max(maxStreak, streak)
        correct += 1
        score += 10 + Math.min(streak, 10) * 2
        coins += Math.min(streak, 5)
      } else streak = 0
      await mock.advanceTime(700)
      await expect(page.getByTestId('solo-score')).toHaveText(String(score))
    }
    if (streak >= 2) {
      await expect(page.getByTestId('solo-combo')).toHaveText(`🔥 ${String(streak)} KOMBO`)
    }

    await mock.advanceTime(45_000)
    await expect(page.getByTestId('solo-result')).toBeVisible()
    expect(await submits(mock, 'betul-salah')).toBe(1)
    const body = (await mock.lastRequest('/api/games/solo/betul-salah/submit'))!.body as Record<
      string,
      unknown
    >
    expect(body).toMatchObject({
      correct_count: correct,
      total_answered: 6,
      streak: maxStreak,
      score,
      syiling_earned: coins,
    })
    const result = page.getByTestId('solo-result')
    await expect(result).toContainText('45 saat — Betul atau Salah!')
    await expect(result).toContainText('Skor Total')
    await expect(result).toContainText(`${String(correct)}/6`)
    await expect(result).toContainText(`${String(maxStreak)} 🔥`)
    // DV-M16-23: the M14 seed credits nothing, so the tile and the coin-fly show 0.
    await expect(result).toContainText('0 🪙')
    await expect(page.getByTestId('coin-fly')).toHaveCount(0)
    if (score > 38) await expect(page.getByTestId('solo-new-record')).toHaveText('🏆 REKOD BARU!')
    else await expect(page.getByTestId('solo-new-record')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '🔄 Main Lagi' })).toBeVisible()
    await expect(page.getByRole('link', { name: '🎮 Hab' })).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-59 Cabaran Kilat: chip, options, correct / wrong classes, 400 ms step, result @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openPaused(page, gotoApp, mock, '/permainan/cabaran-kilat?darjah=4')
    await expectTabTitle(page, 'Cabaran Kilat ⚡ — PRESTASIPLUS')
    await expect(page.getByText('⚡ CABARAN KILAT')).toBeVisible()
    await throughCountdown(page, mock)
    await expect(page.getByText('Soalan 1')).toBeVisible()
    await expect(page.getByTestId('solo-difficulty')).toHaveText(/^(Mudah|Sederhana|Sukar)$/)
    await expect(page.getByTestId('solo-clock')).toHaveText('60')
    const options = page.getByTestId('solo-option')
    await expect(options).toHaveCount(4)
    for (const [i, letter] of ['A', 'B', 'C', 'D'].entries()) {
      await expect(options.nth(i)).toHaveText(new RegExp(`^${letter}\\. `))
    }
    await expectNoHorizontalScroll(page)

    let combo = 0
    let score = 0
    let maxCombo = 0
    for (let q = 1; q <= 5; q++) {
      await expect(page.getByText(`Soalan ${String(q)}`, { exact: true })).toBeVisible()
      await options.first().click()
      const cls = (await options.first().getAttribute('class')) ?? ''
      for (let i = 0; i < 4; i++) await expect(options.nth(i)).toBeDisabled()
      if (cls.includes('correct')) {
        combo += 1
        maxCombo = Math.max(maxCombo, combo)
        score += 10 * Math.min(combo, 10)
      } else {
        expect(cls).toContain('wrong')
        combo = 0
      }
      await mock.advanceTime(400)
      await expect(page.getByTestId('solo-score')).toHaveText(String(score))
    }

    await mock.advanceTime(60_000)
    await expect(page.getByTestId('solo-result')).toBeVisible()
    expect(await submits(mock, 'cabaran-kilat')).toBe(1)
    const result = page.getByTestId('solo-result')
    await expect(result).toContainText('60 saat penuh aksi!')
    await expect(result).toContainText('Betul / Jawab')
    await expect(result).toContainText(`${String(maxCombo)}x`)
    await expect(result).toContainText('0 🪙')
    await expect(page.getByRole('button', { name: '⚡ Main Lagi' })).toBeVisible()
    if (score > 40) await expect(page.getByTestId('solo-new-record')).toBeVisible()
    else await expect(page.getByTestId('solo-new-record')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M16-66 with the syiling setting on, Cabaran Kilat shows the credited syiling @m16',
    provisional(
      'the M14 credit amount (rates, caps) is a fixture of the harness; assertion follows the SOURCE rule',
    ),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan/jutawan')
      await mock.hook('m16Fixture', 'settingCoins')
      await pause(page, mock)
      await go(page, '/permainan/cabaran-kilat?darjah=4')
      await expect(page.getByTestId('solo-countdown')).toBeVisible()
      await throughCountdown(page, mock)
      const options = page.getByTestId('solo-option')
      let combo = 0
      let coins = 0
      for (let q = 0; q < 4; q++) {
        await options.first().click()
        const cls = (await options.first().getAttribute('class')) ?? ''
        if (cls.includes('correct')) {
          combo += 1
          coins += Math.min(combo, 10)
        } else combo = 0
        await mock.advanceTime(400)
      }
      await mock.advanceTime(60_000)
      await expect(page.getByTestId('solo-result')).toContainText(`${String(coins)} 🪙`)
      if (coins > 0) await expect(page.getByTestId('coin-fly')).toHaveCount(1)
    },
  )

  test('E2E-M16-60 Tembak Jawapan: HUD, tiles, a wrong tap fades a heart, misses end the game @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openPaused(page, gotoApp, mock, '/permainan/tembak-jawapan?darjah=4')
    await expectTabTitle(page, 'Tembak Jawapan 🎯 — PRESTASIPLUS')
    await expect(page.getByText('🎯 TEMBAK JAWAPAN')).toBeVisible()
    await expect(page.getByText('Ketik jawapan yang betul sebelum jatuh!')).toBeVisible()
    await throughCountdown(page, mock)
    await expect(page.getByTestId('solo-score')).toHaveText('0')
    await expect(page.getByTestId('solo-level')).toHaveText('1')
    await expect(page.getByTestId('solo-heart')).toHaveCount(3)
    await expect(page.getByTestId('solo-coins')).toHaveText('🪙 0')
    await expect(page.getByText('Soalan 1', { exact: true })).toBeVisible()
    await expect(page.getByText('⚠ GARIS MAUT')).toBeVisible()
    const zone = page.getByTestId('solo-fall-zone')
    const box = (await zone.boundingBox())!
    expect(box.height).toBe(500)
    expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await expect(page.getByTestId('solo-tile').first()).toBeVisible()
    await expectNoHorizontalScroll(page)

    // Three questions nobody taps: each costs a life at its deadline (base + 6 + 2 × 4 = 29 s at level 1).
    for (let miss = 1; miss <= 3; miss++) {
      await mock.advanceTime(29_100)
      if (miss < 3)
        await expect(page.locator('[data-testid="solo-heart"].opacity-25')).toHaveCount(miss)
    }
    await expect(page.getByTestId('solo-result')).toBeVisible()
    expect(await submits(mock, 'tembak-jawapan')).toBe(1)
    const result = page.getByTestId('solo-result')
    await expect(result).toContainText('Tembak Jawapan — Level 1')
    await expect(result).toContainText('Tertinggi')
    await expect(result).toContainText('Level 1')
    await expect(result).toContainText('0 🪙')
    await expect(page.getByTestId('solo-result-title')).toHaveText('CUBA LAGI!')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-61 Susun Jawapan: layout, tile removal, a wrong check, retry, skip, result @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan/susun-jawapan?darjah=4')
    await expectTabTitle(page, 'Susun Jawapan 🧩 — PRESTASIPLUS')
    await expect(page.getByText('Soalan 1 daripada 20')).toBeVisible()
    for (const s of [
      'Kembali',
      'Skor 0',
      '🪙 0',
      '🧩 Susun Jawapan',
      '📥 Jawapan Kamu:',
      'Klik huruf/perkataan di bawah untuk susun',
      '🔤 Pilihan:',
    ]) {
      await expect(page.getByText(s, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByTestId('solo-dot')).toHaveCount(20)
    await expect(page.getByTestId('solo-check')).toBeDisabled()
    await expect(page.getByTestId('solo-skip-question')).toBeVisible()
    await expectTouchTarget(page.getByTestId('solo-tile').first())
    await expectNoHorizontalScroll(page)

    const tiles = page.getByTestId('solo-tile')
    const total = await tiles.count()
    // Place every tile in the shown order, then remove one by clicking it.
    for (let i = 0; i < total; i++) await tiles.first().click()
    await expect(page.getByTestId('solo-placed')).toHaveCount(total)
    await page.getByTestId('solo-placed').first().click()
    await expect(page.getByTestId('solo-placed')).toHaveCount(total - 1)
    await tiles.first().click()
    await expect(page.getByTestId('solo-check')).toBeEnabled()
    await page.getByTestId('solo-check').click()
    // The shuffled order is a correct arrangement only by chance: handle both outcomes.
    const feedback = (await page.getByTestId('solo-feedback').innerText()).trim()
    if (feedback.startsWith('🎉 BETUL!')) {
      await page.getByTestId('solo-next').click()
    } else {
      expect(feedback).toBe('❌ Cuba lagi atau langkau')
      await page.getByTestId('solo-retry').click()
      await expect(page.getByTestId('solo-placed')).toHaveCount(0)
      await page.getByTestId('solo-skip-question').click()
    }
    await expect(page.getByText('Soalan 2 daripada 20')).toBeVisible()
    for (let q = 2; q <= 20; q++) await page.getByTestId('solo-skip-question').click()
    await expect(page.getByTestId('solo-result')).toBeVisible()
    expect(await submits(mock, 'susun-jawapan')).toBe(1)
    const result = page.getByTestId('solo-result')
    await expect(result).toContainText('Susun Jawapan selesai!')
    await expect(result).toContainText('Selesai')
    await expect(result).toContainText('/20')
    await expect(result).toContainText('Syiling Diperolehi')
    await expect(result).toContainText('0 🪙')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-62 Kad Memori: no picker, 12 cards, mismatch back after 800 ms, all pairs, overlay @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openPaused(page, gotoApp, mock, '/permainan/kad-memori')
    await expectTabTitle(page, 'Kad Memori — PRESTASIPLUS')
    await expect(page.getByText('🃏 Kad Memori')).toBeVisible()
    await expect(page.getByText('Padankan soalan dengan jawapan yang betul!')).toBeVisible()
    await expect(page.getByTestId('solo-time')).toHaveText(/^⏱️ 0:0\d$/)
    await expect(page.getByTestId('solo-moves')).toHaveText('👆 0 langkah')
    await expect(page.getByTestId('solo-matched')).toHaveText('✅ 0 / 6 padan')
    await expect(page.getByTestId('darjah-picker')).toHaveCount(0)
    const cards = page.getByTestId('solo-card-item')
    await expect(cards).toHaveCount(12)
    await expect(cards.first()).toHaveText('❓')
    const size = (await cards.first().boundingBox())!
    expect(size.width).toBeGreaterThanOrEqual(60)
    expect(Math.abs(size.width - size.height)).toBeLessThan(1)
    await expectNoHorizontalScroll(page)

    // Find the partner of card 0 by trying the others: a mismatch shows "wrong" and turns back after 800 ms.
    let moves = 0
    let sawMismatch = false
    const pairUp = async (a: number): Promise<void> => {
      for (let b = 0; b < 12; b++) {
        if (b === a) continue
        const cls = (await cards.nth(a).getAttribute('class')) ?? ''
        if (cls.includes('matched')) return
        const other = (await cards.nth(b).getAttribute('class')) ?? ''
        if (other.includes('matched')) continue
        await cards.nth(a).click()
        await cards.nth(b).click()
        moves += 1
        if (((await cards.nth(a).getAttribute('class')) ?? '').includes('wrong')) {
          sawMismatch = true
          await mock.advanceTime(799)
          expect((await cards.nth(a).getAttribute('class')) ?? '').toContain('wrong')
          await mock.advanceTime(1)
          await expect(cards.nth(a)).toHaveText('❓')
        } else return
      }
    }
    for (let a = 0; a < 12; a++) {
      if (!((await cards.nth(a).getAttribute('class')) ?? '').includes('matched')) await pairUp(a)
      if ((await page.getByTestId('solo-overlay').count()) > 0) break
    }
    await expect(page.getByTestId('solo-moves')).toHaveText(
      new RegExp(`^👆 ${String(moves)} langkah$`),
    )
    expect(sawMismatch || moves === 6).toBe(true)
    const overlay = page.getByTestId('solo-overlay')
    await expect(overlay).toBeVisible()
    expect(await submits(mock, 'kad-memori')).toBe(1)
    for (const s of [
      '🎉',
      'Tahniah!',
      'Semua kad berjaya dipadankan!',
      'Masa',
      'Langkah',
      'Ketepatan',
      'Syiling 🪙',
      '🔄 Main Lagi',
      '🏠 Hab',
    ]) {
      await expect(overlay).toContainText(s)
    }
    await expect(page.getByTestId('solo-coins')).toHaveText('+0')
    await page.mouse.click(2, 2)
    await expect(overlay).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-67 Roda Nasib: header, chips, wheel, spin and lock for the day @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan/roda-nasib')
    await expectTabTitle(page, 'Roda Nasib — PRESTASIPLUS')
    await expect(page.getByText('🎯 Roda Nasib', { exact: true })).toBeVisible()
    await expect(page.getByText('Pusing roda sekali sehari untuk hadiah misteri!')).toBeVisible()
    await expect(page.getByTestId('spin-count')).toHaveText('🎰 2 kali spin')
    await expect(page.getByTestId('spin-won')).toHaveText('🪙 0 Syiling dimenangkan')
    const canvas = page.getByTestId('wheel-canvas')
    await expect(canvas).toBeVisible()
    const width = (await canvas.boundingBox())!.width
    expect(width).toBe(page.viewportSize()!.width < 640 ? 320 : 380)
    const button = page.getByTestId('spin-button')
    await expect(button).toHaveText('🎯 PUTAR!')
    await expectTouchTarget(button)
    await expectNoHorizontalScroll(page)

    await pause(page, mock)
    await button.click()
    await expect(button).toHaveText('⏳ Sedang Pusing...')
    await expect(button).toBeDisabled()
    await mock.advanceTime(4199)
    await expect(page.getByTestId('prize-overlay')).toHaveCount(0)
    await mock.advanceTime(1)
    await expect(page.getByTestId('prize-overlay')).toBeVisible()
    // M14 seed: nothing is credited, so no syiling line shows whatever the segment is.
    await expect(page.getByText('Ditambah ke akaun kamu!')).toHaveCount(0)
    await expect(page.getByTestId('prize-amount')).toHaveCount(0)
    await page.getByTestId('prize-close').click()
    await expect(page.getByTestId('prize-overlay')).toHaveCount(0)
    await expect(button).toHaveText('✅ Sudah Putar Hari Ini')
    await expect(button).toBeDisabled()
    await expect(page.getByTestId('spin-count')).toHaveText('🎰 3 kali spin')
    await expectNoHorizontalScroll(page)

    await go(page, '/permainan/jutawan')
    await go(page, '/permainan/roda-nasib')
    await expect(page.getByTestId('spin-button')).toHaveText('✅ Sudah Putar Hari Ini')
  })

  test('E2E-M16-68 fixture spinNothing: "Cuba Lagi" modal @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan/roda-nasib')
    await mock.hook('m16Fixture', 'spinNothing')
    await pause(page, mock)
    await page.getByTestId('spin-button').click()
    await mock.advanceTime(4200)
    await expect(page.getByTestId('prize-icon')).toHaveText('😅')
    await expect(page.getByTestId('prize-label')).toHaveText('Cuba Lagi')
    await expect(page.getByText('Jangan risau, cuba lagi esok!')).toBeVisible()
    await page.getByTestId('prize-close').click()
    await expect(page.getByTestId('prize-overlay')).toHaveCount(0)
  })

  test(
    'E2E-M16-69 fixture spinSyiling5: no syiling lines at setting 0, "+5 Syiling" at setting 1; next day enabled @m16',
    provisional('credit with the setting on and the MYT-day reset are INFERRED (BR-M16-29)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan/roda-nasib')
      await mock.hook('m16Fixture', 'spinSyiling5')
      await mock.hook('m16Fixture', 'settingCoins')
      await pause(page, mock)
      await page.getByTestId('spin-button').click()
      await mock.advanceTime(4200)
      await expect(page.getByTestId('prize-label')).toHaveText('5 Syiling')
      await expect(page.getByTestId('prize-amount')).toHaveText('+5 Syiling')
      await expect(page.getByText('Ditambah ke akaun kamu!')).toBeVisible()
      await page.getByTestId('prize-close').click()
      await expect(page.getByTestId('spin-won')).toHaveText('🪙 5 Syiling dimenangkan')
      await mock.advanceTime(24 * 3600 * 1000)
      await go(page, '/permainan/jutawan')
      await go(page, '/permainan/roda-nasib')
      await expect(page.getByTestId('spin-button')).toHaveText('🎯 PUTAR!')
    },
  )

  test('E2E-M16-70 Jutawan Ilmu: picker, header, stats, subjects by darjah @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan/jutawan')
    await expectTabTitle(page, 'Jutawan Ilmu 💰 — PRESTASIPLUS')
    await expect(page.getByTestId('darjah-picker')).toBeVisible()
    await expect(
      page.getByText('Pilih subjek, jawab 15 soalan — menang sampai 1,000 Syiling!'),
    ).toBeVisible()
    await expect(page.getByTestId('jutawan-best')).toHaveText('L0')
    await expect(page.getByTestId('jutawan-games')).toHaveText('0')
    await expect(page.getByText('1,000🪙')).toBeVisible()
    await expect(page.getByText('Rekod Tertinggi')).toBeVisible()
    await expect(page.getByText('Hadiah Utama')).toBeVisible()
    await expect(page.getByText('Pilih darjah atau tingkatan di atas untuk mula.')).toBeAttached()

    await go(page, '/permainan/jutawan?darjah=4')
    await expect(page.getByTestId('darjah-picker')).toHaveCount(0)
    await expect(page.getByText('📚 PILIH SUBJEK (DARJAH 4)')).toBeVisible()
    const subjects = page.getByTestId('jutawan-subject')
    await expect(subjects).toHaveCount(10)
    await expect(subjects.filter({ hasText: 'Bahasa Melayu' })).toContainText('579 soalan')
    await expect(subjects.filter({ hasText: 'Matematik' })).toContainText('1077 soalan')
    await expect(subjects.filter({ hasText: 'Matematik' })).toHaveAttribute(
      'href',
      /\/permainan\/jutawan\/main\?subject=3&darjah=4$/,
    )
    await expectTouchTarget(subjects.first())
    await expectNoHorizontalScroll(page)

    await go(page, '/permainan/jutawan?darjah=10')
    await expect(page.getByText('📚 PILIH SUBJEK (TINGKATAN 4)')).toBeVisible()
    await expect(page.getByTestId('jutawan-subject')).toHaveCount(20)
    await go(page, '/permainan/jutawan?darjah=11')
    await expect(page.getByText('📚 PILIH SUBJEK (TINGKATAN 5)')).toBeVisible()
    await expect(page.getByTestId('jutawan-subject')).toHaveCount(20)
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M16-71 Jutawan game: 50:50 removes two options; a wrong answer ends at L{n} and S19 shows it @m16',
    provisional('the game page was never observed on live (PROPOSED, FN-M16-7.2.3)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/permainan/jutawan/main?subject=3&darjah=4')
      await expectTabTitle(page, 'Jutawan Ilmu 💰 — PRESTASIPLUS')
      await expect(page.getByTestId('jutawan-rung')).toHaveCount(15)
      await expect(page.getByTestId('jutawan-option')).toHaveCount(4)
      const lifeline = page.getByTestId('jutawan-lifeline')
      await expect(lifeline).toHaveText('50:50 (3)')
      await lifeline.click()
      await expect(page.getByTestId('jutawan-option')).toHaveCount(2)
      await expect(lifeline).toHaveText('50:50 (2)')
      await expectNoHorizontalScroll(page)

      await pause(page, mock)
      // Always the first remaining option: the game ends on the first wrong one (or after 15 right).
      for (let i = 0; i < 15; i++) {
        if ((await page.getByTestId('jutawan-result').count()) > 0) break
        await page.getByTestId('jutawan-option').first().click()
        await mock.advanceTime(700)
      }
      const result = page.getByTestId('jutawan-result')
      await expect(result).toContainText(/Tahniah! Anda sampai L\d+\./)
      const level = Number(/L(\d+)\./.exec(await result.innerText())![1])
      await expect(page.getByRole('button', { name: '🔄 Main Lagi' })).toBeVisible()
      await expect(page.getByRole('link', { name: '🎮 Hab' })).toBeVisible()

      await go(page, '/permainan/jutawan?darjah=4')
      await expect(page.getByTestId('jutawan-best')).toHaveText(`L${String(level)}`)
      await expect(page.getByTestId('jutawan-games')).toHaveText('1')
    },
  )

  test('E2E-M16-07 /permainan/roda-nasib/spin has no page (404, solo part of 07) @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/permainan/roda-nasib/spin')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  })
})
