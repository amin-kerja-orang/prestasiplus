<script setup lang="ts">
/**
 * S1 `/admin/questions` "Pengurusan Soalan" (M04-T3; FR-M04-01..16).
 *
 * - Header with the create button, the summary card with the 31 subject tiles, the 8-field GET
 *   filter form (the URL is the state), the table of 20 rows with bulk select, and the Laravel pager.
 * - Bulk bar: native `required` on the action select; native `confirm`; the API `status` is the flash.
 * - DV-M04-09: the table scrolls inside its card below 1280 and "Soalan" keeps 240px.
 */
import {
  BookOpen,
  Book,
  CircleCheck,
  Eye,
  Inbox,
  Plus,
  Search,
  SquareCheckBig,
  SquarePen,
  Star,
  Trash,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { confirmNative, useApi, useFlash } from '@/composables'

import {
  bulkQuestionAction,
  deleteQuestion,
  fetchEducationLevels,
  fetchQuestions,
  fetchQuestionSummary,
  fetchSubjects,
  type QuestionRow,
} from '../api'
import QuestionSummaryCard from '../components/QuestionSummaryCard.vue'
import {
  BULK_OPTIONS,
  bulkConfirmText,
  COMPLIANCE_OPTIONS,
  complianceClass,
  DELETE_CONFIRM,
  DIFFICULTY_OPTIONS,
  DSKP_OPTIONS,
  excerpt,
  FILTER_KEYS,
  QUESTIONS_CREATE_PATH,
  QUESTIONS_LIST_PATH,
  questionDetailPath,
  questionEditPath,
  SOURCE_OPTIONS,
  sourceLabel,
  statusClass,
  statusLabel,
  STATUS_OPTIONS,
  type FilterKey,
} from '../lib/question-list'
import { pageOf, queryText } from '../lib/route-query'
import { errorLines, LOAD_ERROR } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

/** The applied filters, read from the URL (the source of truth, as the live GET form). */
const applied = computed(() => {
  const out = {} as Record<FilterKey, string>
  for (const key of FILTER_KEYS) out[key] = queryText(route.query[key]).trim()
  return out
})
const page = computed(() => pageOf(route.query.page))
const activeSubjectId = computed(() => {
  const n = Number.parseInt(applied.value.subject_id, 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

// Draft values of the form controls; re-synced when the URL changes.
const draft = ref<Record<FilterKey, string>>(
  Object.fromEntries(FILTER_KEYS.map((k) => [k, queryText(route.query[k])])) as Record<
    FilterKey,
    string
  >,
)
watch(
  () => FILTER_KEYS.map((k) => route.query[k]),
  () => {
    for (const key of FILTER_KEYS) draft.value[key] = queryText(route.query[key])
  },
)

const list = useApi(
  (signal) =>
    fetchQuestions({
      subjectId: applied.value.subject_id || null,
      educationLevelId: applied.value.education_level_id || null,
      difficultyLevel: applied.value.difficulty_level || null,
      status: applied.value.status || null,
      dskpFilter: applied.value.dskp_filter || null,
      complianceFilter: applied.value.compliance_filter || null,
      sourceFilter: applied.value.source_filter || null,
      search: applied.value.search || null,
      page: page.value,
      signal,
    }),
  [...FILTER_KEYS.map((k) => () => route.query[k]), () => route.query.page],
)
const summary = useApi((signal) => fetchQuestionSummary({ signal }))
const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))

const rows = computed<QuestionRow[]>(() => list.data.value?.data ?? [])
const firstLoad = computed(() => list.data.value === null && list.error.value === null)
const subjectOptions = computed(() => subjects.data.value?.data ?? [])
const levelOptions = computed(() => levels.data.value?.data ?? [])
const colors = computed(() => Object.fromEntries(subjectOptions.value.map((s) => [s.id, s.color])))

/** The applied filters as the query of the pager links (empty ones dropped). */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  for (const key of FILTER_KEYS) if (applied.value[key] !== '') out[key] = applied.value[key]
  return out
})

async function submitFilter(): Promise<void> {
  const query: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const value = draft.value[key].trim()
    if (value !== '') query[key] = value
  }
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await Promise.all([list.reload(), summary.reload()])
  } else {
    await router.push({ path: QUESTIONS_LIST_PATH, query })
  }
}

