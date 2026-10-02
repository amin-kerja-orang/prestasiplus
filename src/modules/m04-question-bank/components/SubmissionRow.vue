<script setup lang="ts">
/**
 * One row of S10 (FN-M04-5.1.3..5.1.6): teacher and school, the paper, its files, the status pill with
 * the admin note, the date and the "Kemaskini" button with its inline panel (status select, note,
 * "Simpan"; no confirm). A save calls `PATCH …/status`, closes the panel and tells the page, which
 * reloads the list with the API `status` as the flash (FR-M04-94).
 */
import { CircleCheck, CircleX, Clock, Download, School, Settings2, SquarePen } from '@lucide/vue'
import { ref, type Component } from 'vue'

import { TABLE_CLASSES as T } from '@/components/data'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'

import {
  downloadSubmissionFile,
  updateSubmissionStatus,
  type QuestionSubmission,
  type SubmissionStatus,
} from '../api/submissions'
import { formatEnDate, formatTime } from '../lib/audit-format'
import { saveBlob } from '@/lib/save-blob'
import { fieldErrors } from '../lib/ui-errors'
import {
  SUBMISSION_PILL_CLASS,
  SUBMISSION_STATUS_LABEL,
  SUBMISSION_STATUS_OPTIONS,
} from '../lib/submission-options'

const props = defineProps<{ submission: QuestionSubmission }>()
const emit = defineEmits<{ saved: [status: string]; failed: [error: unknown] }>()

const STATUS_ICON: Record<SubmissionStatus, Component> = {
  done: CircleCheck,
  processing: Settings2,
  pending: Clock,
  rejected: CircleX,
}

const open = ref(false)
const status = ref<SubmissionStatus>(props.submission.status)
const notes = ref(props.submission.adminNotes ?? '')
const saving = ref(false)
/** SRS §5: server field messages show under the field in red. */
const errors = ref<Record<string, string>>({})

/** Opening the panel re-syncs the fields from the stored paper (a reload may have changed it). */
function toggle(): void {
  open.value = !open.value
  if (open.value) {
    status.value = props.submission.status
    notes.value = props.submission.adminNotes ?? ''
    errors.value = {}
  }
}

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = {}
  try {
    const result = await updateSubmissionStatus(props.submission.id, {
      status: status.value,
      adminNotes: notes.value,
    })
    open.value = false
    emit('saved', result.status)
  } catch (err) {
    const fields = fieldErrors(err)
    if (fields.status || fields.adminNotes) errors.value = fields
    else emit('failed', err)
  } finally {
    saving.value = false
  }
}

async function download(index: number): Promise<void> {
  try {
    const file = await downloadSubmissionFile(props.submission.id, index)
    saveBlob(file.blob, file.filename ?? props.submission.files[index]?.name ?? 'fail')
  } catch (err) {
    emit('failed', err)
  }
}
</script>

<template>
  <tr
    :class="[T.row, 'align-top']"
    data-testid="submission-row"
    :data-submission-id="submission.id"
  >
    <td :class="T.td">
      <div class="font-semibold text-slate-800">{{ submission.teacher.name }}</div>
      <a
        v-if="submission.teacher.email"
        :href="`mailto:${submission.teacher.email}`"
        class="block text-xs break-all text-slate-400 hover:text-slate-600"
        >{{ submission.teacher.email }}</a
      >
      <div v-if="submission.teacher.school" class="mt-0.5 flex gap-1 text-xs text-slate-400">
        <School class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{{ submission.teacher.school }}</span>
      </div>
    </td>

    <td :class="[T.td, 'min-w-40']">
      <div class="font-semibold text-slate-800">
        {{ submission.subjectText }}
        <span v-if="submission.levelCode" class="text-xs font-normal text-slate-400">{{
          submission.levelCode
        }}</span>
        <span class="text-xs font-normal text-slate-400"> ({{ submission.year }})</span>
      </div>
      <div class="text-xs text-blue-600">{{ submission.paperType }}</div>
      <div class="text-xs text-slate-400">Oleh: {{ submission.authorCredit }}</div>
      <div v-if="submission.note" class="mt-0.5 line-clamp-2 text-xs text-slate-400 italic">
        {{ submission.note }}
      </div>
    </td>

    <td :class="[T.td, 'min-w-36']">
      <button
        v-for="file in submission.files"
        :key="file.index"
        type="button"
        class="flex min-h-11 max-w-52 items-center gap-1.5 text-left text-xs text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:min-h-0 lg:py-0.5"
        data-testid="submission-file"
        @click="download(file.index)"
      >
        <Download class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ file.name }}</span>
      </button>
    </td>

    <td :class="[T.td, 'min-w-28']">
      <span
        :class="[
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
          SUBMISSION_PILL_CLASS[submission.status],
        ]"
        data-testid="submission-status"
      >
        <component :is="STATUS_ICON[submission.status]" class="h-3.5 w-3.5" aria-hidden="true" />
        {{ SUBMISSION_STATUS_LABEL[submission.status] }}
      </span>
      <div
        v-if="submission.adminNotes"
        class="mt-1 text-xs break-words text-slate-400 italic"
        data-testid="submission-admin-notes"
      >
        {{ submission.adminNotes }}
      </div>
    </td>

    <td :class="[T.td, 'text-xs whitespace-nowrap text-slate-400']">
      <div>{{ formatEnDate(submission.createdAt) }}</div>
      <div>{{ formatTime(submission.createdAt) }}</div>
    </td>

    <td :class="[T.td, 'min-w-40']">
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="submission-toggle"
        @click="toggle"
      >
        <SquarePen class="h-3.5 w-3.5" aria-hidden="true" />
        Kemaskini
      </button>
      <form
        v-if="open"
        method="post"
        class="mt-2 space-y-2 rounded-xl border border-slate-200 bg-white p-2"
        data-testid="submission-panel"
        @submit.prevent="save"
      >
        <select
          v-model="status"
          name="status"
          required
          :class="[FORM_INPUT_CLASS, 'min-h-11', errors.status ? FORM_ERROR_MODIFIER : '']"
          data-testid="submission-panel-status"
        >
          <option v-for="o in SUBMISSION_STATUS_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <p
          v-if="errors.status"
          :class="FORM_ERROR_TEXT_CLASS"
          data-testid="submission-status-error"
        >
          {{ errors.status }}
        </p>
        <textarea
          v-model="notes"
          name="admin_notes"
          rows="2"
          maxlength="1000"
          placeholder="Nota admin (pilihan)..."
          :class="[FORM_TEXTAREA_CLASS, errors.adminNotes ? FORM_ERROR_MODIFIER : '']"
          data-testid="submission-panel-notes"
        ></textarea>
        <p
          v-if="errors.adminNotes"
          :class="FORM_ERROR_TEXT_CLASS"
          data-testid="submission-notes-error"
        >
          {{ errors.adminNotes }}
        </p>
        <button
          type="submit"
          :disabled="saving"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-60"
          data-testid="submission-panel-save"
        >
          Simpan
        </button>
      </form>
    </td>
  </tr>
</template>
