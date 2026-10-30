import { describe, expect, it } from 'vitest'

import { PENTADBIRAN_MENU } from '../menu'
import { buildNavGroups, buildSearchGroups, sectionTabs } from '../menu-nav'

const linksOf = (g: ReturnType<typeof buildNavGroups>[number] | undefined) =>
  (g?.rows ?? []).filter((r): r is Extract<typeof r, { kind: 'link' }> => r.kind === 'link')

describe('Pentadbiran navigation groups', () => {
  const groups = buildNavGroups(PENTADBIRAN_MENU, { activeId: 'BS-01' })

  it('builds one group per visible menu group; every link has an icon, a route and a label', () => {
    expect(groups).toHaveLength(PENTADBIRAN_MENU.length)
    for (const g of groups) {
      expect(g.rows).toHaveLength(linksOf(g).length)
      for (const row of linksOf(g)) {
        expect(row.icon).toMatch(/^i-ph-/)
        expect(row.to).toMatch(/^\//)
      }
    }
  })

  it('folds Kirkpatrick into one row that opens its first page', () => {
    const rows = linksOf(groups.find((g) => g.key === 'pemantauan'))
    expect(rows.filter((r) => r.label === 'Kirkpatrick')).toHaveLength(1)
    expect(rows.find((r) => r.label === 'Kirkpatrick')?.to).toBe('/admin/kirkpatrick')
    expect(rows.some((r) => r.label === 'T1: Reaksi')).toBe(false)
  })

  it('marks the active screen, and the folded row when any of its pages is active', () => {
    const bank = linksOf(groups.find((g) => g.key === 'bank-soalan'))
    expect(bank.find((r) => r.id === 'BS-01')?.active).toBe(true)
    const inKirk = buildNavGroups(PENTADBIRAN_MENU, { activeId: 'PM-08', activeSub: 'Kirkpatrick' })
    expect(inKirk.flatMap((g) => linksOf(g)).find((r) => r.label === 'Kirkpatrick')?.active).toBe(
      true,
    )
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
