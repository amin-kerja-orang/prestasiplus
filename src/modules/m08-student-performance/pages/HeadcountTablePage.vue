<script setup lang="ts">
/**
 * S23 `/headcount/{id}` "Headcount {Subjek}" (M08-T6; FR-M08-133…140, BR-M08-08 rule 2 / DV-29,
 * BR-M08-32). Header, chips, the action row, the sort links, the table and the selection bar with
 * "Gugurkan" / "Kembalikan". "Ya, Reset" clears the marks and reloads, "Ya, Padam" deletes the config
 * and opens `/headcount`; "Export CSV" downloads the table (all effects INFERRED, FR-M08-137, L-12).
 */
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpDown,
  ChartBar,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  Download,
  Pen,
  RotateCcw,
  Settings,
  SquareCheckBig,
  SquarePen,
  Trash,
  TrendingUp,
  Trophy,
  UserCheck,
  UserX,
  Users,
  X,
} from '@lucide/vue'
import { computed, ref, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { TABLE_CLASSES as T } from '@/components/data'
import { useClickOutside } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'

import {
  deleteHeadcount,
  downloadHeadcountCsv,
  dropHeadcountStudents,
  fetchHeadcountDetail,
  resetHeadcount,
} from '../api/headcount'
import type { DropAction, HeadcountSort } from '../api/headcount-types'
import HeadcountConfirmModals from '../components/headcount/HeadcountConfirmModals.vue'
import HeadcountTable from '../components/headcount/HeadcountTable.vue'
import LoadError from '../components/headcount/LoadError.vue'
import { percentOf } from '../lib/headcount/format'
import { saveBlob } from '@/lib/save-blob'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const id = computed(() => Number(route.params.id))
/** An unknown `sort` is "ranking" (§5). */
const sort = computed<HeadcountSort>(() => (route.query.sort === 'name' ? 'name' : 'ranking'))

const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountDetail(id.value, { sort: sort.value, signal }),
  [id, sort],
)

watchEffect(() => {
  const d = data.value
  if (!d) return
  pageMeta.setTitle(`Headcount ${d.config.subject} - PRESTASIPLUS`)
  pageMeta.setHeader({ title: `Headcount ${d.config.subject}`, subtitle: 'Selamat datang kembali' })
})

const selected = ref<number[]>([])
const resetOpen = ref(false)
const deleteOpen = ref(false)
const busy = ref(false)
const actionError = ref<string | null>(null)

const keyInOpen = ref(false)
const keyInRoot = ref<HTMLElement | null>(null)
useClickOutside(keyInRoot, () => (keyInOpen.value = false), { enabled: keyInOpen })

const chips = computed(() => {
  const c = data.value?.chips
  if (!c) return null
  return {
    on: `On Track: ${String(c.onTrack)} (${String(percentOf(c.onTrack, c.total))}%)`,
    below: `Below: ${String(c.below)} (${String(percentOf(c.below, c.total))}%)`,
    empty: `Belum Diisi: ${String(c.empty)}`,
    total: `Jumlah: ${String(c.total)}`,
  }
})

async function run(task: () => Promise<unknown>): Promise<boolean> {
  if (busy.value) return false
  busy.value = true
  actionError.value = null
  try {
    await task()
    return true
  } catch {
    actionError.value = LOAD_ERROR
    return false
  } finally {
    busy.value = false
  }
}

async function drop(action: DropAction) {
  const ids = [...selected.value]
  if (ids.length === 0) return
  if (await run(() => dropHeadcountStudents(id.value, { action, studentIds: ids }))) {
    selected.value = []
    await reload()
  }
}

async function confirmReset() {
  if (await run(() => resetHeadcount(id.value))) {
    resetOpen.value = false
    selected.value = []
    await reload()
  }
}

async function confirmDelete() {
  if (await run(() => deleteHeadcount(id.value))) {
    deleteOpen.value = false
    await router.push('/headcount')
  }
}

async function exportCsv() {
  await run(async () => {
    const file = await downloadHeadcountCsv(id.value, { sort: sort.value })
    saveBlob(file.blob, file.filename ?? `headcount-${String(id.value)}.csv`)
  })
}

const exportHref = computed(
  () => `/headcount/${String(id.value)}/export${sort.value === 'name' ? '?sort=name' : ''}`,
)

const ACTION =
  'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition'
