// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { createAppRouter } from '@/app/router'
import { adminShellFor, resolveShell, resolveShellForPath } from '@/app/router/layouts'

import { ALL_ITEMS, PENTADBIRAN_MENU, activeItem, placeholderPath } from '../menu'

describe('Pentadbiran menu data', () => {
  it('has the 9 groups of v2-portals.md in order', () => {
    expect(PENTADBIRAN_MENU.map((g) => g.label)).toEqual([
      'Papan Pemuka',
      'Pemantauan',
      'Bank Soalan',
      'Kertas & SPM',
      'Kurikulum & Kandungan',
      'Pengguna & Sekolah',
      'Penglibatan',
      'Kewangan',
      'Sistem',
    ])
  })

  it('has the per-group item counts of the doc (total 100)', () => {
    expect(PENTADBIRAN_MENU.map((g) => g.items.length)).toEqual([2, 28, 7, 12, 12, 6, 22, 6, 5])
    expect(ALL_ITEMS).toHaveLength(100)
    expect(new Set(ALL_ITEMS.map((i) => i.id)).size).toBe(100)
  })

  it('points an unbuilt item at its placeholder and a built one at an existing route', () => {
    const pm04 = ALL_ITEMS.find((i) => i.id === 'PM-04')
    expect(pm04?.built).toBe(false)
    expect(pm04?.to).toBe(placeholderPath('PM-04'))
    expect(ALL_ITEMS.find((i) => i.id === 'PM-01')?.to).toBe('/admin/command-center')
  })

  it('activates the longest matching item (drill pages stay on Langsung)', () => {
    expect(activeItem('/admin/command-center/school/3')?.id).toBe('PM-01')
    expect(activeItem('/admin/command-center/daily-activity')?.id).toBe('PM-02')
    expect(activeItem('/admin/questions/import')?.id).toBe('BS-02')
  })
})

describe('Pentadbiran routing', () => {
  it('every item resolves to a real route (not the 404 catch-all)', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    for (const item of ALL_ITEMS) {
      const resolved = router.resolve(item.to)
      expect(resolved.matched.length, `${item.id} ${item.to}`).toBeGreaterThan(0)
      expect(String(resolved.name), `${item.id} ${item.to}`).not.toMatch(/not-found|404/i)
    }
  })

  it('Admin Pusat gets the portal only while the prototype scope is on', () => {
    const admin = { isLoggedIn: true, role: 'admin' as const }
    expect(resolveShell('admin', admin)).toBe('admin') // vitest runs with the scope off
    expect(resolveShellForPath('bare', admin, '/admin/command-center')).toBeNull()
    expect(adminShellFor('teacher')).toBe('admin')
  })
})
