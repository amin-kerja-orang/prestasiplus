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
import { DsPage, DsPanel, DsStatTile } from '@/ds'

import { fetchMasterNotes, type MasterNoteTab } from '../api/master-notes'
import ErrorBox from '../components/ErrorBox.vue'
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
  <DsPage data-testid="notes-page">
    <div
      v-if="summary"
      class="grid grid-cols-1 gap-3 sm:grid-cols-3"
      data-testid="notes-kpis"
    >
      <DsStatTile
        :value="summary.flagged"
        unit="Flagged (perlu semakan)"
        icon="i-ph-flag"
        accent="heat"
      />
      <DsStatTile
        :value="summary.teacherApproved"
        unit="Teacher-approved"
        icon="i-ph-check-circle"
        accent="win"
      />
      <DsStatTile :value="summary.total" unit="Jumlah nota" icon="i-ph-notebook" accent="action" />
    </div>
    <UCard data-testid="notes-header" class="sr-only">
      <p class="text-body text-default" data-testid="notes-summary">
        <template v-if="summary">
          Self-healing nota AI: {{ summary.flagged }} flagged ·
          {{ summary.teacherApproved }} teacher-approved · {{ summary.total }} total. Review yang
          flagged untuk improve quality.
        </template>
        <USkeleton v-else class="h-4 w-72 max-w-full" />
      </p>
    </UCard>

    <DsPanel>
    <nav class="flex max-w-full flex-wrap gap-2" aria-label="Tab nota" data-testid="notes-tabs">
      <UButton
        v-for="t in TABS"
        :key="t.tab"
        :to="{ path: MASTER_NOTES_PATH, query: { tab: t.tab } }"
        :color="activeTab === t.tab && !firstLoad ? 'primary' : 'neutral'"
        :variant="activeTab === t.tab && !firstLoad ? 'solid' : 'soft'"
        class="min-h-11"
        :data-active="activeTab === t.tab && !firstLoad ? 'true' : 'false'"
        :data-testid="`notes-tab-${t.tab}`"
      >
        {{ t.label }}
      </UButton>
    </nav>
    </DsPanel>

    <div v-if="error" class="flex flex-col gap-3" data-testid="notes-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" class="min-h-11" data-testid="notes-retry" @click="reload()">
          Cuba Semula
        </UButton>
      </div>
    </div>

    <div v-else-if="firstLoad" class="flex flex-col gap-3" data-testid="notes-skeleton">
      <USkeleton v-for="n in 3" :key="n" class="h-44 w-full" />
    </div>

    <UCard v-else-if="rows.length === 0" data-testid="notes-empty">
      <p class="text-center text-body text-muted">Tiada nota dalam tab ini.</p>
    </UCard>

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
