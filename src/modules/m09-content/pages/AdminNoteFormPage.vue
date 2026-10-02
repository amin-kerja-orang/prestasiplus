<script setup lang="ts">
/**
 * S6 `/admin/notes/create` "Tambah Nota - Admin PRESTASIPLUS" and S7 `/admin/notes/:id/edit`
 * "Edit Nota - Admin PRESTASIPLUS" (FR-M09-46..48; DV-M09-01: live answers HTTP 500, the rebuild
 * shows this form). Fields per FN-M09-3.2.3: Tajuk, Ringkasan, Kandungan (plain textarea like S2),
 * Subjek, Jenis (the 4 stored types as stored), Tahap (Darjah 1 to 6), "Terbitkan Sekarang". Labels
 * and the three select placeholders are PROPOSED COPY (SRS §8.2).
 *
 * Native HTML validation only. 422: field messages under the fields, input kept. Success queues the
 * flash and returns to S5. An unknown id returns to S5 WITHOUT a flash (FR-M09-44).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'
import { useApi, useFlash } from '@/composables'

import {
  createAdminNote,
  fetchAdminNote,
  updateAdminNote,
  type NoteInputBody,
  type NoteSubject,
  type NoteType,
} from '../api/admin-articles-notes'
import AdminBackLink from '../components/admin-articles-notes/AdminBackLink.vue'
import AdminFormActions from '../components/admin-articles-notes/AdminFormActions.vue'
import AdminFormField from '../components/admin-articles-notes/AdminFormField.vue'
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

const { data: loaded, error: loadError } = useApi(
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

function errorClass(...names: string[]): string {
  return messageOf(...names) !== undefined ? FORM_ERROR_MODIFIER : ''
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
  <div class="min-w-0 space-y-4" data-testid="admin-note-form-page">
    <AdminBackLink :to="NOTES_LIST_PATH" />

    <AlertBox v-if="failed" :messages="COPY.loadFailed" data-testid="admin-note-load-error" />

    <form
      v-else-if="ready"
      method="post"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="admin-note-form"
      @submit.prevent="submit"
    >
      <AlertBox :messages="topErrors" data-testid="admin-note-form-alert" />

      <AdminFormField id="note-title" label="Tajuk" required :error="messageOf('title')">
        <input
          id="note-title"
          v-model="form.title"
          type="text"
          name="title"
          required
          :class="[FORM_INPUT_CLASS, 'min-h-11', errorClass('title')]"
          data-testid="note-title"
        />
      </AdminFormField>

      <AdminFormField id="note-summary" label="Ringkasan" :error="messageOf('summary')">
        <textarea
          id="note-summary"
          v-model="form.summary"
          name="summary"
          rows="3"
          :class="[FORM_TEXTAREA_CLASS, errorClass('summary')]"
          data-testid="note-summary"
        ></textarea>
      </AdminFormField>

      <AdminFormField id="note-content" label="Kandungan" required :error="messageOf('content')">
        <textarea
          id="note-content"
          v-model="form.content"
          name="content"
          rows="15"
          required
          :class="[FORM_TEXTAREA_CLASS, errorClass('content')]"
          data-testid="note-content"
        ></textarea>
      </AdminFormField>

      <div class="grid gap-5 md:grid-cols-3">
        <AdminFormField id="note-subject" label="Subjek" required :error="messageOf('subject')">
          <select
            id="note-subject"
            v-model="form.subject"
            name="subject"
            required
            :class="[FORM_SELECT_CLASS, 'min-h-11', errorClass('subject')]"
            data-testid="note-subject"
          >
            <option v-if="!editing" value="">Pilih subjek</option>
            <option v-for="o in NOTE_SUBJECT_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </AdminFormField>

        <AdminFormField
          id="note-type"
          label="Jenis"
          required
          :error="messageOf('noteType', 'note_type')"
        >
          <select
            id="note-type"
            v-model="form.noteType"
            name="note_type"
            required
            :class="[FORM_SELECT_CLASS, 'min-h-11', errorClass('noteType', 'note_type')]"
            data-testid="note-type"
          >
            <option v-if="!editing" value="">Pilih jenis</option>
            <option v-for="o in NOTE_TYPE_FORM_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </AdminFormField>

        <AdminFormField id="note-grade" label="Tahap" required :error="messageOf('grade')">
          <select
            id="note-grade"
            v-model="form.grade"
            name="grade"
            required
            :class="[FORM_SELECT_CLASS, 'min-h-11', errorClass('grade')]"
            data-testid="note-grade"
          >
            <option v-if="!editing" value="">Pilih tahap</option>
            <option v-for="o in NOTE_GRADE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </AdminFormField>
      </div>

      <label class="inline-flex min-h-11 cursor-pointer items-center gap-2.5">
        <input
          v-model="form.isPublished"
          type="checkbox"
          name="is_published"
          value="1"
          class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
          data-testid="note-published"
        />
        <span class="text-sm font-semibold text-slate-700">Terbitkan Sekarang</span>
      </label>

      <AdminFormActions
        :cancel-to="NOTES_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Nota' : 'Simpan Nota'"
        :saving="saving"
      />
    </form>
  </div>
</template>
