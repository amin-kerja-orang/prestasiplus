<script setup lang="ts">
/**
 * S2 `/admin/articles/create` "Tambah Artikel - Admin PRESTASIPLUS" and S3 `/admin/articles/:id/edit`
 * "Edit Artikel - Admin PRESTASIPLUS" (FR-M09-11..18). One form for both: `mode="create"` posts a new
 * article ("Simpan Artikel"), `mode="edit"` loads it and pre-fills the fields ("Kemaskini Artikel").
 *
 * - Native HTML validation only (`required`, no `novalidate`): the browser blocks the submit.
 * - "Kandungan" is a plain textarea where the admin types HTML (DV-M09-02 rejected, SEC-M09-01).
 * - The category select has the "Pilih kategori" placeholder on create only (FR-M09-16).
 * - 422: the field messages show under the fields and the input is kept. Success queues the flash
 *   (PROPOSED COPY) and returns to S1. An unknown id (also a non-numeric one such as `categories`)
 *   returns to S1 with the one-time flash "Artikel tidak dijumpai." (FR-M09-10).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'
import { useApi, useFlash } from '@/composables'

import {
  createAdminArticle,
  fetchAdminArticle,
  updateAdminArticle,
  type ArticleInputBody,
} from '../api/admin-articles-notes'
import type { ArticleCategory, GradeLevel } from '../api/types'
import AdminBackLink from '../components/admin-articles-notes/AdminBackLink.vue'
import AdminFormActions from '../components/admin-articles-notes/AdminFormActions.vue'
import AdminFormField from '../components/admin-articles-notes/AdminFormField.vue'
import {
  ARTICLES_LIST_PATH,
  CATEGORY_OPTIONS,
  COPY,
  GRADE_OPTIONS,
  errorLines,
  fieldErrors,
  isNotFoundError,
} from '../lib/admin-articles-notes'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: string }>(), { id: '' })

const router = useRouter()
const flash = useFlash()

const editing = computed(() => props.mode === 'edit')
const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

interface ArticleForm {
  title: string
  excerpt: string
  content: string
  featuredImage: string
  category: ArticleCategory | ''
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
}

const form = reactive<ArticleForm>({
  title: '',
  excerpt: '',
  content: '',
  featuredImage: '',
  category: '',
  gradeLevel: 'SEMUA',
  isPublished: false,
  isFeatured: false,
})

// S3: GET /api/admin/articles/:id pre-fills the form (never fetched for a non-numeric id).
const { data: loaded, error: loadError } = useApi(
  (signal) => fetchAdminArticle(numericId.value ?? 0, { signal }),
  () => props.id,
  { immediate: props.mode === 'edit' && numericId.value !== null },
)

watch(
  loaded,
  (article) => {
    if (!article) return
    form.title = article.title
    form.excerpt = article.excerpt ?? ''
    form.content = article.content
    form.featuredImage = article.featuredImage ?? ''
    form.category = article.category
    form.gradeLevel = article.gradeLevel
    form.isPublished = article.isPublished
    form.isFeatured = article.isFeatured
  },
  { immediate: true },
)

/** FR-M09-10: an unknown article returns to S1 with the one-time error flash. */
function backWithNotFound(): void {
  flash.error(COPY.articleNotFound)
  void router.replace(ARTICLES_LIST_PATH)
}

if (props.mode === 'edit' && numericId.value === null) backWithNotFound()

watch(loadError, (err) => {
  if (err && isNotFoundError(err)) backWithNotFound()
})

const failed = computed(() => loadError.value !== null && !isNotFoundError(loadError.value))
const ready = computed(() => !editing.value || loaded.value !== null)

const saving = ref(false)
const topErrors = ref<string[]>([])
const fieldMessages = ref<Record<string, string>>({})

/** Server message of one field, under either of its names. */
function messageOf(...names: string[]): string | undefined {
  for (const name of names) {
    const text = fieldMessages.value[name]
    if (text) return text
  }
  return undefined
}

function inputClass(...names: string[]): string[] {
  return [
    FORM_INPUT_CLASS,
    'min-h-11',
    ...(messageOf(...names) !== undefined ? [FORM_ERROR_MODIFIER] : []),
  ]
}

