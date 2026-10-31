/**
 * M05-T7 developer smoke (build-plan M05-T7; QA writes the E2E-M05-nn ids at G5): S13 `/remedial/saya`
 * "Ujian Remedial Saya", S14 `/misi-harian`, S15 `/target-spm`, and the teacher-assigned quiz runs Q4
 * `/remedial/:id`, Q5 `/misi-harian/:id` at 375 / 768 / 1280. Canonical accounts have no remedial test
 * and no mission today (empty states, FR-M05-115/116); the populated lists use the M10 designed data:
 * remedial 7601 (active, pupil 3008) and 7602 (completed, pupil 3007), mission 7101 (dated 22/09/2026; mission 7102, dated 24/09/2026, answers 422 "Soalan tidak mencukupi." from the mock pool rule).
 * Populated lists, Q4/Q5 and the S15 progress rows are provisional (LS-10, LS-12).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { addInitSession } from '../fixtures/mock-page'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const PELAJAR = 'pelajar@demo.test'
const ADMIN = 'admin@demo.test'
const NOT_FOUND = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

const tid = (page: Page, id: string) => page.getByTestId(id)

// Several full page loads and quiz runs per test: give the shared build server room when workers compete.
test.describe.configure({ timeout: 120_000 })

/** Picks "A", checks and goes on from question `from` through `count` (the last "next" shows the results). */
async function answerAll(page: Page, count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    await expect(tid(page, 'quiz-progress-text')).toHaveText(`Soalan ${i} daripada ${count}`)
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    await expect(tid(page, 'quiz-feedback')).toBeVisible()
    await tid(page, 'btn-next').click()
  }
}

test.describe('M05 S13 / S14 / S15 smoke', { tag: [TAG.smoke, moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('S13 empty state for a canonical pupil', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/remedial/saya')
    await expectTabTitle(page, 'Ujian Remedial Saya')
    // DV-M05-01: the shell header is the page title with no subtitle.
    await expect(tid(page, 'shell-user-title')).toHaveText('Ujian Remedial Saya')
    await expect(tid(page, 'remedial-h1')).toHaveText('Ujian Remedial Saya')
    await expect(page.getByText('Ujian khas untuk topik yang perlu diperbaiki')).toBeVisible()
    await expect(tid(page, 'remedial-empty')).toContainText(
      'Tiada ujian remedial. Bagus — teruskan usaha!',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S14 empty state for a canonical pupil', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/misi-harian')
    await expectTabTitle(page, 'Misi Harian — PrestasiPlus')
    await expect(tid(page, 'shell-user-title')).toHaveText('Misi Harian')
    await expect(tid(page, 'missions-empty')).toContainText('Tiada misi hari ini')
    await expect(tid(page, 'missions-empty')).toContainText(
      'Misi baru akan muncul bila guru anda assign.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S15 lists the 20 SPM subjects as "Belum mula" and saves the targets', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/target-spm')
    await expectTabTitle(page, 'Target SPM Saya — PrestasiPlus')
    await expect(tid(page, 'shell-user-title')).toHaveText('Target SPM Saya')
    const rows = page.locator('[data-testid^=target-row-]')
    await expect(rows).toHaveCount(20)
    await expect(page.locator('[data-testid=target-status]').first()).toHaveText('Belum mula')
    await expect(page.locator('[data-testid=target-predicted]').first()).toHaveText('-')
    await expect(page.locator('[data-testid=target-select] option')).toHaveCount(20 * 10)
    await expect(tid(page, 'targets-legend')).toContainText('70%+ Ketepatan (On Track)')
    await expectNoHorizontalScroll(page)

    // Mobile: the track sits on its own full-width line (DV-M05-12); wider: one line.
    const first = rows.first()
    const track = first.getByTestId('target-track')
    const trackBox = await track.boundingBox()
    const rowBox = await first.boundingBox()
    if (!trackBox || !rowBox) throw new Error('S15 row not measurable')
    if (isMobileWidth(page)) expect(trackBox.width).toBeGreaterThan(rowBox.width * 0.8)
    else expect(trackBox.width).toBeGreaterThan(100)
    await expectTouchTarget(first.getByTestId('target-select'))
    await expectTouchTarget(tid(page, 'targets-save'))

    await first.getByTestId('target-select').selectOption('A+')
    await tid(page, 'targets-save').click()
    await expect(tid(page, 'targets-success')).toContainText('Target berjaya disimpan.')
    await expect(first.getByTestId('target-select')).toHaveValue('A+')
  })

  test('S15 keeps the choices and shows the error flash when saving fails', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/target-spm')
    const select = page.locator('[data-testid=target-select]').nth(3)
    await select.selectOption('C')
    await mock.failNext('/api/spm-targets', { status: 500, message: 'x' })
    await tid(page, 'targets-save').click()
    await expect(tid(page, 'targets-failure')).toContainText(
      'Gagal menyimpan target. Sila cuba lagi.',
    )
    await expect(select).toHaveValue('C')
  })

  test(
    'S15 shows the progress rows set by the test fixture',
    provisional('LS-10: the live source of SPM progress is unverified (BR-27)'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/target-spm')
      await mock.hook('setSpmProgress', 2, 1, { answered: 12, correct: 9 })
      await gotoApp('/target-spm')
      const row = tid(page, 'target-row-1')
      await expect(row.getByTestId('target-status')).toHaveText('12 soalan · 75%')
      await expect(row.getByTestId('target-predicted')).toHaveText('A-')
      await expect(row.getByTestId('target-bar')).toHaveAttribute('style', /width: 75%/)
    },
  )

  test('a guest is sent to /login from S13', async ({ page, gotoApp }) => {
    await gotoApp('/remedial/saya')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unknown or malformed Q4 / Q5 ids are the 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/remedial/99999')
    await expectTabTitle(page, NOT_FOUND)
    await gotoApp('/remedial/abc')
    await expectTabTitle(page, NOT_FOUND)
    await gotoApp('/misi-harian/99999')
    await expectTabTitle(page, NOT_FOUND)
  })
})

