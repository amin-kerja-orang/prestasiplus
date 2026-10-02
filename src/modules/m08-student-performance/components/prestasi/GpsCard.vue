<script setup lang="ts">
/** S1 "📊 GPS Anggaran" (FR-M08-14). A null GPS (no graded headcount entries yet) shows "—" and no pill. */
import { computed } from 'vue'

import type { SchoolPerformance } from '../../api/types'
import { BAND_STYLE, DASH, dec2 } from '../../lib/prestasi/format'

const props = defineProps<{ gps: SchoolPerformance['gps'] }>()

const style = computed(() => (props.gps.band ? BAND_STYLE[props.gps.band] : null))
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="gps-card">
    <h3 class="mb-1 text-center text-base font-bold text-slate-700">📊 GPS Anggaran</h3>
    <p class="mb-4 text-center text-xs text-slate-400">
      Gred Purata Sekolah (lebih rendah = lebih baik)
    </p>
    <div class="flex flex-col items-center">
      <div
        class="flex h-36 w-36 flex-col items-center justify-center rounded-full border-4"
        :style="{ borderColor: style?.hex ?? '#e2e8f0' }"
      >
        <span
          :class="['text-4xl font-bold', style?.text ?? 'text-slate-400']"
          data-testid="gps-value"
          >{{ gps.value === null ? DASH : dec2(gps.value) }}</span
        >
        <span class="text-xs text-slate-400">GPS</span>
      </div>
      <span
        v-if="gps.band && style"
        :class="['mt-3 rounded-full border px-3 py-0.5 text-xs font-semibold', style.pill]"
        data-testid="gps-band"
        >{{ gps.band }}</span
      >
      <p class="mt-3 text-center text-sm text-slate-600">
        Berdasarkan <strong data-testid="gps-entries">{{ gps.entries }}</strong> entri headcount
      </p>
      <p class="mt-1 text-center text-xs text-slate-400">
        * Anggaran dari markah OTR, bukan SPM sebenar
      </p>
    </div>
  </section>
</template>
