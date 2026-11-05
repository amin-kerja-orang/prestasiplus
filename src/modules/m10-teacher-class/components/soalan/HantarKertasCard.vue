<script setup lang="ts">
/**
 * S21 card "Hantar Kertas Soalan kepada Admin" (44-F4; FR-GUR-44-3, FR-GUR-44-13; API-GUR-17): accepted types, file
 * conditions, three steps and the form. Chosen files are listed with an icon by extension, the name and "{x.xx} MB".
 * Rules run in the browser first (`paper-rules.ts`): 1 to 5 files of PDF / DOCX / XLSX, 20 MB each; any invalid
 * file rejects the whole submission. The send calls `POST /api/guru/question-papers` (multipart) and answers
 * "Kertas dihantar kepada admin."; a scanned PDF is refused by the server on the `files` field.
 */
import { computed, ref } from 'vue'

import { isApiError } from '@/api'
import {
  DsFileField,
  DsFormField,
  DsIconChip,
  DsNativeSelect,
  DsPanel,
  DsStack,
  DsText,
} from '@/ds'

import { submitQuestionPaper } from '../../api/guru'
import type { PaperType, QuestionPaperRequest } from '../../api/types'
import { COPY, fileKind, megabytes } from './lib'
import {
  PAPER_LIMITS,
  PAPER_TYPES,
  validatePaper,
  validatePaperFiles,
  type PaperField,
} from './paper-rules'

/** The six information chips omit "Lain-lain" (OPT-JENIS-HANTARAN). */
const CHIPS = PAPER_TYPES.filter((t) => t.value !== 'lain')
const STEPS = [
  { n: '1. Hantar', text: 'Upload fail anda' },
  { n: '2. Proses', text: 'Admin extract soalan' },
  { n: '3. Databank', text: 'Soalan tersedia' },
] as const
const FIELDS: readonly PaperField[] = [
  'paperType',
  'subject',
  'year',
  'preparedBy',
  'note',
  'answerSchemeConfirmed',
  'files',
]

const paperType = ref('')
const subject = ref('')
const levelId = ref('')
const year = ref('')
const preparedBy = ref('')
const note = ref('')
const confirmed = ref(false)
const files = ref<File[]>([])
const busy = ref(false)
const fieldErrors = ref<Partial<Record<PaperField | 'levelId', string>>>({})
const errors = ref<string[]>([])
const sent = ref<string | null>(null)
const count = computed(() => Object.keys(fieldErrors.value).length)

/** Checks a picked list at once; an invalid list is dropped whole (nothing is kept or sent). */
function onFiles(value: File | File[] | null): void {
  const list = value === null ? [] : Array.isArray(value) ? value : [value]
  const bad = list.length > 0 ? validatePaperFiles(list) : null
  if (bad) {
    files.value = []
    fieldErrors.value = { ...fieldErrors.value, files: bad }
    return
  }
  files.value = list
  const { files: _drop, ...rest } = fieldErrors.value
  void _drop
  fieldErrors.value = rest
}

function reset(): void {
  paperType.value = ''
  subject.value = ''
  levelId.value = ''
  year.value = ''
  preparedBy.value = ''
  note.value = ''
  confirmed.value = false
  files.value = []
}

