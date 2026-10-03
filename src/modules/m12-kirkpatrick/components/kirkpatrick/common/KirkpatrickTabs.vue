<script setup lang="ts">
/**
 * The in-page level tab strip of S2, S3, S4, S5 and S7 (FN-M12-1.1.9; FR-M12-09): six plain links to
 * unfiltered URLs of the mount, the current one `bg-indigo-600 text-white`. S1 and S6 show no strip.
 * Targets are built from `basePath` (see `kirkpatrick-paths.ts`).
 */
import {
  Brain,
  FaceSlightlySmiling,
  Footprints,
  HandHelping,
  LayoutGrid,
  Trophy,
} from '@lucide/vue'
import { computed, type Component } from 'vue'
import { RouterLink } from 'vue-router'

import { kirkpatrickPaths } from './kirkpatrick-paths'

export type KirkpatrickTab =
  'overview' | 'reaction' | 'learning' | 'behavior' | 'results' | 'interventions'

const props = defineProps<{ basePath: string; current: KirkpatrickTab }>()

const paths = computed(() => kirkpatrickPaths(props.basePath))
const TABS: { key: KirkpatrickTab; label: string; icon: Component }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'reaction', label: 'T1: Reaksi', icon: FaceSlightlySmiling },
  { key: 'learning', label: 'T2: Pembelajaran', icon: Brain },
  { key: 'behavior', label: 'T3: Tingkah Laku', icon: Footprints },
  { key: 'results', label: 'T4: Hasil', icon: Trophy },
  { key: 'interventions', label: 'Intervensi', icon: HandHelping },
]
const ON = 'bg-indigo-600 text-white shadow-md'
const OFF = 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
</script>

<template>
  <nav class="mb-4 flex flex-wrap gap-1 sm:mb-6" data-testid="kirk-tabs">
    <RouterLink
      v-for="tab in TABS"
      :key="tab.key"
      :to="paths[tab.key]"
      :class="[
        'flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm',
        tab.key === current ? ON : OFF,
      ]"
      :data-testid="`kirk-tab-${tab.key}`"
      :data-active="tab.key === current ? 'true' : 'false'"
    >
      <component :is="tab.icon" class="h-4 w-4 shrink-0" />{{ tab.label }}
    </RouterLink>
  </nav>
</template>
