/**
 * M04-T6a/b/c developer smoke (QA writes the E2E ids at G5): S7 admin report triage, S13 "Laporan Soalan
 * Saya" for the pelajar account 2, and the S14 `ReportQuestionModal` through the harness route
 * `/__e2e/report-modal` (no M05 / M06 host exists yet; SRS SQ-2), at 375 / 768 / 1280. The flash copy
 * and the S13 rows are UNVERIFIED / INFERRED (SRS §8, FR-M04-82), so the tests that assert them are
 * `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const S7 = '/admin/question-reports'
const S13 = '/laporan-soalan'
const HARNESS = '/__e2e/report-modal'

const card = (page: Page, id: number) => page.getByTestId(`report-card-${String(id)}`)
const tab = (page: Page, value: string) => page.getByTestId(`reports-tab-${value}`)

/** Waits for the open transition (scale-95 to 100) to end, so sizes are measured at rest. */
async function modalSettled(page: Page) {
  await expect
    .poll(() =>
      page.getByTestId('report-modal').evaluate((el) => {
        const t = getComputedStyle(el).transform
        const identity = t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'
        const running = (el.parentElement ?? el)
          .getAnimations({ subtree: true })
          .some((a) => a.playState === 'running')
        return identity && !running
      }),
    )
    .toBe(true)
}

async function openS7(page: Page, gotoApp: (path: string) => Promise<void>, query = '') {
  await gotoApp(`${S7}${query}`)
  await expect(page.getByTestId('reports-title')).toBeVisible()
  await expect(tab(page, 'pending')).toContainText('(')
}

