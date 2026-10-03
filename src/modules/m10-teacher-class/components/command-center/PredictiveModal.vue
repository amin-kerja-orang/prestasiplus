<script setup lang="ts">
/**
 * "🔮 Ramalan SPM" -> "Ramalan SPM — Predictive Analytics" (FR-M10-21, FN-M10-2.2.9, BR-M10-14): four cards,
 * the ten grade chips ("{g} ({n})" when n > 0), "Tiada data mencukupi untuk ramalan" or the 8-column table.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchCommandCenterPredictive } from '../../api/command-center'
import { useOpenTab } from './composables'
import {
  accuracyTone,
  GRADES,
  plain,
  riskLabel,
  riskTone,
  signedPct,
  studentPath,
  TBL,
} from './copy'
import DarkModal from './DarkModal.vue'
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
    { label: 'Pelajar Dianalisis', value: String(d?.totalPredicted ?? 0), tone: 'text-indigo-300' },
    {
      label: 'Ramalan GPS Purata',
      value: d && d.avgPredictedGps > 0 ? d.avgPredictedGps.toFixed(2) : '0',
      tone: 'text-amber-300',
    },
    { label: 'Berisiko', value: String(d?.atRiskCount ?? 0), tone: 'text-rose-300' },
    { label: 'Gred Terbanyak', value: topGrade.value, tone: 'text-emerald-300' },
  ]
})
const chips = computed(() =>
  GRADES.map((g) => {
    const n = data.value?.gradeDistribution[g] ?? 0
    return n > 0 ? `${g} (${String(n)})` : g
  }),
)
const HEADERS = ['#', 'Pelajar', 'Accuracy', 'Trend', 'Konsistensi', 'Ramalan', 'GPS', 'Risiko']
const TREND_TONE = {
  Naik: 'text-emerald-400',
  Turun: 'text-rose-400',
  Stabil: 'text-slate-300',
} as const
</script>

<template>
  <DarkModal
    title="Ramalan SPM — Predictive Analytics"
    testid="cc-predictive-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-sm text-rose-400">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-sm text-slate-300" data-testid="cc-modal-loading">
      Menganalisis data prestasi semua pelajar...
    </p>
    <template v-else>
      <StatCards :cards="cards" />
      <ul class="mt-3 flex flex-wrap gap-2" data-testid="cc-grade-chips">
        <li
          v-for="c in chips"
          :key="c"
          class="rounded-full border border-slate-600 bg-slate-900/60 px-3 py-1 text-sm text-slate-200"
          data-testid="cc-grade-chip"
        >
          {{ c }}
        </li>
      </ul>
      <p
        v-if="data.predictions.length === 0"
        class="mt-4 text-base text-slate-50"
        data-testid="cc-predictive-empty"
      >
        Tiada data mencukupi untuk ramalan
      </p>
      <div v-else :class="[TBL.wrap, 'mt-4']">
        <table :class="TBL.table" data-testid="cc-predictive-table">
          <thead>
            <tr>
              <th v-for="h in HEADERS" :key="h" :class="TBL.th">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, i) in data.predictions"
              :key="p.studentId"
              :class="[TBL.row, TBL.link]"
              data-testid="cc-predictive-row"
              @click="openTab(studentPath(p.studentId))"
            >
              <td :class="TBL.td">{{ i + 1 }}</td>
              <td :class="[TBL.td, 'text-slate-50']">{{ p.studentName }}</td>
              <td :class="[TBL.td, 'font-mono', accuracyTone(p.overallAccuracy)]">
                {{ p.overallAccuracy }}%
              </td>
              <td :class="[TBL.td, TREND_TONE[p.trendLabel]]">
                {{ p.trendLabel }} ({{ signedPct(p.trend) }})
              </td>
              <td :class="[TBL.td, 'font-mono']">{{ plain(p.consistency) }}%</td>
              <td :class="TBL.td">{{ p.predictedGrade }}</td>
              <td :class="[TBL.td, 'font-mono']">{{ p.predictedGps }}</td>
              <td :class="TBL.td">
                <span :class="['rounded-full px-2 py-0.5 text-xs font-bold', riskTone(p.risk)]">{{
                  riskLabel(p.risk)
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </DarkModal>
</template>
