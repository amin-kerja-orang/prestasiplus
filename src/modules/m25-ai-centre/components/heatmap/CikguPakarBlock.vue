<script setup lang="ts">
/**
 * Cikgu Pakar block above the hero (FR-M25-21..25; DV-M25-03, DV-M25-04): the heading and one card
 * link to `/bilik-duta/{slug}` with a round avatar (A4 violet, A3 ring for `bintang`), the name (h4),
 * the tagline and four pills of at least 12 px. The page renders the block only when a card exists.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useRouteExists } from '@/composables'

import type { DutaCard } from '../../api'

import { HEATMAP_COPY, ratingText } from './heatmap-copy'

const props = defineProps<{ card: DutaCard }>()

// The M24 profile page is not routed yet: the card then stays as plain, non-navigating markup (D9).
const { routeExists } = useRouteExists()
const profileTo = computed(() => `/bilik-duta/${props.card.slug}`)

const PILL = 'rounded-full bg-elevated px-3 py-1 text-caption font-semibold text-muted'
</script>

<template>
  <section
    class="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3 rounded-card bg-default p-4 shadow-lift"
    data-testid="cikgu-pakar"
  >
    <p class="text-overline text-muted">{{ HEATMAP_COPY.cikguHeading }}</p>
    <component
      :is="routeExists(profileTo) ? RouterLink : 'div'"
      v-bind="routeExists(profileTo) ? { to: profileTo } : {}"
      class="relative flex min-w-0 items-center gap-3 rounded-chip bg-heat/15 p-4 hover:bg-elevated"
      :class="`tier-${card.tier}`"
      :data-slug="card.slug"
      data-testid="cikgu-card"
    >
      <span
        class="flex size-14 shrink-0 items-center justify-center rounded-full text-subheading font-bold"
        :class="card.tier === 'bintang' ? 'bg-heat text-on-highlight' : 'bg-friend text-primary-on'"
        data-testid="cikgu-avatar"
        >{{ card.initials }}</span
      >
      <span class="min-w-0 flex-1">
        <h4 class="text-subheading break-words text-highlighted" data-testid="cikgu-name">
          {{ card.name }}
        </h4>
        <span class="block text-label break-words text-muted" data-testid="cikgu-tagline">{{
          card.tagline
        }}</span>
        <span class="mt-2 flex flex-wrap gap-1.5" data-testid="cikgu-pills">
          <span
            class="rounded-full bg-heat px-3 py-1 text-caption font-semibold text-on-highlight"
            >{{ HEATMAP_COPY.dutaTier }}</span
          >
          <span :class="PILL">📚 {{ card.subject }}</span>
          <span :class="PILL">📍 {{ card.state }}</span>
          <span :class="PILL">⭐ {{ ratingText(card.rating) }}</span>
        </span>
      </span>
    </component>
  </section>
</template>
