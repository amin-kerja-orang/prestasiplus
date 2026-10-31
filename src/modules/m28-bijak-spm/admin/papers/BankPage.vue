<script setup lang="ts">
/**
 * Bank Soalan SPM (`/admin/spm/soalan`): published questions with a KPI strip by subject and
 * status, filters and a preview drawer. "Sunting" on a Terbit question creates version n+1 which
 * waits in the review queue while the live version keeps serving.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables/useApi'
import {
  DsDataTable,
  DsFilterBar,
  DsEmptyState,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStatRow,
  DsStatusBadge,
  type StatItem,
} from '@/ds'

import RichText from '../../components/RichText.vue'
import type { BankRow, QuestionStatus } from '../../domain/admin-types'
import { formatDateTime } from '../../lib/use-bijak'
import { bijakAdminServer } from '../../server/client'
import { isUnavailable, UNAVAILABLE_TITLE } from '../../server/errors'
import QuestionPreview from './QuestionPreview.vue'
import { ADMIN_ROUTES, KERTAS_ITEMS, KIND_ITEMS, KIND_LABEL, STATUS_BADGE, WIRE } from './ui'

type Row = BankRow & Record<string, unknown>

const server = bijakAdminServer()
const route = useRoute()
const subjects = server.subjects()

const draft = reactive<{
  q: string
  subject: string
  kertas: string
  kind: string
  status: QuestionStatus | 'semua'
}>({
  q: '',
  subject: '',
  kertas: '',
  kind: '',
  status: 'terbit',
})
const applied = ref({ ...draft })

const { data: stats } = useApi(() => server.bankStats())
const { data, error, loading, reload } = useApi(
  () =>
    server.listBank({
      q: applied.value.q || undefined,
      subject: applied.value.subject || undefined,
      kertas: applied.value.kertas ? Number(applied.value.kertas) : undefined,
      kind: (applied.value.kind || undefined) as BankRow['kind'] | undefined,
      status: applied.value.status,
    }),
  applied,
)
const rows = computed(() => (data.value ?? []) as Row[])

const kpi = computed<StatItem[]>(() => {
  const s = stats.value
  if (!s) return []
  return [
    {
      key: 'total',
      label: 'Jumlah soalan',
      value: s.total,
      icon: 'books',
      active: !applied.value.subject,
      onClick: () => pick(''),
    },
    ...s.bySubject.map((x) => ({
      key: x.code,
      label: x.name,
      value: x.terbit,
      sub: `${x.terbit} Terbit · ${x.semakan} menunggu semakan`,
      icon: 'book-open' as const,
      active: applied.value.subject === x.code,
      onClick: () => pick(x.code),
    })),
  ]
})

function pick(code: string): void {
  draft.subject = code
  apply()
}
function apply(): void {
  applied.value = { ...draft }
}
function reset(): void {
  Object.assign(draft, { q: '', subject: '', kertas: '', kind: '', status: 'terbit' })
  apply()
}
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
  ...(applied.value.q ? [{ key: 'q', label: `"${applied.value.q}"` }] : []),
])
function removeChip(key: string): void {
  ;(draft as Record<string, string>)[key] = ''
  apply()
}

const columns: TableColumn<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'preview', header: 'Soalan' },
  { accessorKey: 'subjectName', header: 'Subjek' },
  { accessorKey: 'kind', header: 'Jenis' },
  { accessorKey: 'marks', header: 'Markah' },
  { accessorKey: 'usedIn', header: 'Digunakan' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Tindakan' },
]

/* ----------------------------------------------------------------------- preview drawer */
// `?buka=<id>` opens the drawer (after a "Sunting" is sent for review, to show the versions).
const selectedId = ref<string | null>(
  typeof route.query.buka === 'string' ? route.query.buka : null,
)
const drawer = computed({
  get: () => selectedId.value !== null,
  set: (v: boolean) => {
    if (!v) selectedId.value = null
  },
})
const {
  data: detail,
  error: detailError,
  reload: reloadDetail,
} = useApi(
  () => (selectedId.value ? server.getBankDetail(selectedId.value) : Promise.resolve(null)),
  selectedId,
)
</script>

