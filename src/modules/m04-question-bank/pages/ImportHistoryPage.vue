<script setup lang="ts">
/**
 * S5h `/admin/questions/import-history` "Sejarah Import" (M04-T5; FR-M04-58, DV-M04-01, PROPOSED COPY).
 *
 * Read-only: the link "Kembali" (→ S5) and the table of import runs, newest first, 20 per page with the
 * shared Laravel pager ("Tarikh" `dd/mm/yyyy HH:mm`, "Fail", "Diimport", "Gagal"), or "Tiada sejarah
 * import.". The table scrolls inside its card below `md`. A load failure shows the red alert with
 * "Cuba Semula" (SRS §8.2).
 */
import { ArrowLeft } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatDateTime } from '@/lib/time'

import { fetchQuestionImports } from '../api/imports'
import { IMPORT_HISTORY_PATH, IMPORT_PATH } from '../lib/import-quality'
import { LOAD_ERROR } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()

const page = computed(() => {
  const raw = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
  return Math.max(1, Number.parseInt(raw ?? '', 10) || 1)
})

const { data, error, reload } = useApi(
  (signal) => fetchQuestionImports({ page: page.value, signal }),
  () => route.query.page,
)

const rows = computed(() => data.value?.data ?? [])
const firstLoad = computed(() => data.value === null && error.value === null)

function goToPage(next: number): void {
  void router.push({ path: IMPORT_HISTORY_PATH, query: { page: String(next) } })
}

const SKELETON_ROWS = 5
const HEADERS = [
  { label: 'Tarikh', cls: '' },
  { label: 'Fail', cls: '' },
  { label: 'Diimport', cls: 'text-right' },
  { label: 'Gagal', cls: 'text-right' },
]
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-5" data-testid="history-page">
    <div>
      <RouterLink
        :to="IMPORT_PATH"
        class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="history-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali
      </RouterLink>
    </div>

    <div v-if="error" class="space-y-3" data-testid="history-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="history-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <DataTableCard v-else :min-width="520">
      <table :class="T.table" data-testid="history-table">
        <thead class="bg-slate-50">
          <tr>
            <th v-for="h in HEADERS" :key="h.label" scope="col" :class="[T.th, h.cls]">
              {{ h.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr v-for="n in SKELETON_ROWS" :key="n" :class="T.row" data-testid="history-skeleton">
              <td v-for="c in 4" :key="c" :class="T.td">
                <div class="h-4 w-full max-w-28 animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <tr v-else-if="rows.length === 0" :class="T.row" data-testid="history-empty">
            <td colspan="4" class="px-4 py-12 text-center text-sm text-slate-500">
              Tiada sejarah import.
            </td>
          </tr>

          <template v-else>
            <tr v-for="r in rows" :key="r.id" :class="T.row" data-testid="history-row">
              <td :class="[T.td, 'whitespace-nowrap']" data-testid="history-date">
                {{ formatDateTime(r.createdAt) }}
              </td>
              <td :class="[T.td, 'break-all']" data-testid="history-file">{{ r.fileName }}</td>
              <td :class="[T.td, 'text-right tabular-nums']" data-testid="history-imported">
                {{ r.importedCount }}
              </td>
              <td :class="[T.td, 'text-right tabular-nums']" data-testid="history-failed">
                {{ r.failedCount }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <template #footer>
        <div class="border-t border-slate-100 px-4 py-3 empty:hidden" data-testid="history-pager">
          <LaravelPager
            v-if="data"
            :page="data.meta.page"
            :total="data.meta.totalItems"
            :per-page="data.meta.pageSize"
            :path="IMPORT_HISTORY_PATH"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
