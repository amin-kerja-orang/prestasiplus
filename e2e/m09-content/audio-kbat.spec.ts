/**
 * M09 S21 `/audio-kbat` and the provisional player `/audio-kbat/:id` at 375 / 768 / 1280 (SRS M09 §12
 * scenarios 45 and 46; the titles carry "SRS §12 #nn"). S21 copy and the header are OBSERVED plus
 * DV-M09-08 / DV-M09-09. The player route and every set-dependent behaviour are INFERRED (L-3) and
 * tagged `@provisional`. No seed hook exists for `seedAudioKbatSet()`, so the sets are created as
 * the admin through S13 and the session is then switched with `mock.setUser` plus a client-side
 * navigation (the store lives in the page).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import type { MockHandle } from '../fixtures/mock-handle'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
} from '../support'

const STUDENT = 'pelajar@demo.test'
const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(9)] }
const MP3 = { name: 'audio.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3') }

test.use({ mockInit: { latency: 0 } })

/** A short silent mono WAV (8 kHz, 8-bit, 1 s): a valid, playable audio body for the player. */
function silentWav(): Buffer {
  const samples = 8000
  const head = Buffer.alloc(44)
  head.write('RIFF', 0)
  head.writeUInt32LE(36 + samples, 4)
  head.write('WAVEfmt ', 8)
  head.writeUInt32LE(16, 16)
  head.writeUInt16LE(1, 20)
  head.writeUInt16LE(1, 22)
  head.writeUInt32LE(8000, 24)
  head.writeUInt32LE(8000, 28)
  head.writeUInt16LE(1, 32)
  head.writeUInt16LE(8, 34)
  head.write('data', 36)
  head.writeUInt32LE(samples, 40)
  return Buffer.concat([head, Buffer.alloc(samples, 0x80)])
}

/**
 * The mock has no audio asset: its section URLs (/storage/audio-kbat/{id}/audioN.mp3, mock/handlers/audio.ts:42-43)
 * fall through to the SPA index (200 text/html). This fixture serves a real tiny WAV so the player can be tested.
 */
async function serveAudioFixture(page: Page): Promise<void> {
  await page.route('**/storage/audio-kbat/**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() }),
  )
}

/** Client-side navigation (keeps the in-page mock store). */
async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const app = document.querySelector('#app') as
      | (Element & {
          __vue_app__?: {
            config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
          }
        })
      | null
    await app!.__vue_app__!.config.globalProperties.$router.push(to)
  }, path)
}

/** Option labels of a Nuxt UI select (opens the list, reads it, closes it). */
async function optionTexts(page: Page, testId: string): Promise<string[]> {
  await page.getByTestId(testId).click()
  const texts = (await page.getByRole('option').allTextContents()).map((t) => t.trim())
  await page.keyboard.press('Escape')
  return texts
}

