<script setup lang="ts">
/**
 * The tabs of `Senarai Soalan` (M-07, FR-ADM-Q21.1): links to the three existing routes, which keep
 * their own pages and URLs. S2-T04 adds its own entry here.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsPillNav, type PillItem } from '@/ds'

import { QUALITY_PATH } from '../lib/import-quality'
import { QUESTIONS_LIST_PATH } from '../lib/question-list'
import { REPORTS_PATH } from '../lib/report-routes'

type AreaTab = 'senarai' | 'kualiti' | 'laporan'

const TABS: PillItem<AreaTab>[] = [
  { key: 'senarai', label: 'Senarai', to: QUESTIONS_LIST_PATH },
  { key: 'kualiti', label: 'Kualiti', to: QUALITY_PATH },
  { key: 'laporan', label: 'Laporan', to: REPORTS_PATH },
]

const route = useRoute()
const active = computed<AreaTab | null>(() => TABS.find((t) => t.to === route.path)?.key ?? null)
</script>

<template>
  <DsPillNav
    :items="TABS"
    :active="active"
    label="Senarai Soalan"
    testid-prefix="question-area-tab"
    data-testid="question-area-tabs"
  />
</template>
