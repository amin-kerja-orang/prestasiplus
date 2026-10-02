<script setup lang="ts">
/**
 * "Artikel Paling Hangat" card (FR-M09-28; URS FN-M09-2.1.2): purple-400 → pink-400 → orange-400
 * panel with 📰 and the badge ("PILIHAN" featured / "POPULAR"), category chip, 2-line title,
 * 2-line excerpt, author initial + name and the relative date.
 */
import { Clock, Flame, Star } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { diffForHumans } from '@/lib/time'

import type { HotCard } from '../../api'
import { ARTIKEL_COPY } from '../../lib/artikel/artikel'

const props = defineProps<{ article: HotCard }>()

const featured = computed(() => props.article.badge === 'PILIHAN')
const age = computed(() =>
  props.article.publishedAt ? diffForHumans(props.article.publishedAt) : '',
)
</script>

<template>
  <RouterLink
    :to="`/artikel/${article.slug}`"
    class="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
    data-testid="artikel-hot-card"
    :data-badge="article.badge"
    :data-slug="article.slug"
  >
    <div
      class="relative flex h-32 shrink-0 items-center justify-center bg-linear-to-br from-purple-400 via-pink-400 to-orange-400 text-5xl"
    >
      <span aria-hidden="true">📰</span>
      <span
        class="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow"
        :class="featured ? 'bg-amber-400' : 'bg-red-500'"
        data-testid="artikel-hot-badge"
      >
        <Star v-if="featured" class="h-3 w-3 fill-current" aria-hidden="true" />
        <Flame v-else class="h-3 w-3" aria-hidden="true" />
        {{ featured ? ARTIKEL_COPY.hotFeatured : ARTIKEL_COPY.hotPopular }}
      </span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-2 p-3">
      <div>
        <span
          class="inline-block rounded-full bg-linear-to-r from-blue-500 to-purple-500 px-2 py-0.5 text-[11px] font-semibold text-white"
          data-testid="artikel-hot-category"
          >{{ article.categoryLabel }}</span
        >
      </div>
      <h3 class="line-clamp-2 text-sm font-bold break-words text-gray-800">{{ article.title }}</h3>
      <p v-if="article.excerpt" class="line-clamp-2 text-xs break-words text-gray-600">
        {{ article.excerpt }}
      </p>
      <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-gray-500">
        <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-pink-500 text-[11px] font-bold text-white"
            aria-hidden="true"
            >{{ article.author.initial }}</span
          >
          {{ article.author.name }}
        </span>
        <span class="inline-flex items-center gap-1 whitespace-nowrap">
          <Clock class="h-3 w-3" aria-hidden="true" />{{ age }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
