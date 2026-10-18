<script setup lang="ts">
/**
 * S6 `/admin/notes/create` "Tambah Nota - Admin PRESTASIPLUS" and S7 `/admin/notes/:id/edit` "Edit Nota - Admin
 * PRESTASIPLUS" (FR-M09-46..49), v2 staff theme. One form for both: `mode="create"` posts a new note
 * ("Simpan Nota"), `mode="edit"` loads it and pre-fills the fields ("Kemaskini Nota").
 *
 * - Native HTML validation only (`required`, no `novalidate`). Fields are grouped in cards; Batal / Simpan sit
 *   in a sticky action bar.
 * - The three selects have the "Pilih ..." placeholder on create only (FR-M09-46).
 * - 422: the field messages show under the fields and the input is kept. Success queues the flash and returns
 *   to S5. An unknown id returns to S5 with no flash (FR-M09-44).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
} from '@/ds'

import {
  createAdminNote,
  fetchAdminNote,
  updateAdminNote,
  type NoteInputBody,
  type NoteSubject,
  type NoteType,
} from '../api/admin-articles-notes'
import {
  COPY,
  NOTES_LIST_PATH,
  NOTE_GRADE_OPTIONS,
  NOTE_SUBJECT_OPTIONS,
  NOTE_TYPE_FORM_OPTIONS,
  errorLines,
  fieldErrors,
  isNotFoundError,
} from '../lib/admin-articles-notes'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: string }>(), { id: '' })

const router = useRouter()
const flash = useFlash()

const editing = computed(() => props.mode === 'edit')
const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

interface NoteForm {
  title: string
  summary: string
  content: string
  subject: NoteSubject | ''
  noteType: NoteType | ''
  grade: string
  isPublished: boolean
}

const form = reactive<NoteForm>({
  title: '',
  summary: '',
  content: '',
  subject: '',
  noteType: '',
  grade: '',
  isPublished: false,
})

const {
  data: loaded,
  error: loadError,
  reload,
} = useApi(
  (signal) => fetchAdminNote(numericId.value ?? 0, { signal }),
  () => props.id,
  { immediate: props.mode === 'edit' && numericId.value !== null },
)

watch(
  loaded,
  (note) => {
    if (!note) return
    form.title = note.title
    form.summary = note.summary ?? ''
    form.content = note.content
    form.subject = note.subject
    form.noteType = note.noteType
    form.grade = note.grade
    form.isPublished = note.isPublished
  },
  { immediate: true },
)

/** FR-M09-44: an unknown note returns to S5 with no flash. */
function backToList(): void {
  void router.replace(NOTES_LIST_PATH)
}

if (props.mode === 'edit' && numericId.value === null) backToList()

watch(loadError, (err) => {
  if (err && isNotFoundError(err)) backToList()
})

const failed = computed(() => loadError.value !== null && !isNotFoundError(loadError.value))
const ready = computed(() => !editing.value || loaded.value !== null)

const saving = ref(false)
const topErrors = ref<string[]>([])
const fieldMessages = ref<Record<string, string>>({})

function messageOf(...names: string[]): string | undefined {
  for (const name of names) {
    const text = fieldMessages.value[name]
    if (text) return text
  }
  return undefined
}

function invalid(...names: string[]): boolean {
  return messageOf(...names) !== undefined
}

