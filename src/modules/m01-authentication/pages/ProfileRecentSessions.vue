<script setup lang="ts">
/**
 * R1-MUR-A1 block 8 (FR-MUR-A1-6): card "Sesi Terkini" / "{n} latihan terakhir anda". The last sessions of every
 * mode, newest first, no pager. Columns Mod (BM name), Soalan, Betul, Ketepatan (a pill: green at 70 or more, amber
 * 50-69, red below 50; the whole number rounded half up), Koin, Tarikh. The table scrolls inside its card.
 */
import type { TableColumn } from '@nuxt/ui'
import type { AccountProfileSession } from '@pp/contract'
import { computed } from 'vue'

import { formatDateShortMs } from '@/lib/time'

const props = defineProps<{
  sessions: readonly AccountProfileSession[]
}>()

const rows = computed(() => [...props.sessions])
const columns: TableColumn<AccountProfileSession>[] = [
  { accessorKey: 'modeLabel', header: 'Mod' },
  { accessorKey: 'questions', header: 'Soalan' },
  { accessorKey: 'correct', header: 'Betul' },
  { accessorKey: 'accuracy', header: 'Ketepatan' },
  { accessorKey: 'coins', header: 'Koin' },
  { accessorKey: 'at', header: 'Tarikh' },
]

const percentOf = (accuracy: number | null): number => (accuracy === null ? 0 : Math.round(accuracy))
const toneOf = (accuracy: number | null): 'success' | 'warning' | 'error' => {
  const p = percentOf(accuracy)
  if (p >= 70) return 'success'
  if (p >= 50) return 'warning'
  return 'error'
}
</script>

<template>
  <UCard data-testid="profile-sessions">
    <div class="flex flex-col gap-3">
      <div>
        <h2 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-clock-counter-clockwise" class="size-5" aria-hidden="true" />
          Sesi Terkini
        </h2>
        <p v-if="sessions.length > 0" class="text-caption text-muted" data-testid="profile-sessions-count">
          {{ sessions.length }} latihan terakhir anda
        </p>
      </div>

      <div
        v-if="sessions.length === 0"
        class="flex flex-col items-center gap-1 text-center"
        data-testid="profile-sessions-empty"
      >
        <p class="text-body text-highlighted">Belum ada sesi latihan lagi</p>
        <p class="text-caption text-muted">Teruskan berlatih untuk melihat rekod anda di sini!</p>
      </div>

      <!-- The table scrolls inside its card (AC-MUR-A1-6), never the page. -->
      <UTable
        v-else
        :data="rows"
        :columns="columns"
        class="max-w-full"
        data-testid="profile-sessions-scroll"
      >
        <template #modeLabel-cell="{ row }">
          <span data-testid="profile-session-mode">{{ row.original.modeLabel }}</span>
        </template>
        <template #accuracy-cell="{ row }">
          <UBadge :color="toneOf(row.original.accuracy)" variant="soft" data-testid="profile-session-accuracy"
            >{{ percentOf(row.original.accuracy) }}%</UBadge
          >
        </template>
        <template #coins-cell="{ row }">
          <span class="inline-flex items-center gap-1">
            <UIcon name="i-ph-coins" class="size-4 text-warning" aria-hidden="true" />{{ row.original.coins }}
          </span>
        </template>
        <template #at-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatDateShortMs(row.original.at) }}</span>
        </template>
      </UTable>
    </div>
  </UCard>
</template>
