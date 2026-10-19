// Ratchet test (hardening spec 6.4): config/ds-debt.baseline.json may only shrink.
// Fails when a file's count rises, a file absent from the baseline has debt, or a baseline entry is
// 0 / points at a file that no longer exists (remove it with `npm run ds:debt -- --write-baseline`).
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { scanDebt } from '../../scripts/ds-debt.mjs'
import { classifyFamily, looksLikeClassList, RULES } from '../../scripts/lib/ds-debt-scan.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const baseline = JSON.parse(readFileSync(`${ROOT}config/ds-debt.baseline.json`, 'utf8'))

describe('config/ds-debt.baseline.json ratchet', () => {
  const current = scanDebt()

  it('has a section for every rule', () => {
    expect(Object.keys(baseline).sort()).toEqual([...RULES].sort())
  })

  it('has no file whose count rose above its baseline', () => {
    const rose = []
    for (const r of RULES)
      for (const [file, n] of Object.entries(current.byRule[r]))
        if (file in baseline[r] && n > baseline[r][file])
          rose.push(`${r} ${file}: ${baseline[r][file]} -> ${n}`)
    expect(rose).toEqual([])
  })

  it('has no new file with debt (not in the baseline)', () => {
    const added = []
    for (const r of RULES)
      for (const [file, n] of Object.entries(current.byRule[r]))
        if (!(file in baseline[r])) added.push(`${r} ${file}: ${n}`)
    expect(added).toEqual([])
  })

  it('has no zero entry and no entry for a deleted file', () => {
    const stale = []
    for (const r of RULES)
      for (const [file, n] of Object.entries(baseline[r])) {
        if (n <= 0) stale.push(`${r} ${file}: zero`)
        else if (!existsSync(`${ROOT}${file}`)) stale.push(`${r} ${file}: file deleted`)
        else if ((current.byRule[r][file] ?? 0) === 0) stale.push(`${r} ${file}: now clean, remove`)
      }
    expect(stale).toEqual([])
  })

  it('reports progress per rule', () => {
    const lines = RULES.map((r) => {
      const was = Object.values(baseline[r]).reduce((a, b) => a + b, 0)
      return `${r} ${was} -> ${current.totals[r]}`
    })
    console.log(`ds:debt progress: ${lines.join(', ')}`)
    expect(lines).toHaveLength(RULES.length)
  })
})

describe('ds-debt classifier', () => {
  it('attributes tokens to families', () => {
    expect(classifyFamily('text-body')?.family).toBe('type')
    expect(classifyFamily('md:font-semibold')?.family).toBe('type')
    expect(classifyFamily('text-xs')?.code).toBe('stock-size')
    expect(classifyFamily('gap-4')?.family).toBe('spacing')
    expect(classifyFamily('mt-2')?.family).toBe('spacing')
    expect(classifyFamily('rounded-card')?.family).toBe('surface')
    expect(classifyFamily('bg-elevated')?.family).toBe('surface')
    expect(classifyFamily('text-muted')?.family).toBe('colour')
    expect(classifyFamily('bg-slate-100')?.code).toBe('palette')
    expect(classifyFamily('bg-primary/10')?.code).toBe('opacity')
    expect(classifyFamily('flex-col')?.family).toBe('layout')
    expect(classifyFamily('md:grid-cols-3')?.family).toBe('layout')
  })

  it('leaves the allowlisted containment hooks alone', () => {
    for (const t of [
      'min-w-0',
      'w-full',
      'h-full',
      'grow',
      'shrink-0',
      'mx-auto',
      'ms-auto',
      'sr-only',
      'md:hidden',
      'truncate',
      'text-center',
      'i-ph-plus',
    ])
      expect(classifyFamily(t)).toBeNull()
  })

  it('recognises class-list string literals but not copy', () => {
    expect(looksLikeClassList('text-muted text-body')).toBe(true)
    expect(looksLikeClassList('bg-elevated')).toBe(true)
    expect(looksLikeClassList('Simpan perubahan')).toBe(false)
    expect(looksLikeClassList('ms-MY')).toBe(false)
    expect(looksLikeClassList('flex')).toBe(false)
  })
})
