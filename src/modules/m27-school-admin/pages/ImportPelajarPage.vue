<script setup lang="ts">
/**
 * R1-AS-51 `/admin-sekolah/pelajar/import` "Import Pelajar" (S6-T09, API-AS-06), opened by the button on Senarai Pelajar.
 * One card "Borang Import Pelajar": "Tingkatan" (Tingkatan 1 to 5, used when a row names no class of the school), the drop zone
 * "Senarai Pelajar" (.csv / .txt, 2 MB, columns nama, email, kelas). A chosen file is previewed at once (`dryRun`: the first 10
 * rows); "Import Pelajar" creates the valid rows as PENDING pupils (Admin Pusat approves them) and the result panel shows
 * "{a} pelajar berjaya diimport, {b} baris gagal." with the failed rows and "Muat Turun Ralat". No school picker (the school is
 * the session), no password field and no password is ever shown: the school admin uses "Tetapkan semula kata laluan" later.
 */
import { SCHOOL_ADMIN_PUPIL_IMPORT_MESSAGES as MSG, schoolPupilsImportedText } from '@pp/contract'
import type { TableColumn } from '@nuxt/ui'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { DsDataTable, DsFileField, DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsPage, DsPanel } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import {
  importSchoolPupils,
  type PupilImportLevel,
  type PupilImportResult,
} from '../api/school-admin'
import {
  errorFileName,
  errorFileOf,
  IMPORT_MAX_MB,
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATE,
  IMPORT_TEMPLATE_NAME,
  importRowsOf,
  importTypeError,
  type ImportFileRow,
  importPreviewTitle,
} from '../components/users/import-file'
import { errorLines, TINGKATAN_OPTIONS } from '../components/users/users-format'

const level = ref<PupilImportLevel | ''>('')
const file = ref<File | null>(null)
const rows = ref<ImportFileRow[]>([])
const preview = ref<PupilImportResult | null>(null)
const result = ref<PupilImportResult | null>(null)
/** The rows of the file that was imported, to name the failed ones in the result. */
const importedRows = ref<ImportFileRow[]>([])
const errors = ref<string[]>([])
const previewing = ref(false)
const submitting = ref(false)
const alertBox = ref<HTMLElement | null>(null)
let controller: AbortController | null = null

const hiddenRows = computed(() => Math.max(0, (preview.value?.rows ?? 0) - (preview.value?.preview?.length ?? 0)))
const failed = computed(() => result.value?.errors.length ?? 0)

interface PreviewTableRow extends Record<string, unknown> {
  row: number
  name: string
  email: string
  className: string
}
interface FailedTableRow extends Record<string, unknown> {
  row: number
  name: string
  message: string
}
const previewColumns: TableColumn<PreviewTableRow>[] = [
  { accessorKey: 'row', header: 'Baris' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'email', header: 'Emel' },
  { accessorKey: 'className', header: 'Kelas' },
]
const previewFields = [
  { key: 'email', label: 'Emel' },
  { key: 'className', label: 'Kelas' },
]
const failedColumns: TableColumn<FailedTableRow>[] = [
  { accessorKey: 'row', header: 'Baris' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'message', header: 'Sebab' },
]
const failedFields = [
  { key: 'row', label: 'Baris' },
  { key: 'message', label: 'Sebab' },
]
const previewRows = computed<PreviewTableRow[]>(() =>
  (preview.value?.preview ?? []).map((r) => ({ row: r.row, name: r.name, email: r.email ?? '', className: r.className ?? '' })),
)
const failedRows = computed<FailedTableRow[]>(() =>
  (result.value?.errors ?? []).map((e) => ({
    row: e.row,
    name: importedRows.value.find((r) => r.line === e.row)?.name ?? '',
    message: e.message,
  })),
)

function clearPreview(): void {
  controller?.abort()
  controller = null
  preview.value = null
  previewing.value = false
}

/** Checks that need no server, then the `dryRun` call. Any refusal shows above the form and keeps the input. */
async function loadPreview(): Promise<void> {
  clearPreview()
  errors.value = []
  const picked = file.value
  if (!picked) {
    rows.value = []
    return
  }
  const typeError = importTypeError(picked)
  if (typeError) {
    errors.value = [typeError]
    return
  }
  const current = new AbortController()
  controller = current
  previewing.value = true
  try {
    rows.value = importRowsOf(await picked.text())
    if (rows.value.length > IMPORT_MAX_ROWS) {
      errors.value = [MSG.tooManyRows]
      return
    }
    const data = await importSchoolPupils({ file: picked, level: level.value, dryRun: true, signal: current.signal })
    if (controller === current) preview.value = data
  } catch (err) {
    if (controller === current) errors.value = errorLines(err)
  } finally {
    if (controller === current) {
      previewing.value = false
      controller = null
    }
  }
}

watch([file, level], () => {
  // Choosing another file starts a new import; emptying the form after an import keeps its result on screen.
  if (file.value) result.value = null
  void loadPreview()
})
onBeforeUnmount(() => controller?.abort())

function change(): void {
  file.value = null
}

async function submit(): Promise<void> {
  if (submitting.value) return
  errors.value = []
  if (!file.value) {
    errors.value = [MSG.noFile]
    return
  }
  const picked = file.value
  const typeError = importTypeError(picked)
  if (typeError) {
    errors.value = [typeError]
    return
  }
  if (rows.value.length > IMPORT_MAX_ROWS) {
    errors.value = [MSG.tooManyRows]
    return
  }
  submitting.value = true
  try {
    const data = await importSchoolPupils({ file: picked, level: level.value, dryRun: false })
    importedRows.value = rows.value
    clearPreview()
    result.value = data
    file.value = null
    rows.value = []
    window.scrollTo?.({ top: 0 })
  } catch (err) {
    errors.value = errorLines(err)
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'center' })
  } finally {
    submitting.value = false
  }
}

