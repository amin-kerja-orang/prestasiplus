<script setup lang="ts">
/**
 * The KPI strip of S23 and S21: `DsStatTile`s in a `DsGrid`. `DsStatRow` cannot be used because its `cols` fix the
 * steps (2, then 3 at md); the two screens need their own steps (design `m18-amaran-summary` sections 4.3 and 5.3).
 * The test id of a tile is `${prefix}-${key}` on its list item.
 */
import { type DsCols, DsGrid, DsGridItem, type DsResponsive, DsStatTile, type StatItem } from '@/ds'

withDefaults(
  defineProps<{
    items: StatItem[]
    cols: DsResponsive<DsCols>
    prefix: string
    partPrefix?: string
  }>(),
  { partPrefix: undefined },
)
</script>

<template>
  <DsGrid as="ul" :cols="cols" gap="sm">
    <DsGridItem v-for="item in items" :key="item.key" as="li" :data-testid="`${prefix}-${item.key}`">
      <DsStatTile
        class="h-full w-full"
        :value="item.value"
        :unit="item.label"
        :sub="item.sub"
        :icon="item.icon"
        :accent="item.accent"
        :tone="item.tone"
        :part-prefix="partPrefix"
      />
    </DsGridItem>
  </DsGrid>
</template>
