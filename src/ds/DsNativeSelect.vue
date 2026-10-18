<script setup lang="ts">
/**
 * Native `<select>`: the one native control the design system keeps, for browser `required`
 * validation, a blank "Pilih" option and options that reload under the user. Radius sm (8), cozy
 * 44px height, the browser caret. Options come from `items` or as raw `<option>` in the default slot.
 */
import { dsCopy } from './copy'

export interface NativeSelectItem {
  label: string
  value: string | number
  disabled?: boolean
}

withDefaults(
  defineProps<{
    /** `true` adds a blank first option with the default "Pilih"; a string sets its text. */
    placeholder?: string | boolean
    required?: boolean
    disabled?: boolean
    invalid?: boolean
    items?: readonly NativeSelectItem[]
  }>(),
  { placeholder: false, required: false, disabled: false, invalid: false, items: undefined },
)

const model = defineModel<string | number>({ default: '' })
</script>

<template>
  <!-- The one sanctioned native control (consolidation A3): browser required, blank option, live options. -->
  <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
  <select
    v-model="model"
    :required="required"
    :disabled="disabled"
    :aria-invalid="invalid ? 'true' : undefined"
    class="min-h-11 w-full min-w-0 rounded-chip px-3 py-2 text-body text-default disabled:text-dimmed"
    :class="invalid ? 'bg-error/10' : 'bg-elevated'"
    data-ds="native-select"
  >
    <option v-if="placeholder !== false" value="">
      {{ typeof placeholder === 'string' ? placeholder : dsCopy.selectPlaceholder }}
    </option>
    <template v-if="items">
      <option v-for="it in items" :key="it.value" :value="it.value" :disabled="it.disabled">
        {{ it.label }}
      </option>
    </template>
    <slot />
  </select>
</template>
