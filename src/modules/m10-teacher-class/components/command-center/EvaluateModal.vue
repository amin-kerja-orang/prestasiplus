<script setup lang="ts">
/**
 * "⚠ Evaluate" -> "Auto Evaluate — Penilaian Risiko Pelajar" (FR-M10-24, FN-M10-2.2.12, BR-M10-15; read-only):
 * five cards, then "Semua pelajar dalam keadaan baik! Tiada risiko dikesan." or the alert table.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchCommandCenterEvaluation } from '../../api/command-center'
import { useOpenTab } from './composables'
import { riskLabel, riskTone, studentPath, TBL } from './copy'
import DarkModal from './DarkModal.vue'
import StatCards from './StatCards.vue'

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCommandCenterEvaluation({ signal }))
const openTab = useOpenTab()
const cards = computed(() => {
  const s = data.value?.summary
  return [
    { label: 'Jumlah Pelajar', value: String(s?.totalStudents ?? 0), tone: 'text-indigo-300' },
    { label: 'Berisiko', value: String(s?.atRisk ?? 0), tone: 'text-rose-300' },
    { label: 'Kritikal', value: String(s?.critical ?? 0), tone: 'text-rose-300' },
    { label: 'Tinggi', value: String(s?.high ?? 0), tone: 'text-orange-300' },
    { label: 'Sederhana', value: String(s?.medium ?? 0), tone: 'text-amber-300' },
  ]
})
const HEADERS = ['Risiko', 'Pelajar', 'Amaran', 'Cadangan Tindakan']
</script>

<template>
  <DarkModal
    title="Auto Evaluate — Penilaian Risiko Pelajar"
    testid="cc-evaluate-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-sm text-rose-400">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-sm text-slate-300" data-testid="cc-modal-loading">
      Menilai semua pelajar...
    </p>
    <template v-else>
      <StatCards :cards="cards" cols="grid-cols-2 sm:grid-cols-5" />
      <p
        v-if="data.alerts.length === 0"
        class="mt-4 text-base text-slate-50"
        data-testid="cc-evaluate-empty"
      >
        Semua pelajar dalam keadaan baik! Tiada risiko dikesan.
      </p>
      <div v-else :class="[TBL.wrap, 'mt-4']">
        <table :class="TBL.table" data-testid="cc-evaluate-table">
          <thead>
            <tr>
              <th v-for="h in HEADERS" :key="h" :class="TBL.th">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in data.alerts"
              :key="a.studentId"
              :class="[TBL.row, TBL.link]"
              data-testid="cc-evaluate-row"
              @click="openTab(studentPath(a.studentId))"
            >
              <td :class="TBL.td">
                <span
                  :class="['rounded-full px-2 py-0.5 text-xs font-bold', riskTone(a.riskLevel)]"
                  data-testid="cc-risk"
                  >{{ riskLabel(a.riskLevel) }}</span
                >
              </td>
              <td :class="[TBL.td, 'text-slate-50']">{{ a.name }}</td>
              <td :class="TBL.td">
                <div v-for="(al, i) in a.alerts" :key="i">{{ al.message }}</div>
              </td>
              <td :class="TBL.td">
                <div v-for="(al, i) in a.alerts" :key="i">{{ al.suggestion }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </DarkModal>
</template>
