<script setup lang="ts">
/**
 * The tabs of Import & Semakan (field 07-01). Each tab is its own route. `Kertas Diimport` joins when
 * S1-T10 adds its list: until then it would open an empty screen.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsPillNav, type PillItem } from '@/ds'

import { INTAKE_LIST_PATH } from '../lib/intake-routes'

type ImportTab = 'kelompok' | 'kiriman'

const TABS: PillItem<ImportTab>[] = [
  { key: 'kelompok', label: 'Kelompok Item', to: INTAKE_LIST_PATH },
  { key: 'kiriman', label: 'Kiriman Guru', to: '/admin/question-submissions' },
]

const route = useRoute()
const active = computed<ImportTab | null>(() => TABS.find((t) => t.to === route.path)?.key ?? null)
</script>

<template>
  <DsPillNav
    :items="TABS"
    :active="active"
    label="Import & Semakan"
    testid-prefix="import-tab"
    data-testid="import-tabs"
  />
</template>
