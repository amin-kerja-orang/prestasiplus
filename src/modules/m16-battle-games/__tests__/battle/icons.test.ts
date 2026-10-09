/**
 * Every icon value the S1 lobby supplies resolves through the shared icon resolver (ADR-0010):
 * the subject tiles take M03 `curriculum.subjects()` ids 1-31 (kebab Lucide names, `fas fa-*`
 * classes, emoji, `null` for ids 30/31) and the domain tiles take the M07 PKSK domains, both read
 * from the real mock repository payload. Rows with an icon must resolve to an icon or an emoji.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { loadLucideIndex, resolveIcon, type LucideIndex } from '@/components/icon'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { pkskDomains } from '@/modules/m07-pksk/mock'

let index: LucideIndex | null = null
beforeAll(async () => {
  index = await loadLucideIndex()
})

const subjects = curriculum
  .subjects({ active: true })
  .filter((s) => s.id >= 1 && s.id <= 31)
  .map((s) => ({ key: `subject ${String(s.id)}`, icon: s.icon }))
const domains = pkskDomains
  .list()
  .filter((d) => d.isActive)
  .map((d) => ({ key: `domain ${String(d.id)}`, icon: d.icon }))

describe('S1 data-driven icons resolve through resolveIcon', () => {
  it('reads the real payload rows', () => {
    expect(subjects.length).toBeGreaterThan(0)
    expect(domains.length).toBeGreaterThan(0)
  })

  it.each([...subjects, ...domains].filter((r) => r.icon))('$key ($icon)', ({ icon }) => {
    const r = resolveIcon(icon, index)
    expect(['icon', 'emoji']).toContain(r.kind)
  })
})