function goToPage(next: number): void {
  void router.push({
    path: QUESTIONS_LIST_PATH,
    query: { ...pagerQuery.value, page: String(next) },
  })
}

// --- Selection (FR-M04-12): page/filter changes clear it.
const selected = ref<number[]>([])
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((r) => selected.value.includes(r.id)),
)
watch(
  () => route.fullPath,
  () => {
    selected.value = []
  },
)
function toggleAll(event: Event): void {
  selected.value = (event.target as HTMLInputElement).checked ? rows.value.map((r) => r.id) : []
}

// --- Bulk action and delete (FR-M04-13, 14, 16).
const busy = ref(false)
const bulkAction = ref('')

/** Reloads after a mutation; steps back a page when the current one became empty. */
async function reloadAfterMutation(): Promise<void> {
  await Promise.all([list.reload(), summary.reload()])
  if (rows.value.length === 0 && page.value > 1) {
    await router.push({
      path: QUESTIONS_LIST_PATH,
      query: { ...pagerQuery.value, page: String(page.value - 1) },
    })
  }
}

async function submitBulk(): Promise<void> {
  // The native `required` on the select already blocked an empty action; this guard is for tests.
  const option = BULK_OPTIONS.find((o) => o.value === bulkAction.value)
  if (!option || busy.value || selected.value.length === 0) return
  if (!confirmNative(bulkConfirmText(option.verb, selected.value.length))) return
  busy.value = true
  try {
    const result = await bulkQuestionAction(option.value, selected.value)
    selected.value = []
    bulkAction.value = ''
    await reloadAfterMutation()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

async function remove(row: QuestionRow): Promise<void> {
  if (!confirmNative(DELETE_CONFIRM) || busy.value) return
  busy.value = true
  try {
    const result = await deleteQuestion(row.id)
    selected.value = selected.value.filter((id) => id !== row.id)
    await reloadAfterMutation()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}

const SKELETON_ROWS = 5
const COLUMN_COUNT = 8
const HEADERS = ['#', 'Soalan', 'Subjek', 'Tahap', 'Kesukaran', 'Status', 'Tindakan']
const CELL = 'px-3 py-3 align-top text-sm text-slate-700'
const HEAD = 'px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide'
const LABEL = 'mb-1 block text-sm font-medium text-slate-700'
const ICON_LINK =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:h-8 lg:w-8'
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="questions-page">
    <!-- Header: h1, subtitle, create button ("Tambah Soalan" >= 640px, "Tambah" below). -->
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-slate-800 sm:text-2xl">📚 Pengurusan Soalan</h1>
        <p class="text-sm text-slate-500">Urus bank soalan untuk platform PRESTASIPLUS</p>
      </div>
      <RouterLink
        :to="QUESTIONS_CREATE_PATH"
        class="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="questions-add"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        <span class="hidden sm:inline">Tambah Soalan</span>
        <span class="sm:hidden">Tambah</span>
      </RouterLink>
    </div>

    <QuestionSummaryCard
      :summary="summary.data.value"
      :colors="colors"
      :active-subject-id="activeSubjectId"
    />

    <!-- Filter (GET form): 2 columns, 4 from md. -->
    <form
      method="get"
      class="grid grid-cols-2 items-end gap-3 rounded-2xl bg-white p-4 shadow sm:p-5 md:grid-cols-4"
      data-testid="questions-filter"
      @submit.prevent="submitFilter"
    >
      <div class="min-w-0">
        <label for="q-subject" :class="LABEL">Subjek</label>
        <select
          id="q-subject"
          v-model="draft.subject_id"
          name="subject_id"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="questions-subject"
        >
          <option value="">Semua Subjek</option>
          <option v-for="s in subjectOptions" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="q-level" :class="LABEL">Tahap</label>
        <select
          id="q-level"
          v-model="draft.education_level_id"
          name="education_level_id"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="questions-level"
        >
          <option value="">Semua Tahap</option>
          <option v-for="l in levelOptions" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="q-difficulty" :class="LABEL">Kesukaran</label>
        <select
          id="q-difficulty"
          v-model="draft.difficulty_level"
          name="difficulty_level"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="questions-difficulty"
        >
          <option value="">Semua</option>
          <option v-for="o in DIFFICULTY_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="q-status" :class="LABEL">Status</label>
        <select
          id="q-status"
          v-model="draft.status"
          name="status"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="questions-status"
        >
          <option value="">Semua Status</option>
          <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="q-dskp" :class="LABEL">DSKP</label>
        <select
          id="q-dskp"
          v-model="draft.dskp_filter"
          name="dskp_filter"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="questions-dskp"
        >
          <option value="">Semua</option>
          <option v-for="o in DSKP_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="q-compliance" :class="LABEL">Compliance</label>
        <select
          id="q-compliance"
          v-model="draft.compliance_filter"
          name="compliance_filter"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="questions-compliance"
        >
          <option value="">Semua</option>
          <option v-for="o in COMPLIANCE_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="q-source" :class="LABEL">Source</label>
        <select
          id="q-source"
          v-model="draft.source_filter"
          name="source_filter"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="questions-source"
        >
          <option value="">Semua</option>
          <option v-for="o in SOURCE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <div class="col-span-2 min-w-0 md:col-span-4">
        <label for="q-search" :class="LABEL">Cari</label>
        <div class="flex gap-2">
          <input
            id="q-search"
            v-model="draft.search"
            type="text"
            name="search"
            placeholder="Cari soalan..."
            :class="[FORM_INPUT_CLASS, 'min-h-11 min-w-0 flex-1']"
            data-testid="questions-search"
          />
          <button
            type="submit"
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            data-testid="questions-search-submit"
          >
            <Search class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>

    <!-- Load failure: red box in place of the table + retry (INFERRED copy, SRS §8.2). -->
    <div v-if="list.error.value" class="space-y-3" data-testid="questions-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="questions-retry"
        @click="list.reload()"
      >
        Cuba Semula
      </button>
    </div>

    <!-- Empty: table and pager are not rendered (FR-M04-11). -->
    <div
      v-else-if="!firstLoad && rows.length === 0"
      class="rounded-2xl bg-white px-4 py-12 text-center shadow"
      data-testid="questions-empty"
    >
      <Inbox class="mx-auto mb-2 h-10 w-10 text-slate-300" aria-hidden="true" />
      <p class="font-medium text-slate-500">Tiada soalan dijumpai</p>
      <RouterLink
        :to="QUESTIONS_CREATE_PATH"
        class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        data-testid="questions-empty-add"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        Tambah Soalan Pertama
      </RouterLink>
    </div>

    <DataTableCard v-else :min-width="780">
      <template #header>
        <form
          v-if="selected.length > 0"
          method="post"
          class="flex flex-wrap items-center gap-3 border-b border-indigo-100 bg-indigo-50 px-4 py-3"
          data-testid="questions-bulk-bar"
          @submit.prevent="submitBulk"
        >
          <span class="inline-flex items-center gap-2 text-sm font-medium text-indigo-700">
            <SquareCheckBig class="h-4 w-4" aria-hidden="true" />
            <span data-testid="questions-selected-count">{{ selected.length }}</span> soalan dipilih
          </span>
          <select
            v-model="bulkAction"
            name="action"
            required
            :class="[FORM_INPUT_CLASS, 'min-h-11 w-auto']"
            data-testid="questions-bulk-action"
          >
            <option value="">Pilih Tindakan</option>
            <option v-for="o in BULK_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <button
            type="submit"
            :disabled="busy"
            class="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-60"
            data-testid="questions-bulk-submit"
          >
            Laksanakan
          </button>
        </form>
      </template>

      <table :class="T.table" data-testid="questions-table">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" :class="[HEAD, 'w-10']">
              <input
                type="checkbox"
                class="h-5 w-5 rounded border-slate-300 accent-indigo-600"
                :checked="allSelected"
                data-testid="questions-select-all"
                @change="toggleAll"
              />
            </th>
            <th
              v-for="label in HEADERS"
              :key="label"
              scope="col"
              :class="[HEAD, label === 'Soalan' ? 'min-w-60' : '']"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr v-for="n in SKELETON_ROWS" :key="n" :class="T.row" data-testid="questions-skeleton">
              <td v-for="c in COLUMN_COUNT" :key="c" :class="CELL">
                <div class="h-4 w-full max-w-24 animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <template v-else>
            <tr
              v-for="row in rows"
              :key="row.id"
              :class="T.row"
              data-testid="question-row"
              :data-question-id="row.id"
            >
              <td :class="CELL">
                <input
                  v-model="selected"
                  type="checkbox"
                  :value="row.id"
                  class="h-5 w-5 rounded border-slate-300 accent-indigo-600"
                  data-testid="question-select"
                />
              </td>
              <td :class="CELL" data-testid="question-id">{{ row.id }}</td>
              <td :class="[CELL, 'min-w-60']">
                <p class="break-words text-slate-800" data-testid="question-text">
                  {{ excerpt(row.questionText) }}
                </p>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    v-if="row.dskpTagged"
                    class="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                    data-testid="question-dskp"
                  >
                    <CircleCheck class="h-3 w-3" aria-hidden="true" />DSKP
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                    data-testid="question-dskp"
                  >
                    <BookOpen class="h-3 w-3" aria-hidden="true" />Latihan Tambahan
                  </span>
                  <span
                    :class="complianceClass(row.complianceStatus)"
                    data-testid="question-compliance"
                    >{{ row.complianceStatus.replaceAll('_', ' ').toUpperCase() }}</span
                  >
                  <span
                    v-if="row.aiVerified"
                    class="inline-block rounded bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700"
                    data-testid="question-ai-verified"
                    >AI Verified</span
                  >
                </div>
                <p class="mt-1 text-xs break-words text-slate-500" data-testid="question-source">
                  Source: {{ sourceLabel(row.sourceType) }}
                </p>
                <p
                  v-if="row.sourceFile"
                  class="text-xs break-words text-slate-500"
                  data-testid="question-source-file"
                >
                  {{ row.sourceFile }}
                </p>
              </td>
              <td :class="CELL">
                <span class="inline-flex items-start gap-1.5">
                  <Book class="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                  <span class="break-words">{{ row.subject?.name ?? '-' }}</span>
                </span>
              </td>
              <td :class="CELL">{{ row.level?.name ?? '-' }}</td>
              <td :class="[CELL, 'whitespace-nowrap']" data-testid="question-stars">
                <span class="inline-flex gap-0.5">
                  <Star
                    v-for="n in 5"
                    :key="n"
                    class="h-4 w-4"
                    :class="
                      n <= row.difficultyLevel
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-slate-200 text-slate-200'
                    "
                    aria-hidden="true"
                  />
                </span>
              </td>
              <td :class="CELL">
                <span :class="statusClass(row.status)" data-testid="question-status">{{
                  statusLabel(row.status, true)
                }}</span>
                <p
                  class="mt-1 text-xs font-semibold"
                  :class="row.isActive ? 'text-emerald-600' : 'text-red-600'"
                  data-testid="question-active"
                >
                  {{ row.isActive ? 'ACTIVE' : 'INACTIVE' }}
                </p>
              </td>
              <td :class="CELL">
                <div class="flex items-center gap-1">
                  <RouterLink
                    :to="questionDetailPath(row.id)"
                    title="Lihat"
                    :class="[ICON_LINK, 'text-indigo-600 hover:bg-indigo-50']"
                    data-testid="question-view"
                  >
                    <Eye class="h-4 w-4" aria-hidden="true" />
                  </RouterLink>
                  <RouterLink
                    :to="questionEditPath(row.id)"
                    title="Edit"
                    :class="[ICON_LINK, 'text-emerald-600 hover:bg-emerald-50']"
                    data-testid="question-edit"
                  >
                    <SquarePen class="h-4 w-4" aria-hidden="true" />
                  </RouterLink>
                  <form method="post" class="inline-flex" @submit.prevent="remove(row)">
                    <button
                      type="submit"
                      title="Padam"
                      :disabled="busy"
                      :class="[ICON_LINK, 'text-red-600 hover:bg-red-50 disabled:opacity-60']"
                      data-testid="question-delete"
                    >
                      <Trash class="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <template #footer>
        <div class="border-t border-slate-100 px-4 py-3 empty:hidden" data-testid="questions-pager">
          <LaravelPager
            v-if="list.data.value && rows.length > 0"
            :page="list.data.value.meta.page"
            :total="list.data.value.meta.totalItems"
            :per-page="list.data.value.meta.pageSize"
            :path="QUESTIONS_LIST_PATH"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
