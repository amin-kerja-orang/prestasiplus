<script setup lang="ts">
/**
 * S6 `/cikgu/pbd` PBD auto-tag review queue (FR-M13-57..67, 70; URS FT-M13-5.1..5.3). Two separate
 * forms: the rollup form in the page header and `#bulk-form` around the table (no form nested in
 * it). "Pilih semua" ticks every row of the page; "Lulus pukal" approves the ticked rows. No confirm
 * and no flash message anywhere.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsDataTable, DsNativeSelect, DsPage, DsPanel, type CardField, DsLoadError } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { bulkApprovePbd, downloadPbdCsv, fetchCikguClasses, fetchPbdQueue, rollupPbd } from '../api'
import { PBD_COPY as C } from '../components/teacher/copy'
import { errorLines, pageOf } from '../components/teacher/lib'

interface Row extends Record<string, unknown> {
  id: number
  studentName: string
  sp: string
  skor: string
  tp: string
  action: string
}

const route = useRoute()
const router = useRouter()
const page = computed(() => pageOf(route.query.page))

const { data, error, reload } = useApi((signal) => fetchPbdQueue(page.value, { signal }), page)
const { data: classes } = useApi((signal) => fetchCikguClasses({ signal }))

const classId = ref('')
const working = ref(false)
const actionErrors = ref<string[]>([])
/** Ids of the ticked rows; emptied after an action or a page change. */
const selected = ref<number[]>([])

const rows = computed<Row[]>(() =>
  (data.value?.data ?? []).map((r) => ({
    id: r.id,
    studentName: r.studentName,
    sp: r.sp,
    skor: `${r.skor.toFixed(1)}%`,
    tp: `TP${String(r.tp)}`,
    action: '-',
  })),
)
const allSelected = computed(
  () => rows.value.length > 0 && selected.value.length === rows.value.length,
)
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value)

const columns: TableColumn<Row>[] = [
  { id: 'select', header: '' },
  { accessorKey: 'studentName', header: C.headers[0] },
  { accessorKey: 'sp', header: C.headers[1] },
  { accessorKey: 'skor', header: C.headers[2] },
  { accessorKey: 'tp', header: C.headers[3] },
  { accessorKey: 'action', header: C.headers[4] },
]
const cardFields: CardField[] = [
  { key: 'sp', label: C.headers[1] },
  { key: 'skor', label: C.headers[2] },
  { key: 'tp', label: C.headers[3] },
]

function isSelected(id: number): boolean {
  return selected.value.includes(id)
}
function toggle(id: number, on: boolean): void {
  selected.value = on
    ? [...selected.value.filter((n) => n !== id), id]
    : selected.value.filter((n) => n !== id)
}
function selectAll(on: boolean | 'indeterminate'): void {
  selected.value = on === true ? rows.value.map((r) => r.id) : []
}

function goToPage(next: number): void {
  selected.value = []
  void router.push({ path: '/cikgu/pbd', query: { page: String(next) } })
}

async function refreshQueue(): Promise<void> {
  selected.value = []
  await reload()
}

async function onRollup(): Promise<void> {
  if (working.value) return
  working.value = true
  actionErrors.value = []
  try {
    await rollupPbd(classId.value === '' ? null : Number(classId.value))
    classId.value = ''
    await refreshQueue()
  } catch (err) {
    actionErrors.value = errorLines(err, C.actionFailed)
  } finally {
    working.value = false
  }
}

async function onBulk(): Promise<void> {
  if (working.value) return
  working.value = true
  actionErrors.value = []
  try {
    await bulkApprovePbd([...selected.value])
    await refreshQueue()
  } catch (err) {
    actionErrors.value = errorLines(err, C.actionFailed)
  } finally {
    working.value = false
  }
}

async function onExport(event: MouseEvent): Promise<void> {
  // Mock limitation: a modified click skips this interceptor (the browser follows the link itself).
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  try {
    const file = await downloadPbdCsv()
    saveBlob(file.blob, file.filename ?? C.exportFile)
  } catch (err) {
    actionErrors.value = errorLines(err, C.actionFailed)
  }
}
</script>

<template>
  <DsPage :title="C.title" :subtitle="C.sub" data-testid="pbd-page">
    <template #actions>
      <div class="flex min-w-0 flex-wrap items-center gap-2" data-testid="pbd-toolbar">
        <form
          id="rollup-form"
          class="flex min-w-0 flex-wrap items-center gap-2"
          @submit.prevent="onRollup"
        >
          <DsNativeSelect
            v-model="classId"
            name="classroom_id"
            aria-label="Kelas untuk ringkasan"
            class="sm:w-64"
            data-testid="pbd-class"
          >
            <option value="">{{ C.classPlaceholder }}</option>
            <option v-for="c in classes ?? []" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </DsNativeSelect>
          <UButton
            type="submit"
            :disabled="working"
            icon="i-ph-magic-wand"
            class="min-h-11"
            data-testid="pbd-rollup"
            >{{ C.rollup }}</UButton
          >
        </form>
        <UButton
          :href="C.exportHref"
          color="success"
          variant="soft"
          icon="i-ph-download-simple"
          class="min-h-11"
          data-testid="pbd-export"
          @click="onExport"
          >{{ C.exportCsv }}</UButton
        >
      </div>
    </template>

    <UAlert
      v-if="actionErrors.length > 0"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      :title="actionErrors.join(' ')"
      role="alert"
    />

    <DsLoadError
      v-if="error !== null"
      :message="C.loadFailed"
      :retry-label="C.retry"
      testid="page-error"
      retry-testid="page-retry"
      @retry="reload"
    />
    <div
      v-else-if="!(data !== null)"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="page-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </div>
    <template v-else>
      <form v-if="data" id="bulk-form" class="flex min-w-0 flex-col gap-4" @submit.prevent="onBulk">
        <DsPanel class="flex flex-wrap items-center justify-between gap-3">
          <UCheckbox
            id="select-all"
            :model-value="allSelected ? true : someSelected ? 'indeterminate' : false"
            :label="C.selectAll"
            @update:model-value="selectAll"
          />
          <UButton
            type="submit"
            :disabled="working"
            icon="i-ph-checks"
            class="min-h-11"
            data-testid="pbd-bulk"
            >{{ C.bulk }}</UButton
          >
        </DsPanel>

        <DsDataTable
          :data="rows"
          :columns="columns"
          :page="data.meta.page"
          :total="data.meta.totalItems"
          :page-size="data.meta.pageSize"
          caption="Antrian semakan PBD"
          card-title="studentName"
          :card-fields="cardFields"
          data-testid="pbd-table"
          @update:page="goToPage"
        >
          <template #empty>
            <span data-testid="pbd-empty">{{ C.empty }}</span>
          </template>
          <template #select-cell="{ row }">
            <UCheckbox
              :model-value="isSelected(row.original.id)"
              :aria-label="`Pilih ${row.original.studentName}`"
              @update:model-value="toggle(row.original.id, $event === true)"
            />
          </template>
          <template #card-actions="{ row }">
            <UCheckbox
              :model-value="isSelected(row.id)"
              :aria-label="`Pilih ${row.studentName}`"
              @update:model-value="toggle(row.id, $event === true)"
            />
          </template>
        </DsDataTable>
      </form>
    </template>
  </DsPage>
</template>
