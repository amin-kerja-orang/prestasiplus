<script setup lang="ts">
/**
 * Native `<select>`: the one native control the design system keeps, for browser `required`
 * validation, a blank "Pilih" option and options that reload under the user. Radius sm (8), cozy
 * 44px height, our own caret icon (the browser caret hugged the edge; the select is
 * `appearance-none`). Options come from `items` or as raw `<option>` in the default slot.
 * `class` and `style` land on the wrapper (callers pass widths); every other attribute and
 * listener (id, name, data-testid, aria-*) lands on the `<select>`.
 * States: hover, focus-visible, disabled, read-only (not editable, still copyable), loading
 * (`aria-busy`, options reloading), invalid.
 */
import { computed, useAttrs } from 'vue'

import './states.css'
import { dsCopy } from './copy'
import { warnDeprecated } from './deprecate'
import DsIcon from './DsIcon.vue'

defineOptions({ inheritAttrs: false })

export interface NativeSelectItem {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Text of the blank first option; give `blank` for the default "Pilih". */
    placeholder?: string | boolean
    /** Adds a blank first option with the default "Pilih" (or `placeholder` text). */
    blank?: boolean
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    loading?: boolean
    invalid?: boolean
    size?: 'md' | 'lg'
    items?: readonly NativeSelectItem[]
  }>(),
  {
    placeholder: undefined,
    blank: false,
    required: false,
    disabled: false,
    readonly: false,
    loading: false,
    invalid: false,
    size: 'md',
    items: undefined,
  },
)

if (typeof props.placeholder === 'boolean') {
  warnDeprecated('DsNativeSelect', 'placeholder (boolean)', 'blank')
}

const model = defineModel<string | number>({ default: '' })

const attrs = useAttrs()
const wrapperAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const selectAttrs = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.style
  return rest
})

const showBlank = computed(
  () => props.blank || props.placeholder === true || typeof props.placeholder === 'string',
)
const blankText = computed(() =>
  typeof props.placeholder === 'string' ? props.placeholder : dsCopy.selectPlaceholder,
)
// A native select has no `readonly`: the options are locked through pointer and keyboard.
const locked = computed(() => props.disabled || props.readonly || props.loading)
</script>

<template>
  <span v-bind="wrapperAttrs" class="relative block min-w-0">
    <!-- The one sanctioned native control (consolidation A3): browser required, blank option, live options. -->
    <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
    <select
      v-bind="selectAttrs"
      v-model="model"
      :required="required"
      :disabled="disabled"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-readonly="readonly ? 'true' : undefined"
      :aria-busy="loading ? 'true' : undefined"
      class="w-full min-w-0 rounded-chip py-2 pr-10 pl-3 text-body text-default disabled:text-dimmed"
      :class="[
        size === 'lg' ? 'min-h-12' : 'min-h-11',
        invalid ? 'bg-error/10' : readonly ? 'bg-soft' : 'bg-elevated',
        readonly || loading ? 'pointer-events-none' : 'hover:bg-accented',
        loading ? 'animate-pulse' : '',
      ]"
      :data-state="invalid ? 'invalid' : loading ? 'loading' : readonly ? 'read-only' : undefined"
      data-ds="native-select"
      @keydown="(e: KeyboardEvent) => locked && !disabled && e.key !== 'Tab' && e.preventDefault()"
    >
      <option v-if="showBlank" value="">{{ blankText }}</option>
      <template v-if="items">
        <option v-for="it in items" :key="it.value" :value="it.value" :disabled="it.disabled">
          {{ it.label }}
        </option>
      </template>
      <slot />
    </select>
    <span
      class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center"
      :class="disabled ? 'text-dimmed' : 'text-muted'"
    >
      <DsIcon
        name="caret-down"
        weight="regular"
        aria-hidden="true"
        data-testid="native-select-caret"
        class="size-4"
      />
    </span>
  </span>
</template>
