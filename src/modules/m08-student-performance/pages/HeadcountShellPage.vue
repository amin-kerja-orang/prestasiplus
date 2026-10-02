<script setup lang="ts">
/**
 * L-12 page shells (M08-T6; FR-M08-137, SQ L-12 / OQ-M08-13): `/headcount/{id}/results/{n}`, `/edit`,
 * `/unjuran` and `/settings` render the page header (route meta) and a back link to S23 only; no form is
 * specified (provisional). The config is read through #24 so an unknown id is the 404 page and a config
 * the viewer may not open the 403 page; `results/{n}` outside 1…OTR Aktif is the 404 page (INFERRED).
 */
import { ArrowLeft } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { setRouteOutcome } from '@/app/router'

import { fetchHeadcountSummary } from '../api/headcount'
import LoadError from '../components/headcount/LoadError.vue'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

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
  <div class="min-w-0 space-y-5" data-testid="headcount-shell-page">
    <LoadError v-if="isLoadError(error)" @retry="reload()" />

    <div v-else-if="data" class="flex items-center gap-3">
      <RouterLink
        :to="`/headcount/${id}`"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow transition hover:text-slate-800"
        data-testid="back-link"
        ><ArrowLeft class="h-5 w-5"
      /></RouterLink>
    </div>
  </div>
</template>
