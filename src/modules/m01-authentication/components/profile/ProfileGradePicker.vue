<script setup lang="ts">
/**
 * S8 "Tahap" radio cards (FR-M01-40). One group only: Darjah 1-6 (grade null or 1-6) or Ting. 1-5
 * (grade 7-11, INFERRED, OQ-5). The radios are `hidden` (display:none) as on live (D10, no added focus ring); the labels are the cards and the
 * checked one carries the indigo -> purple gradient. Shown for every role, as live. Darjah is 6 columns from 360px (live), 3 columns below it so the
 * 44px targets and the "Darjah" label fit at 320px (D9 deviation candidate).
 */
import { Building, GraduationCap, School } from '@lucide/vue'
import { computed } from 'vue'

import { DARJAH_GRADES, TINGKATAN_GRADES } from '../../lib/lookups'
import { PROFILE_LABEL_CLASS } from './classes'

const props = defineProps<{
  modelValue: number | null
  /** The group of the saved grade (7-11 = secondary); it does not switch while the user edits. */
  secondary: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [grade: number] }>()

interface Option {
  value: number
  prefix: string
  n: number
}

const options = computed<Option[]>(() =>
  props.secondary
    ? TINGKATAN_GRADES.map((n) => ({ value: n + 6, prefix: 'Ting.', n }))
    : DARJAH_GRADES.map((n) => ({ value: n, prefix: 'Darjah', n })),
)
</script>

<template>
  <div class="min-w-0" data-testid="grade-picker">
    <div :class="PROFILE_LABEL_CLASS">
      <GraduationCap class="h-4 w-4 text-indigo-500" />
      Tahap
    </div>
    <div
      class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase"
      data-testid="grade-group"
    >
      <Building v-if="secondary" class="h-4 w-4" />
      <School v-else class="h-4 w-4" />
      {{ secondary ? 'Sekolah Menengah' : 'Sekolah Rendah' }}
    </div>
    <div
      class="grid gap-2"
      :class="secondary ? 'grid-cols-5' : 'grid-cols-3 min-[360px]:grid-cols-6'"
      data-testid="grade-grid"
    >
      <label
        v-for="option in options"
        :key="option.value"
        class="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl py-2 text-center transition"
        :class="
          modelValue === option.value
            ? 'text-white shadow-md bg-save-gradient'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        "
        :data-selected="modelValue === option.value"
        :data-testid="`grade-${String(option.value)}`"
      >
        <input
          type="radio"
          name="grade"
          :value="option.value"
          :checked="modelValue === option.value"
          class="hidden"
          @change="emit('update:modelValue', option.value)"
        />
        <span class="text-xs">{{ option.prefix }}</span>
        <span class="text-base font-bold">{{ option.n }}</span>
      </label>
    </div>
  </div>
</template>
