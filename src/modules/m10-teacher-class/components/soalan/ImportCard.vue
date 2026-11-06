<script setup lang="ts">
/**
 * S21 card "Import Soalan (CSV/Excel)" (44-F3; FR-GUR-44-4, FR-GUR-44-12; API-GUR-19): "Template" downloads
 * `templat-soalan.csv`, "Import CSV" toggles the form (`.csv` only, 2 MB, 500 data rows, all checked in the browser
 * first), "Import" posts the file and reports "{a} soalan diimport, {b} baris gagal." with a Baris / Sebab table
 * (the valid rows are kept). The failed rows can be downloaded as `ralat-import-{yyyymmdd}.csv`, built here from the
 * response `errors` and the uploaded text.
 */
import { ref } from 'vue'

import { isApiError } from '@/api'
import { DsFileField, DsFormField, DsIconChip, DsPanel } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { downloadQuestionTemplate, importQuestions } from '../../api/guru'
import type { TableColumn } from '@nuxt/ui'

import type { ImportFailure, ImportResult } from '../../api/types'
import {
  buildErrorCsv,
  errorFileName,
  TEMPLATE_FALLBACK_NAME,
  validateCsvFile,
  validateCsvRows,
} from './csv-rules'
import { COPY } from './lib'

/** Result table of 44-F3: Baris · Sebab. */
const FAILURE_COLUMNS: TableColumn<ImportFailure>[] = [
  { accessorKey: 'row', header: 'Baris' },
  { accessorKey: 'message', header: 'Sebab' },
]

const emit = defineEmits<{ imported: [result: ImportResult] }>()

const open = ref(false)
const file = ref<File | null>(null)
const busy = ref(false)
const fileError = ref('')
const errors = ref<string[]>([])
const result = ref<ImportResult | null>(null)
/** The uploaded text of the last import (kept for the error file). */
const uploaded = ref('')

async function template(): Promise<void> {
  errors.value = []
  try {
    const res = await downloadQuestionTemplate()
    saveBlob(res.blob, res.filename ?? TEMPLATE_FALLBACK_NAME)
  } catch {
    errors.value = [COPY.templateFailed]
  }
}

/** Reads a file as text (`Blob.text`, else `FileReader`). */
function readText(f: Blob): Promise<string> {
  if (typeof f.text === 'function') return f.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(f)
  })
}

function onFile(value: File | File[] | null): void {
  file.value = Array.isArray(value) ? (value[0] ?? null) : value
  fileError.value = file.value ? (validateCsvFile(file.value) ?? '') : ''
}

async function submit(): Promise<void> {
  if (busy.value) return
  errors.value = []
  result.value = null
  const picked = file.value
  const bad = validateCsvFile(picked)
  if (bad || !picked) {
    fileError.value = bad ?? ''
    return
  }
  busy.value = true
  try {
    const text = await readText(picked)
    const rows = validateCsvRows(text)
    if (rows) {
      fileError.value = rows
      return
    }
    fileError.value = ''
    const res = await importQuestions(picked)
    uploaded.value = text
    result.value = res
    file.value = null
    emit('imported', res)
  } catch (err) {
    errors.value = isApiError(err) && err.fields ? Object.values(err.fields) : [COPY.saveFailed]
  } finally {
    busy.value = false
  }
}

function downloadErrors(): void {
  if (!result.value) return
  const csv = buildErrorCsv(uploaded.value, result.value.errors)
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), errorFileName(new Date()))
}
</script>

<template>
  <DsPanel data-testid="import-card">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <DsIconChip icon="i-ph-file-csv-duotone" size="lg" />
        <div class="min-w-0">
          <h2 class="text-subheading text-highlighted">Import Soalan (CSV/Excel)</h2>
          <p class="text-body text-muted">Muat naik banyak soalan sekaligus</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-download-simple-duotone"
          class="min-h-11"
          data-testid="import-template"
          @click="template"
          >Template</UButton
        >
        <UButton
          type="button"
          icon="i-ph-upload-simple-duotone"
          class="min-h-11"
          data-testid="import-toggle"
          @click="open = !open"
          >Import CSV</UButton
        >
      </div>
    </div>

    <UAlert
      v-if="errors.length"
      class="mt-3"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      data-testid="import-errors"
    >
      <template #description>
        <p v-for="(m, i) in errors" :key="i">{{ m }}</p>
      </template>
    </UAlert>

    <UAlert
      v-if="result"
      class="mt-3"
      :color="result.errors.length ? 'warning' : 'success'"
      variant="subtle"
      :icon="result.errors.length ? 'i-ph-warning-duotone' : 'i-ph-check-circle-duotone'"
      data-testid="import-result"
    >
      <template #description>
        <p data-testid="import-result-summary">
          {{ COPY.importDone(result.imported, result.errors.length) }}
        </p>
        <UTable
          v-if="result.errors.length"
          :data="result.errors"
          :columns="FAILURE_COLUMNS"
          class="mt-2 min-w-0"
          caption="Baris yang gagal diimport"
          data-testid="import-failures"
        />
        <UButton
          v-if="result.errors.length"
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-download-simple-duotone"
          class="mt-3 min-h-11"
          data-testid="import-errors-download"
          @click="downloadErrors"
          >Muat Turun Ralat (CSV)</UButton
        >
      </template>
    </UAlert>

    <form
      v-if="open"
      class="mt-4 flex flex-col gap-3"
      novalidate
      data-testid="import-form"
      @submit.prevent="submit"
    >
      <DsFormField label="Pilih Fail CSV" name="csv-file" :error="fileError">
        <DsFileField
          :model-value="file"
          name="csv_file"
          accept=".csv"
          preview="none"
          data-testid="import-file"
          @update:model-value="onFile"
        />
      </DsFormField>
      <UButton
        type="submit"
        :loading="busy"
        :disabled="busy"
        icon="i-ph-cloud-arrow-up-duotone"
        class="min-h-11 self-start"
        data-testid="import-submit"
        >{{ busy ? 'Mengimport...' : 'Import' }}</UButton
      >
      <DsPanel tone="inset" data-testid="import-guide">
        <p class="mb-1 flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-info-duotone" class="size-4" />
          Panduan:
        </p>
        <ul class="flex flex-col gap-1 pl-4">
          <li>Muat turun template → isi soalan → import kembali</li>
          <li>
            Format: subjek, tahap, bab, SP, TP, aras, soalan, 4 pilihan, jawapan (A/B/C/D),
            kesukaran, penerangan
          </li>
          <li>Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin</li>
          <li>Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport</li>
        </ul>
      </DsPanel>
    </form>
  </DsPanel>
</template>
