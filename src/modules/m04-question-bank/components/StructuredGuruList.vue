<script setup lang="ts">
/**
 * Teacher list body of "Soalan Berstruktur" (R1-GUR-44b, S6-T17): filter card (Subjek, Tingkatan, Status,
 * "Tapis"), the table that becomes one card per question below `md`, and the BM pager. The page
 * (`StructuredListPage` with `portal="guru"`) owns the data and the URL; this component only draws it.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, h } from 'vue'

import {
  DsBadge,
  DsCluster,
  DsDataTable,
  DsFilterBar,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsRowActions,
  DsStack,
  DsStatusBadge,
  DsText,
  type CardField,
  type DsStatus,
  type RowAction,
} from '@/ds'

import { GURU_STRUCTURED_ROUTES } from '../lib/audit-routes'
import {
  GURU_APPLY_LABEL,
  GURU_STATUS_FILTER_OPTIONS,
  GURU_VIEW_ICON,
} from '../lib/structured-options'
import { LOAD_ERROR } from '../lib/ui-errors'

export interface GuruTableRow extends Record<string, unknown> {
  id: number
  number: number
  textExcerpt: string
  levelName: string
  subjectName: string
  kbat: string
  subCount: number
  marks: string
  status: string
  statusKey: string
}

const props = defineProps<{
  rows: GuruTableRow[]
  subjects: { id: number; name: string }[]
  levels: { id: number; name: string }[]
  loading: boolean
  failed: boolean
  total: number
  pageSize: number
  totalPages: number
  /** "Menunjukkan a hingga b daripada n keputusan"; empty when there is nothing to show. */
  summary: string
  activeCount: number
}>()
const subjectId = defineModel<string>('subject', { required: true })
const levelId = defineModel<string>('level', { required: true })
const status = defineModel<string>('status', { required: true })
const page = defineModel<number>('page', { required: true })
defineEmits<{ apply: []; retry: [] }>()

const viewAction = (id: number): RowAction[] => [
  {
    label: 'Lihat',
    icon: GURU_VIEW_ICON,
    to: { name: GURU_STRUCTURED_ROUTES.detail, params: { id } },
    testid: 'structured-view',
  },
]

const columns: TableColumn<GuruTableRow>[] = [
  { accessorKey: 'number', header: '#' },
  { accessorKey: 'textExcerpt', header: 'Soalan' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'kbat', header: 'KBAT' },
  { accessorKey: 'subCount', header: 'Sub' },
  { accessorKey: 'marks', header: 'Markah' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: () => h('span', { class: 'sr-only' }, 'Lihat') },
]
const cardFields: CardField[] = [
  { key: 'levelName', label: 'Tingkatan' },
  { key: 'subjectName', label: 'Subjek' },
  { key: 'kbat', label: 'KBAT' },
  { key: 'subCount', label: 'Sub' },
  { key: 'marks', label: 'Markah' },
  { key: 'status', label: 'Status' },
]

const STATUS: Record<string, DsStatus> = {
  approved: 'approved',
  review: 'awaiting-review',
}

/** A window of up to five page numbers around the current page. */
const pageNumbers = computed(() => {
  const first = Math.max(1, Math.min(page.value - 2, props.totalPages - 4))
  const last = Math.min(props.totalPages, first + 4)
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
})

const showPager = computed(() => props.total > props.pageSize)
</script>

<template>
  <DsFilterBar
    :active-count="activeCount"
    :show-reset="false"
    :apply-label="GURU_APPLY_LABEL"
    data-testid="structured-filter"
    @apply="$emit('apply')"
  >
    <DsFormField v-slot="{ id }" native for="structured-subject" label="Subjek">
      <DsNativeSelect :id="id" v-model="subjectId" data-testid="structured-subject">
        <option value="">Semua</option>
        <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </DsNativeSelect>
    </DsFormField>
    <DsFormField v-slot="{ id }" native for="structured-level" label="Tingkatan">
      <DsNativeSelect :id="id" v-model="levelId" data-testid="structured-level">
        <option value="">Semua</option>
        <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
      </DsNativeSelect>
    </DsFormField>
    <DsFormField v-slot="{ id }" native for="structured-status" label="Status">
      <DsNativeSelect :id="id" v-model="status" data-testid="structured-status">
        <option value="">Semua</option>
        <option v-for="o in GURU_STATUS_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </DsNativeSelect>
    </DsFormField>
  </DsFilterBar>

  <DsLoadError
    v-if="failed"
    :message="LOAD_ERROR"
    testid="structured-error"
    retry-testid="structured-retry"
    @retry="$emit('retry')"
  />

  <DsStack v-else gap="sm" data-testid="structured-footer-wrap">
    <DsDataTable
      variant="flush"
      :data="rows"
      :columns="columns"
      caption="Senarai soalan berstruktur"
      :loading="loading"
      :total="total"
      :page-size="pageSize"
      :page="page"
      pager="none"
      card-title="textExcerpt"
      :card-fields="cardFields"
      empty-title="Tiada soalan berstruktur dijumpai."
      :filtered="activeCount > 0"
      data-testid="structured-table"
    >
      <template #empty>
        <DsText variant="body" as="span" data-testid="structured-empty">
          Tiada soalan berstruktur dijumpai.
        </DsText>
      </template>
      <template #textExcerpt-cell="{ row }">
        <DsText variant="body" wrap="anywhere">{{ row.original.textExcerpt }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="structured-level-line">
          {{ row.original.levelName }}
        </DsText>
      </template>
      <template #subjectName-cell="{ row }">
        <DsBadge v-if="row.original.subjectName" tone="neutral" :label="row.original.subjectName" />
      </template>
      <template #kbat-cell="{ row }">
        <DsBadge tone="info" :label="row.original.kbat" data-testid="structured-kbat-pill" />
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge
          :status="STATUS[row.original.statusKey] ?? 'awaiting-review'"
          :label="row.original.status"
          data-testid="structured-status-chip"
        />
      </template>
      <template #actions-cell="{ row }">
        <DsRowActions :actions="viewAction(row.original.id)" :inline="1" />
      </template>
      <template #card-actions="{ row }">
        <DsRowActions :actions="viewAction(row.id as number)" :inline="1" />
      </template>
    </DsDataTable>
    <DsStack v-if="summary" gap="sm" align="center" data-testid="structured-pager">
      <DsText variant="label" tone="muted" role="status" data-testid="structured-counter">
        {{ summary }}
      </DsText>
      <!-- DsDataTable's pager prints "Menunjukkan a-b daripada n hasil"; R1-GUR-44b needs the "keputusan" wording (DV-GUR-44b-1), so the strip is drawn here. -->
      <DsCluster v-if="showPager" as="nav" aria-label="Halaman" gap="xs" justify="center">
        <UButton
          color="neutral"
          variant="outline"
          size="xl"
          label="Sebelumnya"
          :disabled="page <= 1"
          @click="page -= 1"
        />
        <UButton
          v-for="n in pageNumbers"
          :key="n"
          :color="n === page ? 'primary' : 'neutral'"
          :variant="n === page ? 'solid' : 'outline'"
          size="xl"
          :label="String(n)"
          :aria-label="`Halaman ${n}`"
          :aria-current="n === page ? 'page' : undefined"
          @click="page = n"
        />
        <UButton
          color="neutral"
          variant="outline"
          size="xl"
          label="Seterusnya"
          :disabled="page >= totalPages"
          @click="page += 1"
        />
      </DsCluster>
    </DsStack>
  </DsStack>
</template>
