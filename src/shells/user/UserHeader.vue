<script setup lang="ts">
/**
 * Top bar (live `header.topbar`), both breakpoints:
 * - ≥ lg: sidebar toggle, title/subtitle, gamification chips, bell, avatar, logout icon;
 * - < lg: title/subtitle (truncated), bell, hamburger (opens the drawer), logo.
 * Title/subtitle come from the route (DV-SH-03): `usePageMeta` header, else `meta.header`, else
 * the live layout default "Dashboard" / "Selamat datang kembali" (the caller resolves it).
 *
 * Chips (live comment "Student/Admin/Teacher"): koin, mata and the streak for student and admin
 * (OBSERVED); a single "{n} syiling" coin pill for teacher (guru screenshot; value source
 * INFERRED = coins); none for other roles (admin-sekolah screenshot shows none; others INFERRED).
 */
import { CountBadge } from '@/components/badge'
import type { PageHeader } from '@/composables/usePageMeta'
import type { UserMe } from '@/stores/session-types'
import { avatarSrc } from '@/shells/shared/avatar'
import { LOGO_URL } from '@/shells/shared/brand'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

import type { ChipsMode } from './constants'
import type { GamificationSummary } from './useGamificationSummary'

defineProps<{
  header: PageHeader
  summary: GamificationSummary
  chips: ChipsMode
  user: UserMe | null
  bellCount: number
}>()

const emit = defineEmits<{ 'toggle-sidebar': []; 'toggle-drawer': [] }>()

const BELL_BADGE =
  'absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1'
</script>

