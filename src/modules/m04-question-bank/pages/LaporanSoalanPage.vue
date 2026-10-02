<script setup lang="ts">
/**
 * S13 `/laporan-soalan` "Laporan Soalan Saya" (M04-T6b; FR-M04-82, FN-M04-3.3.1…3.3.3). User shell.
 *
 * - Five counter cards from `GET /api/question-reports/mine` (`meta.counts`): Jumlah, Menunggu, Disemak,
 *   Diperbaiki, Ditolak; 2 per row, 5 from `sm`.
 * - Empty: "📋" / "Tiada Laporan" / "Anda belum menghantar sebarang laporan soalan.".
 * - INFERRED / UNVERIFIED COPY (SRS FR-M04-82, never observed on live): one row per report with
 *   "Soalan #{id}" / "Soalan Struktur #{id}", reason pills, the status badge (labels as S7), the
 *   "Status tindakan admin:" note and the relative time.
 */
import { StickyNote } from '@lucide/vue'
import { computed } from 'vue'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'
import { diffForHumans } from '@/lib/time'

import { fetchMyReports, type ReportDisplayStatus } from '../api/reports'
import { DISPLAY_STATUS_LABEL } from '../lib/report-reasons'
import { LOAD_ERROR } from '../lib/ui-errors'

const { data, error, reload } = useApi((signal) => fetchMyReports({ signal }))

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

const COUNTERS = [
  { key: 'all', label: 'Jumlah', card: 'bg-white', number: 'text-slate-800' },
  { key: 'pending', label: 'Menunggu', card: 'bg-amber-50', number: 'text-amber-600' },
  { key: 'reviewed', label: 'Disemak', card: 'bg-blue-50', number: 'text-blue-600' },
  { key: 'fixed', label: 'Diperbaiki', card: 'bg-emerald-50', number: 'text-emerald-600' },
  { key: 'dismissed', label: 'Ditolak', card: 'bg-slate-50', number: 'text-slate-600' },
] as const

const STATUS_CLASS: Record<ReportDisplayStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  reviewed: 'bg-blue-100 text-blue-700',
  fixed: 'bg-emerald-100 text-emerald-700',
  removed: 'bg-red-100 text-red-600',
  dismissed: 'bg-slate-100 text-slate-600',
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-4 sm:space-y-6" data-testid="my-reports-page">
    <section
      class="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4"
      data-testid="my-reports-counters"
    >
      <div
        v-for="c in COUNTERS"
        :key="c.key"
        :class="['rounded-xl p-3 text-center shadow-sm', c.card]"
        :data-testid="`my-reports-count-${c.key}`"
      >
        <div v-if="counts" :class="['font-heading text-xl font-bold', c.number]">
          {{ counts[c.key] }}
        </div>
        <div v-else class="mx-auto h-7 w-8 animate-pulse rounded bg-slate-100"></div>
        <p class="text-xs font-semibold text-slate-500">{{ c.label }}</p>
      </div>
    </section>

    <div v-if="error" class="space-y-3" data-testid="my-reports-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="my-reports-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <div
      v-else-if="firstLoad"
      class="h-40 animate-pulse rounded-2xl bg-white shadow"
      data-testid="my-reports-skeleton"
    ></div>

    <div
      v-else-if="rows.length === 0"
      class="rounded-2xl bg-white p-10 text-center shadow"
      data-testid="my-reports-empty"
    >
      <div class="mb-3 text-5xl" aria-hidden="true">📋</div>
      <h3 class="font-heading text-lg font-bold text-slate-800">Tiada Laporan</h3>
      <p class="mt-1 text-sm text-slate-500">Anda belum menghantar sebarang laporan soalan.</p>
    </div>

    <ul v-else class="space-y-3" data-testid="my-reports-list">
      <li
        v-for="r in rows"
        :key="r.id"
        class="min-w-0 space-y-2 rounded-2xl bg-white p-4 shadow-sm sm:p-5"
        :data-testid="`my-report-${String(r.id)}`"
      >
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-bold text-slate-800" data-testid="my-report-title">
            {{ r.questionType === 'structured' ? 'Soalan Struktur' : 'Soalan' }} #{{ r.questionId }}
          </h3>
          <span
            :class="[
              'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
              STATUS_CLASS[r.displayStatus],
            ]"
            data-testid="my-report-status"
            >{{ DISPLAY_STATUS_LABEL[r.displayStatus] }}</span
          >
          <span class="text-xs text-slate-500" data-testid="my-report-time">{{
            diffForHumans(r.createdAt)
          }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(label, i) in r.reasonLabels"
            :key="`${String(i)}-${label}`"
            class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
            data-testid="my-report-reason"
            >{{ label }}</span
          >
        </div>
        <div
          v-if="r.adminNotes"
          class="rounded-xl bg-blue-50 p-3 text-sm text-blue-800"
          data-testid="my-report-notes"
        >
          <p class="flex items-center gap-2 text-xs font-bold">
            <StickyNote class="h-3.5 w-3.5" aria-hidden="true" />
            Status tindakan admin:
          </p>
          <p class="mt-1 break-words whitespace-pre-line">{{ r.adminNotes }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>
