<script setup lang="ts">
/**
 * S21 card "Hantar Kertas Soalan kepada Admin" (FR-M10-98; FN-M10-7.1.11; `hantarKertas()` on live):
 * accepted types, file conditions, three steps and the form. Chosen files are listed with an icon by
 * extension, the name and "{x.xx} MB". The send calls `POST /api/guru/question-papers` (contract #60,
 * multipart); success and failure texts are UNVERIFIED COPY (SRS §8.3).
 */
import {
  CircleCheck,
  File,
  FileSpreadsheet,
  FileText,
  Info,
  Send,
  TriangleAlert,
} from '@lucide/vue'
import { ref } from 'vue'

import { isApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'

import { submitQuestionPaper } from '../../api/guru'
import type { PaperType, QuestionPaperRequest } from '../../api/types'
import { COPY, fileKind, megabytes } from './lib'

const TYPES = [
  'Soalan Umum',
  'Trial Paper',
  'Soalan DSKP',
  'Buku Teks',
  'Buku Latihan',
  'Soalan Peperiksaan',
] as const
const STEPS = [
  { n: '1. Hantar', text: 'Upload fail anda' },
  { n: '2. Proses', text: 'Admin extract soalan' },
  { n: '3. Databank', text: 'Soalan tersedia' },
] as const

const form = ref<HTMLFormElement | null>(null)
const files = ref<File[]>([])
const busy = ref(false)
const errors = ref<string[]>([])
const sent = ref<string | null>(null)

function onFiles(event: Event): void {
  files.value = [...((event.target as HTMLInputElement).files ?? [])]
}

async function submit(): Promise<void> {
  if (busy.value || !form.value) return
  busy.value = true
  errors.value = []
  sent.value = null
  const read = (name: string): string =>
    String((form.value?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '')
  const tingkatan = read('tingkatan')
  const tahun = read('tahun')
  const body: QuestionPaperRequest = {
    jenisSoalan: read('jenis_soalan') as PaperType,
    subject: read('subject'),
    tingkatan: tingkatan === '' ? '' : Number(tingkatan),
    tahun: tahun === '' ? '' : Number(tahun),
    disediakanOleh: read('disediakan_oleh'),
    catatan: read('catatan'),
  }
  try {
    await submitQuestionPaper(body, files.value)
    sent.value = COPY.paperSent
    form.value.reset()
    files.value = []
  } catch (err) {
    errors.value = isApiError(err) && err.fields ? Object.values(err.fields) : [COPY.paperFailed]
  } finally {
    busy.value = false
  }
}

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5" data-testid="paper-card">
    <h2 class="text-sm font-bold text-slate-800 sm:text-base">Hantar Kertas Soalan kepada Admin</h2>
    <p class="text-sm text-slate-500">Admin akan proses dan upload ke databank soalan</p>

    <div class="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
      <div
        class="min-w-0 rounded-xl bg-blue-50 p-3 text-sm text-blue-800"
        data-testid="paper-types"
      >
        <p class="mb-1 flex items-center gap-1.5 font-semibold">
          <Info class="h-4 w-4" />
          Jenis Soalan Yang Diterima
        </p>
        <ul class="space-y-0.5">
          <li v-for="t in TYPES" :key="t" class="flex items-center gap-1.5">
            <CircleCheck class="h-4 w-4 shrink-0 text-emerald-600" />
            {{ t }}
          </li>
        </ul>
      </div>
      <div
        class="min-w-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        data-testid="paper-conditions"
      >
        <p class="mb-1 flex items-center gap-1.5 font-semibold">
          <TriangleAlert class="h-4 w-4" />
          Syarat Fail Yang Dihantar
        </p>
        <ul class="list-disc space-y-0.5 pl-5">
          <li>Format diterima: <strong>PDF (teks), DOCX, XLSX</strong></li>
          <li><strong>PDF scan imej TIDAK diterima</strong> — teks mesti boleh disalin</li>
          <li><strong>Skema jawapan WAJIB</strong> disertakan bersama soalan</li>
          <li>Maksimum <strong>5 fail</strong>, saiz maksimum <strong>20MB</strong> setiap fail</li>
        </ul>
      </div>
    </div>

    <ol class="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3" data-testid="paper-steps">
      <li v-for="s in STEPS" :key="s.n" class="rounded-xl bg-slate-50 p-3 text-center">
        <p class="text-sm font-bold text-slate-800">{{ s.n }}</p>
        <p class="text-sm text-slate-500">{{ s.text }}</p>
      </li>
    </ol>

    <AlertBox v-if="errors.length" class="mt-4" :messages="errors" data-testid="paper-errors" />
    <AlertBox
      v-if="sent"
      class="mt-4"
      variant="success"
      :messages="sent"
      data-testid="paper-sent"
    />

    <form
      ref="form"
      class="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"
      data-testid="paper-form"
      @submit.prevent="submit"
    >
      <div class="min-w-0">
        <label for="paper-jenis" :class="LABEL">Jenis Soalan *</label>
        <select
          id="paper-jenis"
          name="jenis_soalan"
          required
          :class="[FORM_INPUT_CLASS, 'min-h-11 bg-white']"
          data-testid="paper-jenis"
        >
          <option value="">-- Pilih Jenis --</option>
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
          <option value="Lain-lain">Lain-lain</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="paper-subject" :class="LABEL">Matapelajaran *</label>
        <input
          id="paper-subject"
          type="text"
          name="subject"
          required
          maxlength="100"
          placeholder="Cth: Matematik, Fizik, BM..."
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="paper-subject"
        />
      </div>
      <div class="min-w-0">
        <label for="paper-tingkatan" :class="LABEL">Tingkatan</label>
        <select
          id="paper-tingkatan"
          name="tingkatan"
          :class="[FORM_INPUT_CLASS, 'min-h-11 bg-white']"
          data-testid="paper-tingkatan"
        >
          <option value="">-- Semua / Tidak Pasti --</option>
          <option v-for="n in 5" :key="n" :value="String(n)">Tingkatan {{ n }}</option>
        </select>
      </div>
      <div class="min-w-0">
        <label for="paper-tahun" :class="LABEL">Tahun</label>
        <input
          id="paper-tahun"
          type="number"
          name="tahun"
          min="2000"
          max="2099"
          placeholder="Cth: 2024"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="paper-tahun"
        />
      </div>
      <div class="min-w-0 md:col-span-2">
        <label for="paper-oleh" :class="LABEL">Disediakan Oleh</label>
        <input
          id="paper-oleh"
          type="text"
          name="disediakan_oleh"
          maxlength="150"
          placeholder="Cth: Jabatan Pelajaran Johor, nama guru..."
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="paper-oleh"
        />
      </div>
      <div class="min-w-0 md:col-span-2">
        <label for="paper-catatan" :class="LABEL">Catatan Tambahan</label>
        <textarea
          id="paper-catatan"
          name="catatan"
          rows="3"
          maxlength="1000"
          placeholder="Maklumat tambahan untuk admin..."
          :class="FORM_TEXTAREA_CLASS"
          data-testid="paper-catatan"
        ></textarea>
      </div>
      <div class="min-w-0 md:col-span-2">
        <label for="paper-files" :class="LABEL">Fail Soalan + Skema *</label>
        <label
          for="paper-files"
          class="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/40"
          data-testid="paper-drop"
        >
          Klik untuk pilih fail PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail
        </label>
        <input
          id="paper-files"
          type="file"
          name="files[]"
          multiple
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          class="sr-only"
          data-testid="paper-files"
          @change="onFiles"
        />
        <ul v-if="files.length" class="mt-2 space-y-1" data-testid="paper-file-list">
          <li
            v-for="f in files"
            :key="f.name + String(f.size)"
            class="flex min-w-0 items-center gap-2 text-sm text-slate-700"
            data-testid="paper-file"
            :data-kind="fileKind(f.name)"
          >
            <FileText v-if="fileKind(f.name) === 'pdf'" class="h-4 w-4 shrink-0 text-red-500" />
            <FileText
              v-else-if="fileKind(f.name) === 'word'"
              class="h-4 w-4 shrink-0 text-blue-600"
            />
            <FileSpreadsheet
              v-else-if="fileKind(f.name) === 'excel'"
              class="h-4 w-4 shrink-0 text-emerald-600"
            />
            <File v-else class="h-4 w-4 shrink-0 text-slate-500" />
            <span class="min-w-0 truncate">{{ f.name }}</span>
            <span class="shrink-0 text-slate-500">{{ megabytes(f.size) }}</span>
          </li>
        </ul>
      </div>
      <div class="md:col-span-2">
        <button
          type="submit"
          :disabled="busy"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50"
          data-testid="paper-submit"
        >
          <LoadingSpinner v-if="busy" :size="16" />
          <Send v-else class="h-4 w-4" />
          Hantar kepada Admin
        </button>
      </div>
    </form>
  </section>
</template>
