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
  DsEmptyState,
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
import DskpFilterFields from './DskpFilterFields.vue'
import {
  appliedDskp,
  dskpChips,
  dskpServerFilter,
  emptyDskpFilter,
  removeDskpChip,
  tpCardText,
  type AppliedDskp,
  type DskpFilterDraft,
} from './dskp-filter'
import TagBadges from './TagBadges.vue'
import {
  ADMIN_ROUTES,
  CONFIDENCE_LABEL,
  KERTAS_ITEMS,
  KIND_ITEMS,
  KIND_LABEL,
  STATUS_BADGE,
  ageText,
} from './ui'
import { useDskpFilter } from './use-dskp-filter'

type Row = QueueItem & Record<string, unknown>

const server = bijakServer()
const router = useRouter()
// The 13 catalogue subjects (AC-03.1); papers and Jana Kertas keep the blueprint list.
const subjects = server.tagSubjects()
interface QueueDraft extends DskpFilterDraft {
  subject: string
  kertas: string
  kind: string
  status: QuestionStatus | 'semua'
}
const draft = reactive<QueueDraft>({
  subject: '',
  kertas: '',
  kind: '',
  status: 'semakan',
  ...emptyDskpFilter(),
})
// The same five curriculum filters as the bank (without "Perlu semakan tag"): Unit and SP options
// come from the catalogue of the chosen subject, and the clearing rules run as a field changes.
const catalogue = useDskpFilter(draft)
const snapshot = (): QueueDraft & AppliedDskp => ({
  ...draft,
  ...appliedDskp(draft, catalogue.view.value),
})
const applied = ref(snapshot())

const { data, error, loading, reload } = useApi(
  () =>
    server.listReviewQueue({
      subject: applied.value.subject || undefined,
      kertas: applied.value.kertas ? Number(applied.value.kertas) : undefined,
      kind: (applied.value.kind || undefined) as QueueItem['kind'] | undefined,
      status: applied.value.status,
      ...dskpServerFilter(applied.value),
    }),
  applied,
)

const rows = computed(() => (data.value?.items ?? []) as Row[])
const counts = computed(() => data.value?.counts)
const questions = computed(() => data.value?.questions)
/** "6 item · 7 soalan": the bank counts questions, the queue counts items (a group is one item). */
const tileSub = (st: QuestionStatus): string =>
  `${counts.value?.[st] ?? 0} item · ${questions.value?.[st] ?? 0} soalan`
const curriculumChips = computed(() => dskpChips(applied.value))
const activeCount = computed(
  () =>
    [applied.value.subject, applied.value.kertas, applied.value.kind].filter(Boolean).length +
    curriculumChips.value.length,
)
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
  ...curriculumChips.value,
])

function apply(): void {
  applied.value = snapshot()
}
function reset(): void {
  Object.assign(draft, { subject: '', kertas: '', kind: '', ...emptyDskpFilter() })
  apply()
}
function removeChip(key: string): void {
  if (curriculumChips.value.some((c) => c.key === key)) removeDskpChip(draft, key)
  else (draft as unknown as Record<string, string>)[key] = ''
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
    sub: tileSub('semakan'),
    icon: 'clock',
    active: draft.status === 'semakan',
    onClick: () => (draft.status = 'semakan'),
  },
  {
    key: 'draf',
    label: 'Pembetulan',
    value: counts.value?.draf ?? 0,
    sub: tileSub('draf'),
    icon: 'arrow-u-up-left',
    active: draft.status === 'draf',
    onClick: () => (draft.status = 'draf'),
  },
  {
    key: 'ditolak',
    label: 'Ditolak',
    value: counts.value?.ditolak ?? 0,
    sub: tileSub('ditolak'),
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
      :loading="loading && !data"
      density="compact"
      :cols="3"
      aria-label="Ringkasan baris gilir"
      prefix="queue-stat"
    />

    <DsFilterBar
      :chips="chips"
      :active-count="activeCount"
      :more-count="curriculumChips.length"
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
      <template #more>
        <DskpFilterFields
          v-model:form-origin="draft.formOrigin"
          v-model:unit-id="draft.unitId"
          v-model:sp-id="draft.spId"
          v-model:tp="draft.tp"
          v-model:kbat="draft.kbat"
          prefix="queue"
          :subject="draft.subject"
          :view="catalogue.view.value"
          :loading="catalogue.loading.value"
          :error="catalogue.error.value !== undefined"
          @retry="catalogue.retry()"
        />
      </template>
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
      card-title="previewPlain"
      :card-fields="[
        { key: 'subjectName', label: 'Subjek', cell: true },
        { key: 'marks', label: 'Markah' },
        { key: 'ageDays', label: 'Usia', cell: true },
        { key: 'topic', label: 'Unit', cell: true, wide: true },
        { key: 'spCodes', label: 'SP', cell: true },
        { key: 'tp', label: 'TP', cell: true },
        { key: 'status', label: 'Status', cell: true, wide: true },
      ]"
      :page-size="20"
      row-key="key"
      data-testid="queue-table"
      @row-click="open"
    >
      <template #preview-cell="{ row }">
        <div class="flex min-w-48 flex-col gap-1 whitespace-normal">
          <span class="line-clamp-2 text-body text-default"
            ><RichText :text="row.original.preview"
          /></span>
          <TagBadges :tag="row.original">
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
          </TagBadges>
        </div>
      </template>
      <template #subjectName-cell="{ row }">
        <span class="block whitespace-normal"
          >{{ row.original.subjectName }} · K{{ row.original.kertas }}</span
        >
      </template>
      <template #kind-cell="{ row }">{{ KIND_LABEL[row.original.kind] }}</template>
      <template #ageDays-cell="{ row }">{{ ageText(row.original.ageDays) }}</template>
      <!-- Card field only: the table shows the unit as a badge in the Soalan cell. -->
      <template #topic-cell="{ row }">
        <span class="block whitespace-normal">{{ row.original.topic || '-' }}</span>
      </template>
      <template #spCodes-cell="{ row }">
        <span class="block whitespace-normal">{{ row.original.spCodes.join(', ') || '-' }}</span>
      </template>
      <template #tp-cell="{ row }">
        <span class="block whitespace-normal">{{ tpCardText(row.original) || '-' }}</span>
      </template>
      <template #empty>
        <DsEmptyState
          v-if="activeCount > 0"
          size="sm"
          title="Tiada soalan dijumpai"
          filtered
          @reset="reset"
        />
        <DsEmptyState
          v-else
          size="sm"
          title="Baris gilir kosong"
          description="Tiada soalan menunggu semakan."
        />
      </template>
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
      <template #card-title="{ row }">
        <RichText :text="row.preview" />
      </template>
      <template #card-actions="{ row }">
        <UButton
          size="sm"
          icon="i-ph-eye"
          label="Semak"
          class="min-h-11"
          :data-testid="`queue-open-${row.key}`"
          :to="{ name: ADMIN_ROUTES.reviewItem, params: { key: row.key } }"
        />
      </template>
    </DsDataTable>
  </DsPage>
</template>
