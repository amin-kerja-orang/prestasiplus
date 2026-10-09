<script setup lang="ts">
/**
 * S5 `/admin/pksk/questions` "Soalan PKSK" (M07-T3; FR-M07-20..32).
 *
 * - Five global stat cards (#8), never affected by the filters.
 * - GET filter form: a change of any select navigates at once (page reset); "Cari" or Enter submits
 *   all four values. The query string is the state and the controls follow it.
 * - Table of 20 rows (#7); the shared Laravel pager keeps the filters.
 * - Selection with a header checkbox (page ids), bulk bar "Luluskan" / "Tolak" (no confirm) and
 *   "Padam" (native confirm), row `edit` link and row delete (native confirm). After a mutation the
 *   list reloads at the same URL with the flash and the stat cards refresh (L-8, INFERRED).
 * - The table scrolls inside its card below `lg` (no sticky column, DV-M07-07 rejected).
 */
import { Inbox, Pencil, Plus, Search, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { AppIcon } from '@/components/icon'
import { confirmNative, useApi, useFlash } from '@/composables'

import {
  bulkPkskQuestions,
  deletePkskQuestion,
  fetchPkskQuestionStats,
  fetchPkskQuestions,
  type BulkAction,
  type PkskQuestionListItem,
} from '../api/admin'
import AdminStatCard from '../components/admin/AdminStatCard.vue'
import {
  BAHAGIAN_FILTER_OPTIONS,
  BAHAGIAN_PILL_CLASS,
  COPY,
  GREEN_BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  LEVEL_CHIP_CLASS,
  LEVEL_FILTER_OPTIONS,
  PRIMARY_BUTTON_CLASS,
  QUESTIONS_PATH,
  QUESTION_CREATE_PATH,
  STATUS_LABEL,
  STATUS_OPTIONS,
  STATUS_PILL_CLASS,
  errorLines,
  limitQuestionText,
  matchOption,
  queryPage,
  queryText,
} from '../lib/admin'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

/** The applied filters, read from the URL (raw values; the API compares case-insensitively). */
const applied = computed(() => ({
  bahagian: queryText(route.query.bahagian),
  level: queryText(route.query.level),
  status: queryText(route.query.status),
  search: queryText(route.query.search).trim(),
  page: queryPage(route.query.page),
}))

// Draft values of the controls; re-synced when the URL changes (back/forward, links).
const bahagian = ref('')
const level = ref('')
const status = ref('')
const search = ref('')
function syncControls(): void {
  bahagian.value = matchOption(queryText(route.query.bahagian), BAHAGIAN_FILTER_OPTIONS)
  level.value = matchOption(queryText(route.query.level), LEVEL_FILTER_OPTIONS)
  status.value = matchOption(queryText(route.query.status).toLowerCase(), STATUS_OPTIONS)
  search.value = queryText(route.query.search)
}
syncControls()
watch(() => route.query, syncControls)

const { data, error, reload } = useApi(
  (signal) =>
    fetchPkskQuestions(
      {
        bahagian: applied.value.bahagian,
        level: applied.value.level,
        status: applied.value.status,
        search: applied.value.search,
        page: applied.value.page,
      },
      { signal },
    ),
  [
    () => route.query.bahagian,
    () => route.query.level,
    () => route.query.status,
    () => route.query.search,
    () => route.query.page,
  ],
)
const { data: stats, reload: reloadStats } = useApi((signal) => fetchPkskQuestionStats({ signal }))

const rows = computed<PkskQuestionListItem[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)

/** Filters kept on every pager link. */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  const a = applied.value
  if (a.bahagian !== '') out.bahagian = a.bahagian
  if (a.level !== '') out.level = a.level
  if (a.status !== '') out.status = a.status
  if (a.search !== '') out.search = a.search
  return out
})

function formQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  if (bahagian.value !== '') out.bahagian = bahagian.value
  if (level.value !== '') out.level = level.value
  if (status.value !== '') out.status = status.value
  const s = search.value.trim()
  if (s !== '') out.search = s
  return out
}

async function submitFilter(): Promise<void> {
  const query = formQuery()
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: QUESTIONS_PATH, query })
  }
}

