<script setup lang="ts">
/**
 * "Rekod Intervensi Baru" (FN-M12-8.2.1 ... 8.2.4; FR-M12-71 ... 74; DV-M12-01, DV-M12-07): a collapsible card, closed on
 * load; the header button (44 px) opens and closes it and swaps the caret. Validation is
 * the native `required` check only (no custom alert, no "Batal"). On submit the record is posted; a refusal of
 * the student id shows under "Pelajar (ID)" with the values kept and the panel open; on success the form
 * resets, closes and `saved` fires so the page reloads the list and the KPIs (no success message).
 */
import { computed, reactive, ref } from 'vue'

import { isApiError } from '@/api'
import { clock, formatMyt } from '@/lib/time'

import { createKirkpatrickIntervention } from '../../../api'
import type { AlertType, Mood } from '../../../api/types'
import { ALERT_TYPES, MOODS } from './intervention-format'

const emit = defineEmits<{ saved: [] }>()

/** A select item cannot carry an empty value, so "-- Pilih --" travels as this word and maps to "". */
const NONE = 'none'

const today = () => formatMyt(clock.now(), 'yyyy-MM-dd')
const blank = () => ({
  studentId: '',
  alertType: 'mood' as AlertType,
  actionDate: today(),
  alertDescription: '',
  actionTaken: '',
  beforeAccuracy: '',
  beforeMood: '' as Mood | '',
  afterAccuracy: '',
  afterMood: '' as Mood | '',
})

const open = ref(false)
const saving = ref(false)
const studentError = ref('')
const form = reactive(blank())

const typeItems = ALERT_TYPES.map((t) => ({ label: t.label, value: t.value }))
const moodItems = [
  { label: '-- Pilih --', value: NONE },
  ...MOODS.map((m) => ({ label: m.label, value: m.value })),
]
const beforeMood = computed({
  get: () => (form.beforeMood === '' ? NONE : form.beforeMood),
  set: (v: string) => {
    form.beforeMood = v === NONE ? '' : (v as Mood)
  },
})
const afterMood = computed({
  get: () => (form.afterMood === '' ? NONE : form.afterMood),
  set: (v: string) => {
    form.afterMood = v === NONE ? '' : (v as Mood)
  },
})

/** A number input binds its text; "" (empty) means no value. */
const num = (v: string) => (String(v).trim() === '' ? null : Number(v))

async function submit() {
  if (saving.value) return
  saving.value = true
  studentError.value = ''
  try {
    await createKirkpatrickIntervention({
      studentId: Number(form.studentId),
      alertType: form.alertType,
      actionDate: form.actionDate,
      alertDescription: form.alertDescription,
      actionTaken: form.actionTaken,
      beforeAccuracy: num(form.beforeAccuracy),
      beforeMood: form.beforeMood === '' ? null : form.beforeMood,
      afterAccuracy: num(form.afterAccuracy),
      afterMood: form.afterMood === '' ? null : form.afterMood,
    })
    Object.assign(form, blank())
    open.value = false
    emit('saved')
  } catch (e) {
    if (isApiError(e, 'VALIDATION_ERROR') && e.fields?.studentId) {
      studentError.value = e.fields.studentId
    }
    // Other (server) errors: live behaviour for server errors unobserved; mock never 500s. The form stays as is.
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard class="min-w-0" data-testid="int-form-card">
    <UButton
      type="button"
      block
      size="lg"
      color="neutral"
      variant="ghost"
      class="min-h-11 justify-between"
      icon="i-ph-plus-circle"
      :trailing-icon="open ? 'i-ph-caret-up' : 'i-ph-caret-down'"
      label="Rekod Intervensi Baru"
      :aria-expanded="open"
      aria-controls="int-form"
      data-testid="int-form-toggle"
      @click="open = !open"
    />
    <form
      v-show="open"
      id="int-form"
      autocomplete="off"
      class="mt-4 flex flex-col gap-3"
      data-testid="int-form"
      @submit.prevent="submit"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <UFormField label="Pelajar (ID)" name="student_id" class="min-w-0" required>
          <UInput
            v-model="form.studentId"
            type="number"
            name="student_id"
            required
            placeholder="ID pelajar"
            :color="studentError ? 'error' : 'neutral'"
            class="w-full"
            data-testid="int-student"
          />
          <template v-if="studentError" #error>
            <span data-testid="int-student-error">{{ studentError }}</span>
          </template>
        </UFormField>
        <UFormField label="Jenis Amaran" name="alert_type" class="min-w-0" required>
          <USelect
            v-model="form.alertType"
            :items="typeItems"
            name="alert_type"
            required
            class="w-full"
            data-testid="int-type"
          />
        </UFormField>
        <UFormField label="Tarikh Tindakan" name="action_date" class="min-w-0" required>
          <UInput
            v-model="form.actionDate"
            type="date"
            name="action_date"
            required
            class="w-full"
            data-testid="int-date"
          />
        </UFormField>
      </div>
      <UFormField label="Penerangan Amaran" name="alert_description" required>
        <UTextarea
          v-model="form.alertDescription"
          name="alert_description"
          :rows="2"
          required
          placeholder="Contoh: Pelajar tidak aktif selama 2 minggu"
          class="w-full"
          data-testid="int-desc"
        />
      </UFormField>
      <UFormField label="Tindakan Diambil" name="action_taken" required>
        <UTextarea
          v-model="form.actionTaken"
          name="action_taken"
          :rows="2"
          required
          placeholder="Contoh: Hubungi pelajar melalui guru kelas"
          class="w-full"
          data-testid="int-action"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UFormField label="Ketepatan Sebelum (%)" name="before_accuracy" class="min-w-0">
          <UInput
            v-model="form.beforeAccuracy"
            type="number"
            step="0.1"
            name="before_accuracy"
            placeholder="0.0"
            class="w-full"
            data-testid="int-before"
          />
        </UFormField>
        <UFormField label="Mood Sebelum" name="before_mood" class="min-w-0">
          <USelect
            v-model="beforeMood"
            :items="moodItems"
            name="before_mood"
            class="w-full"
            data-testid="int-before-mood"
          />
        </UFormField>
        <UFormField label="Ketepatan Selepas (%)" name="after_accuracy" class="min-w-0">
          <UInput
            v-model="form.afterAccuracy"
            type="number"
            step="0.1"
            name="after_accuracy"
            placeholder="Isi selepas semakan"
            class="w-full"
            data-testid="int-after"
          />
        </UFormField>
        <UFormField label="Mood Selepas" name="after_mood" class="min-w-0">
          <USelect
            v-model="afterMood"
            :items="moodItems"
            name="after_mood"
            class="w-full"
            data-testid="int-after-mood"
          />
        </UFormField>
      </div>
      <div>
        <UButton
          type="submit"
          size="lg"
          class="min-h-11"
          :disabled="saving"
          icon="i-ph-floppy-disk"
          label="Simpan Intervensi"
          data-testid="int-submit"
        />
      </div>
    </form>
  </UCard>
</template>
