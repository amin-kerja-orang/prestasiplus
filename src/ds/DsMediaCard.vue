<script setup lang="ts">
/**
 * Media card for video / article / audio: 16:9 thumbnail (a plain image through `DsArt3D`, or a
 * glyph when there is none), duration and category chips, a two-line title, a meta line and an
 * optional progress bar. With `to` the title is a link that covers the card.
 */
import { computed } from 'vue'

import DsArt3D from './DsArt3D.vue'

type MediaKind = 'video' | 'article' | 'audio'

const props = withDefaults(
  defineProps<{
    kind?: MediaKind
    title: string
    thumb?: string
    /** Alt text of the thumbnail; empty = decorative. */
    thumbAlt?: string
    duration?: string
    category?: string
    meta?: string
    /** 0-100. */
    progress?: number
    progressLabel?: string
    to?: string
  }>(),
  {
    kind: 'video',
    thumb: undefined,
    thumbAlt: '',
    duration: undefined,
    category: undefined,
    meta: undefined,
    progress: undefined,
    progressLabel: 'Kemajuan',
    to: undefined,
  },
)

const glyph = computed(
  () =>
    ({
      video: 'i-ph-play-circle-duotone',
      article: 'i-ph-article-duotone',
      audio: 'i-ph-headphones-duotone',
    })[props.kind],
)
</script>

<template>
  <UCard class="relative overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }" data-ds="media-card">
    <div class="relative aspect-video w-full bg-elevated">
      <DsArt3D v-if="thumb" variant="plain" :src="thumb" :alt="thumbAlt" ratio="video" />
      <span v-else class="grid size-full place-items-center text-muted" aria-hidden="true">
        <UIcon :name="glyph" class="size-12" />
      </span>
      <span class="absolute start-2 bottom-2 flex gap-1">
        <UBadge v-if="duration" color="neutral" variant="solid" size="sm" :label="duration" class="tabular" />
        <UBadge v-if="category" color="neutral" variant="soft" size="sm" :label="category" />
      </span>
    </div>
    <div class="flex flex-col gap-2 p-3 sm:p-4">
      <h3 class="line-clamp-2 text-label text-highlighted" data-ds="media-title">
        <ULink v-if="to" :to="to">{{ title }}</ULink>
        <template v-else>{{ title }}</template>
      </h3>
      <p v-if="meta" class="truncate text-caption text-muted">{{ meta }}</p>
      <UProgress v-if="progress !== undefined" :model-value="progress" size="sm" :aria-label="progressLabel" />
    </div>
  </UCard>
</template>
