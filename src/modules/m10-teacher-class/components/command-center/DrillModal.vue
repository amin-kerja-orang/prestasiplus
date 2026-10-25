<script setup lang="ts">
/**
 * `#drillModal` (FR-M10-19, FN-M10-2.2.7): "Memuatkan..." / "Memuatkan data...", then the response title
 * (DV-M10-04) and the table of the type, the "vs" cards of kirk t2-t4, or "Tiada data". A row with a student
 * id opens the mounted M17 student page in a new tab.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsStatRow } from '@/ds'

import { fetchCommandCenterDrill } from '../../api/command-center'
import type { CcDrillType } from '../../api/command-center-types'
import CcDialog from './CcDialog.vue'
import CcTable from './CcTable.vue'
import { statItems, useOpenTab } from './composables'
import { plain, S2_COPY, studentPath } from './copy'
import { drillTable } from './drill-table'

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
    },
    { label: 'Jawapan Kini', value: String(e.answersNow) },
    { label: 'Jawapan Lepas', value: String(e.answersPrev) },
    { label: 'Aktif Kini (30h)', value: String(e.activeNow) },
    { label: 'Aktif Lepas (30h)', value: String(e.activePrev) },
    { label: 'Pelajar Baru', value: String(e.newStudents) },
  ]
})
const errorText = computed(() => (error.value ? S2_COPY.loadFailed : ''))
</script>

<template>
  <CcDialog :title="title" testid="cc-drill-modal" wide @close="$emit('close')">
    <p v-if="error" class="text-body text-error" data-testid="cc-drill-error">{{ errorText }}</p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-drill-loading">
      {{ S2_COPY.loadingBody }}
    </p>
    <template v-else>
      <template v-if="extra">
        <p v-if="data.vsLabel" class="text-label text-toned" data-testid="cc-drill-vs-label">
          {{ data.vsLabel }}
        </p>
        <DsStatRow :items="statItems(vsCards)" prefix="cc-modal-card" :cols="4" data-testid="cc-modal-cards" />
      </template>
      <CcTable
        v-if="table && table.rows.length"
        :headers="table.headers"
        :rows="table.rows"
        testid="cc-drill-table-wrap"
        row-testid="cc-drill-row"
        :caption="title"
        @open="openTab(studentPath($event))"
      />
      <p v-else-if="!extra" class="text-body text-highlighted" data-testid="cc-drill-empty">
        {{ S2_COPY.noData }}
      </p>
    </template>
  </CcDialog>
</template>
