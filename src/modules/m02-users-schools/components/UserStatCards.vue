<script setup lang="ts">
/**
 * S1 role stat cards (FR-M02-02, DV-M02-02, DV-M02-10): 7 link tiles, icon chip + count + label. Grid
 * 2 / 3 / 4 / 7 columns at base / sm / md / lg. The tile of the active role filter is framed.
 */
import { DsStatTile } from '@/ds'

import type { RoleCounts } from '../api/users'
import { STAT_CARDS, USERS_LIST_PATH } from '../lib/user-list'
import StatLink from './native/StatLink.vue'

defineProps<{ counts: RoleCounts | null; activeRole: string }>()
</script>

<template>
  <section
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7"
    data-testid="users-stats"
  >
    <StatLink
      v-for="card in STAT_CARDS"
      :key="card.role"
      :to="{ path: USERS_LIST_PATH, query: { role: card.role } }"
      :active="activeRole === card.role"
      :data-testid="`users-stat-${card.role}`"
      :data-active="activeRole === card.role ? 'true' : undefined"
    >
      <DsStatTile v-if="counts" :value="counts[card.key]" :unit="card.label" :icon="card.icon" />
      <USkeleton v-else class="h-24 w-full" />
    </StatLink>
  </section>
</template>
