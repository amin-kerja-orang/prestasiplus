/**
 * G5 acceptance of v2-dskp-integration, part 2: Bank Soalan SPM and Baris Gilir Semakan filters
 * (US-09, US-08 AC-08.3), counts equal rows, chips, empty states, flagged and T1-T3 rows, the
 * drawer history, the five queue filters. Same run mode as `dskp-g5.spec.ts`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTouchTarget } from '../support'
import {
  ADMIN,
  SUBJECTS_13,
  applyFilters,
  setFilter,
  openFilters,
  optionTexts,
  pagerTotal,
  shot,
  tid,
} from './dskp-g5-support'

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

/** Rows shown (table rows or cards): one open-button per row. */
const rowCount = (page: Page, prefix: string) =>
  page.locator(`[data-testid^="${prefix}-open-"]`).count()

/** The text of the row (or card) that holds the open-button of question `qid`. */
async function rowText(page: Page, prefix: string, qid: string): Promise<string> {
  return page.getByTestId(`${prefix}-open-${qid}`).evaluate((el) => {
    let e: Element | null = el
    while (
      e &&
      !(e.tagName === 'TR' || e.getAttribute('role') === 'row' || e.tagName === 'ARTICLE' || e.tagName === 'LI')
    ) {
      e = e.parentElement
    }
    return (e ?? el.parentElement)?.textContent ?? ''
  })
}

async function setTagReview(page: Page, on: boolean): Promise<void> {
  if (!(await tid(page, 'dskp-filters').isVisible())) await openFilters(page)
  const box = tid(page, 'bank-tag-review')
  if ((await box.isChecked()) !== on) await box.click()
}

