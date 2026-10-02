<script setup lang="ts">
/**
 * S7 `/admin/question-reports` "Laporan Soalan — Admin Panel" (M04-T6c; FR-M04-72…81,
 * FN-M04-3.2.1…3.2.19).
 *
 * - h1 with the flag icon, the subtitle and five status tabs with live counts (`?status=`, default
 *   `pending`; the active tab is a solid colour with white text).
 * - One card per report, newest first, not paged. An empty tab (and an unknown `status`, with no tab
 *   active) shows "Tiada laporan buat masa ini".
 * - Every action reloads the same tab with the API flash.
 */
import { Check, CheckCheck, Clock, Eye, Flag, List, X } from '@lucide/vue'
import { computed, type Component } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { fetchQuestionReports, type ReportFilter } from '../api/reports'
import ReportCard from '../components/report/ReportCard.vue'
import { REPORT_FILTERS } from '../lib/report-reasons'
import { REPORTS_PATH } from '../lib/report-routes'
import { queryText } from '../lib/route-query'
import { LOAD_ERROR, errorLines } from '../lib/ui-errors'

const route = useRoute()
const flash = useFlash()

const statusQuery = computed(() => queryText(route.query.status))

const { data, error, reload } = useApi(
  (signal) => fetchQuestionReports({ status: statusQuery.value || null, signal }),
  () => route.query.status,
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

/** The tab the query selects (known value or the default); `null` for an unknown value. */
const activeTab = computed<ReportFilter | null>(() => {
  const given = statusQuery.value
  if (given === '') return 'pending'
  return (REPORT_FILTERS as readonly string[]).includes(given) ? (given as ReportFilter) : null
})

interface Tab {
  value: ReportFilter
  label: string
  icon: Component
  active: string
  idle: string
}
const TABS: Tab[] = [
  {
    value: 'pending',
    label: 'Menunggu',
    icon: Clock,
    active: 'bg-amber-500 border-amber-500 text-white',
    idle: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  {
    value: 'reviewed',
    label: 'Disemak',
    icon: Eye,
    active: 'bg-blue-500 border-blue-500 text-white',
    idle: 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50',
  },
  {
    value: 'fixed',
    label: 'Diperbaiki',
    icon: Check,
    active: 'bg-emerald-500 border-emerald-500 text-white',
    idle: 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  },
  {
    value: 'dismissed',
    label: 'Ditolak',
    icon: X,
    active: 'bg-slate-500 border-slate-500 text-white',
    idle: 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50',
  },
  {
    value: 'all',
    label: 'Semua',
    icon: List,
    active: 'bg-violet-500 border-violet-500 text-white',
    idle: 'bg-white border-violet-300 text-violet-700 hover:bg-violet-50',
  },
]

async function onSaved(message: string): Promise<void> {
  await reload()
  flash.show({ type: 'success', message })
}

function onFailed(err: unknown): void {
  flash.show({ type: 'error', message: errorLines(err) })
}

const SKELETON_CARDS = 3
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="reports-page">
    <header>
      <h1
        class="flex items-center gap-2 font-heading text-xl font-bold text-slate-800 sm:text-2xl"
        data-testid="reports-title"
      >
        <Flag class="h-6 w-6 shrink-0 text-red-500" aria-hidden="true" />
        Laporan Soalan
      </h1>
      <p class="mt-1 text-sm text-slate-500" data-testid="reports-subtitle">
        Soalan yang dilaporkan oleh pelajar dari kuiz, latihan &amp; Papan Bijak
      </p>
    </header>

    <nav class="flex flex-wrap gap-2" data-testid="reports-tabs">
      <RouterLink
        v-for="t in TABS"
        :key="t.value"
        :to="{ path: REPORTS_PATH, query: { status: t.value } }"
        :class="[
          'inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
          activeTab === t.value ? t.active : t.idle,
        ]"
        :data-active="activeTab === t.value"
        :data-testid="`reports-tab-${t.value}`"
      >
        <component :is="t.icon" class="h-4 w-4" aria-hidden="true" />
        {{ t.label }}<template v-if="counts"> ({{ counts[t.value] }})</template>
      </RouterLink>
    </nav>

    <div v-if="error" class="space-y-3" data-testid="reports-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="reports-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <template v-else-if="firstLoad">
      <div
        v-for="n in SKELETON_CARDS"
        :key="n"
        class="space-y-3 rounded-2xl border-2 border-slate-100 bg-white p-5 shadow-sm"
        data-testid="reports-skeleton"
      >
        <div class="h-5 w-2/3 animate-pulse rounded bg-slate-100"></div>
        <div class="h-16 w-full animate-pulse rounded bg-slate-100"></div>
      </div>
    </template>

    <div
      v-else-if="rows.length === 0"
      class="rounded-2xl bg-white p-10 text-center shadow"
      data-testid="reports-empty"
    >
      <CheckCheck class="mx-auto mb-3 h-10 w-10 text-emerald-400" aria-hidden="true" />
      <p class="font-semibold text-slate-500">Tiada laporan buat masa ini</p>
    </div>

    <div v-else class="space-y-4" data-testid="reports-list">
      <ReportCard v-for="r in rows" :key="r.id" :report="r" @saved="onSaved" @failed="onFailed" />
    </div>
  </div>
</template>
