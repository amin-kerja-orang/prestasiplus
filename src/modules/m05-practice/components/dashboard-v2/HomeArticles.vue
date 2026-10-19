<script setup lang="ts">
/** "Artikel Untuk Kamu" strip (FR-M05-20…22). The desktop aside of the old page is dropped: the strip shows on every width. */
import { diffForHumans } from '@/lib/time'

import type { DashboardArticle } from '../../api/types'
import { DsCluster, DsStack, DsHeading, DsText } from '@/ds'

defineProps<{ articles: DashboardArticle[] }>()

const when = (a: DashboardArticle): string => (a.publishedAt ? diffForHumans(a.publishedAt) : '')
</script>

<template>
  <DsStack as="section" gap="sm" aria-labelledby="dash-articles-h" data-testid="dash-articles">
    <DsCluster justify="between" :wrap="false">
      <DsHeading id="dash-articles-h" :level="2">📚 Artikel Untuk Kamu</DsHeading>
      <UButton
        to="/artikel"
        color="neutral"
        variant="link"
        trailing-icon="i-ph-arrow-right-bold"
        class="min-h-11"
        data-testid="dash-articles-all"
        >Lihat Semua</UButton
      >
    </DsCluster>
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
          <DsText variant="caption">{{ when(a) }}</DsText>
        </UCard>
      </li>
    </ul>
  </DsStack>
</template>
