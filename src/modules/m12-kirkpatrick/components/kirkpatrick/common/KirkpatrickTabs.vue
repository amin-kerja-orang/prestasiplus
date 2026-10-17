<script setup lang="ts">
/**
 * The in-page level tab strip of S2, S3, S4, S5 and S7 (FN-M12-1.1.9; FR-M12-09): six plain links to
 * unfiltered URLs of the mount, the current one soft kobalt. S1 and S6 show no strip. The strip scrolls
 * inside itself on a narrow screen. Targets are built from `basePath` (see `kirkpatrick-paths.ts`).
 */
import { computed } from 'vue'

import { kirkpatrickPaths } from './kirkpatrick-paths'

export type KirkpatrickTab =
  'overview' | 'reaction' | 'learning' | 'behavior' | 'results' | 'interventions'

const props = defineProps<{ basePath: string; current: KirkpatrickTab }>()

const paths = computed(() => kirkpatrickPaths(props.basePath))
const TABS: { key: KirkpatrickTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'i-ph-squares-four' },
  { key: 'reaction', label: 'T1: Reaksi', icon: 'i-ph-smiley' },
  { key: 'learning', label: 'T2: Pembelajaran', icon: 'i-ph-brain' },
  { key: 'behavior', label: 'T3: Tingkah Laku', icon: 'i-ph-footprints' },
  { key: 'results', label: 'T4: Hasil', icon: 'i-ph-trophy' },
  { key: 'interventions', label: 'Intervensi', icon: 'i-ph-hand-heart' },
]
</script>

<template>
  <nav class="max-w-full overflow-x-auto" aria-label="Tahap Kirkpatrick" data-testid="kirk-tabs">
    <div class="flex w-max gap-1">
      <UButton
        v-for="tab in TABS"
        :key="tab.key"
        :to="paths[tab.key]"
        :label="tab.label"
        :icon="tab.icon"
        size="lg"
        class="min-h-11"
        :color="tab.key === current ? 'primary' : 'neutral'"
        :variant="tab.key === current ? 'soft' : 'ghost'"
        :data-testid="`kirk-tab-${tab.key}`"
        :data-active="tab.key === current ? 'true' : 'false'"
      />
    </div>
  </nav>
</template>
