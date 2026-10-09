<script setup lang="ts">
/**
 * A labelled form row of S6 / S7 / S8: label, the control in the slot and the server field error
 * under it in red (UNVERIFIED COPY, SRS §8.2). Validation itself is native.
 */
import { FORM_ERROR_TEXT_CLASS } from '@/components/form'

import { FORM_LABEL_CLASS } from '../../lib/admin'

defineProps<{ id: string; label?: string; error?: string | undefined }>()
</script>

<template>
  <div class="min-w-0">
    <label v-if="label" :for="id" :class="FORM_LABEL_CLASS">{{ label }}</label>
    <slot />
    <p v-if="error" :class="FORM_ERROR_TEXT_CLASS" data-testid="field-error">{{ error }}</p>
  </div>
</template>
