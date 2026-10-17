<script setup lang="ts">
/** Summary tiles of the S2 modals ("Jumlah Pelajar", "Aktif", ...): value over label. */
import { DsStatTile } from '@/ds'

export interface StatCard {
  label: string
  value: string
}
withDefaults(defineProps<{ cards: StatCard[]; cols?: 3 | 4 | 5 }>(), { cols: 4 })
</script>

<template>
  <div
    class="grid gap-3"
    :class="{
      'grid-cols-2 sm:grid-cols-4': cols === 4,
      'grid-cols-3': cols === 3,
      'grid-cols-2 sm:grid-cols-5': cols === 5,
    }"
    data-testid="cc-modal-cards"
  >
    <DsStatTile
      v-for="c in cards"
      :key="c.label"
      :value="c.value"
      :unit="c.label"
      data-testid="cc-modal-card"
    />
  </div>
</template>
