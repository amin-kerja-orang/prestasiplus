/**
 * `shell` store (overview §9 "Global stores"; 00-global-ui §3–§4, §8 storage keys; design shells.md).
 *
 * Shell UI state, kept in the live `localStorage` keys so it survives navigation and reloads:
 * - `admin_sidebar`: JSON map `{groupKey: boolean}` of the admin sidebar groups (OBSERVED). The
 *   group of the active page is opened by the shell itself on load, independent of the saved state.
 * - `sidebarOpen`: the user sidebar expanded (≥ lg) state (OBSERVED key). Stored as `'true'` /
 *   `'false'`; the value format and the default (expanded) are INFERRED from the Alpine toggle
 *   `sidebarOpen = !sidebarOpen`.
 *
 * Transient state (not persisted, as live): the user drawer (< lg) and the "Lagi" menu of either
 * shell's bottom nav.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const ADMIN_SIDEBAR_STORAGE_KEY = 'admin_sidebar'
export const SIDEBAR_OPEN_STORAGE_KEY = 'sidebarOpen'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readGroups(): Record<string, boolean> {
  const raw = storage()?.getItem(ADMIN_SIDEBAR_STORAGE_KEY)
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    const out: Record<string, boolean> = {}
    for (const [key, open] of Object.entries(value)) {
      if (typeof open === 'boolean') out[key] = open
    }
    return out
  } catch {
    return {}
  }
}

function readSidebarOpen(): boolean {
  return storage()?.getItem(SIDEBAR_OPEN_STORAGE_KEY) !== 'false'
}

function write(key: string, value: string): void {
  try {
    storage()?.setItem(key, value)
  } catch {
    // Storage full or blocked: the state still works for this page.
  }
}

export const useShellStore = defineStore('shell', () => {
  /** Admin sidebar groups: `{groupKey: open}` (`localStorage['admin_sidebar']`). */
  const adminGroups = ref<Record<string, boolean>>(readGroups())
  /** User sidebar expanded at ≥ lg (`localStorage['sidebarOpen']`). */
  const sidebarOpen = ref(readSidebarOpen())
  /** User drawer (< lg). */
  const drawerOpen = ref(false)
  /** "Lagi" menu of the bottom nav (both shells). */
  const lagiOpen = ref(false)

  function isGroupOpen(key: string): boolean {
    return adminGroups.value[key] === true
  }

  function setGroupOpen(key: string, open: boolean): void {
    adminGroups.value = { ...adminGroups.value, [key]: open }
    write(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify(adminGroups.value))
  }

  function toggleGroup(key: string): void {
    setGroupOpen(key, !isGroupOpen(key))
  }

  function setSidebarOpen(open: boolean): void {
    sidebarOpen.value = open
    write(SIDEBAR_OPEN_STORAGE_KEY, String(open))
  }

  function toggleSidebar(): void {
    setSidebarOpen(!sidebarOpen.value)
  }

  function setDrawerOpen(open: boolean): void {
    drawerOpen.value = open
  }

  function setLagiOpen(open: boolean): void {
    lagiOpen.value = open
  }

  /** Closes the transient overlays (drawer, "Lagi"); the router may call it on navigation. */
  function closeOverlays(): void {
    drawerOpen.value = false
    lagiOpen.value = false
  }

  /** Re-reads both persisted keys (e.g. after a test changed `localStorage`). */
  function reload(): void {
    adminGroups.value = readGroups()
    sidebarOpen.value = readSidebarOpen()
  }

  return {
    adminGroups,
    sidebarOpen,
    drawerOpen,
    lagiOpen,
    isGroupOpen,
    setGroupOpen,
    toggleGroup,
    setSidebarOpen,
    toggleSidebar,
    setDrawerOpen,
    setLagiOpen,
    closeOverlays,
    reload,
  }
})

export type ShellStore = ReturnType<typeof useShellStore>
