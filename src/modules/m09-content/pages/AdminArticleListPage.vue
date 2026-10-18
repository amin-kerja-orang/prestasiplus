<script setup lang="ts">
/**
 * S1 `/admin/articles` "Pengurusan Artikel - Admin PRESTASIPLUS" (FR-M09-01..09; DV-M09-03), v2 staff theme.
 *
 * - Page header row (summary line + "Tambah"), a KPI strip, the filter bar (`search`, `category`, `published`)
 *   with active-filter chips; no auto-submit, "Set Semula" clears it. The query string is the state.
 * - Table of 20 rows from `GET /api/admin/articles`; the pager keeps the active filters (DV-M09-03). Below `md`
 *   every row is a card. Row actions sit in one menu.
 * - Delete: confirm (`useConfirm`), DELETE, reload at the same URL with the success flash.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsDataTable, DsEmptyState, DsFilterBar, DsPage, DsStatTile, useConfirm } from '@/ds'
import type { CardField } from '@/ds'

import {
  deleteAdminArticle,
  fetchAdminArticles,
  type AdminArticleItem,
} from '../api/admin-articles-notes'
import AdminActiveFilters from '../components/admin-kit/AdminActiveFilters.vue'
import AdminAlert from '../components/admin-kit/AdminAlert.vue'
import AdminRowMenu from '../components/admin-kit/AdminRowMenu.vue'
import NativeSelect from '../components/admin-kit/native/NativeSelect.vue'
import {
  ARTICLES_LIST_PATH,
  ARTICLE_ROUTES,
  CATEGORY_OPTIONS,
  COPY,
  PUBLISHED_FILTER_OPTIONS,
  errorLines,
  limitText,
  listDate,
  queryPage,
  queryText,
} from '../lib/admin-articles-notes'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

/** The applied filters, read from the URL. */
const applied = computed(() => ({
  search: queryText(route.query.search).trim(),
  category: queryText(route.query.category),
  published: queryText(route.query.published),
  page: queryPage(route.query.page),
}))

// Draft values of the controls; re-synced when the URL changes (Reset, back/forward).
const search = ref(queryText(route.query.search))
const category = ref(queryText(route.query.category) || 'all')
const published = ref(queryText(route.query.published))
watch(
  () => [route.query.search, route.query.category, route.query.published] as const,
  ([s, c, p]) => {
    search.value = queryText(s)
    category.value = queryText(c) || 'all'
    published.value = queryText(p)
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchAdminArticles(
      {
        search: applied.value.search,
        category: applied.value.category,
        published: applied.value.published,
        page: applied.value.page,
      },
      { signal },
    ),
  [
    () => route.query.search,
    () => route.query.category,
    () => route.query.published,
    () => route.query.page,
  ],
)

const rows = computed<AdminArticleItem[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.totalItems ?? 0)
const firstLoad = computed(() => data.value === null && error.value === null)
const publishedOnPage = computed(() => rows.value.filter((r) => r.isPublished).length)
const featuredOnPage = computed(() => rows.value.filter((r) => r.isFeatured).length)

/** Filters kept on every pager link (DV-M09-03). */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  if (applied.value.search !== '') out.search = applied.value.search
  if (applied.value.category !== '') out.category = applied.value.category
  if (applied.value.published !== '') out.published = applied.value.published
  return out
})

const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  if (applied.value.search !== '') out.push({ key: 'search', label: `"${applied.value.search}"` })
  const cat = CATEGORY_OPTIONS.find((o) => o.value === applied.value.category)
  if (cat) out.push({ key: 'category', label: cat.label })
  const pub = PUBLISHED_FILTER_OPTIONS.find(
    (o) => o.value === applied.value.published && o.value !== '',
  )
  if (pub) out.push({ key: 'published', label: pub.label })
  return out
})
const activeCount = computed(() => chips.value.length)

