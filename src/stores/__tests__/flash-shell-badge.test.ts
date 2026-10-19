// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/api'

import {
  ADMIN_SIDEBAR_STORAGE_KEY,
  badgeLabel,
  SIDEBAR_OPEN_STORAGE_KEY,
  UNREAD_COUNT_URL,
  useFlashStore,
  useNotificationBadgeStore,
  useSessionStore,
  useShellStore,
} from '..'
import { fakeTransport, session } from './fixtures'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  api.configure({ transport: null })
})

describe('flash store', () => {
  it('a pending flash is shown after the next navigation, once', () => {
    const flash = useFlashStore()
    flash.success('Profil berjaya dikemaskini.')
    expect(flash.current).toBeNull()

    expect(flash.consume()).toEqual({ type: 'success', message: 'Profil berjaya dikemaskini.' })
    expect(flash.current?.type).toBe('success')
    expect(flash.pending).toBeNull()

    // The following navigation has nothing pending: the flash disappears.
    expect(flash.consume()).toBeNull()
    expect(flash.current).toBeNull()
  })

  it('keeps multi-line error messages and supports show() on the same page', () => {
    const flash = useFlashStore()
    flash.error(['Baris 1', 'Baris 2'])
    flash.consume()
    expect(flash.current).toEqual({ type: 'error', message: ['Baris 1', 'Baris 2'] })

    flash.show({ type: 'success', message: 'Disimpan' })
    expect(flash.current?.message).toBe('Disimpan')
    flash.clear()
    expect(flash.current).toBeNull()
    expect(flash.pending).toBeNull()
  })

  it('a later set() before navigation replaces the earlier one', () => {
    const flash = useFlashStore()
    flash.set({ type: 'error', message: 'A' })
    flash.set({ type: 'success', message: 'B' })
    expect(flash.consume()?.message).toBe('B')
  })
})

describe('shell store', () => {
  it('reads and writes admin_sidebar as a JSON {key: bool} map', () => {
    localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify({ soalan: true, spm: false }))
    const shell = useShellStore()
    expect(shell.isGroupOpen('soalan')).toBe(true)
    expect(shell.isGroupOpen('spm')).toBe(false)
    expect(shell.isGroupOpen('kurikulum')).toBe(false)

    shell.toggleGroup('kurikulum')
    shell.toggleGroup('soalan')
    expect(JSON.parse(localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) ?? '')).toEqual({
      soalan: false,
      spm: false,
      kurikulum: true,
    })
  })

  it('ignores a malformed admin_sidebar value', () => {
    localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, '[1,2]')
    expect(useShellStore().adminGroups).toEqual({})
  })

  it('sidebarOpen defaults to expanded and persists as "true"/"false"', () => {
    const shell = useShellStore()
    expect(shell.sidebarOpen).toBe(true)
    shell.toggleSidebar()
    expect(shell.sidebarOpen).toBe(false)
    expect(localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)).toBe('false')

    setActivePinia(createPinia())
    expect(useShellStore().sidebarOpen).toBe(false)
  })

  it('drawer and "Lagi" are transient and closed together', () => {
    const shell = useShellStore()
    shell.setDrawerOpen(true)
    shell.setLagiOpen(true)
    shell.closeOverlays()
    expect(shell.drawerOpen).toBe(false)
    expect(shell.lagiOpen).toBe(false)
  })
})

describe('notificationBadge store', () => {
  it('labels: hidden at 0, number up to 99, "99+" above', () => {
    expect(badgeLabel(7)).toBe('7')
    expect(badgeLabel(99)).toBe('99')
    expect(badgeLabel(100)).toBe('99+')
    const badge = useNotificationBadgeStore()
    expect(badge.visible).toBe(false)
    badge.set(150)
    expect(badge.visible).toBe(true)
    expect(badge.label).toBe('99+')
  })

  it('refresh() reads GET /api/me/notifications/unread-count when logged in', async () => {
    useSessionStore().setSession(session())
    const transport = fakeTransport(() => ({ status: 200, body: { data: { count: 4 } } }))
    api.configure({ transport })
    const badge = useNotificationBadgeStore()

    await expect(badge.refresh()).resolves.toBe(4)
    expect(transport.requests[0]).toMatchObject({ method: 'GET', url: UNREAD_COUNT_URL })
    expect(badge.label).toBe('4')
  })

  it('refresh() keeps the last count on failure and is 0 without a session', async () => {
    const session$ = useSessionStore()
    session$.setSession(session())
    const badge = useNotificationBadgeStore()
    badge.set(3)
    api.configure({ transport: fakeTransport(() => ({ status: 500 })) })
    await expect(badge.refresh()).resolves.toBe(3)

    session$.clear()
    await expect(badge.refresh()).resolves.toBe(0)
  })
})