function goToPage(page: number): void {
  void router.push({ path: QUESTIONS_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

// --- selection (FR-M07-28) --------------------------------------------------------------------

const selectedIds = ref<number[]>([])
const selectAll = ref(false)

function clearSelection(): void {
  selectedIds.value = []
  selectAll.value = false
}
// A new page of rows starts with no selection (the live page reloads).
watch(data, clearSelection)

function toggleAll(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  selectAll.value = checked
  selectedIds.value = checked ? rows.value.map((r) => r.id) : []
}

function toggleRow(id: number, event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
  } else {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  }
}

// --- mutations (FR-M07-29..32) ----------------------------------------------------------------

const busy = ref(false)

/** Reloads the list (stepping back one page when the page became empty) and the stat cards. */
async function afterMutation(message: string): Promise<void> {
  clearSelection()
  await Promise.all([reload(), reloadStats()])
  if (rows.value.length === 0 && applied.value.page > 1) {
    await router.push({
      path: QUESTIONS_PATH,
      query: { ...pagerQuery.value, page: String(applied.value.page - 1) },
    })
  }
  flash.show({ type: 'success', message })
}

async function bulk(action: BulkAction): Promise<void> {
  if (busy.value || selectedIds.value.length === 0) return
  if (action === 'delete' && !confirmNative(COPY.confirmBulkDelete)) return
  busy.value = true
  try {
    const result = await bulkPkskQuestions(action, [...selectedIds.value])
    await afterMutation(result.status)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

async function remove(row: PkskQuestionListItem): Promise<void> {
  if (!confirmNative(COPY.confirmDelete)) return
  if (busy.value) return
  busy.value = true
  try {
    await deletePkskQuestion(row.id)
    await afterMutation(COPY.questionDeleted)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

const COLUMNS = ['Soalan', 'Bahagian', 'Domain', 'Level', 'Status', 'Tindakan'] as const
// The empty row spans the checkbox column too.
const SPAN = COLUMNS.length + 1

const selectClass = [
  FORM_INPUT_CLASS,
  'min-h-11 min-w-0 flex-1 basis-[calc(50%-0.375rem)] md:w-auto md:flex-none md:basis-auto',
]
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="pksk-questions-page">
    <!-- Five global stat cards (#8). -->
    <div
      v-if="stats"
      class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
      data-testid="pksk-stats"
    >
      <AdminStatCard
        testid="stat-total"
        :value="stats.total"
        label="Jumlah"
        color-class="text-indigo-600"
      />
      <AdminStatCard
        testid="stat-approved"
        :value="stats.approved"
        label="Diluluskan"
        color-class="text-green-600"
      />
      <AdminStatCard
        testid="stat-pending"
        :value="stats.pending"
        label="Menunggu"
        color-class="text-amber-600"
      />
      <AdminStatCard
        testid="stat-t1"
        :value="stats.t1"
        label="Ting. 1"
        color-class="text-blue-600"
      />
      <AdminStatCard
        testid="stat-t4"
        :value="stats.t4"
        label="Ting. 4"
        color-class="text-purple-600"
      />
    </div>

    <!-- Filter card: GET form; a change of a select navigates at once. -->
    <form
      method="get"
      class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow"
      data-testid="pksk-filter"
      @submit.prevent="submitFilter"
    >
      <select
        v-model="bahagian"
        name="bahagian"
        :class="selectClass"
        data-testid="filter-bahagian"
        @change="submitFilter"
      >
        <option value="">Semua Bahagian</option>
        <option v-for="o in BAHAGIAN_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <select
        v-model="level"
        name="level"
        :class="selectClass"
        data-testid="filter-level"
        @change="submitFilter"
      >
        <option value="">Semua Level</option>
        <option v-for="o in LEVEL_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <select
        v-model="status"
        name="status"
        :class="selectClass"
        data-testid="filter-status"
        @change="submitFilter"
      >
        <option value="">Semua Status</option>
        <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input
        v-model="search"
        type="text"
        name="search"
        placeholder="Cari soalan..."
        :class="[
          FORM_INPUT_CLASS,
          'min-h-11 min-w-0 flex-1 basis-[calc(50%-0.375rem)] md:w-48 md:flex-none md:basis-auto',
        ]"
        data-testid="filter-search"
      />
      <button type="submit" :class="PRIMARY_BUTTON_CLASS" data-testid="filter-submit">
        <Search class="h-4 w-4" aria-hidden="true" />
        Cari
      </button>
      <RouterLink
        :to="QUESTION_CREATE_PATH"
        :class="[GREEN_BUTTON_CLASS, 'ml-auto']"
        data-testid="pksk-add"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        Tambah Soalan
      </RouterLink>
    </form>

    <AlertBox v-if="error" :messages="errorLines(error)" data-testid="pksk-questions-error" />

    <DataTableCard v-else-if="data" :min-width="855">
      <template #header>
        <!-- Bulk bar: only while at least one row is ticked. -->
        <div
          v-if="selectedIds.length > 0"
          class="flex flex-wrap items-center gap-3 bg-indigo-50 px-4 py-3"
          data-testid="pksk-bulk-bar"
        >
          <span class="text-sm font-semibold text-indigo-700" data-testid="bulk-count"
            >{{ selectedIds.length }} dipilih</span
          >
          <button
            type="button"
            class="inline-flex min-h-11 items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 lg:min-h-9"
            :disabled="busy"
            data-testid="bulk-approve"
            @click="bulk('approve')"
          >
            Luluskan
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50 lg:min-h-9"
            :disabled="busy"
            data-testid="bulk-reject"
            @click="bulk('reject')"
          >
            Tolak
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 lg:min-h-9"
            :disabled="busy"
            data-testid="bulk-delete"
            @click="bulk('delete')"
          >
            Padam
          </button>
        </div>
      </template>

      <table :class="T.table" data-testid="pksk-questions-table">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" class="w-12 px-4 py-3">
              <label
                class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center lg:inline-flex lg:min-h-0 lg:min-w-0 lg:justify-start"
                data-testid="select-all-label"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  :checked="selectAll"
                  data-testid="select-all"
                  @change="toggleAll"
                />
              </label>
            </th>
            <th v-for="label in COLUMNS" :key="label" scope="col" :class="T.th">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0" :class="T.row" data-testid="pksk-questions-empty">
            <td :colspan="SPAN" class="px-4 py-12 text-center text-slate-400">
              <Inbox class="mx-auto mb-2 h-10 w-10" aria-hidden="true" />
              <p class="font-medium text-slate-500">{{ COPY.questionsEmpty }}</p>
              <RouterLink
                :to="QUESTION_CREATE_PATH"
                class="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                data-testid="pksk-empty-add"
              >
                {{ COPY.questionsEmptyLink }}
              </RouterLink>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="[T.row, 'align-middle']"
            data-testid="pksk-question-row"
            :data-question-id="row.id"
          >
            <td class="px-4 py-3">
              <label
                class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center lg:inline-flex lg:min-h-0 lg:min-w-0 lg:justify-start"
                data-testid="row-select-label"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  :checked="selectedIds.includes(row.id)"
                  data-testid="row-select"
                  @change="toggleRow(row.id, $event)"
                />
              </label>
            </td>
            <td :class="T.td">
              <p class="max-w-xs truncate" data-testid="q-text">
                {{ limitQuestionText(row.questionText) }}
              </p>
            </td>
            <td :class="T.td">
              <span
                :class="[
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  BAHAGIAN_PILL_CLASS[row.bahagian],
                ]"
                data-testid="q-bahagian"
                >{{ row.bahagian }}</span
              >
            </td>
            <td :class="T.td">
              <span class="inline-flex items-center gap-1.5 text-xs" data-testid="q-domain">
                <AppIcon
                  :name="row.domain.icon"
                  class="h-4 w-4 shrink-0"
                  :style="{ color: row.domain.color }"
                />
                {{ row.domain.name }}
              </span>
            </td>
            <td :class="T.td">
              <span
                :class="[
                  'inline-block rounded px-2 py-0.5 text-xs font-semibold',
                  LEVEL_CHIP_CLASS[row.targetLevel],
                ]"
                data-testid="q-level"
                >{{ row.targetLevel }}</span
              >
            </td>
            <td :class="T.td">
              <span
                :class="[
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  STATUS_PILL_CLASS[row.status],
                ]"
                data-testid="q-status"
                >{{ STATUS_LABEL[row.status] }}</span
              >
            </td>
            <td :class="T.td">
              <div class="flex items-center gap-1">
                <RouterLink
                  :to="`${QUESTIONS_PATH}/${row.id}/edit`"
                  :class="[ICON_BUTTON_CLASS, 'text-indigo-600 hover:bg-indigo-50']"
                  data-testid="q-edit"
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </RouterLink>
                <button
                  type="button"
                  :class="[ICON_BUTTON_CLASS, 'text-red-500 hover:bg-red-50']"
                  :disabled="busy"
                  data-testid="q-delete"
                  @click="remove(row)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <div v-if="rows.length > 0" class="border-t border-slate-100 px-4 py-3">
          <LaravelPager
            :page="applied.page"
            :total="total"
            :per-page="data.meta.pageSize"
            :path="QUESTIONS_PATH"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
