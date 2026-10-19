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
import { computed, nextTick, ref } from 'vue'

import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsFileField, DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsPage, DsPanel } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { downloadImportTemplate, importQuestions } from '../api/imports'
import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { DIFFICULTY_OPTIONS, IMPORT_HISTORY_PATH } from '../lib/import-quality'
import { QUESTIONS_LIST_PATH } from '../lib/question-list'
import { errorLines } from '../lib/ui-errors'

const flash = useFlash()

const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))
const subjectOptions = computed(() => subjects.data.value?.data ?? [])
const levelOptions = computed(() => levels.data.value?.data ?? [])

const form = ref<HTMLFormElement | null>(null)
const alertBox = ref<HTMLElement | null>(null)
const file = ref<File | File[] | null>(null)
const subjectId = ref('')
const levelId = ref('')
const difficulty = ref('2')

const submitting = ref(false)
const errors = ref<string[]>([])

function toId(value: string): number | null {
  return value === '' ? null : Number(value)
}

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  errors.value = []
  try {
    const result = await importQuestions({
      csvFile: Array.isArray(file.value) ? (file.value[0] ?? null) : file.value,
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

</script>

<template>
  <DsPage data-testid="import-page">
    <template #breadcrumb>
      <DsBackLink :to="QUESTIONS_LIST_PATH" data-testid="import-back" />
    </template>
    <template #actions>
      <UButton
        :to="IMPORT_HISTORY_PATH"
        color="neutral"
        variant="soft"
        icon="i-ph-clock-counter-clockwise"
        class="min-h-11"
        data-testid="import-history-link"
      >
        Sejarah Import
      </UButton>
    </template>

    <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
      <form
        ref="form"
        method="post"
        enctype="multipart/form-data"
        class="flex min-w-0 flex-col gap-4 lg:col-span-2 lg:self-start"
        data-testid="import-form"
        @submit.prevent="submit"
      >
        <DsFormSection title="Muat Naik Fail CSV" icon="file-arrow-up">
          <div ref="alertBox">
            <UAlert
              v-if="errors.length > 0"
              color="error"
              variant="subtle"
              icon="i-ph-warning-circle"
              role="alert"
              data-testid="import-alert"
            >
              <template #description>
                <p v-for="(line, i) in errors" :key="i">{{ line }}</p>
              </template>
            </UAlert>
          </div>

          <DsFormField
            v-slot="{ id }"
            native
            for="import-csv-file"
            label="Fail CSV"
            required
            hint="Saiz maksimum: 5MB. Format: CSV atau TXT"
          >
            <DsFileField
              :id="id"
              v-model="file"
              name="csv_file"
              accept=".csv,.txt"
              required
              data-testid="import-file"
            />
          </DsFormField>

          <div class="flex min-w-0 flex-col gap-4">
            <div>
              <h4 class="text-label text-highlighted">Tetapan Lalai (Opsional)</h4>
              <p class="text-body text-muted">
                Nilai ini digunakan jika kolum berkaitan tiada dalam CSV.
              </p>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DsFormField
                v-slot="{ id }"
                native
                for="import-default-subject"
                label="Subjek Lalai"
              >
                <DsNativeSelect
                  :id="id"
                  v-model="subjectId"
                  name="default_subject_id"
                  data-testid="import-default-subject"
                >
                  <option value="">-- Tidak ditetapkan --</option>
                  <option v-for="s in subjectOptions" :key="s.id" :value="String(s.id)">
                    {{ s.name }}
                  </option>
                </DsNativeSelect>
              </DsFormField>
              <DsFormField
                v-slot="{ id }"
                native
                for="import-default-level"
                label="Tahap Pendidikan"
              >
                <DsNativeSelect
                  :id="id"
                  v-model="levelId"
                  name="default_education_level_id"
                  data-testid="import-default-level"
                >
                  <option value="">-- Tidak ditetapkan --</option>
                  <option v-for="l in levelOptions" :key="l.id" :value="String(l.id)">
                    {{ l.name }}
                  </option>
                </DsNativeSelect>
              </DsFormField>
              <DsFormField
                v-slot="{ id }"
                native
                for="import-default-difficulty"
                label="Kesukaran"
              >
                <DsNativeSelect
                  :id="id"
                  v-model="difficulty"
                  name="default_difficulty_level"
                  data-testid="import-default-difficulty"
                >
                  <option value="">-- Tidak ditetapkan --</option>
                  <option v-for="d in DIFFICULTY_OPTIONS" :key="d.value" :value="String(d.value)">
                    {{ d.label }}
                  </option>
                </DsNativeSelect>
              </DsFormField>
            </div>
          </div>
        </DsFormSection>

        <DsFormBar :show-cancel="false" :sticky="false">
          <template #status>
            <span class="flex items-center gap-2 text-body text-muted">
              <UIcon name="i-ph-shield-check" class="size-4 text-primary-t" />
              Soalan disimpan sebagai draf
            </span>
          </template>
          <template #submit>
            <UButton
              type="submit"
              :loading="submitting"
              :disabled="submitting"
              :icon="submitting ? undefined : 'i-ph-upload-simple'"
              class="min-h-11"
              data-testid="import-submit"
            >
              Mula Import
            </UButton>
          </template>
        </DsFormBar>
      </form>

      <div class="flex min-w-0 flex-col gap-4 md:gap-6">
        <DsPanel data-testid="import-template-card">
          <div class="flex flex-col items-center gap-2 text-center">
            <UIcon name="i-ph-download-simple" class="size-8 text-primary-t" />
            <h3 class="text-subheading text-highlighted">Muat Turun Template</h3>
            <p class="text-body text-muted">Template CSV dengan contoh soalan</p>
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-ph-file-csv"
              :disabled="downloading"
              class="mt-1 min-h-11"
              data-testid="import-template-download"
              @click="downloadTemplate"
            >
              Download Template
            </UButton>
          </div>
        </DsPanel>

        <DsPanel title="Format CSV" icon="i-ph-info" data-testid="import-format-card">
          <p class="mb-1 text-label text-highlighted">Kolum diperlukan:</p>
          <ul class="mb-3 flex flex-col gap-2 text-body text-default">
            <li><code class="bg-elevated px-1 text-caption">question_text</code> — Teks soalan</li>
            <li>
              <code class="bg-elevated px-1 text-caption">option_a</code>,
              <code class="bg-elevated px-1 text-caption">option_b</code> — Pilihan
            </li>
            <li>
              <code class="bg-elevated px-1 text-caption">correct_answer</code> — Jawapan (A/B/C/D)
            </li>
            <li>
              <code class="bg-elevated px-1 text-caption">subject_id</code> — ID subjek (atau guna
              Tetapan Lalai)
            </li>
            <li>
              <code class="bg-elevated px-1 text-caption">education_level_id</code> — ID tahap (atau
              guna Tetapan Lalai)
            </li>
          </ul>
          <p class="mb-1 text-label text-highlighted">Kolum opsional:</p>
          <ul class="flex flex-col gap-2 text-body text-default">
            <li>
              <code class="bg-elevated px-1 text-caption">option_c</code>,
              <code class="bg-elevated px-1 text-caption">option_d</code>
            </li>
            <li>
              <code class="bg-elevated px-1 text-caption">difficulty_level</code> — Kesukaran (1-5)
            </li>
            <li>
              <code class="bg-elevated px-1 text-caption">marks</code>,
              <code class="bg-elevated px-1 text-caption">explanation</code>
            </li>
          </ul>
        </DsPanel>

        <DsPanel title="Tips" icon="i-ph-lightbulb" data-testid="import-tips-card">
          <ul class="flex flex-col gap-2 text-body text-default">
            <li class="flex items-start gap-2">
              <UIcon name="i-ph-check" class="mt-1 size-4 shrink-0 text-success" />
              Fail CSV mesti encoding UTF-8
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-ph-check" class="mt-1 size-4 shrink-0 text-success" />
              Guna petikan dua (") untuk teks yang ada koma
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-ph-check" class="mt-1 size-4 shrink-0 text-success" />
              Baris pertama = header kolum
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-ph-check" class="mt-1 size-4 shrink-0 text-success" />
              Semua soalan disimpan sebagai "draf"
            </li>
          </ul>
        </DsPanel>
      </div>
    </div>
  </DsPage>
</template>
