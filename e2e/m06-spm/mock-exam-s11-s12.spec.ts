/**
 * M06-T4 E2E: S11 `/spm-mock`, Q4 `/spm-mock/:id` (provisional, L-8) and S12 `/spm-mock/:id/result`
 * (SRS M06 v1.4 §12: E2E-M06-29, -30, -31, -32, -33, -34, -38 and the S11/S12 parts of -40). Every test
 * runs on the mobile 375, tablet 768 and desktop 1280 projects. -31 and -32 are `@provisional` (L-8).
 */

import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { open } from './mock-exam-nav'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  moduleTag,
  navigateInApp,
  provisional,
  SM_MIN_WIDTH,
  viewportWidth,
} from '../support'

const PELAJAR = 'pelajar@demo.test'
const ADMIN = 'admin@demo.test'
const tid = (page: Page, id: string) => page.getByTestId(id)

test.use({ mockInit: { latency: 0 } })

test.describe('M06 S11 mock exam form and list', { tag: [moduleTag(6)] }, () => {
  test('E2E-M06-29 hero, Duta block, warning, form, no request without a subject', async ({
    page,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/spm-mock')
    await expectTabTitle(page, 'SPM Mock Exam')
    await expect(tid(page, 'shell-user-title')).toHaveText('SPM Mock Exam')
    await expect(tid(page, 'mock-hero')).toContainText('📝 SPM Mock Exam')
    await expect(tid(page, 'mock-hero')).toContainText(
      'Mock SPM penuh dengan timer + auto-grade + weakness analysis. Boleh attempt setiap bulan.',
    )
    await expect(tid(page, 'duta-title')).toHaveText('⭐ Maestro SPM Untuk Anda')
    await expect(tid(page, 'duta-text')).toHaveText(
      'Cikgu pakar yg dah bantu pelajar score A+ — tonton video mereka sebelum mula mock.',
    )
    await expect(page.getByTestId('duta-card')).toHaveCount(1)
    await expect(tid(page, 'mock-warning')).toContainText('Persediaan sebelum mula:')
    await expect(tid(page, 'mock-warning').locator('b')).toHaveText('Persediaan sebelum mula:')
    await expect(tid(page, 'mock-warning')).toContainText(
      'Setelah klik "Mula", timer akan jalan dan tak boleh stop. Kalau pause, score akan jejas.',
    )

    const options = tid(page, 'mock-subject').locator('option')
    await expect(options).toHaveText([
      'Pilih subjek',
      'Bahasa Melayu',
      'English',
      'Matematik',
      'Matematik Tambahan',
      'Fizik',
      'Kimia',
      'Biologi',
      'Sains',
      'Sejarah',
      'Pendidikan Islam',
    ])
    await expect(tid(page, 'mock-subject')).toHaveAttribute('required', '')
    await expect(tid(page, 'mock-paper')).toHaveAttribute('required', '')
    await expect(tid(page, 'mock-paper').locator('option')).toHaveText([
      'Paper 1 (Objektif)',
      'Paper 2 (Esei/Struktur)',
    ])
    await expect(tid(page, 'mock-paper')).toHaveValue('1')
    await expect(tid(page, 'mock-generate')).toHaveText('🎯 Jana Mock SPM')
    await expect(page.locator('label[for=mock-subject]')).toHaveText('Subjek')
    await expect(page.locator('label[for=mock-subject]')).toHaveCSS('text-transform', 'uppercase')

    await tid(page, 'mock-generate').click()
    expect(await tid(page, 'mock-form').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(
      false,
    )
    expect(await mock.requests('POST /api/spm-mocks')).toHaveLength(0)
    await expect(page).toHaveURL(/\/spm-mock$/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-30 admin rows 317 and 16; student chip colours', async ({ page, loginAs }) => {
    await loginAs(ADMIN)
    await open(page, '/spm-mock')
    await expect(tid(page, 'shell-admin-title')).toHaveText('SPM Mock Exam')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveCount(0)
    await expect(page.locator('li[data-testid^=mock-row-]')).toHaveCount(2)
    const pending = tid(page, 'mock-row-317')
    await expect(pending.getByTestId('mock-row-title')).toHaveText('Sejarah · Paper 1')
    await expect(pending.getByTestId('mock-row-meta')).toHaveText(
      '2 bulan yang lepas · Belum submit',
    )
    await expect(pending.getByTestId('mock-row-grade')).toHaveText('Belum')
    await expect(pending.getByTestId('mock-row-grade')).toHaveCSS('font-size', '13.6px')
    await expect(pending.getByTestId('mock-row-link')).toHaveText('Sambung →')
    await expect(pending.getByTestId('mock-row-link')).toHaveAttribute('href', '/spm-mock/317')
    const done = tid(page, 'mock-row-16')
    await expect(done.getByTestId('mock-row-title')).toHaveText('Bahasa Melayu · Paper 1')
    await expect(done.getByTestId('mock-row-meta')).toHaveText(
      '4 bulan yang lepas · Score: 0/30 (0.00%)',
    )
    await expect(done.getByTestId('mock-row-grade')).toHaveText('G')
    await expect(done.getByTestId('mock-row-link')).toHaveText('Lihat →')
    await expect(done.getByTestId('mock-row-link')).toHaveAttribute('href', '/spm-mock/16/result')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-30 (student) chip colours A+/A emerald, B+/B blue, C amber, D/E/G red', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/spm-mock')
    const grade = (id: number) => tid(page, `mock-row-${String(id)}`).getByTestId('mock-row-grade')
    const expected: [number, string, RegExp][] = [
      [318, 'A+', /emerald/],
      [319, 'A', /emerald/],
      [320, 'B+', /blue/],
      [321, 'B', /blue/],
      [322, 'C', /amber/],
      [323, 'D', /red/],
      [324, 'E', /red/],
      [325, 'G', /red/],
    ]
    for (const [id, text, colour] of expected) {
      await expect(grade(id)).toHaveText(text)
      await expect(grade(id)).toHaveClass(colour)
    }
    await expect(grade(327)).toHaveText('Belum')
    await expect(grade(327)).toHaveClass(/slate/)
    // Newest first.
    const ids = await page
      .locator('li[data-testid^=mock-row-]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
    expect(ids[0]).toBe('mock-row-327')
    expect(ids).toHaveLength(10)
  })

  test('E2E-M06-40 (S11) fields stacked below 640 px, chip and link on their own line', async ({
    page,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await open(page, '/spm-mock')
    const subject = await tid(page, 'mock-subject').boundingBox()
    const paper = await tid(page, 'mock-paper').boundingBox()
    expect(subject && paper).toBeTruthy()
    const row = tid(page, 'mock-row-317')
    const chip = await row.getByTestId('mock-row-grade').boundingBox()
    const link = await row.getByTestId('mock-row-link').boundingBox()
    const title = await row.getByTestId('mock-row-title').boundingBox()
    expect(chip && link && title).toBeTruthy()
    // The chip and the link never overlap.
    const overlap =
      chip!.x < link!.x + link!.width &&
      link!.x < chip!.x + chip!.width &&
      chip!.y < link!.y + link!.height &&
      link!.y < chip!.y + chip!.height
    expect(overlap).toBe(false)
    if (viewportWidth(page) < SM_MIN_WIDTH) {
      expect(paper!.y).toBeGreaterThan(subject!.y + subject!.height - 1)
      expect(Math.abs(paper!.x - subject!.x)).toBeLessThan(2)
      expect(chip!.y).toBeGreaterThan(title!.y + title!.height - 1)
      // "Paper 1 (Objektif)" is shown in full.
      const clipped = await tid(page, 'mock-paper').evaluate(
        (el: HTMLSelectElement) => el.scrollWidth > el.clientWidth + 1,
      )
      expect(clipped).toBe(false)
    } else {
      expect(paper!.y).toBeLessThan(subject!.y + subject!.height)
      expect(paper!.x).toBeGreaterThan(subject!.x)
      expect(Math.abs(chip!.y - title!.y)).toBeLessThan(title!.height + 12)
    }
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M06 Q4 in-exam placeholder (provisional, L-8)', { tag: [moduleTag(6)] }, () => {
  test(
    'E2E-M06-31 generate Matematik Paper 1: placeholder with timer, in progress on S11, resumable',
    provisional('L-8: Q4 in-exam UI is UNVERIFIED (URS OQ-M06-05)'),
    async ({ page, loginAs }) => {
      await loginAs(PELAJAR)
      await open(page, '/spm-mock')
      await tid(page, 'mock-subject').selectOption('Matematik')
      await tid(page, 'mock-generate').click()
      await expect(page).toHaveURL(/\/spm-mock\/\d+$/)
      const url = new URL(page.url()).pathname
      await expect(tid(page, 'run-title')).toHaveText('Matematik · Paper 1')
      await expectTabTitle(page, 'SPM Mock Exam')
      await expect(tid(page, 'mock-timer')).toBeVisible()
      await expect(page.getByRole('button', { name: /pause|jeda|henti/i })).toHaveCount(0)
      await expect(page.locator('[data-testid^=run-item-]').first()).toBeVisible()
      await expect(page.getByTestId('run-option').first()).toBeVisible()
      await expect(tid(page, 'run-submit')).toBeVisible()
      await expectNoHorizontalScroll(page)

      await open(page, '/spm-mock')
      const id = url.split('/').pop()!
      const row = tid(page, `mock-row-${id}`)
      await expect(row.getByTestId('mock-row-meta')).toContainText('Belum submit')
      await expect(row.getByTestId('mock-row-link')).toHaveText('Sambung →')
      await row.getByTestId('mock-row-link').click()
      await expect(page).toHaveURL(new RegExp(`${url}$`))
      await expect(tid(page, 'run-title')).toHaveText('Matematik · Paper 1')
    },
  )

  test(
    'E2E-M06-32 submit Paper 1 and Paper 2: result, S11 row, marks and feedback per item',
    provisional('L-8: Q4 in-exam UI is UNVERIFIED (URS OQ-M06-05)'),
    async ({ page, loginAs }) => {
      await loginAs(PELAJAR)
      await open(page, '/spm-mock')
      await tid(page, 'mock-subject').selectOption('Matematik')
      await tid(page, 'mock-generate').click()
      await expect(tid(page, 'run-title')).toBeVisible()
      const id = new URL(page.url()).pathname.split('/').pop()!
      await page.getByTestId('run-option').first().check()
      await tid(page, 'run-submit').click()
      await expect(page).toHaveURL(new RegExp(`/spm-mock/${id}/result$`))
      await expect(tid(page, 'result-title')).toHaveText('Matematik · Paper 1')
      await expect(tid(page, 'result-grade')).toHaveText(/^(A\+|A|B\+|B|C|D|E|G)$/)
      await expect(tid(page, 'result-hero')).toHaveAttribute('data-hero', /^(good|mid|bad)$/)

      await open(page, '/spm-mock')
      const row = tid(page, `mock-row-${id}`)
      await expect(row.getByTestId('mock-row-meta')).toContainText(/Score: \d+\/30 \(\d+\.\d{2}%\)/)
      await expect(row.getByTestId('mock-row-grade')).toHaveText(/^(A\+|A|B\+|B|C|D|E|G)$/)
      await expect(row.getByTestId('mock-row-link')).toHaveText('Lihat →')

      // Paper 2.
      await tid(page, 'mock-subject').selectOption('Sejarah')
      await tid(page, 'mock-paper').selectOption('2')
      await tid(page, 'mock-generate').click()
      await expect(tid(page, 'run-title')).toHaveText('Sejarah · Paper 2')
      const boxes = page.getByTestId('run-answer')
      const n = await boxes.count()
      expect(n).toBeGreaterThan(0)
      await boxes.first().fill(Array(70).fill('huraian').join(' '))
      await tid(page, 'run-submit').click()
      await expect(tid(page, 'result-title')).toHaveText('Sejarah · Paper 2')
      await expect(page.locator('[data-testid^=review-item-]')).toHaveCount(n)
      await expect(page.getByTestId('review-header').first()).toContainText('/10 markah')
      await expect(page.getByTestId('review-feedback').first()).toContainText(
        'Jawapan anda merangkumi 10 daripada 10 markah',
      )
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M06 S12 mock result', { tag: [moduleTag(6)] }, () => {
  test('E2E-M06-33 admin mock 16: red hero, Duta block, weak topics, tip, 30 review items, actions', async ({
    page,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await open(page, '/spm-mock/16/result')
    await expectTabTitle(page, 'Result Mock SPM — Bahasa Melayu')
    await expect(tid(page, 'shell-admin-title')).toHaveText('Result Mock SPM — Bahasa Melayu')
    const hero = tid(page, 'result-hero')
    await expect(hero).toHaveAttribute('data-hero', 'bad')
    await expect(hero).toHaveClass(/red/)
    await expect(tid(page, 'result-title')).toHaveText('Bahasa Melayu · Paper 1')
    await expect(tid(page, 'result-grade')).toHaveText('G')
    await expect(tid(page, 'result-percent')).toHaveText('0.00%')
    await expect(tid(page, 'result-score')).toHaveText('0 / 30 markah')
    await expect(tid(page, 'duta-title')).toHaveText('🎓 Cikgu Pakar Bahasa Melayu')
    await expect(tid(page, 'duta-text')).toHaveText(
      'Lemah dlm topik tertentu? Cikgu pakar ni boleh bantu anda naik ke A+ next round.',
    )
    await expect(tid(page, 'duta-card')).toContainText('Bahasa Melayu')
    await expect(
      page.getByRole('heading', { name: '📉 Topik Lemah — Fokus Belajar Ke Sini' }),
    ).toBeVisible()
    await expect(page.getByTestId('weak-topic').first()).toHaveText('Sastra')
    const counts = await page
      .getByTestId('weak-count')
      .allTextContents()
      .then((a) => a.map((s) => Number(s.split(' ')[0])))
    expect(counts.reduce((a, b) => a + b, 0)).toBe(30)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
    await expect(tid(page, 'result-tip')).toContainText(
      '💡 Cikgu Alesa cadang anda fokus belajar topik atas dulu. Boleh start dengan jana nota ringkas untuk topik tersebut.',
    )
    await expect(tid(page, 'result-tip').getByRole('link')).toHaveAttribute(
      'href',
      '/pusat-nota-ringkas',
    )
    await expect(page.getByRole('heading', { name: '📋 Review Setiap Soalan' })).toBeVisible()
    await expect(page.locator('[data-testid^=review-item-]')).toHaveCount(30)
    const first = tid(page, 'review-item-1')
    await expect(first.getByTestId('review-header')).toHaveText('✗ SOALAN 1 · 0/1 MARKAH', {
      useInnerText: true,
    })
    await expect(first.getByTestId('review-text')).toHaveText(
      "Apakah maksud perkataan 'inovatif' dalam konteks sains dan teknologi?",
    )
    await expect(first.getByTestId('review-answer')).toHaveText('Anda: (tiada jawapan)')
    await expect(first.getByTestId('review-key')).toHaveText('Jawapan: A')
    await expect(first.getByTestId('review-feedback')).toHaveText(
      /^Jawapan (betul: |yang betul ialah )A\.?$/,
    )
    await expect(first.getByTestId('review-feedback')).toHaveCSS('font-style', 'italic')
    const actions = tid(page, 'result-actions').getByRole('link')
    await expect(actions).toHaveText(['📝 Mock Lain', '📚 Belajar Topik Lemah'])
    await expect(actions.nth(0)).toHaveAttribute('href', '/spm-mock')
    await expect(actions.nth(1)).toHaveAttribute('href', '/pusat-nota-ringkas')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-34 student: A+ green hero, C yellow hero, a correct item shows a tick', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/spm-mock/318/result')
    await expect(tid(page, 'result-grade')).toHaveText('A+')
    await expect(tid(page, 'result-hero')).toHaveAttribute('data-hero', 'good')
    await expect(tid(page, 'result-hero')).toHaveClass(/emerald/)
    const correct = page.locator('.q-review.correct').first()
    await expect(correct.getByTestId('review-header')).toContainText('✓')
    await expect(correct).toHaveClass(/emerald/)
    await expect(page.locator('.q-review.wrong').first()).toHaveClass(/red/)

    await open(page, '/spm-mock/322/result')
    await expect(tid(page, 'result-grade')).toHaveText('C')
    await expect(tid(page, 'result-hero')).toHaveAttribute('data-hero', 'mid')
    await expect(tid(page, 'result-hero')).toHaveClass(/amber/)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-38 Duta card has all fields and a link; bintang only; seeds differ; S12 subject-matched', async ({
    page,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/spm-mock')
    const card = tid(page, 'duta-card')
    await expect(card.getByTestId('duta-initials')).not.toBeEmpty()
    await expect(card.getByTestId('duta-name')).not.toBeEmpty()
    await expect(card.getByTestId('duta-tagline')).not.toBeEmpty()
    const pills = card.getByTestId('duta-pills')
    await expect(pills).toContainText('🥇 Duta Bintang')
    await expect(pills).toContainText('📚')
    await expect(pills).toContainText('📍')
    await expect(pills).toContainText(/⭐ \d\.\d{2}/)
    await expect(card).toHaveAttribute('href', /^\/bilik-duta\/.+/)
    const names = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      await mock.setRandomSeed(seed)
      await navigateInApp(page, '/pusat-ai/spm')
      await navigateInApp(page, '/spm-mock')
      await expect(tid(page, 'duta-card')).toBeVisible()
      names.add((await tid(page, 'duta-name').textContent()) ?? '')
    }
    expect(names.size).toBeGreaterThan(1)
    for (const n of names) expect(n).not.toMatch(/Inspirasi|Tetamu/)

    await open(page, '/spm-mock/318/result')
    await expect(tid(page, 'duta-card')).toContainText('📚 Matematik')
  })

  test('E2E-M06-40 (S12) single column, hero and actions fit', async ({ page, loginAs }) => {
    await loginAs(ADMIN)
    await open(page, '/spm-mock/16/result')
    const box = await tid(page, 'result-hero').boundingBox()
    expect(box!.width).toBeLessThanOrEqual(880 + 1)
    await expectNoHorizontalScroll(page)
  })
})
