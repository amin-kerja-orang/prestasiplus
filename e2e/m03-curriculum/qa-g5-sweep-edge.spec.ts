/**
 * M03 G5 QA specs (written by QA): responsive sweep of the 11 built admin routes (E2E-M03-52, AC-31.1..31.4),
 * ordering / inactive seed checks (E2E-M03-05 DV-M03-09, E2E-M03-06), form validation gaps (AC-06.4, 13.5,
 * 18.2, 14.x) and edge cases (long text, markup in names, unknown ids in the S1 query).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { TIMEOUT_FACTOR } from './timeout-factor'
import { expectNoHorizontalScroll, moduleTag, viewportWidth } from '../support'

const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(3), '@qa'] }

const ROUTES: Array<[string, string]> = [
  ['S1 prompt', '/admin/curriculum'],
  ['S1 tree (Matematik T4)', '/admin/curriculum?subject_id=3&education_level_id=10'],
  ['S1 tree (BM D1, subtopics)', '/admin/curriculum?subject_id=1&education_level_id=1'],
  ['S1 empty tree', '/admin/curriculum?subject_id=2&education_level_id=9'],
  ['S2', '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10'],
  ['S3', '/admin/curriculum/chapters/91/edit'],
  ['S4', '/admin/curriculum/topics/create?chapter_id=91'],
  ['S5', '/admin/curriculum/topics/126/edit'],
  ['S6', '/admin/subjects'],
  ['S7', '/admin/subjects/create'],
  ['S8', '/admin/subjects/3/edit'],
  ['S9', '/admin/education-levels'],
  ['S10', '/admin/education-levels/create'],
  ['S11', '/admin/education-levels/10/edit'],
]

/** Elements of `main` whose right edge is past the viewport and that are not inside a horizontal scroller. */
async function clippedOutsideScrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const iw = document.documentElement.clientWidth
    const main = document.querySelector('main') ?? document.body
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (r.right <= iw + 1 && r.left >= -1) continue
      let p: HTMLElement | null = el.parentElement
      let scrolled = false
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
          scrolled = true
          break
        }
        p = p.parentElement
      }
      if (!scrolled)
        out.push(`${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? ''}] ${Math.round(r.left)}..${Math.round(r.right)} of ${iw}`)
    }
    return out.slice(0, 8)
  })
}

async function smallText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const root = document.querySelector('main') ?? document.body
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = walker.nextNode())) {
      const t = (n.textContent ?? '').trim()
      if (!t) continue
      const el = n.parentElement
      if (!el || el.closest('svg,script,style,option')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const fs = parseFloat(cs.fontSize)
      if (fs < 12) out.push(`${fs}px "${t.slice(0, 40)}"`)
    }
    return out.slice(0, 8)
  })
}

test.describe('QA G5 responsive sweep of the admin routes', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(90_000 * TIMEOUT_FACTOR)

  for (const [name, path] of ROUTES) {
    test(`E2E-M03-52 ${name}: no horizontal scroll, nothing clipped, text >= 12px, nav reachable`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      await gotoApp(path)
      await expect(page.getByTestId('shell-admin-title')).toBeVisible()
      await page.waitForTimeout(1200)
      await expectNoHorizontalScroll(page)
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }))
      expect(m.sw).toBeLessThanOrEqual(m.iw)
      expect(await clippedOutsideScrollers(page), 'elements past the viewport edge').toEqual([])
      expect(await smallText(page), 'text nodes under 12px in main').toEqual([])
      // Navigation reachable: sidebar from 1024, bottom nav below it.
      if (viewportWidth(page) >= 1024) await expect(page.getByTestId('shell-admin-sidebar')).toBeVisible()
      else await expect(page.getByTestId('shell-admin-bottom-nav')).toBeVisible()
    })
  }

  test('E2E-M03-52 S6 / S9 tables scroll inside their card (not the page) below 1280 and every column is reachable', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    for (const [path, table, last] of [
      ['/admin/subjects', 'subjects-table', 'TINDAKAN'],
      ['/admin/education-levels', 'levels-table', 'TINDAKAN'],
    ] as const) {
      await gotoApp(path)
      await expect(page.getByTestId(table)).toBeVisible()
      const scroller = page.getByTestId(table).locator('xpath=../..')
      const info = await scroller.evaluate((el) => ({
        over: el.scrollWidth - el.clientWidth,
        ox: getComputedStyle(el).overflowX,
      }))
      if (viewportWidth(page) >= 1280) expect(info.over, path).toBeLessThanOrEqual(0)
      else {
        expect(info.over, path).toBeGreaterThan(0)
        expect(['auto', 'scroll']).toContain(info.ox)
        // Scroll the card to the end: the last header becomes visible inside the viewport.
        await scroller.evaluate((el) => (el.scrollLeft = el.scrollWidth))
        const lastTh = page.locator('thead th').last()
        await expect(lastTh).toHaveText(new RegExp(last, 'i'))
        const box = await lastTh.boundingBox()
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth(page) + 1)
      }
      await expectNoHorizontalScroll(page)
    }
  })
})

