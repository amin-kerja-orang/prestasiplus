<script setup lang="ts">
/**
 * S6 example box (FN-M21-4.2.4, FR-M21-47): a click replaces the textarea value with the example text,
 * leading "• " included, client side only (no request). Each example is a real button (keyboard).
 */
import { MOHON_COPY, REASON_EXAMPLES } from './mohon-copy'
import { DsSurface } from '@/ds'

const emit = defineEmits<{ pick: [text: string] }>()
</script>

<template>
  <DsSurface level="elevated" radius="chip" padding="sm" :clip="false" data-testid="mohon-examples">
    <p class="flex items-center gap-2 text-label text-highlighted">
      <UIcon name="i-ph-lightbulb-duotone" class="size-4 shrink-0 text-heat" aria-hidden="true" />
      {{ MOHON_COPY.examplesTitle }}
    </p>
    <ul class="mt-2">
      <li v-for="(text, i) in REASON_EXAMPLES" :key="i">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11 w-full justify-start px-2 py-2 text-left text-caption whitespace-normal text-muted"
          data-testid="mohon-example"
          @click="emit('pick', text)"
          >{{ text }}</UButton
        >
      </li>
    </ul>
    <p class="mt-2 text-caption text-muted italic">{{ MOHON_COPY.examplesNote }}</p>
  </DsSurface>
</template>
