/**
 * M16 S7 `/papan-bijak`, S8-S12 lobbies and the rooms at 375 / 768 / 1280 (M16-T4; SRS M16 v1.6 §12:
 * E2E-M16-46..55). Admin account (no grade, the form starts on the select); the auto grade box and the
 * rooms use the pupil account (Tingkatan 4). Opponents are the deterministic bots of the mock; the
 * clock is the Playwright clock (`mock.advanceTime` drives the 3 s polls). E2E-M16-56 needs S29 (M16-T7)
 * and is not covered here.
 */

import type { Page } from '@playwright/test'

import { expect as baseExpect, reloadApp, test } from '../fixtures/test'
import type { MockHandle } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, provisional } from '../support'
import {
  expectLearnerHeader,
  pickOption,
  rowStat,
  selectOptionTexts,
  shellMain,
} from './helpers'

const expect = baseExpect.configure({ timeout: Number(process.env.E2E_EXPECT_MS) || 10_000 })

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

const LOBBIES = [
  [
    'perang-fakta',
    'Perang Fakta',
    '⚔️ Perang Fakta',
    '2-6 pemain · 15 pusingan · 10 saat setiap soalan',
  ],
  ['benteng-ilmu', 'Benteng Ilmu', '🏰 Benteng Ilmu', '2 pemain · HP 100 · Giliran bertukar'],
  [
    'perlumbaan-matematik',
    'Perlumbaan Matematik',
    '🏎️ Perlumbaan Matematik',
    '2-4 pemain · 20 langkah · Siapa sampai dulu menang',
  ],
  ['kuiz-relay', 'Kuiz Relay', '🏃‍♂️ Kuiz Relay', '4-8 pemain · 2 pasukan · 10 pusingan'],
  [
    'teka-silang-kata',
    'Teka Silang Kata',
    '📝 Teka Silang Kata',
    '2 pemain · 5 minit · Markah tertinggi menang',
  ],
] as const

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

async function pollCount(mock: MockHandle, pattern: string): Promise<number> {
  return (await mock.requests(pattern)).length
}

/** Runs the clock 3 s and waits until `pattern` has been requested `n` times. */
async function pollOnce(mock: MockHandle, pattern: string, n: number): Promise<void> {
  await mock.advanceTime(3000)
  await expect.poll(() => pollCount(mock, pattern)).toBeGreaterThanOrEqual(n)
}

async function smallTexts(page: Page): Promise<string[]> {
  return shellMain(page).evaluate((main) => {
    const bad: string[] = []
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.nodeValue ?? '').trim()
      const parent = n.parentElement
      if (!text || !parent) continue
      const size = parseFloat(getComputedStyle(parent).fontSize)
      if (size < 12) bad.push(`${text.slice(0, 30)} (${String(size)}px)`)
    }
    return bad
  })
}

