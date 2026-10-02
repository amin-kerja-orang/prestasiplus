<script setup lang="ts">
/**
 * S15 grid card (FR-M09-23, FR-M09-30; URS FN-M09-2.1.5, 2.2.5). A link to the detail: gradient 📰
 * panel, category chip, "HOT" chip when featured, title, excerpt, author initial + name, "👁️ views"
 * and the relative date. Every meta item is `white-space: nowrap` so the row wraps only between
 * items (DV-M09-12). The guest page adds a clock before the date.
 */
import { Clock, Star } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { diffForHumans } from '@/lib/time'

import type { ArticleCard } from '../../api'
import { ARTIKEL_COPY } from '../../lib/artikel/artikel'

const props = defineProps<{ article: ArticleCard; guest?: boolean }>()

const age = computed(() =>
  props.article.publishedAt ? diffForHumans(props.article.publishedAt) : '',
)
</script>

<template>
  <RouterLink
    :to="`/artikel/${article.slug}`"
    class="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
    data-testid="artikel-card"
    :data-slug="article.slug"
  >
    <div
      class="flex h-32 shrink-0 items-center justify-center bg-linear-to-br from-blue-400 via-purple-400 to-pink-400 text-5xl"
      aria-hidden="true"
    >
      📰
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-2 p-3">
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          class="rounded-full bg-linear-to-r from-blue-500 to-purple-500 px-2 py-0.5 text-[11px] font-semibold text-white"
          data-testid="artikel-card-category"
          >{{ article.categoryLabel }}</span
        >
        <span
          v-if="article.isFeatured"
          class="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[11px] font-semibold text-white"
          data-testid="artikel-card-hot"
        >
          <Star class="h-3 w-3 fill-current" aria-hidden="true" />{{ ARTIKEL_COPY.badgeFeatured }}
        </span>
      </div>
      <h3 class="text-sm font-bold break-words text-gray-800" data-testid="artikel-card-title">
        {{ article.title }}
      </h3>
      <p v-if="article.excerpt" class="line-clamp-2 text-xs break-words text-gray-600">
        {{ article.excerpt }}
      </p>
      <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-gray-500">
        <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-pink-500 text-[11px] font-bold text-white"
            aria-hidden="true"
            data-testid="artikel-card-initial"
            >{{ article.author.initial }}</span
          >
          <span data-testid="artikel-card-author">{{ article.author.name }}</span>
        </span>
        <span class="whitespace-nowrap" data-testid="artikel-card-views"
          >👁️ {{ article.views }}</span
        >
        <span
          class="inline-flex items-center gap-1 whitespace-nowrap"
          data-testid="artikel-card-date"
        >
          <Clock v-if="guest" class="h-3 w-3" aria-hidden="true" data-icon="clock" />{{ age }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
