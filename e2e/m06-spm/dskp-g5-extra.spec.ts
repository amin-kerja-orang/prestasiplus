/**
 * G5 acceptance of v2-dskp-integration, part 4: the student side (a tagged seed shows its unit
 * title, a flagged seed forms no bucket), dark mode, the subject lists outside the tag block, the
 * performance budget (NFR-01) and regression tests for the defects found by QA (fixed, see the report).
 */
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTouchTarget, viewportWidth } from '../support'
import {
  ADMIN,
  SUBJECTS_13,
  applyFilters,
  fillBasics,
  makePaperPdf,
  openFilters,
  openIssues,
  optionTexts,
  setFilter,
  shot,
  startManual,
  tid,
} from './dskp-g5-support'

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

/* ------------------------------------------------------------------------------ student side */

test.describe('Student side (US-08, AC-07.5, G2 5.4)', () => {
  test('AC-08.1 AC-07.5: a tagged seed shows its catalogue unit title as topic; a flagged seed forms no "Perlu semakan tag" bucket', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/spm/bijak')
    await page.getByTestId('open-sn-k2-2025-a').click()
    await expect(tid(page, 'bijak-cover')).toBeVisible()
    await tid(page, 'cover-start').click()
    await expect(tid(page, 'attempt-shell')).toBeVisible()
    // `isVisible()` does not wait: let the first question render before walking to the last one,
    // otherwise on a slow machine the loop is skipped and the page re-renders under the click.
    await expect(tid(page, 'next')).toBeVisible()
    while (await tid(page, 'next').isVisible()) await tid(page, 'next').click()
    await expect(tid(page, 'submit')).toBeVisible()
    await tid(page, 'submit').click()
    await tid(page, 'confirm-submit').click()
    await expect(tid(page, 'win-screen')).toBeVisible()
    // Sains K2 holds one tagged seed (sn2-laju-v1, SP 11.1.3) and four flagged ones.
    const weak = tid(page, 'weak-topics')
    await expect(weak).toBeVisible()
    await expect(weak).toContainText('Force and Motion')
    const text = await weak.innerText()
    expect(text).not.toContain('Perlu semakan tag')
    expect(text.match(/markah hilang/g)).toHaveLength(1) // only the tagged unit forms a bucket
    await expectNoHorizontalScroll(page)
    await shot(weak, 'student-weak-topics')
  })

  test('AC-07.5: a paper made only of flagged seeds forms no weak-topic bucket at all', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/spm/bijak')
    await page.getByTestId('open-sej-k2-2025-a').click()
    await expect(tid(page, 'bijak-cover')).toBeVisible()
    await tid(page, 'cover-start').click()
    await expect(tid(page, 'attempt-shell')).toBeVisible()
    // `isVisible()` does not wait: let the first question render before walking to the last one,
    // otherwise on a slow machine the loop is skipped and the page re-renders under the click.
    await expect(tid(page, 'next')).toBeVisible()
    while (await tid(page, 'next').isVisible()) await tid(page, 'next').click()
    await expect(tid(page, 'submit')).toBeVisible()
    await tid(page, 'submit').click()
    await tid(page, 'confirm-submit').click()
    await expect(tid(page, 'win-screen')).toBeVisible()
    await expect(tid(page, 'weak-topics')).toHaveCount(0)
    await expect(page.getByText('Perlu semakan tag')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})

/* ---------------------------------------------------------------------------------- dark mode */

/** WCAG contrast of every text leaf under `root` against its effective background (canvas-normalised). */
async function lowContrast(root: Locator): Promise<{ checked: number; bad: string[] }> {
  return root.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255]
    }
    const over = (top: number[], bottom: number[]): [number, number, number] => {
      const a = top[3]!
      return [0, 1, 2].map((i) => top[i]! * a + bottom[i]! * (1 - a)) as [number, number, number]
    }
    const bgOf = (node: Element): [number, number, number] => {
      const chain: Element[] = []
      for (let e: Element | null = node; e; e = e.parentElement) chain.push(e)
      let base: [number, number, number] = [255, 255, 255]
      for (const e of chain.reverse()) {
        const c = rgba(getComputedStyle(e).backgroundColor)
        if (c[3] > 0) base = over(c, base)
      }
      return base
    }
    const lum = (c: number[]): number => {
      const f = (v: number): number => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!)
    }
    const bad: string[] = []
    let checked = 0
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = walker.nextNode())) {
      const t = n.textContent?.trim()
      const p = n.parentElement
      if (!t || !p || p.closest('option, script, style, [aria-hidden="true"], .sr-only, .katex-mathml, [aria-current="page"]')) continue
      const cs = getComputedStyle(p)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      if (p.closest(':disabled, [aria-disabled="true"], [disabled]')) continue
      const fg = rgba(cs.color)
      const bg = bgOf(p)
      const fgc = over(fg, bg)
      const l1 = lum(fgc)
      const l2 = lum(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const size = Number.parseFloat(cs.fontSize)
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
      checked++
      if (ratio < (large ? 3 : 4.5)) {
        bad.push(`${t.slice(0, 40)} (${ratio.toFixed(2)}:1, ${size}px) in <${p.tagName.toLowerCase()} class="${String(p.className).slice(0, 80)}"> parent <${p.parentElement?.tagName.toLowerCase()} class="${String(p.parentElement?.className).slice(0, 80)}"> fg ${cs.color} bg ${bg.map(Math.round)}`)
      }
    }
    return { checked, bad }
  })
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('pp.theme', t)
    } catch {
      /* private mode */
    }
  }, theme)
}

