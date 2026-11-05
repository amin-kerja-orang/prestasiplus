<script setup lang="ts">
/**
 * S4 level pills (FR-M27-74; restyle spec AS-49): "Semua Tingkatan" then "Tingkatan n" for each Tingkatan that has
 * pupils (`levels`, FR-AS-49) as a segmented row of links to `?tingkatan=`; the active one is the solid kobalt button.
 */
import { computed } from 'vue'

import { DsPillNav, type PillItem } from '@/ds'

import type { LevelFilter } from '../../api/amaran'
import { AMARAN_PATH, levelPills } from './amaran-format'

const props = defineProps<{ active: LevelFilter | null; levels: readonly number[] }>()

const items = computed<PillItem<string>[]>(() =>
  levelPills(props.levels).map((p) => ({
    key: p.level ?? 'all',
    label: p.label,
    to: p.level ? { path: AMARAN_PATH, query: { tingkatan: p.level } } : { path: AMARAN_PATH },
  })),
)
</script>

<template>
  <DsPillNav
    :items="items"
    :active="props.active ?? 'all'"
    testid-prefix="am-pill"
    label="Tingkatan"
    data-testid="am-pills"
  />
</template>
