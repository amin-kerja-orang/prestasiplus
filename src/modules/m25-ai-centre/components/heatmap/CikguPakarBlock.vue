<script setup lang="ts">
/**
 * Cikgu Pakar block above the hero (FR-M25-21..25; DV-M25-03, DV-M25-04): the heading and one `.duta-card`
 * link to `/bilik-duta/{slug}` with a round gradient avatar (`.duta-av`, gold ring for `bintang`), the name
 * (h4), the tagline and four pills of at least 12 px. The card fill and the resting border are read from the
 * live screenshot (Perlu pengesahan). The page renders the block only when a card exists. The hover styles use
 * `[&:hover]:` (not `hover:`): live applies `:hover` on touch too, while Tailwind's `hover:` is gated by
 * `@media (hover: hover)`.
 */
import { RouterLink } from 'vue-router'

import type { DutaCard } from '../../api'

import { HEATMAP_COPY, ratingText } from './heatmap-copy'

defineProps<{ card: DutaCard }>()

const PILL = 'rounded-full bg-slate-100 px-[0.55rem] py-[0.15rem] text-xs font-semibold text-slate-500'
</script>

<template>
  <section
    class="mx-auto w-full max-w-[920px] rounded-2xl border border-amber-200 bg-linear-to-br from-amber-100 to-white p-4"
    data-testid="cikgu-pakar"
  >
    <p class="mb-3 text-[0.78rem] font-extrabold tracking-wide text-amber-800 uppercase">
      {{ HEATMAP_COPY.cikguHeading }}
    </p>
    <RouterLink
      :to="`/bilik-duta/${card.slug}`"
      :class="[
        'duta-card relative flex min-w-0 items-center gap-[0.85rem] rounded-[14px] border border-amber-200 bg-amber-50 px-[1.15rem] py-4 transition-[transform,box-shadow,border-color] duration-150 after:absolute after:top-3 after:right-4 after:opacity-60 after:content-[\'⭐\']',
        '[&:hover]:border-fuchsia-600 [&:hover]:[transform:translateY(-2px)] [&:hover]:shadow-[0_12px_24px_rgba(192,38,211,0.12)]',
        `tier-${card.tier}`,
      ]"
      :data-slug="card.slug"
      data-testid="cikgu-card"
    >
      <span
        :class="[
          'duta-av flex size-14 shrink-0 items-center justify-center rounded-[50%] bg-linear-to-br from-indigo-700 to-fuchsia-600 text-[1.15rem] font-bold text-white',
          card.tier === 'bintang' ? 'shadow-[0_0_0_2px_#fbbf24,0_4px_10px_rgb(251_191_36/0.3)]' : '',
        ]"
        data-testid="cikgu-avatar"
        >{{ card.initials }}</span
      >
      <span class="min-w-0 flex-1">
        <h4 class="text-base font-extrabold break-words text-slate-900" data-testid="cikgu-name">
          {{ card.name }}
        </h4>
        <span class="block text-[0.82rem] break-words text-slate-600" data-testid="cikgu-tagline">{{
          card.tagline
        }}</span>
        <span class="mt-2 flex flex-wrap gap-1.5" data-testid="cikgu-pills">
          <span
            class="rounded-full bg-amber-100 px-[0.55rem] py-[0.15rem] text-xs font-semibold text-amber-800"
            >{{ HEATMAP_COPY.dutaTier }}</span
          >
          <span :class="PILL">📚 {{ card.subject }}</span>
          <span :class="PILL">📍 {{ card.state }}</span>
          <span :class="PILL">⭐ {{ ratingText(card.rating) }}</span>
        </span>
      </span>
    </RouterLink>
  </section>
</template>
