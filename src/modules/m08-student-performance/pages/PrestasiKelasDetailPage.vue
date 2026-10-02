<script setup lang="ts">
/**
 * S5 `/prestasi/kelas/{id}` "Dashboard Kelas" (M08-T7; FR-M08-31…36, BR-M08-10). An unknown class or one
 * the viewer may not open is the standard 404 (FR-M08-07). The shell header is "{kelas}" with the
 * subtitle "{sekolah} · {subjek} · {tahun}" (FR-M08-03).
 */
import { ArrowLeft, ChartColumn } from '@lucide/vue'
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { ChartCanvas } from '@/components/chart'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { usePageMeta } from '@/composables/usePageMeta'
import { formatNumber } from '@/lib/number'
import { diffForHumans } from '@/lib/time'

import { fetchClassDashboard } from '../api/class'
import { fetchOwnClasses } from '../api/performance'
import ClassHeadcountBlock from '../components/prestasi/ClassHeadcountBlock.vue'
import { classTrendData, classTrendOptions } from '../lib/prestasi/class-chart'
import { capPct, pctTrim, plain } from '../lib/prestasi/format'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
const classId = computed(() => Number(route.params.id))

const { data, error, reload } = useRouteData(
  (signal) => fetchClassDashboard(classId.value, { signal }),
  () => classId.value,
)
const own = useRouteData((signal) => fetchOwnClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))

const subtitle = computed(() => {
  const c = data.value?.class
  if (!c) return ''
  return [c.school, c.subject, String(c.year)].filter((p) => p !== null && p !== '').join(' · ')
})
watchEffect(() => {
  const c = data.value?.class
  if (!c) return
  pageMeta.setTitle(`${c.name} — Dashboard Kelas`)
  pageMeta.setHeader({ title: c.name, subtitle: subtitle.value })
})

function switchClass(e: Event): void {
  const value = (e.target as HTMLSelectElement).value
  if (value) void router.push(value)
}

const chartData = computed(() => classTrendData(data.value?.trend ?? []))
const chartOptions = computed(() => classTrendOptions(data.value?.trend ?? []))

