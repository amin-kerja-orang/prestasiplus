<script setup lang="ts">
/**
 * The form footer of S10 and S11 (FR-M09-56, 59): "Batal" and the submit button on one
 * right-aligned row at every width, below a top border (live `flex justify-end space-x-3 pt-4
 * border-t`). Both are at least 44 px high below `lg` (the touch rule).
 */
import { Save } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

withDefaults(defineProps<{ cancelTo: string; submitLabel: string; saving?: boolean }>(), {
  saving: false,
})
</script>

<template>
  <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
    <RouterLink
      :to="cancelTo"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:px-6"
      data-testid="form-cancel"
    >
      Batal
    </RouterLink>
    <button
      type="submit"
      :disabled="saving"
      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow transition hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
      data-testid="form-submit"
    >
      <LoadingSpinner v-if="saving" class="h-4 w-4" />
      <Save v-else class="h-4 w-4" aria-hidden="true" />
      {{ submitLabel }}
    </button>
  </div>
</template>
