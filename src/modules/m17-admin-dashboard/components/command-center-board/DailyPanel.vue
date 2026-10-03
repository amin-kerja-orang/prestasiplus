<script setup lang="ts">
/**
 * A card of S3 with a coloured dot and an uppercase heading. While the period loads the body shows the
 * spinner and a failed load shows "Gagal memuatkan" (FR-M17-36); the default slot renders when `state` is `ok`.
 */
import { LoadingSpinner } from '@/components/feedback'

import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'

withDefaults(
  defineProps<{
    title: string
    dot: string
    testid: string
    state?: LoadStatus
    heading?: string
  }>(),
  { state: 'ok', heading: undefined },
)
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-800 bg-slate-900 p-4"
    :data-testid="testid"
  >
    <h2
      class="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-300 uppercase"
    >
      <span :class="['h-2 w-2 shrink-0 rounded-full', dot]" />
      <span data-testid="daily-panel-title">{{ heading ?? title }}</span>
    </h2>
    <p
      v-if="state === 'loading'"
      class="flex justify-center py-4 text-slate-400"
      data-testid="daily-loading"
    >
      <LoadingSpinner class="h-5 w-5" />
    </p>
    <p
      v-else-if="state === 'error'"
      class="py-4 text-center text-sm text-rose-400"
      data-testid="daily-error"
    >
      {{ S3_COPY.loadFailed }}
    </p>
    <slot v-else />
  </section>
</template>