test.describe('M16 S7 Papan Bijak lobby', MODULE, () => {
  test('E2E-M16-46 S7 create form: options, auto box, Tukar, same_level label, Guna auto, custom range, Cara Bermain @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/papan-bijak')
    await expectTabTitle(page, 'Papan Bijak | PRESTASIPLUS')
    await expectLearnerHeader(page, 'Papan Bijak')
    await expect(page.getByTestId('pb-h1')).toHaveText('🎲 Papan Bijak')
    await expect(page.getByTestId('pb-subtitle')).toHaveText(
      'Board game quiz multiplayer — jemput kawan, gulung dadu, jawab soalan! 🐍🪜',
    )
    expect(await selectOptionTexts(page, page.getByTestId('create-subject'))).toEqual([
      '🔢 Matematik',
      '📝 Bahasa Melayu',
      '🔬 Sains',
      '🇬🇧 Bahasa Inggeris',
    ])
    await expect(page.getByTestId('grade-auto')).toContainText('Tingkatan 4')
    await expect(page.getByTestId('grade-auto')).toContainText('(auto dari profil anda)')
    expect((await selectOptionTexts(page, page.getByTestId('create-mode')))[1]).toBe(
      'Semua Tingkatan (1-5)',
    )

    await page.getByTestId('grade-switch').click()
    // Tingkatan 1-5 only (FR-MUR-21-3), under one group label.
    await page.getByTestId('grade-select').click()
    await expect(page.getByRole('listbox')).toContainText('Sekolah Menengah')
    await page.keyboard.press('Escape')
    expect(await selectOptionTexts(page, page.getByTestId('grade-select'))).toEqual([
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    await pickOption(page, page.getByTestId('grade-select'), 'Tingkatan 2')
    expect((await selectOptionTexts(page, page.getByTestId('create-mode')))[1]).toBe(
      'Semua Tingkatan (1-5)',
    )
    await page.getByTestId('grade-back').click()
    await expect(page.getByTestId('grade-auto')).toContainText('Tingkatan 4')

    await pickOption(page, page.getByTestId('create-mode'), 'Pilih julat khas')
    await expect(page.getByTestId('create-grade-min')).toHaveText('T1')
    await expect(page.getByTestId('create-grade-max')).toHaveText('T5')
    await expect(page.getByTestId('create-max-players')).toHaveText('4 Pemain')

    const how = page.getByTestId('pb-how-to')
    await expect(how).toContainText('Cara Bermain:')
    await expect(how.locator('li')).toHaveCount(5)
    await expect(how.locator('li').last()).toHaveText('🏆 5. Sampai petak 50 dulu = MENANG!')
    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
  })

  test('E2E-M16-47 S7 join: empty submit is blocked by the native bubble; the 7th character is not accepted @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/papan-bijak')
    const input = page.getByTestId('join-input')
    await page.getByTestId('join-submit').click()
    expect(await input.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true)
    expect(await pollCount(mock, '/api/games/papan-bijak/rooms/join')).toBe(0)
    await input.pressSequentially('abcdefg')
    await expect(input).toHaveValue('ABCDEF')
    await expect(input).toHaveAttribute('placeholder', 'ABC123')
  })

  test(
    'E2E-M16-48 S7 create (Matematik, Tingkatan 4, same grade, 4) opens /papan-bijak/{6-character code} @m16',
    provisional('the new room is PROVISIONAL (FR-M16-67)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/papan-bijak')
      await page.getByTestId('create-submit').click()
      await expect(page).toHaveURL(/\/papan-bijak\/[A-Z0-9]{6}$/)
      const req = await mock.lastRequest('/api/games/papan-bijak/rooms')
      expect(req?.body).toEqual({
        subject: 'MATEMATIK',
        grade_level: 'TINGKATAN_4',
        match_mode: 'same_grade',
        max_players: 4,
      })
      await expect(page.getByTestId('room-h1')).toHaveText('🎲 Papan Bijak')
      await expect(page.getByTestId('room-waiting')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M16-49 Papan Bijak quick match: body, counter, matched room on the 3rd poll; cancel; expired error stays visible @m16',
    provisional('the matchmaking bot is a SIMULATION (BR-M16-24)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/papan-bijak')
      await page.getByTestId('qm-start').click()
      await expect(page.getByTestId('qm-elapsed')).toHaveText(/^Mencari lawan\.\.\. \d+s$/) // 0s unless the machine is slow
      const start = await mock.lastRequest('/api/papan-bijak/quick-match')
      expect(start?.body).toEqual({ subject: 'MATEMATIK', match_mode: 'same_grade' })
      await mock.advanceTime(2000)
      await expect
        .poll(async () =>
          Number(/(\d+)s$/.exec((await page.getByTestId('qm-elapsed').textContent()) ?? '')?.[1]),
        )
        .toBeGreaterThanOrEqual(2)
      await expect(
        page.getByText('Sila tunggu, sistem sedang mencari pemain sepadan'),
      ).toBeVisible()

      // Cancel: back to idle, #31 posted.
      await page.getByTestId('qm-cancel').click()
      await expect(page.getByTestId('qm-start')).toBeVisible()
      await expect.poll(() => pollCount(mock, '/api/papan-bijak/quick-match/cancel')).toBe(1)

      // Search again: matched on the 3rd poll (9 s).
      await page.getByTestId('qm-start').click()
      await expect(page.getByTestId('qm-searching')).toBeVisible()
      for (let i = 1; i <= 3; i++) await pollOnce(mock, '/api/papan-bijak/quick-match/poll', i)
      await expect(page).toHaveURL(/\/papan-bijak\/[A-Z0-9]{6}$/)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Papan Bijak quick match expired: the error line stays visible after the search ends (DV-M16-20) @m16',
    provisional('the matchmaking bot is a SIMULATION (BR-M16-24)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/papan-bijak')
      await mock.hook('pbQuickMatch', { mode: 'expired' })
      await page.getByTestId('qm-start').click()
      await pollOnce(mock, '/api/papan-bijak/quick-match/poll', 1)
      await expect(page.getByTestId('qm-searching')).toHaveCount(0)
      await expect(page.getByTestId('qm-error')).toHaveText('Tiada lawan dijumpai. Cuba lagi!')
    },
  )

  test('E2E-M16-50 S7 Top 10: rows, medals, pills, truncation and initials @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/papan-bijak')
    const rows = page.getByTestId('top10-row')
    await expect(rows).toHaveCount(10)
    expect(await rows.getByTestId('row-rank').allTextContents()).toEqual(
      ['🥇', '🥈', '🥉', '4', '5', '6', '7', '8', '9', '10'],
    )
    // Rank 1 is the admin: 4 / 6 / 67% / 90 / 13.
    await expect(rows.first()).toContainText('Admin Demo')
    await expect(rows.first().getByTestId('row-avatar')).toHaveText('AD')
    await expect(rows.first().getByTestId('top10-kadar')).toHaveText('67%')
    await expect(rowStat(rows.first(), '🏆 Menang')).toHaveText('4')
    await expect(rowStat(rows.first(), '🎮 Jumlah')).toHaveText('6')
    await expect(rowStat(rows.first(), '⭐ Skor')).toHaveText('90')
    await expect(rowStat(rows.first(), '✅ Betul')).toHaveText('13')
    // Kadar pills: 75 % green, 50 % amber, 25 % red.
    const kadar = await page.getByTestId('top10-kadar').allTextContents()
    expect(kadar.slice(0, 4)).toEqual(['67%', '75%', '50%', '25%'])
    // Names longer than 15 characters are cut to 15 + "...".
    const names = await rows.getByTestId('row-title').allTextContents()
    for (const n of names) expect(n.length).toBeLessThanOrEqual(18)
    expect(names.some((n) => n.endsWith('...'))).toBe(true)
    // One raised row per player: it wraps on a phone, so nothing scrolls sideways inside the card.
    const overflow = await page
      .getByTestId('top10-table')
      .evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M16 S8-S12 lobbies', MODULE, () => {
  test('E2E-M16-51 S8-S12 heroes, create forms (one-way Tukar), join input upper case and not required @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/perang-fakta')
    for (const [slug, title, h1, rule] of LOBBIES) {
      await spaGo(page, `/${slug}`)
      await expectTabTitle(page, `${title} | PRESTASIPLUS`)
      await expectLearnerHeader(page, title)
      await expect(page.getByTestId('lobby-h1')).toHaveText(h1)
      await expect(page.getByTestId('lobby-rule')).toHaveText(rule)
      expect(await selectOptionTexts(page, page.getByTestId('create-subject'))).toEqual([
        'Matematik',
        'Bahasa Melayu',
        'Bahasa Inggeris',
        'Sains',
        'Sejarah',
      ])
      await expect(page.getByTestId('grade-auto')).toContainText('Tingkatan 4')
      await expect(page.getByTestId('grade-auto')).toContainText('(auto)')
      await page.getByTestId('grade-switch').click()
      await expect(page.getByTestId('grade-select')).toHaveText('Tingkatan 4')
      await expect(page.getByTestId('grade-back')).toHaveCount(0)
      expect(await selectOptionTexts(page, page.getByTestId('create-mode'))).toEqual([
        'Tahap sama sahaja',
        'Semua Tingkatan',
      ])
      await expect(page.getByTestId('create-submit')).toContainText('Cipta Bilik')
      const input = page.getByTestId('join-input')
      await expect(input).toHaveAttribute('placeholder', 'Contoh: ABC123')
      expect(await input.evaluate((el: HTMLInputElement) => el.required)).toBe(false)
      await input.pressSequentially('abc1234')
      await expect(input).toHaveValue('ABC123')
      await expect(page.getByTestId('join-submit')).toHaveText('Masuk')
      await expectNoHorizontalScroll(page)
    }
    expect(await smallTexts(page)).toEqual([])
  })

  test('E2E-M16-52 Pendahulu rows of S8 and S11; the same order on two loads @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/perang-fakta')
    const rows = page.getByTestId('leaders-row')
    await expect(rows).toHaveCount(10)
    const first = (await rows.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim())
    // Ranks 1-3 carry a 3D medal image in the rank chip; from 4 the chip prints the number.
    const medals = rows.locator('[data-ds=leader-rank] img')
    await expect(medals).toHaveCount(3)
    expect(first[0]).toMatch(/5 menang$/)
    expect(first[1]).toMatch(/4 menang$/)
    expect(first[2]).toMatch(/3 menang$/)
    expect(first[3]).toMatch(/^4.+3 menang$/)
    expect(first[9]).toMatch(/^10.+2 menang$/)
    await gotoApp('/perang-fakta')
    await expect(rows).toHaveCount(10)
    expect((await rows.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim())).toEqual(first)

    await gotoApp('/kuiz-relay')
    await expect(page.getByTestId('leaders-row')).toHaveCount(1)
    await expect(page.getByTestId('leaders-row')).toContainText('1 kali MVP')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-53 /{game}/XXXXXX returns to the lobby with the flash visible at the top @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const [i, [slug]] of LOBBIES.entries()) {
      // The first is a real page load of the bare link; the others are client-side visits (one boot).
      if (i === 0) await gotoApp(`/${slug}/XXXXXX`)
      else await spaGo(page, `/${slug}/XXXXXX`)
      await expect(page).toHaveURL(new RegExp(`/${slug}$`))
      const flash = page.getByTestId('cmp-flash')
      await expect(flash).toHaveText('Bilik tidak dijumpai.')
      await expect(flash).toBeInViewport({ ratio: 1 })
      await expect(page.getByTestId('lobby-h1')).toBeVisible()
    }
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M16-54 S8 join with an unknown code shows the lobby flash @m16',
    provisional('the refusal of a join is INFERRED (BR-M16-18)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp('/perang-fakta')
      await page.getByTestId('join-input').fill('zzzzzz')
      await page.getByTestId('join-submit').click()
      await expect(page).toHaveURL(/\/perang-fakta$/)
      await expect(page.getByTestId('cmp-flash')).toHaveText('Bilik tidak dijumpai.')
    },
  )

  test('/papan-bijak/XXXXXX is the 404 page @m16', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp('/papan-bijak/XXXXXX')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  })
})

