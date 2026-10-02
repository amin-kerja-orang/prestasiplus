<script setup lang="ts">
/**
 * S5 `/admin/notes` "Pengurusan Nota - Admin PRESTASIPLUS" (FR-M09-42..45; DV-M09-06).
 *
 * - GET filter form (`search`, `subject`, `note_type`); the "Jenis" options keep their live labels
 *   and the server matches them by meaning (DV-M09-06). The query string is the state.
 * - Table of 20 rows per page from `GET /api/admin/notes` (id ascending); the pager appears only
 *   above 20 rows (INFERRED, as S1) and keeps the filters.
 * - Delete: native confirm, DELETE, reload with the success flash (PROPOSED COPY).
 */
import { Download, Eye, Inbox, Plus, Search } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { confirmNative, useApi, useFlash } from '@/composables'

import { deleteAdminNote, fetchAdminNotes, type AdminNoteItem } from '../api/admin-articles-notes'
import AdminRowActions from '../components/admin-articles-notes/AdminRowActions.vue'
import AdminStatusPill from '../components/admin-articles-notes/AdminStatusPill.vue'
import {
  COPY,
  NOTES_LIST_PATH,
  NOTE_ROUTES,
  NOTE_SUBJECT_OPTIONS,
  NOTE_TYPE_FILTER_OPTIONS,
  PRIMARY_BUTTON_CLASS,
  RESET_BUTTON_CLASS,
  errorLines,
  limitText,
  noteGradeText,
  noteSubjectText,
  queryPage,
  queryText,
} from '../lib/admin-articles-notes'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

/** The applied filters, read from the URL (live names: `search`, `subject`, `note_type`). */
const applied = computed(() => ({
  search: queryText(route.query.search).trim(),
  subject: queryText(route.query.subject),
  noteType: queryText(route.query.note_type),
  page: queryPage(route.query.page),
}))

const search = ref(queryText(route.query.search))
const subject = ref(queryText(route.query.subject) || 'all')
const noteType = ref(queryText(route.query.note_type) || 'all')
watch(
  () => [route.query.search, route.query.subject, route.query.note_type] as const,
  ([s, sub, type]) => {
    search.value = queryText(s)
    subject.value = queryText(sub) || 'all'
    noteType.value = queryText(type) || 'all'
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchAdminNotes(
      {
        search: applied.value.search,
        subject: applied.value.subject,
        noteType: applied.value.noteType,
        page: applied.value.page,
      },
      { signal },
    ),
  [
    () => route.query.search,
    () => route.query.subject,
    () => route.query.note_type,
    () => route.query.page,
  ],
)

const rows = computed<AdminNoteItem[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)

const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  if (applied.value.search !== '') out.search = applied.value.search
  if (applied.value.subject !== '') out.subject = applied.value.subject
  if (applied.value.noteType !== '') out.note_type = applied.value.noteType
  return out
})

function formQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  const s = search.value.trim()
  if (s !== '') out.search = s
  if (subject.value !== '' && subject.value !== 'all') out.subject = subject.value
  if (noteType.value !== '' && noteType.value !== 'all') out.note_type = noteType.value
  return out
}

async function submitFilter(): Promise<void> {
  const query = formQuery()
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: NOTES_LIST_PATH, query })
  }
}

