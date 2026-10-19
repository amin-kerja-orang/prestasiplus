import { describe, expect, it } from 'vitest'

import { PREVIEW_HUB_LINKS, groupLinksForRole } from '../dev/preview-hub-links'

/**
 * The link list grows as modules are verified (D20), so these tests assert the grouping rules,
 * not a fixed count.
 */
describe('preview hub links', () => {
  it('groups admin links by module in first-seen order, with every admin link present', () => {
    const groups = groupLinksForRole('admin')
    const modules = [
      ...new Set(PREVIEW_HUB_LINKS.filter((l) => l.roles.includes('admin')).map((l) => l.module)),
    ]
    expect(groups.map((g) => g.module)).toEqual(modules)
    const total = groups.reduce((n, g) => n + g.links.length, 0)
    expect(total).toBe(PREVIEW_HUB_LINKS.filter((l) => l.roles.includes('admin')).length)
  })

  it('shows a role only the links it may see', () => {
    for (const group of groupLinksForRole('student')) {
      for (const link of group.links) expect(link.roles).toContain('student')
    }
  })

  it('returns nothing without a session', () => {
    expect(groupLinksForRole(null)).toEqual([])
  })

  it('has unique paths', () => {
    const paths = PREVIEW_HUB_LINKS.map((l) => l.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