test.describe(
  'M05 S13 / Q4 remedial tests (M10 designed data)',
  { tag: [TAG.smoke, moduleTag(5), TAG.provisional] },
  () => {
    test.use({ mockInit: { latency: 0 } })

    test(
      'pupil 3008 sees test 7601, runs it and it turns "Selesai"',
      provisional('LS-12: the live remedial list and run were never observed'),
      async ({ page, gotoApp }) => {
        await addInitSession(page, 'murid3008@demo.test')
        await gotoApp('/remedial/saya')
        const card = tid(page, 'remedial-card-7601')
        await expect(card).toBeVisible()
        await expect(card.getByTestId('remedial-status')).toHaveText('Aktif')
        await expect(card.getByTestId('remedial-count')).toContainText('soalan')
        await expect(card.getByTestId('remedial-meta')).toContainText('Daripada: ')
        await expectTouchTarget(card.getByTestId('remedial-start'))
        await expectNoHorizontalScroll(page)

        const total = Number(
          (await card.getByTestId('remedial-count').innerText()).match(/\d+/)?.[0],
        )
        await card.getByTestId('remedial-start').click()
        await expect(page).toHaveURL(/\/remedial\/7601$/)
        await expectTabTitle(page, 'Ujian Remedial Saya')
        await expect(tid(page, 'quiz-title')).toContainText('Ujian Remedial — ')
        await expectNoHorizontalScroll(page)
        await answerAll(page, total)
        await expect(tid(page, 'result-back')).toHaveAttribute('href', '/remedial/saya')
        await expectNoHorizontalScroll(page)

        await tid(page, 'result-back').click()
        await expect(page).toHaveURL(/\/remedial\/saya$/)
        await expect(tid(page, 'remedial-card-7601').getByTestId('remedial-status')).toHaveText(
          'Selesai',
        )
        await expect(tid(page, 'remedial-card-7601').getByTestId('remedial-start')).toHaveCount(0)
      },
    )

    test(
      'pupil 3007 sees the completed test 7602; opening it is refused with the server message',
      provisional('LS-12: the live remedial list and run were never observed'),
      async ({ page, gotoApp }) => {
        await addInitSession(page, 'murid3007@demo.test')
        await gotoApp('/remedial/saya')
        const card = tid(page, 'remedial-card-7602')
        await expect(card.getByTestId('remedial-status')).toHaveText('Selesai')
        await expect(card.getByTestId('remedial-start')).toHaveCount(0)

        const dialog = acceptNextDialog(page, {
          type: 'alert',
          message: 'Ujian ini sudah selesai.',
        })
        await gotoApp('/remedial/7602')
        await dialog
        await expect(page).toHaveURL(/\/remedial\/saya$/)
      },
    )

    test(
      'the test teacher and an admin get the read-only preview of 7601 (nothing is recorded)',
      provisional('LS-12: the Q4 preview is PROPOSED (XL2-40)'),
      async ({ page, loginAs, gotoApp, mock }) => {
        await loginAs('guru@demo.test')
        await gotoApp('/remedial/7601')
        await expect(tid(page, 'preview-banner')).toHaveText(
          'Pratonton — jawapan tidak direkodkan.',
        )
        await expect(tid(page, 'preview-title')).toContainText('Ujian Remedial — ')
        await expect(page.locator('[data-testid=preview-q-1] [data-correct=true]')).toHaveCount(1)
        await expect(page.getByTestId('btn-check')).toHaveCount(0)
        await expectNoHorizontalScroll(page)
        expect(await mock.requests('/api/practice/sessions')).toHaveLength(0)
      },
    )

    test(
      'an admin also gets the preview',
      provisional('LS-12: the Q4 preview is PROPOSED (XL2-40)'),
      async ({ page, loginAs, gotoApp }) => {
        await loginAs(ADMIN)
        await gotoApp('/remedial/7601')
        await expect(tid(page, 'preview-banner')).toBeVisible()
      },
    )

    test(
      'another pupil cannot open test 7601 (404 page)',
      provisional('LS-12: access rule of BR-32 is unobserved'),
      async ({ page, loginAs, gotoApp }) => {
        await loginAs(PELAJAR)
        await gotoApp('/remedial/7601')
        await expectTabTitle(page, NOT_FOUND)
      },
    )
  },
)

