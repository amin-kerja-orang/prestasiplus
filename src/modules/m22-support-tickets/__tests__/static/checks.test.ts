/**
 * Static checks (SRS M22 v1.1 §12): CHK-M22-01 (no e-mail other than `@demo.test`, no real person's name in
 * the M22 files) and CHK-M22-02 / FR-M22-49 (the S1 and S2 templates carry no `aria-*` attribute the server
 * markup lacks, D10). The real-name list lives outside the repository; here the e-mail rule and the seed
 * names are checked, and the name list is read only when the environment gives its path.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const REPO = fileURLToPath(new URL('../../../../../', import.meta.url))

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const sources = (): string[] => {
  const files = walk(ROOT).filter((f) => !f.endsWith('checks.test.ts'))
  const e2e = join(REPO, 'e2e', 'm22-support-tickets')
  return [...files, ...(existsSync(e2e) ? walk(e2e) : [])]
}

describe('CHK-M22-01', () => {
  it('uses no e-mail other than @demo.test', () => {
    const bad: string[] = []
    for (const f of sources()) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
        if (!m[0].endsWith('@demo.test')) bad.push(`${f}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('uses no name from the private list when its path is given (M22_NAME_LIST)', () => {
    const list = process.env.M22_NAME_LIST
    if (!list || !existsSync(list)) return
    const names = readFileSync(list, 'utf8')
      .split(/\r?\n/)
      .map((n) => n.trim().toLowerCase())
      .filter((n) => n.length > 3)
    const all = sources().map((f) => readFileSync(f, 'utf8').toLowerCase())
    for (const n of names)
      expect(
        all.some((t) => t.includes(n)),
        n,
      ).toBe(false)
  })
})

describe('CHK-M22-02', () => {
  it('has no aria-* attribute in the S1 and S2 templates (the server markup has none)', () => {
    for (const page of ['TicketsPage.vue', 'AdminTicketsPage.vue']) {
      const text = readFileSync(join(ROOT, 'pages', page), 'utf8')
      expect(/aria-[a-z]+=|role=/.test(text), page).toBe(false)
    }
  })
})
