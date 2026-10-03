<script setup lang="ts">
/**
 * S10 `/spm/history` "Sejarah Kuiz SPM" (M06-T2; FR-M06-62…66, BR-M06-20). Rows are the caller's completed
 * SPM sessions from M05 #23 (`modes=past_year,latih_tubi,ramalan&type=`); the four stats are all-type
 * (filter-independent). An unknown `type` shows every row with no filter active. Rows are not links.
 */
import { ArrowLeft, Brain, PlayCircle, ScrollText, WandSparkles } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { formatCount, formatNumber } from '@/lib/number'
import { formatDateTimeEn12, formatMinSec } from '@/lib/time'
import { fetchSessions } from '@/modules/m05-practice'

import LoadError from '../components/LoadError.vue'
import {
  HISTORY_FILTERS,
  SPM_MODES,
  TYPE_BADGES,
  type HistoryType,
  isSpmMode,
  parseHistoryType,
  scoreTileClass,
} from '../lib/history'

const route = useRoute()
const type = computed(() => parseHistoryType(route.query.type))

const { data, error, reload } = useApi(
  (signal) => fetchSessions({ modes: SPM_MODES, type: type.value }, { signal }),
  type,
)

const stats = computed(() => {
  const s = data.value?.meta.stats
  if (!s) return []
  return [
    { id: 'sessions', value: formatCount(s.sessions), label: 'Sesi Kuiz', cls: 'text-indigo-600' },
    {
      id: 'accuracy',
      value: `${formatNumber(s.avgAccuracyPct, { decimals: 1 })}%`,
      label: 'Purata Ketepatan',
      cls: 'text-green-600',
    },
    { id: 'coins', value: formatCount(s.coins), label: 'Jumlah Syiling', cls: 'text-amber-600' },
    {
      id: 'answered',
      value: formatCount(s.answered),
      label: 'Soalan Dijawab',
      cls: 'text-blue-600',
    },
  ]
})

const rows = computed(() => (data.value?.data ?? []).filter((r) => isSpmMode(r.mode)))

const FILTER_ICONS = { past_year: ScrollText, latih_tubi: Brain, ramalan: WandSparkles } as const

const iconOf = (t: HistoryType | null) => (t === null ? undefined : FILTER_ICONS[t])

const filterHref = (t: string | null) => (t === null ? '/spm/history' : `/spm/history?type=${t}`)
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="spm-history-page">
    <div class="mx-auto max-w-4xl">
      <RouterLink
        to="/spm"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="spm-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali ke Mod SPM
      </RouterLink>

      <h1
        class="mb-5 font-heading text-2xl font-extrabold text-slate-800 sm:text-3xl"
        data-testid="spm-heading"
      >
        Sejarah Kuiz SPM
      </h1>

      <template v-if="data">
        <div
          class="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
          data-testid="history-stats"
        >
          <div
            v-for="s in stats"
            :key="s.id"
            class="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm sm:p-4"
            :data-testid="`history-stat-${s.id}`"
          >
            <div :class="['font-heading text-2xl font-extrabold', s.cls]" data-testid="stat-value">
              {{ s.value }}
            </div>
            <div class="text-xs font-medium text-slate-500 sm:text-sm" data-testid="stat-label">
              {{ s.label }}
            </div>
          </div>
        </div>

        <div class="mb-5 flex flex-wrap gap-2" data-testid="history-filters">
          <RouterLink
            v-for="f in HISTORY_FILTERS"
            :key="f.label"
            :to="filterHref(f.type)"
            :class="[
              'inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-4 text-sm font-bold transition',
              type !== null && type === f.type
                ? `${f.active} border-transparent text-white shadow-md`
                : type === null && f.type === null && route.query.type === undefined
                  ? `${f.active} border-transparent text-white shadow-md`
                  : `border-slate-200 bg-white text-slate-700 ${f.hover}`,
            ]"
            :data-testid="`history-filter-${f.type ?? 'all'}`"
          >
            <component :is="iconOf(f.type)" v-if="f.type" class="h-4 w-4" aria-hidden="true" />
            {{ f.label }}
          </RouterLink>
        </div>

        <div v-if="rows.length > 0" class="space-y-3" data-testid="history-rows">
          <div
            v-for="r in rows"
            :key="r.id"
            class="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:gap-4 sm:p-4"
            data-testid="history-row"
          >
            <div
              :class="[
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-base font-extrabold',
                scoreTileClass(r.percent),
              ]"
              data-testid="row-score"
            >
              {{ r.percent }}%
            </div>
            <div class="min-w-0 flex-1">
              <span
                v-if="isSpmMode(r.mode)"
                :class="[
                  'inline-block rounded-md px-2 py-0.5 text-xs font-bold',
                  TYPE_BADGES[r.mode].cls,
                ]"
                data-testid="row-badge"
              >
                {{ TYPE_BADGES[r.mode].label }}
              </span>
              <p class="text-sm font-semibold text-slate-800" data-testid="row-correct">
                {{ `${r.correctCount}/${r.questionCount} betul` }}
              </p>
              <p class="text-xs text-slate-500" data-testid="row-meta">
                {{ r.completedAt ? formatDateTimeEn12(r.completedAt) : '' }} ·
                {{ formatMinSec(r.timeSpent) }}
              </p>
            </div>
            <div class="shrink-0 text-sm font-bold text-amber-600" data-testid="row-coins">
              +{{ r.coinsEarned }} 🪙
            </div>
          </div>
        </div>
        <div
          v-else
          class="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm"
          data-testid="history-empty"
        >
          <h2 class="mb-1 font-heading text-lg font-extrabold text-slate-800">Belum Ada Sejarah</h2>
          <p class="mb-4 text-sm text-slate-600">
            Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini.
          </p>
          <RouterLink
            to="/spm"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
            data-testid="history-empty-cta"
          >
            <PlayCircle class="h-4 w-4" aria-hidden="true" />
            Mula Kuiz SPM
          </RouterLink>
        </div>
      </template>
      <LoadError v-else-if="error" @retry="reload()" />
      <div
        v-else
        class="h-40 animate-pulse rounded-2xl bg-slate-100"
        aria-busy="true"
        data-testid="spm-skeleton"
      ></div>
    </div>
  </div>
</template>
