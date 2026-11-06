<script setup lang="ts">
/**
 * S22 `/perutusan` "Perutusan Rasmi" (card S5-T09; R1-AS-2). The feed is not paginated (pinned first,
 * then newest). One card per post: title, excerpt, scope chip, "📌 Disemat", and the byline
 * "{role label} · {relative time}" (the author name is not printed). "Tulis Perutusan" shows for a
 * writer only (`compose-context.canWrite`); a failed context fetch is read as "cannot write".
 * Reactions and comments are not built in R1 (D115).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsCluster, DsEmptyState, DsLoadError, DsPage, DsPanel, DsStack, DsText } from '@/ds'
import { diffForHumans } from '@/lib/time'

import { fetchComposeContext, fetchPerutusan, type PerutusanCard } from '../api'

const EMPTY = 'Tiada perutusan.'
const LOAD_FAILED = 'Perutusan tidak dapat dimuatkan. Sila cuba lagi.'

const { data, error, loading, reload } = useApi((signal) => fetchPerutusan({ signal }))
const { data: context } = useApi(async (signal) => {
  try {
    return await fetchComposeContext({ signal })
  } catch {
    return null
  }
})

const rows = computed<PerutusanCard[]>(() => data.value?.data ?? [])
const canWrite = computed(() => context.value?.canWrite === true)
</script>

<template>
  <DsPage layout="list" data-testid="perutusan-list-page">
    <DsCluster gap="sm">
      <UButton
        v-if="canWrite"
        to="/perutusan/tulis"
        icon="i-ph-pencil-simple-line"
        class="min-h-11"
        data-testid="perutusan-write"
        >Tulis Perutusan</UButton
      >
      <UButton
        v-if="canWrite"
        to="/perutusan/saya"
        color="neutral"
        variant="soft"
        class="min-h-11"
        data-testid="perutusan-mine-link"
        >Perutusan Saya</UButton
      >
    </DsCluster>

    <DsLoadError v-if="error" :message="LOAD_FAILED" @retry="reload()" />
    <DsStack v-else-if="loading && !data" gap="md" data-testid="perutusan-loading">
      <USkeleton v-for="n in 3" :key="n" class="h-28 w-full" />
    </DsStack>
    <DsEmptyState v-else-if="rows.length === 0" :title="EMPTY" data-testid="perutusan-empty" />
    <DsStack v-else as="ul" gap="md" data-testid="perutusan-list">
      <li v-for="post in rows" :key="post.id" class="min-w-0" data-testid="perutusan-card">
        <DsPanel>
          <DsStack gap="sm">
            <DsCluster gap="sm">
              <UBadge color="neutral" variant="soft" :label="post.scopeLabel" data-testid="perutusan-scope" />
              <UBadge
                v-if="post.isPinned"
                color="primary"
                variant="soft"
                label="📌 Disemat"
                data-testid="perutusan-pinned"
              />
            </DsCluster>
            <UButton
              :to="`/perutusan/${String(post.id)}`"
              color="neutral"
              variant="link"
              class="h-auto min-h-11 whitespace-normal text-start"
              data-testid="perutusan-card-link"
              >{{ post.title }}</UButton
            >
            <DsText variant="body" tone="default" wrap="anywhere" data-testid="perutusan-excerpt">{{
              post.excerpt
            }}</DsText>
            <DsText variant="caption" tone="muted" data-testid="perutusan-byline">
              {{ post.author.roleLabel }} · {{ diffForHumans(post.createdAt) }}
            </DsText>
          </DsStack>
        </DsPanel>
      </li>
    </DsStack>
  </DsPage>
</template>
