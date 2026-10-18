<script setup lang="ts">
/**
 * L-12 page shells (M08-T6; FR-M08-137, SQ L-12 / OQ-M08-13): `/headcount/{id}/results/{n}`, `/edit`,
 * `/unjuran` and `/settings` render the page header (route meta) and a back link to S23 only; no form is
 * specified (provisional). The config is read through #24 so an unknown id is the 404 page and a config
 * the viewer may not open the 403 page; `results/{n}` outside 1…OTR Aktif is the 404 page (INFERRED).
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { setRouteOutcome } from '@/app/router'
import { DsBackLink, DsLoadError, DsPage } from '@/ds'

import { fetchHeadcountSummary } from '../api/headcount'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const route = useRoute()
const id = computed(() => Number(route.params.id))
const n = computed(() => (route.params.n === undefined ? null : Number(route.params.n)))

const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountSummary(id.value, { signal }),
  [id],
)

watch(
  data,
  (d) => {
    if (d && n.value !== null && (n.value < 1 || n.value > d.config.activeOtrs))
      setRouteOutcome(404)
  },
  { immediate: true },
)
</script>

<template>
  <DsPage data-testid="headcount-shell-page">
    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <div v-else-if="data" class="flex items-center gap-3">
      <DsBackLink :to="`/headcount/${String(id)}`" label="Kembali" data-testid="back-link" />
    </div>
  </DsPage>
</template>