test.describe('QA G5 seed checks (ordering, inactive demo)', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(90_000 * TIMEOUT_FACTOR)

  test('E2E-M03-05 DV-M03-09: Sains Komputer T3 has no chapter number >= 100 and no repeated Topik n inside a chapter', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum?subject_id=17&education_level_id=9')
    await expect(page.getByTestId('chapter').first()).toBeVisible()
    const nums = (await page.getByTestId('chapter-heading').allInnerTexts()).map((t) =>
      Number(/^Bab (\d+)/.exec(t)?.[1] ?? Number.NaN),
    )
    expect(nums.length).toBeGreaterThan(0)
    for (const n of nums) expect(n).toBeLessThan(100)
    expect(nums).toEqual([...nums].sort((a, b) => a - b))
    const chapters = page.getByTestId('chapter')
    for (let i = 0; i < (await chapters.count()); i++) {
      const heads = await chapters.nth(i).getByTestId('topic-heading').allInnerTexts()
      const topicNums = heads.map((h) => /^Topik ([^:]*):/.exec(h)?.[1]?.trim() ?? '')
      expect(new Set(topicNums).size, `chapter ${String(i)} topic numbers ${topicNums.join(',')}`).toBe(topicNums.length)
    }
  })

  test.describe('with curriculumInactiveDemo', () => {
    test.use({ mockInit: { latency: 0, overrides: { curriculumInactiveDemo: true } } })

    test('E2E-M03-06 inactive chapter and topic are listed without a marker and counted (Sejarah + Darjah 1)', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/curriculum?subject_id=5&education_level_id=1')
      await expect(page.getByTestId('chapter').first()).toBeVisible()
      await expect(page.getByTestId('stat-chapters')).toContainText('3')
      await expect(page.getByTestId('stat-topics')).toContainText('3 / 0')
      const demo = page.getByTestId('chapter').filter({ hasText: 'Bab Tidak Aktif Demo' })
      await expect(demo).toHaveCount(1)
      await expect(demo.getByTestId('chapter-heading')).toHaveText('Bab 3: Bab Tidak Aktif Demo')
      await expect(demo.getByTestId('topic')).toHaveCount(1)
      // No inactive marker (no text such as "Tidak Aktif" besides the name; no badge element).
      const text = (await demo.innerText()).replace(/(Bab|Topik) Tidak Aktif Demo/g, '')
      expect(text).not.toMatch(/tidak aktif|inactive|nyahaktif/i)
      // S3 shows it unchecked.
      await demo.getByTestId('chapter-edit').click()
      await expect(page.getByTestId('chapter-active')).not.toBeChecked()
    })
  })
})

