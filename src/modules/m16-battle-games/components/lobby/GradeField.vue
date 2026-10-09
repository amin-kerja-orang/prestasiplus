<script setup lang="ts">
/**
 * The "Tahap" field of the room create forms (URS FN-M16-5.1.2, 5.4.2): the auto box with the grade of the
 * profile and "Tukar", then the `grade_level` select with its optgroups. Papan Bijak can return with
 * "← Guna auto"; the S8–S12 lobbies cannot ("Tukar" is one-way, as live). An account without a grade
 * starts on the select (INFERRED). `variant` picks the live look: `pb` a violet box with a bordered "Tukar"
 * button, `lobby` a green box with a blue "Tukar" link.
 */
import { computed, ref, useId } from 'vue'

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
  variant: 'pb' | 'lobby'
}>()

const model = defineModel<string>({ required: true })

const manual = ref(props.autoGrade === null)
const selectId = useId()
const hasAuto = computed(() => props.autoGrade !== null)
const pb = computed(() => props.variant === 'pb')

const labelClass = computed(() =>
  pb.value
    ? 'mb-1 block text-xs font-bold tracking-wide text-violet-600 uppercase'
    : 'mb-1 block text-xs font-semibold text-slate-600',
)
const selectClass = computed(() =>
  pb.value
    ? 'min-h-11 min-w-0 flex-1 rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-violet-300'
    : 'min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300',
)

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
    <label :for="selectId" :class="labelClass">{{ label }}</label>
    <div v-if="!manual" class="flex items-center gap-2" data-testid="grade-auto-row">
      <div
        class="flex min-h-11 min-w-0 flex-1 items-center rounded-xl px-3.5 py-2"
        :class="pb ? 'border-2 border-violet-300 bg-violet-50' : 'bg-emerald-50'"
        data-testid="grade-auto"
      >
        <span class="text-sm font-bold" :class="pb ? 'text-violet-700' : 'text-emerald-700'"
          >{{ autoGradeName }}
          <span class="text-xs font-normal" :class="pb ? 'text-violet-500' : 'text-emerald-700'">{{
            autoHint
          }}</span></span
        >
      </div>
      <button
        type="button"
        class="min-h-11 shrink-0 px-2 text-xs"
        :class="
          pb
            ? 'rounded-lg border border-violet-200 bg-white/60 font-semibold text-violet-600'
            : 'font-medium text-blue-600'
        "
        data-testid="grade-switch"
        @click="switchToManual"
      >
        Tukar
      </button>
    </div>
    <div v-else class="flex flex-wrap items-center gap-2">
      <select :id="selectId" v-model="model" :class="selectClass" data-testid="grade-select">
        <optgroup v-for="g in GRADE_GROUPS" :key="g.label" :label="g.label">
          <option v-for="o in g.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </optgroup>
      </select>
      <button
        v-if="allowBack && hasAuto"
        type="button"
        class="min-h-11 shrink-0 px-2 text-xs font-bold text-violet-600 hover:text-violet-700"
        data-testid="grade-back"
        @click="switchToAuto"
      >
        ← Guna auto
      </button>
    </div>
  </div>
</template>
