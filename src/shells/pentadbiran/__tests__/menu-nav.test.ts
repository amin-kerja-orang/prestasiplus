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
      // only the Soalan group has a sub heading row (Bank Lama (Legasi))
      expect(g.rows.length - linksOf(g).length).toBe(g.key === 'soalan' ? 1 : 0)
      for (const row of linksOf(g)) {
        expect(row.icon).toMatch(/^i-ph-/)
        expect(row.to).toMatch(/^\//)
      }
    }
  })

  it('folds Kirkpatrick into one row that opens its first page', () => {
    const rows = linksOf(groups.find((g) => g.key === 'analitik'))
    expect(rows.filter((r) => r.label === 'Kirkpatrick')).toHaveLength(1)
    expect(rows.find((r) => r.label === 'Kirkpatrick')?.to).toBe('/admin/kirkpatrick')
    expect(rows.some((r) => r.label === 'T1: Reaksi')).toBe(false)
  })

  it('marks the active screen, and the folded row when any of its pages is active', () => {
    const bank = linksOf(groups.find((g) => g.key === 'soalan'))
    expect(bank.find((r) => r.id === 'BS-01')?.active).toBe(true)
    const inKirk = buildNavGroups(PENTADBIRAN_MENU, { activeId: 'PM-08', activeSub: 'Kirkpatrick' })
    expect(inKirk.flatMap((g) => linksOf(g)).find((r) => r.label === 'Kirkpatrick')?.active).toBe(
      true,
    )
  })

  it('the top shortcuts group has no heading; every other group has one', () => {
    expect(groups[0]?.key).toBe('pintasan')
    expect('label' in (groups[0] ?? {})).toBe(false)
    expect(groups.slice(1).every((g) => !!g.label)).toBe(true)
    const search = buildSearchGroups(PENTADBIRAN_MENU)
    expect('label' in (search[0] ?? {})).toBe(false)
    expect(search[0]?.items.map((i) => i.label)).toEqual(['Command Center', 'Aktiviti Harian', 'Audio KBAT'])
    expect(search.slice(1).every((g) => !!g.label)).toBe(true)
  })

  it('emits the Bank Lama (Legasi) heading once, before its indented links', () => {
    const rows = groups.find((g) => g.key === 'soalan')?.rows ?? []
    const at = rows.findIndex((r) => r.kind === 'sub')
    expect(rows[at]).toEqual({ kind: 'sub', label: 'Bank Lama (Legasi)' })
    const after = rows.slice(at + 1)
    expect(after.map((r) => (r.kind === 'link' ? [r.label, r.nested] : null))).toEqual([
      ['Senarai Soalan', true],
      ['Soalan Berstruktur', true],
    ])
    expect(rows.slice(0, at).every((r) => r.kind === 'link' && !r.nested)).toBe(true)
    // nested items never become section tabs
    expect(sectionTabs(PENTADBIRAN_MENU, 'Bank Lama (Legasi)')).toEqual([])
  })

  it('passes the badge through to the link (Command Center: LIVE)', () => {
    const cc = groups.flatMap((g) => linksOf(g)).find((r) => r.id === 'PM-01')
    expect(cc).toMatchObject({ label: 'Command Center', badge: 'LIVE' })
    expect(groups.flatMap((g) => linksOf(g)).filter((r) => r.badge)).toHaveLength(1)
  })

  it('offers the folded pages as in-page tabs', () => {
    const tabs = sectionTabs(PENTADBIRAN_MENU, 'Kirkpatrick')
    expect(tabs).toHaveLength(7)
    expect(tabs[0]).toEqual({ label: 'Overview', to: '/admin/kirkpatrick' })
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
