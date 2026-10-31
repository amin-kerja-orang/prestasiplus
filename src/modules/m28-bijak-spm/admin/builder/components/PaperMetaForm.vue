<script setup lang="ts">
/**
 * "Kemas kini metadata" of Semak Kertas (S4.4; V2 cloud-student-mechanism 3.4): Tahun, Tempoh
 * (minit), Kod kertas (read-only: not in the contract) and the cover instructions, one line per
 * numbered instruction. The title is edited in the page header.
 */
import { computed, ref, watch } from 'vue'

import type { AdminPaper } from '../../../domain/admin-types'
import { builderCopy as t } from '../domain/copy'
import type { HeaderPatch } from '../server/api'

const props = defineProps<{ paper: AdminPaper; readonly?: boolean; busy?: boolean }>()
/** The set title, shared with the page header so both fields stay in sync. */
const title = defineModel<string>('title', { required: true })
const emit = defineEmits<{ save: [patch: HeaderPatch] }>()

const year = ref('')
const duration = ref('')
const lines = ref('')

watch(
  () => props.paper,
  (p) => {
    year.value = String(p.year)
    duration.value = String(p.durationMin)
    lines.value = p.instructions.join('\n')
  },
  { immediate: true },
)

const parsedYear = computed(() => Number(year.value))
const parsedDuration = computed(() => Number(duration.value))
const titleOk = computed(() => title.value.trim().length > 0 && title.value.trim().length <= 200)
const valid = computed(
  () =>
    titleOk.value &&
    Number.isInteger(parsedYear.value) &&
    parsedYear.value >= 1900 &&
    parsedYear.value <= 2100 &&
    Number.isInteger(parsedDuration.value) &&
    parsedDuration.value >= 1 &&
    parsedDuration.value <= 600,
)

function submit(): void {
  if (!valid.value || props.readonly) return
  emit('save', {
    title: title.value.trim(),
    year: parsedYear.value,
    durationMin: parsedDuration.value,
    instructions: lines.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  })
}
</script>

<template>
  <form class="flex flex-col gap-3" data-testid="meta-form" @submit.prevent="submit">
    <h3 class="text-heading text-highlighted">{{ t.meta }}</h3>
    <UFormField :label="t.fTitle" required :error="titleOk ? undefined : t.titleRequired">
      <UInput v-model="title" class="w-full" :disabled="readonly" :aria-label="t.fTitle" data-testid="meta-title" />
    </UFormField>
    <div class="grid gap-3 sm:grid-cols-3">
      <UFormField :label="t.fYear">
        <UInput
          v-model="year"
          type="number"
          inputmode="numeric"
          min="1900"
          max="2100"
          class="w-full"
          :disabled="readonly"
          :aria-label="t.metaYearAria"
          data-testid="meta-year"
        />
      </UFormField>
      <UFormField :label="t.fDuration">
        <UInput
          v-model="duration"
          type="number"
          inputmode="numeric"
          min="1"
          max="600"
          class="w-full"
          :disabled="readonly"
          data-testid="meta-duration"
        />
      </UFormField>
      <UFormField :label="t.fCode">
        <UInput :model-value="paper.code" readonly disabled class="w-full" data-testid="meta-code" />
      </UFormField>
    </div>
    <UFormField :label="t.fInstructions" :hint="t.fInstructionsHint">
      <UTextarea
        v-model="lines"
        :rows="4"
        autoresize
        class="w-full"
        :disabled="readonly"
        data-testid="meta-instructions"
      />
    </UFormField>
    <UButton
      v-if="!readonly"
      type="submit"
      icon="i-ph-floppy-disk"
      :label="t.metaSave"
      class="min-h-11 self-start"
      :loading="busy"
      :disabled="!valid"
      data-testid="meta-save"
    />
  </form>
</template>
