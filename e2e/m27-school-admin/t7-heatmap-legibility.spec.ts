/**
 * UAT S-52 (T7): DSKP Heatmap legibility. The legend maps colour to meaning, cells keep a tappable size and
 * readable text, and the page never scrolls sideways at 375 / 768 / 1280.
 */

import { mkdirSync } from 'node:fs'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, viewportWidth } from '../support'

const SHOTS = process.env.T7_SHOTS

test.use({ mockInit: { latency: 0 } })
test.describe.configure({ timeout: 300_000 })

for (const [level, subject] of [
  ['T4', null],
  ['T5', null],
  ['T5', 'Kimia'],
] as const) {
  test(`S-52 heatmap ${level} ${subject ?? '(first subject)'} is legible and has a legend`, { tag: ['@m27', '@t7'] }, async ({
    page,
    loginAs,
    gotoApp,
  }, info) => {
    await loginAs('adminsekolah@demo.test')
    await gotoApp(`/admin-sekolah/dskp-heatmap?tingkatan=${level}`)
    await expect(page.getByTestId('dh-card')).toBeVisible({ timeout: 180_000 })
    if (subject) {
      await page.getByTestId('dh-subject').click()
      await page.getByRole('option', { name: subject }).click()
      await expect(page.getByTestId('dh-caption')).toContainText(subject)
    }
    const w = viewportWidth(page)

    // legend: one swatch per status, each with its meaning
    const legend = page.locator('[data-ds="heat-legend"]')
    await expect(legend).toBeVisible()
    for (const label of ['Mahir (75%+)', 'Sederhana (50-74%)', 'Lemah (<50%)', 'Belum Cuba']) {
      await expect(legend).toContainText(label)
    }
    await expect(legend.locator('[data-ds="heat-legend-swatch"]')).toHaveCount(4)

    // cells
    const cells = page.locator('[data-testid="dh-tiles"] [data-ds="heat-cell"]:visible, [data-testid="dh-tiles"] [data-ds="heat-card-cell"]:visible')
    const n = await cells.count()
    if (n > 0) {
      const boxes = await cells.evaluateAll((els) =>
        els.slice(0, 200).map((e) => {
          const r = e.getBoundingClientRect()
          return { w: r.width, h: r.height, fs: parseFloat(getComputedStyle(e).fontSize) }
        }),
      )
      for (const b of boxes) {
        expect(b.h).toBeGreaterThanOrEqual(44)
        expect(b.w).toBeGreaterThanOrEqual(w >= 768 ? 40 : 44)
        expect(b.fs).toBeGreaterThanOrEqual(12)
      }
    }
    await expectNoHorizontalScroll(page)

    // contrast of every coloured cell (text vs. resolved background over the card surface)
    const ratios = await page.evaluate(() => {
      const parse = (c: string): [number, number, number, number] => {
        const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/.exec(c)
        if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255, m[4] === undefined ? 1 : Number(m[4])]
        const r = /rgba?\(([^)]+)\)/.exec(c)
        if (r) {
          const p = (r[1] ?? '').split(/[ ,/]+/).map(Number)
          return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] === undefined ? 1 : p[3]]
        }
        return [0, 0, 0, 0]
      }
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * f(r ?? 0) + 0.7152 * f(g ?? 0) + 0.0722 * f(b ?? 0)
      }
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const toRgba = (c: string): [number, number, number, number] => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255]
      }
      void parse
      const out: number[] = []
      document.querySelectorAll('[data-testid="dh-tiles"] [data-ds="heat-cell"], [data-testid="dh-tiles"] [data-ds="heat-card-cell"]').forEach((el) => {
        const e = el as HTMLElement
        if (e.offsetParent === null) return
        // composite the background chain
        let base: [number, number, number] = [255, 255, 255]
        const chain: Element[] = []
        for (let p: Element | null = e; p; p = p.parentElement) chain.unshift(p)
        for (const p of chain) {
          const [r, g, b, a] = toRgba(getComputedStyle(p).backgroundColor)
          if (a > 0) base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)]
        }
        const [fr, fg, fb] = toRgba(getComputedStyle(e).color)
        const l1 = lum([fr, fg, fb])
        const l2 = lum(base)
        out.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))
      })
      return out
    })
    if (ratios.length > 0) expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5)

    // "Belum Cuba" must not read as "Lemah": a visible (non-transparent) dashed edge and a different fill
    const probe = await page.evaluate(() => {
      const lum = (c: string) => {
        const m = /rgba?\(([^)]+)\)|color\(srgb ([^)]+)\)/.exec(c)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        void m
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        const f = (v: number) => {
          const x = v / 255
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
        }
        return { l: 0.2126 * f(d[0] ?? 0) + 0.7152 * f(d[1] ?? 0) + 0.0722 * f(d[2] ?? 0), a: (d[3] ?? 0) / 255 }
      }
      const surface = (el: Element) => {
        // first non-transparent background up the tree
        for (let p: Element | null = el; p; p = p.parentElement) {
          const bg = getComputedStyle(p).backgroundColor
          if (lum(bg).a > 0) return bg
        }
        return 'rgb(255,255,255)'
      }
      const swatches = [...document.querySelectorAll('[data-ds="heat-legend-swatch"]')]
      const belum = swatches[swatches.length - 1]!
      const lemah = swatches[swatches.length - 2]!
      const edge = getComputedStyle(belum)
      const belumFill = lum(getComputedStyle(belum).backgroundColor).a > 0 ? getComputedStyle(belum).backgroundColor : surface(belum)
      const l1 = lum(belumFill).l
      const l2 = lum(getComputedStyle(lemah).backgroundColor).l
      return {
        style: edge.borderTopStyle,
        width: parseFloat(edge.borderTopWidth),
        edgeAlpha: lum(edge.borderTopColor).a,
        ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
      }
    })
    expect(probe.style).toBe('dashed')
    expect(probe.width).toBeGreaterThan(0)
    expect(probe.edgeAlpha).toBeGreaterThan(0.5)
    expect(probe.ratio).toBeGreaterThanOrEqual(1.15)

    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true })
      await page.screenshot({ path: `${SHOTS}/${info.project.name}-${level}-${subject ?? 'first'}.png`, fullPage: true })
    }
  })
}

