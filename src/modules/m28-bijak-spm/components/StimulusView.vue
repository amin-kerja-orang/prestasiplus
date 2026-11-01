<script setup lang="ts">
/**
 * A stimulus (Rajah, petikan, jadual, gambar). Seven kinds (R1-04): passage, image, diagram, table, map,
 * infographic, graph. A stimulus with a stored picture is drawn by the shared `StimulusFigure` (P5: reserved
 * box, lazy load, "Rajah tidak dapat dimuatkan." with "Cuba lagi" and "Lapor", AC-07.4); a bundled SVG
 * follows the theme; a passage and a table are inline. A stimulus is shown once per group above all its
 * member questions and is never a question (D90).
 * `thumb` is the 48 px slot of the sticky strip below `lg`: a figure shrinks into it, a passage or a
 * table shows an icon tile instead (the full content only opens in the sheet).
 */
import { computed } from 'vue'

import { StimulusFigure } from '../../../components/question-display'
import { DsIconChip } from '@/ds'

import type { StimulusDef } from '../domain/types'
import { toStimulusData } from '../lib/stimulus-data'
import RichText from './RichText.vue'

const props = withDefaults(defineProps<{ stimulus: StimulusDef; thumb?: boolean }>(), {
  thumb: false,
})
const emit = defineEmits<{
  /** The picture finished loading. */
  loaded: []
  /** The picture failed to load (the parent decides whether Seterusnya stays enabled). */
  error: []
  retry: []
  report: []
}>()

const tableColumns = computed(() =>
  (props.stimulus.table?.head ?? []).map((h, i) => ({ accessorKey: `c${i}`, header: h })),
)
const tableRows = computed(() =>
  (props.stimulus.table?.rows ?? []).map((r) => Object.fromEntries(r.map((c, i) => [`c${i}`, c]))),
)
/** A stored picture that is not hidden behind a real table. */
const picture = computed(() => !!props.stimulus.image && !props.stimulus.table)
const figure = computed(() => toStimulusData(props.stimulus))
</script>

<template>
  <figure
    v-if="thumb"
    class="flex flex-col gap-2"
    data-testid="stimulus-thumb"
    :data-stimulus="stimulus.id"
  >
    <img
      v-if="picture && stimulus.image"
      :src="stimulus.image.url"
      alt=""
      width="48"
      height="48"
      loading="lazy"
      class="mx-auto size-12 rounded-lg bg-muted object-cover"
      data-testid="stimulus-thumb-img"
    />
    <DsIconChip
      v-else
      :icon="stimulus.table ? 'table' : 'file-text'"
      tone="neutral"
      size="lg"
      :data-kind="stimulus.table ? 'table' : 'passage'"
      data-testid="stimulus-thumb-icon"
    />
  </figure>

  <StimulusFigure
    v-else-if="picture"
    :stimulus="figure"
    :data-stimulus="stimulus.id"
    @loaded="emit('loaded')"
    @error="emit('error')"
    @retry="emit('retry')"
    @report="emit('report')"
  />

  <figure v-else class="flex flex-col gap-2" data-testid="stimulus" :data-stimulus="stimulus.id">
    <div v-if="stimulus.text" class="rounded-xl bg-muted p-3 text-body text-default">
      <p v-if="stimulus.title" class="mb-2 font-semibold text-highlighted">{{ stimulus.title }}</p>
      <p><RichText :text="stimulus.text" /></p>
      <p v-if="stimulus.source" class="mt-2 text-caption text-muted">{{ stimulus.source }}</p>
    </div>
    <div v-else-if="stimulus.table" class="max-w-full overflow-x-auto rounded-xl bg-muted p-2">
      <UTable :data="tableRows" :columns="tableColumns" :aria-label="stimulus.alt" />
    </div>
    <figcaption class="text-center text-caption text-muted">
      <span class="font-semibold text-toned">{{ stimulus.label }}</span>
      <template v-if="stimulus.caption"> · {{ stimulus.caption }}</template>
    </figcaption>
  </figure>
</template>
