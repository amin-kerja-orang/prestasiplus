<script setup lang="ts">
/**
 * S21 card "Import Soalan (CSV/Excel)" (FR-M10-94; FN-M10-7.1.5, DV-M10-08): "Template" downloads the
 * M04 CSV template, "Import CSV" toggles the form (`csv_file`, `required`, `.csv,.txt`), "Import" posts
 * #58 and reports the result: imported count and the failed rows (the valid rows are kept). The result
 * summary is UNVERIFIED COPY (SRS §8.3).
 */
import { ref } from 'vue'

import { isApiError } from '@/api'
import { DsFileField, DsFormField, DsIconChip, DsPanel } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { downloadQuestionTemplate, importQuestions } from '../../api/guru'
import type { ImportResult } from '../../api/types'
import { COPY } from './lib'

const emit = defineEmits<{ imported: [result: ImportResult] }>()

const open = ref(false)
const file = ref<File | null>(null)
const busy = ref(false)
const errors = ref<string[]>([])
const result = ref<ImportResult | null>(null)

async function template(): Promise<void> {
  errors.value = []
  try {
    const res = await downloadQuestionTemplate()
    saveBlob(res.blob, res.filename ?? 'template-import-soalan.csv')
  } catch {
    errors.value = [COPY.templateFailed]
  }
}

async function submit(): Promise<void> {
  if (busy.value || !file.value) return
  busy.value = true
  errors.value = []
  result.value = null
  try {
    const res = await importQuestions(file.value)
    result.value = res
    file.value = null
    emit('imported', res)
  } catch (err) {
    errors.value = isApiError(err) && err.fields ? Object.values(err.fields) : [COPY.saveFailed]
  } finally {
    busy.value = false
  }
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
      color="success"
      variant="subtle"
      icon="i-ph-check-circle-duotone"
      data-testid="import-result"
    >
      <template #description>
        <p data-testid="import-result-summary">{{ COPY.importDone(result.imported) }}</p>
        <ul v-if="result.failed.length" class="mt-2 flex flex-col gap-1 pl-4">
          <li v-for="f in result.failed" :key="f.row" data-testid="import-failure">
            Baris {{ f.row }}: {{ f.message }}
          </li>
        </ul>
      </template>
    </UAlert>

    <form
      v-if="open"
      class="mt-4 flex flex-col gap-3"
      data-testid="import-form"
      @submit.prevent="submit"
    >
      <DsFormField label="Pilih Fail CSV" name="csv-file">
        <DsFileField
          :model-value="file"
          name="csv_file"
          accept=".csv,.txt"
          preview="none"
          required
          data-testid="import-file"
          @update:model-value="file = Array.isArray($event) ? ($event[0] ?? null) : $event"
        />
      </DsFormField>
      <UButton
        type="submit"
        :loading="busy"
        :disabled="busy"
        icon="i-ph-cloud-arrow-up-duotone"
        class="min-h-11 self-start"
        data-testid="import-submit"
        >Import</UButton
      >
      <DsPanel tone="inset" data-testid="import-guide">
        <p class="mb-1 flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-info-duotone" class="size-4" />
          Panduan:
        </p>
        <ul class="flex flex-col gap-1 pl-4">
          <li>Muat turun template → isi soalan → import kembali</li>
          <li>
            Format: subjek, tahap, soalan, 4 pilihan, jawapan (A/B/C/D), kesukaran, penerangan
          </li>
          <li>Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin</li>
          <li>Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport</li>
        </ul>
      </DsPanel>
    </form>
  </DsPanel>
</template>
