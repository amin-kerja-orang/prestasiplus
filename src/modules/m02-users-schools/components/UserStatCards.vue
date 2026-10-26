<script setup lang="ts">
/**
 * S1 role KPI tiles (FR-M02-02, DV-M02-02, DV-M02-10): 7 link tiles (`DsStatRow`, default density, because
 * the compact tile truncates the label), coloured icon chip + count + label. The tile of the active role
 * filter is framed (`data-active`).
 */
import { computed } from 'vue'

import { DsStatRow, type DsAccent, type StatItem } from '@/ds'

import type { RoleCounts } from '../api/users'
import { STAT_CARDS, USERS_LIST_PATH } from '../lib/user-list'

const props = defineProps<{ counts: RoleCounts | null; activeRole: string }>()

const ACCENTS: Record<string, DsAccent> = {
  student: 'action',
  teacher: 'win',
  parent: 'friend',
  sponsor: 'trial',
  school_admin: 'heat',
  ppd_officer: 'action',
  admin: 'friend',
}

const items = computed<StatItem[]>(() =>
  STAT_CARDS.map((card) => ({
    key: card.role,
    label: card.label,
    value: props.counts?.[card.key] ?? 0,
    icon: card.icon.replace(/^i-ph-/, ''),
    accent: ACCENTS[card.role] ?? 'action',
    to: { path: USERS_LIST_PATH, query: { role: card.role } },
    active: props.activeRole === card.role,
  })),
)
</script>

<template>
  <DsStatRow
    prefix="users-stat"
    :items="items"
    :loading="counts === null"
    :cols="4"
    aria-label="Ringkasan pengguna mengikut peranan"
    data-testid="users-stats"
  />
</template>
