/** Shared helpers of the DSKP G5 specs (v2-dskp-integration). */
import { mkdirSync } from 'node:fs'

import type { Browser, Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { viewportWidth } from '../support'

export const SHOTS = process.env.DSKP_SHOTS

export async function shot(target: Page | Locator, name: string): Promise<void> {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  const page = 'viewportSize' in target ? target : target.page()
  const w = viewportWidth(page)
  if ('viewportSize' in target) {
    await target.screenshot({ path: `${SHOTS}/${name}-${w}.png` })
    return
  }
  // A tall block is taller than the viewport: grow the viewport (same width) for the capture.
  const size = page.viewportSize()
  if (!size) return
  await page.setViewportSize({ width: size.width, height: 3400 })
  await target.screenshot({ path: `${SHOTS}/${name}-${w}.png` })
  await page.setViewportSize(size)
}

/* ------------------------------------------------------------------------------------ helpers */

export const ADMIN = 'admin@demo.test'

/** The 13 catalogue subjects in the order the design (section 8) fixes. */
export const SUBJECTS_13 = [
  'Matematik',
  'Matematik Tambahan',
  'Fizik',
  'Sains',
  'Bahasa Melayu',
  'Bahasa Inggeris',
  'Sejarah',
  'Pendidikan Islam',
  'Tasawwur Islam',
  'Pendidikan Moral',
  'Pendidikan Seni Visual',
  'Landskap dan Nurseri',
  'Katering dan Penyajian',
]

export const tid = (page: Page, id: string) => page.getByTestId(id)

export async function optionTexts(select: Locator): Promise<string[]> {
  return select.locator('option').evaluateAll((os) => os.map((o) => (o.textContent ?? '').trim()))
}

/** Opens Tulis Soalan Manual for `subject` (catalogue code) and waits for the Tag DSKP block. */
export async function startManual(page: Page, gotoApp: (p: string) => Promise<void>, subject = 'MAT') {
  await gotoApp('/admin/spm/soalan/manual')
  await expect(tid(page, 'intake-subject')).toBeVisible()
  await tid(page, 'intake-subject').selectOption(subject)
  await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
  await tid(page, 'intake-copyright').selectOption('sendiri')
  await tid(page, 'manual-start').click()
  const block = tid(page, 'tag-block')
  await expect(block).toBeVisible()
  await block.scrollIntoViewIfNeeded()
  return block
}

/** Types the stem and the short answer so that only the tag is left to judge. */
export async function fillBasics(page: Page): Promise<void> {
  await tid(page, 'q-stem').fill('Selesaikan persamaan itu dan tunjukkan langkah kerja.')
  await page.getByRole('button', { name: 'Jawapan diterima', exact: true }).click()
  await page.getByLabel('Jawapan diterima (satu setiap baris)').fill('4')
}

export async function openIssues(page: Page): Promise<string[]> {
  const list = tid(page, 'issues-list')
  if (!(await list.isVisible())) await tid(page, 'issues-toggle').click()
  await expect(list).toBeVisible()
  return (await list.locator('li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
}


/** Index of the `data-testid^=prefix` control whose smallest enclosing row/card contains `text`. */
export async function rowButton(page: Page, prefix: string, text: string): Promise<Locator> {
  const btns = page.locator(`[data-testid^="${prefix}"]`)
  await expect(btns.first()).toBeVisible()
  const n = await btns.count()
  for (let i = 0; i < n; i++) {
    const hit = await btns.nth(i).evaluate(
      (el, a) => {
        let e: Element | null = el
        while (e && !(e.textContent ?? '').includes(a.text)) e = e.parentElement
        return e !== null && e.querySelectorAll(`[data-testid^="${a.prefix}"]`).length === 1
      },
      { text, prefix },
    )
    if (hit) return btns.nth(i)
  }
  throw new Error(`no ${prefix} row contains "${text}"`)
}


/** "Menunjukkan {a}-{b} daripada {n} hasil" of the table: the total, or 0 when the list is empty. */
export async function pagerTotal(page: Page): Promise<number> {
  const el = page.locator('p[role="status"]').filter({ hasText: 'Menunjukkan' }).first()
  if (!(await el.isVisible().catch(() => false))) return 0
  const m = /daripada ([\d,]+) hasil/.exec(await el.innerText())
  return m ? Number(m[1]!.replace(/,/g, '')) : 0
}

/** Opens the filter surface: the "Lagi Penapis" popover from md, the "Penapis" sheet below. */
export async function openFilters(page: Page): Promise<void> {
  if (await tid(page, 'dskp-filters').isVisible()) return
  if (viewportWidth(page) >= 768) await page.locator('[data-ds="filter-more"]').click()
  else await page.getByRole('button', { name: /^Penapis( \d+)?$/ }).first().click()
  await expect(tid(page, 'dskp-filters')).toBeVisible()
}

/** Applies the bar: "Cari" from md, "Guna" in the sheet below. */
export async function applyFilters(page: Page, bar: 'bank-filter' | 'queue-filter'): Promise<void> {
  if (viewportWidth(page) >= 768) {
    await page.keyboard.press('Escape')
    await tid(page, bar).getByRole('button', { name: 'Cari', exact: true }).click()
  } else {
    const apply = page.getByRole('button', { name: 'Guna', exact: true })
    if (!(await apply.isVisible())) await page.getByRole('button', { name: /^Penapis( \d+)?$/ }).first().click()
    await apply.click()
  }
  await page.waitForTimeout(600)
}

/** A text-layer PDF of fictional questions (page 1) and their scheme (page 2), made by Chromium. */
export async function makePaperPdf(browser: Browser, pages: string[]): Promise<Buffer> {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  const html = pages
    .map(
      (t) =>
        `<section style="page-break-after:always"><pre style="font:14px/1.6 Arial;white-space:pre-wrap">${t
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre></section>`,
    )
    .join('')
  await p.setContent(`<html><body>${html}</body></html>`)
  const buf = await p.pdf({ format: 'A4' })
  await ctx.close()
  return buf
}

const INLINE_FIELDS = [
  'bank-subject',
  'bank-kertas',
  'bank-kind',
  'bank-status',
  'queue-subject',
  'queue-kertas',
  'queue-kind',
]

/** Sets one filter field of a bar, opening the popover or the sheet first when the field is in it. */
export async function setFilter(page: Page, id: string, value: string): Promise<void> {
  const wide = viewportWidth(page) >= 768
  if (!(wide && INLINE_FIELDS.includes(id)) && !(await tid(page, 'dskp-filters').isVisible())) {
    await openFilters(page)
  }
  await tid(page, id).selectOption(value)
}
