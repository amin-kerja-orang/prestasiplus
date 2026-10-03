<script setup lang="ts">
/**
 * S21 card "Import Soalan (CSV/Excel)" (FR-M10-94; FN-M10-7.1.5, DV-M10-08): "Template" downloads the
 * M04 CSV template, "Import CSV" toggles the form (`csv_file`, `required`, `.csv,.txt`), "Import" posts
 * #58 and reports the result: imported count and the failed rows (the valid rows are kept). The result
 * summary is UNVERIFIED COPY (SRS §8.3).
 */
import { CloudUpload, Download, FileSpreadsheet, Info, Upload } from '@lucide/vue'
import { ref } from 'vue'

import { isApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
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
const input = ref<HTMLInputElement | null>(null)

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
    if (input.value) input.value.value = ''
    emit('imported', res)
  } catch (err) {
    errors.value = isApiError(err) && err.fields ? Object.values(err.fields) : [COPY.saveFailed]
  } finally {
    busy.value = false
  }
}

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300'
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5" data-testid="import-card">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"
        >
          <FileSpreadsheet class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-bold text-slate-800 sm:text-base">Import Soalan (CSV/Excel)</h2>
          <p class="text-sm text-slate-500">Muat naik banyak soalan sekaligus</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :class="[BTN, 'bg-slate-100 text-slate-700 hover:bg-slate-200']"
          data-testid="import-template"
          @click="template"
        >
          <Download class="h-4 w-4" />
          Template
        </button>
        <button
          type="button"
          :class="[BTN, 'bg-blue-600 text-white hover:bg-blue-700']"
          data-testid="import-toggle"
          @click="open = !open"
        >
          <Upload class="h-4 w-4" />
          Import CSV
        </button>
      </div>
    </div>

    <AlertBox v-if="errors.length" class="mt-3" :messages="errors" data-testid="import-errors" />

    <div
      v-if="result"
      class="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
      data-testid="import-result"
    >
      <p data-testid="import-result-summary">{{ COPY.importDone(result.imported) }}</p>
      <ul v-if="result.failed.length" class="mt-2 list-disc space-y-0.5 pl-5 text-amber-800">
        <li v-for="f in result.failed" :key="f.row" data-testid="import-failure">
          Baris {{ f.row }}: {{ f.message }}
        </li>
      </ul>
    </div>

    <form
      v-if="open"
      class="mt-4 space-y-3 border-t border-slate-100 pt-4"
      data-testid="import-form"
      @submit.prevent="submit"
    >
      <div>
        <label for="csv-file" class="mb-1.5 block text-sm font-semibold text-slate-700">
          Pilih Fail CSV
        </label>
        <input
          id="csv-file"
          ref="input"
          type="file"
          name="csv_file"
          accept=".csv,.txt"
          required
          class="block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:font-semibold file:text-blue-700"
          data-testid="import-file"
          @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
        />
      </div>
      <button
        type="submit"
        :disabled="busy"
        :class="[BTN, 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50']"
        data-testid="import-submit"
      >
        <LoadingSpinner v-if="busy" :size="16" />
        <CloudUpload v-else class="h-4 w-4" />
        Import
      </button>
      <div class="rounded-xl bg-slate-50 p-3 text-sm text-slate-600" data-testid="import-guide">
        <p class="mb-1 flex items-center gap-1.5 font-semibold text-slate-700">
          <Info class="h-4 w-4" />
          Panduan:
        </p>
        <ul class="list-disc space-y-0.5 pl-5">
          <li>Muat turun template → isi soalan → import kembali</li>
          <li>
            Format: subjek, tahap, soalan, 4 pilihan, jawapan (A/B/C/D), kesukaran, penerangan
          </li>
          <li>Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin</li>
          <li>Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport</li>
        </ul>
      </div>
    </form>
  </section>
</template>
