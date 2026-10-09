<script setup lang="ts">
/**
 * The "Tahap" field of the room create forms (URS FN-M16-5.1.2, 5.4.2): the auto box with the grade of the
 * profile and "Tukar", then the `grade_level` select with its optgroups. Papan Bijak can return with
 * "← Guna auto"; the S8–S12 lobbies cannot ("Tukar" is one-way, as live). An account without a grade
 * starts on the select (INFERRED).
 */
import { computed, ref, useId } from 'vue'

import { FORM_SELECT_CLASS } from '@/components/form/classes'

import { GRADE_GROUPS } from './lobby-config'

const props = defineProps<{
  label: string
  /** Grade of the profile as a `grade_level` value, or null. */
  autoGrade: string | null
  autoGradeName: string | null
  /** "(auto dari profil anda)" on S7, "(auto)" on S8–S12. */
  autoHint: string
  /** S7 only: "← Guna auto" returns to the auto box. */
  allowBack: boolean
}>()

const model = defineModel<string>({ required: true })

const manual = ref(props.autoGrade === null)
const selectId = useId()
const hasAuto = computed(() => props.autoGrade !== null)

function switchToManual(): void {
  manual.value = true
}

function switchToAuto(): void {
  if (props.autoGrade === null) return
  model.value = props.autoGrade
  manual.value = false
}
</script>

<template>
  <div data-testid="grade-field">
    <label :for="selectId" class="mb-1 block text-sm font-semibold text-slate-600">{{
      label
    }}</label>
    <div
      v-if="!manual"
      class="flex min-h-11 items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2"
      data-testid="grade-auto"
    >
      <span class="text-sm font-semibold text-slate-700"
        >{{ autoGradeName }}
        <span class="text-xs font-normal text-slate-500">{{ autoHint }}</span></span
      >
      <button
        type="button"
        class="min-h-11 shrink-0 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
        data-testid="grade-switch"
        @click="switchToManual"
      >
        Tukar
      </button>
    </div>
    <div v-else class="flex flex-wrap items-center gap-2">
      <select
        :id="selectId"
        v-model="model"
        :class="[FORM_SELECT_CLASS, 'min-h-11 flex-1']"
        data-testid="grade-select"
      >
        <optgroup v-for="g in GRADE_GROUPS" :key="g.label" :label="g.label">
          <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </optgroup>
      </select>
      <button
        v-if="allowBack && hasAuto"
        type="button"
        class="min-h-11 shrink-0 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
        data-testid="grade-back"
        @click="switchToAuto"
      >
        ← Guna auto
      </button>
    </div>
  </div>
</template>
