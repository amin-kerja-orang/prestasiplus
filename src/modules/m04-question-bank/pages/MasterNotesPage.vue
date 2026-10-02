<script setup lang="ts">
/**
 * S12 `/admin/master-notes` "Master Notes — Admin Review" (M04-T7; FR-M04-102..105,
 * FN-M04-5.3.1..5.3.8). Rendered in the **user** shell with the admin role, as live.
 *
 * - Dark header card: white h1 (readable, DV-M04-14) and the summary line.
 * - Tabs "Flagged Review" (default), "Teacher Approved", "Semua" (`?tab=`); the active tab is a dark
 *   pill. An unknown tab falls back to flagged (the API reports the tab it applied).
 * - 15 rows per page and the English Laravel pager (keeps `tab`); "Tiada nota dalam tab ini." when empty.
 */
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { LaravelPager } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchMasterNotes, type MasterNoteTab } from '../api/master-notes'
import MasterNoteRow from '../components/MasterNoteRow.vue'
import { MASTER_NOTES_PATH } from '../lib/audit-routes'
import { pageOf, queryText } from '../lib/route-query'
import { LOAD_ERROR } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()

const tabQuery = computed(() => queryText(route.query.tab))
const page = computed(() => pageOf(route.query.page))

const { data, error, reload } = useApi(
  (signal) => fetchMasterNotes({ tab: tabQuery.value || null, page: page.value, signal }),
  [() => route.query.tab, () => route.query.page],
)

const rows = computed(() => data.value?.data ?? [])
const summary = computed(() => data.value?.meta.summary ?? null)
const activeTab = computed<MasterNoteTab>(() => data.value?.meta.activeTab ?? 'flagged')
const firstLoad = computed(() => data.value === null && error.value === null)
const pagerQuery = computed(() => ({ tab: tabQuery.value }))

const TABS: { tab: MasterNoteTab; label: string }[] = [
  { tab: 'flagged', label: 'Flagged Review' },
  { tab: 'approved', label: 'Teacher Approved' },
  { tab: 'all', label: 'Semua' },
]

function goToPage(next: number): void {
  const query: Record<string, string> = {}
  if (tabQuery.value !== '') query.tab = tabQuery.value
  query.page = String(next)
  void router.push({ path: MASTER_NOTES_PATH, query })
}
</script>

<template>
  <div class="space-y-3 sm:space-y-4" data-testid="notes-page">
    <header class="rounded-2xl bg-gray-800 p-4 sm:p-5" data-testid="notes-header">
      <h1 class="font-heading text-xl font-bold text-white sm:text-2xl">
        Master Notes — Admin Review
      </h1>
      <p class="mt-1 text-sm text-slate-200" data-testid="notes-summary">
        <template v-if="summary">
          Self-healing nota AI: {{ summary.flagged }} flagged ·
          {{ summary.teacherApproved }} teacher-approved · {{ summary.total }} total. Review yang
          flagged untuk improve quality.
        </template>
        <span
          v-else
          class="inline-block h-4 w-72 max-w-full animate-pulse rounded bg-gray-700"
        ></span>
      </p>
    </header>

    <nav class="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow" data-testid="notes-tabs">
      <RouterLink
        v-for="t in TABS"
        :key="t.tab"
        :to="{ path: MASTER_NOTES_PATH, query: { tab: t.tab } }"
        :class="[
          'inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
          activeTab === t.tab && !firstLoad
            ? 'bg-gray-800 text-white'
            : 'text-slate-600 hover:bg-slate-100',
        ]"
        :data-active="activeTab === t.tab && !firstLoad ? 'true' : 'false'"
        :data-testid="`notes-tab-${t.tab}`"
      >
        {{ t.label }}
      </RouterLink>
    </nav>

    <div v-if="error" class="space-y-3" data-testid="notes-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-800 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-gray-900"
        data-testid="notes-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <div v-else-if="firstLoad" class="space-y-3" data-testid="notes-skeleton">
      <div v-for="n in 3" :key="n" class="h-44 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <p
      v-else-if="rows.length === 0"
      class="rounded-2xl bg-white p-8 text-center text-slate-500 shadow"
      data-testid="notes-empty"
    >
      Tiada nota dalam tab ini.
    </p>

    <template v-else>
      <MasterNoteRow v-for="note in rows" :key="note.id" :note="note" />
      <div v-if="data" data-testid="notes-pager">
        <LaravelPager
          :page="data.meta.page"
          :total="data.meta.totalItems"
          :per-page="data.meta.pageSize"
          :path="MASTER_NOTES_PATH"
          :query="pagerQuery"
          @change="goToPage"
        />
      </div>
    </template>
  </div>
</template>
