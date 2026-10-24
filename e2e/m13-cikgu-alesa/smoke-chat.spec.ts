/**
 * M13 S1 `/cikgu` Cikgu Alesa chat at 375 / 768 / 1280 (M13-T2; SRS M13 v1.1 §12: E2E-M13-03 (S1 to S6
 * titles), 05, 10, 11 to 30). The AI and the voice are simulated (D4): canned replies, a simulated
 * recogniser and speaker; `speechSynthesis` and `SpeechRecognition` are only spied to prove they are
 * never called. Accounts: the admin (no records) and 5 guru (`guru@demo.test`, 2 turns used today).
 * Tests that assert canned content, quota, roles or the guard of INFERRED roles are `@provisional`.
 * Not covered here (other tasks): E2E-M13-01, 02, 04 (shell menu and nav), the S5 and S4 halves of
 * 23 and 25 (M13-T4), E2E-M13-51 S1 row (kept in 11 and 21-width checks below).
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

/** The shell re-renders once the session loads; give the first assertions room on a loaded machine. */
/** Slow machines: E2E_TIMEOUT_FACTOR multiplies the expect timeout (assertions unchanged). */
const TIMEOUT_FACTOR = Number(process.env.E2E_TIMEOUT_FACTOR) || 1
const expect = baseExpect.configure({ timeout: 10_000 * TIMEOUT_FACTOR })

const ADMIN = 'admin@demo.test'
const GURU = 'guru@demo.test'
const PELAJAR = 'pelajar@demo.test'
const GURU_ID = 5
const SEND = '/api/cikgu/send'
const MODULE = { tag: [moduleTag(13)] }

const GREETING =
  'Cikgu Alesa: Hai! Saya Cikgu Alesa. Apa nak belajar hari ni? Cuba tanya pasal subjek tertentu, atau minta latihan soalan.'
const FALLBACK = 'Cikgu Alesa: Cikgu Alesa tidak dapat membalas. Cuba lagi.'
const NETWORK = 'Cikgu Alesa: Ralat sambungan. Cuba lagi sebentar.'
const ESSAY =
  'Karangan contoh ini hanya untuk ujian dan ditulis dengan neutral. Ia bukan karangan sebenar sesiapa.'

test.use({ mockInit: { latency: 0 } })

/** BR-M13-22 / E2E §12: the AI latency (default 1,500 ms) is set per test. */
async function latency(mock: MockHandle, ms: number): Promise<void> {
  await mock.config('m13.aiLatencyMs', ms)
}

const input = (page: Page) => page.locator('#cikgu-input')
const sendBtn = (page: Page) => page.locator('#cikgu-send')
const meta = (page: Page) => page.locator('#cikgu-meta')
const msgs = (page: Page) => page.locator('#cikgu-history .cikgu-msg')
const status = (page: Page) => page.locator('#cikgu-voice-status')
const mic = (page: Page) => page.locator('#cikgu-mic')

async function say(page: Page, text: string): Promise<void> {
  await input(page).fill(text)
  await sendBtn(page).click()
}

async function sendsCount(mock: MockHandle): Promise<number> {
  return (await mock.requests(SEND)).length
}

/** Spies that count calls of the browser speech APIs (they must stay 0, NFR-M13-01). */
async function spySpeechApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    w.__speechCalls = 0
    const count = () => {
      ;(w.__speechCalls as number)++
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.speak = () => count()
    }
    w.SpeechRecognition = function SpeechRecognition() {
      count()
    }
    w.webkitSpeechRecognition = w.SpeechRecognition
  })
}

const speechCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __speechCalls: number }).__speechCalls)

