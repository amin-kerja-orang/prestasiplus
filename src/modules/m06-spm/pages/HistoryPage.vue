<script setup lang="ts">
/**
 * S10 `/spm/history` "Sejarah Kuiz SPM" (M06-T2; FR-M06-62…66, BR-M06-20), restyled for v2. Rows are
 * the caller's completed SPM sessions from M05 #23 (`modes=past_year,latih_tubi,ramalan&type=`); the
 * four stats are all-type (filter-independent). An unknown `type` shows every row with no filter
 * active. Rows are not links.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsBackLink,
  DsEmptyState,
  DsPage,
  DsPillNav,
  DsStatTile,
  type DsAccent,
  type PillItem,
} from '@/ds'
import { formatCount, formatNumber } from '@/lib/number'
import { formatDateTimeEn12, formatMinSec } from '@/lib/time'
import { fetchSessions } from '@/modules/m05-practice'

import LoadError from '../components/LoadError.vue'
import SkeletonCards from '../components/SkeletonCards.vue'
import {
  HISTORY_FILTERS,
  SPM_MODES,
  TYPE_BADGES,
  isSpmMode,
  parseHistoryType,
  scoreColor,
} from '../lib/history'

const route = useRoute()
const type = computed(() => parseHistoryType(route.query.type))

const { data, error, reload } = useApi(
  (signal) => fetchSessions({ modes: SPM_MODES, type: type.value }, { signal }),
  type,
)

const stats = computed<{ id: string; value: string; label: string; icon: string; accent: DsAccent }[]>(
  () => {
    const s = data.value?.meta.stats
    if (!s) return []
    return [
      {
        id: 'sessions',
        value: formatCount(s.sessions),
        label: 'Sesi Kuiz',
        icon: 'i-ph-game-controller-duotone',
        accent: 'action',
      },
      {
        id: 'accuracy',
        value: `${formatNumber(s.avgAccuracyPct, { decimals: 1 })}%`,
        label: 'Purata Ketepatan',
        icon: 'i-ph-crosshair-duotone',
        accent: 'win',
      },
      {
        id: 'coins',
        value: formatCount(s.coins),
        label: 'Jumlah Syiling',
        icon: 'i-ph-coins-duotone',
        accent: 'heat',
      },
      {
        id: 'answered',
        value: formatCount(s.answered),
        label: 'Soalan Dijawab',
        icon: 'i-ph-check-circle-duotone',
        accent: 'friend',
      },
    ]
  },
)

const rows = computed(() => (data.value?.data ?? []).filter((r) => isSpmMode(r.mode)))

const filterHref = (t: string | null) => (t === null ? '/spm/history' : `/spm/history?type=${t}`)

const pills: PillItem<string>[] = HISTORY_FILTERS.map((f) => ({
  key: f.type ?? 'all',
  label: f.label,
  icon: f.icon,
  to: filterHref(f.type),
}))
/** "Semua" is active only without a `type` parameter; an unknown value leaves no filter active. */
const activeFilter = computed<string | null>(() =>
  type.value !== null ? type.value : route.query.type === undefined ? 'all' : null,
)
</script>

<template>
  <DsPage
    title="Sejarah Kuiz SPM"
    :show-title="true"
    title-testid="spm-heading"
    data-testid="spm-history-page"
  >
    <template #breadcrumb>
      <DsBackLink to="/spm" label="Kembali ke Mod SPM" data-testid="spm-back" />
    </template>

    <template v-if="data">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-testid="history-stats">
        <div
          v-for="s in stats"
          :key="s.id"
          class="min-w-0"
          :data-testid="`history-stat-${s.id}`"
        >
          <DsStatTile :value="s.value" :unit="s.label" :icon="s.icon" :accent="s.accent" />
        </div>
      </div>

      <div data-testid="history-filters">
        <DsPillNav
          :items="pills"
          :active="activeFilter"
          label="Tapis jenis kuiz"
          testid-prefix="history-filter"
        />
      </div>

      <ul v-if="rows.length > 0" class="flex flex-col gap-3" data-testid="history-rows">
        <li v-for="r in rows" :key="r.id" class="min-w-0">
          <UCard data-testid="history-row">
            <div class="flex items-center gap-3 md:gap-4">
              <UBadge
                :color="scoreColor(r.percent)"
                variant="soft"
                size="lg"
                class="tabular shrink-0"
                data-testid="row-score"
                >{{ r.percent }}%</UBadge
              >
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <div v-if="isSpmMode(r.mode)">
                  <UBadge
                    :color="TYPE_BADGES[r.mode].color"
                    variant="soft"
                    data-testid="row-badge"
                    >{{ TYPE_BADGES[r.mode].label }}</UBadge
                  >
                </div>
                <p class="text-label text-highlighted" data-testid="row-correct">
                  {{ `${r.correctCount}/${r.questionCount} betul` }}
                </p>
                <p class="text-caption text-muted" data-testid="row-meta">
                  {{ r.completedAt ? formatDateTimeEn12(r.completedAt) : '' }} ·
                  {{ formatMinSec(r.timeSpent) }}
                </p>
              </div>
              <div class="tabular shrink-0 text-label text-highlighted" data-testid="row-coins">
                +{{ r.coinsEarned }} 🪙
              </div>
            </div>
          </UCard>
        </li>
      </ul>
      <UCard v-else data-testid="history-empty">
        <DsEmptyState
          title="Belum Ada Sejarah"
          description="Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini."
          icon="i-ph-notepad"
        >
          <template #actions>
            <UButton
              to="/spm"
              size="lg"
              class="min-h-11"
              icon="i-ph-play-circle-bold"
              data-testid="history-empty-cta"
              >Mula Kuiz SPM</UButton
            >
          </template>
        </DsEmptyState>
      </UCard>
    </template>
    <LoadError v-else-if="error" @retry="reload()" />
    <SkeletonCards v-else :count="3" />
  </DsPage>
</template>
