<script setup lang="ts">
/**
 * R1-MUR-A1 blocks 3 and 5 (FR-MUR-A1-1): stat tiles, label under the value. `kind="main"` is the six tiles
 * "Koin Saya", "Streak Hari", "Level", "Hari Berlatih", "Sesi Latihan", "Ketepatan" (the value ends with %, the
 * whole number rounded half up, 0% with no answers); `kind="combo"` is the three tiles "Kombo Hari Ini",
 * "Rekod Terpanjang", "Hari Berlatih". Two columns on a phone.
 */
import { computed } from 'vue'

import type { AccountProfileTiles } from '@pp/contract'

import { DsGrid, DsStack, DsText } from '@/ds'

const props = defineProps<{
  tiles: AccountProfileTiles
  kind: 'main' | 'combo'
}>()

interface Tile {
  key: string
  label: string
  value: string
}

/** Accuracy comes with one decimal; the screen shows the whole number, rounded half up. */
const percent = (accuracy: number | null): string => `${String(accuracy === null ? 0 : Math.round(accuracy))}%`

const items = computed<Tile[]>(() => {
  const t = props.tiles
  if (props.kind === 'combo') {
    return [
      { key: 'streakToday', label: 'Kombo Hari Ini', value: String(t.streakToday) },
      { key: 'streakBest', label: 'Rekod Terpanjang', value: String(t.streakBest) },
      { key: 'practiceDays', label: 'Hari Berlatih', value: String(t.practiceDays) },
    ]
  }
  return [
    { key: 'coins', label: 'Koin Saya', value: String(t.coins) },
    { key: 'streakDays', label: 'Streak Hari', value: String(t.streakDays) },
    { key: 'level', label: 'Level', value: String(t.level) },
    { key: 'practiceDays', label: 'Hari Berlatih', value: String(t.practiceDays) },
    { key: 'sessions', label: 'Sesi Latihan', value: String(t.sessions) },
    { key: 'accuracy', label: 'Ketepatan', value: percent(t.accuracy) },
  ]
})
</script>

<template>
  <DsGrid
    gap="sm"
    :cols="kind === 'main' ? { base: 2, md: 3, lg: 6 } : { base: 3 }"
    :data-testid="`profile-tiles-${kind}`"
  >
    <UCard v-for="tile in items" :key="tile.key" :data-testid="`profile-tile-${tile.key}`">
      <DsStack gap="none">
        <DsText variant="heading" align="center" data-testid="profile-tile-value">{{ tile.value }}</DsText>
        <DsText variant="caption" align="center" wrap="anywhere" data-testid="profile-tile-label">{{ tile.label }}</DsText>
      </DsStack>
    </UCard>
  </DsGrid>
</template>
