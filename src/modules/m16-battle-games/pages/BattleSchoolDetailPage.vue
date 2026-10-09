<script setup lang="ts">
/**
 * S4 `/battle/ranking-sekolah/:id` school detail (M16-T3; SRS M16 v1.6 FR-M16-47..50, BR-M16-14;
 * URS FN-M16-3.3). Hero with the loaded school, four all-time cards (2 columns, 4 from `md`), the
 * "Minggu Ini" / "Bulan Ini" boxes (stacked below `md`), the weekly best fighters and the last 10
 * battles (scrolling inside their card below 768 px). An id that is not a school is the 404 page.
 * The shell header and the tab title are the school name (set from the loaded record).
 */
import {
  Calendar,
  CalendarDays,
  History,
  Medal,
  Percent,
  School,
  Trophy,
  Users,
  Zap,
} from '@lucide/vue'
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'

import { fetchSchoolDetail } from '../api'
import BattleRecentList from '../components/battle/BattleRecentList.vue'
import { mskText } from '../components/battle/battle-lib'

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data, error, reload } = useApi((signal) => fetchSchoolDetail(id.value, { signal }), id)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (yes) => {
    if (yes) setRouteOutcome(404)
  },
  { immediate: true },
)

const meta = usePageMeta()
watch(
  data,
  (d) => {
    if (!d) return
    meta.setTitle(d.school.name)
    meta.setHeader({ title: d.school.name, subtitle: `${d.school.state} · ${d.school.type}` })
  },
  { immediate: true },
)

const heroLine = computed(() => {
  const s = data.value?.school
  if (!s) return ''
  return [s.ppd ? `PPD ${s.ppd}` : null, s.state, s.type].filter((p) => p !== null).join(' · ')
})

const cards = computed(() => {
  const a = data.value?.allTime
  if (!a) return []
  return [
    {
      id: 'battles',
      label: 'Jumlah Battle',
      value: String(a.battles),
      icon: Zap,
      cls: 'text-red-500',
    },
    {
      id: 'menang',
      label: 'Kemenangan',
      value: String(a.menang),
      icon: Trophy,
      cls: 'text-amber-500',
    },
    {
      id: 'ketepatan',
      label: 'Ketepatan',
      value: `${String(a.ketepatan)}%`,
      icon: Percent,
      cls: 'text-green-500',
    },
    {
      id: 'pelajar',
      label: 'Pelajar Aktif',
      value: String(a.pelajar),
      icon: Users,
      cls: 'text-purple-500',
    },
  ]
})

const boxes = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    {
      id: 'week',
      title: 'Minggu Ini',
      icon: CalendarDays,
      box: d.week,
      empty: 'Tiada data minggu ini',
    },
    {
      id: 'month',
      title: 'Bulan Ini',
      icon: Calendar,
      box: d.month,
      empty: 'Tiada data bulan ini',
    },
  ]
})
</script>

<template>
  <div class="mx-auto w-full max-w-4xl space-y-4" data-testid="battle-school-detail">
    <div v-if="!data && !error" class="flex justify-center py-10 text-slate-400">
      <LoadingSpinner :size="28" />
    </div>
    <div v-else-if="error && !notFound" class="space-y-3" data-testid="battle-load-error">
      <AlertBox messages="Maaf, berlaku ralat. Sila cuba semula." />
      <button
        type="button"
        class="min-h-11 rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>

    <template v-else-if="data">
      <!-- DV-M16-41: the title is white; live paints it dark on the blue gradient -->
      <div
        class="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white shadow-lg"
      >
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <School class="h-6 w-6" />
        </span>
        <div class="min-w-0">
          <h2 class="text-xl font-bold break-words text-white" data-testid="battle-school-name">
            {{ data.school.name }}
          </h2>
          <p class="text-sm text-white/90" data-testid="battle-school-line">{{ heroLine }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div
          v-for="c in cards"
          :key="c.id"
          class="rounded-2xl bg-white p-4 text-center shadow-md"
          :data-testid="`battle-card-${c.id}`"
        >
          <component :is="c.icon" class="mx-auto h-5 w-5" :class="c.cls" />
          <p
            class="mt-1 text-2xl font-bold"
            :class="c.id === 'menang' ? 'text-green-600' : 'text-slate-800'"
            data-testid="battle-card-value"
          >
            {{ c.value }}
          </p>
          <p class="text-xs text-slate-500">{{ c.label }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="b in boxes"
          :key="b.id"
          class="rounded-2xl bg-white p-4 shadow-md"
          :data-testid="`battle-period-box-${b.id}`"
        >
          <h3 class="flex items-center gap-2 text-base font-bold text-slate-800">
            <component :is="b.icon" class="h-5 w-5 text-blue-500" /> {{ b.title }}
          </h3>
          <dl v-if="b.box" class="mt-3 space-y-2 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-600">Ranking Nasional</dt>
              <dd class="font-bold text-blue-600" data-testid="battle-box-rank">
                #{{ b.box.rank }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-600">Battle</dt>
              <dd class="font-bold text-slate-800" data-testid="battle-box-battles">
                {{ b.box.battles }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-600">Menang/Seri/Kalah</dt>
              <dd class="font-bold text-slate-800" data-testid="battle-box-msk">
                {{ mskText(b.box.menang, b.box.seri, b.box.kalah) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-600">Skor</dt>
              <dd class="font-bold text-blue-600" data-testid="battle-box-skor">
                {{ b.box.skor }}
              </dd>
            </div>
          </dl>
          <p v-else class="mt-3 text-sm text-slate-500" data-testid="battle-box-empty">
            {{ b.empty }}
          </p>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-md">
        <h3 class="flex items-center gap-2 text-base font-bold text-slate-800">
          <Medal class="h-5 w-5 text-amber-500" /> Pejuang Terbaik Minggu Ini
        </h3>
        <ul v-if="data.fighters.length > 0" class="mt-3 space-y-2" data-testid="battle-fighters">
          <li
            v-for="(f, i) in data.fighters"
            :key="f.userId"
            class="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
          >
            <span class="min-w-0 truncate font-semibold text-slate-700"
              >{{ i + 1 }}. {{ f.name }}</span
            >
            <span class="shrink-0 font-bold text-slate-800">{{ f.skor }}</span>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-slate-500" data-testid="battle-fighters-empty">
          Tiada data pejuang minggu ini
        </p>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-md">
        <h3 class="flex items-center gap-2 text-base font-bold text-slate-800">
          <History class="h-5 w-5 text-blue-500" /> Battle Terkini
        </h3>
        <div class="mt-3">
          <BattleRecentList v-if="data.recent.length > 0" :rows="data.recent" home-colour />
          <p v-else class="text-sm text-slate-500" data-testid="battle-recent-empty">
            Tiada battle terkini
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
