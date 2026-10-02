<script setup lang="ts">
/**
 * S4 `/admin/articles/:id` "Lihat Artikel - Admin PRESTASIPLUS" (FR-M09-19..21; DV-M09-04, DV-M09-05).
 *
 * - Shell header = the article title / "Paparan artikel" (set once the article has loaded).
 * - Card: title, author, created date, views, status pills, excerpt, and the stored body printed as
 *   escaped text (never rendered as HTML: mustache interpolation only) that wraps anywhere inside
 *   the card, so the page never scrolls sideways.
 * - Opening the preview never counts a view. An unknown id (also `categories`) returns to S1 with
 *   the one-time flash "Artikel tidak dijumpai.".
 */
import { Calendar, Eye, SquarePen, Star, User } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash, usePageMeta } from '@/composables'

import { fetchAdminArticle } from '../api/admin-articles-notes'
import AdminBackLink from '../components/admin-articles-notes/AdminBackLink.vue'
import AdminStatusPill from '../components/admin-articles-notes/AdminStatusPill.vue'
import {
  ARTICLES_LIST_PATH,
  COPY,
  PRIMARY_BUTTON_CLASS,
  isNotFoundError,
  previewDate,
} from '../lib/admin-articles-notes'

const props = defineProps<{ id: string }>()

const router = useRouter()
const flash = useFlash()
const meta = usePageMeta()

const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

const { data: article, error } = useApi(
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
  <div class="min-w-0 space-y-4" data-testid="admin-article-preview-page">
    <AdminBackLink :to="ARTICLES_LIST_PATH" />

    <AlertBox v-if="failed" :messages="COPY.loadFailed" data-testid="admin-article-load-error" />

    <article
      v-else-if="article"
      class="min-w-0 space-y-4 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="admin-article-card"
    >
      <h1
        class="font-heading text-2xl font-bold [overflow-wrap:anywhere] text-slate-800"
        data-testid="preview-title"
      >
        {{ article.title }}
      </h1>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span class="inline-flex items-center gap-1.5" data-testid="preview-author">
          <User class="h-4 w-4" aria-hidden="true" />{{ article.author?.name }}
        </span>
        <span class="inline-flex items-center gap-1.5" data-testid="preview-date">
          <Calendar class="h-4 w-4" aria-hidden="true" />{{ previewDate(article.createdAt) }}
        </span>
        <span class="inline-flex items-center gap-1.5" data-testid="preview-views">
          <Eye class="h-4 w-4" aria-hidden="true" />{{ article.views }} tontonan
        </span>
      </div>

      <div class="flex flex-wrap gap-2">
        <AdminStatusPill :published="article.isPublished" />
        <span
          v-if="article.isFeatured"
          class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-amber-700"
          data-testid="preview-featured"
        >
          <Star class="h-3 w-3" aria-hidden="true" />Featured
        </span>
      </div>

      <p
        v-if="article.excerpt"
        class="[overflow-wrap:anywhere] text-slate-600"
        data-testid="preview-excerpt"
      >
        {{ article.excerpt }}
      </p>

      <!-- Escaped text, never rendered (DV-M09-04); wraps anywhere (DV-M09-05). -->
      <div
        class="border-t border-slate-100 pt-4 text-sm [overflow-wrap:anywhere] text-slate-700"
        data-testid="preview-body"
      >
        {{ article.content }}
      </div>

      <div>
        <RouterLink
          :to="`${ARTICLES_LIST_PATH}/${article.id}/edit`"
          :class="PRIMARY_BUTTON_CLASS"
          data-testid="preview-edit"
        >
          <SquarePen class="h-4 w-4" aria-hidden="true" />
          Edit Artikel
        </RouterLink>
      </div>
    </article>
  </div>
</template>