test.describe('Dark mode spot check (design 11, theme light + dark)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`AC-04.8 NFR-04: Tag DSKP block (Matematik and Pendidikan Islam Jawi) in ${theme} mode: readable text, no overflow`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await setTheme(page, theme)
      await loginAs(ADMIN)
      const block = await startManual(page, gotoApp, 'MAT')
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark')
      await tid(page, 'q-form').selectOption('T4')
      await tid(page, 'q-unit').selectOption('MAT:T4:u:4.0')
      await tid(page, 'sp-option-4.1.1').click()
      await tid(page, 'q-tp').selectOption('3')
      await tid(page, 'q-kbat').selectOption('menilai')
      await expectNoHorizontalScroll(page)
      const r = await lowContrast(block)
      expect(r.checked).toBeGreaterThan(20)
      expect(r.bad, `low contrast in ${theme}`).toEqual([])
      await shot(block, `dark-${theme}-tag-block`)

      // The question flag alert and the T1-T3 caption.
      await tid(page, 'q-form').selectOption('T1-T3')
      const r2 = await lowContrast(block)
      expect(r2.bad, `low contrast (T1-T3) in ${theme}`).toEqual([])
      await shot(block, `dark-${theme}-tag-block-t1t3`)

      // Pendidikan Islam (Jawi rows, flagged badges).
      await gotoApp('/admin/spm/soalan/manual')
      await expect(tid(page, 'intake-subject')).toBeVisible()
      await tid(page, 'intake-subject').selectOption('PI')
      await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
      await tid(page, 'intake-copyright').selectOption('sendiri')
      await tid(page, 'manual-start').click()
      const pi = tid(page, 'tag-block')
      await expect(pi).toBeVisible()
      await tid(page, 'q-form').selectOption('T4')
      await tid(page, 'q-unit').selectOption('PI:T4:u:1')
      await tid(page, 'sp-option-1.26.1').click()
      await tid(page, 'q-tp').selectOption('2')
      const r3 = await lowContrast(pi)
      expect(r3.bad, `low contrast (Jawi) in ${theme}`).toEqual([])
      await expectNoHorizontalScroll(page)
      await shot(pi, `dark-${theme}-pi-jawi`)
    })

    test(`AC-09.3: Bank Soalan SPM, filters open, drawer of a flagged question in ${theme} mode`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await setTheme(page, theme)
      await loginAs(ADMIN)
      await gotoApp('/admin/spm/soalan')
      await expect(page.locator('[data-testid^="bank-open-"]').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark')
      const rows = await lowContrast(tid(page, 'bank-table'))
      expect(rows.checked).toBeGreaterThan(20)
      expect(rows.bad, `low contrast in bank table (${theme})`).toEqual([])
      await expectNoHorizontalScroll(page)
      await shot(page, `dark-${theme}-bank`)
      await tid(page, 'bank-search').fill('mat1-kecerunan-v1')
      await tid(page, 'bank-search').press('Enter')
      await tid(page, 'bank-open-mat1-kecerunan-v1').click()
      await expect(tid(page, 'bank-tag-alert')).toBeVisible()
      const drawer = await lowContrast(tid(page, 'bank-drawer'))
      expect(drawer.bad, `low contrast in drawer (${theme})`).toEqual([])
      await shot(page, `dark-${theme}-bank-drawer`)
    })
  }
})

