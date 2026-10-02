<script setup lang="ts">
/**
 * S5 `/admin/questions/import` "Import Soalan Secara Pukal" (M04-T5; FR-M04-53…57, DV-M04-01/07).
 *
 * Top links "Sejarah Import" and "Kembali", the card "Muat Naik Fail CSV" (native `required` file input
 * `.csv,.txt`, "Tetapan Lalai (Opsional)" with the difficulty preselected 2, the draft footer and "Mula
 * Import"), and the side cards "Muat Turun Template", "Format CSV" and "Tips".
 *
 * Validation is native (the empty file) and server-side (file type and size, invalid defaults); server
 * messages show only in the red alert above the form. Success keeps the page, resets the form and shows the
 * API `status` (UNVERIFIED COPY "Import selesai: {x} soalan diimport, {y} gagal.") as the green flash.
 */
import {
  ArrowLeft,
  Check,
  Download,
  FileSpreadsheet,
  FileUp,
  History,
  Info,
  Lightbulb,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from '@lucide/vue'
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { FORM_SELECT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'

import { downloadImportTemplate, importQuestions } from '../api/imports'
import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { DIFFICULTY_OPTIONS, IMPORT_HISTORY_PATH } from '../lib/import-quality'
import { QUESTIONS_LIST_PATH } from '../lib/question-list'
import { saveBlob } from '@/lib/save-blob'
import { errorLines } from '../lib/ui-errors'

const flash = useFlash()

const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))
const subjectOptions = computed(() => subjects.data.value?.data ?? [])
const levelOptions = computed(() => levels.data.value?.data ?? [])

const form = ref<HTMLFormElement | null>(null)
const alertBox = ref<HTMLElement | null>(null)
const file = ref<File | null>(null)
const subjectId = ref('')
const levelId = ref('')
const difficulty = ref('2')

const submitting = ref(false)
const errors = ref<string[]>([])

function onPick(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function toId(value: string): number | null {
  return value === '' ? null : Number(value)
}

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  errors.value = []
  try {
    const result = await importQuestions({
      csvFile: file.value,
      defaultSubjectId: toId(subjectId.value),
      defaultEducationLevelId: toId(levelId.value),
      defaultDifficultyLevel: toId(difficulty.value),
    })
    form.value?.reset()
    file.value = null
    subjectId.value = ''
    levelId.value = ''
    difficulty.value = '2'
    flash.show({ type: 'success', message: result.status })
    window.scrollTo?.({ top: 0 })
  } catch (err) {
    errors.value = errorLines(err)
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    submitting.value = false
  }
}

const downloading = ref(false)

async function downloadTemplate(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    const result = await downloadImportTemplate()
    saveBlob(result.blob, result.filename ?? 'template-import-soalan.csv')
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    downloading.value = false
  }
}

