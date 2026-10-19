<script setup lang="ts">
/**
 * S16 `/artikel/:slug` (FR-M09-32..39; URS FN-M09-2.3.x). Logged in: shell header = title /
 * "Artikel", breadcrumb, chips, author card, body, share card, related and (from `lg`) the "Artikel
 * Terkini" aside. Guest (L-7, provisional): the same content without breadcrumb and aside, inside
 * the guest public layout. An unknown or unpublished slug renders the standalone 404 page in place.
 *
 * Opening the page counts a view (the API increments before replying, BR-M09-07), so the page
 * fetches once per slug. The body HTML is passed through the allow-list sanitiser (SEC-M09-01)
 * and rendered by `DsProse`.
 *
 * v2 restyle (B04): title `text-title`, chips, body in a `max-w-prose` `DsProse`, related strip of
 * `DsMediaCard`s.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta, useSession } from '@/composables'
import {
  DsLoadError,
  DsMediaCard,
  DsPage,
  DsProse,
  DsCluster,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'
import { diffForHumans, formatDateEn } from '@/lib/time'

import { fetchArticle, fetchLatestArticles, type ArticleCard } from '../api'
import ArtikelShareCard from '../components/artikel/ArtikelShareCard.vue'
import { ARTIKEL_COPY, ARTIKEL_PATH, breadcrumbTitle } from '../lib/artikel/artikel'
import { sanitizeHtml } from '../lib/artikel/sanitize-html'

const props = defineProps<{ slug: string }>()

const { isLoggedIn } = useSession()
const pageMeta = usePageMeta()

const {
  data: article,
  error,
  reload,
} = useApi(
  (signal) => fetchArticle(props.slug, { signal }),
  () => props.slug,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
    // In-app move from an unknown slug to a valid one: show the page again.
    else if (useRouteOutcome().value === 404) setRouteOutcome(null)
  },
  { immediate: true },
)

// The aside is for logged-in users from `lg` (CSS); guests never fetch it.
const { data: latestData } = useApi(
  async (signal): Promise<ArticleCard[]> =>
    isLoggedIn.value ? (await fetchLatestArticles(5, { signal })).data : [],
  () => props.slug,
)
const latest = computed(() => latestData.value ?? [])

watch(
  article,
  (value) => {
    if (value) pageMeta.setHeader({ title: value.title, subtitle: ARTIKEL_COPY.headerTitle })
  },
  { immediate: true },
)

const body = computed(() => (article.value ? sanitizeHtml(article.value.content) : ''))
const published = computed(() =>
  article.value?.publishedAt ? formatDateEn(article.value.publishedAt) : '',
)
const age = computed(() =>
  article.value?.publishedAt ? diffForHumans(article.value.publishedAt) : '',
)
</script>

<template>
  <div v-if="notFound" />
  <DsPage v-else data-testid="artikel-detail-page">
    <DsLoadError v-if="error" :message="ARTIKEL_COPY.loadFailed" @retry="reload()" />

    <div v-if="article" class="flex flex-col gap-6 lg:grid lg:grid-cols-12">
      <article class="flex min-w-0 flex-col gap-4 md:gap-6 lg:col-span-9">
        <nav
          v-if="isLoggedIn"
          class="flex flex-wrap items-center gap-2 text-label text-muted"
          data-testid="artikel-breadcrumb"
        >
          <UButton
            to="/dashboard"
            color="neutral"
            variant="soft"
            icon="i-ph-squares-four-duotone"
            >{{ ARTIKEL_COPY.breadcrumbDashboard }}</UButton
          >
          <UIcon name="i-ph-caret-right" class="size-4" aria-hidden="true" />
          <UButton
            :to="ARTIKEL_PATH"
            color="neutral"
            variant="soft"
            icon="i-ph-newspaper-duotone"
            >{{ ARTIKEL_COPY.breadcrumbArtikel }}</UButton
          >
          <UIcon name="i-ph-caret-right" class="size-4" aria-hidden="true" />
          <span
            class="max-w-full break-words text-highlighted"
            data-testid="artikel-breadcrumb-current"
            >{{ breadcrumbTitle(article.title) }}</span
          >
        </nav>

        <DsCluster gap="xs">
          <UBadge
            color="primary"
            variant="solid"
            :label="article.categoryLabel"
            data-testid="artikel-chip-category"
          />
          <UBadge
            color="neutral"
            variant="soft"
            :label="article.gradeLabel"
            data-testid="artikel-chip-level"
          />
          <UBadge
            v-if="article.isFeatured"
            color="neutral"
            variant="soft"
            icon="i-ph-star-duotone"
            :label="ARTIKEL_COPY.featuredChip"
            data-testid="artikel-chip-featured"
          />
        </DsCluster>

        <DsHeading :level="1" wrap="anywhere" data-testid="artikel-title">
          {{ article.title }}
        </DsHeading>

        <UCard
          v-if="article.excerpt"
          variant="soft"
          class="max-w-prose"
          data-testid="artikel-excerpt"
        >
          <DsText variant="body" wrap="anywhere">{{ article.excerpt }}</DsText>
        </UCard>

        <UCard data-testid="artikel-author-card">
          <DsCluster gap="md" justify="between">
            <DsCluster :wrap="false">
              <UAvatar
                :text="article.author.initial"
                size="xl"
                data-testid="artikel-author-initial"
              />
              <div class="min-w-0">
                <DsText
                  variant="label"
                  as="p"
                  tone="highlighted"
                  wrap="anywhere"
                  data-testid="artikel-author-name"
                >
                  {{ article.author.name }}
                </DsText>
                <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
                  <span
                    class="inline-flex items-center gap-1 whitespace-nowrap"
                    data-testid="artikel-published"
                  >
                    <UIcon name="i-ph-calendar-blank-duotone" class="size-4" aria-hidden="true" />{{
                      published
                    }}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span
                    class="inline-flex items-center gap-1 whitespace-nowrap"
                    data-testid="artikel-age"
                  >
                    <UIcon name="i-ph-clock-duotone" class="size-4" aria-hidden="true" />{{ age }}
                  </span>
                </p>
              </div>
            </DsCluster>
            <DsCluster gap="md" :wrap="false" class="text-center">
              <p>
                <DsText variant="subheading" as="span" tabular
                  ><UIcon name="i-ph-eye-duotone" class="size-5" aria-hidden="true" />
                  <span data-testid="artikel-views">{{ article.views }}</span></DsText
                ><br /><DsText variant="caption" as="span">{{ ARTIKEL_COPY.readers }}</DsText>
              </p>
              <p>
                <DsText variant="subheading" as="span" tabular
                  ><UIcon name="i-ph-heart-duotone" class="size-5" aria-hidden="true" />
                  <span data-testid="artikel-likes">{{ article.likes }}</span></DsText
                ><br /><DsText variant="caption" as="span">{{ ARTIKEL_COPY.likes }}</DsText>
              </p>
            </DsCluster>
          </DsCluster>
        </UCard>

        <!-- Sanitised by `sanitizeHtml` (allow-list; SEC-M09-01). -->
        <UCard>
          <DsProse :html="body" data-testid="artikel-body" />
        </UCard>

        <ArtikelShareCard :title="article.title" />

        <DsStack v-if="article.related.length > 0" as="section" data-testid="artikel-related">
          <DsHeading :level="2">{{ ARTIKEL_COPY.related }}</DsHeading>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
            <DsMediaCard
              v-for="item in article.related"
              :key="item.id"
              kind="article"
              :title="item.title"
              :meta="`${item.publishedAt ? diffForHumans(item.publishedAt) : ''} · ${String(item.views)} ${ARTIKEL_COPY.readers}`"
              :to="`/artikel/${item.slug}`"
              data-testid="artikel-related-card"
            />
          </div>
        </DsStack>
      </article>

      <aside v-if="isLoggedIn" class="hidden lg:col-span-3 lg:block" data-testid="artikel-aside">
        <UCard class="lg:sticky lg:top-4">
          <DsStack gap="sm">
            <h2 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-newspaper-duotone" class="size-6" aria-hidden="true" />
              {{ ARTIKEL_COPY.latest }}
            </h2>
            <DsStack as="ul" gap="2xs">
              <li v-for="item in latest" :key="item.id">
                <UButton
                  :to="`/artikel/${item.slug}`"
                  color="neutral"
                  variant="ghost"
                  block
                  class="h-auto justify-start py-2 text-start"
                  data-testid="artikel-aside-item"
                >
                  <span class="min-w-0">
                    <DsText variant="label" tone="highlighted" wrap="anywhere" class="block">{{
                      item.title
                    }}</DsText>
                    <DsText variant="caption" as="span" class="block">{{
                      item.publishedAt ? diffForHumans(item.publishedAt) : ''
                    }}</DsText>
                  </span>
                </UButton>
              </li>
            </DsStack>
            <UButton
              :to="ARTIKEL_PATH"
              variant="link"
              trailing-icon="i-ph-arrow-right"
              class="self-start"
              data-testid="artikel-aside-all"
              >{{ ARTIKEL_COPY.seeAll }}</UButton
            >
          </DsStack>
        </UCard>
      </aside>
    </div>
  </DsPage>
</template>