function downloadTemplate(): void {
  saveBlob(new Blob([IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' }), IMPORT_TEMPLATE_NAME)
}

function downloadErrors(): void {
  if (!result.value) return
  saveBlob(
    new Blob([errorFileOf(result.value.errors, importedRows.value)], { type: 'text/csv;charset=utf-8' }),
    errorFileName(new Date()),
  )
}
</script>

<template>
  <DsPage class="max-w-3xl" data-testid="pi-page">
    <div ref="alertBox" class="empty:hidden">
      <UAlert
        v-if="errors.length"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="pi-alert"
      >
        <template #description>
          <div class="flex flex-col gap-1">
            <p v-for="m in errors" :key="m">{{ m }}</p>
          </div>
        </template>
      </UAlert>
    </div>

    <DsPanel v-if="result" data-testid="pi-result">
      <div class="flex min-w-0 flex-col gap-4">
        <div class="flex flex-col gap-1">
          <p class="text-subheading text-highlighted" role="status" data-testid="pi-result-text">
            {{ schoolPupilsImportedText(result.created, failed) }}
          </p>
          <p class="text-body text-muted" data-testid="pi-result-pending">
            {{ MSG.pendingApproval }}
          </p>
        </div>
        <template v-if="failed > 0">
          <DsDataTable
            variant="bare"
            :data="failedRows"
            :columns="failedColumns"
            caption="Baris yang gagal diimport"
            card-title="name"
            :card-fields="failedFields"
            data-testid="pi-result-table"
          />
          <div>
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-ph-download-simple"
              class="min-h-11"
              data-testid="pi-download-errors"
              @click="downloadErrors"
              >Muat Turun Ralat</UButton
            >
          </div>
        </template>
      </div>
    </DsPanel>

    <form method="post" novalidate class="flex min-w-0 flex-col gap-6" data-testid="pi-form" @submit.prevent="submit">
      <DsFormSection title="Borang Import Pelajar" icon="upload-simple" accent="action">
        <template #actions>
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            icon="i-ph-file-csv"
            class="min-h-11"
            data-testid="pi-template"
            @click="downloadTemplate"
            >Muat Turun CSV Pelajar</UButton
          >
          <UButton
            to="/panduan?peranan=admin-sekolah"
            color="neutral"
            variant="soft"
            icon="i-ph-book-open"
            class="min-h-11"
            data-testid="pi-tutorial"
            >Tutorial</UButton
          >
        </template>

        <p class="text-body text-muted" data-testid="pi-info">
          Import mencipta akaun pelajar baharu sahaja — akaun yang sudah ada tidak akan ditulis ganti atau dipadam.
          Format: nama,email dengan kolum kelas pilihan.
        </p>

        <DsFormField label="Tingkatan" hint="Digunakan jika baris tidak menyatakan kelas." name="pi-level">
          <DsNativeSelect id="pi-level" v-model="level" name="level" data-testid="pi-level">
            <option value="">— Pilihan —</option>
            <option v-for="o in TINGKATAN_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </DsNativeSelect>
        </DsFormField>

        <DsFormField label="Senarai Pelajar" name="pi-file">
          <div v-if="!file" class="min-w-0">
            <DsFileField
              v-model="file"
              accept=".csv,.txt"
              :max-size-mb="IMPORT_MAX_MB"
              preview="none"
              label="Klik untuk pilih fail atau seret & lepas di sini"
              hint=".csv atau .txt · maksimum 2 MB · lajur: nama, email, kelas"
              name="csvFile"
              data-testid="pi-file"
            />
          </div>
          <div v-else class="flex min-w-0 flex-col gap-3" data-testid="pi-chosen">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="min-w-0 break-all text-body text-highlighted" data-testid="pi-file-name">{{ file.name }}</p>
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                class="min-h-11"
                data-testid="pi-change"
                @click="change"
                >Tukar</UButton
              >
            </div>
            <DsPanel v-if="preview" tone="inset" data-testid="pi-preview">
              <div class="flex min-w-0 flex-col gap-3">
                <p class="text-label text-highlighted" data-testid="pi-preview-title">
                  {{ importPreviewTitle(preview.rows) }}
                </p>
                <DsDataTable
                  variant="bare"
                  pager="none"
                  :data="previewRows"
                  :columns="previewColumns"
                  caption="Baris fail"
                  card-title="name"
                  :card-fields="previewFields"
                />
                <p v-if="hiddenRows > 0" class="text-caption text-muted" data-testid="pi-preview-note">
                  Ini contoh sahaja. {{ hiddenRows }} baris lagi tidak dipaparkan — kesemua {{ preview.rows }} pelajar akan
                  diimport.
                </p>
              </div>
            </DsPanel>
          </div>
        </DsFormField>
      </DsFormSection>

      <DsFormBar
        :show-cancel="false"
        :submit-label="submitting ? 'Mengimport...' : 'Import Pelajar'"
        submit-icon="upload-simple"
        :saving="submitting"
        :disabled="previewing"
        data-testid="pi-footer"
      />
    </form>
  </DsPage>
</template>