<template>
  <DsPage layout="list" data-testid="bank-page">
    <template #subtitle>
      <p class="text-body text-muted">
        Soalan SPM yang sudah diterbitkan. Pratonton, semak penggunaan dan sunting penuh sebagai
        versi baharu.
      </p>
    </template>
    <template #actions>
      <UButton
        icon="i-ph-seal-check"
        label="Baris Gilir Semakan"
        color="neutral"
        variant="soft"
        class="min-h-11"
        :to="{ name: ADMIN_ROUTES.review }"
      />
    </template>

    <DsStatRow
      :items="kpi"
      density="compact"
      aria-label="Ringkasan bank soalan"
      prefix="bank-stat"
    />

    <DsFilterBar
      :chips="chips"
      :active-count="chips.length"
      data-testid="bank-filter"
      @apply="apply"
      @reset="reset"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="draft.q"
          type="text"
          aria-label="Cari"
          placeholder="Cari teks, ID atau topik..."
          icon="i-ph-magnifying-glass"
          class="w-full md:min-w-64 md:flex-1"
          data-testid="bank-search"
        />
      </template>
      <DsNativeSelect
        v-model="draft.subject"
        aria-label="Subjek"
        class="md:w-44"
        data-testid="bank-subject"
      >
        <option value="">Semua subjek</option>
        <option v-for="s in subjects" :key="s.code" :value="s.code">{{ s.name }}</option>
      </DsNativeSelect>
      <DsNativeSelect
        v-if="!WIRE"
        v-model="draft.kertas"
        aria-label="Kertas"
        class="md:w-36"
        data-testid="bank-kertas"
      >
        <option v-for="o in KERTAS_ITEMS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </DsNativeSelect>
      <DsNativeSelect
        v-model="draft.kind"
        aria-label="Jenis soalan"
        class="md:w-40"
        data-testid="bank-kind"
      >
        <option v-for="o in KIND_ITEMS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </DsNativeSelect>
      <DsNativeSelect
        v-model="draft.status"
        aria-label="Status"
        class="md:w-44"
        data-testid="bank-status"
      >
        <option value="terbit">Diterbitkan</option>
        <option value="semakan">Menunggu Semakan</option>
        <option value="draf">Draf</option>
        <option value="ditolak">Ditolak</option>
        <option value="semua">Semua status</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsEmptyState v-if="isUnavailable(error)" :title="UNAVAILABLE_TITLE" data-testid="unavailable-state" />
    <DsLoadError v-else-if="error"  message="Tidak dapat memuatkan bank soalan." @retry="reload()" />
    <DsDataTable
      v-else
      :data="rows"
      :columns="columns"
      caption="Bank soalan SPM"
      variant="flush"
      density="compact"
      :loading="loading && !data"
      :filtered="chips.length > 0"
      empty-title="Tiada soalan dijumpai"
      card-title="previewPlain"
      :card-fields="[
        { key: 'subjectName', label: 'Subjek' },
        { key: 'marks', label: 'Markah' },
      ]"
      :page-size="20"
      :page-size-options="[20, 50, 100]"
      row-key="id"
      data-testid="bank-table"
      @row-click="(r: Row) => (selectedId = r.id)"
    >
      <template #id-cell="{ row }">
        <span class="text-caption text-muted">{{ row.original.id }}</span>
      </template>
      <template #preview-cell="{ row }">
        <div class="flex min-w-0 flex-col gap-1">
          <span class="line-clamp-2 text-body text-default"
            ><RichText :text="row.original.preview"
          /></span>
          <span class="flex flex-wrap gap-1">
            <UBadge color="neutral" variant="subtle">{{ row.original.topic }}</UBadge>
            <UBadge v-if="row.original.groupId" color="info" variant="subtle" icon="i-ph-image"
              >Rangsangan</UBadge
            >
            <UBadge v-if="row.original.version > 1" color="secondary" variant="subtle"
              >v{{ row.original.version }}</UBadge
            >
          </span>
        </div>
      </template>
      <template #subjectName-cell="{ row }">
        {{ row.original.subjectName
        }}<template v-if="row.original.kertas"> · K{{ row.original.kertas }}</template>
      </template>
      <template #kind-cell="{ row }">{{ KIND_LABEL[row.original.kind as keyof typeof KIND_LABEL] }}</template>
      <template #usedIn-cell="{ row }">{{ row.original.usedIn }} kertas</template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="STATUS_BADGE[row.original.status]" />
      </template>
      <template #actions-cell="{ row }">
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          icon="i-ph-eye"
          label="Pratonton"
          class="min-h-11"
          :data-testid="`bank-open-${row.original.id}`"
          @click.stop="selectedId = row.original.id"
        />
      </template>
    </DsDataTable>

    <USlideover
      v-model:open="drawer"
      title="Pratonton soalan"
      description="Soalan seperti yang disemak, dengan skema."
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <DsLoadError
          v-if="detailError"
          message="Tidak dapat memuatkan soalan."
          @retry="reloadDetail()"
        />
        <div v-else-if="detail" class="flex flex-col gap-4" data-testid="bank-drawer">
          <div class="flex flex-wrap items-center gap-2">
            <DsStatusBadge :status="STATUS_BADGE[detail.row.status]" />
            <span class="text-caption text-muted">
              {{ detail.row.subjectName
              }}<template v-if="detail.row.kertas"> · Kertas {{ detail.row.kertas }}</template> ·
              {{ KIND_LABEL[detail.row.kind] }} · {{ detail.row.marks }} markah · versi
              {{ detail.row.version }}
            </span>
          </div>
          <QuestionPreview
            :questions="[detail.question]"
            :stimulus="detail.stimulus"
            :option-bank="detail.optionBank"
          />
          <DsPanel v-if="detail.usedInPapers.length">
            <h3 class="mb-2 text-subheading text-highlighted">Digunakan dalam kertas</h3>
            <ul class="list-disc ps-5 text-body">
              <li v-for="p in detail.usedInPapers" :key="p.id">{{ p.title }}</li>
            </ul>
          </DsPanel>
          <DsPanel>
            <h3 class="mb-2 text-subheading text-highlighted">Sejarah versi</h3>
            <ol class="flex flex-col gap-1 text-caption">
              <li v-for="(h, i) in detail.history" :key="i">
                <template v-if="h.at">{{ formatDateTime(h.at) }} · </template>{{ h.by }} · v{{
                  h.version
                }}
                · <span class="font-semibold">{{ h.action }}</span>
                <template v-if="h.note"> · {{ h.note }}</template>
              </li>
            </ol>
          </DsPanel>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton
            v-if="detail && detail.row.status === 'terbit'"
            icon="i-ph-pencil-simple"
            :label="
              detail.pendingRevision ? 'Versi baharu menunggu semakan' : 'Sunting (versi baharu)'
            "
            :disabled="detail.pendingRevision"
            class="min-h-11"
            :to="{ name: ADMIN_ROUTES.bankEdit, params: { qid: detail.row.id } }"
            data-testid="bank-revise"
          />
          <UButton
            color="neutral"
            variant="ghost"
            label="Tutup"
            class="min-h-11"
            @click="selectedId = null"
          />
        </div>
      </template>
    </USlideover>
  </DsPage>
</template>
