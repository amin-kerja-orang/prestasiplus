<script setup lang="ts">
/**
 * Duta recommendation block of S11, S12 and S13 (FR-M06-15, BR-M06-27): a title, a text and one
 * `.duta-card` from `GET /api/duta/recommendations` (M24, provisional). A failed or empty read
 * hides the whole block (the page works without it).
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'

import { fetchDutaRecommendation } from '../api'

const props = defineProps<{
  title: string
  text: string
  /** S12: prefer an ambassador of this subject. */
  subject?: string
}>()

const { data } = useApi((signal) =>
  fetchDutaRecommendation(props.subject ? { subject: props.subject } : {}, { signal }),
)
const card = computed(() => data.value)
</script>

<template>
  <section v-if="card" class="rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="duta-block">
    <h2 class="font-heading text-base font-bold text-slate-900 uppercase" data-testid="duta-title">
      {{ title }}
    </h2>
    <p class="mt-1 text-sm text-slate-600" data-testid="duta-text">{{ text }}</p>
    <RouterLink
      :to="`/bilik-duta/${card.slug}`"
      class="duta-card tier-bintang mt-3 flex min-h-11 items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 hover:bg-amber-100"
      data-testid="duta-card"
    >
      <span
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-white"
        data-testid="duta-initials"
        >{{ card.initials }}</span
      >
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-bold break-words text-slate-900" data-testid="duta-name">{{
          card.name
        }}</span>
        <span class="block text-xs break-words text-slate-600" data-testid="duta-tagline">{{
          card.tagline
        }}</span>
        <span class="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold" data-testid="duta-pills">
          <span class="rounded-full bg-amber-200 px-2 py-0.5 text-amber-900">🥇 Duta Bintang</span>
          <span class="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800"
            >📚 {{ card.subject }}</span
          >
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"
            >📍 {{ card.state }}</span
          >
          <span class="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-800"
            >⭐ {{ card.rating.toFixed(2) }}</span
          >
        </span>
      </span>
    </RouterLink>
  </section>
</template>
