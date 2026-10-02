<script setup lang="ts">
/**
 * A labelled form row of S2, S3, S6 and S7: label (red `*` when required), the control in the slot,
 * and the server field error under it (UNVERIFIED COPY, SRS §8.2). Validation itself is native.
 */
import { FORM_ERROR_TEXT_CLASS } from '@/components/form'

import { FORM_LABEL_CLASS } from '../../lib/admin-articles-notes'

defineProps<{ id: string; label: string; required?: boolean; error?: string }>()
</script>

<template>
  <div class="min-w-0">
    <label :for="id" :class="FORM_LABEL_CLASS"
      >{{ label }} <span v-if="required" class="text-red-500">*</span></label
    >
    <slot />
    <p v-if="error" :class="FORM_ERROR_TEXT_CLASS" data-testid="field-error">{{ error }}</p>
  </div>
</template>