const LABEL = 'mb-1.5 block text-sm font-medium text-slate-700'
const CODE = 'rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700'
const TOP_LINK =
  'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="import-page">
    <div class="flex flex-wrap items-center gap-3">
      <RouterLink
        :to="IMPORT_HISTORY_PATH"
        :class="[TOP_LINK, 'bg-slate-600 text-white hover:bg-slate-700']"
        data-testid="import-history-link"
      >
        <History class="h-4 w-4" aria-hidden="true" />
        Sejarah Import
      </RouterLink>
      <RouterLink
        :to="QUESTIONS_LIST_PATH"
        :class="[TOP_LINK, 'bg-slate-100 text-slate-700 hover:bg-slate-200']"
        data-testid="import-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali
      </RouterLink>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <form
        ref="form"
        method="post"
        enctype="multipart/form-data"
        class="min-w-0 rounded-2xl bg-white p-5 shadow sm:p-6 lg:col-span-2 lg:self-start"
        data-testid="import-form"
        @submit.prevent="submit"
      >
        <h3 class="mb-5 flex items-center gap-2 text-lg font-bold text-slate-800">
          <FileUp class="h-5 w-5 text-indigo-600" aria-hidden="true" />
          Muat Naik Fail CSV
        </h3>

        <div ref="alertBox" class="scroll-mt-4">
          <AlertBox :messages="errors" class="mb-5" data-testid="import-alert" />
        </div>

        <div>
          <label for="import-csv-file" :class="LABEL">
            Fail CSV <span class="text-red-500">*</span>
          </label>
          <input
            id="import-csv-file"
            type="file"
            name="csv_file"
            accept=".csv,.txt"
            required
            class="w-full min-w-0 rounded-xl border-2 border-slate-200 p-2 text-sm text-slate-700 file:mr-3 file:min-h-9 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700"
            data-testid="import-file"
            @change="onPick"
          />
          <p class="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Info class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Saiz maksimum: 5MB. Format: CSV atau TXT
          </p>
        </div>

        <div class="mt-6 border-t border-slate-100 pt-5">
          <h4 class="mb-1 text-sm font-bold text-slate-800">Tetapan Lalai (Opsional)</h4>
          <p class="mb-4 text-sm text-slate-500">
            Nilai ini digunakan jika kolum berkaitan tiada dalam CSV.
          </p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label for="import-default-subject" :class="LABEL">Subjek Lalai</label>
              <select
                id="import-default-subject"
                v-model="subjectId"
                name="default_subject_id"
                :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white']"
                data-testid="import-default-subject"
              >
                <option value="">-- Tidak ditetapkan --</option>
                <option v-for="s in subjectOptions" :key="s.id" :value="String(s.id)">
                  {{ s.name }}
                </option>
              </select>
            </div>
            <div>
              <label for="import-default-level" :class="LABEL">Tahap Pendidikan</label>
              <select
                id="import-default-level"
                v-model="levelId"
                name="default_education_level_id"
                :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white']"
                data-testid="import-default-level"
              >
                <option value="">-- Tidak ditetapkan --</option>
                <option v-for="l in levelOptions" :key="l.id" :value="String(l.id)">
                  {{ l.name }}
                </option>
              </select>
            </div>
            <div>
              <label for="import-default-difficulty" :class="LABEL">Kesukaran</label>
              <select
                id="import-default-difficulty"
                v-model="difficulty"
                name="default_difficulty_level"
                :class="[FORM_SELECT_CLASS, 'min-h-11 bg-white']"
                data-testid="import-default-difficulty"
              >
                <option value="">-- Tidak ditetapkan --</option>
                <option v-for="d in DIFFICULTY_OPTIONS" :key="d.value" :value="String(d.value)">
                  {{ d.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div
          class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"
        >
          <p class="flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck class="h-4 w-4 text-indigo-600" aria-hidden="true" />
            Soalan disimpan sebagai draf
          </p>
          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="import-submit"
          >
            <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
            <Upload v-else class="h-4 w-4" aria-hidden="true" />
            Mula Import
          </button>
        </div>
      </form>

      <div class="min-w-0 space-y-5">
        <section
          class="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 text-center shadow-sm"
          data-testid="import-template-card"
        >
          <Download class="mx-auto mb-2 h-8 w-8 text-indigo-600" aria-hidden="true" />
          <h3 class="text-lg font-bold text-slate-800">Muat Turun Template</h3>
          <p class="mt-1 text-sm text-slate-600">Template CSV dengan contoh soalan</p>
          <button
            type="button"
            :disabled="downloading"
            class="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60"
            data-testid="import-template-download"
            @click="downloadTemplate"
          >
            <FileSpreadsheet class="h-4 w-4" aria-hidden="true" />
            Download Template
          </button>
        </section>

        <section
          class="rounded-2xl bg-white p-5 text-sm text-slate-700 shadow"
          data-testid="import-format-card"
        >
          <h3 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
            <Info class="h-5 w-5 text-indigo-600" aria-hidden="true" />
            Format CSV
          </h3>
          <p class="mb-1 font-medium">Kolum diperlukan:</p>
          <ul class="mb-3 space-y-1.5">
            <li><code :class="CODE">question_text</code> — Teks soalan</li>
            <li>
              <code :class="CODE">option_a</code>, <code :class="CODE">option_b</code> — Pilihan
            </li>
            <li><code :class="CODE">correct_answer</code> — Jawapan (A/B/C/D)</li>
            <li><code :class="CODE">subject_id</code> — ID subjek (atau guna Tetapan Lalai)</li>
            <li>
              <code :class="CODE">education_level_id</code> — ID tahap (atau guna Tetapan Lalai)
            </li>
          </ul>
          <p class="mb-1 font-medium">Kolum opsional:</p>
          <ul class="space-y-1.5">
            <li><code :class="CODE">option_c</code>, <code :class="CODE">option_d</code></li>
            <li><code :class="CODE">difficulty_level</code> — Kesukaran (1-5)</li>
            <li><code :class="CODE">marks</code>, <code :class="CODE">explanation</code></li>
          </ul>
        </section>

        <section
          class="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700 shadow-sm"
          data-testid="import-tips-card"
        >
          <h3 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
            <Lightbulb class="h-5 w-5 text-amber-500" aria-hidden="true" />
            Tips
          </h3>
          <ul class="space-y-1.5">
            <li class="flex items-start gap-2">
              <Check class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              Fail CSV mesti encoding UTF-8
            </li>
            <li class="flex items-start gap-2">
              <Check class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              Guna petikan dua (") untuk teks yang ada koma
            </li>
            <li class="flex items-start gap-2">
              <Check class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              Baris pertama = header kolum
            </li>
            <li class="flex items-start gap-2">
              <Check class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              Semua soalan disimpan sebagai "draf"
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
