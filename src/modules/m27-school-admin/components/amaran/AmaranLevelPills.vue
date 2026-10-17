<script setup lang="ts">
/**
 * S4 level pills (FR-M27-74; restyle spec AS-49): "Semua Tingkatan", "Tingkatan 4", "Tingkatan 5" as a
 * segmented row of links to `?tingkatan=`; the active one is the solid kobalt button.
 */
import { computed } from 'vue'

import type { LevelFilter } from '../../api/amaran'
import PillNav, { type PillItem } from '../shared/PillNav.vue'
import { AMARAN_PATH, LEVEL_PILLS } from './amaran-format'

const props = defineProps<{ active: LevelFilter | null }>()

const items = computed<PillItem<string>[]>(() =>
  LEVEL_PILLS.map((p) => ({
    key: p.level ?? 'all',
    label: p.label,
    to: p.level ? { path: AMARAN_PATH, query: { tingkatan: p.level } } : { path: AMARAN_PATH },
  })),
)
</script>

<template>
  <PillNav
    :items="items"
    :active="props.active ?? 'all'"
    nav-id="am-pills"
    prefix="am-pill"
    label="Tingkatan"
  />
</template>
