import { describe, expect, it, vi } from 'vitest'

import { PENTADBIRAN_MENU } from '../menu'
import { buildNavItems, buildSearchGroups } from '../menu-nav'

describe('Pentadbiran navigation items', () => {
  const toggle = vi.fn()
  const items = buildNavItems(PENTADBIRAN_MENU, {
    activeId: 'BS-01',
    isOpen: (key) => key === 'bank-soalan',
    toggle,
  })

  it('builds one trigger per visible group, open state from the persisted map', () => {
    expect(items).toHaveLength(PENTADBIRAN_MENU.length)
    const bank = items.find((i) => i.value === 'bank-soalan')
    expect(bank?.open).toBe(true)
    expect(items.find((i) => i.value === 'pemantauan')?.open).toBe(false)
    bank?.onSelect?.(new Event('select'))
    expect(toggle).toHaveBeenCalledWith('bank-soalan')
  })

  it('nests second-level headings and marks the active screen', () => {
    const monitoring = items.find((i) => i.value === 'pemantauan')
    const kirkpatrick = monitoring?.children?.find((c) => c.label === 'Kirkpatrick')
    expect(kirkpatrick?.children?.length).toBeGreaterThan(1)
    const bank = items.find((i) => i.value === 'bank-soalan')
    expect(bank?.children?.find((c) => c.value === 'BS-01')?.active).toBe(true)
  })

  it('lists every visible screen for the Ctrl+K palette', () => {
    const groups = buildSearchGroups(PENTADBIRAN_MENU)
    const total = groups.reduce((n, g) => n + g.items.length, 0)
    expect(total).toBe(PENTADBIRAN_MENU.reduce((n, g) => n + g.items.length, 0))
    expect(groups.flatMap((g) => g.items).find((i) => i.id === 'BS-01')?.to).toBe('/admin/questions')
  })
})
