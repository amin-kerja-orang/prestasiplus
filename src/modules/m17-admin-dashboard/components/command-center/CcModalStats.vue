<script setup lang="ts">
/** Summary tiles of the S7 dialogs ("Jawapan", "Sesi", ...): value over label. */
import { DsStatTile } from '@/ds'

export interface CcModalStat {
  label: string
  value: string
}
defineProps<{ stats: CcModalStat[] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="cc-modal-stats">
    <DsStatTile
      v-for="s in stats"
      :key="s.label"
      :value="s.value"
      :unit="s.label"
      data-testid="cc-modal-stat"
    />
  </div>
</template>
