<script setup lang="ts">
/** S1 static info card (FN-M12-2.7.1; FR-M12-31): a compact collapsible callout under the subtitle. */
import { DsCallout } from '@/ds'
</script>

<template>
  <DsCallout
    tone="info"
    collapsible
    title="Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan"
    description="Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959). Data Tahap 2 (Pembelajaran) dan Tahap 3 (Tingkah Laku) dijana secara automatik daripada aktiviti pelajar. Tahap 1 (Reaksi) memerlukan data survey, dan Tahap 4 (Hasil) memerlukan keputusan peperiksaan sebenar."
    data-testid="kirk-info"
  />
</template>
