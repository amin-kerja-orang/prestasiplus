<script setup lang="ts">
/**
 * Mobile slide-out drawer (< lg), live `.mobile-drawer`: 280px (max 85vw), blurred overlay,
 * logo + close ✕, the user card (avatar, name, raw role code shown with CSS `capitalize`,
 * FR-M01-52), the shared menu (DV-SH-04), then the account section (Profil Saya, Tetapan →
 * `/tetapan` DV-01, Panduan, Log Keluar) and the footer line. Opened by the header hamburger and
 * the bottom-nav "Lagi"; closed by ✕, the overlay, Escape (live `@keydown.escape.window`) and
 * any navigation (router `closeOverlays`). Always in the DOM below lg, as live.
 */
import { computed } from 'vue'

import type { UserMe } from '@/stores/session-types'
import {
  USER_DRAWER_ACCOUNT,
  isActivePath,
  userDrawerAccountFor,
  type NavEntry,
} from '@/shells/nav/user-nav'
import { avatarSrc } from '@/shells/shared/avatar'
import { LOGO_URL } from '@/shells/shared/brand'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

import UserNavList from './UserNavList.vue'
import { DsCluster } from '@/ds'

const props = defineProps<{
  open: boolean
  entries: readonly NavEntry[]
  currentPath: string
  user: UserMe | null
}>()

const emit = defineEmits<{ close: [] }>()

const logout = USER_DRAWER_ACCOUNT.find((item) => item.to === '/logout')!
// Prototype scope (D43): only the account links whose route is in the role's allowed set.
const accountLinks = computed(() =>
  userDrawerAccountFor(props.user?.role ?? null).filter((item) => item !== logout),
)
</script>

<template>
  <div class="lg:hidden" data-testid="shell-user-drawer-root">
    <!-- Overlay -->
    <div
      class="mobile-drawer-overlay"
      :class="{ open }"
      data-testid="shell-user-drawer-overlay"
      @click="emit('close')"
    />

    <!-- Drawer -->
    <div class="mobile-drawer" :class="{ open }" data-testid="shell-user-drawer">
      <!-- Drawer Header -->
      <div class="border-b border-indigo-100 p-5">
        <DsCluster gap="none" justify="between" :wrap="false">
          <div>
            <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-7 w-auto sm:h-8" />
            <p class="mt-0.5 text-[10px] font-medium text-slate-400">
              Platform Latih Tubi Nasional
            </p>
          </div>
          <button
            type="button"
            class="pp-hit flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-red-50"
            data-testid="shell-user-drawer-close"
            @click="emit('close')"
          >
            <NavIcon fa="fa-times" class="text-slate-400" />
          </button>
        </DsCluster>
        <div
          class="mt-3 flex items-center space-x-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 p-2.5"
          data-testid="shell-user-drawer-card"
        >
          <img
            :src="avatarSrc(user)"
            alt="Avatar"
            class="h-9 w-9 rounded-full border-2 border-indigo-200"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-slate-800">{{ user?.name }}</p>
            <p class="text-[10px] text-slate-500 capitalize">{{ user?.role }}</p>
          </div>
        </div>
      </div>

      <!-- Drawer Navigation -->
      <nav class="space-y-0.5 p-3">
        <UserNavList :entries="entries" surface="drawer" :current-path="currentPath" />

        <div class="my-2 border-t border-amber-100" />
        <ShellLink
          v-for="item in accountLinks"
          :key="item.id"
          :to="item.to"
          class="drawer-nav-item"
          :class="{ active: isActivePath(currentPath, item.to) }"
          :data-nav-id="item.id"
        >
          <NavIcon :fa="item.fa" :class="`w-5 text-center ${item.color}`" />
          <span>{{ item.label }}</span>
        </ShellLink>
        <ShellLink
          :to="logout.to"
          class="drawer-nav-item w-full text-red-500 hover:bg-red-50"
          :data-nav-id="logout.id"
          data-testid="shell-user-drawer-logout"
        >
          <NavIcon :fa="logout.fa" class="w-5 text-center" />
          <span>{{ logout.label }}</span>
        </ShellLink>
      </nav>

      <!-- Drawer Footer -->
      <div class="mt-auto border-t border-indigo-100 p-4">
        <p class="text-center text-[10px] text-slate-400">&copy; 2026 PRESTASIPLUS 🇲🇾</p>
      </div>
    </div>
  </div>
</template>
