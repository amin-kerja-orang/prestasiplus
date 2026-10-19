<script setup lang="ts">
/**
 * The "Tindakan" cell of one S10 row (FN-M04-5.1.3..5.1.6): the "Kemaskini" button with its inline panel
 * (status select, note, "Simpan"; no confirm). A save calls `PATCH …/status`, closes the panel and tells
 * the page, which reloads the list with the API `status` as the flash (FR-M04-94).
 */
import { ref } from 'vue'

import { DsNativeSelect } from '@/ds'

import {
  updateSubmissionStatus,
  type QuestionSubmission,
  type SubmissionStatus,
} from '../api/submissions'
import { SUBMISSION_STATUS_OPTIONS } from '../lib/submission-options'
import { fieldErrors } from '../lib/ui-errors'

const props = defineProps<{ submission: QuestionSubmission }>()
const emit = defineEmits<{ saved: [status: string]; failed: [error: unknown] }>()

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
</script>

<template>
  <div class="min-w-40">
    <UButton
      type="button"
      color="neutral"
      variant="soft"
      icon="i-ph-pencil-simple"
      class="min-h-11"
      data-testid="submission-toggle"
      @click="toggle"
    >
      Kemaskini
    </UButton>
    <form
      v-if="open"
      method="post"
      class="mt-2 flex flex-col gap-2"
      data-testid="submission-panel"
      @submit.prevent="save"
    >
      <DsNativeSelect
        v-model="status"
        name="status"
        required
        aria-label="Status"
        data-testid="submission-panel-status"
      >
        <option v-for="o in SUBMISSION_STATUS_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </DsNativeSelect>
      <p v-if="errors.status" class="text-caption text-error" data-testid="submission-status-error">
        {{ errors.status }}
      </p>
      <UTextarea
        v-model="notes"
        name="admin_notes"
        :rows="2"
        maxlength="1000"
        aria-label="Nota admin"
        placeholder="Nota admin (pilihan)..."
        :color="errors.adminNotes ? 'error' : undefined"
        class="w-full"
        data-testid="submission-panel-notes"
      />
      <p v-if="errors.adminNotes" class="text-caption text-error" data-testid="submission-notes-error">
        {{ errors.adminNotes }}
      </p>
      <UButton
        type="submit"
        block
        :loading="saving"
        :disabled="saving"
        class="min-h-11"
        data-testid="submission-panel-save"
      >
        Simpan
      </UButton>
    </form>
  </div>
</template>
