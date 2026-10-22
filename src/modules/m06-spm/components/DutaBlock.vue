<script setup lang="ts">
/**
 * Duta recommendation block of S11, S12 and S13 (FR-M06-15, BR-M06-27): a title, a text and one
 * `.duta-card` from `GET /api/duta/recommendations` (M24, provisional). A failed or empty read
 * hides the whole block (the page works without it).
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi, useRouteExists } from '@/composables'

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
// The M24 profile page is not routed yet: the card then stays as plain, non-navigating markup (D9).
const { routeExists } = useRouteExists()
const profileTo = computed(() => (card.value ? `/bilik-duta/${card.value.slug}` : ''))
</script>

<template>
  <UCard v-if="card" data-testid="duta-block">
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="text-subheading text-highlighted" data-testid="duta-title">{{ title }}</h2>
        <p class="text-body text-muted" data-testid="duta-text">{{ text }}</p>
      </div>
      <UCard variant="subtle" :ui="{ body: 'p-3' }">
      <component
        :is="routeExists(profileTo) ? RouterLink : 'div'"
        v-bind="routeExists(profileTo) ? { to: profileTo } : {}"
        class="flex min-h-11 items-start gap-3"
        data-testid="duta-card"
      >
        <UAvatar :text="card.initials" size="xl" data-testid="duta-initials" />
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-label break-words text-highlighted" data-testid="duta-name">{{
            card.name
          }}</span>
          <span class="text-caption break-words text-muted" data-testid="duta-tagline">{{
            card.tagline
          }}</span>
          <span class="mt-1 flex flex-wrap gap-2" data-testid="duta-pills">
            <UBadge color="warning" variant="soft">🥇 Duta Bintang</UBadge>
            <UBadge color="info" variant="soft">📚 {{ card.subject }}</UBadge>
            <UBadge color="neutral" variant="soft">📍 {{ card.state }}</UBadge>
            <UBadge color="warning" variant="soft">⭐ {{ card.rating.toFixed(2) }}</UBadge>
          </span>
        </span>
      </component>
      </UCard>
    </div>
  </UCard>
</template>