/* ---------------------------------------------------------------------------- NFR-01, AC-10.4 */

test.describe('Performance and the audit trail', () => {
  test('NFR-01: the SP list filters as you type and the unit list opens in under 300 ms once the catalogue is loaded', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await startManual(page, gotoApp, 'PM')
    await tid(page, 'q-form').selectOption('T4')
    // The first unit pays the lazy load of the subject chunk; then measure the next actions.
    await tid(page, 'q-unit').selectOption('PM:T4:u:5.1')
    const t = await page.evaluate(async () => {
      const unit = document.querySelector('[data-testid="q-unit"]') as HTMLSelectElement
      const form = document.querySelector('[data-testid="q-form"]') as HTMLSelectElement
      const set = (el: HTMLSelectElement, v: string) => {
        el.value = v
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      const t0 = performance.now()
      set(form, 'T5')
      await nextFrame()
      const toT5 = performance.now() - t0
      const t1 = performance.now()
      set(unit, (unit.options[1] as HTMLOptionElement).value)
      await nextFrame()
      const toUnit = performance.now() - t1
      const search = document.querySelector('[data-testid="sp-search"]') as HTMLInputElement
      const t2 = performance.now()
      search.value = 'moral'
      search.dispatchEvent(new Event('input', { bubbles: true }))
      await nextFrame()
      const toSearch = performance.now() - t2
      return { toT5, toUnit, toSearch }
    })
    expect(t.toT5).toBeLessThan(300)
    expect(t.toUnit).toBeLessThan(300)
    expect(t.toSearch).toBeLessThan(300)
  })

  test('AC-10.4: nothing in a history list can be edited or deleted from the UI', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/semakan')
    await tid(page, 'queue-open-mat2-rev-g1').click()
    const hist = tid(page, 'review-history')
    await expect(hist).toBeVisible()
    await expect(hist.locator('li').first()).toBeVisible()
    await expect(hist.locator('button, input, textarea, select, [role="button"], a')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})

/* ------------------------------------------------------------- touch targets of the confirmations */

test.describe('Touch targets (NFR-06)', () => {
  test('AC-04.8 NFR-06: SP rows, chip remove buttons and selects are at least 44 px high', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    const block = await startManual(page, gotoApp, 'MAT')
    await tid(page, 'q-form').selectOption('T4')
    await tid(page, 'q-unit').selectOption('MAT:T4:u:1.0')
    for (const code of ['1.1.1', '1.1.6', '1.1.8']) {
      await expectTouchTarget(tid(page, `sp-option-${code}`).locator('xpath=ancestor::li'))
    }
    // A tap anywhere on the 44 px row (here its text, away from the 24 px box) toggles the SP.
    const row = tid(page, 'sp-option-1.1.6').locator('xpath=ancestor::li')
    await row.getByText('Menentukan punca suatu persamaan kuadratik', { exact: false }).click()
    await expect(tid(page, 'sp-chip-1.1.6')).toBeVisible()
    await expectTouchTarget(tid(page, 'sp-remove-1.1.6'))
    for (const id of ['q-form', 'q-unit', 'q-tp', 'q-kbat', 'sp-search']) await expectTouchTarget(tid(page, id))
    // Every input, select and button of the block is at least 44 px tall (the 44 px label rows included).
    const small = await block.evaluate((el) => {
      const out: string[] = []
      // A checkbox itself is 24 px; its 44 px row is the label (asserted above), as the DS defines.
      for (const c of el.querySelectorAll('select, input:not([type=checkbox]), button:not([role=checkbox]), [role=button]')) {
        const r = (c as HTMLElement).getBoundingClientRect()
        if (r.width > 0 && r.height > 0 && r.height < 43.9) out.push(`${c.tagName} ${c.getAttribute('data-testid') ?? ''} ${r.height.toFixed(1)}`)
      }
      return out
    })
    expect(small).toEqual([])
  })
})

/* ------------------------------------------------------------------ QA findings (fixed) */

test.describe('Defects found by QA, fixed (regression tests)', () => {
  test('DSKP-G5-01 (AC-03.1, design 8): the intake list Subjek filter lists the 13 catalogue subjects', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan/ekstrak')
    await expect(tid(page, 'intake-list-page')).toBeVisible()
    // Below md the selects live in the "Penapis" sheet (outside the bar), from md they sit in the bar.
    if (viewportWidth(page) < 768) await page.getByRole('button', { name: /^Penapis( \d+)?$/ }).first().click()
    const sel = page.getByLabel('Subjek', { exact: true })
    await expect(sel).toBeVisible()
    expect(await optionTexts(sel)).toEqual(['Semua subjek', ...SUBJECTS_13])
  })

  test('DSKP-G5-02 (AC-04.9, design 3.6): a question the AI cannot place at all says "AI tidak menjumpai unit yang sepadan"', async ({
    page,
    browser,
    loginAs,
    gotoApp,
  }) => {
    const pdf = await makePaperPdf(browser, [
      ['Kertas QA', 'Bahagian A', '1. Apakah warna langit pada waktu pagi? [1 markah]'].join('\n'),
    ])
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan/muat-naik')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('MAT')
    await tid(page, 'intake-source').fill('Kertas percubaan QA')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await page.locator('input[type=file]').setInputFiles({
      name: 'qa-nomatch.pdf',
      mimeType: 'application/pdf',
      buffer: pdf,
    })
    await tid(page, 'intake-submit').click()
    await expect(tid(page, 'intake-review-page')).toBeVisible({ timeout: 90_000 })
    const card = page.locator('[data-testid="question-card"][data-label="1"]')
    const head = card.locator('button[aria-expanded]').first()
    if ((await head.getAttribute('aria-expanded')) !== 'true') await head.click()
    const block = card.getByTestId('tag-block')
    await block.scrollIntoViewIfNeeded()
    await expect(block.getByTestId('q-unit')).toHaveValue('') // not auto-filled: this part is right
    // Nothing to confirm for an empty unit: the gate asks for a value, not for a confirmation.
    expect(await openIssues(page)).not.toContain('Soalan 1: Medan keyakinan rendah belum disahkan: unit DSKP.')
    await shot(block, 'intake-no-match-q1')
    await expect(block.getByTestId('ai-no-match')).toContainText(
      'AI tidak menjumpai unit yang sepadan. Pilih secara manual.',
    )
  })
})