test.describe('QA G5 validation and edge cases', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(90_000 * TIMEOUT_FACTOR)

  test('AC-06.4 S2 blocks an empty subject and an empty level one by one', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/chapters/create')
    await page.getByTestId('chapter-name').fill('Tanpa Pasangan')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/chapters\/create/)
    expect(await page.getByTestId('chapter-subject').evaluate((e) => (e as HTMLSelectElement).validity.valueMissing)).toBe(true)
    await page.getByTestId('chapter-subject').selectOption('3')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/chapters\/create/)
    expect(await page.getByTestId('chapter-level').evaluate((e) => (e as HTMLSelectElement).validity.valueMissing)).toBe(true)
    await page.getByTestId('chapter-level').selectOption('10')
    await page.getByTestId('chapter-number').fill('-3')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/chapters\/create/)
    expect(await page.getByTestId('chapter-number').evaluate((e) => (e as HTMLInputElement).validity.rangeUnderflow)).toBe(true)
  })

  test('AC-13.5 S7 blocks order -1; AC-18.2 S10 blocks a missing stage and order -1', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects/create')
    await page.getByTestId('subject-name').fill('X')
    await page.getByTestId('subject-name-en').fill('X')
    await page.getByTestId('subject-code').fill('XX1')
    await page.getByTestId('subject-order').fill('-1')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/subjects/create')
    expect(await page.getByTestId('subject-order').evaluate((e) => (e as HTMLInputElement).validity.rangeUnderflow)).toBe(true)

    await gotoApp('/admin/education-levels/create')
    await page.getByTestId('level-name').fill('X')
    await page.getByTestId('level-name-en').fill('X')
    await page.getByTestId('level-code').fill('X1')
    await page.getByTestId('level-curriculum').fill('KSSR')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/education-levels/create')
    expect(await page.getByTestId('level-stage').evaluate((e) => (e as HTMLSelectElement).validity.valueMissing)).toBe(true)
    await page.getByTestId('level-stage').selectOption('primary')
    await page.getByTestId('level-order').fill('-1')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/education-levels/create')
    expect(await page.getByTestId('level-order').evaluate((e) => (e as HTMLInputElement).validity.rangeUnderflow)).toBe(true)
  })

  test('AC-13.6 / 18.3 a code typed in lower case collides with an existing upper-case code (S7 "math", S10 "d1")', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects/create')
    await page.getByTestId('subject-name').fill('Salinan')
    await page.getByTestId('subject-name-en').fill('Copy')
    await page.getByTestId('subject-code').fill('math')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('subject-form-alert')).toContainText('The code has already been taken.')

    await gotoApp('/admin/education-levels/create')
    await page.getByTestId('level-name').fill('Salinan')
    await page.getByTestId('level-name-en').fill('Copy')
    await page.getByTestId('level-code').fill('d1')
    await page.getByTestId('level-stage').selectOption('primary')
    await page.getByTestId('level-curriculum').fill('KSSR')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('level-form-alert')).toContainText('The code has already been taken.')
  })

  test('S8 / S11 saving an unchanged record keeps its own code (no false duplicate)', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects/3/edit')
    await expect(page.getByTestId('subject-code')).toHaveValue('MATH')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/subjects')
    await gotoApp('/admin/education-levels/10/edit')
    await expect(page.getByTestId('level-code')).toHaveValue('T4')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/education-levels')
  })

  test('S8 changing the code to another subject\'s code is rejected and the input is kept', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/subjects/3/edit')
    await page.getByTestId('subject-code').fill('BM')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('subject-form-alert')).toContainText('The code has already been taken.')
    await expect(page.getByTestId('subject-code')).toHaveValue('BM')
    await expect(page).toHaveURL(/\/admin\/subjects\/3\/edit/)
  })

  test('long unbroken names wrap on S1 / S6 and markup in a name is shown as text, at every width', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    const long = 'Panjang'.repeat(30)
    await gotoApp('/admin/curriculum/chapters/create?subject_id=2&education_level_id=9')
    await page.getByTestId('chapter-name').fill(long)
    await page.getByTestId('chapter-description').fill(`${long} <img src=x onerror="window.__xss=1">`)
    await page.getByTestId('chapter-number').fill('1')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('chapter')).toHaveCount(1)
    await expect(page.getByTestId('chapter-heading')).toContainText(long.slice(0, 40))
    await expectNoHorizontalScroll(page)
    expect(await page.locator('main img[src="x"]').count()).toBe(0)
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
    expect(await clippedOutsideScrollers(page)).toEqual([])

    await gotoApp('/admin/subjects/create')
    await page.getByTestId('subject-name').fill(long)
    await page.getByTestId('subject-name-en').fill('<b>bold</b>')
    await page.getByTestId('subject-code').fill('LONG1')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/subjects')
    await expect(page.getByTestId('subject-row').filter({ hasText: long.slice(0, 40) })).toHaveCount(1)
    await expectNoHorizontalScroll(page)
    expect(await page.locator('main b').count()).toBe(0)
  })

  test('S1 with an unknown or malformed pair in the query does not crash or scroll sideways', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    for (const q of [
      'subject_id=99999&education_level_id=1',
      'subject_id=3&education_level_id=99999',
      'subject_id=abc&education_level_id=xyz',
      'subject_id=-1&education_level_id=0',
    ]) {
      await gotoApp(`/admin/curriculum?${q}`)
      await expect(page.getByTestId('curriculum-filter'), q).toBeVisible()
      await expect(page.getByTestId('shell-admin-title'), q).toHaveText('Pengurusan Kurikulum')
      await expectNoHorizontalScroll(page)
      // No raw error / blank page: either the prompt, an empty tree or a red message box.
      const visible = await page
        .locator('[data-testid=curriculum-prompt], [data-testid=tree-empty], [data-testid=curriculum-tree], [data-testid=curriculum-load-error], [data-testid=cmp-flash]')
        .count()
      expect(visible, q).toBeGreaterThan(0)
    }
  })

  test('S3 / S5 with an unknown id inside a form keep the red flash once; S5 of a deleted topic redirects', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/curriculum/topics/999999/edit')
    await expect(page).toHaveURL(/\/admin\/curriculum$/)
    await expect(page.getByTestId('cmp-flash')).toHaveText('Topik tidak dijumpai.')
    await gotoApp('/admin/curriculum/chapters/999999/edit')
    await expect(page.getByTestId('cmp-flash')).toHaveText('Bab tidak dijumpai.')
    await gotoApp('/admin/education-levels/999999/edit')
    await expect(page).toHaveURL('/admin/education-levels')
    await expect(page.getByText('Tahap Pendidikan tidak dijumpai.')).toBeVisible()
    await gotoApp('/admin/subjects/999999/edit')
    await expect(page).toHaveURL('/admin/subjects')
    await expect(page.getByText('Subjek tidak dijumpai.')).toBeVisible()
    // Non-numeric ids on S8 / S11 (observation, spec silent): no crash, no sideways scroll.
    for (const path of ['/admin/subjects/abc/edit', '/admin/education-levels/abc/edit']) {
      await gotoApp(path)
      await expect(page.locator('main')).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })

  test('S9 stage badges carry an icon and the three observed labels (AC-15.2)', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/education-levels')
    const badges = page.getByTestId('level-stage')
    await expect(badges).toHaveCount(11)
    for (const b of await badges.all()) await expect(b.locator('svg, i').first()).toBeVisible()
    const labels = new Set((await badges.allInnerTexts()).map((s) => s.trim()))
    expect([...labels].sort()).toEqual(['Menengah Atas', 'Menengah Rendah', 'Rendah'])
  })
})
