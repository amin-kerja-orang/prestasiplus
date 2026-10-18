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
  <div v-if="native" class="flex min-w-0 flex-col gap-2" data-ds="form-field">
    <label :for="controlId" class="text-label text-default">
      {{ label }}
      <template v-if="required">
        <span class="text-error" aria-hidden="true">*</span>
        <span class="sr-only">{{ dsCopy.required }}</span>
      </template>
      <slot name="label-extra" />
    </label>
    <p v-if="description" class="text-caption text-muted">{{ description }}</p>
    <slot :id="controlId" :describedby="describedby" :invalid="invalid" />
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
    data-ds="form-field"
  >
    <template v-if="$slots['label-extra']" #label>
      {{ label }}<slot name="label-extra" />
    </template>
    <template v-if="error" #error="{ error: msg }">
      <span class="flex items-start gap-1" role="alert" data-testid="field-error">
        <UIcon name="i-ph-warning-circle" class="mt-px size-4 shrink-0" aria-hidden="true" />
        <span>{{ msg }}</span>
      </span>
    </template>
    <slot :id="controlId" :describedby="describedby" :invalid="invalid" />
  </UFormField>
</template>