/* ------------------------------------------------------------ server gates, run inside the page */

const CLIENT = '/src/modules/m28-bijak-spm/server/client.ts'

test.describe('The one tag rule at the server (US-07): same messages on submit, revision and publish', () => {
  test('AC-07.1 AC-07.3 AC-07.7 AC-05.4 AC-06.3: revision gate matrix, run against the real server in the page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan')
    await expect(tid(page, 'bank-page')).toBeVisible()
    const res = await page.evaluate(async (url) => {
      const m = (await import(/* @vite-ignore */ url)) as {
        bijakServer: () => {
          getBankEditable: (q: string) => Promise<{ question: Record<string, unknown> & { tag: Record<string, unknown> }; stimulus?: unknown }>
          reviseQuestionFull: (q: string, e: unknown, s: unknown, n: string) => Promise<{ ok: boolean; errors: string[] }>
        }
      }
      const s = m.bijakServer()
      const ed = await s.getBankEditable('mat2-kuadratik-v1')
      const base = JSON.parse(JSON.stringify(ed.question)) as typeof ed.question
      const run = async (patch: Record<string, unknown>): Promise<string[]> => {
        const q = { ...base, tag: { ...base.tag, ...patch } }
        const r = await s.reviseQuestionFull('mat2-kuadratik-v1', q, ed.stimulus, 'QA')
        return r.ok ? ['OK'] : r.errors
      }
      return {
        base: base.tag,
        noUnit: await run({ unitId: null }),
        ghostUnit: await run({ unitId: 'MAT:T4:u:99.0' }),
        otherFormUnit: await run({ unitId: 'MAT:T5:u:1.0' }),
        noSp: await run({ spIds: [] }),
        spOutside: await run({ spIds: ['MAT:T4:sp:2.1.1'] }),
        spTwice: await run({ spIds: ['MAT:T4:sp:1.1.6', 'MAT:T4:sp:1.1.6'] }),
        noTp: await run({ tp: null }),
        tp7: await run({ tp: 7 }),
        tp0: await run({ tp: 0 }),
        tp35: await run({ tp: 3.5 }),
        badKbat: await run({ kbat: 'hebat' }),
        noForm: await run({ formOrigin: null }),
        t13WithUnit: await run({ formOrigin: 'T1-T3' }),
      }
    }, CLIENT)
    expect(res.base).toMatchObject({ formOrigin: 'T4', unitId: 'MAT:T4:u:1.0', spIds: ['MAT:T4:sp:1.1.6'], tp: 2, kbat: null })
    const has = (errs: string[], text: string): boolean => errs.some((e) => e === text || e.endsWith(`: ${text}`))
    expect(has(res.noUnit, 'Unit DSKP belum dipilih.')).toBe(true)
    expect(has(res.ghostUnit, 'Unit DSKP tidak wujud dalam katalog.')).toBe(true)
    expect(has(res.otherFormUnit, 'Unit DSKP tidak wujud dalam katalog.')).toBe(true)
    expect(has(res.noSp, 'Standard Pembelajaran (SP) belum dipilih.')).toBe(true)
    expect(has(res.spOutside, 'SP tidak wujud dalam unit yang dipilih.')).toBe(true)
    expect(has(res.spTwice, 'SP yang sama dipilih lebih daripada sekali.')).toBe(true)
    expect(has(res.noTp, 'Tahap Penguasaan (TP) belum dipilih.')).toBe(true)
    for (const k of ['tp7', 'tp0', 'tp35'] as const) {
      expect(has(res[k], 'Tahap Penguasaan (TP) mesti antara 1 dan 6.'), k).toBe(true)
    }
    expect(has(res.badKbat, 'Aras KBAT tidak sah.')).toBe(true)
    expect(has(res.noForm, 'Subjek dan tingkatan perlu ditetapkan.')).toBe(true)
    expect(has(res.t13WithUnit, 'Tingkatan 1-3 (di luar DSKP) tidak mempunyai unit atau SP.')).toBe(true)
  })

  test('AC-07.1 AC-07.3: submit (Hantar untuk semakan) is refused at the server with the same messages', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await startManual(page, gotoApp, 'MAT')
    await fillBasics(page)
    await expect(tid(page, 'save-state')).toContainText('Semua perubahan disimpan')
    const id = new URL(page.url()).pathname.split('/').pop()!
    const submit = (): Promise<{ ok: boolean; issues?: { where: string; message: string }[] }> =>
      page.evaluate(
        async ([url, batch]) => {
          // A fresh module copy per call: its server instance reads the autosaved batch from storage again.
          const m = (await import(/* @vite-ignore */ `${url!}?fresh=${Date.now()}`)) as {
            bijakServer: () => { submitForReview: (b: string) => Promise<{ ok: boolean; issues?: { where: string; message: string }[] }> }
          }
          return await m.bijakServer().submitForReview(batch!)
        },
        [CLIENT, id],
      )
    const r1 = await submit()
    expect(r1.ok).toBe(false)
    expect(r1.issues!.map((i) => `${i.where}: ${i.message}`)).toEqual(
      expect.arrayContaining([
        'Soalan 1: Subjek dan tingkatan perlu ditetapkan.',
        'Soalan 1: Tahap Penguasaan (TP) belum dipilih.',
      ]),
    )
    await tid(page, 'q-form').selectOption('T4')
    // The autosave is debounced and the label still reads "saved" right after the change: poll the server.
    await expect
      .poll(async () => (await submit()).issues?.some((i) => i.message === 'Unit DSKP belum dipilih.'))
      .toBe(true)
    const r2 = await submit()
    expect(r2.ok).toBe(false)
    expect(r2.issues!.map((i) => `${i.where}: ${i.message}`)).toEqual(
      expect.arrayContaining([
        'Soalan 1: Unit DSKP belum dipilih.',
        'Soalan 1: Standard Pembelajaran (SP) belum dipilih.',
        'Soalan 1: Tahap Penguasaan (TP) belum dipilih.',
      ]),
    )
    // The UI list says the same, word for word.
    const ui = await openIssues(page)
    for (const i of r2.issues!) expect(ui).toContain(`${i.where}: ${i.message}`)
  })
})

