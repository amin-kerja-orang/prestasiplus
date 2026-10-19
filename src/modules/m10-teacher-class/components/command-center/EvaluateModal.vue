<script setup lang="ts">
/**
 * "Evaluate" -> "Auto Evaluate — Penilaian Risiko Pelajar" (FR-M10-24, FN-M10-2.2.12, BR-M10-15; read-only):
 * five cards, then "Semua pelajar dalam keadaan baik! Tiada risiko dikesan." or the alert table.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsDrillTable, DsStatRow, DsStatusBadge, DsText } from '@/ds'

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
    title="Auto Evaluate — Penilaian Risiko Pelajar"
    testid="cc-evaluate-modal"
    wide
    @close="$emit('close')"
  >
    <DsText v-if="error" variant="body" tone="error">Ralat: {{ error.message }}</DsText>
    <DsText v-else-if="!data" variant="body" tone="muted" data-testid="cc-modal-loading">
      Menilai semua pelajar...
    </DsText>
    <template v-else>
      <DsStatRow
        :items="statItems(cards)"
        prefix="cc-modal-card"
        :cols="5"
        data-testid="cc-modal-cards"
      />
      <DsText
        v-if="data.alerts.length === 0"
        variant="body"
        tone="highlighted"
        data-testid="cc-evaluate-empty"
      >
        Semua pelajar dalam keadaan baik! Tiada risiko dikesan.
      </DsText>
      <div v-else data-testid="cc-evaluate-table">
        <DsDrillTable
          :data="data.alerts"
          :columns="columns"
          caption="Auto Evaluate — Penilaian Risiko Pelajar"
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
            <DsText v-for="(al, i) in row.original.alerts" :key="i" variant="body" as="div">
              {{ al.message }}
            </DsText>
          </template>
          <template #todo-cell="{ row }">
            <DsText v-for="(al, i) in row.original.alerts" :key="i" variant="body" as="div">
              {{ al.suggestion }}
            </DsText>
          </template>
        </DsDrillTable>
      </div>
    </template>
  </CcDialog>
</template>