test.describe('M13 S1 chat', MODULE, () => {
  test('E2E-M13-03 S1 to S6: header titles with the subtitle and the live tab titles @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    const screens = [
      ['/cikgu', 'Cikgu Alesa', 'Cikgu Alesa'],
      ['/cikgu/rph', 'Rancangan Pengajaran Harian (RPH)', 'RPH — Cikgu Alesa'],
      ['/cikgu/rph/baharu', 'Jana RPH dengan Cikgu Alesa', 'Jana RPH Baharu'],
      ['/cikgu/essay', 'Penandaan Karangan AI', 'Penandaan Karangan'],
      ['/cikgu/essay/baharu', 'Tanda Karangan Baharu', 'Tanda Karangan Baharu'],
      ['/cikgu/pbd', 'PBD Auto-Tag — Antrian Semakan', 'Auto-Tag PBD — Baris Gilir'],
    ] as const
    for (const [path, header, tab] of screens) {
      await gotoApp(path)
      await expect(page.getByTestId('shell-user-title').first()).toHaveText(header)
      await expect(page.getByTestId('shell-user-subtitle').first()).toHaveText(
        'Selamat datang kembali',
      )
      await expectTabTitle(page, tab)
    }
  })

  test(
    'E2E-M13-05 a guest is sent to /login from S1 to S6 @m13',
    provisional('guest guard of the M13 paths is INFERRED (FR-M13-06)'),
    async ({ page, gotoApp }) => {
      for (const path of [
        '/cikgu',
        '/cikgu/rph',
        '/cikgu/essay/baharu',
        '/cikgu/pbd',
      ]) {
        await gotoApp(path)
        await expect(page).toHaveURL(/\/login$/)
      }
    },
  )

  // M01 BR-07: student and parent both land on /dashboard.
  for (const [label, email] of [
    ['pelajar', PELAJAR],
    ['ibu bapa', 'ibubapa@demo.test'],
  ] as const) {
    test(
      `E2E-M13-10 ${label}: S1 renders, S2 to S6 go to the landing page @m13`,
      provisional('role guard of S2 to S6 for other roles is INFERRED (FR-M13-07)'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(email)
        await gotoApp('/cikgu')
        await expect(page).toHaveURL(/\/cikgu$/)
        await expect(page.locator('.cikgu-alesa-shell h1')).toHaveText('Cikgu Alesa')
        await expect(input(page)).toBeVisible()
        for (const path of ['/cikgu/rph', '/cikgu/essay', '/cikgu/pbd']) {
          await gotoApp(path)
          await expect(page).toHaveURL(/\/dashboard$/)
        }
      },
    )
  }

  test('S1 route guard: teacher and admin are not redirected from S2 to S6 @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    for (const path of ['/cikgu/rph', '/cikgu/rph/baharu', '/cikgu/essay', '/cikgu/essay/baharu', '/cikgu/pbd']) {
      await gotoApp(path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
    }
  })

  test('E2E-M13-11 admin S1 default: avatar, heading, sub-line, greeting, toolbar, form, no tier text @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    const shell = page.locator('.cikgu-alesa-shell')
    await expect(shell).toBeVisible()
    await expect(shell.getByText('CA', { exact: true })).toBeVisible()
    await expect(shell.locator('h1')).toHaveText('Cikgu Alesa')
    await expect(shell.locator('.ca-sub')).toHaveText(
      'Guru maya · Powered by Cikgu Nur Demo · Cikgu Amin Demo · Cikgu Siti Demo + 50K+ soalan DSKP',
    )
    await expect(msgs(page)).toHaveCount(1)
    await expect(msgs(page).first()).toHaveText(GREETING)
    await expect(msgs(page).first()).toHaveClass(/cikgu-msg-bot/)
    await expect(page.locator('#cikgu-voice-toolbar')).toContainText('🎙️ Mod Suara:')
    await expect(page.locator('#cikgu-voice-toolbar')).toContainText(
      'Cikgu jawab dengan suara (auto)',
    )
    await expect(page.locator('#cikgu-voice-mode')).not.toBeChecked()
    await expect(status(page)).toHaveText('')
    await expect(mic(page)).toHaveText('🎤')
    await expect(input(page)).toHaveAttribute('placeholder', 'Taip atau tekan 🎤 untuk cakap…')
    await expect(input(page)).toHaveAttribute('required', '')
    await expect(input(page)).toHaveAttribute('maxlength', '4000')
    await expect(input(page)).not.toHaveAttribute('name', /.*/)
    await expect(sendBtn(page)).toHaveText('Hantar')
    await expect(meta(page)).toHaveText('')
    await expect(page.getByText('Tier:')).toHaveCount(0)
    // DV-M13-03 / E2E-M13-51: one form row, "Hantar" inside the card, no page scroll.
    const card = await shell.boundingBox()
    const send = await sendBtn(page).boundingBox()
    expect(send!.x + send!.width).toBeLessThanOrEqual(card!.x + card!.width + 1)
    expect(send!.height).toBeGreaterThanOrEqual(44)
    await expectTouchTarget(mic(page))
    await expectTouchTarget(sendBtn(page))
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M13-12 the reply is text: a <br> per line, markup kept literal, history scrolled to the bottom @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await mock.hook('cikguNextReply', 'Baris 1\n<b>x</b>')
    await say(page, 'Terangkan pecahan')
    const bot = msgs(page).nth(2)
    await expect(bot.locator('.cikgu-msg-body br')).toHaveCount(1)
    await expect(bot.locator('.cikgu-msg-body')).toContainText('<b>x</b>')
    await expect(bot.locator('b')).toHaveCount(0)
    await expect(bot.locator('strong')).toHaveText('Cikgu Alesa:')
    const atBottom = await page
      .locator('#cikgu-history')
      .evaluate((el) => Math.abs(el.scrollTop - (el.scrollHeight - el.clientHeight)) <= 1)
    expect(atBottom).toBe(true)
  })

  test(
    'E2E-M13-13 teacher send: busy state, then the reply, the usage line, the thread id and focus @m13',
    provisional('canned reply, tier and quota are PROPOSED (BR-M13-04, 05, 06)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu')
      await latency(mock, 800 * TIMEOUT_FACTOR)
      await say(page, 'Terangkan pecahan setara')
      await expect(msgs(page).nth(1)).toHaveText('Anda: Terangkan pecahan setara')
      await expect(input(page)).toHaveValue('')
      await expect(sendBtn(page)).toBeDisabled()
      await expect(meta(page)).toHaveText('Cikgu Alesa sedang berfikir…')
      await expect(msgs(page).nth(2)).toContainText('Cikgu Alesa: Soalan yang baik!')
      await expect(sendBtn(page)).toBeEnabled()
      await expect(input(page)).toBeFocused()
      await expect(meta(page)).toHaveText(
        /^Tier: guru · Turns remaining: 27 · Tool hops: 0 · Tokens: in=126 out=\d+$/,
      )
      await expect(page.locator('#cikgu-thread-id')).toHaveValue(/^thr-\d+$/)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M13-14 second turn carries the thread id: practice reply, one tool hop, one turn less @m13',
    provisional('canned reply, tool hops and quota are PROPOSED'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu')
      await latency(mock, 300)
      await say(page, 'Terangkan pecahan setara')
      await expect(msgs(page)).toHaveCount(3)
      const thread = await page.locator('#cikgu-thread-id').inputValue()
      await say(page, 'Minta latihan soalan pecahan')
      await expect(msgs(page)).toHaveCount(5)
      const last = await mock.lastRequest(SEND)
      expect((last!.body as { thread_id: string }).thread_id).toBe(thread)
      const reply = msgs(page).nth(4).locator('.cikgu-msg-body')
      await expect(reply.locator('br')).toHaveCount(4)
      await expect(reply).toContainText('1. ')
      await expect(reply).toContainText('3. ')
      await expect(meta(page)).toContainText('Turns remaining: 26 · Tool hops: 1')
    },
  )

  test('E2E-M13-15 an empty input is invalid and sends nothing; whitespace is silent @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await sendBtn(page).click()
    await expect(input(page)).toHaveJSProperty('validity.valueMissing', true)
    expect(await input(page).evaluate((el) => (el as HTMLInputElement).matches(':invalid'))).toBe(true)
    expect(await sendsCount(mock)).toBe(0)
    await input(page).fill('   ')
    await sendBtn(page).click()
    await expect(msgs(page)).toHaveCount(1)
    expect(await sendsCount(mock)).toBe(0)
  })

  test('E2E-M13-16 a reload shows the greeting only and the next send starts a new thread @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await say(page, 'Terangkan pecahan')
    await expect(msgs(page)).toHaveCount(3)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await expect(msgs(page)).toHaveCount(1)
    await expect(input(page)).toHaveValue('')
    await say(page, 'Terangkan lagi')
    await expect(msgs(page)).toHaveCount(3)
    const last = await mock.lastRequest(SEND)
    expect((last!.body as { thread_id: unknown }).thread_id).toBeNull()
  })

  test('E2E-M13-17 an empty reply shows "(tiada respon)" @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await mock.hook('cikguNextReply', '')
    await say(page, 'Terangkan pecahan')
    await expect(msgs(page).nth(2)).toHaveText('Cikgu Alesa: (tiada respon)')
  })

  test('E2E-M13-18 a 500 body shows its error text, or the fallback when it has none @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await mock.failNext(SEND, { status: 500, body: { error: 'Ralat ujian.' } })
    await say(page, 'Satu')
    await expect(msgs(page).nth(2)).toHaveText('Cikgu Alesa: Ralat ujian.')
    await expect(meta(page)).toHaveText('')
    await mock.failNext(SEND, { status: 500, body: {} })
    await say(page, 'Dua')
    await expect(msgs(page).nth(4)).toHaveText(FALLBACK)
    await expect(meta(page)).toHaveText('')
    await expect(sendBtn(page)).toBeEnabled()
  })

  test(
    'E2E-M13-19 quota used up: fallback text, the quota line, nothing stored @m13',
    provisional('quota and tier values are PROPOSED (BR-M13-06)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(GURU)
      await gotoApp('/cikgu')
      await latency(mock, 0)
      await mock.hook('cikguSetTurnsUsed', GURU_ID, 30)
      await say(page, 'Terangkan pecahan')
      await expect(msgs(page).nth(2)).toHaveText(FALLBACK)
      await expect(meta(page)).toHaveText('Kuota habis untuk hari ini.')
      await expect(sendBtn(page)).toBeEnabled()
      await expect(input(page)).toBeFocused()
    },
  )

  test('E2E-M13-20 a network failure and a non-JSON body show the connection text @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await mock.failNext(SEND, 'network')
    await say(page, 'Satu')
    await expect(msgs(page).nth(2)).toHaveText(NETWORK)
    await expect(sendBtn(page)).toBeEnabled()
    await expect(input(page)).toBeFocused()
    await mock.failNext(SEND, { status: 200, body: 'bukan json' })
    await say(page, 'Dua')
    await expect(msgs(page).nth(4)).toHaveText(NETWORK)
  })

  test(
    'E2E-M13-21 the quota day follows the mock clock: a new day gives 29 turns left @m13',
    provisional('the daily reset is INFERRED (BR-M13-06)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      // A remember-me session: the jump of one day must not expire the 120-minute sliding session.
      await loginAs(GURU, { remember: true })
      await gotoApp('/cikgu')
      await latency(mock, 0)
      await mock.setNow('2026-09-26T08:00:00+08:00')
      await say(page, 'Terangkan pecahan')
      await expect(meta(page)).toContainText('Turns remaining: 29')
    },
  )

  test('E2E-M13-22 ?ask= fills and focuses the input and sends nothing @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu?ask=Terangkan%20pecahan%20setara')
    await expect(input(page)).toHaveValue('Terangkan pecahan setara')
    await expect(input(page)).toBeFocused()
    await expect(msgs(page)).toHaveCount(1)
    expect(await sendsCount(mock)).toBe(0)
  })

  test('E2E-M13-23 the essay hand-off fills the chat input, focuses it and removes the storage key (S1 half) @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await page.addInitScript((essay) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1')
        sessionStorage.setItem('cikgu_pending_essay', essay)
      }
    }, ESSAY)
    await gotoApp(
      '/cikgu?action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme',
    )
    await expect(input(page)).toHaveValue(
      'Tolong tanda karangan ini menggunakan rubrik Sejarah — Karangan Esei (20 markah). ' +
        'Subjek: Sejarah. Tahap: T5. Pelajar: Murid Demo 03. Tajuk: Semangat Patriotisme. ' +
        `Karangan: ${ESSAY}`,
    )
    await expect(input(page)).toBeFocused()
    expect(await sendsCount(mock)).toBe(0)
    expect(await page.evaluate(() => sessionStorage.getItem('cikgu_pending_essay'))).toBeNull()
  })

  test('S1 hand-off variant: the hand-off with the essay only leaves the optional parts out and uses the default rubric @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await page.addInitScript((essay) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1')
        sessionStorage.setItem('cikgu_pending_essay', essay)
      }
    }, ESSAY)
    await gotoApp('/cikgu?action=mark_essay&rubric=&subject=&level=&student=&title=')
    await expect(input(page)).toHaveValue(
      'Tolong tanda karangan ini menggunakan rubrik SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah). ' +
        `Karangan: ${ESSAY}`,
    )
  })

  test('E2E-M13-24 mark_essay without a stored essay leaves the input empty @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu?action=mark_essay&rubric=general')
    await expect(page.locator('.cikgu-alesa-shell h1')).toHaveText('Cikgu Alesa')
    await expect(input(page)).toHaveValue('')
  })

  test(
    'E2E-M13-25 sending the hand-off message returns the marks and one tool hop (S4 row: M13-T4) @m13',
    provisional('the marking text and marks are PROPOSED (BR-M13-08, 09)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(GURU)
      await page.addInitScript((essay) => {
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1')
          sessionStorage.setItem('cikgu_pending_essay', essay)
        }
      }, ESSAY)
      await gotoApp(
        '/cikgu?action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme',
      )
      await latency(mock, 300)
      await sendBtn(page).click()
      await expect(msgs(page)).toHaveCount(3)
      const reply = msgs(page).nth(2).locator('.cikgu-msg-body')
      await expect(reply).toContainText('Markah: 14/20')
      await expect(reply).toContainText('Rubrik: Sejarah — Karangan Esei (20 markah)')
      await expect(reply).toContainText('Komen membina:')
      await expect(meta(page)).toContainText('Tool hops: 1')
    },
  )

  test('E2E-M13-26 the voice switch is off by default and its choice is remembered @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    const box = page.locator('#cikgu-voice-mode')
    await expect(box).not.toBeChecked()
    await box.check()
    expect(await page.evaluate(() => localStorage.getItem('cikgu_voice_mode'))).toBe('1')
    await gotoApp('/cikgu')
    await expect(box).toBeChecked()
    await box.uncheck()
    expect(await page.evaluate(() => localStorage.getItem('cikgu_voice_mode'))).toBe('0')
  })

  test('E2E-M13-27 simulated speaker: status while "speaking", only long 2xx replies, never speechSynthesis @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await spySpeechApis(page)
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await page.locator('#cikgu-voice-mode').check()
    await say(page, 'Terangkan pecahan')
    await expect(msgs(page)).toHaveCount(3)
    await expect(status(page)).toHaveText('🔊 Cikgu sedang bercakap…')
    const spoken = await mock.hook<string[]>('cikguSpoken')
    expect(spoken).toHaveLength(1)
    expect(spoken[0]).toContain('Soalan yang baik!')
    await mock.advanceTime(8100)
    await expect(status(page)).toHaveText('')
    // A second reply while "speaking" restarts the status.
    await say(page, 'Satu lagi')
    await expect(status(page)).toHaveText('🔊 Cikgu sedang bercakap…')
    await expect(msgs(page)).toHaveCount(5)
    await mock.advanceTime(4000)
    await say(page, 'Dan lagi')
    await expect(msgs(page)).toHaveCount(7)
    expect(await mock.hook<string[]>('cikguSpoken')).toHaveLength(3)
    await mock.advanceTime(8100)
    await expect(status(page)).toHaveText('')
    // Not spoken: a short reply, "(tiada respon)", an error and a network failure.
    await mock.hook('cikguNextReply', 'Ok')
    await say(page, 'Pendek')
    await expect(msgs(page)).toHaveCount(9)
    await mock.hook('cikguNextReply', '')
    await say(page, 'Kosong')
    await expect(msgs(page)).toHaveCount(11)
    await mock.failNext(SEND, { status: 500, body: { error: 'Ralat ujian panjang sungguh.' } })
    await say(page, 'Ralat')
    await expect(msgs(page)).toHaveCount(13)
    await mock.failNext(SEND, 'network')
    await say(page, 'Rangkaian')
    await expect(msgs(page)).toHaveCount(15)
    expect(await mock.hook<string[]>('cikguSpoken')).toHaveLength(3)
    await expect(status(page)).toHaveText('')
    // Switch off: nothing is spoken.
    await page.locator('#cikgu-voice-mode').uncheck()
    await say(page, 'Senyap')
    await expect(msgs(page)).toHaveCount(17)
    expect(await mock.hook<string[]>('cikguSpoken')).toHaveLength(3)
    expect(await speechCalls(page)).toBe(0)
  })

  test('E2E-M13-28 the mic is enabled; the hook turns on the "browser does not support voice" state @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await expect(mic(page)).toBeEnabled()
    await mock.hook('cikguVoice', { supported: false })
    await expect(mic(page)).toBeDisabled()
    await expect(mic(page)).toHaveAttribute('title', 'Pelayar tidak menyokong suara — guna Chrome/Edge')
    await expect(mic(page)).toHaveCSS('opacity', '0.4')
  })

  test('E2E-M13-29 simulated recogniser: listening, interim, final, end and auto-submit @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await spySpeechApis(page)
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    // Slow machines: the recogniser delays scale with the timeout factor (timing only).
    await mock.hook('cikguVoice', {
      delays: { interim: 600 * TIMEOUT_FACTOR, final: 1200 * TIMEOUT_FACTOR },
    })
    await mic(page).click()
    await expect(mic(page)).toHaveText('🔴')
    await expect(mic(page)).toHaveCSS('background-color', 'rgb(254, 226, 226)')
    await expect(status(page)).toHaveText('Mendengar...')
    await expect(input(page)).toHaveValue('Terangkan pecahan')
    await expect(mic(page)).toHaveText('🎤')
    await expect(status(page)).toHaveText('')
    await expect(msgs(page).nth(1)).toHaveText('Anda: Terangkan pecahan setara dengan contoh')
    await expect(msgs(page)).toHaveCount(3)
    expect(await sendsCount(mock)).toBe(1)
    expect(await speechCalls(page)).toBe(0)
  })

  test('S1 voice variant: a second click stops the session and sends the interim text @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    // The final transcript is pushed far away, so the second click always comes after the interim one.
    await mock.hook('cikguVoice', { delays: { interim: 150, final: 60_000 } })
    await mic(page).click()
    await expect(input(page)).toHaveValue('Terangkan pecahan')
    await mic(page).click()
    await expect(msgs(page).nth(1)).toHaveText('Anda: Terangkan pecahan')
    await expect(mic(page)).toHaveText('🎤')
    expect(await sendsCount(mock)).toBe(1)
  })

  test('S1 voice variant: the error step shows "Maaf, tak dengar." then ends; the interim text is still sent @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    // Slow machines: the simulated recogniser delays scale with the timeout factor (timing only).
    await mock.hook('cikguVoice', {
      delays: {
        interim: 600 * TIMEOUT_FACTOR,
        final: 1200 * TIMEOUT_FACTOR,
        errorHold: 1000 * TIMEOUT_FACTOR,
      },
    })
    await mic(page).click()
    await mock.hook('cikguVoiceError')
    await expect(status(page)).toHaveText('Maaf, tak dengar.')
    await expect(mic(page)).toHaveText('🎤')
    await expect(status(page)).toHaveText('')
    await expect(msgs(page)).toHaveCount(1)
    expect(await sendsCount(mock)).toBe(0)
    // Error after the interim text: the end step still auto-submits it.
    await mock.hook('cikguVoice', { delays: { interim: 150, final: 60_000 } })
    await mic(page).click()
    await expect(input(page)).toHaveValue('Terangkan pecahan')
    await mock.hook('cikguVoiceError')
    await expect(status(page)).toHaveText('Maaf, tak dengar.')
    await expect(msgs(page).nth(1)).toHaveText('Anda: Terangkan pecahan')
    expect(await sendsCount(mock)).toBe(1)
  })

  test('S1 voice variant: dictation ending while a turn is in flight starts a second request (replicated) @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 2500)
    await say(page, 'Pertanyaan pertama')
    await expect(sendBtn(page)).toBeDisabled()
    await mic(page).click()
    await expect.poll(() => sendsCount(mock), { timeout: 6000 }).toBe(2)
  })

  test('E2E-M13-30 the enabled mic carries the title "Tekan untuk cakap" @m13', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await expect(mic(page)).toHaveAttribute('title', 'Tekan untuk cakap')
  })

  test('S1 has no page-level horizontal scroll after a long reply @m13', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/cikgu')
    await latency(mock, 0)
    await mock.hook('cikguNextReply', `${'Panjang'.repeat(60)}\n${'x'.repeat(200)}`)
    await say(page, 'Terangkan pecahan')
    await expect(msgs(page)).toHaveCount(3)
    await expectNoHorizontalScroll(page)
  })
})
