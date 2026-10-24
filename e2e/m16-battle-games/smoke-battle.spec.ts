/**
 * M16 S1-S5 Battle Arena, rankings, school detail, history and the provisional arena at 375 / 768 /
 * 1280 (M16-T3; SRS M16 v1.6 §12: E2E-M16-03, 13, 16-42). The opponents are deterministic bots
 * (D4); tests that assert simulated, proposed or inferred behaviour are `@provisional`.
 *
 * The waiting card ("Menunggu Kelulusan...", DV-M16-06) has no control; the test reaches it with the
 * mock hook `battleWaiting` plus the page seam (a `window` event `m16:battle-waiting`).
 */

import type { Clock, Page } from '@playwright/test'

import { canonicalAccount } from '../../src/mock/core-data/accounts.ts'
import { expect as baseExpect, test } from '../fixtures/test'
import type { MockHandle } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
} from '../support'

const expect = baseExpect.configure({ timeout: 10_000 })

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const MODULE = { tag: [moduleTag(16)] }

test.use({ mockInit: { latency: 0 } })

const title = (page: Page) => page.getByTestId('shell-user-title').first()
const subtitle = (page: Page) => page.getByTestId('shell-user-subtitle').first()
const err = (page: Page) => page.getByTestId('battle-error')
const timer = (page: Page) => page.getByTestId('battle-timer')
const quick = (page: Page) => page.getByTestId('battle-quick-match')
const friend = (page: Page) => page.getByTestId('battle-challenge')
const school = (page: Page) => page.getByTestId('battle-school-battle')

/** The `matched` answer on the 3rd poll needs 9 s of clock; poll counts are read from the log. */
async function polls(mock: MockHandle, pattern = '/api/battle/poll-match/*'): Promise<number> {
  return (await mock.requests(pattern)).length
}

/** Advances the clock by 3 s and waits until the n-th poll of the pattern was sent. */
async function pollOnce(mock: MockHandle, n: number, pattern?: string): Promise<void> {
  await mock.advanceTime(3000)
  await expect.poll(() => polls(mock, pattern)).toBe(n)
}

async function pickSubject(page: Page, name: string): Promise<void> {
  const tile = page.getByTestId('battle-subject').filter({ hasText: name })
  if (!(await tile.first().isVisible())) await page.getByTestId('battle-toggle-more').click()
  await tile.first().click()
}

/**
 * The page clock keeps flowing after boot, so slow steps would fire polls by themselves. Pause it:
 * from here on a poll or a timer fires only on `mock.advanceTime`, so "1 poll per 3 s step" is exact.
 */
async function freezeClock(page: Page, clock: Clock): Promise<void> {
  await clock.pauseAt((await page.evaluate(() => Date.now())) + 10_000)
}

async function openLobby(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
  await gotoApp('/battle')
  await expect(page.getByTestId('battle-lobby').locator('h2').first()).toHaveText('Battle Arena')
}

