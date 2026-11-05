<script setup lang="ts">
/** Import & Semakan, tab `Kelompok Item` (R1-ADM-Q-07): the intake batches with status, counts and filters. */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { useApi, useFlash } from '@/composables'
import { DsDataTable, DsEmptyState, DsFilterBar, DsNativeSelect, DsPage, DsStatusBadge, useConfirm, type CardField } from '@/ds'

import { bijakAdminServer } from '../../../server/client'
import { isUnavailable, UNAVAILABLE_TITLE } from '../../../server/errors'
import ImportTabs from '../components/ImportTabs.vue'
import { intakeBadge } from '../lib/intake-badge'
import { INTAKE_CSV_IMPORT_PATH, INTAKE_MANUAL_PATH, INTAKE_UPLOAD_PATH, intakeReviewPath } from '../lib/intake-routes'
import type { IntakeStatus, IntakeSummary } from '../types'

const server = bijakAdminServer()
const confirm = useConfirm()
const flash = useFlash()

const status = ref<'semua' | IntakeStatus>('semua')
const subject = ref('semua')
const search = ref('')
const applied = ref({ status: 'semua', subject: 'semua', q: '' })

const { data, error, reload } = useApi(
  () =>
    server.listIntakeBatches({
      ...(applied.value.status !== 'semua' ? { status: applied.value.status as IntakeStatus } : {}),
      ...(applied.value.subject !== 'semua' ? { subject: applied.value.subject } : {}),
      q: applied.value.q,
    }),
  () => JSON.stringify(applied.value),
)

type Row = { [K in keyof IntakeSummary]: IntakeSummary[K] }
const rows = computed<Row[]>(() => data.value ?? [])
const filtered = computed(
  () => applied.value.status !== 'semua' || applied.value.subject !== 'semua' || !!applied.value.q,
)
const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.status !== 'semua')
    out.push({ key: 'status', label: applied.value.status === 'draf' ? 'Draf' : 'Semakan' })
  if (applied.value.subject !== 'semua') out.push({ key: 'subject', label: applied.value.subject })
  if (applied.value.q) out.push({ key: 'q', label: `"${applied.value.q}"` })
  return out
})

function apply(): void {
  applied.value = { status: status.value, subject: subject.value, q: search.value.trim() }
}
function reset(): void {
  status.value = 'semua'
  subject.value = 'semua'
  search.value = ''
  apply()
}
function removeChip(key: string): void {
  if (key === 'status') status.value = 'semua'
  if (key === 'subject') subject.value = 'semua'
  if (key === 'q') search.value = ''
  apply()
}

/** Field 07-05: a batch can be cancelled only before it is ready. */
const cancellable = (row: Row): boolean =>
  row.batchStatus === 'submitted' || row.batchStatus === 'processing'

async function cancel(row: Row): Promise<void> {
  const yes = await confirm({
    message: 'Batalkan kelompok ini?',
    confirmLabel: 'Ya, Batalkan',
    cancelLabel: 'Batal',
  })
  if (!yes) return
  try {
    await server.cancelIntakeBatch(row.id)
  } catch (err) {
    flash.show({ type: 'error', message: err instanceof Error ? err.message : 'Tindakan gagal.' })
  }
  await reload()
}

const CARD_FIELDS: CardField[] = [
  { key: 'statusLabel', label: 'Status' },
  { key: 'questionCount', label: 'Bilangan Soalan' },
]
/** The card slot passes the row object. */
const asRow = (row: Record<string, unknown>): Row => row as Row

// V2 "Import & Semakan" > "Kelompok Item": Fail Sumber, Subjek, Bilangan Soalan, Disemak, Status, Semak.
const COLUMNS: TableColumn<Row>[] = [
  { id: 'fileName', header: 'Fail Sumber' },
  { id: 'subjectName', header: 'Subjek' },
  { id: 'questionCount', header: 'Bilangan Soalan' },
  { id: 'reviewed', header: 'Disemak' },
  { id: 'status', header: 'Status' },
  { id: 'open', header: '' },
]
</script>

