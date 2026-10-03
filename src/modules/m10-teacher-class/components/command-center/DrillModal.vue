<script setup lang="ts">
/**
 * `#drillModal` (FR-M10-19, FN-M10-2.2.7): "Memuatkan..." / "Memuatkan data...", then the response title
 * (DV-M10-04) and the table of the type, the "vs" cards of kirk t2-t4, or "Tiada data". A row with a student
 * id opens the mounted M17 student page in a new tab.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchCommandCenterDrill } from '../../api/command-center'
import type { CcDrillType } from '../../api/command-center-types'
import { useOpenTab } from './composables'
import { plain, S2_COPY, studentPath, TBL } from './copy'
import DarkModal from './DarkModal.vue'
import { drillTable } from './drill-table'
import StatCards from './StatCards.vue'

const props = defineProps<{ type: CcDrillType; filter?: string; label: string }>()
defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) =>
  fetchCommandCenterDrill(props.type, props.filter, { signal }),
)
const openTab = useOpenTab()

const title = computed(
  () => data.value?.title ?? (error.value ? props.label : S2_COPY.loadingTitle),
)
const table = computed(() => (data.value ? drillTable(props.type, data.value.students) : null))
const extra = computed(() => data.value?.extra)
const vsCards = computed(() => {
  const e = extra.value
  if (!e) return []
  return [
    { label: 'Ketepatan Kini', value: `${plain(e.accuracyNow)}%` },
    { label: 'Ketepatan Lepas', value: `${plain(e.accuracyPrev)}%` },
    {
      label: 'Perubahan',
      value: `${e.accuracyChange > 0 ? '+' : ''}${plain(e.accuracyChange)}%`,
      tone: e.accuracyChange < 0 ? 'text-rose-400' : 'text-emerald-400',
    },
    { label: 'Jawapan Kini', value: String(e.answersNow) },
    { label: 'Jawapan Lepas', value: String(e.answersPrev) },
    { label: 'Aktif Kini (30h)', value: String(e.activeNow) },
    { label: 'Aktif Lepas (30h)', value: String(e.activePrev) },
    { label: 'Pelajar Baru', value: String(e.newStudents) },
  ]
})
const errorText = computed(() => (error.value ? `Ralat: ${error.value.message}` : ''))
</script>

<template>
  <DarkModal :title="title" testid="cc-drill-modal" wide @close="$emit('close')">
    <p v-if="error" class="text-sm text-rose-400" data-testid="cc-drill-error">{{ errorText }}</p>
    <p v-else-if="!data" class="text-sm text-slate-300" data-testid="cc-drill-loading">
      {{ S2_COPY.loadingBody }}
    </p>
    <template v-else>
      <template v-if="extra">
        <p
          v-if="data.vsLabel"
          class="mb-2 text-sm font-semibold text-slate-300"
          data-testid="cc-drill-vs-label"
        >
          {{ data.vsLabel }}
        </p>
        <StatCards :cards="vsCards" />
      </template>
      <div v-if="table && table.rows.length" :class="TBL.wrap" data-testid="cc-drill-table-wrap">
        <table :class="TBL.table" data-testid="cc-drill-table">
          <thead>
            <tr>
              <th v-for="h in table.headers" :key="h" :class="TBL.th">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in table.rows"
              :key="i"
              :class="[TBL.row, row.studentId !== undefined ? TBL.link : '']"
              data-testid="cc-drill-row"
              @click="row.studentId !== undefined && openTab(studentPath(row.studentId))"
            >
              <td
                v-for="(cell, j) in row.cells"
                :key="j"
                :class="[TBL.td, cell.tone, cell.mono ? 'font-mono' : '']"
              >
                {{ cell.text }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!extra" class="text-base text-slate-50" data-testid="cc-drill-empty">
        {{ S2_COPY.noData }}
      </p>
    </template>
  </DarkModal>
</template>
