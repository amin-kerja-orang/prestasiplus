<script setup lang="ts">
/**
 * The "Tahap" field of the room create forms (URS FN-M16-5.1.2, 5.4.2): the auto box with the grade of the
 * profile and "Tukar", then the `grade_level` select with its groups. Papan Bijak can return with
 * "← Guna auto"; the S8–S12 lobbies cannot ("Tukar" is one-way, as live). An account without a grade
 * starts on the select (INFERRED). v2 look: a soft primary chip for the auto grade and a soft "Tukar".
 */
import { computed, ref } from 'vue'

import { GRADE_ITEMS } from './lobby-config'

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
  <UFormField :label="label" data-testid="grade-field">
    <div v-if="!manual" class="flex items-center gap-2" data-testid="grade-auto-row">
      <div
        class="flex min-h-12 min-w-0 flex-1 items-center rounded-card bg-primary-soft px-4"
        data-testid="grade-auto"
      >
        <span class="text-label text-highlighted"
          >{{ autoGradeName }}
          <span class="text-caption text-muted">{{ autoHint }}</span></span
        >
      </div>
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        class="min-h-11 shrink-0"
        data-testid="grade-switch"
        @click="switchToManual"
      >
        Tukar
      </UButton>
    </div>
    <div v-else class="flex flex-wrap items-center gap-2">
      <USelect
        v-model="model"
        :items="[...GRADE_ITEMS]"
        size="xl"
        class="min-w-0 flex-1"
        data-testid="grade-select"
      />
      <UButton
        v-if="allowBack && hasAuto"
        color="primary"
        variant="link"
        size="lg"
        class="min-h-11 shrink-0"
        data-testid="grade-back"
        @click="switchToAuto"
      >
        ← Guna auto
      </UButton>
    </div>
  </UFormField>
</template>