const STAT = 'min-w-0 rounded-2xl bg-white p-3 text-center shadow'
const MEDAL = ['🥇', '🥈', '🥉']
const BADGE: Record<'on' | 'below' | 'na', { text: string; style: string }> = {
  on: {
    text: 'On Track',
    style: 'background: rgba(34,197,94,0.12); color: #16a34a; border-color: rgba(34,197,94,0.25)',
  },
  below: {
    text: 'Below',
    style: 'background: rgba(239,68,68,0.1); color: #dc2626; border-color: rgba(239,68,68,0.25)',
  },
  na: {
    text: 'N/A',
    style:
      'background: rgba(148,163,184,0.12); color: #64748b; border-color: rgba(148,163,184,0.25)',
  },
}
const minutes = (n: number): string =>
  `${formatNumber(n, { decimals: 1, dropZeroFraction: true })}m`
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="prestasi-kelas-detail-page">
    <div v-if="loadFailed" class="space-y-3" data-testid="page-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <template v-else-if="data">
      <header
        class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow"
      >
        <div class="flex min-w-0 items-center gap-3">
          <RouterLink
            to="/prestasi/kelas"
            title="Kembali ke senarai kelas"
            class="flex h-11 w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600"
            data-testid="back-link"
            ><ArrowLeft class="h-5 w-5"
          /></RouterLink>
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
            ><ChartColumn class="h-6 w-6"
          /></span>
          <div class="min-w-0">
            <h1 class="text-lg font-bold break-words text-slate-800" data-testid="class-name">
              {{ data.class.name }}
            </h1>
            <p class="text-sm break-words text-slate-500" data-testid="class-sub">
              {{ subtitle }} · Kod:
              <b class="font-mono font-normal text-blue-600">{{ data.class.joinCode }}</b>
            </p>
          </div>
        </div>
        <select
          class="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 sm:w-auto"
          data-testid="switch-class"
          @change="switchClass"
        >
          <option value="">Tukar Kelas...</option>
          <option v-for="c in own.data.value ?? []" :key="c.id" :value="`/prestasi/kelas/${c.id}`">
            {{ c.name }}
          </option>
        </select>
      </header>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="stat-cards">
        <div :class="STAT" data-testid="stat-murid">
          <p class="text-2xl font-bold text-gray-800">{{ plain(data.stats.students) }}</p>
          <p class="text-xs text-slate-400">Jumlah Murid</p>
        </div>
        <div :class="STAT" data-testid="stat-ketepatan">
          <p class="text-2xl font-bold text-blue-600">{{ pctTrim(capPct(data.stats.accuracy)) }}</p>
          <p class="text-xs text-slate-400">Purata Ketepatan</p>
        </div>
        <div :class="STAT" data-testid="stat-sesi">
          <p class="text-2xl font-bold text-emerald-600">{{ plain(data.stats.sessions) }}</p>
          <p class="text-xs text-slate-400">Jumlah Sesi</p>
        </div>
        <div :class="STAT" data-testid="stat-soalan">
          <p class="text-2xl font-bold text-amber-600">{{ plain(data.stats.answered) }}</p>
          <p class="text-xs text-slate-400">Soalan Dijawab</p>
        </div>
        <div :class="STAT" data-testid="stat-masa">
          <p class="text-2xl font-bold text-purple-600">{{ minutes(data.stats.avgMinutes) }}</p>
          <p class="text-xs text-slate-400">Purata Masa/Sesi</p>
        </div>
        <div :class="STAT" data-testid="stat-aktif">
          <p class="text-2xl font-bold text-cyan-600">{{ plain(data.stats.active7d) }}</p>
          <p class="text-xs text-slate-400">Aktif 7 Hari</p>
        </div>
      </div>

      <ClassHeadcountBlock v-if="data.headcount" :block="data.headcount" />

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section
          class="min-w-0 rounded-2xl bg-white p-5 shadow lg:col-span-1"
          data-testid="attention"
        >
          <h3 class="mb-3 text-base font-bold text-slate-800">
            ⚠️ Perlu Perhatian
            <span class="text-sm font-semibold text-red-500" data-testid="attention-count"
              >({{ data.attention.length }})</span
            >
          </h3>
          <div class="max-h-96 space-y-2 overflow-y-auto" data-testid="attention-list">
            <RouterLink
              v-for="a in data.attention"
              :key="a.userId"
              :to="`/prestasi/${a.userId}`"
              class="flex min-h-11 items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
              :data-testid="`attention-${a.userId}`"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold break-words text-slate-800">{{
                  a.name
                }}</span>
                <span class="block text-xs text-slate-500">{{
                  a.accuracy === null
                    ? 'Belum mula berlatih'
                    : `${a.sessions} sesi · ${pctTrim(a.accuracy)} ketepatan`
                }}</span>
              </span>
              <span
                v-if="a.accuracy === null"
                class="shrink-0 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600"
                >Tak Aktif</span
              >
              <span
                v-else
                class="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"
                >{{ pctTrim(a.accuracy) }}</span
              >
            </RouterLink>
          </div>
        </section>

        <section class="min-w-0 rounded-2xl bg-white p-5 shadow lg:col-span-2" data-testid="trend">
          <h3 class="mb-3 text-base font-bold text-slate-800">📈 Trend Aktiviti Kelas (30 Hari)</h3>
          <ChartCanvas
            v-if="data.trend.length > 0"
            type="line"
            :data="chartData"
            :options="chartOptions"
            height="160px"
            test-id="class-trend-chart"
          />
          <div v-else class="py-10 text-center" data-testid="trend-empty">
            <p class="text-4xl">📭</p>
            <p class="mt-2 text-sm text-slate-500">Belum ada aktiviti dalam 30 hari terakhir.</p>
          </div>
        </section>
      </div>

      <DataTableCard :min-width="720" data-testid="ranking-card">
        <template #header>
          <h3 class="px-5 py-4 text-base font-bold text-slate-800">🏆 Kedudukan Murid</h3>
        </template>
        <table :class="T.table" data-testid="ranking-table">
          <thead>
            <tr>
              <th :class="T.th">#</th>
              <th :class="T.th">Nama</th>
              <th :class="[T.th, 'text-center']">Sesi</th>
              <th :class="[T.th, 'text-center']">Soalan</th>
              <th :class="[T.th, 'text-center']">Ketepatan</th>
              <th :class="[T.th, 'text-center']">Headcount</th>
              <th :class="[T.th, 'text-center']">Terakhir Aktif</th>
              <th :class="[T.th, 'text-center']">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in data.ranking"
              :key="r.userId"
              :class="T.row"
              :data-testid="`rank-row-${r.userId}`"
            >
              <td :class="[T.td, 'text-center text-gray-400']">
                {{ MEDAL[r.rank - 1] ?? r.rank }}
              </td>
              <td :class="[T.td, 'font-semibold text-slate-800']">{{ r.name }}</td>
              <td :class="[T.td, 'text-center']">{{ r.sessions }}</td>
              <td :class="[T.td, 'text-center']">{{ r.answered }}</td>
              <td :class="[T.td, 'text-center']" data-testid="rank-acc">
                {{ r.accuracy === null ? '—' : pctTrim(r.accuracy) }}
              </td>
              <td :class="[T.td, 'text-center']">
                <span
                  class="inline-block rounded-full border"
                  style="padding: 2px 10px; font-size: 0.75rem; font-weight: 600"
                  :style="BADGE[r.headcount].style"
                  data-testid="rank-badge"
                  >{{ BADGE[r.headcount].text }}</span
                >
              </td>
              <td :class="[T.td, 'text-center whitespace-nowrap text-slate-500']">
                {{ r.lastActiveAt === null ? '—' : diffForHumans(r.lastActiveAt) }}
              </td>
              <td :class="[T.td, 'text-center whitespace-nowrap']">
                <RouterLink
                  :to="`/prestasi/${r.userId}`"
                  class="inline-flex min-h-11 items-center text-sm text-blue-600"
                  >Lihat →</RouterLink
                >
              </td>
            </tr>
          </tbody>
        </table>
      </DataTableCard>
    </template>
  </div>
</template>
