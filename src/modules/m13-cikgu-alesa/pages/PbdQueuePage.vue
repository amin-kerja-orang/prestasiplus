<script setup lang="ts">
/**
 * S6 `/cikgu/pbd` PBD auto-tag review queue (FR-M13-57..67, 70; URS FT-M13-5.1..5.3). Two separate
 * forms: the rollup form in the toolbar and `#bulk-form` around the table card (no form nested in
 * it). "Pilih semua" acts through its click handler on every `.row-check` in the document (as the
 * live `onclick`; a programmatic `change` does nothing). No confirm and no flash message anywhere.
 */
import { Download } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { FORM_SELECT_CLASS } from '@/components/form'
import { useApi } from '@/composables'
import { saveBlob } from '@/lib/save-blob'

import { bulkApprovePbd, downloadPbdCsv, fetchCikguClasses, fetchPbdQueue, rollupPbd } from '../api'
import { PBD_COPY as C } from '../components/teacher/copy'
import { errorLines, pageOf } from '../components/teacher/lib'
import PageState from '../components/teacher/PageState.vue'

const route = useRoute()
const router = useRouter()
const page = computed(() => pageOf(route.query.page))

const { data, error, reload } = useApi((signal) => fetchPbdQueue(page.value, { signal }), page)
const { data: classes } = useApi((signal) => fetchCikguClasses({ signal }))

const classId = ref('')
const working = ref(false)
const actionErrors = ref<string[]>([])
/** Bumped after an action so the reloaded rows and "Pilih semua" come back unticked. */
const generation = ref(0)

function goToPage(next: number): void {
  generation.value += 1
  void router.push({ path: '/cikgu/pbd', query: { page: String(next) } })
}

/** The live `onclick`: every `.row-check` of the document takes the box's own state. */
function selectAll(event: MouseEvent): void {
  const checked = (event.target as HTMLInputElement).checked
  document.querySelectorAll<HTMLInputElement>('.row-check').forEach((box) => {
    box.checked = checked
  })
}

async function refreshQueue(): Promise<void> {
  generation.value += 1
  await reload()
}

async function onRollup(): Promise<void> {
  if (working.value) return
  working.value = true
  actionErrors.value = []
  try {
    await rollupPbd(classId.value === '' ? null : Number(classId.value))
    classId.value = ''
    await refreshQueue()
  } catch (err) {
    actionErrors.value = errorLines(err, C.actionFailed)
  } finally {
    working.value = false
  }
}

async function onBulk(event: Event): Promise<void> {
  if (working.value) return
  working.value = true
  actionErrors.value = []
  try {
    const form = event.target as HTMLFormElement
    const ids = new FormData(form)
      .getAll('ids[]')
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n))
    await bulkApprovePbd(ids)
    await refreshQueue()
  } catch (err) {
    actionErrors.value = errorLines(err, C.actionFailed)
  } finally {
    working.value = false
  }
}

async function onExport(event: MouseEvent): Promise<void> {
  // Mock limitation: a modified click skips this interceptor (the browser follows the link itself).
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  try {
    const file = await downloadPbdCsv()
    saveBlob(file.blob, file.filename ?? C.exportFile)
  } catch (err) {
    actionErrors.value = errorLines(err, C.actionFailed)
  }
}

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white focus:outline-none focus-visible:ring-2'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="pbd-page">
    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div class="min-w-0">
        <h1 class="font-heading text-2xl font-bold text-slate-800">{{ C.title }}</h1>
        <p class="text-sm text-slate-500">{{ C.sub }}</p>
      </div>
      <div
class="flex min-w-0 flex-col md:flex-row md:flex-wrap md:items-center md:gap-2"
        data-testid="pbd-toolbar">
        <form
          id="rollup-form"
          class="flex min-w-0 flex-col md:flex-row md:items-center md:gap-2"
          @submit.prevent="onRollup"
        >
          <select
            v-model="classId"
            name="classroom_id"
            :class="[FORM_SELECT_CLASS, 'min-h-11 md:w-auto']"
            data-testid="pbd-class"
          >
            <option value="">{{ C.classPlaceholder }}</option>
            <option v-for="c in classes ?? []" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </select>
          <button
            type="submit"
            :disabled="working"
            :class="[BTN, 'bg-purple-500 hover:bg-purple-600 focus-visible:ring-purple-300']"
            data-testid="pbd-rollup"
          >
            {{ C.rollup }}
          </button>
        </form>
        <a
          :href="C.exportHref"
          :class="[BTN, 'bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-300']"
          data-testid="pbd-export"
          @click="onExport"
        >
          <Download class="h-4 w-4 shrink-0" />{{ C.exportCsv }}
        </a>
      </div>
    </div>

    <AlertBox v-if="actionErrors.length > 0" :messages="actionErrors" />

    <PageState
      :loaded="data !== null"
      :error="error !== null"
      :message="C.loadFailed"
      :retry-label="C.retry"
      @retry="reload"
    >
      <form id="bulk-form" class="min-w-0" @submit.prevent="onBulk">
        <DataTableCard v-if="data" :min-width="640">
          <template #header>
            <div
              class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"
            >
              <label class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
                <input
                  id="select-all"
                  :key="generation"
                  type="checkbox"
                  class="h-4 w-4"
                  @click="selectAll"
                />
                {{ C.selectAll }}
              </label>
              <button
                type="submit"
                :disabled="working"
                :class="[BTN, 'bg-blue-500 hover:bg-blue-600 focus-visible:ring-blue-300']"
                data-testid="pbd-bulk"
              >
                {{ C.bulk }}
              </button>
            </div>
          </template>
          <table :class="T.table" data-testid="pbd-table">
            <thead class="bg-slate-50">
              <tr>
                <th :class="T.th"></th>
                <th :class="T.th">{{ C.headers[0] }}</th>
                <th :class="T.th">{{ C.headers[1] }}</th>
                <th :class="[T.th, 'text-center']">{{ C.headers[2] }}</th>
                <th :class="[T.th, 'text-center']">{{ C.headers[3] }}</th>
                <th :class="[T.th, 'text-right']">{{ C.headers[4] }}</th>
              </tr>
            </thead>
            <tbody :key="generation">
              <tr v-if="data.data.length === 0" data-testid="pbd-empty">
                <td colspan="6" class="px-4 py-8 text-center text-slate-400">{{ C.empty }}</td>
              </tr>
              <tr v-for="row in data.data" :key="row.id" :class="T.row" data-testid="pbd-row">
                <td :class="T.td">
                  <input
                    type="checkbox"
                    name="ids[]"
                    :value="row.id"
                    class="row-check h-4 w-4"
                  />
                </td>
                <td :class="T.td">{{ row.studentName }}</td>
                <td :class="T.td">{{ row.sp }}</td>
                <td :class="[T.td, 'text-center']">{{ row.skor.toFixed(1) }}%</td>
                <td :class="[T.td, 'text-center']">TP{{ row.tp }}</td>
                <td :class="[T.td, 'text-right']">-</td>
              </tr>
            </tbody>
          </table>
          <template #footer>
            <div class="px-4 py-3 empty:hidden" data-testid="pbd-pager">
              <LaravelPager
                :page="data.meta.page"
                :total="data.meta.totalItems"
                :per-page="data.meta.pageSize"
                path="/cikgu/pbd"
                @change="goToPage"
              />
            </div>
          </template>
        </DataTableCard>
      </form>
    </PageState>
  </div>
</template>
