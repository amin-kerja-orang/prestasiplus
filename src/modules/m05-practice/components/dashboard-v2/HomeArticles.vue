<script setup lang="ts">
/** "Artikel Untuk Kamu" strip (FR-M05-20…22). The desktop aside of the old page is dropped: the strip shows on every width. */
import { diffForHumans } from '@/lib/time'

import type { DashboardArticle } from '../../api/types'

defineProps<{ articles: DashboardArticle[] }>()

const when = (a: DashboardArticle): string => (a.publishedAt ? diffForHumans(a.publishedAt) : '')
</script>

<template>
  <section
    class="flex flex-col gap-3"
    aria-labelledby="dash-articles-h"
    data-testid="dash-articles"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 id="dash-articles-h" class="text-heading text-highlighted">📚 Artikel Untuk Kamu</h2>
      <UButton
        to="/artikel"
        color="neutral"
        variant="link"
        trailing-icon="i-ph-arrow-right-bold"
        class="min-h-11"
        data-testid="dash-articles-all"
        >Lihat Semua</UButton
      >
    </div>
    <ul class="flex gap-3 overflow-x-auto pb-2" data-testid="dash-articles-strip">
      <li v-for="a in articles" :key="a.slug" class="w-64 shrink-0">
        <UCard :ui="{ body: 'flex flex-col gap-2 p-4' }" data-testid="dash-article-card">
          <UBadge
            color="neutral"
            variant="subtle"
            class="self-start"
            data-testid="dash-article-chip"
            >{{ a.category }}</UBadge
          >
          <UButton
            :to="`/artikel/${a.slug}`"
            color="neutral"
            variant="link"
            class="h-auto min-h-11 justify-start p-0 text-start text-subheading whitespace-normal text-highlighted"
            >{{ a.title }}</UButton
          >
          <p class="text-caption text-muted">{{ when(a) }}</p>
        </UCard>
      </li>
    </ul>
  </section>
</template>