function formQuery(): Record<string, string> {
  const out: Record<string, string> = {}
  const s = search.value.trim()
  if (s !== '') out.search = s
  if (category.value !== '' && category.value !== 'all') out.category = category.value
  if (published.value !== '') out.published = published.value
  return out
}

async function submitFilter(): Promise<void> {
  const query = formQuery()
  // Submitting the same filter reloads the page, as a live GET form does.
  if (JSON.stringify(query) === JSON.stringify(pagerQuery.value) && !route.query.page) {
    await reload()
  } else {
    await router.push({ path: ARTICLES_LIST_PATH, query })
  }
}

async function resetFilter(): Promise<void> {
  await router.push({ path: ARTICLES_LIST_PATH })
}

async function removeChip(key: string): Promise<void> {
  const query = { ...pagerQuery.value }
  delete query[key]
  await router.push({ path: ARTICLES_LIST_PATH, query })
}

function goToPage(page: number): void {
  void router.push({ path: ARTICLES_LIST_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

const deleting = ref(false)

async function remove(row: AdminArticleItem): Promise<void> {
  if (deleting.value) return
  if (!(await confirm({ message: COPY.confirmDeleteArticle, tone: 'danger' }))) return
  deleting.value = true
  try {
    const result = await deleteAdminArticle(row.id)
    await reload()
    // The page became empty after the delete: step back one page.
    if (rows.value.length === 0 && applied.value.page > 1) {
      await router.push({
        path: ARTICLES_LIST_PATH,
        query: { ...pagerQuery.value, page: String(applied.value.page - 1) },
      })
    }
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    deleting.value = false
  }
}

function actionsOf(row: AdminArticleItem) {
  return [
    { label: 'Lihat', icon: 'i-ph-eye', to: `${ARTICLES_LIST_PATH}/${String(row.id)}` },
    {
      label: 'Edit',
      icon: 'i-ph-pencil-simple',
      to: `${ARTICLES_LIST_PATH}/${String(row.id)}/edit`,
    },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      disabled: deleting.value,
      onSelect: () => void remove(row),
    },
  ]
}

interface TableRow extends Record<string, unknown> {
  id: number
  title: string
  categoryLabel: string
  gradeLevel: string
  views: number
  date: string
  raw: AdminArticleItem
}

const tableRows = computed<TableRow[]>(() =>
  rows.value.map((r) => ({
    id: r.id,
    title: limitText(r.title, 50),
    categoryLabel: r.categoryLabel,
    gradeLevel: r.gradeLevel,
    views: r.views,
    date: listDate(r.createdAt),
    raw: r,
  })),
)

const columns: TableColumn<TableRow>[] = [
  { accessorKey: 'title', header: 'Tajuk' },
  { accessorKey: 'categoryLabel', header: 'Kategori' },
  { accessorKey: 'gradeLevel', header: 'Tahap' },
  { id: 'status', header: 'Status' },
  { accessorKey: 'views', header: 'Views' },
  { accessorKey: 'date', header: 'Tarikh' },
  { id: 'actions', header: 'Tindakan' },
]
const cardFields: CardField[] = [
  { key: 'categoryLabel', label: 'Kategori' },
  { key: 'gradeLevel', label: 'Tahap' },
  { key: 'views', label: 'Views' },
  { key: 'date', label: 'Tarikh' },
]
</script>

<template>
  <DsPage data-testid="admin-articles-page">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <p class="min-w-0 text-body text-muted" data-testid="admin-articles-count">
        Jumlah: {{ total }} artikel
      </p>
      <UButton
        :to="{ name: ARTICLE_ROUTES.create }"
        icon="i-ph-plus"
        label="Tambah"
        size="md"
        class="min-h-11"
        data-testid="admin-articles-add"
      />
    </div>

    <section class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <DsStatTile :value="total" unit="Jumlah artikel" icon="i-ph-newspaper" accent="action" />
      <DsStatTile
        :value="publishedOnPage"
        unit="Diterbitkan (halaman ini)"
        icon="i-ph-check-circle"
        accent="win"
      />
      <DsStatTile
        :value="featuredOnPage"
        unit="Featured (halaman ini)"
        icon="i-ph-star"
        accent="trial"
      />
    </section>

    <div class="flex flex-col gap-3">
      <DsFilterBar
        :active-count="activeCount"
        data-testid="admin-articles-filter"
        @apply="submitFilter"
        @reset="resetFilter"
      >
        <template #search>
          <UInput
            v-model="search"
            type="text"
            name="search"
            aria-label="Cari"
            placeholder="Cari artikel..."
            icon="i-ph-magnifying-glass"
            size="md"
            class="w-full md:min-w-64 md:grow"
            data-testid="admin-articles-search"
          />
        </template>
        <NativeSelect
          v-model="category"
          name="category"
          aria-label="Kategori"
          class="md:w-48"
          data-testid="admin-articles-category"
        >
          <option value="all">Semua Kategori</option>
          <option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </NativeSelect>
        <NativeSelect
          v-model="published"
          name="published"
          aria-label="Status"
          class="md:w-44"
          data-testid="admin-articles-published"
        >
          <option v-for="o in PUBLISHED_FILTER_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </NativeSelect>
      </DsFilterBar>
      <AdminActiveFilters :chips="chips" @remove="removeChip" @reset="resetFilter" />
    </div>

    <div v-if="error" class="flex flex-col gap-4" data-testid="admin-articles-error">
      <AdminAlert :messages="errorLines(error)" />
      <div><UButton label="Cuba Lagi" class="min-h-11" @click="reload()" /></div>
    </div>

    <UCard v-else-if="!firstLoad && rows.length === 0" data-testid="admin-articles-empty">
      <DsEmptyState :title="COPY.articleEmpty" icon="i-ph-newspaper" />
    </UCard>

    <DsDataTable
      v-else
      :data="tableRows"
      :columns="columns"
      caption="Senarai artikel"
      :loading="firstLoad"
      :total="total"
      :page-size="data?.meta.pageSize ?? 20"
      :page="applied.page"
      card-title="title"
      :card-fields="cardFields"
      :empty-label="COPY.articleEmpty"
      data-testid="admin-articles-table"
      @update:page="goToPage"
    >
      <template #title-cell="{ row }">
        <div
          class="flex min-w-40 flex-col gap-1"
          data-testid="admin-article-row"
          :data-article-id="row.original.id"
        >
          <p class="line-clamp-2 text-label text-highlighted">
            <UIcon
              v-if="row.original.raw.isFeatured"
              name="i-ph-star-fill"
              class="mr-1 size-4 text-warning"
              title="Featured"
              data-testid="article-featured"
            />
            <span data-testid="article-title">{{ row.original.title }}</span>
          </p>
          <p class="text-caption text-muted" data-testid="article-author">
            Oleh: {{ row.original.raw.author.name }}
          </p>
        </div>
      </template>
      <template #categoryLabel-cell="{ row }">
        <UBadge
          color="primary"
          variant="subtle"
          :label="row.original.categoryLabel"
          data-testid="article-category"
        />
      </template>
      <template #gradeLevel-cell="{ row }">
        <span class="text-nowrap" data-testid="article-grade">{{ row.original.gradeLevel }}</span>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="row.original.raw.isPublished ? 'success' : 'neutral'"
          variant="subtle"
          :label="row.original.raw.isPublished ? COPY.published : COPY.draft"
          data-testid="status-pill"
        />
      </template>
      <template #views-cell="{ row }">
        <span data-testid="article-views">{{ row.original.views }}</span>
      </template>
      <template #date-cell="{ row }">
        <span class="text-nowrap" data-testid="article-date">{{ row.original.date }}</span>
      </template>
      <template #actions-cell="{ row }">
        <AdminRowMenu :actions="actionsOf(row.original.raw)" />
      </template>
      <template #card-actions="{ row }">
        <AdminRowMenu :actions="actionsOf((row as unknown as TableRow).raw)" />
      </template>
    </DsDataTable>
  </DsPage>
</template>
