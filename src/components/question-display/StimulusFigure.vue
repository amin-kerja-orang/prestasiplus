<script setup lang="ts">
/**
 * One stimulus, rendered by `kind` (US-11, design 11.3): passage, image, diagram, table, map,
 * infographic, graph. Always a `<figure>` with reserved dimensions and lazy loading (no layout
 * shift, NFR-03). A picture that fails shows "Rajah tidak dapat dimuatkan." with "Cuba lagi" and
 * "Lapor" (AC-07.4 / AC-11.9); the parent decides whether Seterusnya stays enabled (`error`).
 * Display only: no store, no fetch.
 */
import { computed, ref, watch } from 'vue'

import { kindFallbackCaption, qdCopy, sourceLine } from './copy'
import { canRender, unrenderableReason } from './lib/stimulus-data'
import NotServedNotice from './NotServedNotice.vue'
import StimulusZoom from './StimulusZoom.vue'
import type { StimulusData } from './types'

const props = withDefaults(defineProps<{ stimulus: StimulusData; maxHeight?: boolean }>(), {
  maxHeight: true,
})
const emit = defineEmits<{
  /** The picture finished loading. */
  loaded: []
  /** The picture failed to load. */
  error: []
  /** "Cuba lagi" was pressed (the picture is requested again). */
  retry: []
  /** "Lapor" was pressed. */
  report: []
}>()

type Status = 'loading' | 'loaded' | 'error'
const status = ref<Status>('loading')
const attempt = ref(0)

watch(
  () => props.stimulus.src,
  () => {
    status.value = 'loading'
    attempt.value += 1
  },
)

const s = computed(() => props.stimulus)
const isPassage = computed(() => s.value.kind === 'passage')
const isTable = computed(() => s.value.kind === 'table')
/** A table with rows is a real table; an image-only table is a picture with the caption "Jadual". */
const hasRows = computed(() => !!s.value.table && s.value.table.rows.length > 0)
/** A table (any kind) with rows and no picture, or a table-kind with rows, is drawn as a real table. */
const realTable = computed(() => !isPassage.value && hasRows.value && (isTable.value || !s.value.src))
const renderable = computed(() => canRender(s.value))
const emptyReason = computed(() => unrenderableReason(s.value))
const zoomOpen = ref(false)
const hasPicture = computed(
  () => !isPassage.value && !realTable.value && !!s.value.src,
)
const caption = computed(() =>
  realTable.value ? s.value.caption : (s.value.caption ?? (s.value.title ? undefined : kindFallbackCaption[s.value.kind])),
)
const alt = computed(() => s.value.alt ?? s.value.caption ?? kindFallbackCaption[s.value.kind] ?? '')
const ratio = computed(() =>
  s.value.width && s.value.height ? `${s.value.width} / ${s.value.height}` : '4 / 3',
)
const paragraphs = computed(() => (s.value.text ?? '').split(/\n{2,}/).filter(Boolean))

function onLoad(): void {
  status.value = 'loaded'
  emit('loaded')
}
function onError(): void {
  status.value = 'error'
  emit('error')
}
function retry(): void {
  status.value = 'loading'
  attempt.value += 1
  emit('retry')
}
</script>

