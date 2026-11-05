<script setup lang="ts">
/**
 * "Senarai Intervensi" (FN-M12-8.3.1 / 8.3.2; FR-M12-75 / 76): the empty state (icon and one line, DV-M12-01), or the
 * PROPOSED table, newest first (the API order). Staff table (`DsDataTable`: card list below md, inner scroll
 * when wide); the status is a badge with its word. Column "Semakan" (R1-GUR-11, AC-GUR-11-9): a pending row has the button
 * "Semak keputusan", disabled until 7 calendar days (Asia/Kuala_Lumpur) after the action date; a click posts the
 * review (a refusal, e.g. 409, shows its server text under the button) and `changed` makes the page reload; a
 * reviewed row reads "Ketepatan Sebelum {a}% → Selepas {b}%" (whole %, half up).
 */
import { computed, reactive, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import { isApiError } from '@/api'
import { useSession } from '@/composables/useSession'
import { DsDataTable, DsEmptyState, DsPanel, DsStack, DsText } from '@/ds'
import { formatPercent } from '@/lib/number'
import { clock, formatMyt } from '@/lib/time'

import { reviewKirkpatrickIntervention } from '../../../api'

import type { InterventionRow, WireId } from '../../../api/types'
import { dateEn, pct } from '../common/kirkpatrick-format'
import { alertLabel, moodLabel, STATUS_COLOR } from './intervention-format'

const props = defineProps<{ rows: InterventionRow[] }>()
const emit = defineEmits<{ changed: [] }>()

/** The review API answers 403 for the admin: the button is not drawn for that viewer (the result text stays). */
const { role } = useSession()
const canReview = computed(() => role.value !== 'admin')

/** Days from `YYYY-MM-DD` to today, both Asia/Kuala_Lumpur calendar days. */
const REVIEW_AFTER_DAYS = 7
function ageInDays(actionDate: string): number {
  const today = formatMyt(clock.now(), 'yyyy-MM-dd')
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${actionDate}T00:00:00Z`)) / 86_400_000)
}
/** Whole %, half up ("62%"); "—" without a value. */
const wholePercent = (v: number | null) => (v === null ? '—' : formatPercent(v, { decimals: 0 }))

const busy = reactive<Record<string, boolean>>({})
const failure = reactive<Record<string, string>>({})
async function review(id: WireId) {
  const key = String(id)
  if (busy[key]) return
  busy[key] = true
  failure[key] = ''
  try {
    await reviewKirkpatrickIntervention(id)
    emit('changed')
  } catch (e) {
    failure[key] = isApiError(e) ? e.message : 'Semakan tidak berjaya. Sila cuba lagi.'
  } finally {
    busy[key] = false
  }
}

/** Slot rows are untyped; this narrows the status for the badge colour. */
const statusColor = (status: unknown) =>
  STATUS_COLOR[status as NonNullable<InterventionRow['status']>]

/** "55.5% · Gembira" / "-" (accuracy then mood, as option labels). */
function accuracyCell(accuracy: number | null, mood: InterventionRow['beforeMood']): string {
  const parts = [accuracy === null ? null : pct(accuracy), moodLabel(mood) || null].filter(
    (p): p is string => p !== null,
  )
  return parts.length > 0 ? parts.join(' · ') : '-'
}

interface Row extends Record<string, unknown> {
  id: WireId
  date: string
  studentId: WireId
  studentName: string | null
  alert: string
  description: string
  action: string
  before: string
  after: string
  status: InterventionRow['status']
  reviewed: boolean
  result: string
  canReview: boolean
  review: string
}

const data = computed<Row[]>(() =>
  props.rows.map((r) => ({
    id: r.id,
    date: dateEn(r.actionDate),
    studentId: r.studentId,
    studentName: r.studentName,
    alert: alertLabel(r.alertType),
    description: r.alertDescription,
    action: r.actionTaken,
    before: accuracyCell(r.beforeAccuracy, r.beforeMood),
    after: accuracyCell(r.afterAccuracy, r.afterMood),
    status: r.status,
    reviewed: r.afterAccuracy !== null,
    result: `Ketepatan Sebelum ${wholePercent(r.beforeAccuracy)} → Selepas ${wholePercent(r.afterAccuracy)}`,
    canReview: ageInDays(r.actionDate) >= REVIEW_AFTER_DAYS,
    review: '',
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'date', header: 'Tarikh Tindakan' },
  { accessorKey: 'studentId', header: 'Pelajar (ID)' },
  { accessorKey: 'alert', header: 'Jenis Amaran' },
  { accessorKey: 'description', header: 'Penerangan Amaran' },
  { accessorKey: 'action', header: 'Tindakan Diambil' },
  { accessorKey: 'before', header: 'Ketepatan Sebelum (%)' },
  { accessorKey: 'after', header: 'Ketepatan Selepas (%)' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'review', header: 'Semakan' },
]
const cardFields = [
  { key: 'alert', label: 'Jenis Amaran' },
  { key: 'description', label: 'Penerangan Amaran' },
  { key: 'action', label: 'Tindakan Diambil' },
  { key: 'before', label: 'Ketepatan Sebelum (%)' },
  { key: 'after', label: 'Ketepatan Selepas (%)' },
  { key: 'status', label: 'Status' },
  { key: 'review', label: 'Semakan' },
]

/** Paged at 20 rows. */
const PAGE_SIZES = [10, 20, 50]
const pageSize = ref(20)
</script>

<template>
  <DsPanel title="Senarai Intervensi" icon="i-ph-clipboard-text" data-testid="int-list">
    <DsStack v-if="rows.length === 0" data-testid="int-empty">
      <DsEmptyState size="sm" icon="i-ph-clipboard" title="Tiada intervensi direkodkan lagi." />
    </DsStack>
    <DsDataTable
      v-else
      v-model:page-size="pageSize"
      variant="bare"
      :page-size-options="PAGE_SIZES"
      :data="data"
      :columns="columns"
      caption="Senarai intervensi"
      card-title="date"
      :card-fields="cardFields"
    >
      <template #studentId-cell="{ row }">
        <span class="flex flex-col" data-testid="int-row-student">
          <span>{{ row.original.studentId }}</span>
          <span v-if="row.original.studentName" class="text-body text-muted">{{
            row.original.studentName
          }}</span>
        </span>
      </template>
      <template #description-cell="{ row }">
        <span class="block min-w-44 whitespace-normal">{{ row.original.description }}</span>
      </template>
      <template #action-cell="{ row }">
        <span class="block min-w-44 whitespace-normal">{{ row.original.action }}</span>
      </template>
      <template #before-cell="{ row }">
        <span data-testid="int-row-before">{{ row.original.before }}</span>
      </template>
      <template #after-cell="{ row }">
        <span data-testid="int-row-after">{{ row.original.after }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          v-if="row.original.status"
          :color="statusColor(row.original.status)"
          variant="soft"
          :label="row.original.status"
          data-testid="int-row-status"
        />
      </template>
      <template #review-cell="{ row }">
        <DsStack gap="xs" align="start" data-testid="int-row-review">
          <DsText v-if="row.original.reviewed" variant="body" data-testid="int-row-result">{{
            row.original.result
          }}</DsText>
          <UButton
            v-else-if="canReview"
            type="button"
            color="neutral"
            label="Semak keputusan"
            :disabled="!row.original.canReview"
            :loading="busy[String(row.original.id)] === true"
            data-testid="int-row-review-btn"
            @click="review(row.original.id)"
          />
          <DsText
            v-if="failure[String(row.original.id)]"
            variant="body"
            tone="error"
            role="alert"
            data-testid="int-row-review-error"
            >{{ failure[String(row.original.id)] }}</DsText
          >
        </DsStack>
      </template>
    </DsDataTable>
  </DsPanel>
</template>
