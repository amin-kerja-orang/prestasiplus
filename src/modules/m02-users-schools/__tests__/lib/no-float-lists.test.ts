import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * RS5-M1 / SWX4 reverse check: a `behavior="float"` (absolute) result list inside a form-section card is
 * clipped by the card (`overflow-clip`) and cannot be clicked. No m02 component or page may use it.
 */
function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : vueFiles(p)
    return e.name.endsWith('.vue') ? [p] : []
  })
}

describe('m02 result lists', () => {
  it('none uses a floating panel (behavior="float" / tone="float")', () => {
    const root = join(__dirname, '..', '..')
    const offenders = vueFiles(root).filter((f) =>
      /(behavior|tone)=["']float["']/.test(readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '')),
    )
    expect(offenders).toEqual([])
  })
})
