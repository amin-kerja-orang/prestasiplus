<script setup lang="ts">
/**
 * The table of the S2 dialogs: headers and rows of text cells with a token tone, in the DS drill table. A row
 * with a student id opens that student (a link button in the first cell, so the keyboard reaches it).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsDrillTable } from '@/ds'

import type { DrillRow } from './drill-table'

const props = defineProps<{
  headers: string[]
  rows: DrillRow[]
  testid: string
  rowTestid: string
  caption?: string
}>()
const emit = defineEmits<{ open: [studentId: number] }>()

const columns = computed<TableColumn<DrillRow>[]>(() =>
  props.headers.map((header, j) => ({
    id: `c${String(j)}`,
    header,
    accessorFn: (row: DrillRow) => row.cells[j]?.text ?? '',
  })),
)
</script>

<template>
  <div class="min-w-0" :data-testid="testid">
    <DsDrillTable
      :data="rows"
      :columns="columns"
      :caption="caption"
      @drill="(row: DrillRow) => row.studentId !== undefined && emit('open', row.studentId)"
    >
      <template v-for="(_, j) in headers" :key="j" #[`c${String(j)}-cell`]="{ row }">
        <UButton
          v-if="j === 0 && row.original.studentId !== undefined"
          variant="link"
          color="neutral"
          class="h-auto p-0 text-start"
          :label="row.original.cells[j]?.text"
          :data-testid="rowTestid"
          @click.stop="emit('open', row.original.studentId)"
        />
        <span
          v-else
          :class="[row.original.cells[j]?.tone, row.original.cells[j]?.mono ? 'tabular' : '']"
          :data-testid="j === 0 ? rowTestid : undefined"
          >{{ row.original.cells[j]?.text }}</span
        >
      </template>
    </DsDrillTable>
  </div>
</template>