/** Picks one label in a Nuxt UI select. */
async function pickOption(page: Page, testId: string, label: string): Promise<void> {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

/** Creates a set through S13 (as the logged-in admin) with an audio file per section. */
async function createSet(
  page: Page,
  title: string,
  status: string,
  subject: string,
): Promise<void> {
  await spaGo(page, '/admin/audio-kbat/create')
  await expect(page.getByTestId('audio-form')).toBeVisible()
  await page.getByTestId('set-title').fill(title)
  await page.getByTestId('set-level').selectOption({ label: 'Tingkatan 4' })
  await page.getByTestId('set-subject').selectOption({ label: subject })
  await page.getByTestId('set-status').selectOption({ label: status })
  const files = page.getByTestId('section-audio')
  for (let i = 0; i < 4; i++) await files.nth(i).setInputFiles(MP3)
  await page.getByTestId('audio-form').evaluate((form) => {
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[required], textarea[required]',
    )) {
      el.value = el.value || 'Isi ujian'
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await page.getByTestId('form-submit').click()
  await expect(page).toHaveURL(/\/admin\/audio-kbat$/)
}

/** As admin: an approved set (BM) and a draft set (BI), then switch to the student. */
async function seedAndSwitch(page: Page, mock: MockHandle, gotoApp: (p: string) => Promise<void>) {
  await gotoApp('/admin/audio-kbat')
  await expect(page.getByTestId('audio-list-page')).toBeVisible()
  await createSet(page, 'BM T4 Ujian Mendengar Set 1', 'Approved', 'Bahasa Melayu')
  await createSet(page, 'BI T5 Ujian Mendengar Set 1', 'Draft', 'Bahasa Inggeris')
  await mock.hook('setUser', STUDENT)
  await spaGo(page, '/audio-kbat')
}

test.describe('M09 S21 Audio KBAT student list', MODULE, () => {
  test('SRS §12 #45 header, hero, filter and the empty state as a student @m09', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/audio-kbat')
    await expect(page.getByTestId('audio-kbat-page')).toBeVisible({ timeout: 15_000 })
    await expectTabTitle(page, 'Audio KBAT | PRESTASIPLUS')
    await expect(page.getByTestId('pembelajaran-header').locator('h1')).toHaveText('Audio KBAT')
    await expect(page.getByTestId('pembelajaran-subtitle')).toHaveText(
      'Dengar soalan pemikiran aras tinggi mengikut subjek',
    )
    const headerBlock = page.getByTestId('pembelajaran-header').locator('h1').locator('..')
    await expect(headerBlock).not.toContainText('Dashboard')
    await expect(headerBlock).not.toContainText('Selamat datang kembali')

    // The gradient hero card is gone (design-system page header; V2 has none either, content/audio-kbat.blade.php):
    // the pill keeps "Ujian Mendengar" and the page header carries the intro line.
    const intro = page.getByTestId('audio-intro')
    await expect(intro).toHaveText('Ujian Mendengar')
    await expect(
      page
        .getByTestId('audio-kbat-page')
        .getByText('Dengar audio mengikut bahagian dan jawab soalan yang dipaparkan serentak.'),
    ).toBeVisible()

    const levels = await optionTexts(page, 'filter-level')
    // D72: Darjah 1-6 are hidden, so the list is Semua Tahap plus Tingkatan 1-5 (V1 live had 12).
    expect(levels).toEqual([
      'Semua Tahap',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    const subjects = await optionTexts(page, 'filter-subject')
    expect(subjects).toHaveLength(32)
    expect(subjects.slice(0, 4)).toEqual([
      'Semua Subjek',
      'Bahasa Arab',
      'Bahasa Cina',
      'Bahasa Inggeris',
    ])

    const submit = page.getByTestId('audio-filter').getByRole('button', { name: 'Tapis', exact: true })
    await expect(submit).toHaveText('Tapis')
    // V1 was white text on a solid fill; the V3 design-system filter button is the soft primary variant
    // (class bg-primary/10, text in the primary token), so the exact expectation is the primary token colour.
    const primary = await submit.evaluate((el) => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--ui-primary)'
      el.appendChild(probe)
      const c = getComputedStyle(probe).color
      probe.remove()
      return c
    })
    expect(primary).toMatch(/^rgb\(/)
    await expect(submit).toHaveCSS('color', primary)
    const bg = await submit.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg).not.toBe('rgb(255, 255, 255)')
    await expectTouchTarget(submit)

    await expect(page.getByTestId('audio-empty')).toContainText('Belum ada audio diterbitkan')
    await expect(page.getByTestId('audio-empty')).toContainText(
      'Audio KBAT akan muncul di sini selepas dimuat naik dan diterbitkan.',
    )
    await pickOption(page, 'filter-level', 'Tingkatan 4')
    await pickOption(page, 'filter-subject', 'Bahasa Melayu')
    await submit.click()
    await expect(page).toHaveURL(/\/audio-kbat\?education_level_id=10&subject_id=\d+$/)
    await expect(page.getByTestId('audio-empty')).toBeVisible()
    await expect(page.getByTestId('filter-level')).toHaveText('Tingkatan 4')
    await expect(page.getByTestId('filter-subject')).toHaveText('Bahasa Melayu')
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #45 the admin sees S21 in the Portal Pentadbiran @m09', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/audio-kbat')
    await expect(page.getByTestId('audio-kbat-page')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('pentadbiran-header').locator('h1')).toHaveText('Audio KBAT')
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText(
      'Dengar soalan pemikiran aras tinggi mengikut subjek',
    )
    await expect(page.getByTestId('pembelajaran-header')).toHaveCount(0)
  })

  test('SRS §12 #71 a guest is sent to /login @m09', async ({ page, gotoApp }) => {
    await gotoApp('/audio-kbat')
    await expect(page).toHaveURL(/\/login/)
  })

  test(
    'SRS §12 #46 lists only the approved set, opens the player, answers and stores the score @m09',
    provisional(
      'the player, its copy "Hantar" and the score display are INFERRED / PROPOSED (L-3)',
    ),
    async ({ page, gotoApp, loginAs, mock }) => {
      await serveAudioFixture(page)
      await loginAs(ADMIN)
      await seedAndSwitch(page, mock, gotoApp)

      await expect(page.getByTestId('audio-set')).toHaveCount(1)
      await expect(page.getByTestId('set-title')).toHaveText('BM T4 Ujian Mendengar Set 1')
      await expect(page.getByTestId('set-level')).toHaveText('Tingkatan 4')
      await expect(page.getByTestId('set-subject')).toHaveText('Bahasa Melayu')
      await expectNoHorizontalScroll(page)

      // The filter narrows by subject: the approved set is BM, so Bahasa Inggeris is empty.
      await pickOption(page, 'filter-subject', 'Bahasa Inggeris')
      await page.getByTestId('audio-filter').getByRole('button', { name: 'Tapis', exact: true }).click()
      await expect(page.getByTestId('audio-empty')).toBeVisible()
      await pickOption(page, 'filter-subject', 'Semua Subjek')
      await page.getByTestId('audio-filter').getByRole('button', { name: 'Tapis', exact: true }).click()
      await expect(page.getByTestId('audio-set')).toHaveCount(1)

      await expectTouchTarget(page.getByTestId('set-link'))
      await page.getByTestId('set-link').click()
      await expect(page).toHaveURL(/\/audio-kbat\/\d+$/)
      await expectTabTitle(page, 'Audio KBAT | PRESTASIPLUS')
      await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toHaveCount(0)
      await expect(page.getByTestId('player-title')).toHaveText('BM T4 Ujian Mendengar Set 1')

      const sections = page.getByTestId('audio-section')
      await expect(sections).toHaveCount(4)
      const counts: number[] = []
      for (let i = 0; i < 4; i++) {
        const s = sections.nth(i)
        // The V3 theme uses DsAudioPlayer (hidden <audio> + custom controls), not native controls (D28-D32).
        await expect(s.locator('audio')).toHaveCount(1)
        await expect(s.locator('audio')).toHaveAttribute(
          'src',
          new RegExp('/storage/audio-kbat/\\d+/audio\\.mp3$'),
        )
        await expect(s.getByRole('button', { name: 'Main' })).toBeVisible()
        counts.push(await s.getByTestId('audio-question').count())
        // V3 URadioGroup renders role=radio buttons (4 per question), not native inputs.
        expect(await s.getByRole('radio').count()).toBe(counts[i]! * 4)
      }
      expect(counts).toEqual([8, 8, 8, 6])

      // The DS play control toggles play and pause.
      const first = sections.first()
      await first.getByRole('button', { name: 'Main' }).click()
      await expect(first.getByRole('button', { name: 'Jeda' })).toBeVisible()
      await first.getByRole('button', { name: 'Jeda' }).click()
      await expect(first.getByRole('button', { name: 'Main' })).toBeVisible()
      await expect(page.getByTestId('player-submit')).toHaveText('Hantar')
      await expectTouchTarget(page.getByTestId('player-submit'))
      await expectNoHorizontalScroll(page)

      for (let n = 1; n <= 30; n++) {
        await page.getByTestId(`q${String(n)}`).getByRole('radio', { name: /^A\. / }).click()
      }
      await page.getByTestId('player-submit').click()
      await expect(page.getByTestId('player-result')).toBeVisible()
      await expect(page.getByTestId('result-score')).toHaveText('30')
      await expect(page.getByTestId('result-total')).toHaveText('30')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #46 a section whose audio file is missing shows the audioFailed alert @m09',
    provisional('the player and its audioFailed copy are INFERRED (L-3)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      // No fixture here: the mock URL answers the SPA index (200 text/html), which the browser cannot decode.
      await loginAs(ADMIN)
      await seedAndSwitch(page, mock, gotoApp)
      await spaGo(page, '/audio-kbat/1')
      const first = page.getByTestId('audio-section').first()
      await expect(first.getByTestId('section-audio-error')).toBeVisible()
      await expect(first).toContainText('Fail audio tidak dapat dimuatkan.')
      await expect(first.getByRole('button', { name: 'Cuba Semula' })).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'SRS §12 #46 a draft set and an unknown id show the standalone 404 page @m09',
    provisional('the player route and its 404 copy are INFERRED (L-3)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await seedAndSwitch(page, mock, gotoApp)
      // The draft set is id 2 (created second): students never see it.
      await spaGo(page, '/audio-kbat/2')
      await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
      await expect(page.getByTestId('player-form')).toHaveCount(0)
      await spaGo(page, '/audio-kbat/999')
      await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )
})
