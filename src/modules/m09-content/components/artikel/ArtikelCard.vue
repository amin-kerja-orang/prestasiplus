<script setup lang="ts">
/**
 * S15 grid card (FR-M09-23, FR-M09-30; URS FN-M09-2.1.5, 2.2.5). A `DsMediaCard` linking to the
 * detail: category chip, title, one meta line (the "HOT" marker when featured, author, views and
 * the relative date) and the two-line excerpt under the card.
 */
import { computed } from 'vue'

import { DsMediaCard, DsStack, DsText } from '@/ds'
import { diffForHumans } from '@/lib/time'

import type { ArticleCard } from '../../api'
import { ARTIKEL_COPY } from '../../lib/artikel/artikel'

const props = defineProps<{ article: ArticleCard; guest?: boolean }>()

const age = computed(() =>
  props.article.publishedAt ? diffForHumans(props.article.publishedAt) : '',
)
const meta = computed(() =>
  [
    props.article.isFeatured ? ARTIKEL_COPY.badgeFeatured : '',
    props.article.author.name,
    `${String(props.article.views)} ${ARTIKEL_COPY.readers}`,
    age.value,
  ]
    .filter((part) => part !== '')
    .join(' · '),
)
</script>

<template>
  <DsStack gap="xs" class="h-full" data-testid="artikel-card" :data-slug="article.slug">
    <DsMediaCard
      kind="article"
      :title="article.title"
      :category="article.categoryLabel"
      :meta="meta"
      :to="`/artikel/${article.slug}`"
    />
    <DsText v-if="article.excerpt" variant="caption" :clamp="2" wrap="anywhere">
      {{ article.excerpt }}
    </DsText>
  </DsStack>
</template>
