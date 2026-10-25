<script setup lang="ts">
/**
 * Holder of a wide table of a Command Center dialog (G5-M10 B3; NFR-RESP-05 b). The DS drill table scrolls
 * inside its own container; when it does not fit (a phone, or a narrow window), this line above it says so,
 * because a swipe inside a dialog is otherwise unmarked and the last columns ("Tindakan") look missing.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { DsStack, DsText } from '@/ds'

import { S2_COPY } from './copy'

const stack = ref<InstanceType<typeof DsStack>>()
const root = () => stack.value?.$el as HTMLElement | undefined
const overflowing = ref(false)
let observer: ResizeObserver | undefined

function measure() {
  // the DS drill table and the `UTable` inside it are both scroll containers; whichever one overflows
  const boxes = root()?.querySelectorAll<HTMLElement>('[data-ds="drill-table"], [data-slot="root"]')
  overflowing.value = Array.from(boxes ?? []).some((b) => b.scrollWidth > b.clientWidth + 1)
}

onMounted(() => {
  measure()
  const el = root()
  if (!el || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  observer.observe(el)
  const table = el.querySelector('table')
  if (table) observer.observe(table)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <DsStack ref="stack" gap="xs">
    <DsText v-if="overflowing" variant="caption" data-testid="cc-scroll-hint">
      {{ S2_COPY.scrollHint }}
    </DsText>
    <slot />
  </DsStack>
</template>
