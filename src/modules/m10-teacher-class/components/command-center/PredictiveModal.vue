<script setup lang="ts">
/**
 * "Ramalan SPM" -> "Ramalan SPM — Predictive Analytics" (FR-M10-21, FN-M10-2.2.9, BR-M10-14): four cards,
 * the ten grade chips ("{g} ({n})" when n > 0), "Tiada data mencukupi untuk ramalan" or the 8-column table.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchCommandCenterPredictive } from '../../api/command-center'
import CcDialog from './CcDialog.vue'
import CcTable from './CcTable.vue'
import { useOpenTab } from './composables'
import { accuracyTone, GRADES, plain, riskLabel, signedPct, studentPath } from './copy'
import type { DrillRow } from './drill-table'
import StatCards from './StatCards.vue'

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCommandCenterPredictive({ signal }))
const openTab = useOpenTab()

const topGrade = computed(() => {
  const dist = data.value?.gradeDistribution ?? {}
  let best = '-'
  let max = 0
  for (const g of GRADES) {
    const n = dist[g] ?? 0
    if (n > max) {
      max = n
      best = g
    }
  }
  return best
})
const cards = computed(() => {
  const d = data.value
  return [
    { label: 'Pelajar Dianalisis', value: String(d?.totalPredicted ?? 0) },
    {
      label: 'Ramalan GPS Purata',
      value: d && d.avgPredictedGps > 0 ? d.avgPredictedGps.toFixed(2) : '0',
    },
    { label: 'Berisiko', value: String(d?.atRiskCount ?? 0) },
    { label: 'Gred Terbanyak', value: topGrade.value },
  ]
})
const chips = computed(() =>
  GRADES.map((g) => {
    const n = data.value?.gradeDistribution[g] ?? 0
    return n > 0 ? `${g} (${String(n)})` : g
  }),
)
const HEADERS = ['#', 'Pelajar', 'Accuracy', 'Trend', 'Konsistensi', 'Ramalan', 'GPS', 'Risiko']
const TREND_TONE = { Naik: 'text-success', Turun: 'text-error', Stabil: 'text-toned' } as const
const rows = computed<DrillRow[]>(() =>
  (data.value?.predictions ?? []).map((p, i) => ({
    studentId: p.studentId,
    cells: [
      { text: String(i + 1) },
      { text: p.studentName },
      { text: `${String(p.overallAccuracy)}%`, tone: accuracyTone(p.overallAccuracy), mono: true },
      { text: `${p.trendLabel} (${signedPct(p.trend)})`, tone: TREND_TONE[p.trendLabel] },
      { text: `${plain(p.consistency)}%`, mono: true },
      { text: p.predictedGrade },
      { text: String(p.predictedGps), mono: true },
      { text: riskLabel(p.risk) },
    ],
  })),
)
</script>

<template>
  <CcDialog
    title="Ramalan SPM — Predictive Analytics"
    testid="cc-predictive-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-body text-error">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-modal-loading">
      Menganalisis data prestasi semua pelajar...
    </p>
    <template v-else>
      <StatCards :cards="cards" />
      <ul class="flex flex-wrap gap-2" data-testid="cc-grade-chips">
        <li v-for="c in chips" :key="c">
          <UBadge color="neutral" variant="soft" size="lg" data-testid="cc-grade-chip">{{
            c
          }}</UBadge>
        </li>
      </ul>
      <p
        v-if="data.predictions.length === 0"
        class="text-body text-highlighted"
        data-testid="cc-predictive-empty"
      >
        Tiada data mencukupi untuk ramalan
      </p>
      <CcTable
        v-else
        :headers="HEADERS"
        :rows="rows"
        testid="cc-predictive-table"
        row-testid="cc-predictive-row"
        caption="Ramalan SPM — Predictive Analytics"
        @open="openTab(studentPath($event))"
      />
    </template>
  </CcDialog>
</template>
