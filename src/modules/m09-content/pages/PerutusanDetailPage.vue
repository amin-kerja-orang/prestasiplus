<script setup lang="ts">
/**
 * S23 `/perutusan/:id` (card S5-T09). Title, scope chip, byline, long date and the body. The body
 * is server-sanitised HTML and goes through the allow-list sanitiser again before `v-html`
 * (SEC-M09-01). No reactions, comments, images, documents or video in R1 (D115). An unknown or
 * invisible id answers 404 and shows the V3 404 page in place.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsCluster, DsLoadError, DsPage, DsPanel, DsStack, DsText } from '@/ds'
import { diffForHumans, formatDateLong } from '@/lib/time'

import { fetchPerutusanDetail } from '../api'
import { sanitizeHtml } from '../lib/artikel/sanitize-html'

const LOAD_FAILED = 'Perutusan tidak dapat dimuatkan. Sila cuba lagi.'

const props = defineProps<{ id: number }>()

const {
  data: post,
  error,
  loading,
  reload,
} = useApi(
  (signal) => fetchPerutusanDetail(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
    else if (useRouteOutcome().value === 404) setRouteOutcome(null)
  },
  { immediate: true },
)

const body = computed(() => (post.value ? sanitizeHtml(post.value.body) : ''))
</script>

<template>
  <div v-if="notFound" />
  <DsPage v-else data-testid="perutusan-detail-page">
    <div>
      <UButton
        to="/perutusan"
        color="neutral"
        variant="link"
        class="min-h-11"
        data-testid="perutusan-back"
        >← Perutusan</UButton
      >
    </div>

    <DsLoadError v-if="error" :message="LOAD_FAILED" @retry="reload()" />
    <USkeleton v-else-if="loading && !post" class="h-40 w-full" data-testid="perutusan-loading" />
    <DsPanel v-else-if="post" as="article">
      <DsStack gap="md">
        <DsCluster gap="sm">
          <UBadge color="neutral" variant="soft" :label="post.scopeLabel" data-testid="perutusan-scope" />
        </DsCluster>
        <DsText variant="title" tone="highlighted" wrap="anywhere" as="div" data-testid="perutusan-title">{{
          post.title
        }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="perutusan-byline">
          {{ post.author.roleLabel }} · {{ diffForHumans(post.createdAt) }}
        </DsText>
        <DsText variant="caption" tone="muted" data-testid="perutusan-date">{{
          formatDateLong(post.createdAt)
        }}</DsText>
        <!-- Sanitised by `sanitizeHtml` (allow-list; SEC-M09-01). -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="whitespace-pre-line break-words" data-testid="perutusan-body" v-html="body" />
      </DsStack>
    </DsPanel>
  </DsPage>
</template>
