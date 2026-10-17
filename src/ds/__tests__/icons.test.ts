import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import { dsIconBaseNames, dsIconClasses } from '@/theme/ds-icons'
import { iconBundle } from '@/theme/ui.config'

const require = createRequire(import.meta.url)
const ph = JSON.parse(readFileSync(require.resolve('@iconify-json/ph/icons.json'), 'utf8')) as {
  icons: Record<string, unknown>
}

describe('DsIcon name registry', () => {
  it('every registered name exists in Phosphor in all three weights', () => {
    const missing = dsIconClasses.filter((c) => !(c.replace('i-ph-', '') in ph.icons))
    expect(missing).toEqual([])
  })
  it('3 weights per base name, all added to the offline icon bundle', () => {
    expect(dsIconClasses).toHaveLength(dsIconBaseNames.length * 3)
    for (const c of dsIconClasses) expect(iconBundle.icons).toContain(c)
  })
})
