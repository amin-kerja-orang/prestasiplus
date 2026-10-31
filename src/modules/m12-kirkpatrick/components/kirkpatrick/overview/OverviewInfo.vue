<script setup lang="ts">
/** S1 static info (FN-M12-2.7.1; FR-M12-31): the explanation panel under the filter card, collapsed by default. */
import { DsSurface, DsText } from '@/ds'

defineProps<{ open: boolean; id: string }>()
</script>

<template>
  <DsSurface
    v-show="open"
    :id="id"
    level="soft"
    shadow="none"
    padding="sm"
    data-testid="kirk-info"
  >
    <DsText variant="label">Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan</DsText>
    <DsText variant="body" tone="muted">
      Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959).
      Data Tahap 2 (Pembelajaran) dan Tahap 3 (Tingkah Laku) dijana secara automatik daripada
      aktiviti pelajar. Tahap 1 (Reaksi) memerlukan data survey, dan Tahap 4 (Hasil) memerlukan
      keputusan peperiksaan sebenar.
    </DsText>
  </DsSurface>
</template>
