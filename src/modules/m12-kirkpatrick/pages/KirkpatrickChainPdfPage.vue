<script setup lang="ts">
/**
 * `{prefix}/export-pdf` (FR-M12-61; SRS §7 #7; PROPOSED content, provisional): the target of S6 "Muat Turun Laporan".
 * It opens in a new tab (bare layout) as the print layout of the Rantaian Impak report: an A4 sheet in the light
 * staff tokens (`DsPrintSheet`), no chrome, with a print button that is hidden on paper. "Cetak" lets the browser
 * save the sheet as a PDF.
 */
import { DsPrintSheet } from '@/ds'

import { fetchKirkpatrickChain } from '../api'
import ChainCards from '../components/kirkpatrick/chain/ChainCards.vue'
import ChainConclusion from '../components/kirkpatrick/chain/ChainConclusion.vue'
import ChainCorrelation from '../components/kirkpatrick/chain/ChainCorrelation.vue'
import { KirkpatrickLoadState, useKirkpatrickPage } from '../components/kirkpatrick/common'

const { data, error, loading } = useKirkpatrickPage((signal) => fetchKirkpatrickChain({ signal }))
</script>

<template>
  <main class="p-4 md:p-6" data-testid="kirk-pdf">
    <DsPrintSheet print-label="Cetak / Simpan PDF">
      <div class="flex flex-col gap-4 p-4">
        <header class="flex flex-col gap-1">
          <h1 class="text-title text-highlighted">Model Kirkpatrick — Rantaian Impak</h1>
          <p class="text-body text-muted">
            Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick
          </p>
        </header>
        <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />
        <template v-if="data">
          <ChainCards :chain="data" />
          <ChainCorrelation :correlation="data.correlation" :strength="data.t4.strength" />
          <ChainConclusion />
        </template>
      </div>
    </DsPrintSheet>
  </main>
</template>