/* -------------------------------------------------------------- the good outcome of the flag filter */

test.describe('When nothing is flagged any more (AC-08.3, design 6.3)', () => {
  test.use({ mockInit: { latency: 0 } })
  test('"Semua soalan sudah bertag." shows only when "Perlu semakan tag" is the only chip on Diterbitkan or Semua', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.setTimeout(420_000)
    await loginAs(ADMIN)
    await gotoApp('/admin/spm/soalan')
    await expect(tid(page, 'bank-page')).toBeVisible()
    // Tag every flagged Terbit seed through the real server (revision + approval), as an admin would
    // do one by one in Sunting and the queue, so the filter can reach its empty good outcome.
    const left = await page.evaluate(async (url) => {
      const m = (await import(/* @vite-ignore */ url)) as {
        bijakServer: () => {
          listBank: (f: object) => Promise<{ id: string }[]>
          getBankEditable: (q: string) => Promise<{ question: { tag: Record<string, unknown> }; stimulus?: unknown }>
          reviseQuestionFull: (q: string, e: unknown, s: unknown, n: string) => Promise<{ ok: boolean; errors: string[] }>
          reviewDecision: (k: string, d: { action: string }) => Promise<{ ok: boolean; errors: string[] }>
        }
      }
      const s = m.bijakServer()
      const flagged = await s.listBank({ status: 'terbit', tagReview: true })
      const failed: string[] = []
      for (const row of flagged) {
        const ed = await s.getBankEditable(row.id)
        const q = JSON.parse(JSON.stringify(ed.question)) as typeof ed.question
        q.tag = { ...q.tag, formOrigin: 'T1-T3', unitId: null, spIds: [] }
        const a = await s.reviseQuestionFull(row.id, q, ed.stimulus, 'QA tag semula')
        const b = a.ok ? await s.reviewDecision(`v:${row.id}`, { action: 'terbit' }) : a
        if (!b.ok) failed.push(`${row.id}: ${b.errors.join(' | ')}`)
      }
      return { n: flagged.length, failed, remaining: (await s.listBank({ status: 'terbit', tagReview: true })).length }
    }, CLIENT)
    expect(left.n).toBe(25) // 28 flagged seeds, 3 of them still waiting in the queue
    expect(left.failed).toEqual([])
    expect(left.remaining).toBe(0)

    await gotoApp('/admin/spm/soalan')
    await expect(page.locator('[data-testid^="bank-open-"]').first()).toBeVisible()
    await openFilters(page)
    await tid(page, 'bank-tag-review').click()
    await applyFilters(page, 'bank-filter')
    await expect(page.getByText('Tiada soalan dijumpai')).toBeVisible()
    await expect(page.getByText('Semua soalan sudah bertag.')).toBeVisible()
    await expect(page.getByText('Cuba ubah atau set semula penapis.')).toHaveCount(0)
    await shot(page, 'bank-all-tagged')
    await expectNoHorizontalScroll(page)
    // With Draf (or another curriculum chip) the empty list says nothing about tags.
    await page.keyboard.press('Escape')
    await setFilter(page, 'bank-status', 'draf')
    await applyFilters(page, 'bank-filter')
    await expect(page.getByText('Semua soalan sudah bertag.')).toHaveCount(0)
    await expect(page.getByText('Cuba ubah atau set semula penapis.')).toBeVisible()
    // The three flagged questions still in the review queue are counted under "Semua status".
    await setFilter(page, 'bank-status', 'semua')
    await applyFilters(page, 'bank-filter')
    await expect(page.locator('p[role="status"]').filter({ hasText: 'daripada 3 hasil' })).toBeVisible()
  })

  for (const bar of ['bank', 'queue'] as const) {
    test(`DSKP-G5-03 (AC-09.3, design 6.1): the long Unit chip of the ${bar} filter stays inside its row (truncated, not clipped, at 375)`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      await gotoApp(bar === 'bank' ? '/admin/spm/soalan' : '/admin/spm/semakan')
      await expect(tid(page, `${bar}-filter`)).toBeVisible()
      await setFilter(page, `${bar}-subject`, 'MAT')
      await setFilter(page, `${bar}-form`, 'T4')
      await setFilter(page, `${bar}-unit`, 'MAT:T4:u:1.0')
      await applyFilters(page, `${bar}-filter`)
      const chip = tid(page, 'active-filter').filter({ hasText: 'Unit 1.0' })
      await expect(chip).toBeVisible()
      const box = (await chip.boundingBox())!
      const row = (await tid(page, 'active-filters').boundingBox())!
      expect(box.x + box.width, 'chip right edge').toBeLessThanOrEqual(row.x + row.width + 1)
      expect(box.x + box.width, 'chip right edge in the viewport').toBeLessThanOrEqual(viewportWidth(page))
      await expectTouchTarget(chip)
      await shot(tid(page, 'active-filters'), `${bar}-filter-unit-chip`)
      await shot(page, `${bar}-filter-unit-page`)
      await expect(chip).toHaveAttribute('aria-label', /^Buang penapis Unit 1\.0/)
    })
  }
})

