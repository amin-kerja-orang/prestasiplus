<script setup lang="ts">
/**
 * R1-MUR-A1 block 7 (FR-MUR-A1-1, issue 458 decision 4): card "Kalendar Kombo (30 Hari Terakhir)". 30 day cells,
 * oldest first, today last, each showing the two-digit day of the month and shaded by the number of SESSIONS that
 * day: 0 #f1f5f9, 1 #bbf7d0, 2-3 #4ade80, 4 or more #15803d. Cell title "{j M Y} — Tidak berlatih" or
 * "{j M Y} — {n} sesi".
 */
import { computed } from 'vue'

import type { AccountProfileCalendarDay } from '@pp/contract'

import { DsCluster, DsGrid, DsHeading, DsStack, DsText } from '@/ds'
import { formatDateShortMs } from '@/lib/time'

const props = defineProps<{
  days: readonly AccountProfileCalendarDay[]
}>()

/** The shade of a cell by its session count. */
const SHADES = { none: '#f1f5f9', one: '#bbf7d0', few: '#4ade80', many: '#15803d' } as const
const INK = { light: '#0f172a', dark: '#ffffff' } as const

function shadeOf(sessions: number): string {
  if (sessions <= 0) return SHADES.none
  if (sessions === 1) return SHADES.one
  if (sessions <= 3) return SHADES.few
  return SHADES.many
}

const cells = computed(() =>
  props.days.map((d) => {
    const title = `${formatDateShortMs(d.date)} — ${d.sessions > 0 ? `${String(d.sessions)} sesi` : 'Tidak berlatih'}`
    return {
      date: d.date,
      day: d.date.slice(8, 10),
      title,
      style: { backgroundColor: shadeOf(d.sessions), color: d.sessions >= 4 ? INK.dark : INK.light },
    }
  }),
)
</script>

<template>
  <UCard data-testid="profile-calendar">
    <DsStack gap="sm">
      <DsStack gap="none">
        <DsCluster gap="xs">
          <UIcon name="i-ph-calendar-check" class="size-5" aria-hidden="true" />
          <DsHeading :level="2" variant="subheading">Kalendar Kombo (30 Hari Terakhir)</DsHeading>
        </DsCluster>
        <DsText variant="caption">Jejak latihan harian anda</DsText>
      </DsStack>

      <DsGrid gap="xs" :cols="6" data-testid="profile-calendar-grid">
        <!-- The shades are fixed hex values of the PRD (R1-MUR-A1 block 7), so the colour is an inline style. -->
        <!-- eslint-disable pp/ds-no-inline-style -->
        <UBadge
          v-for="cell in cells"
          :key="cell.date"
          color="neutral"
          variant="solid"
          size="lg"
          class="min-w-0"
          :style="cell.style"
          :title="cell.title"
          :aria-label="cell.title"
          role="img"
          data-testid="profile-calendar-cell"
        >
          <span class="w-full text-center">{{ cell.day }}</span>
        </UBadge>
        <!-- eslint-enable pp/ds-no-inline-style -->
      </DsGrid>

      <DsText variant="caption">Petak lebih gelap bermaksud lebih banyak sesi pada hari itu.</DsText>
    </DsStack>
  </UCard>
</template>
