<script setup lang="ts">
/**
 * S6 Rantaian Impak (FR-M12-60 ... 69; URS EP-M12-7). No tab strip, no filter (`school_id` is ignored). "Muat Turun
 * Laporan" opens `{prefix}/export-pdf` in a new tab (see `KirkpatrickChainPdfPage`).
 */
import { Download } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { fetchKirkpatrickChain } from '../api'
import ChainCards from '../components/kirkpatrick/chain/ChainCards.vue'
import ChainConclusion from '../components/kirkpatrick/chain/ChainConclusion.vue'
import ChainCorrelation from '../components/kirkpatrick/chain/ChainCorrelation.vue'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickLoadState,
  kirkpatrickPaths,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'

const props = withDefaults(defineProps<{ basePath?: string }>(), {
  basePath: KIRKPATRICK_ADMIN_BASE,
})

const paths = computed(() => kirkpatrickPaths(props.basePath))
const exportPath = computed(() => `${paths.value.overview}/export-pdf`)

const { data, error, loading } = useKirkpatrickPage((signal) => fetchKirkpatrickChain({ signal }))
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="kirk-chain">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="font-heading text-xl font-bold text-gray-900 sm:text-2xl">
          Model Kirkpatrick — Rantaian Impak
        </h1>
        <p class="text-sm text-gray-500">
          Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick
        </p>
      </div>
      <div class="flex items-center gap-3">
        <a
          :href="exportPath"
          target="_blank"
          rel="noopener"
          class="flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          data-testid="chain-export"
        >
          <Download class="h-4 w-4" />Muat Turun Laporan
        </a>
        <RouterLink
          :to="paths.overview"
          class="flex min-h-11 items-center text-sm text-indigo-600 hover:underline"
          data-testid="chain-back"
          >← Kembali</RouterLink
        >
      </div>
    </header>
    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />
    <template v-if="data">
      <ChainCards :chain="data" />
      <ChainCorrelation :correlation="data.correlation" :strength="data.t4.strength" />
      <ChainConclusion />
    </template>
  </div>
</template>
