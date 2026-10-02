<script setup lang="ts">
/**
 * S10 `/admin/question-submissions` "Kertas Soalan - Admin" (M04-T7; FR-M04-91..94, FN-M04-5.1.1..5.1.8).
 *
 * - Four counter cards (Jumlah, Pending, Processing, Selesai; no Ditolak card), unaffected by the
 *   filter.
 * - GET filter (`status`, "Tapis"); "Reset" only while filtered. The query string is the state.
 * - Table of papers, id descending, not paged; "Tiada rekod ditemui" when empty. Each row updates its
 *   status through the inline "Kemaskini" panel; the list then reloads with the API `status` flash.
 * - The table scrolls inside its card below its natural width (design-system §7.4).
 */
import { Funnel } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'
import { formatNumber } from '@/lib/number'

import { fetchQuestionSubmissions } from '../api/submissions'
import SubmissionRow from '../components/SubmissionRow.vue'
import { SUBMISSIONS_PATH } from '../lib/audit-routes'
import { SUBMISSION_STATUS_OPTIONS } from '../lib/submission-options'
import { queryText } from '../lib/route-query'
import { LOAD_ERROR, errorLines } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const applied = computed(() => queryText(route.query.status))
const status = ref(applied.value)
watch(applied, (value) => {
  status.value = value
})

const { data, error, reload } = useApi(
  (signal) => fetchQuestionSubmissions({ status: applied.value || null, signal }),
  () => route.query.status,
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

async function submitFilter(): Promise<void> {
  if (status.value === applied.value) await reload()
  else
    await router.push({
      path: SUBMISSIONS_PATH,
      query: status.value ? { status: status.value } : {},
    })
}

async function onSaved(message: string): Promise<void> {
  await reload()
  flash.show({ type: 'success', message })
}

function onFailed(err: unknown): void {
  flash.show({ type: 'error', message: errorLines(err) })
}

const SKELETON_ROWS = 4
const COLUMNS = ['Guru / Sekolah', 'Soalan', 'Fail', 'Status', 'Tarikh', 'Tindakan'] as const
const CARD = 'rounded-2xl bg-white p-4 text-center shadow'
const NUMBER = 'font-heading text-3xl font-bold'
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="submissions-page">
    <!-- Counters: 2 per row, 4 from md. -->
    <section class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      <div :class="CARD" data-testid="submissions-count-all">
        <div v-if="counts" :class="[NUMBER, 'text-slate-800']">{{ formatNumber(counts.all) }}</div>
        <div v-else class="mx-auto h-9 w-12 animate-pulse rounded-lg bg-slate-100"></div>
        <p class="text-sm text-slate-500">Jumlah</p>
      </div>
      <div :class="CARD" data-testid="submissions-count-pending">
        <div v-if="counts" :class="[NUMBER, 'text-amber-600']">
          {{ formatNumber(counts.pending) }}
        </div>
        <div v-else class="mx-auto h-9 w-12 animate-pulse rounded-lg bg-slate-100"></div>
        <p class="text-sm text-amber-600">Pending</p>
      </div>
      <div :class="CARD" data-testid="submissions-count-processing">
        <div v-if="counts" :class="[NUMBER, 'text-blue-600']">
          {{ formatNumber(counts.processing) }}
        </div>
        <div v-else class="mx-auto h-9 w-12 animate-pulse rounded-lg bg-slate-100"></div>
        <p class="text-sm text-blue-600">Processing</p>
      </div>
      <div :class="CARD" data-testid="submissions-count-done">
        <div v-if="counts" :class="[NUMBER, 'text-emerald-600']">
          {{ formatNumber(counts.done) }}
        </div>
        <div v-else class="mx-auto h-9 w-12 animate-pulse rounded-lg bg-slate-100"></div>
        <p class="text-sm text-emerald-600">Selesai</p>
      </div>
    </section>

    <!-- Filter (GET form). -->
    <form
      method="get"
      class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow sm:flex-row sm:items-center sm:p-5"
      data-testid="submissions-filter"
      @submit.prevent="submitFilter"
    >
      <select
        v-model="status"
        name="status"
        :class="[FORM_INPUT_CLASS, 'min-h-11 sm:w-auto']"
        data-testid="submissions-status"
      >
        <option value="">Semua Status</option>
        <option v-for="o in SUBMISSION_STATUS_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <button
        type="submit"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        data-testid="submissions-filter-submit"
      >
        <Funnel class="h-4 w-4" aria-hidden="true" />
        Tapis
      </button>
      <RouterLink
        v-if="applied !== ''"
        :to="SUBMISSIONS_PATH"
        class="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        data-testid="submissions-reset"
      >
        Reset
      </RouterLink>
    </form>

    <div v-if="error" class="space-y-3" data-testid="submissions-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="submissions-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <DataTableCard v-else :min-width="880">
      <table :class="T.table" data-testid="submissions-table">
        <thead>
          <tr>
            <th v-for="label in COLUMNS" :key="label" scope="col" :class="T.th">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr
              v-for="n in SKELETON_ROWS"
              :key="n"
              :class="T.row"
              data-testid="submissions-skeleton"
            >
              <td :class="T.td" :colspan="COLUMNS.length">
                <div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>
          <tr v-else-if="rows.length === 0" :class="T.row" data-testid="submissions-empty">
            <td :colspan="COLUMNS.length" class="px-4 py-12 text-center text-slate-400">
              Tiada rekod ditemui
            </td>
          </tr>
          <template v-else>
            <SubmissionRow
              v-for="row in rows"
              :key="row.id"
              :submission="row"
              @saved="onSaved"
              @failed="onFailed"
            />
          </template>
        </tbody>
      </table>
    </DataTableCard>
  </div>
</template>
