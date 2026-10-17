<script setup lang="ts">
/**
 * S22 `/headcount/{id}/summary` "Ringkasan Kelas" (M08-T6; FR-M08-128…132, BR-M08-08 rule 2, BR-M08-32).
 * Four tiles, the per-OTR distribution (Above / On Track ±2% / Below / N/A) and the two buttons. "Export
 * CSV" downloads the CSV of S23 (UNVERIFIED L-12). An unknown id is the 404 page, a config the viewer may
 * not open the 403 page.
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { DsChart, DsPage } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { downloadHeadcountCsv, fetchHeadcountSummary } from '../api/headcount'
import PageHeader from '../components/shared/PageHeader.vue'
import PageLoadError from '../components/shared/PageLoadError.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import StatGrid, { type StatItem } from '../components/shared/StatGrid.vue'
import { DASH, num1 } from '../lib/headcount/format'
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

const subtitle = computed(() => {
  const c = data.value?.config
  return c ? `${c.subject} · ${c.className} · ${c.levelName} · ${String(c.year)}` : ''
})
const tiles = computed<StatItem[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { id: 'students', label: 'Jumlah Murid', value: d.students, icon: 'users' },
    {
      id: 'tov',
      label: 'Purata TOV (%)',
      value: d.avgTov === null ? DASH : num1(d.avgTov),
      icon: 'chart-line-up',
    },
    {
      id: 'etr',
      label: 'Purata ETR (%)',
      value: d.avgEtr === null ? DASH : num1(d.avgEtr),
      icon: 'target',
    },
    { id: 'otrs', label: 'OTR Aktif', value: d.config.activeOtrs, icon: 'list-numbers' },
  ]
})

const labels = computed(() => (data.value?.otrs ?? []).map((o) => `OTR${String(o.n)}`))
const series = computed(() => {
  const o = data.value?.otrs ?? []
  return [
    { label: 'Above Target', data: o.map((x) => x.above), slot: 2 },
    { label: 'On Track (±2%)', data: o.map((x) => x.onTrack), slot: 1 },
    { label: 'Below Target', data: o.map((x) => x.below), slot: 3 },
    { label: 'Belum Diisi', data: o.map((x) => x.na), slot: 4 },
  ]
})
</script>

<template>
  <DsPage data-testid="headcount-summary-page">
    <PageLoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <PageHeader title="Ringkasan Kelas" :subtitle="subtitle" subtitle-testid="summary-subtitle">
        <template #leading>
          <UButton
            :to="`/headcount/${String(data.config.id)}`"
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-ph-arrow-left"
            aria-label="Kembali"
            data-testid="back-link"
          />
        </template>
      </PageHeader>

      <StatGrid :items="tiles" prefix="card" />

      <UCard data-testid="distribution">
        <div class="flex flex-col gap-4">
          <DsChart
            type="bar"
            title="Taburan Prestasi Per OTR"
            :level="2"
            :labels="labels"
            :series="series"
          />
          <ul class="flex flex-col gap-3">
            <li
              v-for="o in data.otrs"
              :key="o.n"
              class="flex flex-wrap items-center gap-x-4 gap-y-1"
              :data-testid="`otr-${String(o.n)}`"
            >
              <h3 class="text-label text-highlighted">OTR{{ o.n }}</h3>
              <span class="inline-flex items-center gap-1 text-caption text-success"
                ><UIcon name="i-ph-arrow-up" class="size-4" />Above: {{ o.above }}</span
              >
              <span class="inline-flex items-center gap-1 text-caption text-default"
                ><UIcon name="i-ph-check" class="size-4" />On Track: {{ o.onTrack }}</span
              >
              <span class="inline-flex items-center gap-1 text-caption text-error"
                ><UIcon name="i-ph-arrow-down" class="size-4" />Below: {{ o.below }}</span
              >
              <span class="text-caption text-dimmed">N/A: {{ o.na }}</span>
            </li>
          </ul>
        </div>
      </UCard>

      <UAlert
        v-if="actionError"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        :title="actionError"
        role="alert"
        data-testid="action-error"
      />

      <div class="flex flex-wrap gap-3">
        <UButton
          :to="`/headcount/${String(data.config.id)}`"
          size="lg"
          icon="i-ph-table"
          label="Lihat Table Penuh"
          data-testid="full-table"
        />
        <UButton
          :href="`/headcount/${String(data.config.id)}/export`"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-download-simple"
          label="Export CSV"
          data-testid="export-csv"
          @click.prevent="exportCsv"
        />
      </div>
    </template>
    <PageSkeleton v-else-if="!error" />
  </DsPage>
</template>
