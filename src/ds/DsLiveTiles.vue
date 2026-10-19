<script setup lang="ts">
/**
 * Staff "Langsung" tiles (Pemantauan > Langsung): a LIVE badge and a grid of stat tiles. Staff
 * look: tinted theme chips, no 3D art. Labels come from the caller.
 */
import DsLiveBadge from './DsLiveBadge.vue'
import DsStatTile from './DsStatTile.vue'

export interface LiveTile {
  id: string
  value: string | number
  /** Label under the number. */
  unit: string
  icon: string
}

defineProps<{
  tiles: LiveTile[]
  /** Accessible name of the group (BM). */
  label: string
  liveLabel: string
}>()
</script>

<template>
  <section class="flex flex-col gap-3" :aria-label="label" data-ds="live-tiles">
    <div class="flex items-center gap-2">
      <DsLiveBadge :label="liveLabel" />
    </div>
    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <li v-for="tile in tiles" :key="tile.id" class="min-w-0">
        <DsStatTile :value="tile.value" :unit="tile.unit" :icon="tile.icon" />
      </li>
    </ul>
  </section>
</template>