<template>
  <DsPage
    layout="list"
    title="Import & Semakan"
    subtitle="Kertas SPM yang dimuat naik dan diekstrak."
    data-testid="intake-list-page"
  >
    <template #actions>
      <UButton
        :to="INTAKE_UPLOAD_PATH"
        icon="i-ph-upload-simple"
        size="lg"
        data-testid="intake-new"
      >
        Muat Naik Kertas
      </UButton>
      <UButton
        :to="INTAKE_MANUAL_PATH"
        icon="i-ph-pencil-simple-line"
        size="lg"
        variant="outline"
        color="neutral"
        data-testid="intake-manual"
      >
        Tulis Soalan Manual
      </UButton>
      <UButton
        :to="INTAKE_CSV_IMPORT_PATH"
        icon="i-ph-file-csv"
        size="lg"
        variant="outline"
        color="neutral"
        data-testid="intake-csv"
      >
        Import CSV
      </UButton>
    </template>

    <template #tabs>
      <ImportTabs />
    </template>

    <DsFilterBar
      :chips="chips"
      :active-count="chips.length"
      data-testid="intake-filter"
      @apply="apply"
      @reset="reset"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="search"
          type="search"
          placeholder="Cari nama fail atau sumber"
          icon="i-ph-magnifying-glass"
          aria-label="Cari nama fail atau sumber"
          class="w-full"
        />
      </template>
      <DsNativeSelect v-model="status" aria-label="Status">
        <option value="semua">Semua status</option>
        <option value="draf">Draf</option>
        <option value="semakan">Semakan</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="subject" aria-label="Subjek">
        <option value="semua">Semua subjek</option>
        <option v-for="s in server.subjects()" :key="s.code" :value="s.code">{{ s.name }}</option>
      </DsNativeSelect>
    </DsFilterBar>

    <DsEmptyState v-if="isUnavailable(error)" :title="UNAVAILABLE_TITLE" data-testid="unavailable-state" />
    <DsDataTable
      v-else
      :data="rows"
      :columns="COLUMNS"
      variant="flush"
      caption="Kelompok item"
      :page-size="20"
      card-title="title"
      :card-fields="CARD_FIELDS"
      :loading="data === null && error === null"
      :error="error ? 'Tidak dapat memuatkan kelompok item.' : undefined"
      :filtered="filtered"
      empty-title="Tiada kelompok item lagi."
      data-testid="intake-table"
      @retry="reload"
    >
      <template #fileName-cell="{ row }">
        <UButton :to="intakeReviewPath(row.original.id)" variant="link" color="primary">
          <UBadge
            v-if="row.original.sourceKind === 'manual'"
            variant="subtle"
            color="primary"
            data-testid="source-manual"
          >
            Manual
          </UBadge>
          <template v-else>{{ row.original.fileName }}</template>
        </UButton>
      </template>
      <template #subjectName-cell="{ row }">
        {{ row.original.subjectName }}
        <span class="text-muted">· Kertas {{ row.original.kertas }}</span>
      </template>
      <template #questionCount-cell="{ row }">
        <span class="tabular" data-testid="batch-count">{{ row.original.questionCount }}</span>
      </template>
      <template #reviewed-cell="{ row }">
        <span class="tabular" data-testid="batch-reviewed">{{ row.original.reviewedCount ?? '-' }}</span>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge
          v-bind="intakeBadge(row.original)"
          data-testid="batch-status"
        />
      </template>
      <template #open-cell="{ row }">
        <UButton
          :to="intakeReviewPath(row.original.id)"
          variant="outline"
          color="neutral"
          :aria-label="`Buka ${row.original.title}`"
        >
          Semak
        </UButton>
        <UButton
          v-if="cancellable(row.original)"
          type="button"
          variant="ghost"
          color="error"
          data-testid="batch-cancel"
          @click="cancel(row.original)"
        >
          Batalkan
        </UButton>
      </template>
      <template #card-actions="{ row }">
        <UButton :to="intakeReviewPath(asRow(row).id)" variant="outline" color="neutral">
          Semak
        </UButton>
        <UButton
          v-if="cancellable(asRow(row))"
          type="button"
          variant="ghost"
          color="error"
          data-testid="batch-cancel"
          @click="cancel(asRow(row))"
        >
          Batalkan
        </UButton>
      </template>
    </DsDataTable>
  </DsPage>
</template>
