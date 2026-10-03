<script setup lang="ts">
/**
 * "Rekod Intervensi Baru" (FN-M12-8.2.1 ... 8.2.4; FR-M12-71 ... 74; DV-M12-01, DV-M12-07): a collapsible card, closed on
 * load; the header button (>= 36 px, here 44) opens and closes it and rotates the chevron 180°. Validation is
 * the native `required` check only (no custom alert, no "Batal"). On submit the record is posted; a refusal of
 * the student id shows under "Pelajar (ID)" with the values kept and the panel open; on success the form
 * resets, closes and `saved` fires so the page reloads the list and the KPIs (no success message).
 */
import { ChevronDown, CirclePlus, Save } from '@lucide/vue'
import { reactive, ref } from 'vue'

import { isApiError } from '@/api'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'
import { clock, formatMyt } from '@/lib/time'

import { createKirkpatrickIntervention } from '../../../api'
import type { AlertType, Mood } from '../../../api/types'
import { CARD } from '../common/kirkpatrick-format'
import { ALERT_TYPES, MOODS } from './intervention-format'

const emit = defineEmits<{ saved: [] }>()

const today = () => formatMyt(clock.now(), 'yyyy-MM-dd')
const blank = () => ({
  studentId: '' as string | number,
  alertType: 'mood' as AlertType,
  actionDate: today(),
  alertDescription: '',
  actionTaken: '',
  beforeAccuracy: '' as string | number,
  beforeMood: '' as Mood | '',
  afterAccuracy: '' as string | number,
  afterMood: '' as Mood | '',
})

const open = ref(false)
const saving = ref(false)
const studentError = ref('')
const form = reactive(blank())

/** A number input binds a number (Vue casts it), or "" when empty. */
const num = (v: string | number) => (String(v).trim() === '' ? null : Number(v))

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

const LABEL = 'mb-1 block text-xs font-medium text-slate-600'
</script>

<template>
  <section :class="[CARD, 'min-w-0']" data-testid="int-form-card">
    <button
      type="button"
      class="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left sm:px-5"
      data-testid="int-form-toggle"
      @click="open = !open"
    >
      <span class="flex items-center gap-2 font-heading text-sm font-bold text-slate-800">
        <CirclePlus class="h-4 w-4 text-indigo-600" />Rekod Intervensi Baru
      </span>
      <ChevronDown
        :class="['h-4 w-4 shrink-0 text-slate-400 transition-transform', open ? 'rotate-180' : '']"
        data-testid="int-form-chevron"
      />
    </button>
    <form
      v-show="open"
      autocomplete="off"
      class="space-y-3 px-4 pb-4 sm:px-5"
      data-testid="int-form"
      @submit.prevent="submit"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="min-w-0">
          <label :class="LABEL" for="int-student">Pelajar (ID)</label>
          <input
            id="int-student"
            v-model="form.studentId"
            type="number"
            name="student_id"
            required
            placeholder="ID pelajar"
            :class="[FORM_INPUT_CLASS, studentError ? FORM_ERROR_MODIFIER : '']"
            data-testid="int-student"
          />
          <p v-if="studentError" :class="FORM_ERROR_TEXT_CLASS" data-testid="int-student-error">
            {{ studentError }}
          </p>
        </div>
        <div class="min-w-0">
          <label :class="LABEL" for="int-type">Jenis Amaran</label>
          <select
            id="int-type"
            v-model="form.alertType"
            name="alert_type"
            required
            :class="FORM_SELECT_CLASS"
            data-testid="int-type"
          >
            <option v-for="t in ALERT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="min-w-0">
          <label :class="LABEL" for="int-date">Tarikh Tindakan</label>
          <input
            id="int-date"
            v-model="form.actionDate"
            type="date"
            name="action_date"
            required
            :class="FORM_INPUT_CLASS"
            data-testid="int-date"
          />
        </div>
      </div>
      <div>
        <label :class="LABEL" for="int-desc">Penerangan Amaran</label>
        <textarea
          id="int-desc"
          v-model="form.alertDescription"
          name="alert_description"
          rows="2"
          required
          placeholder="Contoh: Pelajar tidak aktif selama 2 minggu"
          :class="FORM_TEXTAREA_CLASS"
          data-testid="int-desc"
        />
      </div>
      <div>
        <label :class="LABEL" for="int-action">Tindakan Diambil</label>
        <textarea
          id="int-action"
          v-model="form.actionTaken"
          name="action_taken"
          rows="2"
          required
          placeholder="Contoh: Hubungi pelajar melalui guru kelas"
          :class="FORM_TEXTAREA_CLASS"
          data-testid="int-action"
        />
      </div>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="min-w-0">
          <label :class="LABEL" for="int-before">Ketepatan Sebelum (%)</label>
          <input
            id="int-before"
            v-model="form.beforeAccuracy"
            type="number"
            step="0.1"
            name="before_accuracy"
            placeholder="0.0"
            :class="FORM_INPUT_CLASS"
            data-testid="int-before"
          />
        </div>
        <div class="min-w-0">
          <label :class="LABEL" for="int-before-mood">Mood Sebelum</label>
          <select
            id="int-before-mood"
            v-model="form.beforeMood"
            name="before_mood"
            :class="FORM_SELECT_CLASS"
            data-testid="int-before-mood"
          >
            <option value="">-- Pilih --</option>
            <option v-for="m in MOODS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="min-w-0">
          <label :class="LABEL" for="int-after">Ketepatan Selepas (%)</label>
          <input
            id="int-after"
            v-model="form.afterAccuracy"
            type="number"
            step="0.1"
            name="after_accuracy"
            placeholder="Isi selepas semakan"
            :class="FORM_INPUT_CLASS"
            data-testid="int-after"
          />
        </div>
        <div class="min-w-0">
          <label :class="LABEL" for="int-after-mood">Mood Selepas</label>
          <select
            id="int-after-mood"
            v-model="form.afterMood"
            name="after_mood"
            :class="FORM_SELECT_CLASS"
            data-testid="int-after-mood"
          >
            <option value="">-- Pilih --</option>
            <option v-for="m in MOODS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        :disabled="saving"
        class="flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        data-testid="int-submit"
      >
        <Save class="h-4 w-4" />Simpan Intervensi
      </button>
    </form>
  </section>
</template>