<template>
  <figure
    class="flex flex-col gap-2"
    data-testid="stimulus"
    :data-kind="stimulus.kind"
    :data-stimulus="stimulus.id"
  >
    <!-- nothing to draw: never an empty figure -->
    <NotServedNotice v-if="!renderable" :reason="emptyReason" data-testid="stimulus-empty" />

    <!-- passage: long lines and maths scroll inside (FR-X6-1) -->
    <div
      v-else-if="isPassage"
      class="max-w-full overflow-x-auto rounded-xl bg-muted p-3 text-body text-default"
      data-testid="stimulus-passage"
    >
      <p v-if="stimulus.title" class="mb-2 font-semibold text-highlighted">{{ stimulus.title }}</p>
      <p v-for="(p, i) in paragraphs" :key="i" class="mb-2 whitespace-pre-line last:mb-0">{{ p }}</p>
    </div>

    <!-- real table: scrolls inside its own container, never the page -->
    <div
      v-else-if="realTable && stimulus.table"
      class="max-w-full overflow-x-auto rounded-xl bg-muted p-2"
      data-testid="stimulus-table-scroll"
      tabindex="0"
      role="region"
      :aria-label="alt || 'Jadual'"
    >
      <table class="w-full border-collapse text-body text-default">
        <caption v-if="stimulus.table.caption" class="pb-2 text-start text-label text-toned">
          {{ stimulus.table.caption }}
        </caption>
        <thead>
          <tr>
            <th
              v-for="(h, i) in stimulus.table.head"
              :key="i"
              scope="col"
              class="px-3 py-2 text-start text-label font-semibold text-highlighted"
            >
              {{ h }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in stimulus.table.rows" :key="r">
            <template v-for="(cell, c) in row" :key="c">
              <th v-if="c === 0" scope="row" class="px-3 py-2 text-start font-semibold">{{ cell }}</th>
              <td v-else class="px-3 py-2">{{ cell }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- picture: reserved box, lazy, failure state -->
    <template v-else-if="hasPicture">
      <div
        v-if="status === 'error'"
        class="flex flex-col items-start gap-3 rounded-xl border border-error bg-default p-3"
        role="alert"
        data-testid="stimulus-failed"
      >
        <p class="flex items-center gap-2 text-body text-error">
          <UIcon name="i-ph-warning-circle" class="size-5 shrink-0" aria-hidden="true" />
          <span>{{ qdCopy.imageFailed }}</span>
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            class="min-h-11"
            data-testid="stimulus-retry"
            @click="retry"
            >{{ qdCopy.retry }}</UButton
          >
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            class="min-h-11"
            data-testid="stimulus-report"
            @click="emit('report')"
            >{{ qdCopy.report }}</UButton
          >
        </div>
      </div>
      <div
        v-else
        class="relative mx-auto w-full overflow-hidden rounded-xl bg-muted"
        :class="maxHeight ? 'max-h-[60vh]' : ''"
        :style="{ aspectRatio: ratio }"
        :data-status="status"
        data-testid="stimulus-picture"
      >
        <img
          :key="attempt"
          :src="stimulus.src"
          :alt="alt"
          :width="stimulus.width"
          :height="stimulus.height"
          loading="lazy"
          decoding="async"
          class="size-full object-contain"
          @load="onLoad"
          @error="onError"
        />
        <UButton
          v-if="status === 'loaded'"
          type="button"
          color="neutral"
          variant="ghost"
          class="absolute inset-0 size-full min-h-11 rounded-none p-0 opacity-0"
          aria-haspopup="dialog"
          :aria-label="alt"
          data-testid="stimulus-zoom-open"
          @click="zoomOpen = true"
        />
      </div>
      <StimulusZoom v-if="stimulus.src" v-model:open="zoomOpen" :src="stimulus.src" :alt="alt" />
    </template>

    <!-- title / body under the picture (image, infographic) -->
    <template v-if="renderable && !isPassage && !isTable && (stimulus.title || stimulus.text)">
      <p v-if="stimulus.title" class="font-semibold text-highlighted" data-testid="stimulus-title">
        {{ stimulus.title }}
      </p>
      <p v-if="stimulus.text" class="whitespace-pre-line text-body text-default">{{ stimulus.text }}</p>
    </template>

    <figcaption
      v-if="renderable && !isPassage && (stimulus.label || caption)"
      class="text-center text-caption text-muted"
      data-testid="stimulus-caption"
    >
      <span v-if="stimulus.label" class="font-semibold text-toned">{{ stimulus.label }}</span>
      <template v-if="stimulus.label && caption"> · </template>
      <template v-if="caption">{{ caption }}</template>
    </figcaption>

    <!-- source line under every kind (FR-PA-37) -->
    <p v-if="renderable && stimulus.source" class="text-caption text-muted" data-testid="stimulus-source">
      {{ sourceLine(stimulus.source) }}
    </p>
  </figure>
</template>
