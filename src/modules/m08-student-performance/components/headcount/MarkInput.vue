<script setup lang="ts">
import { DsStack, DsText } from '@/ds'

/**
 * One mark field of the headcount forms (Key-in AR, Edit TOV/ETR, Tetapan): a number 0-100 with
 * step 0.1 (decision 11) and its inline error line ("Markah mesti antara 0 dan 100."). The value is the
 * typed text; `parseMark` (lib/headcount/otr) turns it into a number or an error. Empty is allowed.
 */
withDefaults(
  defineProps<{
    /** Accessible name (the field has no visible label inside a table row). */
    label: string
    error?: string | undefined
    step?: string
    max?: string
    type?: 'number' | 'date'
  }>(),
  { error: undefined, step: '0.1', max: '100', type: 'number' },
)
const model = defineModel<string | undefined>({ default: '' })
</script>

<template>
  <DsStack gap="2xs">
    <UInput
      :model-value="model"
      :type="type"
      :inputmode="type === 'number' ? 'decimal' : undefined"
      :step="type === 'number' ? step : undefined"
      :min="type === 'number' ? '0' : undefined"
      :max="max"
      size="lg"
      class="w-full"
      :aria-label="label"
      :aria-invalid="error ? 'true' : undefined"
      @update:model-value="(v: string | number | null | undefined) => (model = v == null ? '' : String(v))"
    />
    <DsText v-if="error" as="p" variant="caption" tone="error" role="alert">{{ error }}</DsText>
  </DsStack>
</template>
