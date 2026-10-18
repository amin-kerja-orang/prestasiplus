<script setup lang="ts">
/**
 * Form row of the M09 admin screens: label ("*" when required), the control in the default slot, an
 * optional hint and the server field error under it (UNVERIFIED COPY, SRS 8.2). Validation itself is native.
 */
defineProps<{
  for?: string
  label: string
  required?: boolean
  hint?: string
  /** Server message for this field (BM). */
  error?: string
}>()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <label :for="$props.for" class="text-label text-default">
      {{ label }}
      <span v-if="required" class="text-error">*</span>
    </label>
    <slot />
    <p v-if="hint" class="text-caption text-muted">{{ hint }}</p>
    <p v-if="error" class="text-caption text-error" role="alert" data-testid="field-error">
      {{ error }}
    </p>
  </div>
</template>
