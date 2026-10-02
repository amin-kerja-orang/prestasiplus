<script setup lang="ts">
/**
 * S6 `/admin/comp-students` "Pelajar Komplimen - Admin Panel" (M02-T7; FR-M02-65…69).
 *
 * Summary "Syiling OFF: {n} / {total} pelajar komplimen" + "Daftar Baru", the sticky bulk bar (shown while
 * a row is ticked: "{n} dipilih", four immediate actions without confirmation, "Batal pilihan") and the
 * table of 50 rows per page. DV-M02-05: the table scrolls inside its card whenever it is wider (live clips
 * it). After a bulk action the same page reloads, the selection is cleared and the API `status` is the
 * success flash (UNVERIFIED COPY).
 */
import { Coins, LoaderCircle, UserPlus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { bulkCompAction, fetchCompStudents, type CompBulkAction } from '../api/comp-students'
import {
  accountClass,
  BULK_BUTTONS,
  COMP_CREATE_PATH,
  COMP_LIST_PATH,
  coinsClass,
  compDetailPath,
} from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'
import { formatUserDate } from '../lib/user-list'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const page = computed(() => {
  const raw = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
  return Math.max(1, Number.parseInt(raw ?? '', 10) || 1)
})

const { data, error, reload } = useApi(
  (signal) => fetchCompStudents({ page: page.value, signal }),
  () => route.query.page,
)

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

function goToPage(next: number): void {
  void router.push({ path: COMP_LIST_PATH, query: { page: String(next) } })
}

// --- Selection (FR-M02-67): a page change clears it.
const selected = ref<number[]>([])
const pageIds = computed(() => rows.value.map((r) => r.id))
const allSelected = computed(
  () => pageIds.value.length > 0 && pageIds.value.every((id) => selected.value.includes(id)),
)
watch(
  () => route.fullPath,
  () => {
    selected.value = []
  },
)

function toggleAll(event: Event): void {
  selected.value = (event.target as HTMLInputElement).checked ? [...pageIds.value] : []
}

const busy = ref(false)
const runningAction = ref<CompBulkAction | null>(null)

async function runBulk(action: CompBulkAction): Promise<void> {
  if (busy.value || selected.value.length === 0) return
  busy.value = true
  runningAction.value = action
  try {
    const result = await bulkCompAction(action, selected.value)
    selected.value = []
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
    runningAction.value = null
  }
}

const SKELETON_ROWS = 5
const COLUMN_COUNT = 10
const HEADERS = [
  'Nama',
  'Username',
  'IC',
  'Sekolah',
  'Kelas',
  'Cikgu',
  'Akaun',
  'Syiling',
  'Pakej tamat',
]
const CELL = 'px-3 py-3 text-sm text-slate-700 align-middle'
const HEAD = 'px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide'
const CHECK = 'h-5 w-5 rounded border-slate-300 accent-indigo-600'
const BULK_BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60'
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-5" data-testid="comp-list-page">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p
        v-if="counts"
        class="flex items-center gap-2 text-sm text-slate-600"
        data-testid="comp-summary"
      >
        <Coins class="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        <span>
          Syiling OFF: <strong class="text-slate-800">{{ counts.coinsOff }}</strong> /
          {{ counts.total }} pelajar komplimen
        </span>
      </p>
      <span v-else></span>
      <RouterLink
        :to="COMP_CREATE_PATH"
        class="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:self-auto"
        data-testid="comp-add"
      >
        <UserPlus class="h-4 w-4" aria-hidden="true" />
        Daftar Baru
      </RouterLink>
    </div>

    <!-- Sticky bulk bar (FR-M02-67): only while at least one row is ticked. -->
    <div
      v-if="selected.length > 0"
      class="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 shadow-sm"
      data-testid="comp-bulk-bar"
    >
      <span class="mr-1 text-sm font-semibold text-slate-700">
        <span data-testid="comp-selected-count">{{ selected.length }}</span> dipilih
      </span>
      <button
        v-for="b in BULK_BUTTONS"
        :key="b.action"
        type="button"
        :disabled="busy"
        :class="[BULK_BTN, b.cls]"
        :data-testid="`comp-bulk-${b.action}`"
        @click="runBulk(b.action)"
      >
        <LoaderCircle
          v-if="runningAction === b.action"
          class="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        <component :is="b.icon" v-else class="h-4 w-4" aria-hidden="true" />
        {{ b.label }}
      </button>
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="comp-bulk-clear"
        @click="selected = []"
      >
        Batal pilihan
      </button>
    </div>

    <div v-if="error" class="space-y-3" data-testid="comp-error">
      <AlertBox :messages="errorLines(error)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="comp-retry"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>

    <DataTableCard v-else :min-width="984">
      <table :class="T.table" data-testid="comp-table">
        <thead class="bg-slate-50">
          <tr>
            <th scope="col" :class="[HEAD, 'w-10']">
              <input
                type="checkbox"
                :class="CHECK"
                :checked="allSelected"
                data-testid="comp-select-all"
                @change="toggleAll"
              />
            </th>
            <th v-for="label in HEADERS" :key="label" scope="col" :class="HEAD">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="firstLoad">
            <tr v-for="n in SKELETON_ROWS" :key="n" :class="T.row" data-testid="comp-skeleton">
              <td v-for="c in COLUMN_COUNT" :key="c" :class="CELL">
                <div class="h-4 w-full max-w-24 animate-pulse rounded bg-slate-100"></div>
              </td>
            </tr>
          </template>

          <template v-else>
            <tr
              v-for="s in rows"
              :key="s.id"
              :class="T.row"
              data-testid="comp-row"
              :data-student-id="s.id"
            >
              <td :class="CELL">
                <input
                  v-model="selected"
                  type="checkbox"
                  :value="s.id"
                  :class="CHECK"
                  data-testid="comp-select"
                />
              </td>
              <td :class="[CELL, 'min-w-36 font-medium']">
                <RouterLink
                  :to="compDetailPath(s.id)"
                  class="break-words text-indigo-600 hover:text-indigo-800 hover:underline"
                  data-testid="comp-name"
                  >{{ s.name }}</RouterLink
                >
              </td>
              <td :class="[CELL, 'font-mono text-xs break-all text-slate-600']">
                {{ s.username }}
              </td>
              <td :class="[CELL, 'font-mono text-xs whitespace-nowrap text-slate-500']">
                {{ s.icNumber ?? '' }}
              </td>
              <td :class="[CELL, 'min-w-44 text-xs']">{{ s.schoolName ?? '' }}</td>
              <td :class="[CELL, 'font-semibold text-slate-800']">{{ s.classLabel }}</td>
              <td :class="[CELL, 'min-w-28 text-xs text-slate-600']">{{ s.teacherName }}</td>
              <td
                :class="[CELL, 'text-xs font-bold whitespace-nowrap', accountClass(s.isActive)]"
                data-testid="comp-account"
              >
                {{ s.isActive ? 'AKTIF' : 'TIDAK AKTIF' }}
              </td>
              <td
                :class="[CELL, 'text-xs font-bold whitespace-nowrap', coinsClass(s.coinsEnabled)]"
                data-testid="comp-coins"
              >
                {{ s.coinsEnabled ? 'ON' : 'OFF' }}
              </td>
              <td :class="[CELL, 'text-xs whitespace-nowrap']">
                {{ formatUserDate(s.packageExpiresAt) }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <template #footer>
        <!-- Outside the table scroller so it stays centred in the card at every width (FR-M02-69). -->
        <p
          v-if="data && rows.length === 0"
          class="border-t border-slate-100 px-4 py-12 text-center text-sm text-slate-500"
          data-testid="comp-empty"
        >
          Tiada pelajar komplimen lagi.
          <RouterLink
            :to="COMP_CREATE_PATH"
            class="font-medium text-indigo-600 underline hover:text-indigo-800"
            data-testid="comp-empty-link"
            >Daftar baru.</RouterLink
          >
        </p>
        <div class="border-t border-slate-100 px-4 py-3 empty:hidden" data-testid="comp-pager">
          <LaravelPager
            v-if="data"
            :page="data.meta.page"
            :total="data.meta.totalItems"
            :per-page="data.meta.pageSize"
            :path="COMP_LIST_PATH"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
