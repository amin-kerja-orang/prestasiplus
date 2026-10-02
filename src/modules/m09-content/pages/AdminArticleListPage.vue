<script setup lang="ts">
/**
 * S1 `/admin/articles` "Pengurusan Artikel - Admin PRESTASIPLUS" (FR-M09-01..09; DV-M09-03).
 *
 * - GET filter form (`search`, `category`, `published`), no auto-submit; "Reset" clears it. The query
 *   string is the state and the controls follow it.
 * - Table of 20 rows from `GET /api/admin/articles`; the pager keeps the active filters (DV-M09-03).
 * - Delete: native confirm, DELETE, reload at the same URL with the success flash.
 * - The table scrolls inside its card below 1280 (no page scroll).
 */
import { Inbox, Plus, Search, Star } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { DataTableCard, LaravelPager, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { confirmNative, useApi, useFlash } from '@/composables'

import {
  deleteAdminArticle,
  fetchAdminArticles,
  type AdminArticleItem,
} from '../api/admin-articles-notes'
import AdminRowActions from '../components/admin-articles-notes/AdminRowActions.vue'
import AdminStatusPill from '../components/admin-articles-notes/AdminStatusPill.vue'
import {
  ARTICLES_LIST_PATH,
  ARTICLE_ROUTES,
  CATEGORY_OPTIONS,
  COPY,
  PRIMARY_BUTTON_CLASS,
  PUBLISHED_FILTER_OPTIONS,
  RESET_BUTTON_CLASS,
  errorLines,
  limitText,
  listDate,
  queryPage,
  queryText,
} from '../lib/admin-articles-notes'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

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

/** Filters kept on every pager link (DV-M09-03). */
const pagerQuery = computed(() => {
  const out: Record<string, string> = {}
  if (applied.value.search !== '') out.search = applied.value.search
  if (applied.value.category !== '') out.category = applied.value.category
  if (applied.value.published !== '') out.published = applied.value.published
  return out
})

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

function goToPage(page: number): void {
  void router.push({ path: ARTICLES_LIST_PATH, query: { ...pagerQuery.value, page: String(page) } })
}

const deleting = ref(false)

async function remove(row: AdminArticleItem): Promise<void> {
  if (!confirmNative(COPY.confirmDeleteArticle)) return
  if (deleting.value) return
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

const COLUMNS = ['Tajuk', 'Kategori', 'Tahap', 'Status', 'Views', 'Tarikh', 'Tindakan'] as const
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="admin-articles-page">
    <!-- Filter card: GET form, no auto-submit. -->
    <form
      method="get"
      class="grid gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-2 sm:p-5 lg:grid-cols-[2fr_1fr_1fr_auto]"
      data-testid="admin-articles-filter"
      @submit.prevent="submitFilter"
    >
      <input
        v-model="search"
        type="text"
        name="search"
        placeholder="Cari artikel..."
        :class="[FORM_INPUT_CLASS, 'min-h-11 sm:col-span-2 lg:col-span-1']"
        data-testid="admin-articles-search"
      />
      <select
        v-model="category"
        name="category"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="admin-articles-category"
      >
        <option value="all">Semua Kategori</option>
        <option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <select
        v-model="published"
        name="published"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="admin-articles-published"
      >
        <option v-for="o in PUBLISHED_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <div class="flex gap-3 sm:col-span-2 lg:col-span-1">
        <button type="submit" :class="PRIMARY_BUTTON_CLASS" data-testid="admin-articles-submit">
          <Search class="h-4 w-4" aria-hidden="true" />
          Cari
        </button>
        <RouterLink
          :to="ARTICLES_LIST_PATH"
          :class="RESET_BUTTON_CLASS"
          data-testid="admin-articles-reset"
        >
          Reset
        </RouterLink>
      </div>
    </form>

    <AlertBox v-if="error" :messages="errorLines(error)" data-testid="admin-articles-error" />

    <DataTableCard v-else-if="data" :min-width="780">
      <template #header>
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4"
        >
          <div>
            <h2 class="font-heading text-lg font-bold text-slate-800">Senarai Artikel</h2>
            <p class="text-sm text-slate-500" data-testid="admin-articles-count">
              Jumlah: {{ total }} artikel
            </p>
          </div>
          <RouterLink
            :to="{ name: ARTICLE_ROUTES.create }"
            :class="PRIMARY_BUTTON_CLASS"
            data-testid="admin-articles-add"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            Tambah
          </RouterLink>
        </div>
      </template>

      <table :class="T.table" data-testid="admin-articles-table">
        <thead class="bg-slate-50">
          <tr>
            <th
              v-for="label in COLUMNS"
              :key="label"
              scope="col"
              :class="T.th"
              data-testid="admin-articles-th"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0" :class="T.row" data-testid="admin-articles-empty">
            <td :colspan="COLUMNS.length" class="px-4 py-12 text-center text-slate-400">
              <Inbox class="mx-auto mb-2 h-10 w-10" aria-hidden="true" />
              <p class="font-medium text-slate-500">{{ COPY.articleEmpty }}</p>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="[T.row, 'align-middle']"
            data-testid="admin-article-row"
            :data-article-id="row.id"
          >
            <td :class="[T.td, 'min-w-56']">
              <div class="flex items-start gap-1.5">
                <Star
                  v-if="row.isFeatured"
                  class="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-400"
                  title="Featured"
                  data-testid="article-featured"
                />
                <span class="font-semibold text-slate-800" data-testid="article-title">{{
                  limitText(row.title, 50)
                }}</span>
              </div>
              <div class="text-xs text-slate-500" data-testid="article-author">
                Oleh: {{ row.author.name }}
              </div>
            </td>
            <td :class="T.td">
              <span
                class="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-blue-700"
                data-testid="article-category"
                >{{ row.categoryLabel }}</span
              >
            </td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="article-grade">
              {{ row.gradeLevel }}
            </td>
            <td :class="T.td"><AdminStatusPill :published="row.isPublished" /></td>
            <td :class="T.td" data-testid="article-views">{{ row.views }}</td>
            <td :class="[T.td, 'whitespace-nowrap']" data-testid="article-date">
              {{ listDate(row.createdAt) }}
            </td>
            <td :class="T.td">
              <AdminRowActions
                :view-to="`${ARTICLES_LIST_PATH}/${row.id}`"
                :edit-to="`${ARTICLES_LIST_PATH}/${row.id}/edit`"
                :busy="deleting"
                @remove="remove(row)"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <template #footer>
        <div v-if="data.meta.totalPages > 1" class="border-t border-slate-100 px-4 py-3">
          <LaravelPager
            :page="applied.page"
            :total="total"
            :per-page="data.meta.pageSize"
            :path="ARTICLES_LIST_PATH"
            :query="pagerQuery"
            @change="goToPage"
          />
        </div>
      </template>
    </DataTableCard>
  </div>
</template>
