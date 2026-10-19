<script setup lang="ts">
/**
 * S9 `/practice/history` "Sejarah Latihan" (M05 discovery 2.9; v2 learner theme). Four totals
 * cards, period pills (`Semua` plus week / month / year), session cards newest first with no link
 * to a detail page, the empty state and a pager. An unknown `?period=` lists everything with no
 * pill active.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPanel,
  DsPillNav,
  DsStatRow,
  type PillItem,
  type StatItem,
  DsStack,
  DsCluster,
  DsText,
} from '@/ds'

import { fetchHistory } from '../api/practice'
import type { HistoryItem } from '../api/types'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const PILLS = [
  { value: '', label: 'Semua' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
] as const

const PILL_ITEMS: PillItem<string>[] = PILLS.map((p) => ({
  key: p.value,
  label: p.label,
  testid: p.value || 'all',
  to: p.value ? { path: '/practice/history', query: { period: p.value } } : '/practice/history',
}))

const route = useRoute()
const router = useRouter()
const period = computed(() => (typeof route.query.period === 'string' ? route.query.period : ''))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))

const { data, error, reload } = useApi(
  (signal) => fetchHistory({ period: period.value || null, page: page.value }, { signal }),
  [period, page],
)
const items = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta ?? null)

function goPage(p: number): void {
  const query: Record<string, string> = { page: String(p) }
  if (period.value) query.period = period.value
  void router.push({ path: '/practice/history', query })
}

/** "19 May 2026, 03:49": English month names, as live (D-10). */
function when(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date}, ${time}`
}
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
/** "Cuba Lagi" is observed for 0-35%; the higher bands are INFERRED. */
function grade(pct: number): string {
  return pct >= 80
    ? '🏆 Cemerlang'
    : pct >= 60
      ? '👍 Baik'
      : pct >= 36
        ? '📈 Teruskan'
        : '💪 Cuba Lagi'
}
const totals = computed<StatItem[]>(() => {
  const t = meta.value?.totals
  return [
    {
      key: 'sessions',
      label: 'Jumlah Sesi',
      value: t?.sessions ?? 0,
      icon: 'sparkle',
      accent: 'action',
    },
    {
      key: 'answered',
      label: 'Soalan Dijawab',
      value: t?.answered ?? 0,
      icon: 'i-ph-target',
      accent: 'win',
    },
    {
      key: 'accuracy',
      label: 'Purata Ketepatan',
      value: `${t?.avgAccuracyPct ?? 0}%`,
      icon: 'i-ph-chart-bar',
      accent: 'heat',
    },
    {
      key: 'coins',
      label: 'Syiling Dikumpul',
      value: t?.coins ?? 0,
      icon: 'coins',
      accent: 'friend',
    },
  ]
})
const itemKey = (i: HistoryItem): string => i.id
</script>

<template>
  <DsPage
    title="Sejarah Latihan"
    subtitle="Rekod latihan dan prestasi anda"
    data-testid="history-page"
  >
    <template v-if="data && meta">
      <DsStatRow :items="totals" :cols="4" prefix="history-total" data-testid="history-totals" />

      <DsPillNav
        :items="PILL_ITEMS"
        :active="period"
        label="Tempoh"
        testid-prefix="history-pill"
        data-testid="history-pills"
      />

      <DsPanel v-if="items.length === 0" data-testid="history-empty">
        <DsEmptyState
          title="Belum Ada Rekod Latihan"
          description="Anda belum melengkapkan sebarang latihan lagi. Mulakan latihan pertama anda sekarang dan kumpul syiling! 🚀"
          icon="i-ph-notepad"
        >
          <template #actions>
            <UButton to="/practice" size="lg" class="min-h-11">Mula Latihan</UButton>
          </template>
        </DsEmptyState>
      </DsPanel>

      <DsStack v-else as="ul" gap="sm" data-testid="history-list">
        <li v-for="s in items" :key="itemKey(s)" class="min-w-0">
          <DsPanel data-testid="history-session">
            <DsCluster gap="md" row-gap="xs">
              <UBadge color="neutral" variant="subtle">{{ s.badge.label }}</UBadge>
              <DsText variant="caption" as="span">{{ when(s.completedAt) }}</DsText>
              <DsText variant="heading" as="span" tabular class="ms-auto"
                >{{ s.correctCount }} / {{ s.questionCount }}</DsText
              >
            </DsCluster>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
              <span>{{ clock(s.timeSpent) }}</span>
              <span>{{ s.correctCount }} betul</span>
              <span>{{ s.wrongCount }} salah</span>
              <DsText variant="label" tone="highlighted" class="ms-auto">{{
                grade(s.accuracyPct)
              }}</DsText>
            </div>
            <UProgress class="mt-2" :model-value="s.accuracyPct" :max="100" />
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <UBadge color="primary" variant="subtle">Ketepatan: {{ s.accuracyPct }}%</UBadge>
              <UBadge color="warning" variant="subtle">🪙 {{ s.coinsEarned }} SYILING</UBadge>
            </div>
          </DsPanel>
        </li>
      </DsStack>

      <DsCluster
        v-if="meta.totalItems > meta.pageSize"
        gap="none"
        align="stretch"
        justify="center"
        :wrap="false"
        data-testid="history-pager"
      >
        <UPagination
          :page="meta.page"
          :total="meta.totalItems"
          :items-per-page="meta.pageSize"
          @update:page="goPage"
        />
      </DsCluster>
    </template>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="history-retry"
      @retry="reload"
    />
  </DsPage>
</template>
