<script setup lang="ts">
/**
 * Desktop sidebar (≥ lg), live `aside.sidebar`: logo + "Platform Latih Tubi Nasional", the shared
 * menu, and the user card (avatar, name, email, logout icon; FR-M01-52, FR-M01-36). Collapsed by
 * the header hamburger (`sidebarOpen`, `localStorage["sidebarOpen"]`): it slides out of view.
 */
import { computed } from 'vue'

import { shellHomePath } from '@/app/prototype-scope'
import type { UserMe } from '@/stores/session-types'
import type { NavEntry } from '@/shells/nav/user-nav'
import { avatarSrc } from '@/shells/shared/avatar'
import { LOGO_URL } from '@/shells/shared/brand'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

import UserNavList from './UserNavList.vue'

const props = defineProps<{
  open: boolean
  entries: readonly NavEntry[]
  currentPath: string
  user: UserMe | null
}>()

const home = computed(() => shellHomePath(props.user?.role ?? null))
</script>

<template>
  <aside
    class="sidebar fixed top-0 left-0 z-40 hidden h-screen w-64 overflow-y-auto transition-transform duration-300 lg:block"
    :class="open ? 'translate-x-0' : '-translate-x-64'"
    data-testid="shell-user-sidebar"
  >
    <div class="flex h-full flex-col p-6">
      <!-- Logo -->
      <div class="mb-8 animate-bounce-in">
        <ShellLink :to="home" class="flex items-center space-x-0.5">
          <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-8 w-auto sm:h-10" />
        </ShellLink>
        <p class="mt-1 ml-1 text-xs font-medium text-slate-500">Platform Latih Tubi Nasional</p>
      </div>

      <!-- Navigation Items -->
      <nav class="flex-1 space-y-2">
        <UserNavList :entries="entries" surface="sidebar" :current-path="currentPath" />
      </nav>

      <!-- User Profile Section -->
      <div class="user-card mt-auto" data-testid="shell-user-sidebar-card">
        <div class="flex items-center space-x-3">
          <img :src="avatarSrc(user)" alt="Avatar" class="avatar-ring h-11 w-11 rounded-full" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold break-words text-slate-800">{{ user?.name }}</p>
            <p class="text-xs font-medium break-all text-slate-600">{{ user?.email }}</p>
          </div>
          <ShellLink
            to="/logout"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Log Keluar"
            data-testid="shell-user-sidebar-logout"
          >
            <NavIcon fa="fa-sign-out-alt" />
          </ShellLink>
        </div>
      </div>
    </div>
  </aside>
</template>
