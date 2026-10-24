<script setup lang="ts">
/**
 * S21 card "Hantar Kertas Soalan kepada Admin" (FR-M10-98; FN-M10-7.1.11; `hantarKertas()` on live):
 * accepted types, file conditions, three steps and the form. Chosen files are listed with an icon by
 * extension, the name and "{x.xx} MB". The send calls `POST /api/guru/question-papers` (contract #60,
 * multipart); success and failure texts are UNVERIFIED COPY (SRS §8.3).
 */
import { ref } from 'vue'

import { isApiError } from '@/api'
import { DsFileField, DsFormField, DsIconChip, DsNativeSelect, DsPanel } from '@/ds'

import { submitQuestionPaper } from '../../api/guru'
import type { PaperType, QuestionPaperRequest } from '../../api/types'
import { COPY, fileKind, megabytes } from './lib'

const TYPES = [
  'Soalan Umum',
  'Kertas Percubaan',
  'Soalan DSKP',
  'Buku Teks',
  'Buku Latihan',
  'Soalan Peperiksaan',
] as const
const STEPS = [
  { n: '1. Hantar', text: 'Muat naik fail anda' },
  { n: '2. Proses', text: 'Admin ekstrak soalan' },
  { n: '3. Databank', text: 'Soalan tersedia' },
] as const

const form = ref<HTMLFormElement | null>(null)
const jenis = ref('')
const tingkatanSel = ref('')
const files = ref<File[]>([])
const busy = ref(false)
const errors = ref<string[]>([])
const sent = ref<string | null>(null)

function onFiles(value: File | File[] | null): void {
  files.value = value === null ? [] : Array.isArray(value) ? value : [value]
}

