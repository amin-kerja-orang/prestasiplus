import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { textPdf } from '../pdf-fixtures'
import { engine, isPng } from './helpers'

describe('50-page fixture (AC-6)', () => {
  it('renders 50 pages in the worker pool without blocking the event loop; records peak RSS', async () => {
    const pdf = textPdf(50, 40)
    const e = engine({ OCR_WORKERS: 2 })
    expect((await e.inspect(pdf)).pageCount).toBe(50)

    let maxLag = 0
    let last = performance.now()
    const tick = setInterval(() => {
      const now = performance.now()
      maxLag = Math.max(maxLag, now - last - 10)
      last = now
    }, 10)
    let peakRss = process.memoryUsage().rss
    const rssTimer = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss)
    }, 20)
    const rss0 = process.memoryUsage().rss
    const started = performance.now()
    let rendered = 0
    try {
      const pages = Array.from({ length: 50 }, (_, i) => i + 1)
      const results = await Promise.all(
        pages.map(async (n) => {
          const t = await e.extractText(pdf, n)
          const r = await e.render(pdf, n, { dpi: 150, maxPixels: 12_000_000 })
          return { t, r }
        }),
      )
      for (const { t, r } of results) {
        expect(t.blocks.length).toBe(40)
        expect(isPng(r!.png)).toBe(true)
        rendered++
      }
    } finally {
      clearInterval(tick)
      clearInterval(rssTimer)
    }
    const elapsed = Math.round(performance.now() - started)
    const line = `[perf] pages=${rendered} workers=2 elapsed=${elapsed}ms maxEventLoopLag=${Math.round(maxLag)}ms rssStart=${Math.round(rss0 / 1048576)}MB peakRss=${Math.round(peakRss / 1048576)}MB growth=${Math.round((peakRss - rss0) / 1048576)}MB`
    console.log(line)
    writeFileSync('/home/claude/be37-brief/agent-c/perf-last.txt', line + '\n')
    expect(rendered).toBe(50)
    expect(maxLag).toBeLessThan(200)
  }, 240_000)
})
