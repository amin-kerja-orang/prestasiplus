<script setup lang="ts">
/**
 * S6 example box (FN-M21-4.2.4, FR-M21-47): a click replaces the textarea value with the example text,
 * leading "• " included, client side only (no request). Each example is a real button (keyboard).
 */
import { Lightbulb } from '@lucide/vue'

import { MOHON_COPY, REASON_EXAMPLES } from './mohon-copy'

const emit = defineEmits<{ pick: [text: string] }>()
</script>

<template>
  <div class="rounded-xl bg-slate-50 p-3" data-testid="mohon-examples">
    <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
      <Lightbulb class="h-4 w-4 shrink-0 text-amber-500" />
      {{ MOHON_COPY.examplesTitle }}
    </p>
    <ul class="mt-2 space-y-1.5">
      <li v-for="(text, i) in REASON_EXAMPLES" :key="i">
        <button
          type="button"
          class="block min-h-11 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 focus:ring-2 focus:ring-blue-300 focus:outline-none"
          data-testid="mohon-example"
          @click="emit('pick', text)"
        >
          {{ text }}
        </button>
      </li>
    </ul>
    <p class="mt-2 text-xs text-slate-500 italic">{{ MOHON_COPY.examplesNote }}</p>
  </div>
</template>
