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
import { DsPage } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { downloadImportTemplate, importQuestions } from '../api/imports'
import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import ErrorBox from '../components/ErrorBox.vue'
import NativeFile from '../components/native/NativeFile.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
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

</script>

<template>
  <DsPage data-testid="import-page">
    <div class="flex flex-wrap items-center gap-3">
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
      <UButton
        :to="QUESTIONS_LIST_PATH"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left"
        class="min-h-11"
        data-testid="import-back"
      >
        Kembali
      </UButton>
    </div>

    <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
      <form
        ref="form"
        method="post"
        enctype="multipart/form-data"
        class="min-w-0 lg:col-span-2 lg:self-start"
        data-testid="import-form"
        @submit.prevent="submit"
      >
        <UCard>
          <h3 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
            <UIcon name="i-ph-file-arrow-up" class="size-5 text-primary" />
            Muat Naik Fail CSV
          </h3>

          <div ref="alertBox" >
            <ErrorBox :messages="errors" class="mb-4" data-testid="import-alert" />
          </div>

          <div class="min-w-0">
            <label for="import-csv-file" class="mb-2 block text-label text-highlighted">
              Fail CSV *
            </label>
            <NativeFile
              id="import-csv-file"
              name="csv_file"
              accept=".csv,.txt"
              required
              data-testid="import-file"
              @change="onPick"
            />
            <p class="mt-2 flex items-center gap-2 text-caption text-muted">
              <UIcon name="i-ph-info" class="size-4 shrink-0" />
              Saiz maksimum: 5MB. Format: CSV atau TXT
            </p>
          </div>

          <div class="mt-6">
            <h4 class="mb-1 text-label text-highlighted">Tetapan Lalai (Opsional)</h4>
            <p class="mb-4 text-body text-muted">
              Nilai ini digunakan jika kolum berkaitan tiada dalam CSV.
            </p>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="min-w-0">
                <label for="import-default-subject" class="mb-2 block text-label text-highlighted"
                  >Subjek Lalai</label
                >
                <NativeSelect
                  id="import-default-subject"
                  v-model="subjectId"
                  name="default_subject_id"
                  data-testid="import-default-subject"
                >
                  <option value="">-- Tidak ditetapkan --</option>
                  <option v-for="s in subjectOptions" :key="s.id" :value="String(s.id)">
                    {{ s.name }}
                  </option>
                </NativeSelect>
              </div>
              <div class="min-w-0">
                <label for="import-default-level" class="mb-2 block text-label text-highlighted"
                  >Tahap Pendidikan</label
                >
                <NativeSelect
                  id="import-default-level"
                  v-model="levelId"
                  name="default_education_level_id"
                  data-testid="import-default-level"
                >
                  <option value="">-- Tidak ditetapkan --</option>
                  <option v-for="l in levelOptions" :key="l.id" :value="String(l.id)">
                    {{ l.name }}
                  </option>
                </NativeSelect>
              </div>
              <div class="min-w-0">
                <label for="import-default-difficulty" class="mb-2 block text-label text-highlighted"
                  >Kesukaran</label
                >
                <NativeSelect
                  id="import-default-difficulty"
                  v-model="difficulty"
                  name="default_difficulty_level"
                  data-testid="import-default-difficulty"
                >
                  <option value="">-- Tidak ditetapkan --</option>
                  <option v-for="d in DIFFICULTY_OPTIONS" :key="d.value" :value="String(d.value)">
                    {{ d.label }}
                  </option>
                </NativeSelect>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p class="flex items-center gap-2 text-body text-muted">
              <UIcon name="i-ph-shield-check" class="size-4 text-primary" />
              Soalan disimpan sebagai draf
            </p>
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
          </div>
        </UCard>
      </form>

      <div class="flex min-w-0 flex-col gap-4 md:gap-6">
        <UCard data-testid="import-template-card">
          <div class="flex flex-col items-center gap-2 text-center">
            <UIcon name="i-ph-download-simple" class="size-8 text-primary" />
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
        </UCard>

        <UCard data-testid="import-format-card">
          <h3 class="mb-3 flex items-center gap-2 text-subheading text-highlighted">
            <UIcon name="i-ph-info" class="size-5 text-primary" />
            Format CSV
          </h3>
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
        </UCard>

        <UCard data-testid="import-tips-card">
          <h3 class="mb-3 flex items-center gap-2 text-subheading text-highlighted">
            <UIcon name="i-ph-lightbulb" class="size-5 text-primary" />
            Tips
          </h3>
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
        </UCard>
      </div>
    </div>
  </DsPage>
</template>
