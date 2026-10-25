<script setup lang="ts">
/**
 * "Kelas" -> "Kelas Saya — Ringkasan Prestasi" (FR-M10-20, FN-M10-2.2.8): fetches `live-data` again, three
 * cards and the class table; a class row opens the mounted M17 class page in a new tab.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsStatRow } from '@/ds'

import { fetchCommandCenterLiveData } from '../../api/command-center'
import CcDialog from './CcDialog.vue'
import CcTable from './CcTable.vue'
import { statItems, useOpenTab } from './composables'
import { accuracyTone, classPath, levelText, S2_COPY } from './copy'
import type { DrillRow } from './drill-table'

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCommandCenterLiveData({ signal }))
const openTab = useOpenTab()
const cards = computed(() => {
  const d = data.value
  return [
    { label: 'Jumlah Pelajar', value: String(d?.totalStudentsRaw ?? 0) },
    { label: 'Aktif', value: String(d?.activeStudentsRaw ?? 0) },
    { label: 'Ketepatan', value: `${String(d?.accuracy ?? 0)}%` },
  ]
})
const HEADERS = ['#', 'Kelas', 'Tingkatan', 'Pelajar', 'Aktif', 'Ketepatan']
const rows = computed<DrillRow[]>(() =>
  (data.value?.classes ?? []).map((c, i) => ({
    studentId: c.id,
    cells: [
      { text: String(i + 1) },
      { text: c.name },
      { text: levelText(c.educationLevel) },
      { text: String(c.studentCount), mono: true },
      { text: String(c.active), mono: true },
      { text: `${String(c.accuracy)}%`, tone: accuracyTone(c.accuracy), mono: true },
    ],
  })),
)
</script>

<template>
  <CcDialog title="Kelas Saya — Ringkasan Prestasi" testid="cc-kelas-modal" @close="$emit('close')">
    <p v-if="error" class="text-body text-error">{{ S2_COPY.loadFailed }}</p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-modal-loading">
      Menganalisis prestasi guru...
    </p>
    <template v-else>
      <DsStatRow :items="statItems(cards)" prefix="cc-modal-card" :cols="3" data-testid="cc-modal-cards" />
      <CcTable
        :headers="HEADERS"
        :rows="rows"
        testid="cc-kelas-table"
        row-testid="cc-kelas-row"
        caption="Kelas Saya — Ringkasan Prestasi"
        @open="openTab(classPath($event))"
      />
    </template>
  </CcDialog>
</template>
