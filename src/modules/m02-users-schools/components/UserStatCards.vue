<script setup lang="ts">
/**
 * S1 role stat cards (FR-M02-02, DV-M02-02, DV-M02-10): 7 link cards, icon circle + count + label.
 * Grid 2 / 3 / 4 / 7 columns at base / sm / md / lg. Labels wrap, never truncate. The card of the
 * active role filter is ringed 2 px indigo-500.
 */
import { RouterLink } from 'vue-router'

import type { RoleCounts } from '../api/users'
import { STAT_CARDS, USERS_LIST_PATH } from '../lib/user-list'

defineProps<{ counts: RoleCounts | null; activeRole: string }>()
</script>

<template>
  <section
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-7 lg:gap-3"
    data-testid="users-stats"
  >
    <RouterLink
      v-for="card in STAT_CARDS"
      :key="card.role"
      :to="{ path: USERS_LIST_PATH, query: { role: card.role } }"
      :class="[
        'flex min-w-0 items-center gap-3 rounded-2xl bg-white p-3 shadow transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:p-4 lg:p-3',
        activeRole === card.role ? 'ring-2 ring-indigo-500' : '',
      ]"
      :data-testid="`users-stat-${card.role}`"
      :data-active="activeRole === card.role ? 'true' : undefined"
    >
      <span
        :class="['flex h-10 w-10 shrink-0 items-center justify-center rounded-full', card.tone]"
        aria-hidden="true"
      >
        <component :is="card.icon" class="h-5 w-5" />
      </span>
      <span class="min-w-0">
        <span
          v-if="counts"
          class="block font-heading text-xl leading-tight font-bold text-slate-800"
          data-testid="users-stat-count"
          >{{ counts[card.key] }}</span
        >
        <span v-else class="block h-6 w-10 animate-pulse rounded bg-slate-100"></span>
        <span class="block text-xs leading-tight break-words text-slate-500">{{ card.label }}</span>
      </span>
    </RouterLink>
  </section>
</template>
