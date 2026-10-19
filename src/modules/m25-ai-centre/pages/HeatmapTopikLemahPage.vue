<script setup lang="ts">
/**
 * S1 `/buku-nota/heatmap` "Heatmap Topik Lemah" (SRS M25 v1.2 FR-M25-02..25; roles-matrix row L19). User shell.
 * Two read-only calls from the view: #1 the viewer's heatmap and #2 the Cikgu Pakar card (M24 contract). While
 * #1 is pending only the spinner shows (no partial cell); a failed #1 shows the error box; a failed or empty #2
 * hides only the Cikgu Pakar block. No AI call, no write.
 */
import { computed } from 'vue'

import { useApi, usePrototypeScope } from '@/composables'
import { DsPage } from '@/ds'

import { getDutaRecommendation, getHeatmap } from '../api'
import CikguPakarBlock from '../components/heatmap/CikguPakarBlock.vue'
import HeatmapEmpty from '../components/heatmap/HeatmapEmpty.vue'
import HeatmapHero from '../components/heatmap/HeatmapHero.vue'
import HeatmapSubjectBlock from '../components/heatmap/HeatmapSubjectBlock.vue'

const { allows } = usePrototypeScope()
const heatmap = useApi((signal) => getHeatmap({ signal }))
// A failed #2 only hides the block (FR-M25-25): the error is kept in `duta.error` and never shown.
const duta = useApi((signal) => getDutaRecommendation({ signal }))

const subjects = computed(() => heatmap.data.value?.subjects ?? [])
const card = computed(() => (duta.error.value ? null : (duta.data.value ?? null)))
</script>

<template>
  <DsPage data-testid="heatmap-page">
    <h1 v-if="!heatmap.data.value" class="sr-only">Heatmap Topik Lemah</h1>
    <template v-if="heatmap.data.value">
      <!-- Prototype scope (D43): the card links to Bilik Duta, which is outside the matrix. -->
      <CikguPakarBlock v-if="card && allows('/bilik-duta')" :card="card" />
      <HeatmapHero />
      <HeatmapSubjectBlock v-for="s in subjects" :key="s.subjectId" :subject="s" />
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
