<script setup lang="ts">
/**
 * One timeline post (S16 list, S18 posts; PROPOSED layout L-5, FR-M08-99): category label, title, date,
 * story and photo thumbnails with captions. Post text is untrusted: every value renders as text.
 */
import type { TimelinePost } from '../../api/types'
import { photoSrc } from '../../lib/timeline/image-src'
import { categoryLabel, postDateText } from '../../lib/timeline/posts'

defineProps<{ post: TimelinePost }>()
</script>

<template>
  <article
    class="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
    data-testid="post-card"
  >
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span
        class="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700"
        data-testid="post-category"
        >{{ categoryLabel(post.category) }}</span
      >
      <span class="text-slate-500" data-testid="post-date">{{ postDateText(post) }}</span>
    </div>
    <h3 class="mt-2 text-base font-bold break-words text-slate-800" data-testid="post-title">
      {{ post.title }}
    </h3>
    <p
      v-if="post.story"
      class="mt-1 text-sm break-words whitespace-pre-line text-slate-600"
      data-testid="post-story"
    >
      {{ post.story }}
    </p>
    <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="post-photos">
      <figure
        v-for="(photo, i) in post.photos"
        :key="i"
        class="min-w-0 overflow-hidden rounded-xl bg-slate-100"
      >
        <img
          :src="photoSrc(photo.url)"
          :alt="photo.caption ?? post.title"
          class="aspect-[4/3] w-full object-cover"
          loading="lazy"
          data-testid="post-photo"
        />
        <figcaption v-if="photo.caption" class="px-2 py-1 text-xs break-words text-slate-600">
          {{ photo.caption }}
        </figcaption>
      </figure>
    </div>
  </article>
</template>
