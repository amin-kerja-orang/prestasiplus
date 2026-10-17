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
import { DsEmptyState, DsStatTile } from '@/ds'

import { fetchHistory } from '../api/practice'
import type { HistoryItem } from '../api/types'
import LoadError from '../components/quiz/LoadError.vue'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const PILLS = [
  { value: '', label: 'Semua' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
] as const

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
  return pct >= 80 ? '🏆 Cemerlang' : pct >= 60 ? '👍 Baik' : pct >= 36 ? '📈 Teruskan' : '💪 Cuba Lagi'
}
const itemKey = (i: HistoryItem): string => i.id
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="history-page">
    <div class="flex flex-col gap-1">
      <h1 class="text-title text-highlighted">Sejarah Latihan</h1>
      <p class="max-w-prose text-body text-muted">Rekod latihan dan prestasi anda</p>
    </div>

    <template v-if="data && meta">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="history-totals">
        <DsStatTile :value="meta.totals.sessions" unit="Jumlah Sesi" icon="i-ph-sparkle" />
        <DsStatTile :value="meta.totals.answered" unit="Soalan Dijawab" icon="i-ph-target" />
        <DsStatTile
          :value="`${meta.totals.avgAccuracyPct}%`"
          unit="Purata Ketepatan"
          icon="i-ph-chart-bar"
        />
        <DsStatTile :value="meta.totals.coins" unit="Syiling Dikumpul" icon="i-ph-coins" />
      </div>

      <nav class="flex flex-wrap gap-2" aria-label="Tempoh" data-testid="history-pills">
        <UButton
          v-for="p in PILLS"
          :key="p.label"
          :to="p.value ? { path: '/practice/history', query: { period: p.value } } : '/practice/history'"
          size="lg"
          class="min-h-11"
          :color="period === p.value ? 'primary' : 'neutral'"
          :variant="period === p.value ? 'solid' : 'soft'"
          :data-active="period === p.value ? 'true' : 'false'"
          data-testid="history-pill"
          >{{ p.label }}</UButton
        >
      </nav>

      <UCard v-if="items.length === 0" data-testid="history-empty">
        <DsEmptyState
          title="Belum Ada Rekod Latihan"
          description="Anda belum melengkapkan sebarang latihan lagi. Mulakan latihan pertama anda sekarang dan kumpul syiling! 🚀"
          icon="i-ph-notepad"
        >
          <template #actions>
            <UButton to="/practice" size="lg" class="min-h-11">Mula Latihan</UButton>
          </template>
        </DsEmptyState>
      </UCard>

      <ul v-else class="flex flex-col gap-3" data-testid="history-list">
        <li v-for="s in items" :key="itemKey(s)" class="min-w-0">
          <UCard data-testid="history-session">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <UBadge color="neutral" variant="soft">{{ s.badge.label }}</UBadge>
              <span class="text-caption text-muted">{{ when(s.completedAt) }}</span>
              <span class="tabular ms-auto font-display text-heading text-highlighted"
                >{{ s.correctCount }} / {{ s.questionCount }}</span
              >
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
              <span>{{ clock(s.timeSpent) }}</span>
              <span>{{ s.correctCount }} betul</span>
              <span>{{ s.wrongCount }} salah</span>
              <span class="ms-auto font-semibold text-highlighted">{{ grade(s.accuracyPct) }}</span>
            </div>
            <UProgress class="mt-2" :model-value="s.accuracyPct" :max="100" />
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <UBadge color="primary" variant="soft">Ketepatan: {{ s.accuracyPct }}%</UBadge>
              <UBadge color="warning" variant="soft">🪙 {{ s.coinsEarned }} SYILING</UBadge>
            </div>
          </UCard>
        </li>
      </ul>

      <div v-if="meta.totalItems > meta.pageSize" class="flex justify-center" data-testid="history-pager">
        <UPagination
          :page="meta.page"
          :total="meta.totalItems"
          :items-per-page="meta.pageSize"
          @update:page="goPage"
        />
      </div>
    </template>

    <LoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="history-retry"
      @retry="reload"
    />
  </div>
</template>
