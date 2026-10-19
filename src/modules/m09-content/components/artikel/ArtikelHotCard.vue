<script setup lang="ts">
/**
 * "Artikel Paling Hangat" card (FR-M09-28; URS FN-M09-2.1.2): a `DsMediaCard` with the category chip,
 * the 2-line title, a meta line (badge "PILIHAN" featured / "POPULAR", author, relative date) and
 * the 2-line excerpt under the card.
 */
import { computed } from 'vue'

import { DsMediaCard, DsStack, DsText } from '@/ds'
import { diffForHumans } from '@/lib/time'

import type { HotCard } from '../../api'
import { ARTIKEL_COPY } from '../../lib/artikel/artikel'

const props = defineProps<{ article: HotCard }>()

const featured = computed(() => props.article.badge === 'PILIHAN')
const age = computed(() =>
  props.article.publishedAt ? diffForHumans(props.article.publishedAt) : '',
)
const meta = computed(() =>
  [
    featured.value ? ARTIKEL_COPY.hotFeatured : ARTIKEL_COPY.hotPopular,
    props.article.author.name,
    age.value,
  ]
    .filter((part) => part !== '')
    .join(' · '),
)
</script>

<template>
  <DsStack
    gap="xs"
    class="h-full"
    data-testid="artikel-hot-card"
    :data-badge="article.badge"
    :data-slug="article.slug"
  >
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
