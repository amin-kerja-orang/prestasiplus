<script setup lang="ts">
/**
 * The tabs of `Senarai Soalan` (M-07, FR-ADM-Q21.1, FR-ADM-QE8.1): links to the existing routes, which keep their own pages
 * and URLs. `Perlu dikumpulkan semula` is the list route with `?tab=regroup`, so it is told from `Senarai` by the query.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsPillNav, type PillItem } from '@/ds'

import { QUALITY_PATH } from '../lib/import-quality'
import { QUESTIONS_LIST_PATH, REGROUP_TAB } from '../lib/question-list'
import { REPORTS_PATH } from '../lib/report-routes'

type AreaTab = 'senarai' | 'kualiti' | 'laporan' | 'regroup'

const TABS: PillItem<AreaTab>[] = [
  { key: 'senarai', label: 'Senarai', to: QUESTIONS_LIST_PATH },
  { key: 'kualiti', label: 'Kualiti', to: QUALITY_PATH },
  { key: 'laporan', label: 'Laporan', to: REPORTS_PATH },
  { key: 'regroup', label: 'Perlu dikumpulkan semula', to: { path: QUESTIONS_LIST_PATH, query: { tab: REGROUP_TAB } } },
]

const route = useRoute()
const active = computed<AreaTab | null>(() => {
  if (route.path === QUESTIONS_LIST_PATH && route.query.tab === REGROUP_TAB) return 'regroup'
  return TABS.find((t) => t.to === route.path)?.key ?? null
})
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
