<script setup lang="ts">
/**
 * S7 headcount modal (FN-M17-5.4.9, FR-M57): "HeadCount: {subjek}", the tiles "Pelajar", "Purata TOV",
 * "Purata ETR", "Kadar Lulus" and the table "#", "Pelajar", "TOV", "ETR", "RS", "Gred" (A+/A/A- success,
 * D/E/G error, else warning). Error copy "Ralat".
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsDrillTable } from '@/ds'

import { fetchCcHeadcount } from '../../api/command-center'
import type { CcHeadcountStudent } from '../../api/command-center-types'
import { gradeTone, score2, TONE_TEXT } from './cc-format'
import CcModal from './CcModal.vue'
import CcModalStats from './CcModalStats.vue'

/** The DS table wants an index signature, which a mapped alias gives an interface. */
type Row = { [K in keyof CcHeadcountStudent]: CcHeadcountStudent[K] }

const props = defineProps<{ configId: number; subject: string }>()
const emit = defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCcHeadcount(props.configId, { signal }))

const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'Pelajar', value: String(d.totalStudents) },
    { label: 'Purata TOV', value: String(d.avgTov) },
    { label: 'Purata ETR', value: String(d.avgEtr) },
    { label: 'Kadar Lulus', value: `${String(d.passRate)}%` },
  ]
})
const columns: TableColumn<Row>[] = [
  { id: 'no', header: '#' },
  { id: 'name', header: 'Pelajar' },
  { id: 'tov', header: 'TOV' },
  { id: 'etr', header: 'ETR' },
  { id: 'rs', header: 'RS' },
  { id: 'grade', header: 'Gred' },
]
const students = computed(() => data.value?.students ?? [])
</script>

<template>
  <CcModal :title="`HeadCount: ${subject}`" testid="cc-headcount-modal" @close="emit('close')">
    <p v-if="error" class="text-body text-error" data-testid="cc-modal-error">Ralat</p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-modal-loading">
      Memuatkan...
    </p>
    <template v-else>
      <CcModalStats :stats="stats" />
      <div data-testid="cc-headcount-scroller">
        <DsDrillTable
          :data="students"
          :columns="columns"
          :caption="`HeadCount: ${subject}`"
          data-testid="cc-headcount-table"
        >
          <template #no-cell="{ row }">
            <span data-testid="cc-headcount-student">{{ row.index + 1 }}</span>
          </template>
          <template #name-cell="{ row }">{{ row.original.name }}</template>
          <template #tov-cell="{ row }"
            ><span class="tabular">{{ score2(row.original.tov) }}</span></template
          >
          <template #etr-cell="{ row }"
            ><span class="tabular">{{ score2(row.original.etr) }}</span></template
          >
          <template #rs-cell="{ row }"
            ><span class="tabular">{{ score2(row.original.rs) }}</span></template
          >
          <template #grade-cell="{ row }">
            <span :class="TONE_TEXT[gradeTone(row.original.grade)]">{{
              row.original.grade ?? '-'
            }}</span>
          </template>
        </DsDrillTable>
      </div>
    </template>
  </CcModal>
</template>
