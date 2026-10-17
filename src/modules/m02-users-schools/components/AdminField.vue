<script setup lang="ts">
/**
 * Form row of the staff forms: icon + label ("*" when required, "(Pilihan)" when optional), the control
 * in the default slot, an optional hint and an optional field error under it.
 */
defineProps<{
  for?: string
  label: string
  /** Phosphor icon class, e.g. `i-ph-user`. */
  icon?: string
  required?: boolean
  optional?: boolean
  hint?: string
  /** Server message for this field (BM); shown in the error colour. */
  error?: string
}>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <label v-if="label" :for="$props.for" class="flex items-center gap-2 text-label text-default">
      <UIcon v-if="icon" :name="icon" class="size-4 text-muted" aria-hidden="true" />
      {{ label }}
      <span v-if="required" class="text-error">*</span>
      <span v-if="optional" class="text-caption text-muted">(Pilihan)</span>
    </label>
    <slot />
    <p v-if="hint" class="text-caption text-muted">{{ hint }}</p>
    <p v-if="error" class="text-caption text-error" role="alert">{{ error }}</p>
  </div>
</template>