async function submit(): Promise<void> {
  if (busy.value) return
  sent.value = null
  errors.value = []
  const found = validatePaper({
    paperType: paperType.value,
    subject: subject.value,
    year: String(year.value),
    preparedBy: preparedBy.value,
    note: note.value,
    confirmed: confirmed.value,
    files: files.value,
  })
  fieldErrors.value = found
  if (Object.keys(found).length > 0) return
  busy.value = true
  const body: QuestionPaperRequest = {
    paperType: paperType.value as PaperType,
    subject: subject.value.trim(),
    levelId: levelId.value === '' ? '' : Number(levelId.value),
    year: String(year.value) === '' ? '' : Number(year.value),
    preparedBy: preparedBy.value.trim(),
    note: note.value.trim(),
    answerSchemeConfirmed: true,
  }
  try {
    await submitQuestionPaper(body, files.value)
    sent.value = COPY.paperSent
    reset()
  } catch (err) {
    if (isApiError(err) && err.fields) {
      const known: Partial<Record<PaperField | 'levelId', string>> = {}
      const other: string[] = []
      for (const [key, message] of Object.entries(err.fields)) {
        if ((FIELDS as readonly string[]).includes(key) || key === 'levelId') {
          known[key as PaperField | 'levelId'] = message
        } else other.push(message)
      }
      fieldErrors.value = known
      errors.value =
        other.length === 0 && Object.keys(known).length === 0 ? [COPY.paperFailed] : other
    } else {
      errors.value = [COPY.paperFailed]
    }
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
        <p class="text-body text-muted">Admin akan proses dan upload ke databank soalan</p>
      </div>
    </div>

    <div class="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
      <DsPanel tone="inset" data-testid="paper-types">
        <p class="mb-1 flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-info-duotone" class="size-4 text-primary-t" />
          Jenis Soalan Yang Diterima
        </p>
        <ul class="flex flex-col gap-1">
          <li v-for="t in CHIPS" :key="t.value" class="flex items-center gap-2">
            <UIcon name="i-ph-check-circle-duotone" class="size-4 shrink-0 text-success" />
            {{ t.label }}
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
          <li><strong>PDF scan imej TIDAK diterima</strong> — teks mesti boleh disalin</li>
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

    <UAlert
      v-if="count > 0"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      :description="`${String(count)} medan perlu dibetulkan.`"
      data-testid="paper-banner"
    />

    <form
      class="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"
      novalidate
      data-testid="paper-form"
      @submit.prevent="submit"
    >
      <DsFormField
        label="Jenis Soalan *"
        name="paper-jenis"
        :error="fieldErrors.paperType"
        class="min-w-0"
      >
        <DsNativeSelect
          id="paper-jenis"
          v-model="paperType"
          name="paper_type"
          data-testid="paper-jenis"
        >
          <option value="">-- Pilih Jenis --</option>
          <option v-for="t in PAPER_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField
        label="Matapelajaran *"
        name="paper-subject"
        :error="fieldErrors.subject"
        class="min-w-0"
      >
        <UInput
          id="paper-subject"
          v-model="subject"
          type="text"
          name="subject"
          :maxlength="PAPER_LIMITS.subject"
          placeholder="Cth: Matematik, Fizik, BM..."
          class="w-full"
          data-testid="paper-subject"
        />
      </DsFormField>
      <DsFormField
        label="Tingkatan"
        name="paper-tingkatan"
        :error="fieldErrors.levelId"
        class="min-w-0"
      >
        <DsNativeSelect
          id="paper-tingkatan"
          v-model="levelId"
          name="level_id"
          data-testid="paper-tingkatan"
        >
          <option value="">-- Semua / Tidak Pasti --</option>
          <option v-for="n in 5" :key="n" :value="String(n)">Tingkatan {{ n }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField label="Tahun" name="paper-tahun" :error="fieldErrors.year" class="min-w-0">
        <UInput
          id="paper-tahun"
          v-model="year"
          type="number"
          name="year"
          min="2000"
          max="2099"
          placeholder="Cth: 2024"
          class="w-full"
          data-testid="paper-tahun"
        />
      </DsFormField>
      <DsFormField
        label="Disediakan Oleh"
        name="paper-oleh"
        :error="fieldErrors.preparedBy"
        class="min-w-0 md:col-span-2"
      >
        <UInput
          id="paper-oleh"
          v-model="preparedBy"
          type="text"
          name="prepared_by"
          :maxlength="PAPER_LIMITS.preparedBy"
          placeholder="Cth: Jabatan Pelajaran Johor, nama guru..."
          class="w-full"
          data-testid="paper-oleh"
        />
      </DsFormField>
      <DsFormField
        label="Catatan Tambahan"
        name="paper-catatan"
        :error="fieldErrors.note"
        class="min-w-0 md:col-span-2"
      >
        <UTextarea
          id="paper-catatan"
          v-model="note"
          name="note"
          :rows="3"
          :maxlength="PAPER_LIMITS.note"
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
          accept=".pdf,.docx,.xlsx"
          preview="none"
          label="Klik untuk pilih fail"
          hint="PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail"
          data-testid="paper-files"
          @update:model-value="onFiles"
        />
        <DsText
          v-if="fieldErrors.files"
          variant="caption"
          tone="error"
          role="alert"
          data-testid="paper-files-error"
          >{{ fieldErrors.files }}</DsText
        >
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
        <DsStack gap="sm">
          <UCheckbox
            v-model="confirmed"
            name="answer_scheme_confirmed"
            label="Saya sahkan skema jawapan disertakan bersama soalan."
            data-testid="paper-confirm"
          />
          <DsText
            v-if="fieldErrors.answerSchemeConfirmed"
            variant="caption"
            tone="error"
            role="alert"
            data-testid="paper-confirm-error"
            >{{ fieldErrors.answerSchemeConfirmed }}</DsText
          >
          <div>
            <UButton
              type="submit"
              :loading="busy"
              :disabled="busy"
              :icon="busy ? undefined : 'i-ph-paper-plane-tilt-duotone'"
              class="min-h-11"
              data-testid="paper-submit"
              >{{ busy ? 'Memuat naik...' : 'Hantar kepada Admin' }}</UButton
            >
          </div>
        </DsStack>
      </div>
    </form>
  </DsPanel>
</template>