async function submit(): Promise<void> {
  if (busy.value || !form.value) return
  busy.value = true
  errors.value = []
  sent.value = null
  const read = (name: string): string =>
    String((form.value?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '')
  const tingkatan = tingkatanSel.value
  const tahun = read('tahun')
  const body: QuestionPaperRequest = {
    jenisSoalan: jenis.value as PaperType,
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
    jenis.value = ''
    tingkatanSel.value = ''
    files.value = []
  } catch (err) {
    errors.value = isApiError(err) && err.fields ? Object.values(err.fields) : [COPY.paperFailed]
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPanel data-testid="paper-card">
    <div class="flex items-center gap-3">
      <DsIconChip icon="i-ph-paper-plane-tilt-duotone" size="lg" />
      <div class="min-w-0">
        <h2 class="text-subheading text-highlighted">Hantar Kertas Soalan kepada Admin</h2>
        <p class="text-body text-muted">Admin akan proses dan muat naik ke databank soalan</p>
      </div>
    </div>

    <div class="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
      <DsPanel tone="inset" data-testid="paper-types">
        <p class="mb-1 flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-info-duotone" class="size-4 text-primary-t" />
          Jenis Soalan Yang Diterima
        </p>
        <ul class="flex flex-col gap-1">
          <li v-for="t in TYPES" :key="t" class="flex items-center gap-2">
            <UIcon name="i-ph-check-circle-duotone" class="size-4 shrink-0 text-success" />
            {{ t }}
          </li>
        </ul>
      </DsPanel>
      <DsPanel tone="inset" data-testid="paper-conditions">
        <p class="mb-1 flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-warning-duotone" class="size-4 text-warning" />
          Syarat Fail Yang Dihantar
        </p>
        <ul class="flex flex-col gap-1 pl-4">
          <li>Format diterima: <strong>PDF (teks), DOCX, XLSX</strong></li>
          <li><strong>PDF imbasan imej TIDAK diterima</strong> — teks mesti boleh disalin</li>
          <li><strong>Skema jawapan WAJIB</strong> disertakan bersama soalan</li>
          <li>Maksimum <strong>5 fail</strong>, saiz maksimum <strong>20MB</strong> setiap fail</li>
        </ul>
      </DsPanel>
    </div>

    <ol class="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3" data-testid="paper-steps">
      <li v-for="s in STEPS" :key="s.n" class="min-w-0">
        <DsPanel tone="inset">
          <div class="text-center">
            <p class="text-label text-highlighted">{{ s.n }}</p>
            <p class="text-body text-muted">{{ s.text }}</p>
          </div>
        </DsPanel>
      </li>
    </ol>

    <UAlert
      v-if="errors.length"
      class="mt-4"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      data-testid="paper-errors"
    >
      <template #description>
        <p v-for="(m, i) in errors" :key="i">{{ m }}</p>
      </template>
    </UAlert>
    <UAlert
      v-if="sent"
      class="mt-4"
      color="success"
      variant="subtle"
      icon="i-ph-check-circle-duotone"
      :description="sent"
      data-testid="paper-sent"
    />

    <form
      ref="form"
      class="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"
      data-testid="paper-form"
      @submit.prevent="submit"
    >
      <DsFormField label="Jenis Soalan *" name="paper-jenis" class="min-w-0">
        <DsNativeSelect
          id="paper-jenis"
          v-model="jenis"
          name="jenis_soalan"
          required
          data-testid="paper-jenis"
        >
          <option value="">-- Pilih Jenis --</option>
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
          <option value="Lain-lain">Lain-lain</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField label="Matapelajaran *" name="paper-subject" class="min-w-0">
        <UInput
          id="paper-subject"
          type="text"
          name="subject"
          required
          maxlength="100"
          placeholder="Cth: Matematik, Fizik, BM..."
          class="w-full"
          data-testid="paper-subject"
        />
      </DsFormField>
      <DsFormField label="Tingkatan" name="paper-tingkatan" class="min-w-0">
        <DsNativeSelect
          id="paper-tingkatan"
          v-model="tingkatanSel"
          name="tingkatan"
          data-testid="paper-tingkatan"
        >
          <option value="">-- Semua / Tidak Pasti --</option>
          <option v-for="n in 5" :key="n" :value="String(n)">Tingkatan {{ n }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField label="Tahun" name="paper-tahun" class="min-w-0">
        <UInput
          id="paper-tahun"
          type="number"
          name="tahun"
          min="2000"
          max="2099"
          placeholder="Cth: 2024"
          class="w-full"
          data-testid="paper-tahun"
        />
      </DsFormField>
      <DsFormField label="Disediakan Oleh" name="paper-oleh" class="min-w-0 md:col-span-2">
        <UInput
          id="paper-oleh"
          type="text"
          name="disediakan_oleh"
          maxlength="150"
          placeholder="Cth: Jabatan Pelajaran Johor, nama guru..."
          class="w-full"
          data-testid="paper-oleh"
        />
      </DsFormField>
      <DsFormField label="Catatan Tambahan" name="paper-catatan" class="min-w-0 md:col-span-2">
        <UTextarea
          id="paper-catatan"
          name="catatan"
          :rows="3"
          maxlength="1000"
          placeholder="Maklumat tambahan untuk admin..."
          class="w-full"
          data-testid="paper-catatan"
        />
      </DsFormField>
      <div class="min-w-0 md:col-span-2">
        <p class="mb-2 text-label text-highlighted">Fail Soalan + Skema *</p>
        <DsFileField
          :model-value="files"
          name="files[]"
          multiple
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          :max-size-mb="20"
          preview="none"
          label="Klik untuk pilih fail PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail"
          data-testid="paper-files"
          @update:model-value="onFiles"
        />
        <ul v-if="files.length" class="mt-2 flex flex-col gap-1" data-testid="paper-file-list">
          <li
            v-for="f in files"
            :key="f.name + String(f.size)"
            class="flex min-w-0 items-center gap-2 text-body text-default"
            data-testid="paper-file"
            :data-kind="fileKind(f.name)"
          >
            <UIcon
              :name="
                fileKind(f.name) === 'pdf'
                  ? 'i-ph-file-pdf-duotone'
                  : fileKind(f.name) === 'word'
                    ? 'i-ph-file-doc-duotone'
                    : fileKind(f.name) === 'excel'
                      ? 'i-ph-file-xls-duotone'
                      : 'i-ph-file-duotone'
              "
              class="size-4 shrink-0 text-primary-t"
            />
            <span class="min-w-0 truncate">{{ f.name }}</span>
            <span class="tabular shrink-0 text-muted">{{ megabytes(f.size) }}</span>
          </li>
        </ul>
      </div>
      <div class="md:col-span-2">
        <UButton
          type="submit"
          :loading="busy"
          :disabled="busy"
          :icon="busy ? undefined : 'i-ph-paper-plane-tilt-duotone'"
          class="min-h-11"
          data-testid="paper-submit"
          >Hantar kepada Admin</UButton
        >
      </div>
    </form>
  </DsPanel>
</template>