test.describe('M16 S1-S5 battle', MODULE, () => {
  test('E2E-M16-03 S1-S5 header titles, subtitles and tab titles @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    const screens = [
      ['/battle', 'Battle Arena', 'Bertanding kuiz 1v1 dengan pelajar lain!', 'Battle Arena'],
      [
        '/battle/leaderboard',
        'Ranking Pelajar Battle',
        'Siapa pejuang terhebat minggu ini?',
        'Ranking Pelajar Battle',
      ],
      [
        '/battle/ranking-sekolah',
        'Papan Ranking Sekolah',
        'Ranking 10,218 sekolah seluruh Malaysia',
        'Papan Ranking Sekolah',
      ],
      ['/battle/history', 'Sejarah Battle', 'Rekod pertandingan anda', 'Sejarah Battle'],
    ] as const
    for (const [path, head, sub, tab] of screens) {
      await gotoApp(path)
      await expect(title(page)).toHaveText(head)
      await expect(subtitle(page)).toHaveText(sub)
      await expectTabTitle(page, tab)
    }
    await gotoApp('/battle/ranking-sekolah/8106')
    const name = await page.getByTestId('battle-school-name').innerText()
    await expect(title(page)).toHaveText(name)
    await expect(subtitle(page)).toHaveText(/^Selangor · SMK$/)
    await expectTabTitle(page, name)
  })

  test('E2E-M16-16 S1 default: hero, Biasa active, 7 tiles, buttons disabled, 24 more @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openLobby(page, gotoApp)
    await expect(page.getByTestId('battle-lobby')).toContainText('BARU')
    await expect(page.getByTestId('battle-lobby')).toContainText(
      'Cabar kawan, cari lawan, atau wakili sekolah anda!',
    )
    await expect(page.getByTestId('battle-type-biasa')).toHaveClass(/from-red-500/)
    await expect(page.getByTestId('battle-subject')).toHaveCount(7)
    for (const b of [quick(page), friend(page), school(page)]) await expect(b).toBeDisabled()
    await page.getByTestId('battle-toggle-more').click()
    await expect(page.getByTestId('battle-subject')).toHaveCount(31)
    await expect(page.getByTestId('battle-toggle-more')).toHaveText('Tutup')
    await page.getByTestId('battle-toggle-more').click()
    await expect(page.getByTestId('battle-subject')).toHaveCount(7)
    await expect(page.getByTestId('battle-toggle-more')).toHaveText('Lagi 24 subjek lain')
    await pickSubject(page, 'Matematik')
    await expect(page.getByTestId('battle-subject').filter({ hasText: 'Matematik' })).toHaveClass(
      /border-red-500/,
    )
    for (const b of [quick(page), friend(page), school(page)]) await expect(b).toBeEnabled()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-17 SPM below Tingkatan 4: tooltip toggles and closes on an outside click @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openLobby(page, gotoApp)
    const spm = page.getByTestId('battle-type-spm')
    const tip = page.getByTestId('battle-spm-tip')
    await spm.click()
    await expect(tip).toHaveText('Khas untuk pelajar Tingkatan 4 & 5 sahaja')
    await spm.click()
    await expect(tip).toBeHidden()
    await spm.click()
    await expect(tip).toBeVisible()
    await page.getByTestId('battle-lobby').locator('h2').first().click()
    await expect(tip).toBeHidden()
    await expect(page.getByTestId('battle-type-biasa')).toHaveClass(/from-red-500/)
    await expect(page.getByTestId('battle-panel-biasa')).toBeVisible()
  })

  test('E2E-M16-18 PKSK: 15 domains, levels, buttons enable after domain and level @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openLobby(page, gotoApp)
    await page.getByTestId('battle-type-pksk').click()
    await expect(page.getByTestId('battle-domain')).toHaveCount(15)
    await expect(page.getByTestId('battle-level-t1')).toHaveText('Tingkatan 1')
    await expect(page.getByTestId('battle-level-t4')).toHaveText('Tingkatan 4')
    await expect(quick(page)).toBeDisabled()
    await page.getByTestId('battle-domain').first().click()
    await expect(page.getByTestId('battle-domain').first()).toHaveClass(/bg-indigo-500/)
    await expect(quick(page)).toBeDisabled()
    await page.getByTestId('battle-level-t4').click()
    for (const b of [quick(page), friend(page), school(page)]) await expect(b).toBeEnabled()
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M16-19 student in Tingkatan 4: SPM unlocked with subject tiles @m16',
    provisional('the unlocked SPM layout is PROPOSED (FN-M16-2.1.7)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJAR)
      await openLobby(page, gotoApp)
      await page.getByTestId('battle-type-spm').click()
      await expect(page.getByTestId('battle-panel-spm')).toBeVisible()
      await expect(page.getByTestId('battle-spm-tip')).toBeHidden()
      const tiles = page.getByTestId('battle-spm-subject')
      expect(await tiles.count()).toBeGreaterThan(0)
      await expect(quick(page)).toBeDisabled()
      await tiles.first().click()
      for (const b of [quick(page), friend(page), school(page)]) await expect(b).toBeEnabled()
    },
  )

  test('E2E-M16-20 ranking links @m16', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await openLobby(page, gotoApp)
    await page.getByTestId('battle-link-students').click()
    await expect(page).toHaveURL(/\/battle\/leaderboard$/)
    await page.goBack()
    await page.getByTestId('battle-link-schools').click()
    await expect(page).toHaveURL(/\/battle\/ranking-sekolah$/)
  })

  test('E2E-M16-21 visibility switch texts both ways @m16', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await openLobby(page, gotoApp)
    const text = page.getByTestId('battle-visibility-text')
    const label = page.getByTestId('battle-visibility-label')
    await expect(text).toHaveText('Hanya pelajar gred sama boleh match')
    await expect(label).toHaveText('Gred Saya')
    await label.click()
    await expect(text).toHaveText('Semua gred boleh nampak & mohon sertai anda')
    await expect(label).toHaveText('Terbuka')
    await label.click()
    await expect(label).toHaveText('Gred Saya')
  })

  test(
    'E2E-M16-22 Padanan Pantas: request, timer 0:00 to 0:06 and the arena after the 3rd poll @m16',
    provisional('simulated matchmaking (SIMULATION, BR-M16-05)'),
    async ({ page, gotoApp, loginAs, mock, clock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await pickSubject(page, 'Matematik')
      await freezeClock(page, clock)
      await quick(page).click()
      await expect(page.getByTestId('battle-searching')).toContainText('Mencari Lawan...')
      await expect(page.getByTestId('battle-searching')).toContainText(
        'Menunggu pelajar sama darjah & subjek',
      )
      await expect(timer(page)).toHaveText('0:00')
      expect((await mock.lastRequest('/api/battle/quick-match'))?.body).toEqual({
        question_type: 'biasa',
        open_to_all: false,
        subject_id: 3,
      })
      await expectNoHorizontalScroll(page)
      await pollOnce(mock, 1)
      await expect(timer(page)).toHaveText('0:03')
      await pollOnce(mock, 2)
      await expect(timer(page)).toHaveText('0:06')
      await mock.advanceTime(3000)
      await expect(page).toHaveURL(/\/battle\/arena\/[0-9a-f-]{36}$/)
    },
  )

  test(
    'E2E-M16-23 "Batal" sends no request and the abandoned queue is never matched @m16',
    provisional('simulated matchmaking (SIMULATION, DV-M16-05)'),
    async ({ page, gotoApp, loginAs, mock, clock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await pickSubject(page, 'Matematik')
      await freezeClock(page, clock)
      await page.getByTestId('battle-visibility-label').click()
      await quick(page).click()
      await expect(page.getByTestId('battle-searching')).toContainText(
        'Menunggu pelajar dari mana-mana gred',
      )
      await pollOnce(mock, 1)
      const before = (await mock.requests()).length
      await page.getByTestId('battle-cancel').click()
      await expect(page.getByTestId('battle-searching')).toBeHidden()
      await expect(quick(page)).toBeEnabled()
      await mock.advanceTime(30_000)
      expect((await mock.requests()).length).toBe(before)
      await expect(page).toHaveURL(/\/battle$/)
    },
  )

  test(
    'E2E-M16-24 stop rules: 120 s, expired, 5 server errors, 5 network errors @m16',
    provisional('simulated matchmaking and hooks (SIMULATION)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await pickSubject(page, 'Matematik')

      await mock.hook('battleSim', { mode: 'never' })
      await quick(page).click()
      await expect(timer(page)).toHaveText('0:00')
      await mock.advanceTime(120_000)
      await expect(err(page)).toHaveText('Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi.')
      await page.getByTestId('battle-error-close').click()
      await expect(err(page)).toBeHidden()

      await mock.hook('battleSim', { mode: 'expired' })
      await quick(page).click()
      await expect(timer(page)).toBeVisible()
      await mock.advanceTime(3000)
      await expect(err(page)).toHaveText('Tiada lawan dijumpai. Sila cuba lagi.')

      await mock.hook('battleSim', { mode: 'error:500' })
      await quick(page).click()
      await expect(timer(page)).toBeVisible()
      await mock.advanceTime(15_000)
      await expect(err(page)).toHaveText('Ralat berulang semasa mencari lawan. Sila cuba lagi.')

      await mock.hook('battleSim', { mode: 'never' })
      await quick(page).click()
      await expect(timer(page)).toBeVisible()
      for (let i = 0; i < 5; i++) await mock.networkErrorNext('/api/battle/poll-match/*')
      await mock.advanceTime(15_000)
      await expect(err(page)).toHaveText('Ralat rangkaian berulang. Sila semak internet anda.')
    },
  )

  test(
    'E2E-M16-25 a pool under 10 questions shows the server fallback; the close button clears it @m16',
    provisional('the pool size of Bahasa Cina is a seed matter (BR-M16-03)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await pickSubject(page, 'Bahasa Cina')
      await school(page).click()
      await expect(err(page)).toHaveText('Ralat dari pelayan. Sila cuba lagi.')
      await page.getByTestId('battle-error-close').click()
      await expect(err(page)).toBeHidden()
    },
  )

  test(
    'E2E-M16-26 incoming challenge: card copy, "Tolak" keeps searching, "Terima" opens the arena @m16',
    provisional('the challenger is simulated (BR-M16-05)'),
    async ({ page, gotoApp, loginAs, mock, clock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await pickSubject(page, 'Matematik')
      await freezeClock(page, clock)
      await mock.hook('battleSim', { mode: 'incoming' })
      await quick(page).click()
      await expect(timer(page)).toBeVisible()
      await pollOnce(mock, 1)
      await mock.advanceTime(3000)
      const card = page.getByTestId('battle-incoming')
      await expect(card).toContainText('Cabaran Masuk!')
      await expect(card).toContainText('ingin menyertai battle anda')
      await expect(card).toContainText(
        'Soalan mengikut gred anda. Lawan akan bermain soalan gred anda.',
      )
      await expect(page.getByTestId('battle-incoming-accept')).toHaveText('Terima')
      await page.getByTestId('battle-incoming-reject').click()
      await expect(page.getByTestId('battle-searching')).toBeVisible()
      await expect(card).toBeHidden()
      expect((await mock.requests('/api/battle/reject-challenger/*')).length).toBe(1)

      await page.getByTestId('battle-cancel').click()
      await mock.hook('battleSim', { mode: 'incoming' })
      await quick(page).click()
      await expect(timer(page)).toBeVisible()
      // Two exact 3 s steps: one poll each (the second answers with the challenger).
      const before = await polls(mock)
      await pollOnce(mock, before + 1)
      await mock.advanceTime(3000)
      await expect(card).toBeVisible()
      await page.getByTestId('battle-incoming-accept').click()
      await expect(page).toHaveURL(/\/battle\/arena\/[0-9a-f-]{36}$/)
    },
  )

  test(
    'E2E-M16-27 no control starts a queue join; the waiting card is reached by hook and "rejected" shows the message @m16',
    provisional('DV-M16-06: unreachable control kept, reached by a test hook'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await expect(page.getByText('Menunggu Kelulusan...')).toHaveCount(0)
      const { queueId } = await mock.hook<{ queueId: number }>('battleWaiting', {
        targetUserId: 4301,
        outcome: 'rejected',
        viewerId: 1,
      })
      await page.evaluate((id) => {
        window.dispatchEvent(
          new CustomEvent('m16:battle-waiting', {
            detail: { queueId: id, name: 'Murid Demo 4301' },
          }),
        )
      }, queueId)
      const card = page.getByTestId('battle-waiting')
      await expect(card).toContainText('Menunggu Kelulusan...')
      await expect(card).toContainText('Menunggu Murid Demo 4301 menerima permohonan anda')
      await mock.advanceTime(3000)
      await expect(err(page)).toHaveText('Murid Demo 4301 menolak permohonan anda.')
      await expect(card).toBeHidden()
      expect((await mock.requests('/api/battle/join-queue/*')).length).toBe(0)
    },
  )

  test('E2E-M16-28 Cabar Kawan: 1 character sends nothing, no match shows the empty text, overlay closes @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openLobby(page, gotoApp)
    await pickSubject(page, 'Matematik')
    await friend(page).click()
    const input = page.getByTestId('battle-challenge-input')
    await expect(input).toHaveAttribute('placeholder', 'Cari nama pelajar...')
    await input.fill('M')
    await mock.advanceTime(500)
    expect((await mock.requests('/api/battle/search-opponent')).length).toBe(0)
    await input.fill('zzqxv')
    await mock.advanceTime(400)
    await expect(page.getByTestId('battle-challenge-empty')).toHaveText('Tiada pelajar dijumpai')
    await page.getByTestId('cmp-modal-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('battle-challenge-modal')).toBeHidden()
  })

  test(
    'E2E-M16-29 Cabar Kawan: search, send, alert, modal closed, invitation posted @m16',
    provisional('the opponent list and the invitation store are simulated'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await pickSubject(page, 'Matematik')
      await friend(page).click()
      await page.getByTestId('battle-challenge-input').fill('Murid Demo 4326')
      await mock.advanceTime(400)
      const row = page.getByTestId('battle-challenge-result').first()
      await expect(row).toBeVisible()
      const name = (await row.locator('span.font-semibold').innerText()).trim()
      const dialog = acceptNextDialog(page, {
        type: 'alert',
        message: `Cabaran berjaya dihantar kepada ${name}!`,
      })
      await row.click()
      await dialog
      await expect(page.getByTestId('battle-challenge-modal')).toBeHidden()
      const sent = await mock.lastRequest('/api/battle/invite')
      expect(sent?.body).toMatchObject({
        question_type: 'biasa',
        open_to_all: false,
        subject_id: 3,
      })
    },
  )

  test('E2E-M16-30 invitations are requested on load and the modal stays closed @m16', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await openLobby(page, gotoApp)
    await expect.poll(async () => (await mock.requests('/api/battle/invitations')).length).toBe(1)
    await expect(page.getByTestId('battle-invitations-modal')).toBeHidden()
  })

  test(
    'E2E-M16-31 fixture "invitation": the modal opens itself; "Tolak" empties it; "Terima" opens the arena @m16',
    provisional('invitation fixture and simulated sender'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await mock.hook('m16Fixture', 'invitation', { viewerId: 1 })
      await gotoApp('/battle')
      const modal = page.getByTestId('battle-invitations-modal')
      await expect(modal).toBeVisible()
      await expect(page.getByTestId('battle-invitation-row')).toHaveCount(1)
      await page.getByTestId('battle-invitation-decline').click()
      await expect(page.getByTestId('battle-invitations-empty')).toHaveText(
        'Tiada cabaran buat masa ini',
      )
      await mock.hook('m16Fixture', 'invitation', { viewerId: 1 })
      await gotoApp('/battle')
      await expect(page.getByTestId('battle-invitation-row')).toHaveCount(1)
      await page.getByTestId('battle-invitation-accept').click()
      await expect(page).toHaveURL(/\/battle\/arena\/[0-9a-f-]{36}$/)
    },
  )

  test(
    'E2E-M16-32/33/34 arena: players, scores, question, answer feedback, forfeit and 404s @m16',
    provisional('the arena is PROVISIONAL (FN-M16-2.5)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await openLobby(page, gotoApp)
      await pickSubject(page, 'Matematik')
      await quick(page).click()
      await expect(timer(page)).toBeVisible()
      await mock.advanceTime(9000)
      await expect(page).toHaveURL(/\/battle\/arena\/[0-9a-f-]{36}$/)
      const arenaUrl = page.url()
      await expect(page.getByTestId('battle-arena-progress')).toHaveText('Soalan 1/10')
      await expect(page.getByTestId('battle-arena-score-A')).toHaveText('0')
      await expect(page.getByTestId('battle-arena-score-B')).toHaveText('0')
      await expect(page.getByTestId('battle-arena-option')).toHaveCount(4)
      await expect(page.getByTestId('battle-arena-option').first()).toContainText('A.')
      await expectNoHorizontalScroll(page)

      await mock.advanceTime(3000)
      await page.getByTestId('battle-arena-option').first().click()
      const fb = page.getByTestId('battle-arena-feedback')
      await expect(fb).toBeVisible()
      const text = (await fb.innerText()).trim()
      expect(text).toMatch(/^\+\d+/)
      await expect(page.getByTestId('battle-arena-opponent')).toContainText('Lawan:')
      await mock.advanceTime(1500)
      await expect(page.getByTestId('battle-arena-progress')).toHaveText('Soalan 2/10')

      const confirm = acceptNextDialog(page, {
        type: 'confirm',
        message: 'Tamatkan battle ini? Anda akan dikira kalah.',
      })
      await page.getByTestId('battle-arena-forfeit').click()
      await confirm
      await expect(page.getByTestId('battle-arena-title')).toHaveText('Kalah')
      await page.goto(arenaUrl)

      // Another user and a random uuid are the 404 page.
      await gotoApp('/battle/arena/00000000-0000-4000-8000-000000000000')
      await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
    },
  )

  test(
    'E2E-M16-35/36 finish 10 questions: result, first in S5 ("baru sahaja"), S4 of the school @m16',
    provisional('the arena and the bot are SIMULATION / PROPOSED'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/battle/history')
      await expect(page.getByTestId('battle-history-empty')).toContainText('Tiada sejarah battle')
      await expect(page.getByTestId('battle-history-empty')).toContainText(
        'Mulakan pertandingan pertama anda sekarang!',
      )
      await page.getByTestId('battle-history-start').click()
      await expect(page).toHaveURL(/\/battle$/)
      await pickSubject(page, 'Matematik')
      await quick(page).click()
      await expect(timer(page)).toBeVisible()
      await mock.advanceTime(9000)
      await expect(page).toHaveURL(/\/battle\/arena\//)
      for (let i = 1; i <= 10; i++) {
        await expect(page.getByTestId('battle-arena-progress')).toHaveText(`Soalan ${String(i)}/10`)
        await page.getByTestId('battle-arena-option').first().click()
        await expect(page.getByTestId('battle-arena-feedback')).toBeVisible()
        await mock.advanceTime(1500)
      }
      const result = page.getByTestId('battle-arena-title')
      await expect(result).toHaveText(/^(Menang|Seri|Kalah)$/)
      await expect(page.getByTestId('battle-arena-final')).toHaveText(/^\d+ vs \d+$/)
      await expect(page.getByTestId('battle-arena-again')).toHaveText('Mula Battle')
      await page.getByTestId('battle-arena-history').click()
      await expect(page).toHaveURL(/\/battle\/history$/)
      const first = page.getByTestId('battle-recent-row').first()
      await expect(first).toContainText('baru sahaja')
      await expect(first.getByTestId('battle-player-a')).toHaveText('Admin Demo')

      const schoolId = canonicalAccount(ADMIN)!.schoolId
      await gotoApp(`/battle/ranking-sekolah/${String(schoolId)}`)
      await expect(page.getByTestId('battle-recent-row').first()).toContainText('baru sahaja')
    },
  )

  test('E2E-M16-37 S2 default: Mingguan active, 7 columns and the empty text @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/battle/leaderboard')
    await expect(page.getByTestId('battle-pill-weekly')).toHaveClass(/bg-red-500/)
    await expect(page.locator('thead th')).toHaveText([
      '#',
      'Pelajar',
      'Sekolah',
      'M/S/K',
      'Ketepatan',
      'Streak',
      'Skor',
    ])
    await expect(page.getByTestId('battle-leaderboard-empty')).toHaveText(
      'Belum ada data ranking. Mula battle untuk muncul di sini!',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-38 S2 "Bulanan" lists the seeded September battlers @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/battle/leaderboard')
    await page.getByTestId('battle-pill-monthly').click()
    await expect(page.getByTestId('battle-pill-monthly')).toHaveClass(/bg-red-500/)
    await expect(page.getByTestId('battle-leaderboard-row')).toHaveCount(2)
    await expect(page.getByTestId('battle-msk')).toHaveText(['2/0/2', '2/0/2'])
    await page.getByTestId('battle-pill-weekly').click()
    await expect(page.getByTestId('battle-leaderboard-empty')).toBeVisible()
  })

  test('E2E-M16-39 S3 weekly empty, monthly one row, all time seven rows and the podium @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/battle/ranking-sekolah')
    await expect(page.getByTestId('battle-period-weekly')).toHaveClass(/bg-blue-500/)
    await expect(page.getByTestId('battle-schools-empty')).toHaveText(
      'Belum ada data ranking. Mula battle untuk melihat ranking sekolah!',
    )
    await expect(page.getByTestId('battle-podium')).toBeHidden()
    await page.getByTestId('battle-period-monthly').click()
    await expect(page).toHaveURL(/period=monthly/)
    await expect(page.getByTestId('battle-school-row')).toHaveCount(1)
    await expect(page.getByTestId('battle-school-link')).toHaveAttribute(
      'href',
      '/battle/ranking-sekolah/8082',
    )
    await page.getByTestId('battle-period-all_time').click()
    await expect(page.getByTestId('battle-school-row')).toHaveCount(7)
    const hrefs = await page
      .getByTestId('battle-school-link')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(hrefs.slice(0, 4)).toEqual([
      '/battle/ranking-sekolah/8106',
      '/battle/ranking-sekolah/8090',
      '/battle/ranking-sekolah/8078',
      '/battle/ranking-sekolah/8082',
    ])
    await expect(page.getByTestId('battle-podium').locator('> div')).toHaveCount(3)
    await expect(page.getByTestId('battle-podium-1')).toBeVisible()
    const row8082 = page.getByTestId('battle-school-row').filter({
      has: page.locator('a[href$="/8082"]'),
    })
    await expect(row8082.locator('td').nth(2)).toHaveText('10')
    await expect(row8082.getByTestId('battle-msk')).toHaveText('5/0/5')
    await expect(row8082.locator('td').nth(5)).toHaveText('4')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-40 S3 state filter keeps the national rank and the links keep the state @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/battle/ranking-sekolah?period=all_time')
    await page.getByTestId('battle-state-select').selectOption('Johor')
    await expect(page).toHaveURL(/period=all_time&state=Johor/)
    await expect(page.getByTestId('battle-state-select')).toHaveValue('Johor')
    await expect(page.getByTestId('battle-period-weekly')).toHaveAttribute('href', /state=Johor/)
    const ranks = await page.locator('tbody tr td:first-child').allInnerTexts()
    expect(ranks.map((r) => r.trim())).toEqual(expect.arrayContaining(['5', '7']))
    await expect(page.getByTestId('battle-podium').locator('> div')).toHaveCount(3)
    await page.getByTestId('battle-school-link').first().click()
    await expect(page).toHaveURL(/\/battle\/ranking-sekolah\/\d+$/)
    await expect(page.getByTestId('battle-school-name')).toBeVisible()
  })

  test('E2E-M16-41 S4 8106: hero, cards, empty period boxes, empty fighters, 10 battles @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/battle/ranking-sekolah/8106')
    await expect(page.getByTestId('battle-school-line')).toHaveText('PPD HULU LANGAT · Selangor · SMK')
    await expect(page.getByTestId('battle-card-value')).toHaveText(['19', '12', '69%', '7'])
    await expect(page.getByTestId('battle-box-empty')).toHaveText([
      'Tiada data minggu ini',
      'Tiada data bulan ini',
    ])
    await expect(page.getByTestId('battle-fighters-empty')).toHaveText(
      'Tiada data pejuang minggu ini',
    )
    await expect(page.getByTestId('battle-recent-row')).toHaveCount(10)
    await expect(
      page.getByTestId('battle-recent-row').first().getByTestId('battle-time'),
    ).toHaveText(/yang lepas$/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M16-42 S4 school without battles, unknown id 404, colours of 8880, 8082 monthly box @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/battle/ranking-sekolah/900')
    await expect(page.getByTestId('battle-card-value')).toHaveText(['0', '0', '0%', '0'])
    await expect(page.getByTestId('battle-recent-empty')).toHaveText('Tiada battle terkini')
    await expect(page.getByTestId('battle-box-empty')).toHaveCount(2)

    await gotoApp('/battle/ranking-sekolah/99999999')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()

    await gotoApp('/battle/ranking-sekolah/8880')
    await expect(page.getByTestId('battle-card-value')).toHaveText(['3', '2', '33%', '1'])
    const green = page.locator('[data-testid^="battle-score-"].text-green-600')
    expect(await green.count()).toBeGreaterThan(0)

    await gotoApp('/battle/ranking-sekolah/8082')
    const month = page.getByTestId('battle-period-box-month')
    await expect(month.getByTestId('battle-box-rank')).toHaveText('#1')
    await expect(month.getByTestId('battle-box-battles')).toHaveText('8')
    await expect(month.getByTestId('battle-box-msk')).toHaveText('4/0/4')
    await expect(month.getByTestId('battle-box-skor')).toHaveText('591')
  })

  test('E2E-M16-13 no horizontal page scroll; tables and the S4 list scroll inside their card @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.setTimeout(420_000)
    await loginAs(ADMIN)
    for (const [path, ready] of [
      ['/battle', 'battle-lobby'],
      ['/battle/leaderboard', 'battle-leaderboard'],
      ['/battle/ranking-sekolah?period=all_time', 'battle-podium'],
      ['/battle/ranking-sekolah/8106', 'battle-recent-list'],
      ['/battle/history', 'battle-history'],
    ] as const) {
      await gotoApp(path)
      await expect(page.getByTestId(ready)).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
    const width = page.viewportSize()!.width
    await gotoApp('/battle/ranking-sekolah/8106')
    await expect(page.getByTestId('battle-recent-scroll')).toBeVisible()
    const wide = await page.getByTestId('battle-recent-scroll').evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }))
    if (width < 768) expect(wide.scroll).toBeGreaterThan(wide.client)
    await gotoApp('/battle/ranking-sekolah?period=all_time')
    await expect(page.getByTestId('battle-schools-scroll')).toBeVisible()
    const t = await page.getByTestId('battle-schools-scroll').evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }))
    if (width < 768) expect(t.scroll).toBeGreaterThan(t.client)
    else expect(t.scroll).toBeLessThanOrEqual(t.client)
  })

  test('touch targets: mode buttons and the type buttons are at least 44 px @m16', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR2)
    await openLobby(page, gotoApp)
    await expectTouchTarget(page.getByTestId('battle-type-biasa'))
    await expectTouchTarget(page.getByTestId('battle-type-pksk'))
    await expectTouchTarget(page.getByTestId('battle-type-spm'))
    await expectTouchTarget(quick(page))
    await expectTouchTarget(page.getByTestId('battle-link-students'))
  })
})
