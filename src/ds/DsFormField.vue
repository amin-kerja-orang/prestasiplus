<script setup lang="ts">
/**
 * Form row: label (`*` plus a screen-reader "wajib" when required), the control, hint and the
 * server error (`data-testid="field-error"`, `role="alert"`). Default mode wraps `UFormField`, so
 * `UForm` validation reaches the control. `native` mode has no form context: it keeps browser
 * `required` validation and hands `id`, `describedby` and `invalid` to the slotted control.
 */
import { computed, useId } from 'vue'

import { dsCopy } from './copy'

const props = withDefaults(
  defineProps<{
    label: string
    name?: string
    /** Id of the control; generated in `native` mode when absent. */
    for?: string
    required?: boolean
    hint?: string
    help?: string
    description?: string
    /** Server / manual error message (BM). */
    error?: string
    native?: boolean
    size?: 'md' | 'lg'
    /** Visible and copyable, not editable: slotted control gets `readonly`; field sits on `bg-soft`. */
    readonly?: boolean
    /** The control cannot be used. */
    disabled?: boolean
    /** The value is being loaded (`aria-busy`, skeleton text under the label). */
    loading?: boolean
  }>(),
  {
    name: undefined,
    for: undefined,
    required: false,
    hint: undefined,
    help: undefined,
    description: undefined,
    error: undefined,
    native: false,
    size: 'md',
    readonly: false,
    disabled: false,
    loading: false,
  },
)

const uid = useId()
const controlId = computed(() => props.for ?? `f-${uid}`)
const hintId = computed(() => `${controlId.value}-hint`)
const errorId = computed(() => `${controlId.value}-error`)
const describedby = computed(() => {
  const ids: string[] = []
  if (props.hint ?? props.help) ids.push(hintId.value)
  if (props.error) ids.push(errorId.value)
  return ids.length ? ids.join(' ') : undefined
})
const invalid = computed(() => Boolean(props.error))
</script>

<template>
  <div
    v-if="native"
    class="flex min-w-0 flex-col gap-2"
    :aria-busy="loading ? 'true' : undefined"
    :data-state="error ? 'error' : loading ? 'loading' : readonly ? 'read-only' : disabled ? 'disabled' : undefined"
    data-ds="form-field"
  >
    <label :for="controlId" class="text-label text-default">
      {{ label }}
      <template v-if="required">
        <span class="text-error" aria-hidden="true">*</span>
        <span class="sr-only">{{ dsCopy.required }}</span>
      </template>
      <slot name="label-extra" />
    </label>
    <p v-if="description" class="text-caption text-muted">{{ description }}</p>
    <USkeleton v-if="loading" class="h-11 w-full rounded-chip" />
    <slot
      v-else
      :id="controlId"
      :describedby="describedby"
      :invalid="invalid"
      :readonly="readonly"
      :disabled="disabled"
    />
    <p v-if="hint ?? help" :id="hintId" class="text-caption text-muted">
      <slot name="hint">{{ hint ?? help }}</slot>
    </p>
    <p
      v-if="error"
      :id="errorId"
      class="flex items-start gap-1 text-caption text-error"
      role="alert"
      data-testid="field-error"
    >
      <UIcon name="i-ph-warning-circle" class="mt-px size-4 shrink-0" aria-hidden="true" />
      <span>{{ error }}</span>
    </p>
  </div>
  <UFormField
    v-else
    :name="name"
    :label="label"
    :required="required"
    :hint="hint"
    :help="help"
    :description="description"
    :error="error"
    :size="size"
    class="min-w-0"
    :aria-busy="loading ? 'true' : undefined"
    :data-state="error ? 'error' : loading ? 'loading' : readonly ? 'read-only' : disabled ? 'disabled' : undefined"
    data-ds="form-field"
  >
    <template v-if="$slots['label-extra']" #label>
      {{ label }}<slot name="label-extra" />
    </template>
    <!-- Only with a caller-supplied error: a defined `#error` slot makes UFormField render its (empty) error row. -->
    <template v-if="error" #error="{ error: msg }">
      <span class="flex items-start gap-1" role="alert" data-testid="field-error">
        <UIcon name="i-ph-warning-circle" class="mt-px size-4 shrink-0" aria-hidden="true" />
        <span>{{ msg }}</span>
      </span>
    </template>
    <USkeleton v-if="loading" class="h-11 w-full rounded-chip" />
    <slot
      v-else
      :id="controlId"
      :describedby="describedby"
      :invalid="invalid"
      :readonly="readonly"
      :disabled="disabled"
    />
  </UFormField>
</template>