test.describe('M04 S7 admin report triage', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, tabs with counts, the two pending cards and their actions', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openS7(page, gotoApp)
    await expectTabTitle(page, 'Laporan Soalan — Admin Panel')
    await expect(page.getByTestId('shell-admin-title')).toHaveText('Laporan Soalan')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveCount(0)
    await expect(page.getByTestId('reports-title')).toHaveText('Laporan Soalan')
    await expect(page.getByTestId('reports-subtitle')).toHaveText(
      'Soalan yang dilaporkan oleh pelajar dari kuiz, latihan & Papan Bijak',
    )
    await expect(tab(page, 'pending')).toHaveText('Menunggu (2)')
    await expect(tab(page, 'reviewed')).toHaveText('Disemak (3)')
    await expect(tab(page, 'fixed')).toHaveText('Diperbaiki (5)')
    await expect(tab(page, 'dismissed')).toHaveText('Ditolak (1)')
    await expect(tab(page, 'all')).toHaveText('Semua (11)')
    await expect(page.locator('[data-active=true]')).toHaveCount(1)
    await expect(tab(page, 'pending')).toHaveAttribute('data-active', 'true')
    await expectTouchTarget(tab(page, 'all'))

    await expect(page.locator('[data-card=report]')).toHaveCount(2)
    const ten = card(page, 10)
    await expect(ten.getByTestId('report-status')).toHaveText('Menunggu')
    await expect(ten.getByTestId('report-category')).toHaveText('Lain-lain')
    await expect(ten.getByTestId('report-source-set')).toHaveText('trial')
    await expect(ten.getByTestId('report-question-id')).toHaveText('ID Soalan: 3698')
    await expect(ten.getByTestId('report-question')).toContainText('Soalan Struktur #3698:')
    await expect(ten.getByTestId('report-comment')).toContainText('Lambat')
    await expect(ten.getByTestId('report-fix')).toHaveText('Tandakan Selesai')
    await expect(ten.getByTestId('report-dismiss')).toHaveText('Tolak & Aktifkan Semula')
    await expect(ten.getByTestId('report-question-link')).toHaveText('Lihat Soalan Struktur #3698')
    await expect(ten.getByTestId('report-open')).toHaveAttribute('target', '_blank')
    await expect(ten.getByTestId('report-open')).toHaveAttribute(
      'href',
      '/latihan-berstruktur/3698/jawab?scope=spm',
    )
    await expect(ten.getByTestId('report-deactivate')).toHaveText('Nyahaktif Segera')
    await expectTouchTarget(ten.getByTestId('report-fix'))
    await expectNoHorizontalScroll(page)
  })

  test('tabs filter the list; Semua shows all 11 with the DV-M04-08 labels; an unknown status is empty', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openS7(page, gotoApp)
    await tab(page, 'all').click()
    await expect(page).toHaveURL(/status=all/)
    await expect(page.locator('[data-card=report]')).toHaveCount(11)
    await expect(tab(page, 'all')).toHaveAttribute('data-active', 'true')

    const six = card(page, 6)
    await expect(six.getByTestId('report-status')).toHaveText('Disemak')
    await expect(six.getByTestId('report-category')).toHaveText('Tak Jelas')
    await expect(six.getByTestId('report-inactive')).toHaveText('Dinyahaktif')
    await expect(six.getByTestId('report-reason')).toHaveText('Soalan mengelirukan')
    await expect(six.getByTestId('report-room')).toHaveText('Bilik: Y31OBA')
    await expect(six.getByTestId('report-question-link')).toHaveText('Edit Soalan #136891')
    await expect(six.getByTestId('report-open')).toHaveAttribute(
      'href',
      '/spm/latih-tubi/MATH/quiz?question_id=136891&count=1',
    )
    await expect(six.getByTestId('report-deactivate')).toHaveCount(0)
    await expect(six.locator('[data-correct=true]')).toHaveCount(1)
    await expect(card(page, 4).getByTestId('report-reason')).toHaveText('Markah tidak adil')
    await expect(card(page, 3).getByTestId('report-reason')).toHaveText('Skema jawapan tidak tepat')
    await expect(card(page, 2).getByTestId('report-status')).toHaveText('Dikeluarkan')
    await expect(card(page, 2).getByTestId('report-actions')).toHaveCount(0)
    await expect(card(page, 1).getByTestId('report-missing')).toHaveText('Soalan tidak dijumpai')
    await expectNoHorizontalScroll(page)

    await tab(page, 'dismissed').click()
    await expect(page.locator('[data-card=report]')).toHaveCount(1)
    await expect(card(page, 11).getByTestId('report-status')).toHaveText('Ditolak')

    await gotoApp(`${S7}?status=zzz`)
    await expect(page.getByTestId('reports-empty')).toHaveText('Tiada laporan buat masa ini')
    await expect(page.locator('[data-active=true]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test(
    '"Tolak & Aktifkan Semula" dismisses report 6 and reactivates its question',
    provisional('the flash copy is UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openS7(page, gotoApp, '?status=reviewed')
      await expect(card(page, 6).getByTestId('report-inactive')).toBeVisible()
      await card(page, 6).getByTestId('report-dismiss').click()
      await expect(page.getByText('Laporan berjaya dikemaskini.')).toBeVisible()
      await expect(card(page, 6)).toHaveCount(0)
      await expect(tab(page, 'reviewed')).toHaveText('Disemak (2)')
      await expect(tab(page, 'dismissed')).toHaveText('Ditolak (2)')

      await tab(page, 'dismissed').click()
      const six = card(page, 6)
      await expect(six.getByTestId('report-status')).toHaveText('Ditolak')
      await expect(six.getByTestId('report-inactive')).toHaveCount(0)
      await expect(six.getByTestId('report-admin-notes')).toContainText(
        'Soalan dan jawapan disemak — tiada masalah',
      )
      await expect(six.getByTestId('report-actions')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    '"Nyahaktif Segera" moves report 10 to Disemak and marks its question Dinyahaktif',
    provisional('the flash copy is UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openS7(page, gotoApp)
      await expect(card(page, 10).getByTestId('report-inactive')).toHaveCount(0)
      await card(page, 10).getByTestId('report-deactivate').click()
      await expect(page.getByText('Laporan berjaya dikemaskini.')).toBeVisible()
      await expect(tab(page, 'pending')).toHaveText('Menunggu (1)')
      await expect(tab(page, 'reviewed')).toHaveText('Disemak (4)')

      await tab(page, 'reviewed').click()
      const ten = card(page, 10)
      await expect(ten.getByTestId('report-status')).toHaveText('Disemak')
      await expect(ten.getByTestId('report-inactive')).toHaveText('Dinyahaktif')
      await expect(ten.getByTestId('report-admin-notes')).toContainText(
        'Dinyahaktifkan segera oleh admin',
      )
      await expect(ten.getByTestId('report-deactivate')).toHaveCount(0)
      await expect(ten.getByTestId('report-fix')).toBeVisible()
    },
  )

  test(
    '"Tandakan Selesai" saves the typed note and the card leaves the Menunggu tab',
    provisional('the flash copy is UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openS7(page, gotoApp)
      await card(page, 9).getByTestId('report-notes').fill('Soalan diperbaiki')
      await card(page, 9).getByTestId('report-fix').click()
      await expect(page.getByText('Laporan berjaya dikemaskini.')).toBeVisible()
      await expect(card(page, 9)).toHaveCount(0)
      await expect(tab(page, 'fixed')).toHaveText('Diperbaiki (6)')
      await tab(page, 'fixed').click()
      await expect(card(page, 9).getByTestId('report-status')).toHaveText('Diperbaiki')
      await expect(card(page, 9).getByTestId('report-admin-notes')).toContainText(
        'Soalan diperbaiki',
      )
    },
  )

  test('a student is refused S7', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp(S7)
    await expect(page.getByTestId('reports-title')).toHaveCount(0)
  })
})

test.describe('M04 S13 and S14 as the pelajar', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('S13 shows the header, five zero counters and the empty state for account 2', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(S13)
    await expectTabTitle(page, 'Laporan Soalan Saya')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Laporan Soalan Saya')
    await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
      'Jejak status laporan soalan yang anda hantar',
    )
    await expect(page.locator('[data-testid^=my-reports-count-]')).toHaveText([
      '0Jumlah',
      '0Menunggu',
      '0Disemak',
      '0Diperbaiki',
      '0Ditolak',
    ])
    await expect(page.getByTestId('my-reports-empty')).toContainText('Tiada Laporan')
    await expect(page.getByTestId('my-reports-empty')).toContainText(
      'Anda belum menghantar sebarang laporan soalan.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('the modal: MCQ content, the disabled submit, the counter, close by Batal / X / Esc / backdrop', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(HARNESS)
    await page.getByTestId('harness-open').click()
    await expect(page.getByTestId('report-title')).toHaveText('Lapor Soalan')
    await modalSettled(page)
    await expect(page.getByTestId('report-subtitle')).toHaveText(
      'Soalan ini akan dinyahaktifkan sementara',
    )
    await expect(page.locator('[data-testid^=report-reason-]')).toHaveCount(7)
    await expect(page.getByTestId('report-reason-missing_options')).toContainText(
      'Pilihan jawapan tidak lengkap',
    )
    await expect(page.getByTestId('report-submit')).toBeDisabled()
    await expectTouchTarget(page.getByTestId('report-submit'))
    await expectTouchTarget(page.getByTestId('report-cancel'))
    await expectTouchTarget(page.getByTestId('report-close'))
    await page.getByTestId('report-comment').fill('abc')
    await expect(page.getByTestId('report-counter')).toHaveText('3/500')
    await page.getByTestId('report-reason-wrong_answer').click()
    await expect(page.getByTestId('report-submit')).toBeEnabled()
    await expect(page.getByTestId('report-reason-wrong_answer')).toHaveClass(/border-red-300/)
    await expectNoHorizontalScroll(page)

    await page.getByTestId('report-cancel').click()
    await expect(page.getByTestId('report-form')).toHaveCount(0)
    // Reopening resets the form.
    await page.getByTestId('harness-open').click()
    await expect(page.getByTestId('report-counter')).toHaveText('0/500')
    await expect(page.getByTestId('report-submit')).toBeDisabled()
    await page.getByTestId('report-close').click()
    await expect(page.getByTestId('report-form')).toHaveCount(0)
    await page.getByTestId('harness-open').click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('report-form')).toHaveCount(0)
    await page.getByTestId('harness-open').click()
    await page.getByTestId('cmp-modal-backdrop').click({ position: { x: 4, y: 4 } })
    await expect(page.getByTestId('report-form')).toHaveCount(0)
  })

  test('sending an MCQ report shows "Terima Kasih!" and S13 then lists it as Menunggu', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(HARNESS)
    await page.getByTestId('harness-open').click()
    await page.getByTestId('report-reason-wrong_answer').click()
    await page.getByTestId('report-reason-typo').click()
    await page.getByTestId('report-comment').fill('Jawapan salah')
    await page.getByTestId('report-submit').click()
    await expect(page.getByTestId('report-done')).toContainText('Terima Kasih!')
    await expect(page.getByTestId('report-message')).toHaveText('Laporan berjaya dihantar.')
    const sent = await mock.lastRequest('POST /api/question-reports')
    expect(sent?.body).toMatchObject({
      questionId: 564161,
      reasons: ['wrong_answer', 'typo'],
      comment: 'Jawapan salah',
      source: 'spm',
    })
    await page.getByTestId('report-done-close').click()
    await expect(page.getByTestId('report-done')).toHaveCount(0)

    await gotoApp(S13)
    await expect(page.getByTestId('my-reports-count-all')).toHaveText('1Jumlah')
    await expect(page.getByTestId('my-reports-count-pending')).toHaveText('1Menunggu')
    await expect(page.getByTestId('my-reports-list').locator('li')).toHaveCount(1)
    await expect(page.getByTestId('my-report-title')).toHaveText('Soalan #564161')
    await expect(page.getByTestId('my-report-status')).toHaveText('Menunggu')
    await expect(page.getByTestId('my-report-reason')).toHaveText([
      'Jawapan tidak tepat',
      'Kesalahan ejaan / taip',
    ])
    await expectNoHorizontalScroll(page)
  })

  test('the structured variant: its subtitle, five reasons and the structured request', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(`${HARNESS}?variant=structured&questionId=4455`)
    await expect(page.getByTestId('harness-open')).toHaveText('Lapor')
    await page.getByTestId('harness-open').click()
    await expect(page.getByTestId('report-subtitle')).toHaveText(
      'Soalan ini akan dinyahaktifkan selepas 3 laporan',
    )
    await expect(page.locator('[data-testid^=report-reason-]')).toHaveCount(5)
    await expect(page.getByTestId('report-reason-wrong_options')).toContainText('Markah tidak adil')
    await page.getByTestId('report-reason-wrong_answer').click()
    await page.getByTestId('report-submit').click()
    await expect(page.getByTestId('report-done')).toContainText('Terima Kasih!')
    const sent = await mock.lastRequest('POST /api/question-reports')
    expect(sent?.body).toMatchObject({
      questionId: 4455,
      questionType: 'structured',
      source: 'structured_attempt',
    })
  })

  test('host props: the source and failure text are passed through; a network failure shows the failure text', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(
      `${HARNESS}?source=revision&failureText=${encodeURIComponent('Gagal menghantar laporan. Sila cuba lagi.')}`,
    )
    await page.getByTestId('harness-open').click()
    await page.getByTestId('report-reason-other').click()
    await mock.networkErrorNext('/api/question-reports')
    await page.getByTestId('report-submit').click()
    await expect(page.getByTestId('report-done')).toContainText('Terima Kasih!')
    await expect(page.getByTestId('report-message')).toHaveText(
      'Gagal menghantar laporan. Sila cuba lagi.',
    )
    await page.getByTestId('report-done-close').click()

    await page.getByTestId('harness-open').click()
    await page.getByTestId('report-reason-other').click()
    await page.getByTestId('report-submit').click()
    await expect(page.getByTestId('report-message')).toHaveText('Laporan berjaya dihantar.')
    const sent = await mock.lastRequest('POST /api/question-reports')
    expect(sent?.body).toMatchObject({ source: 'revision' })
  })
})
