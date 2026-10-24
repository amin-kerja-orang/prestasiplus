<script setup lang="ts">
/**
 * Baris Gilir Semakan (`/admin/spm/semakan`): questions waiting for review, filtered by subject,
 * kertas and type. A row opens the review workspace.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import {
  DsDataTable,
  DsFilterBar,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsStatRow,
  DsStatusBadge,
  type StatItem,
} from '@/ds'

import RichText from '../../components/RichText.vue'
import type { QuestionStatus, QueueItem } from '../../domain/admin-types'
import { bijakServer } from '../../server/client'
import {
  ADMIN_ROUTES,
  CONFIDENCE_LABEL,
  KERTAS_ITEMS,
  KIND_ITEMS,
  KIND_LABEL,
  STATUS_BADGE,
  ageText,
  emptyCopy,
} from './ui'

type Row = QueueItem & Record<string, unknown>

const server = bijakServer()
const router = useRouter()
const subjects = server.subjects()
const draft = reactive<{
  subject: string
  kertas: string
  kind: string
  status: QuestionStatus | 'semua'
}>({
  subject: '',
  kertas: '',
  kind: '',
  status: 'semakan',
})
const applied = ref({ ...draft })

const { data, error, loading, reload } = useApi(
  () =>
    server.listReviewQueue({
      subject: applied.value.subject || undefined,
      kertas: applied.value.kertas ? Number(applied.value.kertas) : undefined,
      kind: (applied.value.kind || undefined) as QueueItem['kind'] | undefined,
      status: applied.value.status,
    }),
  applied,
)

const rows = computed(() => (data.value?.items ?? []) as Row[])
const counts = computed(() => data.value?.counts)
const activeCount = computed(
  () => [applied.value.subject, applied.value.kertas, applied.value.kind].filter(Boolean).length,
)
/** The queue is only "empty" when nothing is filtered; otherwise say that nothing matched. */
const emptyText = computed(() => emptyCopy(activeCount.value > 0, applied.value.status))
const chips = computed(() => [
  ...(applied.value.subject
    ? [
        {
          key: 'subject',
          label: subjects.find((s) => s.code === applied.value.subject)?.name ?? '',
        },
      ]
    : []),
  ...(applied.value.kertas ? [{ key: 'kertas', label: `Kertas ${applied.value.kertas}` }] : []),
  ...(applied.value.kind
    ? [{ key: 'kind', label: KIND_LABEL[applied.value.kind as keyof typeof KIND_LABEL] }]
    : []),
])

function apply(): void {
  applied.value = { ...draft }
}
function reset(): void {
  Object.assign(draft, { subject: '', kertas: '', kind: '' })
  apply()
}
function removeChip(key: string): void {
  ;(draft as Record<string, string>)[key] = ''
  apply()
}
watch(
  () => draft.status,
  () => apply(),
)

const stats = computed<StatItem[]>(() => [
  {
    key: 'semakan',
    label: 'Menunggu',
    value: counts.value?.semakan ?? 0,
    icon: 'clock',
    active: draft.status === 'semakan',
    onClick: () => (draft.status = 'semakan'),
  },
  {
    key: 'draf',
    label: 'Pembetulan',
    value: counts.value?.draf ?? 0,
    icon: 'arrow-u-up-left',
    active: draft.status === 'draf',
    onClick: () => (draft.status = 'draf'),
  },
  {
    key: 'ditolak',
    label: 'Ditolak',
    value: counts.value?.ditolak ?? 0,
    icon: 'x-circle',
    active: draft.status === 'ditolak',
    onClick: () => (draft.status = 'ditolak'),
  },
])

const columns: TableColumn<Row>[] = [
  { accessorKey: 'preview', header: 'Soalan' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'kind', header: 'Jenis' },
  { accessorKey: 'marks', header: 'Markah' },
  { accessorKey: 'ageDays', header: 'Usia' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]

function open(row: Row): void {
  void router.push({ name: ADMIN_ROUTES.reviewItem, params: { key: row.key } })
}
</script>

<template>
  <DsPage layout="list" data-testid="review-queue-page">
    <template #subtitle>
      <p class="text-body text-muted">
        Semak soalan yang dimuat naik: lulus untuk diterbitkan, tolak atau minta pembetulan.
      </p>
    </template>

    <DsStatRow
      :items="stats"
      density="compact"
      :cols="3"
      aria-label="Ringkasan baris gilir"
      prefix="queue-stat"
    />

    <DsFilterBar
      :chips="chips"
      :active-count="activeCount"
      data-testid="queue-filter"
      @apply="apply"
      @reset="reset"
      @remove-chip="removeChip"
    >
      <DsNativeSelect
        v-model="draft.subject"
        aria-label="Subjek"
        class="md:w-48"
        data-testid="queue-subject"
      >
        <option value="">Semua subjek</option>
        <option v-for="s in subjects" :key="s.code" :value="s.code">{{ s.name }}</option>
      </DsNativeSelect>
      <DsNativeSelect
        v-model="draft.kertas"
        aria-label="Kertas"
        class="md:w-40"
        data-testid="queue-kertas"
      >
        <option v-for="o in KERTAS_ITEMS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </DsNativeSelect>
      <DsNativeSelect
        v-model="draft.kind"
        aria-label="Jenis soalan"
        class="md:w-44"
        data-testid="queue-kind"
      >
        <option v-for="o in KIND_ITEMS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsLoadError v-if="error" message="Tidak dapat memuatkan baris gilir." @retry="reload()" />
    <DsDataTable
      v-else
      :data="rows"
      :columns="columns"
      caption="Baris gilir semakan"
      variant="flush"
      density="compact"
      :loading="loading && !data"
      :filtered="activeCount > 0"
      :empty-title="emptyText.title"
      :empty-description="emptyText.description"
      card-title="previewPlain"
      :card-fields="[
        { key: 'subjectName', label: 'Subjek' },
        { key: 'marks', label: 'Markah' },
      ]"
      :page-size="20"
      row-key="key"
      data-testid="queue-table"
      @row-click="open"
    >
      <template #preview-cell="{ row }">
        <div class="flex min-w-0 flex-col gap-1">
          <span class="line-clamp-2 text-body text-default"
            ><RichText :text="row.original.preview"
          /></span>
          <span class="flex flex-wrap gap-1">
            <UBadge v-if="row.original.groupId" color="info" variant="subtle" icon="i-ph-image">
              Kumpulan {{ row.original.questionIds.length }} soalan
            </UBadge>
            <UBadge
              v-if="row.original.isRevision"
              color="secondary"
              variant="subtle"
              icon="i-ph-git-branch"
            >
              Versi {{ row.original.version }}
            </UBadge>
            <UBadge color="neutral" variant="subtle">{{
              CONFIDENCE_LABEL[row.original.confidence]
            }}</UBadge>
            <span class="text-caption text-muted">{{ row.original.source }}</span>
          </span>
        </div>
      </template>
      <template #subjectName-cell="{ row }">
        {{ row.original.subjectName }} · K{{ row.original.kertas }}
      </template>
      <template #kind-cell="{ row }">{{ KIND_LABEL[row.original.kind] }}</template>
      <template #ageDays-cell="{ row }">{{ ageText(row.original.ageDays) }}</template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="STATUS_BADGE[row.original.status]" />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          size="sm"
          icon="i-ph-eye"
          label="Semak"
          class="min-h-11"
          :data-testid="`queue-open-${row.original.key}`"
          :to="{ name: ADMIN_ROUTES.reviewItem, params: { key: row.original.key } }"
        />
      </template>
    </DsDataTable>
  </DsPage>
</template>