function goToPage(page: number): void {
  void router.push({ path: NOTES_LIST_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

const deleting = ref(false)

async function remove(row: AdminNoteItem): Promise<void> {
  if (!confirmNative(COPY.confirmDeleteNote)) return
  if (deleting.value) return
  deleting.value = true
  try {
    const result = await deleteAdminNote(row.id)
    await reload()
    if (rows.value.length === 0 && applied.value.page > 1) {
      await router.push({
        path: NOTES_LIST_PATH,
        query: { ...pagerQuery.value, page: String(applied.value.page - 1) },
      })
    }
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    deleting.value = false
  }
}

const COLUMNS = ['Tajuk', 'Subjek', 'Jenis', 'Tahap', 'Status', 'Statistik', 'Tindakan'] as const
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="admin-notes-page">
    <form
      method="get"
      class="grid gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-2 sm:p-5 lg:grid-cols-[2fr_1fr_1fr_auto]"
      data-testid="admin-notes-filter"
      @submit.prevent="submitFilter"
    >
      <input
        v-model="search"
        type="text"
        name="search"
        placeholder="Cari nota..."
        :class="[FORM_INPUT_CLASS, 'min-h-11 sm:col-span-2 lg:col-span-1']"
        data-testid="admin-notes-search"
      />
      <select
        v-model="subject"
        name="subject"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="admin-notes-subject"
      >
        <option value="all">Semua Subjek</option>
        <option v-for="o in NOTE_SUBJECT_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <select
        v-model="noteType"
        name="note_type"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="admin-notes-type"
      >
        <option v-for="o in NOTE_TYPE_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <div class="flex gap-3 sm:col-span-2 lg:col-span-1">
        <button type="submit" :class="PRIMARY_BUTTON_CLASS" data-testid="admin-notes-submit">
          <Search class="h-4 w-4" aria-hidden="true" />
          Cari
        </button>
        <RouterLink
          :to="NOTES_LIST_PATH"
          :class="RESET_BUTTON_CLASS"
          data-testid="admin-notes-reset"
        >
          Reset
        </RouterLink>
      </div>
    </form>

    <AlertBox v-if="error" :messages="errorLines(error)" data-testid="admin-notes-error" />

    <DataTableCard v-else-if="data" :min-width="780">
      <template #header>
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4"
        >
          <div>
            <h2 class="font-heading text-lg font-bold text-slate-800">Senarai Nota</h2>
            <p class="text-sm text-slate-500" data-testid="admin-notes-count">
              Jumlah: {{ total }} nota
            </p>
          </div>
          <RouterLink
            :to="{ name: NOTE_ROUTES.create }"
            :class="PRIMARY_BUTTON_CLASS"
            data-testid="admin-notes-add"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            Tambah Nota
          </RouterLink>
        </div>
      </template>

      <table :class="T.table" data-testid="admin-notes-table">
        <thead class="bg-slate-50">
          <tr>
            <th
              v-for="label in COLUMNS"
              :key="label"
              scope="col"
              :class="T.th"
              data-testid="admin-notes-th"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0" :class="T.row" data-testid="admin-notes-empty">
            <td :colspan="COLUMNS.length" class="px-4 py-12 text-center text-slate-400">
              <Inbox class="mx-auto mb-2 h-10 w-10" aria-hidden="true" />
              <p class="font-medium text-slate-500">{{ COPY.noteEmpty }}</p>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="[T.row, 'align-middle']"
            data-testid="admin-note-row"
            :data-note-id="row.id"
          >
            <td :class="[T.td, 'min-w-56']">
              <div class="font-semibold text-slate-800" data-testid="note-title">
                {{ limitText(row.title, 40) }}
              </div>
              <div v-if="row.author" class="text-xs text-slate-500" data-testid="note-author">
                Oleh: {{ row.author.name }}
              </div>
            </td>
            <td :class="T.td">
              <span
                class="inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-indigo-700"
                data-testid="note-subject"
                >{{ noteSubjectText(row.subject) }}</span
              >
            </td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="note-type">
              {{ row.noteType }}
            </td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="note-grade">
              {{ noteGradeText(row.grade) }}
            </td>
            <td :class="T.td"><AdminStatusPill :published="row.isPublished" /></td>
            <td :class="[T.td, 'text-xs whitespace-nowrap text-slate-500']">
              <div class="flex items-center gap-1.5" data-testid="note-views">
                <Eye class="h-3.5 w-3.5" aria-hidden="true" />{{ row.views }} tontonan
              </div>
              <div class="flex items-center gap-1.5" data-testid="note-downloads">
                <Download class="h-3.5 w-3.5" aria-hidden="true" />{{ row.downloads }} muat turun
              </div>
            </td>
            <td :class="T.td">
              <AdminRowActions
                :view-to="`${NOTES_LIST_PATH}/${row.id}`"
                :edit-to="`${NOTES_LIST_PATH}/${row.id}/edit`"
                :busy="deleting"
                @remove="remove(row)"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <div v-if="data.meta.totalPages > 1" class="border-t border-slate-100 px-4 py-3">
          <LaravelPager
            :page="applied.page"
            :total="total"
            :per-page="data.meta.pageSize"
            :path="NOTES_LIST_PATH"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
