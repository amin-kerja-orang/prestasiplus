<script setup lang="ts">
/**
 * S4 `/admin/articles/:id` "Lihat Artikel - Admin PRESTASIPLUS" (FR-M09-19..21; DV-M09-04, DV-M09-05).
 *
 * - Shell header = the article title / "Paparan artikel" (set once the article has loaded).
 * - Card: title, author, created date, views, status badges, excerpt, and the stored body printed as
 *   escaped text (never rendered as HTML: mustache interpolation only) that wraps anywhere inside
 *   the card, so the page never scrolls sideways.
 * - Opening the preview never counts a view. An unknown id (also `categories`) returns to S1 with
 *   the one-time flash "Artikel tidak dijumpai.".
 */
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash, usePageMeta } from '@/composables'
import {
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatusBadge,
  DsStack,
  DsCluster,
  DsHeading,
  DsText,
} from '@/ds'

import { fetchAdminArticle } from '../api/admin-articles-notes'
import { ARTICLES_LIST_PATH, COPY, isNotFoundError, previewDate } from '../lib/admin-articles-notes'

const props = defineProps<{ id: string }>()

const router = useRouter()
const flash = useFlash()
const meta = usePageMeta()

const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

const {
  data: article,
  error,
  reload,
} = useApi(
  (signal) => fetchAdminArticle(numericId.value ?? 0, { signal }),
  () => props.id,
  { immediate: numericId.value !== null },
)

function backWithNotFound(): void {
  flash.error(COPY.articleNotFound)
  void router.replace(ARTICLES_LIST_PATH)
}

if (numericId.value === null) backWithNotFound()

watch(error, (err) => {
  if (err && isNotFoundError(err)) backWithNotFound()
})

watch(article, (loaded) => {
  if (loaded) meta.setHeader({ title: loaded.title, subtitle: 'Paparan artikel' })
})

const failed = computed(() => error.value !== null && !isNotFoundError(error.value))
</script>

<template>
  <DsPage
    :back-to="ARTICLES_LIST_PATH"
    back-label="Kembali ke Senarai"
    data-testid="admin-article-preview-page"
  >
    <DsLoadError
      v-if="failed"
      :message="COPY.loadFailed"
      testid="admin-article-load-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="article" data-testid="admin-article-card">
      <article class="flex min-w-0 flex-col gap-6 p-2 sm:p-4">
        <DsStack gap="sm">
          <DsCluster gap="xs">
            <DsStatusBadge
              :status="article.isPublished ? 'published' : 'draft'"
              data-testid="status-pill"
            />
            <UBadge
              v-if="article.isFeatured"
              color="warning"
              variant="subtle"
              icon="i-ph-star-fill"
              label="Featured"
              data-testid="preview-featured"
            />
          </DsCluster>
          <DsHeading :level="1" wrap="anywhere" data-testid="preview-title">
            {{ article.title }}
          </DsHeading>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-body text-muted">
            <span class="inline-flex items-center gap-2" data-testid="preview-author">
              <UIcon name="i-ph-user" class="size-5" aria-hidden="true" />{{ article.author?.name }}
            </span>
            <span class="inline-flex items-center gap-2" data-testid="preview-date">
              <UIcon name="i-ph-calendar-blank" class="size-5" aria-hidden="true" />{{
                previewDate(article.createdAt)
              }}
            </span>
            <span class="inline-flex items-center gap-2" data-testid="preview-views">
              <UIcon name="i-ph-eye" class="size-5" aria-hidden="true" />{{ article.views }}
              tontonan
            </span>
          </div>
        </DsStack>

        <DsText
          v-if="article.excerpt"
          variant="body"
          tone="muted"
          wrap="anywhere"
          data-testid="preview-excerpt"
        >
          {{ article.excerpt }}
        </DsText>

        <USeparator />

        <!-- Escaped text, never rendered (DV-M09-04); wraps anywhere (DV-M09-05). -->
        <DsText variant="body" as="div" wrap="anywhere" data-testid="preview-body">
          {{ article.content }}
        </DsText>

        <div>
          <UButton
            :to="`${ARTICLES_LIST_PATH}/${article.id}/edit`"
            icon="i-ph-pencil-simple"
            label="Edit Artikel"
            class="min-h-11"
            data-testid="preview-edit"
          />
        </div>
      </article>
    </DsPanel>
  </DsPage>
</template>
