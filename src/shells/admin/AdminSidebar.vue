<script setup lang="ts">
/**
 * Desktop sidebar (≥ lg), live `aside.sidebar` (shells.md §2.2): logo + caption, the menu and
 * the user block (avatar, name, role, logout). 256 px, fixed,
 * scrolls on its own; the user block stays at the end of the scroll content, not fixed (§2.11).
 */
import type { AdminNavEntry } from '@/shells/nav/admin-nav'
import type { UserMe } from '@/stores/session-types'
import { avatarSrc } from '@/shells/shared/avatar'
import { LOGO_URL } from '@/shells/shared/brand'
import ShellLink from '@/shells/shared/ShellLink.vue'

import AdminNavList from './AdminNavList.vue'

defineProps<{
  entries: readonly AdminNavEntry[]
  activeId: string | null
  caption: string
  home: string
  roleLabel: string
  user: UserMe | null
}>()
</script>

<template>
  <aside
    class="sidebar fixed top-0 left-0 z-40 hidden h-screen w-64 overflow-y-auto lg:block"
    data-testid="shell-admin-sidebar"
  >
    <div class="flex min-h-full flex-col">
      <!-- Logo -->
      <div class="p-5">
        <ShellLink :to="home" class="flex items-center" data-testid="shell-admin-sidebar-logo">
          <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-8 w-auto sm:h-10" />
        </ShellLink>
        <p class="mt-1 text-xs font-medium text-slate-500" data-testid="shell-admin-caption">
          {{ caption }}
        </p>
      </div>

      <nav class="flex-1 space-y-0.5 px-3 pb-4" data-testid="shell-admin-nav">
        <AdminNavList :entries="entries" :active-id="activeId" />
      </nav>

      <!-- User block -->
      <div class="border-t border-slate-100 p-4" data-testid="shell-admin-user-block">
        <div class="flex items-center gap-3">
          <img :src="avatarSrc(user)" alt="Avatar" class="avatar-ring h-10 w-10 rounded-full" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-slate-800">{{ user?.name }}</p>
            <p class="truncate text-xs text-slate-500 capitalize">{{ roleLabel }}</p>
          </div>
          <ShellLink
            to="/logout"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Log Keluar"
            data-testid="shell-admin-sidebar-logout"
          >
            <NavIcon fa="fa-sign-out-alt" />
          </ShellLink>
        </div>
      </div>
    </div>
  </aside>
</template>
