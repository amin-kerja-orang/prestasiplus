<script setup lang="ts">
/**
 * S6 Rantaian Impak (FR-M12-60 ... 69; URS EP-M12-7). No tab strip, no filter (`school_id` is ignored). "Muat Turun
 * Laporan" opens `{prefix}/export-pdf` in a new tab (see `KirkpatrickChainPdfPage`).
 */
import { computed } from 'vue'

import { DsPage } from '@/ds'

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
  <DsPage
    title="Model Kirkpatrick — Rantaian Impak"
    subtitle="Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick"
    data-testid="kirk-chain"
  >
    <template #actions>
      <UButton
        :to="exportPath"
        target="_blank"
        rel="noopener"
        size="lg"
        class="min-h-11"
        color="primary"
        variant="soft"
        icon="i-ph-download-simple"
        label="Muat Turun Laporan"
        data-testid="chain-export"
      />
      <UButton
        :to="paths.overview"
        size="lg"
        class="min-h-11"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left"
        label="Kembali"
        data-testid="chain-back"
      />
    </template>
    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />
    <template v-if="data">
      <ChainCards :chain="data" />
      <ChainCorrelation :correlation="data.correlation" :strength="data.t4.strength" />
      <ChainConclusion />
    </template>
  </DsPage>
</template>
