<script setup lang="ts">
/**
 * "Tahap Pendidikan" radio cards (FR-M02-23, FR-M02-39): "Sekolah Rendah" Darjah 1-6 (grade 1-6) and
 * "Sekolah Menengah" Ting. 1-5 (grade 7-11). One radio group named `grade`; none checked until the admin
 * picks (S2); the checked card is a violet gradient with white text. Radios are native (arrow keys work),
 * cards are >= 44 px high.
 */
import { GraduationCap } from '@lucide/vue'

import { PRIMARY_GRADES, SECONDARY_GRADES, type GradeOption } from '../lib/user-form-options'

const model = defineModel<number | null>({ required: true })

const CARD =
  'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-1 py-2 text-center text-sm font-medium text-slate-700 transition hover:border-violet-300 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300 peer-checked:border-violet-600 peer-checked:bg-linear-to-r peer-checked:from-violet-600 peer-checked:to-purple-600 peer-checked:text-white'

const groups: { title: string; grades: readonly GradeOption[]; cols: string }[] = [
  { title: 'Sekolah Rendah', grades: PRIMARY_GRADES, cols: 'grid-cols-3 sm:grid-cols-6' },
  { title: 'Sekolah Menengah', grades: SECONDARY_GRADES, cols: 'grid-cols-5' },
]
</script>

<template>
  <div class="min-w-0" data-testid="grade-cards">
    <p class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <GraduationCap class="h-4 w-4 text-indigo-500" aria-hidden="true" />
      Tahap Pendidikan
    </p>
    <div v-for="group in groups" :key="group.title" class="mb-2">
      <p class="mb-1 text-xs text-slate-500">{{ group.title }}</p>
      <div class="grid gap-2" :class="group.cols">
        <label v-for="g in group.grades" :key="g.value" class="block">
          <input
            v-model="model"
            type="radio"
            name="grade"
            :value="g.value"
            class="peer sr-only"
            :data-testid="`grade-${String(g.value)}`"
          />
          <span :class="CARD">{{ g.label }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
