<script setup lang="ts">
/**
 * "Tahap Pendidikan" radio cards (FR-M02-23, FR-M02-39): "Sekolah Rendah" Darjah 1-6 (grade 1-6) and
 * "Sekolah Menengah" Ting. 1-5 (grade 7-11). Two card-variant `URadioGroup`s that behave as one choice:
 * none checked until the admin picks (S2); the checked card carries the primary tone. Each card is a
 * radio (arrow keys work), at least 44 px high.
 */
import { PRIMARY_GRADES, SECONDARY_GRADES, type GradeOption } from '../lib/user-form-options'

const model = defineModel<number | null>({ required: true })

const groups: { title: string; grades: readonly GradeOption[] }[] = [
  { title: 'Sekolah Rendah', grades: PRIMARY_GRADES },
  { title: 'Sekolah Menengah', grades: SECONDARY_GRADES },
]

function items(grades: readonly GradeOption[]): { value: number; label: string }[] {
  return grades.map((g) => ({ value: g.value, label: g.label }))
}

function current(grades: readonly GradeOption[]): number | undefined {
  const value = model.value
  return value !== null && grades.some((g) => g.value === value) ? value : undefined
}

function pick(value: unknown): void {
  if (typeof value === 'number') model.value = value
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2" data-testid="grade-cards">
    <p class="text-label text-default">Tahap Pendidikan</p>
    <div v-for="group in groups" :key="group.title" class="flex flex-col gap-1">
      <p class="text-caption text-muted">{{ group.title }}</p>
      <URadioGroup
        :model-value="current(group.grades)"
        :items="items(group.grades)"
        :legend="group.title"
        variant="card"
        color="info"
        indicator="hidden"
        orientation="horizontal"
        name="grade"
        :ui="{
          fieldset: 'grid grid-cols-3 gap-2 sm:grid-cols-6',
          item: 'min-h-11 items-center justify-center bg-elevated p-2 text-center',
          wrapper: 'w-full text-center',
          legend: 'sr-only',
        }"
        @update:model-value="pick"
      />
    </div>
  </div>
</template>
