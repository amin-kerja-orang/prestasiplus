<script setup lang="ts">
/**
 * `/spm/history` "Sejarah Kuiz SPM" (M06-T2; S3-T07 part F). Rows are the caller's closed SPM sittings from
 * `GET /api/spm/history?mod=&halaman=` (API-BIJAK-07), 15 per page, newest first; the four stats are all-mode
 * (chip- and page-independent). The chip is `?mod=` (the old `?type=` is still read); an unknown value sends no
 * filter and leaves no pill active. Rows are not links.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsBackLink, DsCluster, DsEmptyState, DsPage, DsPillNav, DsStatTile, DsText, type DsAccent, type PillItem, DsLoadError } from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchSpmHistory } from '../api'
import SkeletonCards from '../components/SkeletonCards.vue'
import {
  HISTORY_FILTERS,
  MODE_BADGES,
  formatAccuracy,
  formatHistoryDate,
  formatHistoryDuration,
  historyHref,
  pagerText,
  parseHistoryMod,
  parseHistoryPage,
  scoreColor,
} from '../lib/history'
import { LOAD_ERROR } from '../lib/copy'

const route = useRoute()
/** `null` = Semua; `undefined` = an unknown value (no filter). */
const mod = computed(() => parseHistoryMod(route.query))
const page = computed(() => parseHistoryPage(route.query.halaman))

const { data, error, reload } = useApi(
  (signal) => fetchSpmHistory({ mod: mod.value ?? null, halaman: page.value }, { signal }),
  [mod, page],
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
        value: formatAccuracy(s.avgAccuracy),
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

const rows = computed(() => data.value?.data ?? [])
const pageCount = computed(() => data.value?.meta.pageCount ?? 1)
const currentPage = computed(() => data.value?.meta.page ?? page.value)
const chip = computed(() => mod.value ?? null)

const pills: PillItem<string>[] = HISTORY_FILTERS.map((f) => ({
  key: f.mod ?? 'all',
  label: f.label,
  icon: f.icon,
  to: historyHref(f.mod),
}))
/** "Semua" is active only without a chip value; an unknown value leaves no filter active. */
const activeFilter = computed<string | null>(() =>
  mod.value === undefined ? null : (mod.value ?? 'all'),
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
                <div>
                  <UBadge
                    :color="MODE_BADGES[r.mode].color"
                    variant="soft"
                    data-testid="row-badge"
                    >{{ MODE_BADGES[r.mode].label }}</UBadge
                  >
                </div>
                <DsText variant="caption" data-testid="row-subject">{{ r.subject.name }}</DsText>
                <p class="text-label text-highlighted" data-testid="row-correct">
                  {{ `${r.correct}/${r.total} betul` }}
                </p>
                <p class="text-caption text-muted" data-testid="row-meta">
                  {{ formatHistoryDate(r.completedAt) }} · {{ formatHistoryDuration(r.durationSeconds) }}
                </p>
              </div>
              <div class="tabular shrink-0 text-label text-highlighted" data-testid="row-coins">
                +{{ r.coins }} 🪙
              </div>
            </div>
          </UCard>
        </li>
      </ul>
      <UCard v-else data-testid="history-empty">
        <DsEmptyState
          title="Belum ada percubaan SPM"
          description="Mula kuiz SPM untuk membina sejarah percubaan anda!"
          icon="i-ph-notepad"
        >
          <template #actions>
            <UButton
              to="/spm/tahun-lepas"
              size="lg"
              class="min-h-11"
              icon="i-ph-play-circle-bold"
              data-testid="history-empty-cta"
              >Mula Kuiz SPM</UButton
            >
          </template>
        </DsEmptyState>
      </UCard>
      <DsCluster
        v-if="rows.length > 0 || currentPage > 1"
        as="nav"
        aria-label="Halaman"
        gap="sm"
        justify="center"
        data-testid="history-pager"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="xl"
          label="Sebelum"
          :disabled="currentPage <= 1"
          :to="historyHref(chip, currentPage - 1)"
          data-testid="history-prev"
        />
        <DsText variant="label" tone="highlighted" data-testid="history-page-text">
          {{ pagerText(currentPage, pageCount) }}
        </DsText>
        <UButton
          color="neutral"
          variant="outline"
          size="xl"
          label="Seterusnya"
          :disabled="currentPage >= pageCount"
          :to="historyHref(chip, currentPage + 1)"
          data-testid="history-next"
        />
      </DsCluster>
    </template>
    <DsLoadError v-else-if="error" :message="LOAD_ERROR" testid="spm-error" retry-testid="spm-retry" @retry="reload()" />
    <SkeletonCards v-else :count="3" />
  </DsPage>
</template>