test.describe('Bank Soalan SPM: curriculum filters (US-09)', () => {
  test('AC-09.1 AC-09.3 AC-08.3: subject list, dependent selects, hints and options', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan')
    await expect(tid(page, 'bank-page')).toBeVisible()
    await expect(page.locator('[data-testid^="bank-open-"]').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await shot(page, 'bank-default')

    await openFilters(page)
    expect(await optionTexts(tid(page, 'bank-subject'))).toEqual(['Semua subjek', ...SUBJECTS_13])
    expect(await optionTexts(tid(page, 'bank-form'))).toEqual([
      'Semua tingkatan',
      'Tingkatan 4',
      'Tingkatan 5',
      'Tingkatan 1-3 (di luar DSKP)',
    ])
    expect(await optionTexts(tid(page, 'bank-tp'))).toEqual([
      'Semua TP',
      'TP 1',
      'TP 2',
      'TP 3',
      'TP 4',
      'TP 5',
      'TP 6',
    ])
    expect(await optionTexts(tid(page, 'bank-kbat'))).toEqual([
      'Semua',
      'Ya',
      'Tidak',
      'Mengaplikasi',
      'Menganalisis',
      'Menilai',
      'Mencipta',
    ])
    await expect(tid(page, 'dskp-filters')).toContainText('Perlu semakan tag')
    // No subject: Unit is disabled with its hint; SP waits for a unit.
    await expect(tid(page, 'bank-unit')).toBeDisabled()
    await expect(tid(page, 'bank-unit-hint')).toHaveText('Pilih subjek dahulu.')
    await expect(tid(page, 'bank-sp')).toBeDisabled()
    await expect(tid(page, 'bank-sp-hint')).toHaveText('Pilih unit dahulu.')
    for (const id of ['bank-form', 'bank-tp', 'bank-kbat']) await expectTouchTarget(tid(page, id))
    await expectNoHorizontalScroll(page)
    await shot(page, 'bank-filters-open')

    // Subject Matematik: units of both forms under two groups; then one form only.
    await setFilter(page, 'bank-subject', 'MAT')
    await expect(tid(page, 'bank-unit')).toBeEnabled()
    const groups = await tid(page, 'bank-unit')
      .locator('optgroup')
      .evaluateAll((gs) => gs.map((g) => g.getAttribute('label')))
    expect(groups).toEqual(['Tingkatan 4', 'Tingkatan 5'])
    expect(await tid(page, 'bank-unit').locator('option').count()).toBe(1 + 10 + 8)
    await setFilter(page, 'bank-form', 'T4')
    expect(await tid(page, 'bank-unit').locator('option').count()).toBe(1 + 10)
    await setFilter(page, 'bank-unit', 'MAT:T4:u:1.0')
    await expect(tid(page, 'bank-sp')).toBeEnabled()
    const sps = await optionTexts(tid(page, 'bank-sp'))
    expect(sps[0]).toBe('Semua SP')
    expect(sps).toHaveLength(1 + 8)
    expect(sps[6]).toMatch(/^1\.1\.6 - Menentukan punca/)

    // Dependent clearing, before "Cari": a tingkatan the unit is not in clears Unit and SP.
    await setFilter(page, 'bank-sp', 'MAT:T4:sp:1.1.6')
    await setFilter(page, 'bank-form', 'T5')
    await expect(tid(page, 'bank-unit')).toHaveValue('')
    await expect(tid(page, 'bank-sp')).toHaveValue('')
    await expect(tid(page, 'bank-sp')).toBeDisabled()
    // A subject change clears Unit and SP and keeps Tingkatan, TP and KBAT.
    await setFilter(page, 'bank-unit', 'MAT:T5:u:1.0')
    await setFilter(page, 'bank-tp', '2')
    await setFilter(page, 'bank-kbat', 'tidak')
    await setFilter(page, 'bank-subject', 'SN')
    await expect(tid(page, 'bank-unit')).toHaveValue('')
    await expect(tid(page, 'bank-form')).toHaveValue('T5')
    await expect(tid(page, 'bank-tp')).toHaveValue('2')
    await expect(tid(page, 'bank-kbat')).toHaveValue('tidak')
    // Tingkatan 1-3 has no unit: Unit is disabled and no unit or SP hint is asked for.
    await setFilter(page, 'bank-form', 'T1-T3')
    await expect(tid(page, 'bank-unit')).toBeDisabled()
    await expect(tid(page, 'bank-unit-hint')).toHaveCount(0)
    await expect(tid(page, 'bank-sp-hint')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('AC-09.1 AC-09.2 AC-09.4 AC-08.3 AC-08.5: each filter, chips, counts equal rows, flagged and T1-T3 rows', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan')
    await expect(page.locator('[data-testid^="bank-open-"]').first()).toBeVisible()
    const kpiTotal = await tid(page, 'bank-stat-total').innerText()

    await setFilter(page, 'bank-status', 'semua')
    await applyFilters(page, 'bank-filter')
    const ALL = await pagerTotal(page)
    expect(ALL).toBe(79) // 70 bank + 9 review seeds: tagging added and removed nothing

    // Tingkatan T1-T3: 44. Page size 50 so that every row is on the page.
    await setFilter(page, 'bank-form', 'T1-T3')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(44)
    await page.locator('[data-ds="data-table-page-size"]').click()
    await page.getByRole('option', { name: /50/ }).click()
    expect(await rowCount(page, 'bank')).toBe(44) // the count equals the rows (AC-09.2)
    for (const id of ['mat1-bentuk-piawai-v1', 'mat1-bulatan-v1']) {
      const b = await rowText(page, 'bank', id)
      expect(b).toContain('Tingkatan 1-3 (di luar DSKP)')
      expect(b).not.toMatch(/SP\s*\d/)
      expect(b).toContain('TP 2')
    }
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('Tingkatan 1-3 (di luar DSKP)')
    await shot(page, 'bank-filter-t1t3')

    await setFilter(page, 'bank-form', 'T4')
    await applyFilters(page, 'bank-filter')
    const t4 = await pagerTotal(page)
    expect(t4).toBe(7)
    expect(await rowCount(page, 'bank')).toBe(7)

    // Tingkatan 5: no seed question; the filtered empty state in the exact words.
    await setFilter(page, 'bank-form', 'T5')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(0)
    expect(await rowCount(page, 'bank')).toBe(0)
    await expect(page.getByText('Tiada soalan dijumpai')).toBeVisible()
    await expect(page.getByText('Cuba ubah atau set semula penapis.')).toBeVisible()
    await shot(page, 'bank-empty-filtered')
    await expectNoHorizontalScroll(page)

    // "Perlu semakan tag": the flagged rows, counted from the data; T1-T3 + T4 + T5 + flagged = all.
    await setFilter(page, 'bank-form', '')
    await setTagReview(page, true)
    await applyFilters(page, 'bank-filter')
    const flagged = await pagerTotal(page)
    expect(flagged).toBe(28)
    expect(44 + t4 + 0 + flagged).toBe(ALL)
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('Perlu semakan tag')
    const fb = await rowText(page, 'bank', 'mat1-kecerunan-v1')
    expect(fb).toContain('Perlu semakan tag')
    expect(fb).not.toMatch(/SP\s*\d/)
    await shot(page, 'bank-filter-flagged')
    // The KPI strip is not filtered (design 6.1).
    expect(await tid(page, 'bank-stat-total').innerText()).toBe(kpiTotal)

    // Unit and SP of the tagged seeds. Chips carry code and title; removing the unit removes the SP.
    await setTagReview(page, false)
    await setFilter(page, 'bank-subject', 'MAT')
    await setFilter(page, 'bank-form', 'T4')
    await setFilter(page, 'bank-unit', 'MAT:T4:u:1.0')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(2)
    expect(await rowCount(page, 'bank')).toBe(2)
    const b1 = await rowText(page, 'bank', 'mat2-kuadratik-v1')
    expect(b1).toContain('Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
    expect(b1).toMatch(/SP\s*1\.1\.6/) // a card shows the label and the value apart
    expect(b1).toContain('TP 2')
    await setFilter(page, 'bank-sp', 'MAT:T4:sp:1.1.6')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(2)
    const chips = (await tid(page, 'active-filter').allInnerTexts()).map((c) => c.trim())
    expect(chips).toEqual(
      expect.arrayContaining([
        'Tingkatan 4',
        'Unit 1.0 Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
        'SP 1.1.6',
      ]),
    )
    await shot(page, 'bank-filter-unit-sp')
    await page.getByRole('button', { name: /Buang penapis Unit 1\.0/ }).click()
    const left = (await tid(page, 'active-filter').allInnerTexts()).map((c) => c.trim())
    expect(left.some((c) => c.startsWith('Unit'))).toBe(false)
    expect(left.some((c) => c.startsWith('SP'))).toBe(false) // the SP goes with its unit

    // TP and KBAT. Seeds carry TP 2 (76), 3 (1), 4 (2) and no KBAT.
    await page.getByRole('button', { name: /Set Semula/ }).first().click()
    await setFilter(page, 'bank-status', 'semua')
    await setFilter(page, 'bank-tp', '4')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(2)
    expect(await rowCount(page, 'bank')).toBe(2)
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('TP 4')
    await setFilter(page, 'bank-tp', '')
    await setFilter(page, 'bank-kbat', 'tidak')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(79) // nothing is KBAT
    await setFilter(page, 'bank-kbat', 'ya')
    await applyFilters(page, 'bank-filter')
    expect(await pagerTotal(page)).toBe(0)
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('KBAT: Ya')
    await expect(page.getByText('Tiada soalan dijumpai')).toBeVisible()
    for (const lvl of ['mengaplikasi', 'menganalisis', 'menilai', 'mencipta']) {
      await setFilter(page, 'bank-kbat', lvl)
      await applyFilters(page, 'bank-filter')
      expect(await pagerTotal(page)).toBe(0)
    }
    // The empty state offers "Set Semula": it clears every filter and the list is back.
    await page.getByRole('button', { name: 'Set Semula' }).last().click()
    await expect(page.locator('[data-testid^="bank-open-"]').first()).toBeVisible()
    expect(await tid(page, 'active-filter').count()).toBe(0)
    expect(await pagerTotal(page)).toBe(72) // back to the default (Terbit) list
  })

  test('AC-09.4: the drawer of a tagged question shows the catalogue unit title, SP code and TP, and no flag', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan')
    await expect(tid(page, 'bank-page')).toBeVisible()
    await tid(page, 'bank-search').fill('mat2-kuadratik-v1')
    await applyFilters(page, 'bank-filter')
    await tid(page, 'bank-open-mat2-kuadratik-v1').click()
    await expect(tid(page, 'bank-drawer')).toBeVisible()
    const tag = tid(page, 'bank-tag')
    await expect(tag).toContainText('Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
    await expect(tag).toContainText('SP 1.1.6')
    await expect(tag).toContainText('TP 2')
    await expect(tid(page, 'bank-tag-alert')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await shot(page, 'bank-drawer-tagged')
  })
})

test.describe('Baris Gilir Semakan: the five curriculum filters and the tag badges (US-09, UQ-1)', () => {
  const QUEUE_KEYS = [
    'mat1-rev-3',
    'sn1-rev-1',
    'sn2-rev-1',
    'mat2-rev-g1',
    'mat1-rev-1',
    'mat1-rev-2',
  ]
  const shown = async (page: Page): Promise<string[]> =>
    (
      await page
        .locator('[data-testid^="queue-open-"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice('queue-open-'.length)))
    ).sort()

  test('AC-09.1 AC-09.2 AC-09.4 AC-08.3: five filters, no "Perlu semakan tag", rows equal what the filters select, badges', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/semakan')
    await expect(tid(page, 'review-queue-page')).toBeVisible()
    await expect(page.locator('[data-testid^="queue-open-"]').first()).toBeVisible()
    expect(await shown(page)).toEqual([...QUEUE_KEYS].sort())
    await expectNoHorizontalScroll(page)
    await shot(page, 'queue-default')

    // Badges: T1-T3 rows carry their label and TP; flagged rows the warning badge and no SP.
    for (const k of ['mat1-rev-1', 'mat1-rev-2', 'mat1-rev-3', 'mat2-rev-g1']) {
      const t = await rowText(page, 'queue', k)
      expect(t).toContain('Tingkatan 1-3 (di luar DSKP)')
      expect(t).toContain('TP 2')
    }
    for (const k of ['sn1-rev-1', 'sn2-rev-1']) {
      const t = await rowText(page, 'queue', k)
      expect(t).toContain('Perlu semakan tag')
      expect(t).not.toMatch(/SP\s*\d/)
    }

    // The same five fields as the bank, without the checkbox.
    await openFilters(page)
    expect(await optionTexts(tid(page, 'queue-subject'))).toEqual(['Semua subjek', ...SUBJECTS_13])
    expect(await optionTexts(tid(page, 'queue-form'))).toEqual([
      'Semua tingkatan',
      'Tingkatan 4',
      'Tingkatan 5',
      'Tingkatan 1-3 (di luar DSKP)',
    ])
    await expect(tid(page, 'queue-unit')).toBeDisabled()
    await expect(tid(page, 'queue-unit-hint')).toHaveText('Pilih subjek dahulu.')
    await expect(tid(page, 'queue-sp')).toBeDisabled()
    expect(await optionTexts(tid(page, 'queue-tp'))).toHaveLength(7)
    expect(await optionTexts(tid(page, 'queue-kbat'))).toHaveLength(7)
    await expect(tid(page, 'queue-tag-review')).toHaveCount(0)
    await expect(tid(page, 'dskp-filters')).not.toContainText('Perlu semakan tag')
    for (const id of ['queue-form', 'queue-tp', 'queue-kbat']) await expectTouchTarget(tid(page, id))
    await shot(page, 'queue-filters-open')

    // Tingkatan 1-3: the four exempt items (the group counts: any of its questions passes).
    await setFilter(page, 'queue-form', 'T1-T3')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual(['mat1-rev-1', 'mat1-rev-2', 'mat1-rev-3', 'mat2-rev-g1'])
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('Tingkatan 1-3 (di luar DSKP)')
    await shot(page, 'queue-filter-t1t3')
    // Tingkatan 4: nothing in the queue; the filtered empty state, not "Baris gilir kosong".
    await setFilter(page, 'queue-form', 'T4')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual([])
    await expect(page.getByText('Tiada soalan dijumpai')).toBeVisible()
    await expect(page.getByText('Cuba ubah atau set semula penapis.')).toBeVisible()
    await expect(page.getByText('Baris gilir kosong')).toHaveCount(0)
    await shot(page, 'queue-empty-filtered')
    await setFilter(page, 'queue-form', '')

    // Subject, then Unit: Sains has two flagged items and no unit in the queue.
    await setFilter(page, 'queue-subject', 'SN')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual(['sn1-rev-1', 'sn2-rev-1'])
    await setFilter(page, 'queue-unit', 'SN:T4:u:11.0')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual([])
    const chips = (await tid(page, 'active-filter').allInnerTexts()).map((c) => c.trim())
    expect(chips.some((c) => c.startsWith('Unit 11.0'))).toBe(true)
    // Removing the Unit chip puts the two flagged Sains items back.
    await page.getByRole('button', { name: /Buang penapis Unit 11\.0/ }).click()
    await expect.poll(() => shown(page)).toEqual(['sn1-rev-1', 'sn2-rev-1'])

    // TP and KBAT (the queue items carry TP 2 and no KBAT).
    await page.getByRole('button', { name: /Set Semula/ }).first().click()
    await setFilter(page, 'queue-tp', '2')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual([...QUEUE_KEYS].sort())
    await setFilter(page, 'queue-tp', '3')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual([])
    await setFilter(page, 'queue-tp', '')
    await setFilter(page, 'queue-kbat', 'tidak')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual([...QUEUE_KEYS].sort())
    await setFilter(page, 'queue-kbat', 'ya')
    await applyFilters(page, 'queue-filter')
    expect(await shown(page)).toEqual([])
    expect(await tid(page, 'active-filter').allInnerTexts()).toContain('KBAT: Ya')
    await expectNoHorizontalScroll(page)
  })
})
