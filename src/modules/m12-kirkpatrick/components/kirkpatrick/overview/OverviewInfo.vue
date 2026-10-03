<script setup lang="ts">
/** S1 static info card (FN-M12-2.7.1; FR-M12-31). */
import { Info } from '@lucide/vue'
</script>

<template>
  <section
    class="flex gap-3 rounded-2xl border border-cyan-300 bg-gradient-to-r from-cyan-50 to-blue-50 p-3 sm:p-4"
    data-testid="kirk-info"
  >
    <Info class="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
    <div class="min-w-0">
      <p class="text-sm font-semibold text-slate-700">
        Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan
      </p>
      <p class="text-sm text-slate-600">
        Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick
        (1959). Data Tahap 2 (Pembelajaran) dan Tahap 3 (Tingkah Laku) dijana secara automatik
        daripada aktiviti pelajar. Tahap 1 (Reaksi) memerlukan data survey, dan Tahap 4 (Hasil)
        memerlukan keputusan peperiksaan sebenar.
      </p>
    </div>
  </section>
</template>
