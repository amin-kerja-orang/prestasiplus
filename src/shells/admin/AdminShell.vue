<script setup lang="ts">
/**
 * Admin-panel shell (F-18; shells.md v1.2 §2, overview §10). Wraps `layout: 'admin'` pages and
 * the admin variant of `layout: 'role'` pages. One chrome for every role; the menu, caption, bottom
 * nav, popover and header controls come from the logged-in role (`admin-nav.ts`): the admin's own
 * menu, or the teacher's own menu on `/guru/monitoring*` and `/guru/kirkpatrick*` (PROPOSED, no
 * server-status pill, "Portal Guru").
 *
 *   aside.sidebar (≥ lg) │ header.topbar + main + footer strip (< lg)
 *   bottom nav + "Lagi" popover (< lg)
 *
 * Group state persists in `localStorage["admin_sidebar"]` (shell store); the group of the active
 * page opens on every route change. Not rendered: a global search, a bell, an avatar or logout
 * below `lg` (live, DV-SH-02).
 */
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

import { FlashOutlet } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { usePageMeta, type PageHeader } from '@/composables/usePageMeta'
import {
  activeGroupKey,
  activeItemId,
  adminMenuFor,
  bottomNavActive,
  bottomNavFor,
  chromeFor,
  footerLinksFor,
  lagiFor,
  type LagiRow,
} from '@/shells/nav/admin-nav'
import { useSessionStore } from '@/stores/session'
import { useShellStore } from '@/stores/shell'

import AdminBottomNav from './AdminBottomNav.vue'
import AdminHeader from './AdminHeader.vue'
import AdminLagiPopover from './AdminLagiPopover.vue'
import AdminSidebar from './AdminSidebar.vue'
import './admin-shell.css'
import { DEFAULT_ADMIN_HEADER } from './constants'

const route = useRoute()
const session = useSessionStore()
const shell = useShellStore()
const pageMeta = usePageMeta()
const { flash } = useFlash()

const role = computed(() => session.role)
const user = computed(() => session.user)
const chrome = computed(() => chromeFor(role.value))
const entries = computed(() => adminMenuFor(role.value))
const footerLinks = computed(() => footerLinksFor(role.value))
const bottomEntries = computed(() => bottomNavFor(role.value))
const lagiMenu = computed(() => lagiFor(role.value))

/** DV-SH-03: `usePageMeta` header, else the route's static header, else the live default. */
const header = computed<PageHeader>(
  () => pageMeta.state.header ?? route.meta.header ?? DEFAULT_ADMIN_HEADER,
)

/** The one active item (§2.8); the footer links take part in the same rule. */
const activeId = computed(() => activeItemId(entries.value, route.path, footerLinks.value))
const groupKey = computed(() => activeGroupKey(entries.value, route.path, activeId.value))

function rowActive(row: LagiRow): boolean {
  return row.groupKey !== undefined ? row.groupKey === groupKey.value : row.id === activeId.value
}

/** "Lagi" shows the active colour for a page that only the popover reaches (INFERRED, §2.4). */
const lagiActive = computed(() => {
  const linkActive = bottomEntries.value.some(
    (cell) => cell.kind === 'link' && bottomNavActive(cell, route.path),
  )
  return !linkActive && lagiMenu.value.entries.some((e) => e.kind === 'row' && rowActive(e))
})

// The group of the active page opens on every route change (live opens it on page load, P-7);
// the user can collapse it afterwards.
watch(
  () => [route.path, role.value] as const,
  () => {
    const key = groupKey.value
    if (key && !shell.isGroupOpen(key)) shell.setGroupOpen(key, true)
  },
  { immediate: true },
)

onBeforeUnmount(() => shell.closeOverlays())
</script>

<template>
  <div
    class="admin-shell min-h-screen font-body antialiased bg-app-admin"
    data-layout="admin"
    :data-role="role ?? undefined"
  >
    <AdminSidebar
      :entries="entries"
      :footer-links="footerLinks"
      :active-id="activeId"
      :caption="chrome.caption"
      :home="chrome.home"
      :role-label="chrome.roleLabel"
      :user="user"
    />

    <!-- Main column: offset by the sidebar at ≥ lg; below lg the bottom nav clearance is the
         bottom padding (45px + safe-area + 16px), so the footer strip is never under it. -->
    <div
      class="flex min-h-screen flex-col pb-[calc(45px+env(safe-area-inset-bottom)+16px)] lg:ml-64 lg:pb-0"
    >
      <AdminHeader
        :header="header"
        :user="user"
        :home="chrome.home"
        :server-status="chrome.serverStatus"
      />

      <!-- Live `page-transition`: fades in on every page load -->
      <main
        :key="route.path"
        class="mx-auto w-[95%] flex-1 animate-page-transition py-3 sm:py-6"
        data-testid="shell-admin-main"
      >
        <FlashOutlet :flash="flash" class="mb-4" />
        <slot />
      </main>

      <!-- Copyright strip: below lg only (shells.md §2.1) -->
      <footer
        class="px-3 py-4 text-center text-xs text-slate-500 lg:hidden"
        data-testid="shell-admin-footer"
      >
        <p class="font-semibold">&copy; 2026 PRESTASIPLUS. Hakcipta Terpelihara.</p>
        <p class="mt-1 font-medium">
          Didikan penuh <span class="text-red-500">❤️</span> dari Malaysia 🇲🇾
        </p>
      </footer>
    </div>

    <AdminBottomNav
      :entries="bottomEntries"
      :current-path="route.path"
      :lagi-open="shell.lagiOpen"
      :lagi-active="lagiActive"
      @toggle-lagi="shell.setLagiOpen(!shell.lagiOpen)"
    />
    <AdminLagiPopover
      :open="shell.lagiOpen"
      :menu="lagiMenu"
      :is-active="rowActive"
      @close="shell.setLagiOpen(false)"
    />
  </div>
</template>