test.describe('M16 rooms', MODULE, () => {
  test(
    'E2E-M16-55 Perang Fakta room: waiting, a bot joins, Mula, 15 rounds, result @m16',
    provisional('rooms, bots and the room rules are PROVISIONAL / SIMULATION (BR-M16-19/20)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/perang-fakta')
      await page.getByTestId('create-submit').click()
      await expect(page).toHaveURL(/\/perang-fakta\/[A-Z0-9]{6}$/)
      await expect(page.getByTestId('room-waiting')).toBeVisible()
      await expect(page.getByTestId('room-waiting')).toContainText('minimum 2')
      await expectNoHorizontalScroll(page)

      // The host poll (every 3 s) adds a bot up to the minimum of 2.
      await pollOnce(mock, '/api/games/perang-fakta/rooms/*', 2)
      await expect(page.getByTestId('room-player')).toHaveCount(2)
      await expect(page.getByTestId('room-start')).toBeEnabled()
      await page.getByTestId('room-start').click()
      await expect(page.getByTestId('room-round')).toHaveText('Pusingan 1/15')
      await expect(page.getByTestId('room-countdown')).toHaveText('10s')

      for (let round = 1; round <= 15; round++) {
        await expect(page.getByTestId('room-round')).toHaveText(`Pusingan ${String(round)}/15`)
        await expectNoHorizontalScroll(page)
        await page.getByTestId('room-option').first().click()
        if (round < 15) {
          await expect(page.getByTestId('room-round')).toHaveText(
            `Pusingan ${String(round + 1)}/15`,
          )
        }
      }
      await expect(page.getByTestId('room-result-title')).toHaveText(/^(🏆 .+ menang!|🤝 Seri)$/)
      await expect(page.getByTestId('room-scores').locator('li')).toHaveCount(2)
      await expect(page.getByTestId('room-hub')).toHaveAttribute('href', '/permainan')
      const polls = await pollCount(mock, '/api/games/perang-fakta/rooms/*')
      await mock.advanceTime(9000)
      expect(await pollCount(mock, '/api/games/perang-fakta/rooms/*')).toBe(polls) // finished: no more polls
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Perang Fakta server clock: a reload mid-round keeps the countdown, and the round advances with no input @m16',
    provisional('the room clock is PROVISIONAL (BR-M16-20)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/perang-fakta')
      await page.getByTestId('create-submit').click()
      await expect(page).toHaveURL(/\/perang-fakta\/[A-Z0-9]{6}$/)
      await pollOnce(mock, '/api/games/perang-fakta/rooms/*', 2)
      await expect(page.getByTestId('room-player')).toHaveCount(2)
      await page.getByTestId('room-start').click()
      // The wall clock keeps running under the Playwright clock, so the checks are relative: the round
      // number and the seconds left are read from the page and compared, never assumed to be 1 and 10.
      const readRound = async () =>
        Number(
          /Pusingan (\d+)\//.exec((await page.getByTestId('room-round').textContent()) ?? '')?.[1],
        )
      const readLeft = async () =>
        Number(((await page.getByTestId('room-countdown').textContent()) ?? '').replace('s', ''))
      await expect(page.getByTestId('room-countdown')).toBeVisible()
      const round0 = await readRound()
      const left0 = await readLeft()

      // 2 s pass on the project clock, then the page is reloaded: the countdown continues, it is not reset.
      await mock.advanceTime(2000)
      await reloadApp(page)
      await expect(page.getByTestId('room-countdown')).toBeVisible()
      const round1 = await readRound()
      expect(round1).toBeGreaterThanOrEqual(round0)
      if (round1 === round0) expect(await readLeft()).toBeLessThan(left0)

      // With no input the round advances: 11 s is more than one round (the page sends the no-vote, the
      // server resolves the same), and the new round starts its own 10 s.
      await mock.advanceTime(11_000)
      await expect.poll(readRound).toBeGreaterThan(round1)
      await expect.poll(readLeft).toBeGreaterThan(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Papan Bijak room: bot joins, Mula, board of 50 tiles and the roll button, no sideways scroll @m16',
    provisional('rooms and the board are PROVISIONAL (BR-M16-20)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/papan-bijak')
      await page.getByTestId('create-submit').click()
      await expect(page).toHaveURL(/\/papan-bijak\/[A-Z0-9]{6}$/)
      await pollOnce(mock, '/api/games/papan-bijak/rooms/*', 2)
      await expect(page.getByTestId('room-player')).toHaveCount(2)
      await page.getByTestId('room-start').click()
      await expect(page.getByTestId('room-tile')).toHaveCount(50)
      await expect(page.getByTestId('room-roll')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.getByTestId('room-roll').click()
      await expect(page.getByTestId('room-dice')).toContainText('Dadu:')
      await expectNoHorizontalScroll(page)
      expect(await smallTexts(page)).toEqual([])
    },
  )

  test(
    'a direct visit to an open room link joins it (hub chip PB1234) @m16',
    provisional('the open-rooms strip and room joining are PROVISIONAL'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/papan-bijak')
      await mock.hook('m16Fixture', 'openRoom')
      await spaGo(page, '/papan-bijak/PB1234')
      await expect(page.getByTestId('room-code')).toHaveText('Kod Bilik: PB1234')
    },
  )
})
