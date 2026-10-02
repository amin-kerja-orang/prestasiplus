<script setup lang="ts">
/**
 * S22 `/headcount/{id}/summary` "Ringkasan Kelas" (M08-T6; FR-M08-128…132, BR-M08-08 rule 2, BR-M08-32).
 * Four cards, the per-OTR distribution (Above / On Track ±2% / Below / N/A) and the two buttons. "Export
 * CSV" downloads the CSV of S23 (UNVERIFIED L-12). An unknown id is the 404 page, a config the viewer may
 * not open the 403 page.
 */
import { ArrowDown, ArrowLeft, ArrowUp, ChartBar, Check, Download, Table } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { downloadHeadcountCsv, fetchHeadcountSummary } from '../api/headcount'
import { AlertBox } from '@/components/feedback'

import LoadError from '../components/headcount/LoadError.vue'
import { DASH, num1 } from '../lib/headcount/format'
import { saveBlob } from '@/lib/save-blob'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountSummary(id.value, { signal }),
  [id],
)

const downloading = ref(false)
const actionError = ref<string | null>(null)
async function exportCsv() {
  if (downloading.value) return
  downloading.value = true
  actionError.value = null
  try {
    const file = await downloadHeadcountCsv(id.value)
    saveBlob(file.blob, file.filename ?? `headcount-${String(id.value)}.csv`)
  } catch {
    actionError.value = LOAD_ERROR
  } finally {
    downloading.value = false
  }
}

const pct = (n: number, total: number): number => (total > 0 ? (n / total) * 100 : 0)
const LEGEND = [
  { label: 'Above Target', cls: 'bg-green-500' },
  { label: 'On Track (±2%)', cls: 'bg-blue-500' },
  { label: 'Below Target', cls: 'bg-red-500' },
  { label: 'Belum Diisi', cls: 'bg-slate-300' },
]
const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold shadow transition'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="headcount-summary-page">
    <LoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <header class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow">
        <RouterLink
          :to="`/headcount/${data.config.id}`"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:text-slate-800"
          data-testid="back-link"
          ><ArrowLeft class="h-5 w-5"
        /></RouterLink>
        <div class="min-w-0">
          <h1
            class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800 sm:text-xl"
          >
            <ChartBar class="h-5 w-5 shrink-0 text-indigo-600" />Ringkasan Kelas
          </h1>
          <p class="text-sm break-words text-slate-500" data-testid="summary-subtitle">
            {{ data.config.subject }} · {{ data.config.className }} · {{ data.config.levelName }} ·
            {{ data.config.year }}
          </p>
        </div>
      </header>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="summary-cards">
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="font-heading text-2xl font-bold text-blue-700" data-testid="card-students">
            {{ data.students }}
          </p>
          <p class="text-xs text-slate-500 sm:text-sm">Jumlah Murid</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="font-heading text-2xl font-bold text-amber-700" data-testid="card-tov">
            {{ data.avgTov === null ? DASH : num1(data.avgTov) }}
          </p>
          <p class="text-xs text-slate-500 sm:text-sm">Purata TOV (%)</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="font-heading text-2xl font-bold text-purple-700" data-testid="card-etr">
            {{ data.avgEtr === null ? DASH : num1(data.avgEtr) }}
          </p>
          <p class="text-xs text-slate-500 sm:text-sm">Purata ETR (%)</p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="font-heading text-2xl font-bold text-slate-700" data-testid="card-otrs">
            {{ data.config.activeOtrs }}
          </p>
          <p class="text-xs text-slate-500 sm:text-sm">OTR Aktif</p>
        </div>
      </div>

      <section class="space-y-4 rounded-2xl bg-white p-5 shadow" data-testid="distribution">
        <h2 class="text-base font-bold text-slate-700">Taburan Prestasi Per OTR</h2>
        <div v-for="o in data.otrs" :key="o.n" class="space-y-2" :data-testid="`otr-${o.n}`">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h3 class="text-sm font-bold text-slate-700">OTR{{ o.n }}</h3>
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-green-600"
              ><ArrowUp class="h-3.5 w-3.5" />Above: {{ o.above }}</span
            >
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
              ><Check class="h-3.5 w-3.5" />On Track: {{ o.onTrack }}</span
            >
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
              ><ArrowDown class="h-3.5 w-3.5" />Below: {{ o.below }}</span
            >
            <span class="text-xs font-semibold text-slate-400">N/A: {{ o.na }}</span>
          </div>
          <div class="flex h-4 overflow-hidden rounded-full bg-slate-100">
            <div
              v-if="o.above > 0"
              class="bg-green-500"
              :style="{ width: `${pct(o.above, data.students)}%` }"
              :title="`Above: ${o.above}`"
            />
            <div
              v-if="o.onTrack > 0"
              class="bg-blue-500"
              :style="{ width: `${pct(o.onTrack, data.students)}%` }"
              :title="`On Track: ${o.onTrack}`"
            />
            <div
              v-if="o.below > 0"
              class="bg-red-500"
              :style="{ width: `${pct(o.below, data.students)}%` }"
              :title="`Below: ${o.below}`"
            />
            <div
              v-if="o.na > 0"
              class="bg-slate-300"
              :style="{ width: `${pct(o.na, data.students)}%` }"
              :title="`N/A: ${o.na}`"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600" data-testid="legend">
          <span v-for="l in LEGEND" :key="l.label" class="inline-flex items-center gap-1.5">
            <span :class="['h-3 w-3 rounded', l.cls]" />{{ l.label }}
          </span>
        </div>
      </section>

      <AlertBox v-if="actionError" :messages="actionError" data-testid="action-error" />

      <div class="flex flex-wrap gap-3">
        <RouterLink
          :to="`/headcount/${data.config.id}`"
          :class="[BTN, 'bg-blue-600 text-white hover:bg-blue-700']"
          data-testid="full-table"
          ><Table class="h-4 w-4" />Lihat Table Penuh</RouterLink
        >
        <a
          :href="`/headcount/${data.config.id}/export`"
          :class="[BTN, 'bg-white text-slate-700 hover:bg-slate-50']"
          data-testid="export-csv"
          @click.prevent="exportCsv"
          ><Download class="h-4 w-4" />Export CSV</a
        >
      </div>
    </template>
  </div>
</template>
