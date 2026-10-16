<script setup lang="ts">
/** A shared stimulus (Rajah, petikan, jadual). The diagram is bundled inline SVG that follows the theme. */
import { computed } from 'vue'

import type { StimulusDef } from '../domain/types'
import RichText from './RichText.vue'

const props = withDefaults(defineProps<{ stimulus: StimulusDef; thumb?: boolean }>(), {
  thumb: false,
})

const tableColumns = computed(() =>
  (props.stimulus.table?.head ?? []).map((h, i) => ({ accessorKey: `c${i}`, header: h })),
)
const tableRows = computed(() =>
  (props.stimulus.table?.rows ?? []).map((r) => Object.fromEntries(r.map((c, i) => [`c${i}`, c]))),
)
</script>

<template>
  <figure
    class="flex flex-col gap-2"
    :data-testid="thumb ? 'stimulus-thumb' : 'stimulus'"
    :data-stimulus="stimulus.id"
  >
    <div
      v-if="stimulus.svg"
      class="mx-auto w-full overflow-hidden rounded-xl bg-muted p-2 text-highlighted"
      :class="thumb ? 'max-w-16' : 'max-w-md'"
      role="img"
      :aria-label="stimulus.alt"
    >
      <!-- eslint-disable-next-line vue/no-v-html -- bundled seed SVG, not user input -->
      <div aria-hidden="true" v-html="stimulus.svg" />
    </div>
    <p v-else-if="stimulus.text" class="rounded-xl bg-muted p-3 text-body text-default">
      <RichText :text="stimulus.text" />
    </p>
    <div v-else-if="stimulus.table" class="max-w-full overflow-x-auto rounded-xl bg-muted p-2">
      <UTable :data="tableRows" :columns="tableColumns" :aria-label="stimulus.alt" />
    </div>
    <figcaption v-if="!thumb" class="text-center text-caption text-muted">
      <span class="font-semibold text-toned">{{ stimulus.label }}</span>
      <template v-if="stimulus.caption"> · {{ stimulus.caption }}</template>
    </figcaption>
  </figure>
</template>
