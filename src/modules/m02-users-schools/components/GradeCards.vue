<script setup lang="ts">
/**
 * "Tahap Pendidikan" radio cards (FR-M02-23, FR-M02-39): "Sekolah Rendah" Darjah 1-6 (grade 1-6) and
 * "Sekolah Menengah" Ting. 1-5 (grade 7-11). One radio group named `grade`; none checked until the admin
 * picks (S2); the checked card is filled with the primary colour. Radios are native (arrow keys work),
 * cards are >= 44 px high.
 */
import { PRIMARY_GRADES, SECONDARY_GRADES, type GradeOption } from '../lib/user-form-options'
import NativeChoice from './native/NativeChoice.vue'

const model = defineModel<number | null>({ required: true })

const groups: { title: string; grades: readonly GradeOption[] }[] = [
  { title: 'Sekolah Rendah', grades: PRIMARY_GRADES },
  { title: 'Sekolah Menengah', grades: SECONDARY_GRADES },
]
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2" data-testid="grade-cards">
    <p class="flex items-center gap-2 text-label text-default">
      <UIcon name="i-ph-graduation-cap" class="size-4 text-muted" aria-hidden="true" />
      Tahap Pendidikan
    </p>
    <div v-for="group in groups" :key="group.title" class="flex flex-col gap-1">
      <p class="text-caption text-muted">{{ group.title }}</p>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <NativeChoice
          v-for="g in group.grades"
          :key="g.value"
          v-model="model"
          name="grade"
          :value="g.value"
          :label="g.label"
          :input-testid="`grade-${String(g.value)}`"
        />
      </div>
    </div>
  </div>
</template>
