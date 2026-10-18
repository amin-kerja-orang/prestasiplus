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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsEmptyState, DsPage, DsPanel } from '@/ds'

import { fetchQuestionReports, type ReportFilter } from '../api/reports'
import ErrorBox from '../components/ErrorBox.vue'
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
  icon: string
}
const TABS: Tab[] = [
  { value: 'pending', label: 'Menunggu', icon: 'i-ph-clock' },
  { value: 'reviewed', label: 'Disemak', icon: 'i-ph-eye' },
  { value: 'fixed', label: 'Diperbaiki', icon: 'i-ph-check' },
  { value: 'dismissed', label: 'Ditolak', icon: 'i-ph-x' },
  { value: 'all', label: 'Semua', icon: 'i-ph-list' },
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
  <DsPage data-testid="reports-page">
    <p class="text-body text-muted" data-testid="reports-subtitle">
      Soalan yang dilaporkan oleh pelajar dari kuiz, latihan &amp; Papan Bijak
    </p>

    <DsPanel>
    <nav class="flex max-w-full flex-wrap gap-2" aria-label="Status laporan" data-testid="reports-tabs">
      <UButton
        v-for="t in TABS"
        :key="t.value"
        :to="{ path: REPORTS_PATH, query: { status: t.value } }"
        :color="activeTab === t.value ? 'primary' : 'neutral'"
        :variant="activeTab === t.value ? 'solid' : 'soft'"
        :icon="t.icon"
        class="min-h-11"
        :data-active="activeTab === t.value"
        :data-testid="`reports-tab-${t.value}`"
      >
        {{ t.label }}<template v-if="counts"> ({{ counts[t.value] }})</template>
      </UButton>
    </nav>
    </DsPanel>

    <div v-if="error" class="flex flex-col gap-3" data-testid="reports-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" class="min-h-11" data-testid="reports-retry" @click="reload()">
          Cuba Semula
        </UButton>
      </div>
    </div>

    <template v-else-if="firstLoad">
      <USkeleton
        v-for="n in SKELETON_CARDS"
        :key="n"
        class="h-32 w-full"
        data-testid="reports-skeleton"
      />
    </template>

    <UCard v-else-if="rows.length === 0" data-testid="reports-empty">
      <DsEmptyState title="Tiada laporan buat masa ini" icon="i-ph-checks" />
    </UCard>

    <div v-else class="flex flex-col gap-4" data-testid="reports-list">
      <ReportCard v-for="r in rows" :key="r.id" :report="r" @saved="onSaved" @failed="onFailed" />
    </div>
  </DsPage>
</template>
