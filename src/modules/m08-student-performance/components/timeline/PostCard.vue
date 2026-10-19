<script setup lang="ts">
/**
 * One timeline post (S16 list, S18 posts; PROPOSED layout L-5, FR-M08-99): category label, title, date,
 * story and photo thumbnails with captions. Post text is untrusted: every value renders as text.
 */
import { DsPanel } from '@/ds'

import type { TimelinePost } from '../../api/types'
import { photoSrc } from '../../lib/timeline/image-src'
import { categoryLabel, postDateText } from '../../lib/timeline/posts'

defineProps<{ post: TimelinePost }>()
</script>

<template>
  <DsPanel as="article" class="min-w-0" data-testid="post-card">
    <div class="flex flex-wrap items-center gap-2 text-caption">
      <UBadge color="primary" variant="solid" :label="categoryLabel(post.category)" data-testid="post-category" />
      <span class="tabular text-muted" data-testid="post-date">{{ postDateText(post) }}</span>
    </div>
    <h3 class="mt-2 font-display text-heading font-extrabold break-words text-highlighted" data-testid="post-title">
      {{ post.title }}
    </h3>
    <p
      v-if="post.story"
      class="mt-1 text-body break-words whitespace-pre-line text-default"
      data-testid="post-story"
    >
      {{ post.story }}
    </p>
    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="post-photos">
      <figure
        v-for="(photo, i) in post.photos"
        :key="i"
        class="min-w-0 overflow-hidden rounded-card bg-elevated"
      >
        <img
          :src="photoSrc(photo.url)"
          :alt="photo.caption ?? post.title"
          class="aspect-4/3 w-full object-cover"
          loading="lazy"
          data-testid="post-photo"
        />
        <figcaption v-if="photo.caption" class="px-2 py-1 text-caption break-words text-muted">
          {{ photo.caption }}
        </figcaption>
      </figure>
    </div>
  </DsPanel>
</template>
