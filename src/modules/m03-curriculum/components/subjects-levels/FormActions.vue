<script setup lang="ts">
/**
 * The form button row of S7, S8, S10 and S11 (FR-99): "Batal" and the submit button side by side,
 * right-aligned, below a top border at every width (live `flex justify-end space-x-3 pt-4
 * border-t`; they fit at 375 px). The submit uses the screen accent (indigo for subjects, pink for
 * levels).
 */
import { Save } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'

import { ACCENT_BUTTON_CLASS, type Accent } from '../../lib/subjects-levels'

withDefaults(
  defineProps<{ cancelTo: string; submitLabel: string; saving?: boolean; accent?: Accent }>(),
  { saving: false, accent: 'indigo' },
)
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
      :class="[
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:px-6',
        ACCENT_BUTTON_CLASS[accent],
      ]"
      data-testid="form-submit"
    >
      <LoadingSpinner v-if="saving" class="h-4 w-4" />
      <Save v-else class="h-4 w-4" aria-hidden="true" />
      {{ submitLabel }}
    </button>
  </div>
</template>