/* ----------------------------------------------------------------------------------- 320 px */

test.describe('Narrowest width (NFR-06, design 2.2: 320 px)', () => {
  test('NFR-06: no sideways page scroll at 320 px in the Tag DSKP block (Matematik, Jawi), bank, drawer and queue', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) !== 375, 'one run is enough: the width is set by the test')
    await page.setViewportSize({ width: 320, height: 700 })
    await loginAs(ADMIN)
    const block = await startManual(page, gotoApp, 'MAT')
    await tid(page, 'q-form').selectOption('T4')
    await tid(page, 'q-unit').selectOption('MAT:T4:u:1.0')
    await tid(page, 'sp-option-1.1.8').click()
    await tid(page, 'q-tp').selectOption('4')
    await tid(page, 'q-kbat').selectOption('mencipta')
    await expectNoHorizontalScroll(page)
    await shot(block, 'w320-tag-block')
    await gotoApp('/admin/spm/soalan/manual')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('PI')
    await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await tid(page, 'manual-start').click()
    await expect(tid(page, 'tag-block')).toBeVisible()
    await tid(page, 'q-form').selectOption('T5')
    await tid(page, 'q-unit').selectOption('PI:T5:u:1')
    await page.locator('[data-testid^="sp-option-"]').first().click()
    await tid(page, 'q-tp').selectOption('5')
    await expectNoHorizontalScroll(page)
    await shot(tid(page, 'tag-block'), 'w320-pi')
    await gotoApp('/admin/spm/soalan')
    await expect(page.locator('[data-testid^="bank-open-"]').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await tid(page, 'bank-search').fill('mat2-kuadratik-v1')
    await applyFilters(page, 'bank-filter')
    await tid(page, 'bank-open-mat2-kuadratik-v1').click()
    await expect(tid(page, 'bank-drawer')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await gotoApp('/admin/spm/semakan')
    await expect(page.locator('[data-testid^="queue-open-"]').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await tid(page, 'queue-open-mat2-rev-g1').click()
    await expect(tid(page, 'review-gate')).toBeVisible()
    await expectNoHorizontalScroll(page)
    await shot(page, 'w320-review-flagged')
  })
})
