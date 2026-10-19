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
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPanel,
  DsPillNav,
  DsStatRow,
  type PillItem,
  type StatItem,
  DsStack,
  DsText,
} from '@/ds'

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

const TABS: PillItem<MasterNoteTab>[] = [
  {
    key: 'flagged',
    label: 'Flagged Review',
    to: { path: MASTER_NOTES_PATH, query: { tab: 'flagged' } },
  },
  {
    key: 'approved',
    label: 'Teacher Approved',
    to: { path: MASTER_NOTES_PATH, query: { tab: 'approved' } },
  },
  { key: 'all', label: 'Semua', to: { path: MASTER_NOTES_PATH, query: { tab: 'all' } } },
]

const kpis = computed<StatItem[]>(() => [
  {
    key: 'flagged',
    label: 'Flagged (perlu semakan)',
    value: summary.value?.flagged ?? 0,
    icon: 'flag',
    accent: 'heat',
  },
  {
    key: 'approved',
    label: 'Teacher-approved',
    value: summary.value?.teacherApproved ?? 0,
    icon: 'check-circle',
    accent: 'win',
  },
  {
    key: 'total',
    label: 'Jumlah nota',
    value: summary.value?.total ?? 0,
    icon: 'notebook',
    accent: 'action',
  },
])

function goToPage(next: number): void {
  const query: Record<string, string> = {}
  if (tabQuery.value !== '') query.tab = tabQuery.value
  query.page = String(next)
  void router.push({ path: MASTER_NOTES_PATH, query })
}
</script>

<template>
  <DsPage data-testid="notes-page">
    <DsStatRow v-if="summary" :items="kpis" :cols="3" data-testid="notes-kpis" />
    <div data-testid="notes-header" class="sr-only">
      <DsText variant="body" data-testid="notes-summary">
        <template v-if="summary">
          Self-healing nota AI: {{ summary.flagged }} flagged ·
          {{ summary.teacherApproved }} teacher-approved · {{ summary.total }} total. Review yang
          flagged untuk improve quality.
        </template>
        <USkeleton v-else class="h-4 w-72 max-w-full" />
      </DsText>
    </div>

    <DsPillNav
      :items="TABS"
      :active="firstLoad ? null : activeTab"
      label="Tab nota"
      testid-prefix="notes-tab"
      data-testid="notes-tabs"
    />

    <DsLoadError
      v-if="error"
      :message="LOAD_ERROR"
      testid="notes-error"
      retry-testid="notes-retry"
      @retry="reload()"
    />

    <DsStack v-else-if="firstLoad" gap="sm" data-testid="notes-skeleton">
      <USkeleton v-for="n in 3" :key="n" class="h-44 w-full" />
    </DsStack>

    <DsPanel v-else-if="rows.length === 0" data-testid="notes-empty">
      <DsEmptyState size="sm" title="Tiada nota dalam tab ini." icon="notebook" />
    </DsPanel>

    <template v-else>
      <MasterNoteRow v-for="note in rows" :key="note.id" :note="note" />
      <div v-if="data && data.meta.totalItems > data.meta.pageSize" data-testid="notes-pager">
        <UPagination
          :page="data.meta.page"
          :total="data.meta.totalItems"
          :items-per-page="data.meta.pageSize"
          :prev="{ 'aria-label': 'Sebelum' }"
          :next="{ 'aria-label': 'Seterusnya' }"
          @update:page="goToPage"
        />
      </div>
    </template>
  </DsPage>
</template>
