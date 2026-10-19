import { describe, expect, it } from 'vitest'

import { PENTADBIRAN_MENU } from '../menu'
import { buildNavItems, buildSearchGroups, sectionTabs } from '../menu-nav'

describe('Pentadbiran navigation items', () => {
  const groups = buildNavItems(PENTADBIRAN_MENU, { activeId: 'BS-01' })

  it('builds one quiet label plus one-line rows per visible group (two levels at most)', () => {
    expect(groups).toHaveLength(PENTADBIRAN_MENU.length)
    for (const g of groups) {
      expect(g[0]?.type).toBe('label')
      for (const row of g.slice(1)) {
        expect(row.children).toBeUndefined()
        expect(row.icon).toMatch(/^i-ph-/)
      }
    }
  })

  it('folds Kirkpatrick into one row that opens its first page', () => {
    const monitoring = groups.find((g) => g[0]?.value === 'pemantauan') ?? []
    const rows = monitoring.slice(1)
    expect(rows.filter((r) => r.label === 'Kirkpatrick')).toHaveLength(1)
    expect(rows.find((r) => r.label === 'Kirkpatrick')?.to).toBe('/admin/kirkpatrick')
    expect(rows.some((r) => r.label === 'T1: Reaksi')).toBe(false)
  })

  it('marks the active screen, and the folded row when any of its pages is active', () => {
    const bank = groups.find((g) => g[0]?.value === 'bank-soalan') ?? []
    expect(bank.find((r) => r.value === 'BS-01')?.active).toBe(true)
    const inKirk = buildNavItems(PENTADBIRAN_MENU, { activeId: 'PM-08', activeSub: 'Kirkpatrick' })
    const row = inKirk.flat().find((r) => r.label === 'Kirkpatrick')
    expect(row?.active).toBe(true)
  })

  it('offers the folded pages as in-page tabs', () => {
    const tabs = sectionTabs(PENTADBIRAN_MENU, 'Kirkpatrick')
    expect(tabs).toHaveLength(7)
    expect(tabs[0]).toEqual({ label: 'Ringkasan', to: '/admin/kirkpatrick' })
  })

  it('lists every visible screen for the Ctrl+K palette', () => {
    const search = buildSearchGroups(PENTADBIRAN_MENU)
    const total = search.reduce((n, g) => n + g.items.length, 0)
    expect(total).toBe(PENTADBIRAN_MENU.reduce((n, g) => n + g.items.length, 0))
    expect(search.flatMap((g) => g.items).find((i) => i.id === 'BS-01')?.to).toBe(
      '/admin/questions',
    )
  })
})
