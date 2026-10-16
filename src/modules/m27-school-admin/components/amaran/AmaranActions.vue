<script setup lang="ts">
/**
 * S4 buttons (FR-M27-77), in order: "Keberkesanan Intervensi" (fa-chart-pie), "Ringkasan Eksekutif" (fa-file-alt)
 * and "Muat Turun CSV" (fa-download). All three are rendered with the contract hrefs; the first two target pages
 * that are deferred (DV-M27-23). The CSV link keeps its href and downloads through M18 #30 (the SPA has no page
 * at that path). Right-aligned from sm, stacked below.
 */
import { ChartPie, Download, FileText } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { usePrototypeScope } from '@/composables'

import { BUTTON_CLASS, csvHref, keberkesananHref, ringkasanHref } from './amaran-format'

defineProps<{ schoolId: number; downloading: boolean }>()
defineEmits<{ download: [] }>()

// Prototype scope (D43): the two deferred pages are outside the matrix, so their buttons are hidden.
const { allows } = usePrototypeScope()
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end"
    data-testid="am-actions"
  >
    <RouterLink
      v-if="allows(keberkesananHref)"
      :to="keberkesananHref"
      :class="[BUTTON_CLASS, 'bg-indigo-600 hover:bg-indigo-700']"
      data-icon="fa-chart-pie"
      data-testid="am-btn-keberkesanan"
    >
      <ChartPie class="h-4 w-4" />
      Keberkesanan Intervensi
    </RouterLink>
    <RouterLink
      v-if="allows(ringkasanHref(schoolId))"
      :to="ringkasanHref(schoolId)"
      :class="[BUTTON_CLASS, 'bg-slate-700 hover:bg-slate-800']"
      data-icon="fa-file-alt"
      data-testid="am-btn-ringkasan"
    >
      <FileText class="h-4 w-4" />
      Ringkasan Eksekutif
    </RouterLink>
    <a
      :href="csvHref(schoolId)"
      :class="[
        BUTTON_CLASS,
        'bg-teal-600 hover:bg-teal-700',
        downloading ? 'pointer-events-none opacity-60' : '',
      ]"
      data-icon="fa-download"
      data-testid="am-btn-csv"
      @click.prevent="$emit('download')"
    >
      <Download class="h-4 w-4" />
      Muat Turun CSV
    </a>
  </div>
</template>
