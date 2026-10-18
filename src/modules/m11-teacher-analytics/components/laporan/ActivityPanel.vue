<script setup lang="ts">
/** FN-M11-2.2.9: "Pecahan Aktiviti ({range} Hari Lepas)", seven tiles (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-7`). */
import type { TeacherReport } from '../../api/types'
import { activityPanelTitle } from './copy'
import { grouped, type ActivityKey } from './format'

defineProps<{ activity: TeacherReport['activity']; range: number }>()

const TILES: { key: ActivityKey | 'jumlah'; label: string; icon: string }[] = [
  { key: 'kuiz', label: 'Kuiz', icon: 'i-ph-question' },
  { key: 'struktur', label: 'Struktur', icon: 'i-ph-list-numbers' },
  { key: 'latihTubi', label: 'Latih Tubi', icon: 'i-ph-barbell' },
  { key: 'trackingA', label: 'Tracking A', icon: 'i-ph-crosshair' },
  { key: 'battle', label: 'Battle', icon: 'i-ph-lightning' },
  { key: 'permainan', label: 'Permainan', icon: 'i-ph-game-controller' },
  { key: 'jumlah', label: 'Jumlah', icon: 'i-ph-sigma' },
]
</script>

<template>
  <UCard data-testid="panel-aktiviti">
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-chart-pie" class="size-4 text-primary-t" />
        <span data-testid="panel-title">{{ activityPanelTitle(range) }}</span>
      </h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div
          v-for="t in TILES"
          :key="t.key"
          class="flex min-w-0 flex-col items-center gap-1 bg-soft p-3 text-center"
          :data-testid="`tile-${t.key}`"
        >
          <p class="tabular text-heading text-highlighted" data-testid="tile-value">
            {{ grouped(t.key === 'jumlah' ? activity.total : activity.byType[t.key]) }}
          </p>
          <p class="flex items-center justify-center gap-1 text-caption text-muted">
            <UIcon :name="t.icon" class="size-3 shrink-0" />{{ t.label }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
