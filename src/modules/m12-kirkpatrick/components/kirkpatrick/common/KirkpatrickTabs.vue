<script setup lang="ts">
/**
 * The in-page level tab strip of S2, S3, S4, S5 and S7 (FN-M12-1.1.9; FR-M12-09): six plain links to
 * unfiltered URLs of the mount, the current one active. S1 and S6 show no strip. The strip is a
 * `DsPillNav` (it scrolls inside itself on a narrow screen). The Pembelajaran and Pentadbiran layouts print
 * the same pages as a strip above the page; then this one is left out, so one set of tabs shows (UAT G-16,
 * A-PM11). Targets are built from `basePath` (see
 * `kirkpatrick-paths.ts`).
 */
import { computed } from 'vue'

import { DsPillNav, useShellPrintsSectionTabs, type PillItem } from '@/ds'

import { kirkpatrickPaths } from './kirkpatrick-paths'

export type KirkpatrickTab =
  'overview' | 'reaction' | 'learning' | 'behavior' | 'results' | 'interventions'

const props = defineProps<{ basePath: string; current: KirkpatrickTab }>()

/** True while the layout prints the section tabs (`provideShellSectionTabs`). */
const shellHasTabs = useShellPrintsSectionTabs()

const paths = computed(() => kirkpatrickPaths(props.basePath))
const TABS: { key: KirkpatrickTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'i-ph-squares-four' },
  { key: 'reaction', label: 'T1: Reaksi', icon: 'i-ph-smiley' },
  { key: 'learning', label: 'T2: Pembelajaran', icon: 'i-ph-brain' },
  { key: 'behavior', label: 'T3: Tingkah Laku', icon: 'i-ph-footprints' },
  { key: 'results', label: 'T4: Hasil', icon: 'i-ph-trophy' },
  { key: 'interventions', label: 'Intervensi', icon: 'i-ph-hand-heart' },
]
const items = computed<PillItem<KirkpatrickTab>[]>(() =>
  TABS.map((t) => ({ ...t, to: paths.value[t.key] })),
)
</script>

<template>
  <DsPillNav
    v-if="!shellHasTabs"
    :items="items"
    :active="current"
    label="Tahap Kirkpatrick"
    testid-prefix="kirk-tab"
    data-testid="kirk-tabs"
  />
</template>
