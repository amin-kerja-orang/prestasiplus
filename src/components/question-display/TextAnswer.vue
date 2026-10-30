<script setup lang="ts">
/**
 * `short_text` (single line) and `numeric` (inputmode decimal + optional unit suffix) answer widgets.
 * Verbatim .cloud placeholders and aria labels. `readonly` = Semakan.
 */
import { computed } from 'vue'

import { qdCopy } from './copy'

const props = withDefaults(
  defineProps<{
    mode: 'short_text' | 'numeric'
    modelValue?: string
    unit?: string
    readonly?: boolean
    disabled?: boolean
  }>(),
  { modelValue: '', unit: undefined, readonly: false, disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const numeric = computed(() => props.mode === 'numeric')
</script>

<template>
  <div class="flex w-full items-center gap-2" :data-testid="`answer-${mode}`">
    <UInput
      :model-value="modelValue"
      :placeholder="numeric ? qdCopy.numericPlaceholder : qdCopy.shortTextPlaceholder"
      :aria-label="numeric ? qdCopy.numericAria : qdCopy.shortTextAria"
      :inputmode="numeric ? 'decimal' : undefined"
      :readonly="readonly"
      :disabled="disabled"
      autocomplete="off"
      size="xl"
      class="w-full min-w-0"
      data-testid="answer-input"
      @update:model-value="emit('update:modelValue', String($event ?? ''))"
    />
    <span v-if="numeric && unit" class="shrink-0 text-body text-toned" data-testid="answer-unit">{{
      unit
    }}</span>
  </div>
</template>