const KNOWN_FIELDS = ['title', 'summary', 'content', 'subject', 'noteType', 'note_type', 'grade']

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  topErrors.value = []
  fieldMessages.value = {}
  const body: NoteInputBody = {
    title: form.title,
    summary: form.summary.trim() === '' ? null : form.summary.trim(),
    content: form.content,
    subject: form.subject as NoteSubject,
    noteType: form.noteType as NoteType,
    grade: form.grade,
    isPublished: form.isPublished,
  }
  try {
    const result =
      editing.value && numericId.value !== null
        ? await updateAdminNote(numericId.value, body)
        : await createAdminNote(body)
    flash.success(result.status)
    await router.push(NOTES_LIST_PATH)
  } catch (err) {
    const fields = fieldErrors(err)
    fieldMessages.value = fields
    const unmatched = Object.entries(fields)
      .filter(([name]) => !KNOWN_FIELDS.includes(name))
      .map(([, text]) => text)
    topErrors.value = Object.keys(fields).length === 0 ? errorLines(err) : unmatched
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage
    :back-to="NOTES_LIST_PATH"
    back-label="Kembali ke Senarai"
    data-testid="admin-note-form-page"
  >
    <DsLoadError
      v-if="failed"
      :message="COPY.loadFailed"
      testid="admin-note-load-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="!ready" data-testid="admin-note-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </DsPanel>

    <form
      v-else
      method="post"
      class="flex min-w-0 flex-col gap-6"
      data-testid="admin-note-form"
      @submit.prevent="submit"
    >
      <UAlert
        v-if="topErrors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="admin-note-form-alert"
      >
        <template #description>
          <p v-for="m in topErrors" :key="m">{{ m }}</p>
        </template>
      </UAlert>

      <DsFormSection title="Maklumat Nota" icon="i-ph-notebook" accent="action">
        <DsFormField native for="note-title" label="Tajuk" required :error="messageOf('title')">
          <UInput
            id="note-title"
            v-model="form.title"
            type="text"
            name="title"
            required
            size="md"
            class="w-full"
            :color="invalid('title') ? 'error' : undefined"
            data-testid="note-title"
          />
        </DsFormField>

        <DsFormField native for="note-summary" label="Ringkasan" :error="messageOf('summary')">
          <UTextarea
            id="note-summary"
            v-model="form.summary"
            name="summary"
            :rows="3"
            size="md"
            class="w-full"
            :color="invalid('summary') ? 'error' : undefined"
            data-testid="note-summary"
          />
        </DsFormField>

        <DsFormField
          native
          for="note-content"
          label="Kandungan"
          required
          :error="messageOf('content')"
        >
          <UTextarea
            id="note-content"
            v-model="form.content"
            name="content"
            :rows="15"
            required
            size="md"
            class="w-full"
            :color="invalid('content') ? 'error' : undefined"
            data-testid="note-content"
          />
        </DsFormField>
      </DsFormSection>

      <DsFormSection title="Klasifikasi" icon="i-ph-tag" accent="friend">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <DsFormField
            native
            for="note-subject"
            label="Subjek"
            required
            :error="messageOf('subject')"
          >
            <DsNativeSelect
              id="note-subject"
              v-model="form.subject"
              name="subject"
              required
              :aria-invalid="invalid('subject') ? 'true' : undefined"
              data-testid="note-subject"
            >
              <option v-if="!editing" value="">Pilih subjek</option>
              <option v-for="o in NOTE_SUBJECT_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <DsFormField
            native
            for="note-type"
            label="Jenis"
            required
            :error="messageOf('noteType', 'note_type')"
          >
            <DsNativeSelect
              id="note-type"
              v-model="form.noteType"
              name="note_type"
              required
              :aria-invalid="invalid('noteType', 'note_type') ? 'true' : undefined"
              data-testid="note-type"
            >
              <option v-if="!editing" value="">Pilih jenis</option>
              <option v-for="o in NOTE_TYPE_FORM_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <DsFormField native for="note-grade" label="Tahap" required :error="messageOf('grade')">
            <DsNativeSelect
              id="note-grade"
              v-model="form.grade"
              name="grade"
              required
              :aria-invalid="invalid('grade') ? 'true' : undefined"
              data-testid="note-grade"
            >
              <option v-if="!editing" value="">Pilih tahap</option>
              <option v-for="o in NOTE_GRADE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>
        </div>
      </DsFormSection>

      <DsFormSection title="Penerbitan" icon="rocket-launch" accent="win">
        <USwitch
          v-model="form.isPublished"
          name="is_published"
          label="Terbitkan Sekarang"
          class="min-h-11"
          data-testid="note-published"
        />
      </DsFormSection>

      <DsFormBar
        :cancel-to="NOTES_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Nota' : 'Simpan Nota'"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
