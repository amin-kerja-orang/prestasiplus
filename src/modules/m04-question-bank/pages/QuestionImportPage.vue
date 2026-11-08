<script setup lang="ts">
/**
 * S5 `/admin/questions/import` "Import Soalan Secara Pukal" (M04-T5; FR-M04-53…57, DV-M04-01/07).
 *
 * Top links "Sejarah Import" and "Kembali", the card "Muat Naik Fail CSV" (native `required` file input
 * `.csv,.txt`, "Tetapan Lalai (Opsional)", the draft footer and "Mula Import"), and the side cards
 * "Muat Turun Template", "Format CSV" and "Tips".
 *
 * Validation is native (the empty file) and server-side (file type and size, invalid defaults); server
 * messages show only in the red alert above the form, and a new try clears the last banner (FR-ADM-Q11.1).
 * Success keeps the page, resets the form and shows the API `status` as the flash. A run with failed rows
 * lists them under the form, with the error CSV of FR-QA-34.
 */
import { computed, nextTick, ref } from 'vue'

import { useApi, useFlash } from '@/composables'
import {
  DsBackLink,
  DsCluster,
  DsFileField,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
} from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import {
  downloadImportErrors,
  downloadImportTemplate,
  importQuestions,
  type QuestionImportResponse,
} from '../api/imports'
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
const difficulty = ref('')

const submitting = ref(false)
const errors = ref<string[]>([])
const report = ref<(QuestionImportResponse['data'] & { warnings: string[] }) | null>(null)

function toId(value: string): number | null {
  return value === '' ? null : Number(value)
}

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  errors.value = []
  report.value = null
  flash.clear()
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
    difficulty.value = ''
    report.value = { ...result.data, warnings: result.warnings ?? [] }
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

/** The `Format CSV` card: the Q-11 columns S1-T05 reads today (MCQ). The group and stimulus columns join with S1-T05 part 2. */
const FORMAT_GROUPS: { title: string; rows: { columns: string[]; note?: string }[] }[] = [
  {
    title: 'Kolum diperlukan:',
    rows: [
      { columns: ['question_key'], note: 'Kunci soalan' },
      { columns: ['type'], note: 'Jenis soalan' },
      { columns: ['prompt_ms'], note: 'Teks soalan' },
      { columns: ['option_a', 'option_b', 'option_c'], note: 'Pilihan (sekurang-kurangnya 3)' },
      { columns: ['correct'], note: 'Jawapan betul' },
      { columns: ['marks'], note: 'Markah' },
      { columns: ['subject_code', 'tingkatan'], note: 'Kod subjek dan Tingkatan (atau guna Tetapan Lalai)' },
    ],
  },
  {
    title: 'Kolum DSKP (untuk diterbitkan):',
    rows: [
      { columns: ['unit_code', 'sp_kod'], note: 'Unit dan 1 hingga 3 SP (dipisah dengan ;)' },
      { columns: ['tp', 'aras'], note: 'TP dan aras pemikiran' },
      { columns: ['bab_kod'], note: 'Bab' },
    ],
  },
  {
    title: 'Kolum opsional:',
    rows: [
      { columns: ['option_d', 'option_e', 'option_f', 'option_g', 'option_h'] },
      { columns: ['difficulty'], note: 'Kesukaran (1-5)' },
      { columns: ['kertas'], note: 'Kertas (1, 2, 3 atau 4)' },
      { columns: ['explanation', 'kbat', 'topik_kod', 'number_label', 'bahasa', 'jenis_tulisan'] },
    ],
  },
]

/** The new header's messages already start with `Baris {n}: ` (Q-11); a legacy message may not. */
function failureLine(f: QuestionImportResponse['data']['failures'][number]): string {
  const prefix = `Baris ${String(f.row)}: `
  const line = f.message.startsWith(prefix) ? f.message : `${prefix}${f.message}`
  return f.field ? `${line} (${f.field})` : line
}

const downloadingErrors = ref(false)

async function downloadErrors(id: number): Promise<void> {
  if (downloadingErrors.value) return
  downloadingErrors.value = true
  try {
    const result = await downloadImportErrors(id)
    saveBlob(result.blob, result.filename ?? 'laporan-ralat-import.csv')
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    downloadingErrors.value = false
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
              Soalan akan disimpan sebagai draf
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
              {{ submitting ? 'Mengimport…' : 'Mula Import' }}
            </UButton>
          </template>
        </DsFormBar>

        <DsPanel
          v-if="report && (report.failures.length > 0 || report.warnings.length > 0)"
          title="Laporan import"
          data-testid="import-report"
        >
          <DsStack gap="sm">
            <DsStack v-if="report.warnings.length > 0" as="ul" gap="2xs" data-testid="import-warnings">
              <DsText v-for="w in report.warnings" :key="w" as="li" variant="body" tone="warning">{{ w }}</DsText>
            </DsStack>
            <DsStack v-if="report.failures.length > 0" as="ul" gap="2xs" data-testid="import-failures">
              <DsText v-for="f in report.failures" :key="`${f.row}-${f.field ?? ''}-${f.message}`" as="li" variant="body" wrap="anywhere">
                {{ failureLine(f) }}
              </DsText>
            </DsStack>
            <DsCluster v-if="report.failures.length > 0">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                :disabled="downloadingErrors"
                data-testid="import-errors-download"
                @click="downloadErrors(report.id)"
              >
                Muat turun laporan ralat (CSV)
              </UButton>
            </DsCluster>
          </DsStack>
        </DsPanel>
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
              Muat Turun Templat CSV
            </UButton>
          </div>
        </DsPanel>

        <DsPanel title="Format CSV" icon="i-ph-info" data-testid="import-format-card">
          <template v-for="group in FORMAT_GROUPS" :key="group.title">
            <p class="mb-1 text-label text-highlighted">{{ group.title }}</p>
            <ul class="mb-3 flex flex-col gap-2 text-body text-default">
              <li v-for="row in group.rows" :key="row.columns.join()">
                <template v-for="(c, i) in row.columns" :key="c"><template v-if="i > 0">, </template><code class="bg-elevated px-1 text-caption">{{ c }}</code></template><template v-if="row.note"> — {{ row.note }}</template>
              </li>
            </ul>
          </template>
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
