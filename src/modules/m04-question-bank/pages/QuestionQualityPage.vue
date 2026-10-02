<script setup lang="ts">
/**
 * S6 `/admin/questions/quality` "Dashboard Kualiti Soalan" (M04-T5; FR-M04-59…63).
 *
 * From `GET /api/question-quality`: the 4 KPI cards, the 3 bucket cards, "Taburan Kualiti", "Mengikut
 * Subjek", "Mengikut Tingkatan" and "Soalan Untuk Semakan Aktif" with the row link "Edit" (→ S4), then the
 * button "Jalankan Audit Semula" (no confirm; disabled with "Sedang audit..." while it runs). After the
 * audit the dashboard reloads and the API `status` is the green flash (UNVERIFIED COPY).
 *
 * D9 deviation: a distribution segment narrower than {@link NARROW_SEGMENT_PCT} % keeps its label
 * outside the bar (live clips it, e.g. "0.5"). Nothing else changes.
 */
import { ClipboardCheck, LoaderCircle, SquarePen } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'
import { formatNumber } from '@/lib/number'

import { fetchQualitySummary, runQualityAudit } from '../api/quality'
import { averagePillClass, NARROW_SEGMENT_PCT } from '../lib/import-quality'
import { questionEditPath } from '../lib/question-list'
import { errorLines, LOAD_ERROR } from '../lib/ui-errors'

const flash = useFlash()
const { data, error, reload } = useApi((signal) => fetchQualitySummary({ signal }))

const firstLoad = computed(() => data.value === null && error.value === null)

