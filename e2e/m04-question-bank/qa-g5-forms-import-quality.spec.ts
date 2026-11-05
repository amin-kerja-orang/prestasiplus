/**
 * M04 G5 QA specs (written by QA, gaps in the developer smoke): the old S2 path, S4 edit, S5 import,
 * S5h history, S6 quality. Covers AC-M04-06.x .. 09.x, 12.x .. 16.x.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  isDesktopShell,
  moduleTag,
} from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)
const NL = String.fromCharCode(10)

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

// The flat create form is retired (FR-ADM-Q04.7, PRD45 line 115), so E2E-M04-10 to 16 no longer have a screen in this
// mock build; the wizard's unit tests are `StudioEditorPage.test.ts`.
test.describe('QA G5 old create path', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-10 /admin/questions/create goes to the Studio wizard (FR-ADM-Q04.7)', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/create')
    await expect(page).toHaveURL(/\/admin\/studio\/questions\/create$/)
    await expect(byId(page, 'studio-unavailable')).toBeVisible()
  })
})

test.describe('QA G5 S4 edit form', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-27 header, shell title, options required, Batal to S3, save shows new text + flash (AC-12.1, 12.2, 12.5)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/564159/edit')
    await expect(byId(page, 'shell-admin-title')).toHaveText('Edit Soalan')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveCount(0)
    for (const i of [0, 1, 2, 3])
      await expect(byId(page, `q-option-${String(i)}`)).toHaveAttribute('required', '')
    await expect(page.locator('[id="q-correct-0"] [role="radio"]')).toBeChecked()
    await byId(page, 'q-text').fill('Teks soalan yang dikemaskini oleh QA G5.')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
    await expect(byId(page, 'cmp-flash')).toBeVisible()
    await expect(byId(page, 'question-text')).toContainText(
      'Teks soalan yang dikemaskini oleh QA G5.',
    )
    await gotoApp('/admin/questions/564159/edit')
    await byId(page, 'form-cancel').click()
    await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
  })

  test.describe('states profile (image anchor)', () => {
    test.use({ mockInit: { latency: 0, overrides: { questionStore: { profile: 'states' } } } })

    test('E2E-M04-29 S4 of 570022: new image reads "Tukar gambar"; remove posts remove flags (AC-12.4)', async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/questions/570022/edit')
      await expect(byId(page, 'q-image')).toBeVisible()
      await byId(page, 'q-image-input').setInputFiles({
        name: 'n.png',
        mimeType: 'image/png',
        buffer: PNG,
      })
      await expect(byId(page, 'q-image')).toContainText('Tukar gambar')
      await byId(page, 'q-image-remove').click()
      // Remove the saved question image and option B image when present.
      const removeBtns = page.locator('[data-testid$="-remove"]:visible')
      const n = await removeBtns.count()
      for (let i = 0; i < n; i++) await removeBtns.first().click()
      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL(/\/admin\/questions\/570022$/)
      const reqs = (await mock.requests('/api/questions/570022')).filter((r) => r.method !== 'GET')
      expect(reqs.length).toBeGreaterThan(0)
      expect(JSON.stringify(reqs)).toMatch(/removeQuestionImage|remove_question_image/)
    })
  })
})

test.describe('QA G5 S5 import', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/import')
  })

  test('E2E-M04-30 shell title/subtitle, file hints, defaults, format card suffixes (AC-13.1, 13.2, 13.3, 13.4)', async ({
    page,
  }) => {
    await expect(byId(page, 'shell-admin-title')).toHaveText('Import Soalan Secara Pukal')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveText(
      'Muat naik fail CSV untuk menambah soalan secara pukal',
    )
    await expect(page.getByText('Saiz maksimum: 5MB. Format: CSV atau TXT')).toBeVisible()
    await expect(page.getByText('Tetapan Lalai (Opsional)')).toBeVisible()
    await expect(
      page.getByText('Nilai ini digunakan jika kolum berkaitan tiada dalam CSV.'),
    ).toBeVisible()
    await expect(byId(page, 'import-default-subject').locator('option').first()).toHaveText(
      '-- Tidak ditetapkan --',
    )
    await expect(byId(page, 'import-default-level').locator('option').first()).toHaveText(
      '-- Tidak ditetapkan --',
    )
    await expect(byId(page, 'import-default-difficulty').locator('option:checked')).toHaveText(
      'Mudah',
    )
    await expect(byId(page, 'import-file')).toHaveAttribute('required', '')
    await expect(byId(page, 'import-format-card')).toContainText(
      /subject_id.*(atau guna Tetapan Lalai)/,
    )
    await expect(byId(page, 'import-format-card')).toContainText(
      /education_level_id.*(atau guna Tetapan Lalai)/,
    )
    await expect(byId(page, 'import-template-card')).toContainText('Muat Turun Template')
    await expect(byId(page, 'import-submit')).toContainText('Mula Import')
    await byId(page, 'import-submit').click()
    await expect(byId(page, 'import-file')).toHaveJSProperty('validity.valueMissing', true)
    await expect(byId(page, 'import-alert')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    // Side cards stack below under 1024 and sit beside at 1280 (AC-30.4).
    const form = await byId(page, 'import-form').boundingBox()
    const tpl = await byId(page, 'import-template-card').boundingBox()
    if (isDesktopShell(page)) expect(tpl!.x).toBeGreaterThan(form!.x + form!.width - 4)
    else expect(tpl!.y).toBeGreaterThan(form!.y + form!.height - 4)
  })

  test('E2E-M04-31 3-row CSV: one row missing subject; without default 2 imported 1 failed; with default Matematik 3 (AC-13.5)', async ({
    page,
    gotoApp,
  }) => {
    const header =
      'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation'
    const csv = [
      header,
      '"Soalan QA import satu apakah ini?",A1,B1,C1,D1,A,3,11,2,1,',
      '"Soalan QA import dua apakah ini?",A2,B2,C2,D2,B,3,11,2,1,',
      '"Soalan QA import tiga tanpa subjek",A3,B3,C3,D3,C,,11,2,1,',
    ].join(NL)
    await byId(page, 'import-file').setInputFiles({
      name: 'qa.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await byId(page, 'import-submit').click()
    await expect(byId(page, 'cmp-flash')).toContainText(
      'Import selesai: 2 soalan diimport, 1 gagal.',
    )

    await gotoApp('/admin/questions/import')
    await byId(page, 'import-default-subject').selectOption({ label: 'Matematik' })
    await byId(page, 'import-file').setInputFiles({
      name: 'qa.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })
    await byId(page, 'import-submit').click()
    await expect(byId(page, 'cmp-flash')).toContainText(
      'Import selesai: 3 soalan diimport, 0 gagal.',
    )
    await gotoApp('/admin/questions?status=draft')
    await expect(byId(page, 'question-row').first()).toBeVisible()
    await expect(byId(page, 'question-status').first()).toHaveText('Draf')
  })

  test('E2E-M04-32 Download Template: file name and header row (AC-13.6)', async ({ page }) => {
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      byId(page, 'import-template-download').click(),
    ])
    expect(dl.suggestedFilename()).toBe('template-import-soalan.csv')
    const stream = await dl.createReadStream()
    const chunks: Buffer[] = []
    for await (const c of stream) chunks.push(c as Buffer)
    const first = Buffer.concat(chunks).toString('utf8').split(/\r?\n/)[0] ?? ''
    expect(first.replace(/^﻿/, '')).toBe(
      'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation',
    )
  })

  test('E2E-M04-33 history: Kembali goes to import; only Kembali action; empty-run page (AC-14.1, 14.2)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/questions/import-history')
    await expect(page.getByText('Sejarah Import').first()).toBeVisible()
    await expect(page.locator('main button')).toHaveCount(0)
    await byId(page, 'history-back').click()
    await expect(page).toHaveURL(/\/admin\/questions\/import$/)
  })
})

test.describe('QA G5 S6 quality', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/quality')
  })

  test('E2E-M04-34 shell title/subtitle, KPI labels, bucket titles upper case, legacy backticks (AC-15.1, 15.2)', async ({
    page,
  }) => {
    await expect(byId(page, 'shell-admin-title')).toHaveText('Dashboard Kualiti Soalan')
    await expect(byId(page, 'shell-admin-subtitle')).toHaveText(
      'Analisa kualiti keseluruhan bank soalan',
    )
    await expect(byId(page, 'kpi-total')).toContainText('Jumlah Soalan')
    await expect(byId(page, 'kpi-average')).toContainText('Purata Skor')
    await expect(byId(page, 'kpi-excellent')).toContainText('Cemerlang (76-100)')
    await expect(byId(page, 'kpi-action')).toContainText('Perlu Tindakan Aktif (≤ 50)')
    await expect(byId(page, 'kpi-total-value')).toHaveText('465,278')
    for (const [id, text] of [
      ['bucket-baik', 'Skor 51-75'],
      ['bucket-lemah', 'Skor ≤ 50'],
      ['bucket-legacy', 'Legacy Generic'],
    ] as Array<[string, string]>) {
      const title = byId(page, id).getByText(text, { exact: true })
      await expect(title).toBeVisible()
      expect(await title.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')
    }
    await expect(byId(page, 'bucket-legacy')).toContainText('`tracking_a_feed_20260308`')
    await expect(byId(page, 'bucket-legacy')).toContainText('`spm_tracking_auto_seed_v1`')
    await expect(byId(page, 'bucket-legacy')).toContainText('`source_type=ai_generated`')
  })

  test('E2E-M04-34 distribution, subject rows sorted by Purata desc, levels, action list header (AC-15.3, 15.4, 15.5)', async ({
    page,
  }) => {
    for (const k of ['cemerlang', 'baik', 'lemah', 'kritikal']) void k
    await expect(byId(page, 'quality-distribution')).toContainText('Cemerlang')
    await expect(byId(page, 'quality-distribution')).toContainText('Baik')
    await expect(byId(page, 'quality-distribution')).toContainText('Lemah')
    await expect(byId(page, 'quality-distribution')).toContainText('Kritikal')
    const rows = byId(page, 'subject-row')
    expect(await rows.count()).toBeGreaterThan(20)
    const avgs = await rows.evaluateAll((els) =>
      els.map((el) => {
        const m = (el as HTMLElement).innerText.match(/(\d+\.\d)/)
        return m ? Number(m[1]) : NaN
      }),
    )
    expect(avgs.some((n) => Number.isNaN(n))).toBe(false)
    for (let i = 1; i < avgs.length; i++)
      expect(avgs[i] ?? 0).toBeLessThanOrEqual((avgs[i - 1] ?? 0) + 0.0001)
    await expect(byId(page, 'level-row').first()).toContainText('Darjah 1')
    await expect(byId(page, 'level-row').last()).toContainText('Tingkatan 5')
    await expect(byId(page, 'quality-actions')).toContainText(
      'Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy.',
    )
    for (const h of ['ID', 'Soalan', 'Subjek', 'Tingkatan', 'Sumber', 'Skor'])
      await expect(
        byId(page, 'quality-actions').getByText(h, { exact: true }).first(),
      ).toBeVisible()
    await expect(byId(page, 'quality-actions')).toContainText('#129114')
    await expect(byId(page, 'quality-actions')).toContainText('#129216')
  })

  test('E2E-M04-35 audit button shows the busy state while running and no dialog (AC-16.1)', async ({
    page,
    mock,
  }) => {
    await mock.setLatency(1500)
    await byId(page, 'quality-audit').click()
    await expect(byId(page, 'quality-audit')).toBeDisabled()
    await expect(byId(page, 'quality-audit')).toContainText('Sedang audit...')
    await expect(byId(page, 'cmp-flash')).toBeVisible({ timeout: 15_000 })
  })
})
