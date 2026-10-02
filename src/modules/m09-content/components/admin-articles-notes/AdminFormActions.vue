<script setup lang="ts">
/**
 * Form footer of S2, S3, S6 and S7 (FR-M09-13, FR-M09-17, FR-M09-46): "Batal" and the submit
 * button on one right-aligned row at every width, below a top border.
 */
import { Save } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

import { PRIMARY_BUTTON_CLASS } from '../../lib/admin-articles-notes'

withDefaults(defineProps<{ cancelTo: string; submitLabel: string; saving?: boolean }>(), {
  saving: false,
})
</script>

<template>
  <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
    <RouterLink
      :to="cancelTo"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:px-6"
      data-testid="form-cancel"
    >
      Batal
    </RouterLink>
    <button
      type="submit"
      :disabled="saving"
      :class="[PRIMARY_BUTTON_CLASS, 'disabled:cursor-not-allowed disabled:opacity-50 sm:px-6']"
      data-testid="form-submit"
    >
      <LoadingSpinner v-if="saving" class="h-4 w-4" />
      <Save v-else class="h-4 w-4" aria-hidden="true" />
      {{ submitLabel }}
    </button>
  </div>
</template>