const SEGMENTS = [
  { key: 'cemerlang', label: 'Cemerlang', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'baik', label: 'Baik', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  { key: 'lemah', label: 'Lemah', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 'kritikal', label: 'Kritikal', bar: 'bg-red-500', dot: 'bg-red-500' },
] as const

const segments = computed(() => {
  const d = data.value?.distribution
  if (!d) return []
  return SEGMENTS.filter((s) => d[s.key] > 0).map((s) => ({
    ...s,
    pct: d[s.key],
    text: `${formatNumber(d[s.key], { decimals: 1 })}%`,
    narrow: d[s.key] < NARROW_SEGMENT_PCT,
  }))
})

const running = ref(false)

async function runAudit(): Promise<void> {
  if (running.value) return
  running.value = true
  try {
    const result = await runQualityAudit()
    await reload()
    flash.show({ type: 'success', message: result.status })
    window.scrollTo?.({ top: 0 })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    running.value = false
  }
}

const CARD = 'min-w-0 rounded-2xl bg-white p-5 shadow'
const KPI = 'rounded-2xl bg-white p-4 text-center shadow sm:p-5'
const KPI_LABEL = 'mt-1 text-xs text-slate-500 sm:text-sm'
const BUCKET_TITLE = 'text-xs font-bold tracking-wide uppercase'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="quality-page">
    <div v-if="error" class="space-y-3" data-testid="quality-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="quality-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <div v-else-if="firstLoad" class="space-y-5" data-testid="quality-skeleton">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div v-for="n in 4" :key="n" :class="KPI">
          <div class="mx-auto h-8 w-24 animate-pulse rounded bg-slate-100"></div>
        </div>
      </div>
      <div class="h-32 animate-pulse rounded-2xl bg-white shadow"></div>
      <div class="h-64 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <template v-else-if="data">
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="quality-kpis">
        <div :class="KPI" data-testid="kpi-total">
          <p class="text-2xl font-bold text-slate-800 sm:text-3xl" data-testid="kpi-total-value">
            {{ formatNumber(data.total) }}
          </p>
          <p :class="KPI_LABEL">Jumlah Soalan</p>
        </div>
        <div :class="KPI" data-testid="kpi-average">
          <p class="text-2xl font-bold text-blue-600 sm:text-3xl" data-testid="kpi-average-value">
            {{ formatNumber(data.average, { decimals: 1 }) }}
          </p>
          <p :class="KPI_LABEL">Purata Skor</p>
        </div>
        <div :class="KPI" data-testid="kpi-excellent">
          <p
            class="text-2xl font-bold text-emerald-600 sm:text-3xl"
            data-testid="kpi-excellent-value"
          >
            {{ formatNumber(data.excellentCount) }}
          </p>
          <p :class="KPI_LABEL">Cemerlang (76-100)</p>
        </div>
        <div :class="KPI" data-testid="kpi-action">
          <p class="text-2xl font-bold text-red-600 sm:text-3xl" data-testid="kpi-action-value">
            {{ formatNumber(data.activeActionCount) }}
          </p>
          <p :class="KPI_LABEL">Perlu Tindakan Aktif (≤ 50)</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="quality-buckets">
        <div
          class="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800"
          data-testid="bucket-baik"
        >
          <p :class="BUCKET_TITLE">Skor 51-75</p>
          <p class="my-1 text-3xl font-bold" data-testid="bucket-baik-value">
            {{ formatNumber(data.buckets.baik) }}
          </p>
          <p class="text-xs">Perlu semakan ringan atau pengayaan metadata.</p>
        </div>
        <div
          class="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
          data-testid="bucket-lemah"
        >
          <p :class="BUCKET_TITLE">Skor ≤ 50</p>
          <p class="my-1 text-3xl font-bold" data-testid="bucket-lemah-value">
            {{ formatNumber(data.buckets.lemahKritikal) }}
          </p>
          <p class="text-xs">Bucket ini patut jadi fokus tindakan segera.</p>
        </div>
        <div
          class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-700"
          data-testid="bucket-legacy"
        >
          <p :class="BUCKET_TITLE">Legacy Generic</p>
          <p class="my-1 text-3xl font-bold" data-testid="bucket-legacy-value">
            {{ formatNumber(data.buckets.legacyGeneric) }}
          </p>
          <p class="text-xs break-words">
            Row legacy seperti `tracking_a_feed_20260308`, `spm_tracking_auto_seed_v1`, dan
            `source_type=ai_generated` diasingkan daripada senarai tindakan aktif.
          </p>
        </div>
      </div>

      <section :class="CARD" data-testid="quality-distribution">
        <h3 class="mb-4 text-base font-bold text-slate-800">Taburan Kualiti</h3>
        <div class="flex h-7 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            v-for="s in segments"
            :key="s.key"
            :class="['flex items-center justify-center text-xs font-bold text-white', s.bar]"
            :style="{ width: `${s.pct}%` }"
            :data-testid="`dist-${s.key}`"
          >
            <span v-if="!s.narrow" class="whitespace-nowrap">{{ s.text }}</span>
          </div>
        </div>
        <div
          v-if="segments.some((s) => s.narrow)"
          class="mt-1 flex flex-wrap gap-x-3 text-xs font-bold text-slate-600"
        >
          <span
            v-for="s in segments.filter((x) => x.narrow)"
            :key="s.key"
            :data-testid="`dist-label-${s.key}`"
          >
            {{ s.label }} {{ s.text }}
          </span>
        </div>
        <div class="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-2 text-xs text-slate-600">
          <span v-for="s in SEGMENTS" :key="s.key" class="inline-flex items-center gap-1.5">
            <span :class="['h-3 w-3 rounded-sm', s.dot]"></span>
            {{ s.label }}
          </span>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section :class="CARD" data-testid="quality-subjects">
          <h3 class="mb-3 text-base font-bold text-slate-800">Mengikut Subjek</h3>
          <div class="overflow-x-auto">
            <table :class="[T.table, 'min-w-[22rem]']">
              <thead>
                <tr class="border-b-2 border-slate-200 text-xs text-slate-500">
                  <th scope="col" class="py-2 pr-2 text-left font-medium">Subjek</th>
                  <th scope="col" class="px-2 py-2 text-right font-medium">Soalan</th>
                  <th scope="col" class="px-2 py-2 text-left font-medium">Purata</th>
                  <th scope="col" class="py-2 pl-2 text-right font-medium">Cemerlang</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in data.bySubject"
                  :key="s.subjectId"
                  class="border-b border-slate-100"
                  data-testid="subject-row"
                >
                  <td class="py-2 pr-2 text-slate-800">{{ s.name }}</td>
                  <td class="px-2 py-2 text-right text-slate-600 tabular-nums">
                    {{ formatNumber(s.count) }}
                  </td>
                  <td class="px-2 py-2">
                    <span
                      :class="[
                        'inline-block rounded-full px-2 py-0.5 text-xs font-bold',
                        averagePillClass(s.average),
                      ]"
                      >{{ formatNumber(s.average, { decimals: 1 }) }}</span
                    >
                  </td>
                  <td class="py-2 pl-2 text-right text-slate-600 tabular-nums">
                    {{ s.excellentPct }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section :class="CARD" data-testid="quality-levels">
          <h3 class="mb-3 text-base font-bold text-slate-800">Mengikut Tingkatan</h3>
          <div class="space-y-3">
            <div v-for="l in data.byLevel" :key="l.levelId" data-testid="level-row">
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class="text-slate-800">{{ l.name }}</span>
                <span class="text-slate-600"
                  >{{ formatNumber(l.count) }} soalan ·
                  {{ formatNumber(l.average, { decimals: 1 }) }}</span
                >
              </div>
              <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-emerald-500"
                  :style="{ width: `${l.average}%` }"
                  data-testid="level-bar"
                ></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div data-testid="quality-actions">
        <DataTableCard :min-width="640">
          <template #header>
            <div class="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div class="min-w-0">
                <h3 class="text-base font-bold text-slate-800">Soalan Untuk Semakan Aktif</h3>
                <p class="mt-0.5 text-xs text-slate-500">
                  Memaparkan hanya soalan skor ≤ 50 selepas menolak sumber generic legacy.
                </p>
              </div>
              <span
                class="shrink-0 text-sm whitespace-nowrap text-slate-500"
                data-testid="action-count"
                >{{ formatNumber(data.actionList.length) }} soalan</span
              >
            </div>
          </template>
          <table :class="T.table">
            <thead>
              <tr class="border-b-2 border-slate-200 text-xs text-slate-500">
                <th scope="col" class="px-5 py-2 text-left font-medium">ID</th>
                <th scope="col" class="px-2 py-2 text-left font-medium">Soalan</th>
                <th scope="col" class="px-2 py-2 text-left font-medium">Subjek</th>
                <th scope="col" class="px-2 py-2 text-left font-medium">Tingkatan</th>
                <th scope="col" class="px-2 py-2 text-left font-medium">Sumber</th>
                <th scope="col" class="px-5 py-2 text-left font-medium">Skor</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="q in data.actionList"
                :key="q.id"
                class="border-t border-slate-100"
                data-testid="action-row"
              >
                <td class="px-5 py-2.5 whitespace-nowrap text-slate-600">#{{ q.id }}</td>
                <td class="max-w-64 px-2 py-2.5 break-words text-slate-800">
                  {{ q.questionText }}
                </td>
                <td class="px-2 py-2.5 text-slate-700">{{ q.subject?.name ?? '' }}</td>
                <td class="px-2 py-2.5 text-slate-700">{{ q.level?.name ?? '' }}</td>
                <td class="max-w-56 px-2 py-2.5 text-xs break-all text-slate-500">
                  {{ q.sourceSet ?? '' }}
                </td>
                <td class="px-5 py-2.5 whitespace-nowrap">
                  <span
                    class="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"
                    >{{ q.qualityScore }}</span
                  >
                  <RouterLink
                    :to="questionEditPath(q.id)"
                    class="ml-2 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    data-testid="action-edit"
                  >
                    <SquarePen class="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </DataTableCard>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          :disabled="running"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="quality-audit"
          @click="runAudit"
        >
          <LoaderCircle v-if="running" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <ClipboardCheck v-else class="h-4 w-4" aria-hidden="true" />
          {{ running ? 'Sedang audit...' : 'Jalankan Audit Semula' }}
        </button>
      </div>
    </template>
  </div>
</template>
