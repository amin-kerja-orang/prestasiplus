<script setup lang="ts">
/** "ROI Platform (Anggaran)" (FN-M12-6.8.1; FR-M12-58; BR-M12-23): four figures and the static amber box. */
import { AppIcon } from '@/components/icon'

import type { Results } from '../../../api/types'
import { CARD, gps, mean, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ roi: Results['roi'] }>()
</script>

<template>
  <section :class="[CARD, 'min-w-0 p-4 sm:p-5']" data-testid="res-roi">
    <h2 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <AppIcon name="fa-coins" class="h-4 w-4 text-amber-500" />ROI Platform (Anggaran)
    </h2>
    <div class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
      <div>
        <p class="text-xs text-slate-500">Pelajar Aktif</p>
        <p class="font-heading text-lg font-bold text-slate-800" data-testid="roi-active">
          {{ plain(roi.active) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-slate-500">Purata Soalan/Pelajar</p>
        <p class="font-heading text-lg font-bold text-slate-800" data-testid="roi-per-student">
          {{ mean(roi.perStudent) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-slate-500">Ketepatan Aktif</p>
        <p class="font-heading text-lg font-bold text-slate-800" data-testid="roi-accuracy">
          {{ pct(roi.accuracy) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-slate-500">GPS Headcount</p>
        <p class="font-heading text-lg font-bold text-slate-800" data-testid="roi-gps">
          {{ roi.gps === null ? '-' : gps(roi.gps) }}
        </p>
      </div>
    </div>
    <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <p class="flex items-center gap-1.5 font-semibold">
        <AppIcon name="fa-calculator" class="h-3.5 w-3.5" />ROI penuh akan dapat dikira apabila:
      </p>
      <ol class="mt-1 list-inside list-decimal space-y-0.5">
        <li>Keputusan peperiksaan sebenar (SPM/dalaman) diimport</li>
        <li>Data kos langganan platform dimasukkan</li>
        <li>Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat</li>
      </ol>
    </div>
  </section>
</template>
