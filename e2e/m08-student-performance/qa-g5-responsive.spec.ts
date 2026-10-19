/**
 * M08 G5 QA sweep (AC-M08-34.1, 34.2, 34.3; E2E-M08-58..60): every built M08 route, per role, at the three
 * project widths: no horizontal page scroll, no M08 content text under 12px (shell excluded), and every
 * table wider than the viewport scrolls inside its own container. The SRS states no touch-target size
 * for M08 screens, so none is asserted here.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

interface Case {
  who: string
  paths: string[]
}

const CASES: Case[] = [
  {
    who: 'admin@demo.test',
    paths: [
      '/prestasi/sekolah',
      '/prestasi/tingkatan',
      '/prestasi/tingkatan/t4',
      '/prestasi/tingkatan/t5',
      '/prestasi/kelas',
      '/prestasi/kelas/228',
      '/prestasi/kelas/516',
      '/prestasi/kelas/4',
      '/analitik/kelas?classroom_id=4',
      '/analitik/kelas?classroom_id=4&subject_id=1&risk_level=low',
      '/analisa-item/kelas',
      '/analisa-item/kelas/228',
      '/analisa-item/kelas/2001',
      '/analisa-item/kelas/6',
      '/analisa-item/sekolah',
      '/analisa-item/sekolah/8880',
      '/analisa-item/sekolah/8765',
      '/analitik/pelajar',
      '/prestasi/1',
      '/prestasi/3001',
      '/prestasi/3201',
      '/prestasi/3008',
      '/headcount',
      '/headcount/dashboard',
      '/headcount/create',
      '/headcount/213',
      '/headcount/213/summary',
      '/headcount/617',
      '/headcount/student/3001',
      '/headcount/student/3201',
      '/ranking',
      '/ranking?scope=nasional&subject_id=3',
      '/leaderboard',
      '/leaderboard?period=all',
      '/leaderboard?period=month',
      '/timeline',
      '/timeline/create',
      '/pelajar/1',
      '/laporan-mingguan',
    ],
  },
  {
    who: 'guru@demo.test',
    paths: [
      '/prestasi/kelas',
      '/prestasi/kelas/2001',
      '/prestasi/kelas/2002',
      '/analitik/kelas?classroom_id=2001&subject_id=10',
      '/analisa-item/kelas',
      '/analisa-item/kelas/2001',
      '/analisa-item/sekolah/8880',
      '/headcount',
      '/headcount/dashboard',
      '/headcount/create',
      '/headcount/501',
      '/headcount/501/summary',
      '/headcount/student/3001',
      '/analitik/pelajar',
      '/ranking',
      '/leaderboard',
    ],
  },
  {
    who: 'adminsekolah@demo.test',
    paths: [
      '/prestasi/sekolah',
      '/prestasi/tingkatan',
      '/prestasi/tingkatan/t4',
      '/analisa-item/sekolah',
      '/headcount',
      '/headcount/dashboard',
      '/analitik/pelajar',
      '/ranking',
      '/leaderboard',
    ],
  },
  {
    who: 'pelajar@demo.test',
    paths: [
      '/prestasi/sekolah',
      '/prestasi/2',
      '/analitik/pelajar',
      '/ranking',
      '/leaderboard',
      '/timeline',
      '/timeline/create',
      '/headcount',
      '/analisa-item/kelas',
      '/laporan-mingguan',
    ],
  },
]

/** Returns M08 content text nodes (inside the shell main, not the shell chrome) under 12px. */
async function smallText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root =
      document.querySelector('[data-testid=shell-user-main]') ??
      document.querySelector('[data-testid=shell-admin-main]') ??
      document.body
    const out: string[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? '').trim()
      if (!text) continue
      const el = n.parentElement
      if (!el || el.closest('script,style,noscript,svg,canvas')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const fs = parseFloat(cs.fontSize)
      if (fs < 12) {
        out.push(
          `${fs}px "${text.slice(0, 40)}" <${el.tagName.toLowerCase()} ${String(el.className).slice(0, 50)}>`,
        )
      }
    }
    return out.slice(0, 8)
  })
}

/** Tables extending past the viewport must have a horizontally scrolling ancestor. */
async function uncontainedTables(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const bad: string[] = []
    for (const t of Array.from(document.querySelectorAll('table'))) {
      const r = t.getBoundingClientRect()
      if (r.width === 0) continue
      let p: HTMLElement | null = t.parentElement
      let ok = false
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll') {
          ok = true
          break
        }
        p = p.parentElement
      }
      if (!ok && r.right > vw + 1) {
        bad.push(
          `table x=${Math.round(r.left)}..${Math.round(r.right)} (viewport ${vw}) ${String(t.className).slice(0, 40)}`,
        )
      }
    }
    return bad
  })
}

for (const c of CASES) {
  test.describe(`M08 G5 sweep as ${c.who}`, { tag: [moduleTag(8)] }, () => {
    test.use({ mockInit: { latency: 0 } })

    for (const path of c.paths) {
      test(`${path}: no h-scroll, text >= 12px, tables contained`, async ({
        page,
        gotoApp,
        loginAs,
      }) => {
        await loginAs(c.who)
        await gotoApp(path)
        const main = page
          .locator('[data-testid=shell-user-main], [data-testid=shell-admin-main], body')
          .first()
        await expect
          .poll(async () => (await main.innerText()).trim().length, { timeout: 8000 })
          .toBeGreaterThan(15)
        await page.waitForTimeout(600)
        await expectNoHorizontalScroll(page)
        expect.soft(await smallText(page), 'text smaller than 12px').toEqual([])
        expect.soft(await uncontainedTables(page), 'table not contained').toEqual([])
      })
    }
  })
}

test.describe('M08 G5 sweep as guest', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  for (const path of ['/pelajar/1', '/pelajar/2']) {
    test(`${path}: no h-scroll, text >= 12px`, async ({ page, gotoApp }) => {
      await gotoApp(path)
      await expect(page.locator('h1').first()).toBeVisible()
      await page.waitForTimeout(500)
      await expectNoHorizontalScroll(page)
      const small = await page.evaluate(() => {
        const out: string[] = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.textContent ?? '').trim()
          const el = n.parentElement
          if (!text || !el || el.closest('script,style,svg,canvas')) continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || el.getBoundingClientRect().width === 0) continue
          if (parseFloat(cs.fontSize) < 12) out.push(`${cs.fontSize} "${text.slice(0, 40)}"`)
        }
        return out.slice(0, 8)
      })
      expect.soft(small, 'text smaller than 12px').toEqual([])
    })
  }
})