test.describe(
  'M05 S14 / Q5 missions (M10 designed data)',
  { tag: [TAG.smoke, moduleTag(5), TAG.provisional] },
  () => {
    // 22/09/2026: the date of mission 7101 (subject 10, "Latih Tubi SPM", teacher 5, recipients = classes 2001 / 2002).
    test.use({ mockInit: { latency: 0, now: '2026-09-22T10:00:00+08:00' } })

    test(
      'pupil 3001 sees the mission, runs it and it turns "Selesai ✓"',
      provisional('LS-12: the live mission cards and run were never observed'),
      async ({ page, gotoApp }) => {
        await addInitSession(page, 'murid3001@demo.test')
        await gotoApp('/misi-harian')
        const card = tid(page, 'mission-card-7101')
        await expect(card).toBeVisible()
        await expect(card.getByTestId('mission-title')).toHaveText('Misi Harian 22/09/2026')
        await expect(card.getByTestId('mission-type')).toHaveText('Latih Tubi SPM')
        await expect(card.getByTestId('mission-info')).toContainText(
          '10 soalan · 3 syiling per jawapan betul',
        )
        await expectTouchTarget(card.getByTestId('mission-start'))
        await expectNoHorizontalScroll(page)

        await card.getByTestId('mission-start').click()
        await expect(page).toHaveURL(/\/misi-harian\/7101$/)
        await expectTabTitle(page, 'Misi Harian — PrestasiPlus')
        await expect(tid(page, 'quiz-title')).toHaveText('Misi Harian 22/09/2026')
        await answerAll(page, 10)
        await expect(tid(page, 'result-back')).toHaveAttribute('href', '/misi-harian')
        await expectNoHorizontalScroll(page)

        await tid(page, 'result-back').click()
        await expect(tid(page, 'mission-card-7101').getByTestId('mission-done')).toHaveText(
          'Selesai ✓',
        )
        await expect(tid(page, 'mission-card-7101').getByTestId('mission-start')).toHaveCount(0)

        // A finished mission cannot be started again: the server message, then back to S14.
        const dialog = acceptNextDialog(page, {
          type: 'alert',
          message: 'Misi ini sudah diselesaikan.',
        })
        await gotoApp('/misi-harian/7101')
        await dialog
        await expect(page).toHaveURL(/\/misi-harian$/)
      },
    )
  },
)
