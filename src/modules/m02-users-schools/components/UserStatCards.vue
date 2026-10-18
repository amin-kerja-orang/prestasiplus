<script setup lang="ts">
/**
 * S1 role KPI tiles (FR-M02-02, DV-M02-02, DV-M02-10): 7 link tiles, coloured icon chip + count + label,
 * in the shared KPI strip. The tile of the active role filter is framed.
 */
import { AdminKpiStrip } from '@/ds/admin'
import { DsStatTile, type DsAccent } from '@/ds'

import type { RoleCounts } from '../api/users'
import { STAT_CARDS, USERS_LIST_PATH } from '../lib/user-list'
import StatLink from './native/StatLink.vue'

defineProps<{ counts: RoleCounts | null; activeRole: string }>()

const ACCENTS: Record<string, DsAccent> = {
  student: 'action',
  teacher: 'win',
  parent: 'friend',
  sponsor: 'trial',
  school_admin: 'heat',
  ppd_officer: 'action',
  admin: 'friend',
}
</script>

<template>
  <AdminKpiStrip label="Ringkasan pengguna mengikut peranan" data-testid="users-stats">
    <StatLink
      v-for="card in STAT_CARDS"
      :key="card.role"
      :to="{ path: USERS_LIST_PATH, query: { role: card.role } }"
      :active="activeRole === card.role"
      :data-testid="`users-stat-${card.role}`"
      :data-active="activeRole === card.role ? 'true' : undefined"
    >
      <DsStatTile
        v-if="counts"
        compact
        :value="counts[card.key]"
        :unit="card.label"
        :icon="card.icon"
        :accent="ACCENTS[card.role] ?? 'action'"
      />
      <USkeleton v-else class="h-20 w-full" />
    </StatLink>
  </AdminKpiStrip>
</template>
