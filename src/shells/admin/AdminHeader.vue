<script setup lang="ts">
/**
 * Top bar (live `header.topbar`, shells.md §2.3, §2.4):
 * - ≥ lg: title + subtitle, the server-status pill (admin only), avatar, logout icon;
 * - < lg: title + subtitle and the logo on the right. No avatar, pill or logout (DV-SH-02:
 *   logout stays in "Lagi").
 * There is no search and no bell in the admin header (intentional live omission).
 * Title and subtitle come from the route (DV-SH-03); the caller resolves them.
 */
import { computed } from 'vue'

import type { PageHeader } from '@/composables/usePageMeta'
import type { UserMe } from '@/stores/session-types'
import { avatarSrc } from '@/shells/shared/avatar'
import { LOGO_URL } from '@/shells/shared/brand'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

import AdminServerStatus from './AdminServerStatus.vue'
import { LG_QUERY, useMediaQuery } from './useMinWidth'
import { DsCluster } from '@/ds'

const props = defineProps<{
  header: PageHeader
  user: UserMe | null
  home: string
  serverStatus: boolean
}>()

// The pill exists (and polls) at ≥ lg only: it is not mounted below 1024 px.
const wide = useMediaQuery(LG_QUERY)
const showPill = computed(() => props.serverStatus && wide.value)
</script>

<template>
  <header
    class="topbar sticky top-0 z-30 border-b border-indigo-500/10 px-3 py-2 sm:px-6 sm:py-4"
    data-testid="shell-admin-header"
  >
    <DsCluster justify="between" :wrap="false">
      <div class="min-w-0 flex-1">
        <h1
          class="truncate font-heading text-base font-bold text-slate-800 sm:text-2xl"
          data-testid="shell-admin-title"
        >
          {{ header.title }}
        </h1>
        <p
          v-if="header.subtitle"
          class="truncate text-xs text-slate-500 sm:text-sm"
          data-testid="shell-admin-subtitle"
        >
          {{ header.subtitle }}
        </p>
      </div>

      <!-- ≥ lg: pill (admin only), avatar, logout -->
      <div class="hidden shrink-0 items-center gap-4 lg:flex">
        <AdminServerStatus v-if="showPill" />
        <img
          :src="avatarSrc(user)"
          alt="Avatar"
          class="avatar-ring h-10 w-10 rounded-full"
          data-testid="shell-admin-header-avatar"
        />
        <ShellLink
          to="/logout"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          title="Log Keluar"
          data-testid="shell-admin-header-logout"
        >
          <NavIcon fa="fa-sign-out-alt" />
        </ShellLink>
      </div>

      <!-- < lg: logo (touch target >= 44px) -->
      <ShellLink
        :to="home"
        class="flex min-h-11 shrink-0 items-center lg:hidden"
        data-testid="shell-admin-header-logo"
      >
        <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-8 w-auto sm:h-10" />
      </ShellLink>
    </DsCluster>
  </header>
</template>
