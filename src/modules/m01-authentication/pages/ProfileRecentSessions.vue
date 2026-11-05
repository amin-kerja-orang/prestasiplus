<script setup lang="ts">
/**
 * R1-MUR-A1 block 8 (FR-MUR-A1-6): card "Sesi Terkini" / "{n} latihan terakhir anda". The last sessions of every
 * mode, newest first, no pager. Columns Mod (BM name), Soalan, Betul, Ketepatan (a pill: green at 70 or more, amber
 * 50-69, red below 50; the whole number rounded half up), Koin, Tarikh. The table scrolls inside its card.
 */
import type { TableColumn } from '@nuxt/ui'
import type { AccountProfileSession } from '@pp/contract'
import { computed } from 'vue'

import { DsCluster, DsHeading, DsStack, DsText } from '@/ds'
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
    <DsStack gap="sm">
      <DsStack gap="none">
        <DsCluster gap="xs">
          <UIcon name="i-ph-clock-counter-clockwise" class="size-5" aria-hidden="true" />
          <DsHeading :level="2" variant="subheading">Sesi Terkini</DsHeading>
        </DsCluster>
        <DsText v-if="sessions.length > 0" variant="caption" data-testid="profile-sessions-count">
          {{ sessions.length }} latihan terakhir anda
        </DsText>
      </DsStack>

      <DsStack
        v-if="sessions.length === 0"
        gap="2xs"
        align="center"
        class="text-center"
        data-testid="profile-sessions-empty"
      >
        <DsText variant="body" tone="highlighted">Belum ada sesi latihan lagi</DsText>
        <DsText variant="caption">Teruskan berlatih untuk melihat rekod anda di sini!</DsText>
      </DsStack>

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
          <DsCluster as="span" gap="2xs" :wrap="false">
            <UIcon name="i-ph-coins" class="size-4" aria-hidden="true" />{{ row.original.coins }}
          </DsCluster>
        </template>
        <template #at-cell="{ row }">
          <DsText as="span" variant="label" wrap="normal">{{ formatDateShortMs(row.original.at) }}</DsText>
        </template>
      </UTable>
    </DsStack>
  </UCard>
</template>