const KNOWN_FIELDS = [
  'title',
  'excerpt',
  'content',
  'featuredImage',
  'featured_image',
  'category',
  'gradeLevel',
  'grade_level',
]

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  topErrors.value = []
  fieldMessages.value = {}
  const trimmed = (value: string): string | null => (value.trim() === '' ? null : value.trim())
  const body: ArticleInputBody = {
    title: form.title,
    excerpt: trimmed(form.excerpt),
    content: form.content,
    featuredImage: trimmed(form.featuredImage),
    category: form.category as ArticleCategory,
    gradeLevel: form.gradeLevel,
    isPublished: form.isPublished,
    isFeatured: form.isFeatured,
  }
  try {
    const result =
      editing.value && numericId.value !== null
        ? await updateAdminArticle(numericId.value, body)
        : await createAdminArticle(body)
    flash.success(result.status)
    await router.push(ARTICLES_LIST_PATH)
  } catch (err) {
    const fields = fieldErrors(err)
    fieldMessages.value = fields
    const unmatched = Object.entries(fields)
      .filter(([name]) => !KNOWN_FIELDS.includes(name))
      .map(([, text]) => text)
    topErrors.value = Object.keys(fields).length === 0 ? errorLines(err) : unmatched
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="admin-article-form-page">
    <AdminBackLink :to="ARTICLES_LIST_PATH" />

    <AlertBox v-if="failed" :messages="COPY.loadFailed" data-testid="admin-article-load-error" />

    <form
      v-else-if="ready"
      method="post"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="admin-article-form"
      @submit.prevent="submit"
    >
      <AlertBox :messages="topErrors" data-testid="admin-article-form-alert" />

      <AdminFormField id="article-title" label="Tajuk Artikel" required :error="messageOf('title')">
        <input
          id="article-title"
          v-model="form.title"
          type="text"
          name="title"
          required
          placeholder="cth: 10 Tips Belajar Matematik"
          :class="inputClass('title')"
          data-testid="article-title"
        />
      </AdminFormField>

      <AdminFormField id="article-excerpt" label="Ringkasan" :error="messageOf('excerpt')">
        <textarea
          id="article-excerpt"
          v-model="form.excerpt"
          name="excerpt"
          rows="3"
          placeholder="Ringkasan artikel"
          :class="[FORM_TEXTAREA_CLASS, messageOf('excerpt') ? FORM_ERROR_MODIFIER : '']"
          data-testid="article-excerpt"
        ></textarea>
      </AdminFormField>

      <AdminFormField id="article-content" label="Kandungan" required :error="messageOf('content')">
        <textarea
          id="article-content"
          v-model="form.content"
          name="content"
          rows="15"
          required
          placeholder="Tulis kandungan artikel di sini..."
          :class="[FORM_TEXTAREA_CLASS, messageOf('content') ? FORM_ERROR_MODIFIER : '']"
          data-testid="article-content"
        ></textarea>
      </AdminFormField>

      <AdminFormField
        id="article-image"
        label="URL Gambar Utama"
        :error="messageOf('featuredImage', 'featured_image')"
      >
        <input
          id="article-image"
          v-model="form.featuredImage"
          type="url"
          name="featured_image"
          placeholder="https://example.com/image.jpg"
          :class="inputClass('featuredImage', 'featured_image')"
          data-testid="article-image"
        />
      </AdminFormField>

      <div class="grid gap-5 md:grid-cols-2">
        <AdminFormField
          id="article-category"
          label="Kategori"
          required
          :error="messageOf('category')"
        >
          <select
            id="article-category"
            v-model="form.category"
            name="category"
            required
            :class="[
              FORM_SELECT_CLASS,
              'min-h-11',
              messageOf('category') ? FORM_ERROR_MODIFIER : '',
            ]"
            data-testid="article-category"
          >
            <option v-if="!editing" value="">Pilih kategori</option>
            <option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </AdminFormField>

        <AdminFormField
          id="article-grade"
          label="Tahap Pendidikan"
          :error="messageOf('gradeLevel', 'grade_level')"
        >
          <select
            id="article-grade"
            v-model="form.gradeLevel"
            name="grade_level"
            :class="[FORM_SELECT_CLASS, 'min-h-11']"
            data-testid="article-grade"
          >
            <option v-for="o in GRADE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </AdminFormField>
      </div>

      <div class="flex flex-wrap gap-x-6">
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            v-model="form.isPublished"
            type="checkbox"
            name="is_published"
            value="1"
            class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            data-testid="article-published"
          />
          <span class="text-sm font-semibold text-slate-700">Terbitkan Sekarang</span>
        </label>
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            v-model="form.isFeatured"
            type="checkbox"
            name="is_featured"
            value="1"
            class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            data-testid="article-featured"
          />
          <span class="text-sm font-semibold text-slate-700">Artikel Featured</span>
        </label>
      </div>

      <AdminFormActions
        :cancel-to="ARTICLES_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Artikel' : 'Simpan Artikel'"
        :saving="saving"
      />
    </form>
  </div>
</template>
