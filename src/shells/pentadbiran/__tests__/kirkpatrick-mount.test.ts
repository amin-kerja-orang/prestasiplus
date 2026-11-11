import { describe, expect, it } from 'vitest'

import { ALL_ITEMS, activeItem, onMount } from '../menu'
import { sectionTabs } from '../menu-nav'
import { PENTADBIRAN_MENU } from '../menu'

describe('Kirkpatrick on the /guru mount resolves like its /admin twin (C-56)', () => {
  it('maps every /guru/kirkpatrick page to the same menu item as /admin', () => {
    for (const leaf of ['', '/reaction', '/learning', '/behavior', '/results', '/chain', '/interventions', '/pelajar/4']) {
      const guru = activeItem(`/guru/kirkpatrick${leaf}`)
      expect(guru, leaf).toBeDefined()
      expect(guru?.id, leaf).toBe(activeItem(`/admin/kirkpatrick${leaf}`)?.id)
      expect(guru?.sub, leaf).toBe('Kirkpatrick')
    }
  })

  it('moves the section tab targets onto the mount, leaves other paths and targets alone', () => {
    const tabs = sectionTabs(PENTADBIRAN_MENU, 'Kirkpatrick')
    const onGuru = tabs.map((t) => onMount(t.to, '/guru/kirkpatrick/learning'))
    expect(onGuru[0]).toBe('/guru/kirkpatrick')
    expect(onGuru.every((to) => to.startsWith('/guru/kirkpatrick'))).toBe(true)
    expect(tabs.map((t) => onMount(t.to, '/admin/kirkpatrick/learning'))).toEqual(tabs.map((t) => t.to))
    expect(onMount('/admin/monitoring', '/guru/kirkpatrick')).toBe('/admin/monitoring')
  })
})

describe('existing /admin resolution is unchanged', () => {
  it('resolves each built menu target to itself, longest match wins', () => {
    for (const item of ALL_ITEMS) {
      const hit = activeItem(item.to)
      expect(hit?.to.length ?? 0, item.id).toBeGreaterThanOrEqual(item.to.length)
    }
    expect(activeItem('/admin/kirkpatrick/reaction')?.id).toBe('PM-06')
    expect(activeItem('/admin/kirkpatrick/pelajar/4')?.id).toBe('PM-05')
    expect(activeItem('/admin/tiket')).toBeDefined()
  })

  it('does not resolve paths outside /admin or the /guru Kirkpatrick mount', () => {
    expect(activeItem('/guru/monitoring')).toBeUndefined()
    expect(activeItem('/guru/kirkpatrickx')).toBeUndefined()
    expect(activeItem('/admin-sekolah/kirkpatrick')).toBeUndefined()
  })
})