<template>
  <header
    class="topbar sticky top-0 z-30 px-3 py-2.5 sm:px-6 sm:py-4"
    data-testid="shell-user-header"
  >
    <div class="mx-auto flex w-[95%] items-center justify-between">
      <!-- Sidebar Toggle + Page Title -->
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          class="hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 lg:flex"
          title="Toggle Sidebar"
          data-testid="shell-user-sidebar-toggle"
          @click="emit('toggle-sidebar')"
        >
          <NavIcon fa="fa-bars" class="text-lg" />
        </button>
        <div class="min-w-0 flex-1">
          <h1
            class="truncate font-heading text-base font-bold text-slate-800 sm:text-2xl"
            data-testid="shell-user-title"
          >
            {{ header.title }}
          </h1>
          <p
            v-if="header.subtitle"
            class="mt-0.5 truncate text-[10px] font-medium text-slate-600 sm:text-sm"
            data-testid="shell-user-subtitle"
          >
            {{ header.subtitle }}
          </p>
        </div>
      </div>

      <!-- Gamification Stats (Desktop) -->
      <div
        v-if="chips === 'full'"
        class="hidden items-center space-x-3 lg:flex"
        data-testid="shell-user-chips"
      >
        <div id="jb-coin-target" class="coin-pill smooth-hover flex items-center space-x-2">
          <NavIcon fa="fa-coins" class="animate-sparkle text-lg text-amber-600" />
          <span id="jb-coin-value" class="text-base font-bold text-amber-800">
            {{ summary.coins }}
          </span>
          <span class="text-xs font-semibold text-amber-700">koin</span>
        </div>
        <div
          id="jb-mata-target"
          class="coin-pill smooth-hover flex items-center space-x-2"
          style="background: linear-gradient(135deg, #f3e8ff, #ede9fe); border-color: #c4b5fd"
        >
          <NavIcon fa="fa-star" class="text-lg text-purple-500" />
          <span id="jb-mata-value" class="text-base font-bold text-purple-700">
            {{ summary.points }}
          </span>
          <span class="text-xs font-semibold text-purple-600">mata</span>
        </div>
        <div class="streak-pill smooth-hover flex items-center space-x-2">
          <NavIcon fa="fa-fire" class="text-lg text-orange-600" />
          <span class="text-base font-bold text-orange-800">{{ summary.streakDays }}</span>
          <span class="text-xs font-semibold text-orange-700">hari 🔥</span>
        </div>
      </div>
      <div
        v-else-if="chips === 'syiling'"
        class="hidden items-center space-x-3 lg:flex"
        data-testid="shell-user-chips"
      >
        <div id="jb-coin-target" class="coin-pill smooth-hover flex items-center space-x-2">
          <NavIcon fa="fa-coins" class="animate-sparkle text-lg text-amber-600" />
          <span id="jb-coin-value" class="text-base font-bold text-amber-800">
            {{ summary.coins }}
          </span>
          <span class="text-xs font-semibold text-amber-700">syiling</span>
        </div>
      </div>

      <!-- Bell + avatar (desktop) + mobile hamburger and logo -->
      <div class="flex items-center space-x-4">
        <ShellLink
          to="/notifikasi"
          class="pp-hit relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
          title="Notifikasi"
          data-testid="shell-user-bell"
        >
          <NavIcon fa="fa-bell" class="text-lg" />
          <CountBadge
            id="notif-badge"
            :count="bellCount"
            :cap="99"
            :badge-class="BELL_BADGE"
            data-testid="shell-user-bell-badge"
          />
        </ShellLink>

        <div class="hidden items-center gap-3 lg:flex">
          <img
            :src="avatarSrc(user)"
            alt="Avatar"
            class="avatar-ring smooth-hover h-10 w-10 cursor-pointer rounded-full"
            data-testid="shell-user-header-avatar"
          />
          <ShellLink
            to="/logout"
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Log Keluar"
            data-testid="shell-user-header-logout"
          >
            <NavIcon fa="fa-sign-out-alt" />
          </ShellLink>
        </div>

        <div class="flex items-center space-x-3 lg:hidden">
          <button
            type="button"
            class="hamburger-btn pp-hit"
            aria-label="Menu"
            data-testid="shell-user-hamburger"
            @click="emit('toggle-drawer')"
          >
            <NavIcon fa="fa-bars" class="text-lg text-indigo-600" />
          </button>
          <ShellLink to="/dashboard" class="pp-hit flex items-center space-x-0.5">
            <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-7 w-auto sm:h-8" />
          </ShellLink>
        </div>
      </div>
    </div>
  </header>

  <!-- Mobile Gamification Stats — Student/Admin only (live comment) -->
  <div
    v-if="chips === 'full'"
    class="border-b-2 border-indigo-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 px-3 py-1.5 sm:px-4 sm:py-3 lg:hidden"
    data-testid="shell-user-chips-strip"
  >
    <div class="flex items-center justify-center space-x-4 sm:space-x-6">
      <div id="jb-coin-target-m" class="flex items-center space-x-1">
        <NavIcon fa="fa-coins" class="animate-sparkle text-xs text-amber-500 sm:text-base" />
        <span id="jb-coin-value-m" class="text-xs font-bold text-amber-800 sm:text-sm">
          {{ summary.coins }}
        </span>
        <span class="text-[9px] font-semibold text-amber-700 sm:text-xs">koin</span>
      </div>
      <div id="jb-mata-target-m" class="flex items-center space-x-1">
        <NavIcon fa="fa-star" class="text-xs text-purple-500 sm:text-base" />
        <span id="jb-mata-value-m" class="text-xs font-bold text-purple-700 sm:text-sm">
          {{ summary.points }}
        </span>
        <span class="text-[9px] font-semibold text-purple-600 sm:text-xs">mata</span>
      </div>
      <div class="flex items-center space-x-1">
        <NavIcon fa="fa-fire" class="text-xs text-orange-500 sm:text-base" />
        <span class="text-xs font-bold text-orange-800 sm:text-sm">{{ summary.streakDays }}</span>
        <span class="text-[9px] font-semibold text-orange-700 sm:text-xs">🔥</span>
      </div>
    </div>
  </div>
</template>
