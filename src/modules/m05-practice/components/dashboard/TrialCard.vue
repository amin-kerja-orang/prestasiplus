<script setup lang="ts">
/** FR-M05-03: the amber free-trial card (shown only while `trial.active`). */
import { Hourglass, Rocket } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { TrialStatus } from '../../api/types'

defineProps<{ trial: TrialStatus }>()
</script>

<template>
  <div
    class="rounded-2xl border-2 border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-5 shadow-sm"
    data-testid="dash-trial"
  >
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div
          class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-orange-500 shadow-lg"
        >
          <Hourglass class="h-5 w-5 text-white" />
        </div>
        <div>
          <div class="mb-0.5 text-xs font-bold tracking-wide text-amber-700 uppercase">
            Percubaan Percuma
          </div>
          <div class="font-semibold text-slate-800" data-testid="dash-trial-remaining">
            Baki {{ trial.remaining }} / {{ trial.limit }} soalan
          </div>
        </div>
      </div>
      <RouterLink
        to="/pricing"
        class="relative inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition after:absolute after:inset-x-0 after:-inset-y-1 hover:from-amber-600 hover:to-orange-600"
        data-testid="dash-trial-link"
      >
        <Rocket class="h-4 w-4" />
        Langgan Sekarang
      </RouterLink>
    </div>
  </div>
</template>