const SORT =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="headcount-table-page">
    <LoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <header class="flex items-start gap-3 rounded-2xl bg-white p-4 shadow">
        <RouterLink
          to="/headcount"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:text-slate-800"
          data-testid="back-link"
          ><ArrowLeft class="h-5 w-5"
        /></RouterLink>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 class="font-heading text-lg font-bold break-words text-slate-800 sm:text-xl">
              {{ data.config.subject }}
            </h1>
            <span
              class="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700"
              data-testid="status-pill"
              >Active</span
            >
          </div>
          <p class="text-sm break-words text-slate-500" data-testid="table-subtitle">
            {{ data.config.className }} · {{ data.config.levelName }} · {{ data.config.year }} ·
            Guru: {{ data.config.teacherName }}
          </p>
        </div>
      </header>

      <div v-if="chips" class="flex flex-wrap gap-2" data-testid="chips">
        <span
          class="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700"
          data-testid="chip-on"
          ><CircleCheck class="h-4 w-4" />{{ chips.on }}</span
        >
        <span
          class="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
          data-testid="chip-below"
          ><ArrowDown class="h-4 w-4" />{{ chips.below }}</span
        >
        <span
          class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
          data-testid="chip-empty"
          ><CircleMinus class="h-4 w-4" />{{ chips.empty }}</span
        >
        <span
          class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
          data-testid="chip-total"
          ><Users class="h-4 w-4" />{{ chips.total }}</span
        >
      </div>

      <div class="flex flex-wrap gap-2" data-testid="actions">
        <div ref="keyInRoot" class="relative">
          <button
            type="button"
            :class="[ACTION, 'bg-emerald-600 text-white hover:bg-emerald-700']"
            data-testid="action-key-in"
            @click="keyInOpen = !keyInOpen"
          >
            <Pen class="h-4 w-4" />Key-in AR<ChevronDown class="h-4 w-4" />
          </button>
          <div
            v-if="keyInOpen"
            class="absolute left-0 z-20 mt-1 min-w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            data-testid="key-in-menu"
          >
            <RouterLink
              v-for="n in data.config.activeOtrs"
              :key="n"
              :to="`/headcount/${id}/results/${n}`"
              class="flex min-h-11 items-center px-4 text-sm font-semibold text-slate-700 hover:bg-emerald-50"
              :data-testid="`key-in-${n}`"
              >OTR{{ n }}</RouterLink
            >
          </div>
        </div>
        <RouterLink
          :to="`/headcount/${id}/edit`"
          :class="[ACTION, 'bg-amber-500 text-white hover:bg-amber-600']"
          data-testid="action-edit"
          ><SquarePen class="h-4 w-4" />Edit TOV/ETR</RouterLink
        >
        <a
          :href="exportHref"
          :class="[ACTION, 'bg-white text-slate-700 shadow-sm hover:bg-slate-50']"
          data-testid="action-export"
          @click.prevent="exportCsv"
          ><Download class="h-4 w-4" />Export CSV</a
        >
        <RouterLink
          :to="`/headcount/${id}/summary`"
          :class="[ACTION, 'bg-white text-slate-700 shadow-sm hover:bg-slate-50']"
          data-testid="action-summary"
          ><ChartBar class="h-4 w-4" />Ringkasan Kelas</RouterLink
        >
        <RouterLink
          :to="`/headcount/${id}/unjuran`"
          :class="[ACTION, 'bg-amber-50 text-amber-700 hover:bg-amber-100']"
          data-testid="action-unjuran"
          ><TrendingUp class="h-4 w-4" />Unjuran</RouterLink
        >
        <RouterLink
          :to="`/headcount/${id}/settings`"
          :class="[ACTION, 'bg-white text-slate-700 shadow-sm hover:bg-slate-50']"
          data-testid="action-settings"
          ><Settings class="h-4 w-4" />Tetapan</RouterLink
        >
        <button
          type="button"
          :class="[ACTION, 'bg-orange-50 text-orange-700 hover:bg-orange-100']"
          data-testid="action-reset"
          @click="resetOpen = true"
        >
          <RotateCcw class="h-4 w-4" />Reset Data
        </button>
        <button
          type="button"
          :class="[ACTION, 'bg-red-50 text-red-700 hover:bg-red-100']"
          data-testid="action-delete"
          @click="deleteOpen = true"
        >
          <Trash class="h-4 w-4" />Padam
        </button>
      </div>

      <AlertBox v-if="actionError" :messages="actionError" data-testid="action-error" />

      <div class="flex flex-wrap items-center gap-2" data-testid="sort-links">
        <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600"
          ><ArrowUpDown class="h-4 w-4" />Susun:</span
        >
        <RouterLink
          :to="{ path: `/headcount/${id}`, query: { sort: 'ranking' } }"
          :class="[
            SORT,
            sort === 'ranking'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ]"
          data-testid="sort-ranking"
          ><Trophy class="h-4 w-4" />Ranking</RouterLink
        >
        <RouterLink
          :to="{ path: `/headcount/${id}`, query: { sort: 'name' } }"
          :class="[
            SORT,
            sort === 'name'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ]"
          data-testid="sort-name"
          ><ArrowDownAZ class="h-4 w-4" />A-Z</RouterLink
        >
      </div>

      <div
        v-if="selected.length > 0"
        class="flex flex-wrap items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3"
        data-testid="selection-bar"
      >
        <span class="inline-flex items-center gap-2 text-sm font-semibold text-orange-800">
          <SquareCheckBig class="h-4 w-4" /><span data-testid="selection-count">{{
            selected.length
          }}</span>
          murid dipilih
        </span>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :disabled="busy"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-600 px-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
            data-testid="drop-students"
            @click="drop('drop')"
          >
            <UserX class="h-4 w-4" />Gugurkan
          </button>
          <button
            type="button"
            :disabled="busy"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            data-testid="restore-students"
            @click="drop('restore')"
          >
            <UserCheck class="h-4 w-4" />Kembalikan
          </button>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            data-testid="selection-cancel"
            @click="selected = []"
          >
            <X class="h-4 w-4" />Batal
          </button>
        </div>
      </div>

      <div :class="T.card" data-testid="table-card">
        <div :class="T.scroller">
          <HeadcountTable v-model:selected="selected" :detail="data" />
        </div>
      </div>

      <HeadcountConfirmModals
        v-model:reset-open="resetOpen"
        v-model:delete-open="deleteOpen"
        :subject="data.config.subject"
        :class-name="data.config.className"
        :year="data.config.year"
        :busy="busy"
        @confirm-reset="confirmReset"
        @confirm-delete="confirmDelete"
      />
    </template>
  </div>
</template>
