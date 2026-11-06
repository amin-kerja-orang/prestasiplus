<script setup lang="ts">
/**
 * S1 `/buku-nota/heatmap` "Heatmap Topik Lemah" (SRS M25 v1.2 FR-M25-02..25; roles-matrix row L19). User shell.
 * One read-only call: #1 the viewer's heatmap (API-DSKP-08). While it is pending only the spinner shows (no partial
 * tile); a failed call shows the error box. The V2 "Cikgu Pakar" block is hidden in R1 (FR-MUR-14-2, D73/D102), so
 * #2 is not called and `CikguPakarBlock` is not rendered. No AI call, no write.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsPage } from '@/ds'

import { getHeatmap } from '../api'
import HeatmapEmpty from '../components/heatmap/HeatmapEmpty.vue'
import HeatmapHero from '../components/heatmap/HeatmapHero.vue'
import HeatmapSubjectBlock from '../components/heatmap/HeatmapSubjectBlock.vue'

const heatmap = useApi((signal) => getHeatmap({ signal }))

const subjects = computed(() => heatmap.data.value?.subjects ?? [])
</script>

<template>
  <DsPage data-testid="heatmap-page">
    <h1 v-if="!heatmap.data.value" class="sr-only">Heatmap Topik Lemah</h1>
    <template v-if="heatmap.data.value">
      <HeatmapHero />
      <HeatmapSubjectBlock v-for="s in subjects" :key="s.id" :subject="s" />
      <HeatmapEmpty v-if="subjects.length === 0" />
    </template>
    <UAlert
      v-else-if="heatmap.error.value"
      color="error"
      variant="soft"
      icon="i-ph-warning-circle-duotone"
      :title="heatmap.error.value.message"
      data-testid="heatmap-error"
    />
    <p
      v-else
      class="flex justify-center py-10 text-muted"
      role="status"
      data-testid="heatmap-loading"
    >
      <UIcon name="i-ph-spinner-gap" class="size-7 animate-spin motion-reduce:animate-none" />
    </p>
  </DsPage>
</template>
