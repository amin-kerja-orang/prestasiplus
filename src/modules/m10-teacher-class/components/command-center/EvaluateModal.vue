<script setup lang="ts">
/**
 * "Evaluate" -> "Penilaian Auto — Penilaian Risiko Pelajar" (FR-M10-24, FN-M10-2.2.12, BR-M10-15; read-only):
 * five cards, then "Semua pelajar dalam keadaan baik! Tiada risiko dikesan." or the alert table.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsDrillTable, DsStatRow, DsStatusBadge } from '@/ds'

import { fetchCommandCenterEvaluation } from '../../api/command-center'
import type { CcEvaluation } from '../../api/command-center-types'
import CcDialog from './CcDialog.vue'
import { statItems, useOpenTab } from './composables'
import { riskLabel, riskStatus, studentPath } from './copy'

/** One student of the alert list; a mapped alias so the DS table gets an index signature. */
type Row = { [K in keyof CcEvaluation['alerts'][number]]: CcEvaluation['alerts'][number][K] }

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCommandCenterEvaluation({ signal }))
const openTab = useOpenTab()
const cards = computed(() => {
  const s = data.value?.summary
  return [
    { label: 'Jumlah Pelajar', value: String(s?.totalStudents ?? 0) },
    { label: 'Berisiko', value: String(s?.atRisk ?? 0) },
    { label: 'Kritikal', value: String(s?.critical ?? 0) },
    { label: 'Tinggi', value: String(s?.high ?? 0) },
    { label: 'Sederhana', value: String(s?.medium ?? 0) },
  ]
})
const columns: TableColumn<Row>[] = [
  { id: 'risk', header: 'Risiko' },
  { id: 'name', header: 'Pelajar' },
  { id: 'warn', header: 'Amaran' },
  { id: 'todo', header: 'Cadangan Tindakan' },
]
</script>

<template>
  <CcDialog
    title="Penilaian Auto — Penilaian Risiko Pelajar"
    testid="cc-evaluate-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-body text-error">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-modal-loading">
      Menilai semua pelajar...
    </p>
    <template v-else>
      <DsStatRow :items="statItems(cards)" prefix="cc-modal-card" :cols="5" data-testid="cc-modal-cards" />
      <p
        v-if="data.alerts.length === 0"
        class="text-body text-highlighted"
        data-testid="cc-evaluate-empty"
      >
        Semua pelajar dalam keadaan baik! Tiada risiko dikesan.
      </p>
      <div v-else data-testid="cc-evaluate-table">
        <DsDrillTable
          :data="data.alerts"
          :columns="columns"
          caption="Penilaian Auto — Penilaian Risiko Pelajar"
          @drill="(a: Row) => openTab(studentPath(a.studentId))"
        >
          <template #risk-cell="{ row }">
            <DsStatusBadge
              :status="riskStatus(row.original.riskLevel)"
              :label="riskLabel(row.original.riskLevel)"
              data-testid="cc-risk"
            />
          </template>
          <template #name-cell="{ row }">
            <UButton
              variant="link"
              color="neutral"
              class="h-auto p-0 text-start"
              :label="row.original.name"
              data-testid="cc-evaluate-row"
              @click.stop="openTab(studentPath(row.original.studentId))"
            />
          </template>
          <template #warn-cell="{ row }">
            <div v-for="(al, i) in row.original.alerts" :key="i" class="text-body">
              {{ al.message }}
            </div>
          </template>
          <template #todo-cell="{ row }">
            <div v-for="(al, i) in row.original.alerts" :key="i" class="text-body">
              {{ al.suggestion }}
            </div>
          </template>
        </DsDrillTable>
      </div>
    </template>
  </CcDialog>
</template>
