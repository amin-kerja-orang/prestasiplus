<script setup lang="ts">
/**
 * S1-d: the shortage alert of Jana Kertas (also under "Cuba lagi" on the result page, design 7.4).
 * At most 5 lines (the first is the first failing constraint); the rest sit behind "Tunjuk {n} lagi".
 * Focus moves to the alert when it appears.
 */
import type { BijakGenerateShortage } from '@pp/contract'
import { computed, nextTick, onMounted, ref } from 'vue'

import { SHORTAGE_LINE_CAP, shortageLine } from '../lib/shortage-lines'

const props = defineProps<{ shortages: BijakGenerateShortage[] }>()

const root = ref<HTMLElement | null>(null)
const expanded = ref(false)
const shown = computed(() =>
  expanded.value ? props.shortages : props.shortages.slice(0, SHORTAGE_LINE_CAP),
)
const hidden = computed(() => Math.max(0, props.shortages.length - SHORTAGE_LINE_CAP))

onMounted(async () => {
  await nextTick()
  root.value?.focus()
})
</script>

<template>
  <div ref="root" tabindex="-1" data-testid="shortage-focus">
    <UAlert
      color="warning"
      variant="soft"
      icon="i-ph-warning"
      title="Kertas tidak dapat dijana kerana soalan tidak mencukupi."
      role="alert"
      class="max-w-prose"
      data-testid="shortage"
    >
      <template #description>
        <ul class="flex flex-col gap-1">
          <li v-for="(s, i) in shown" :key="i" class="break-words" data-testid="shortage-line">
            {{ shortageLine(s) }}
          </li>
        </ul>
        <UButton
          v-if="!expanded && hidden > 0"
          color="neutral"
          variant="link"
          class="mt-1 min-h-11 px-0"
          data-testid="shortage-more"
          @click="expanded = true"
          >Tunjuk {{ hidden }} lagi</UButton
        >
        <p class="mt-2 text-caption text-muted" data-testid="shortage-closing">
          Cuba subjek atau kertas lain, atau cuba lagi kemudian.
        </p>
      </template>
    </UAlert>
  </div>
</template>
