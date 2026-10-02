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
  await page.getByTestId('audio-submit').click()
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
    await expectTabTitle(page, 'Audio KBAT')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Audio KBAT')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveCount(0)
    const headerBlock = page.getByTestId('shell-user-title').locator('..')
    await expect(headerBlock).not.toContainText('Dashboard')
    await expect(headerBlock).not.toContainText('Selamat datang kembali')

    const intro = page.getByTestId('audio-intro')
    await expect(intro).toHaveClass(/text-white/)
    expect(await intro.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('gradient')
    await expect(intro.getByText('Ujian Mendengar')).toBeVisible()
    const h1 = intro.locator('h1')
    await expect(h1).toHaveText('Audio KBAT')
    await expect(h1).toHaveCSS('color', 'rgb(255, 255, 255)')
    const p = intro.locator('p')
    await expect(p).toContainText(
      'Dengar audio mengikut bahagian dan jawab soalan yang dipaparkan serentak.',
    )
    await expect(p).toHaveCSS('color', /rgb\(254, 243, 199\)|oklch\(0\.962/)

    const levels = await page
      .getByTestId('filter-level')
      .evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.text.trim()))
    expect(levels).toHaveLength(12)
    expect(levels[0]).toBe('Semua Tahap')
    const subjects = await page
      .getByTestId('filter-subject')
      .evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.text.trim()))
    expect(subjects).toHaveLength(32)
    expect(subjects.slice(0, 4)).toEqual([
      'Semua Subjek',
      'Bahasa Arab',
      'Bahasa Cina',
      'Bahasa Inggeris',
    ])

    const submit = page.getByTestId('filter-submit')
    await expect(submit).toHaveText('Tapis')
    await expect(submit).toHaveCSS('color', 'rgb(255, 255, 255)')
    const bg = await submit.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg).not.toBe('rgb(255, 255, 255)')
    await expectTouchTarget(submit)

    await expect(page.getByTestId('audio-empty')).toHaveText(
      'Belum ada set Audio KBAT yang approved.',
    )
    await page.getByTestId('filter-level').selectOption({ label: 'Tingkatan 4' })
    await page.getByTestId('filter-subject').selectOption({ label: 'Bahasa Melayu' })
    await submit.click()
    await expect(page).toHaveURL(/\/audio-kbat\?education_level_id=10&subject_id=\d+$/)
    await expect(page.getByTestId('audio-empty')).toBeVisible()
    expect(
      await page
        .getByTestId('filter-level')
        .evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.text.trim()),
    ).toBe('Tingkatan 4')
    expect(
      await page
        .getByTestId('filter-subject')
        .evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.text.trim()),
    ).toBe('Bahasa Melayu')
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #45 the admin sees S21 in the user shell @m09', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/audio-kbat')
    await expect(page.getByTestId('audio-kbat-page')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('shell-user-title')).toHaveText('Audio KBAT')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveCount(0)
    await expect(page.getByTestId('shell-admin-title')).toHaveCount(0)
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
      await loginAs(ADMIN)
      await seedAndSwitch(page, mock, gotoApp)

      await expect(page.getByTestId('audio-set')).toHaveCount(1)
      await expect(page.getByTestId('set-title')).toHaveText('BM T4 Ujian Mendengar Set 1')
      await expect(page.getByTestId('set-level')).toHaveText('Tingkatan 4')
      await expect(page.getByTestId('set-subject')).toHaveText('Bahasa Melayu')
      await expectNoHorizontalScroll(page)

      // The filter narrows by subject: the approved set is BM, so Bahasa Inggeris is empty.
      await page.getByTestId('filter-subject').selectOption({ label: 'Bahasa Inggeris' })
      await page.getByTestId('filter-submit').click()
      await expect(page.getByTestId('audio-empty')).toBeVisible()
      await page.getByTestId('filter-subject').selectOption({ label: 'Semua Subjek' })
      await page.getByTestId('filter-submit').click()
      await expect(page.getByTestId('audio-set')).toHaveCount(1)

      await expectTouchTarget(page.getByTestId('set-link'))
      await page.getByTestId('set-link').click()
      await expect(page).toHaveURL(/\/audio-kbat\/\d+$/)
      await expectTabTitle(page, 'Audio KBAT')
      await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toHaveCount(0)
      await expect(page.getByTestId('player-title')).toHaveText('BM T4 Ujian Mendengar Set 1')

      const sections = page.getByTestId('audio-section')
      await expect(sections).toHaveCount(4)
      const counts: number[] = []
      for (let i = 0; i < 4; i++) {
        const s = sections.nth(i)
        await expect(s.locator('audio')).toHaveCount(1)
        await expect(s.locator('audio')).toHaveAttribute('controls', '')
        counts.push(await s.getByTestId('audio-question').count())
        expect(await s.locator('input[type=radio]').count()).toBe(counts[i]! * 4)
      }
      expect(counts).toEqual([8, 8, 8, 6])
      await expect(page.getByTestId('player-submit')).toHaveText('Hantar')
      await expectTouchTarget(page.getByTestId('player-submit'))
      await expectNoHorizontalScroll(page)

      for (let n = 1; n <= 30; n++) {
        await page.getByTestId(`q${String(n)}-A`).check()
      }
      await page.getByTestId('player-submit').click()
      await expect(page.getByTestId('player-result')).toBeVisible()
      await expect(page.getByTestId('result-score')).toHaveText('30')
      await expect(page.getByTestId('result-total')).toHaveText('30')
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
